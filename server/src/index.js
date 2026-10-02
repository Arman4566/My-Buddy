import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

import { initDb, getCached, saveSearch, recentSearches } from "./db.js";
import { searchGoogle, searchYouTube, googleLens } from "./serp.js";
import { buildStudyPack, topicFromLens } from "./generate.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

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
  try {
    const lens = await googleLens(`${base}/uploads/${req.file.filename}`);
    res.json(topicFromLens(lens));
  } finally {
    fs.unlink(req.file.path, () => {});
  }
}));

// Topic -> notes, Q&A, flashcards, MCQs, videos
app.post("/api/study", wrap(async (req, res) => {
  const topic = String(req.body.topic || "").trim().slice(0, 120);
  const source = ["text", "ocr", "lens"].includes(req.body.source) ? req.body.source : "text";
  if (topic.length < 2) return res.status(400).json({ error: "Enter a topic." });

  const topicKey = topic.toLowerCase();
  const cached = await getCached(topicKey);
  if (cached) return res.json({ ...cached, cached: true });

  const [web, yt] = await Promise.all([
    searchGoogle(topic),
    searchYouTube(`${topic} explained`).catch(() => null),
  ]);
  const pack = buildStudyPack(topic, web, yt);
  await saveSearch(topicKey, topic, source, pack);
  res.json({ ...pack, cached: false });
}));

app.get("/api/history", wrap(async (_req, res) => res.json(await recentSearches())));

// ---- Serve the built React app in production
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = process.env.PORT || 4000;
initDb()
  .catch((e) => console.error("DB init failed:", e.message))
  .finally(() => app.listen(port, () => console.log(`My Buddy running on :${port}`)));
