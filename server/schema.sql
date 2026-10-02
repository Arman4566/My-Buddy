CREATE TABLE IF NOT EXISTS searches (
  id         SERIAL PRIMARY KEY,
  topic_key  TEXT NOT NULL,
  topic      TEXT NOT NULL,
  source     TEXT NOT NULL DEFAULT 'text',   -- text | ocr | lens
  result     JSONB NOT NULL,                 -- notes, qna, flashcards, mcqs, videos
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE searches ADD COLUMN IF NOT EXISTS slug TEXT;
CREATE INDEX IF NOT EXISTS searches_topic_key_idx ON searches (topic_key, created_at DESC);
CREATE INDEX IF NOT EXISTS searches_slug_idx ON searches (slug);
