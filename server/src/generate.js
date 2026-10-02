// Builds notes, Q&A, flashcards and MCQs from SerpApi search results.
// No AI model is used, so everything comes from Google snippets, "People also ask",
// the knowledge graph and (when present) Google's AI overview.

const STOP = new Set(
  "about above after again against because before being below between could does doing during each from further have having here itself just more most other over same should some such than that their them then there these they this those through under until very were what when where which while with would your into also been both only will can may many much".split(" ")
);

const clean = (s = "") => String(s).replace(/\s+/g, " ").trim();
const short = (s, n = 150) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);
const uniq = (a) => [...new Set(a)];
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const shuffle = (a) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};
const sentencesOf = (text) =>
  clean(text)
    .split(/(?<=[.!?])\s+/)
    .filter((s) => {
      const n = s.split(" ").length;
      return n >= 7 && n <= 35;
    });
const siteless = (title = "") => clean(title.split(/\s[-|–—]\s/)[0]);

function overviewParagraphs(web) {
  const blocks = web.ai_overview?.text_blocks || [];
  return blocks
    .flatMap((b) => [b.snippet, ...(b.list || []).map((l) => l.snippet || l.title)])
    .map(clean)
    .filter(Boolean);
}

export function buildStudyPack(topic, web, yt) {
  const kg = web.knowledge_graph || {};
  const box = web.answer_box || {};
  const overview = overviewParagraphs(web);
  const organic = (web.organic_results || []).filter((r) => r.snippet);
  const related = (web.related_searches || []).map((r) => r.query).filter(Boolean);

  // ---- Notes
  const overviewPoints = uniq(
    [kg.description, box.answer || box.snippet, ...overview.slice(0, 5)].filter(Boolean).map(clean)
  );

  const notes = {
    title: kg.title || topic,
    sections: [
      { heading: "Overview", points: overviewPoints },
      { heading: "Key points", points: organic.slice(0, 5).map((r) => clean(r.snippet)) },
      related.length ? { heading: "Go deeper", points: related.slice(0, 6) } : null,
    ].filter((s) => s && s.points.length),
    sources: organic.slice(0, 5).map((r) => ({ title: siteless(r.title), link: r.link })),
  };

  // ---- Q&A
  const qna = (web.related_questions || [])
    .map((q) => ({ question: clean(q.question), answer: clean(q.snippet || q.answer || "") }))
    .filter((q) => q.question && q.answer);
  const lead = kg.description || box.answer || box.snippet || overview[0];
  if (lead) qna.unshift({ question: `What is ${kg.title || topic}?`, answer: clean(lead) });

  // ---- Flashcards
  const flashcards = [
    ...qna.map((q) => ({ front: q.question, back: short(q.answer, 220) })),
    ...organic.slice(0, 6).map((r) => ({ front: siteless(r.title), back: short(clean(r.snippet), 220) })),
  ]
    .filter((c, i, arr) => arr.findIndex((x) => x.front === c.front) === i)
    .slice(0, 14);

  // ---- MCQs
  const mcqs = [...mcqsFromQna(qna), ...mcqsFromCloze(overviewPoints, organic, related)].slice(0, 8);

  // ---- Videos
  const videos = (yt?.video_results || []).slice(0, 6).map((v) => ({
    title: v.title,
    link: v.link,
    thumbnail: typeof v.thumbnail === "string" ? v.thumbnail : v.thumbnail?.static,
    channel: v.channel?.name,
    length: v.length,
    views: v.views,
    published: v.published_date,
  }));

  return { topic, notes, qna: qna.slice(0, 8), flashcards, mcqs, videos };
}

// "Which answer is correct?" questions built from People-also-ask pairs.
function mcqsFromQna(qna) {
  const pool = qna.filter((q) => q.answer.length > 20);
  if (pool.length < 4) return [];
  return pool.slice(0, 4).map((q) => {
    const right = short(q.answer);
    const wrong = shuffle(pool.filter((x) => x !== q)).slice(0, 3).map((x) => short(x.answer));
    const options = shuffle([right, ...wrong]);
    return { kind: "answer", question: q.question, options, answerIndex: options.indexOf(right) };
  });
}

// Fill-in-the-blank questions made from note sentences.
function mcqsFromCloze(overviewPoints, organic, related) {
  const sentences = uniq([...overviewPoints, ...organic.map((r) => r.snippet)].flatMap(sentencesOf));
  const words = (s) => s.replace(/[^A-Za-z0-9\s-]/g, "").split(" ").filter(Boolean);
  const pool = uniq(
    [...sentences, ...related].flatMap(words).filter((w) => w.length > 5 && !STOP.has(w.toLowerCase()))
  );

  const out = [];
  for (const s of sentences) {
    const ws = words(s);
    const candidates = ws.filter((w, i) => i > 0 && w.length > 5 && !STOP.has(w.toLowerCase()));
    const answer =
      candidates.find((w) => /^[A-Z]/.test(w)) || [...candidates].sort((a, b) => b.length - a.length)[0];
    if (!answer) continue;
    const wrong = shuffle(pool.filter((w) => w.toLowerCase() !== answer.toLowerCase())).slice(0, 3);
    if (wrong.length < 3) continue;
    const options = shuffle([answer, ...wrong]);
    out.push({
      kind: "cloze",
      question: s.replace(new RegExp(`\\b${escapeRe(answer)}\\b`), "_____"),
      options,
      answerIndex: options.indexOf(answer),
    });
    if (out.length >= 5) break;
  }
  return out;
}

// Pick a topic name from Google Lens results.
export function topicFromLens(lens) {
  const kg = lens.knowledge_graph?.[0]?.title;
  if (kg) return { topic: kg, candidates: [kg] };
  const titles = (lens.visual_matches || []).map((m) => siteless(m.title)).filter(Boolean);
  return { topic: titles[0] || "", candidates: uniq(titles).slice(0, 5) };
}
