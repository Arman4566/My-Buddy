// Shrinks phone photos (often 4000px+) so OCR and uploads stay fast.
export function resizeImage(file, maxSide = 1400) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read image"))), "image/jpeg", 0.85);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error("That file isn't a readable image."));
    img.src = URL.createObjectURL(file);
  });
}

const STOP = new Set(
  "the and for are but not you all can had her was one our out has have this that with from they been were which their will would there what about when your said each than them then into more some such only other also these those very just over after because".split(" ")
);

// Guess a short search topic from OCR text: the most repeated meaningful words.
export function guessTopic(text) {
  const counts = new Map();
  for (const w of text.toLowerCase().match(/[a-z][a-z-]{3,}/g) || []) {
    if (!STOP.has(w)) counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => w)
    .join(" ");
}

export async function readText(blob, onProgress) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m) => m.status === "recognizing text" && onProgress?.(Math.round(m.progress * 100)),
  });
  try {
    const { data } = await worker.recognize(blob);
    return data.text || "";
  } finally {
    await worker.terminate();
  }
}
