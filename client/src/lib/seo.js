export const HOME_TITLE = "My Buddy: Turn a Photo into Notes, Flashcards & Quizzes";
export const HOME_DESC =
  "Snap or upload a photo of any textbook page and get study notes, flashcards, practice questions, a quiz and videos in seconds. Free for students.";

export const slugify = (t = "") =>
  String(t).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s-]/g, "")
    .trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 80).replace(/^-|-$/g, "");
export const unslug = (s = "") => String(s).replace(/-/g, " ").trim();

function setTag(selector, create, content) {
  let el = document.head.querySelector(selector);
  if (!el) { el = create(); document.head.appendChild(el); }
  el.setAttribute(el.tagName === "LINK" ? "href" : "content", content);
}
export function setSeo({ title, description, path }) {
  document.title = title;
  setTag('meta[name="description"]', () => Object.assign(document.createElement("meta"), { name: "description" }), description);
  setTag('meta[property="og:title"]', () => { const m = document.createElement("meta"); m.setAttribute("property", "og:title"); return m; }, title);
  setTag('meta[property="og:description"]', () => { const m = document.createElement("meta"); m.setAttribute("property", "og:description"); return m; }, description);
  setTag('link[rel="canonical"]', () => Object.assign(document.createElement("link"), { rel: "canonical" }), location.origin + path);
}

// The server embeds the cached pack in the page for /study/<topic> URLs.
export function readEmbeddedPack() {
  try {
    const el = document.getElementById("__PACK__");
    return el ? JSON.parse(el.textContent) : null;
  } catch { return null; }
}
