// "Add more": fetches fresh notes / Q&A / flashcards / questions / videos from a new angle.
// Each call costs 1 SerpApi search.
import { searchGoogle, searchYouTube } from "./serp.js";
import { fromText, norm, clean, short, siteless, mcqsFromQna, mcqsFromCloze, overviewParagraphs } from "./generate.js";

const VARIANTS = {
  notes: ["key facts", "explained simply", "summary", "important points", "examples", "common mistakes"],
  qna: ["questions and answers", "why", "how does it work", "important questions", "viva questions"],
  flashcards: ["definition", "key terms", "facts and formulas", "meaning", "types"],
  mcqs: ["MCQ", "quiz questions", "multiple choice questions", "important questions"],
  videos: ["tutorial", "in 5 minutes", "full lesson", "revision"],
};
export const MORE_KINDS = Object.keys(VARIANTS);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export async function buildMore({ topic, kind, round = 0, context = "", have = [] }) {
  const list = VARIANTS[kind];
  const variant = list[round % list.length];
  const pageNo = Math.floor(round / list.length);
  const seen = new Set(have.map(norm));
  const fresh = (key) => {
    const k = norm(key);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  };

  if (kind === "videos") {
    const yt = await searchYouTube(`${topic} ${variant}`);
    const items = (yt.video_results || [])
      .filter((v) => v.link && !seen.has(v.link) && seen.add(v.link))
      .slice(0, 4)
      .map((v) => ({
        title: v.title, link: v.link,
        thumbnail: typeof v.thumbnail === "string" ? v.thumbnail : v.thumbnail?.static,
        channel: v.channel?.name, length: v.length, views: v.views,
      }));
    return { items };
  }

  const web = await searchGoogle(`${topic} ${variant}`, pageNo ? { start: pageNo * 10 } : {});
  const page = context ? fromText(context, topic) : null;
  const organic = (web.organic_results || []).filter((r) => r.snippet);
  const qnaWeb = [
    ...(web.related_questions || []).map((q) => ({ question: clean(q.question), answer: clean(q.snippet || q.answer || "") })),
    ...organic.filter((r) => /\?$/.test(r.title || "")).map((r) => ({ question: clean(r.title), answer: clean(r.snippet) })),
  ].filter((q) => q.question && q.answer);

  if (kind === "notes") {
    const points = [
      ...(page?.sentences || []).slice(0, 40),
      web.knowledge_graph?.description,
      ...overviewParagraphs(web),
      ...organic.map((r) => r.snippet),
    ].filter(Boolean).map(clean).filter(fresh).slice(0, 6);
    return { items: { heading: `More: ${variant}`, points } };
  }

  if (kind === "qna") {
    const pageQna = (page?.defs || []).map((d) => ({ question: `What is ${d.term}?`, answer: d.sentence }));
    return { items: [...pageQna, ...qnaWeb].filter((q) => fresh(q.question)).slice(0, 6) };
  }

  if (kind === "flashcards") {
    const kg = web.knowledge_graph;
    const cards = [
      ...(page?.defs || []).map((d) => ({ front: d.term, back: short(d.sentence, 220) })),
      kg?.description ? { front: `What is ${kg.title || topic}?`, back: short(clean(kg.description), 220) } : null,
      ...qnaWeb.map((q) => ({ front: q.question, back: short(q.answer, 220) })),
      ...organic.map((r) => ({ front: siteless(r.title), back: short(clean(r.snippet), 220) })),
    ].filter(Boolean);
    return { items: cards.filter((c) => fresh(c.front)).slice(0, 8) };
  }

  // mcqs
  const related = (web.related_searches || []).map((r) => r.query).filter(Boolean);
  const made = [
    ...(page ? mcqsFromCloze(page.sentences, [], related) : []),
    ...mcqsFromQna(qnaWeb),
    ...mcqsFromCloze(overviewParagraphs(web), organic, related),
  ];
  return { items: made.filter((q) => fresh(q.question)).slice(0, 5) };
}
