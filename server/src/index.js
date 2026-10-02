import "dotenv/config";
import express from "express";
import cors from "cors";
import compression from "compression";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

import { initDb, getCached, saveSearch, getBySlug, listForSitemap } from "./db.js";
import { searchGoogle, searchYouTube, googleLens } from "./serp.js";
import { buildStudyPack, topicFromLens } from "./generate.js";
import { cleanPack } from "./latex.js";
import { buildMore, MORE_KINDS } from "./more.js";
import { renderPage, isIndexable, slugify, unslug, robotsTxt, sitemapXml } from "./seo.js";

const app = express();
app.set("trust proxy", 1);
app.use(compression());
app.use(cors());
app.use(express.json({ limit: "300kb" }));

// ---- Simple per-visitor limit on anything that spends SerpApi credits
const hits = new Map();
function tooMany(req, max = 40, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const recent = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) return true;
  recent.push(now);
  hits.set(req.ip, recent);
  return false;
}
setInterval(() => hits.clear(), 60 * 60 * 1000).unref();
const slowDown = (res) => res.status(429).json({ error: "You're going fast! Please wait a few minutes and try again." });

// ---- Temporary photo hosting (Google Lens needs a public URL)
const uploadDir = path.join(os.tmpdir(), "mybuddy-uploads");
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) =>
      cb(null, crypto.randomBytes(12).toString("hex") + path.extname(file.originalname || ".jpg")),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});
app.use("/uploads", express.static(uploadDir));

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: err.message || "Something went wrong." });
  });
const siteUrl = (req) => (process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Photo -> topic (Google Lens through SerpApi)
app.post("/api/identify", upload.single("image"), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Upload an image file." });
  const base = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
  if (!base || /localhost|127\.0\.0\.1/.test(base)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({
      error: "Google Lens needs a public PUBLIC_URL (deploy on Render or use an ngrok tunnel).",
    });
  }
  if (tooMany(req)) { fs.unlink(req.file.path, () => {}); return slowDown(res); }
  try {
    const lens = await googleLens(`${base}/uploads/${req.file.filename}`);
    res.json(topicFromLens(lens));
  } finally {
    fs.unlink(req.file.path, () => {});
  }
}));

// Topic (+ optional text read from the student's photo) -> notes, Q&A, flashcards, MCQs, videos
app.post("/api/study", wrap(async (req, res) => {
  const topic = String(req.body.topic || "").trim().slice(0, 120);
  const context = String(req.body.context || "").slice(0, 6000);
  const source = ["text", "ocr", "lens"].includes(req.body.source) ? req.body.source : "text";
  if (topic.length < 2) return res.status(400).json({ error: "Enter a topic." });

  // Packs built from someone's photo are personal: never cached and never made public.
  const topicKey = topic.toLowerCase();
  if (!context) {
    const cached = await getCached(topicKey);
    if (cached) return res.json({ ...cleanPack(cached), cached: true });
  }
  if (tooMany(req)) return slowDown(res);

  const [web, yt] = await Promise.all([
    searchGoogle(topic),
    searchYouTube(`${topic} explained`).catch(() => null),
  ]);
  const pack = buildStudyPack(topic, web, yt, context);
  if (!context) await saveSearch(topicKey, topic, source, pack);
  res.json({ ...pack, cached: false });
}));

// "Add more" notes / Q&A / flashcards / questions / videos
app.post("/api/more", wrap(async (req, res) => {
  const { kind } = req.body;
  const topic = String(req.body.topic || "").trim().slice(0, 120);
  if (!MORE_KINDS.includes(kind) || topic.length < 2) return res.status(400).json({ error: "Bad request." });
  if (tooMany(req)) return slowDown(res);
  const have = (Array.isArray(req.body.have) ? req.body.have : []).slice(0, 300).map((s) => String(s).slice(0, 200));
  const round = Math.max(0, Math.min(40, Number(req.body.round) || 0));
  const context = String(req.body.context || "").slice(0, 6000);
  res.json(await buildMore({ topic, kind, round, context, have }));
}));

// ---- Serve the built React app with SEO tags injected
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
const indexPath = path.join(dist, "index.html");
if (fs.existsSync(indexPath)) {
  const template = fs.readFileSync(indexPath, "utf8");
  const html = (res, status, page) => res.status(status).type("html").send(page);

  app.get("/robots.txt", (req, res) => res.type("text/plain").send(robotsTxt(siteUrl(req))));
  app.get("/sitemap.xml", wrap(async (req, res) => {
    const rows = await listForSitemap().catch(() => []);
    res.type("application/xml").send(sitemapXml(siteUrl(req), rows));
  }));

  app.use(express.static(dist, {
    index: false,
    maxAge: "7d",
    setHeaders: (r, p) => { if (p.endsWith(".html")) r.setHeader("Cache-Control", "no-cache"); },
  }));

  app.get("/study/:slug", wrap(async (req, res) => {
    const slug = slugify(req.params.slug);
    const row = await getBySlug(slug).catch(() => null);
    const pathName = `/study/${row ? slugify(row.result.topic) : slug}`;
    if (row) return html(res, 200, renderPage(template, { siteUrl: siteUrl(req), pathName, pack: cleanPack(row.result), noindex: !isIndexable(row.result) }));
    html(res, 200, renderPage(template, { siteUrl: siteUrl(req), pathName, topicGuess: unslug(slug) }));
  }));
  app.get("/", (req, res) => html(res, 200, renderPage(template, { siteUrl: siteUrl(req) })));
  app.get("*", (req, res) => html(res, 404, renderPage(template, { siteUrl: siteUrl(req), noindex: true })));
}

const port = process.env.PORT || 4000;
initDb()
  .catch((e) => console.error("DB init failed:", e.message))
  .finally(() => app.listen(port, () => console.log(`My Buddy running on :${port}`)));
