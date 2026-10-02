// Google's AI overview sometimes returns LaTeX (e.g. $\text{CO}_{2}$). Turn it into plain Unicode text.
const SUB = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋" };
const SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻" };
const SYMBOLS = {
  rightarrow: "→", to: "→", longrightarrow: "→", leftarrow: "←", rightleftharpoons: "⇌", leftrightarrow: "↔",
  times: "×", cdot: "·", pm: "±", approx: "≈", neq: "≠", leq: "≤", geq: "≥", degree: "°", circ: "°",
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", mu: "μ", lambda: "λ", pi: "π", sigma: "σ", omega: "ω",
};
const mapChars = (str, table) => (str.split("").every((c) => table[c]) ? str.split("").map((c) => table[c]).join("") : null);
function delatex(math) {
  let m = math;
  m = m.replace(/\\(?:text|mathrm|mathbf|textbf|mathit|operatorname)\s*\{([^{}]*)\}/g, "$1");
  m = m.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)");
  m = m.replace(/_\{([^{}]*)\}|_([A-Za-z0-9])/g, (_, a, b) => { const t = a ?? b; return mapChars(t, SUB) ?? `_${t}`; });
  m = m.replace(/\^\{([^{}]*)\}|\^([A-Za-z0-9])/g, (_, a, b) => { const t = a ?? b; return mapChars(t, SUP) ?? `^${t}`; });
  m = m.replace(/\\([A-Za-z]+)/g, (_, name) => SYMBOLS[name] ?? "");
  m = m.replace(/\\[ ,;:!]/g, " ").replace(/[{}]/g, "");
  return m.replace(/\s*→\s*/g, " → ").replace(/\s+/g, " ").trim();
}
const stripLatex = (s) =>
  s
    .replace(/\$\$([^$]+)\$\$/g, (_, m) => delatex(m))
    .replace(/\$([^$]+)\$/g, (_, m) => delatex(m))
    .replace(/\\\(([^]*?)\\\)/g, (_, m) => delatex(m))
    .replace(/\\\[([^]*?)\\\]/g, (_, m) => delatex(m));

export { stripLatex };

// Sentences that are mostly a formula make bad fill-in-the-blank questions.
export const isFormulaLike = (s) => /[→⇌↔=]|[₀-₉⁰-⁹]|\\|\$/.test(s);

const fixText = (s) => stripLatex(s).replace(/\s+/g, " ").trim();
const deep = (v) =>
  typeof v === "string" ? fixText(v) : Array.isArray(v) ? v.map(deep) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)])) : v;

// Repairs a study pack that was saved before LaTeX was handled (database cache, browser library).
export function cleanPack(pack) {
  if (!pack || typeof pack !== "object") return pack;
  const fixed = deep(pack);
  if (Array.isArray(fixed.mcqs)) {
    const before = pack.mcqs;
    fixed.mcqs = fixed.mcqs.filter((q, i) => !(q.kind === "cloze" && (isFormulaLike(q.question) || /[\\$]|rightarrow/.test(JSON.stringify(before[i].options)))));
    // answerIndex still matches because options are only text-cleaned, never reordered
  }
  return fixed;
}
