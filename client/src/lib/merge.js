// Helpers for the "add more" buttons.
const trim = (s) => String(s).slice(0, 160);

export function haveFor(kind, pack) {
  const list = {
    notes: () => pack.notes.sections.flatMap((s) => s.points),
    qna: () => pack.qna.map((q) => q.question),
    flashcards: () => pack.flashcards.map((c) => c.front),
    mcqs: () => pack.mcqs.map((q) => q.question),
    videos: () => pack.videos.map((v) => v.link),
  }[kind]();
  return list.slice(-250).map(trim);
}

export const countOf = (kind, items) => (kind === "notes" ? items.points.length : items.length);

export function mergeMore(pack, kind, items) {
  const rounds = { ...(pack.rounds || {}), [kind]: (pack.rounds?.[kind] || 0) + 1 };
  const next = { ...pack, rounds };
  if (kind === "notes") {
    if (!items.points.length) return next;
    const sections = [...pack.notes.sections];
    const at = sections.findIndex((s) => s.heading === "Go deeper");
    sections.splice(at === -1 ? sections.length : at, 0, items);
    next.notes = { ...pack.notes, sections };
  } else if (items.length) {
    next[kind] = [...pack[kind], ...items];
  }
  return next;
}
