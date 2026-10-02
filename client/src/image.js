// Photo handling: resize, clean up for OCR, read the text, then work out what the page is about.

export function resizeImage(file, maxSide = 1800) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read image"))), "image/jpeg", 0.88);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error("That file isn't a readable image."));
    img.src = URL.createObjectURL(file);
  });
}

// Grayscale + contrast stretch makes phone photos of pages much easier for OCR.
export async function enhanceForOcr(blob) {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data, hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    d[i] = d[i + 1] = d[i + 2] = g; hist[g]++;
  }
  const total = c.width * c.height;
  let lo = 0, hi = 255, acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > total * 0.02) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > total * 0.02) { hi = v; break; } }
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, (((d[i] - lo) * 255) / range) | 0));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return new Promise((r) => c.toBlob(r, "image/png"));
}

export async function readText(blob, onProgress) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m) => m.status === "recognizing text" && onProgress?.(Math.round(m.progress * 100)),
  });
  try {
    const { data } = await worker.recognize(await enhanceForOcr(blob));
    return { text: data.text || "", lines: data.lines || [] };
  } finally {
    await worker.terminate();
  }
}

/* ---------- Understanding the page ---------- */
const STOP = new Set(
  "a an the and or but if then else when while of at by for with about against between into through during before after above below to from up down in out on off over under again further once here there all any both each few more most other some such no nor not only own same so than too very can will just should now is are was were be been being have has had having do does did doing this that these those it its they them their what which who whom whose how why where i you he she we me my your our also may might must shall would could many much one two three first second use used using like called known".split(" ")
);
const GENERIC = /^(chapter|unit|page|exercise|exercises|introduction|summary|contents?|lesson|figure|fig|table|note|notes|example|answer|question|activity|worksheet)\b/i;
const letterRatio = (s) => (s.match(/[A-Za-z]/g) || []).length / Math.max(1, s.replace(/\s/g, "").length);
const wordCount = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] || 0;
const titleCase = (s) => s.replace(/(^|\s)\S/g, (c) => c.toUpperCase());

// RAKE-style key phrase extraction: phrases are runs of words between stop words / punctuation.
function keyPhrases(text) {
  const tokens = text.toLowerCase().replace(/[^a-z0-9'\s-]/g, " | ").split(/\s+/).filter(Boolean);
  const phrases = [];
  let cur = [];
  const flush = () => { if (cur.length) phrases.push(cur); cur = []; };
  for (const t of tokens) {
    if (t === "|" || STOP.has(t) || t.length < 3 || /^\d+$/.test(t)) flush();
    else cur.push(t);
  }
  flush();
  const freq = new Map(), deg = new Map(), counts = new Map();
  for (const p of phrases) {
    for (const w of p) { freq.set(w, (freq.get(w) || 0) + 1); deg.set(w, (deg.get(w) || 0) + p.length); }
    counts.set(p.join(" "), (counts.get(p.join(" ")) || 0) + 1);
  }
  const scores = new Map();
  for (const p of phrases) {
    if (p.length > 3) continue;
    const key = p.join(" ");
    scores.set(key, p.reduce((a, w) => a + deg.get(w) / freq.get(w), 0) * (1 + Math.log(counts.get(key))));
  }
  return [...scores.entries()].filter(([k]) => k.length >= 5).sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

export function analyzePage(text, lines = []) {
  const rows = text.replace(/-\n(?=[a-z])/g, "").split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 2 && letterRatio(l) > 0.6);
  // Short lines without punctuation are headings: end them with a full stop so they stay separate sentences.
  const context = rows.map((l) => (wordCount(l) <= 6 && !/[.!?:;,]$/.test(l) ? `${l}.` : l)).join("\n").slice(0, 6000);

  // Headings: the biggest text on the page (line height is a proxy for font size).
  const good = lines
    .filter((l) => l.confidence > 55 && l.bbox && letterRatio(l.text) > 0.7)
    .map((l) => ({ text: l.text.replace(/[^\w\s'&-]/g, "").replace(/\s+/g, " ").trim(), h: l.bbox.y1 - l.bbox.y0, y: l.bbox.y0 }))
    .filter((l) => l.text.length >= 3 && l.text.length <= 70 && wordCount(l.text) <= 8 && !GENERIC.test(l.text));
  let headings = [];
  if (good.length >= 3) {
    const med = median(good.map((g) => g.h));
    headings = good.filter((g) => g.h >= med * 1.3).sort((a, b) => b.h - a.h || a.y - b.y).map((g) => g.text);
  }
  if (!headings.length) {
    headings = rows.filter((l) => wordCount(l) <= 6 && wordCount(l) >= 1 && !/[.!?,;]$/.test(l) && !GENERIC.test(l) && /^[A-Z]/.test(l)).slice(0, 2);
  }

  const phrases = keyPhrases(rows.join(". "));
  const lowHeads = headings.slice(0, 3).map((h) => h.toLowerCase());
  const extra = phrases.filter((p) => !lowHeads.some((h) => h.includes(p) || p.includes(h)));
  const seen = new Set();
  const topics = [...headings.slice(0, 3), ...extra]
    .map((t) => titleCase(t.trim()))
    .filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()))
    .slice(0, 6);

  return { topic: topics[0] || "", topics, context, words: wordCount(context) };
}
