// Server-side SEO: meta tags, structured data, crawlable HTML, robots.txt and sitemap.xml.
// The React app is a single page, so for every URL we inject the right <head> tags and a plain-HTML
// copy of the content (React replaces it when it loads). Crawlers see real content immediately.

const SITE = "My Buddy";
const HOME_TITLE = "My Buddy: Turn a Photo into Notes, Flashcards & Quizzes";
const HOME_DESC =
  "Snap or upload a photo of any textbook page and get study notes, flashcards, practice questions, a quiz and videos in seconds. Free for students.";

export const FAQ = [
  ["How does My Buddy turn a photo into study material?",
   "It reads the text on your photo, finds the main topic and key ideas, searches the web for supporting information, and builds notes, flashcards, questions and a quiz from both your page and the search results."],
  ["Do I need an account?",
   "No. You can create study packs without signing up. Your saved library and progress are kept in your own browser."],
  ["Can I get more questions or flashcards?",
   "Yes. Every tab has a More button that finds fresh notes, questions, flashcards or videos from a new angle."],
  ["Which subjects does it work for?",
   "It works best for topics with good coverage online, such as science, history, geography and general concepts. Clear printed text is read better than handwriting."],
];

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const slugify = (t = "") =>
  String(t).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s-]/g, "")
    .trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 80).replace(/^-|-$/g, "");
export const unslug = (s = "") => String(s).replace(/-/g, " ").trim();

const cap = (s = "") => s.charAt(0).toUpperCase() + s.slice(1);
const trim = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…");
const jsonLd = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

// Only well-formed, content-rich topic pages are offered to search engines.
export function isIndexable(pack) {
  return Boolean(
    pack && typeof pack.topic === "string" && pack.topic.length >= 3 && pack.topic.length <= 80 &&
    /^[\p{L}\p{N}\s'’.,&()-]+$/u.test(pack.topic) &&
    Array.isArray(pack.qna) && pack.qna.length >= 2 &&
    Array.isArray(pack.notes?.sections) && pack.notes.sections.length >= 1
  );
}

function metaBlock({ title, desc, url, siteUrl, noindex, ld }) {
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta name="robots" content="${noindex ? "noindex,follow" : "index,follow,max-image-preview:large"}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(siteUrl)}/og-image.png" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    `<meta name="twitter:image" content="${esc(siteUrl)}/og-image.png" />`,
    ...ld.map(jsonLd),
  ].join("\n    ");
}

function homeParts(siteUrl, noindex) {
  const url = `${siteUrl}/`;
  const ld = [
    {
      "@context": "https://schema.org", "@type": "WebApplication", name: SITE, url,
      description: HOME_DESC, applicationCategory: "EducationalApplication", operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ];
  const body = `<main>
      <h1>${SITE}: Snap it. Study it. Ace it.</h1>
      <p>Turn a photo of any textbook page, or just a topic, into study notes, flashcards, practice questions, a quiz and recommended videos.</p>
      <h2>How it works</h2>
      <ol><li>Take or upload a photo, or type a topic.</li><li>My Buddy reads the page and finds the key ideas.</li><li>Study with notes, flashcards, Q&amp;A and a quiz, and add more whenever you need.</li></ol>
      <h2>Frequently asked questions</h2>
      ${FAQ.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("\n      ")}
      <noscript><p>My Buddy needs JavaScript to turn photos into study material. Please enable it.</p></noscript>
    </main>`;
  return { head: metaBlock({ title: HOME_TITLE, desc: HOME_DESC, url, siteUrl, noindex, ld }), body };
}

function packParts(pack, siteUrl, pathName, noindex) {
  const topic = pack.topic;
  const url = `${siteUrl}${pathName}`;
  const title = `${trim(cap(topic), 42)}: Notes, Flashcards & Quiz | ${SITE}`;
  const lead = pack.qna?.[0]?.answer || pack.notes?.sections?.[0]?.points?.[0] || "";
  const desc = trim(
    `Free notes, ${pack.flashcards?.length || 0} flashcards and ${pack.mcqs?.length || 0} quiz questions on ${topic}. ${lead}`,
    158
  );
  const qna = (pack.qna || []).slice(0, 8);
  const ld = [
    {
      "@context": "https://schema.org", "@type": "WebPage", name: title, url, description: desc,
      isPartOf: { "@type": "WebSite", name: SITE, url: `${siteUrl}/` }, about: topic, inLanguage: "en",
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE, item: `${siteUrl}/` },
        { "@type": "ListItem", position: 2, name: cap(topic), item: url },
      ],
    },
    qna.length && {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: qna.map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: q.answer } })),
    },
  ].filter(Boolean);

  const sections = (pack.notes?.sections || []).filter((s) => s.heading !== "Go deeper");
  const body = `<main>
      <nav aria-label="Breadcrumb"><a href="/">${SITE}</a> &rsaquo; ${esc(cap(topic))}</nav>
      <h1>${esc(cap(topic))}: notes, flashcards and quiz</h1>
      ${sections.map((s) => `<h2>${esc(s.heading)}</h2><ul>${s.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`).join("\n      ")}
      ${qna.length ? `<h2>Questions and answers</h2>${qna.map((q) => `<h3>${esc(q.question)}</h3><p>${esc(q.answer)}</p>`).join("")}` : ""}
      ${pack.flashcards?.length ? `<h2>Flashcards</h2><ul>${pack.flashcards.map((c) => `<li><strong>${esc(c.front)}</strong>: ${esc(c.back)}</li>`).join("")}</ul>` : ""}
      ${pack.videos?.length ? `<h2>Videos</h2><ul>${pack.videos.map((v) => `<li><a href="${esc(v.link)}" rel="noopener">${esc(v.title)}</a></li>`).join("")}</ul>` : ""}
    </main>`;
  const data = `<script id="__PACK__" type="application/json">${JSON.stringify(pack)
    .replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")}</script>`;
  return { head: metaBlock({ title, desc, url, siteUrl, noindex, ld }), body, data };
}

export function renderPage(template, { siteUrl, pathName = "/", pack = null, topicGuess = "", noindex = false }) {
  let parts;
  if (pack) parts = packParts(pack, siteUrl, pathName, noindex);
  else if (topicGuess) {
    const t = cap(topicGuess);
    parts = {
      head: metaBlock({ title: `${trim(t, 42)} | ${SITE}`, desc: HOME_DESC, url: `${siteUrl}${pathName}`, siteUrl, noindex: true, ld: [] }),
      body: `<main><h1>${esc(t)}</h1><p>Open My Buddy to build notes, flashcards and a quiz for this topic.</p></main>`,
    };
  } else parts = homeParts(siteUrl, noindex);
  return template
    .replace("<!--SEO_HEAD-->", () => parts.head)
    .replace("<!--SEO_BODY-->", () => parts.body)
    .replace("<!--SEO_DATA-->", () => parts.data || "");
}

export const robotsTxt = (siteUrl) =>
  `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /uploads/\n\nSitemap: ${siteUrl}/sitemap.xml\n`;

export function sitemapXml(siteUrl, rows) {
  const urls = [
    `<url><loc>${esc(siteUrl)}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
    ...rows
      .filter((r) => isIndexable({ topic: r.topic, qna: [1, 2], notes: { sections: [1] } }))
      .map((r) => `<url><loc>${esc(siteUrl)}/study/${esc(r.slug)}</loc><lastmod>${new Date(r.created_at).toISOString().slice(0, 10)}</lastmod><priority>0.7</priority></url>`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}
