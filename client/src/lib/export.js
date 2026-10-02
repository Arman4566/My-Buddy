export function packToMarkdown(p) {
  const lines = [`# ${p.notes?.title || p.topic}`, ""];
  for (const s of p.notes?.sections || []) {
    lines.push(`## ${s.heading}`, ...s.points.map((x) => `- ${x}`), "");
  }
  if (p.qna?.length) {
    lines.push("## Questions and answers");
    p.qna.forEach((q) => lines.push(`**Q: ${q.question}**`, `A: ${q.answer}`, ""));
  }
  if (p.flashcards?.length) {
    lines.push("## Flashcards");
    p.flashcards.forEach((c) => lines.push(`- ${c.front} :: ${c.back}`));
    lines.push("");
  }
  if (p.videos?.length) {
    lines.push("## Videos");
    p.videos.forEach((v) => lines.push(`- [${v.title}](${v.link})`));
  }
  lines.push("", "_Made with My Buddy_");
  return lines.join("\n");
}

export function download(filename, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
