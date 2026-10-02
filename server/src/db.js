import pg from "pg";
import fs from "fs";

const url = process.env.DATABASE_URL;
const pool = url
  ? new pg.Pool({
      connectionString: url,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    })
  : null;

export const dbEnabled = Boolean(pool);

export async function initDb() {
  if (!pool) return console.log("No DATABASE_URL set: running without cache/history.");
  const sql = fs.readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
  await pool.query(sql);
  console.log("Database ready.");
}

export async function getCached(topicKey, maxAgeDays = 7) {
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT result FROM searches
     WHERE topic_key = $1 AND created_at > now() - ($2 || ' days')::interval
     ORDER BY created_at DESC LIMIT 1`,
    [topicKey, String(maxAgeDays)]
  );
  return rows[0]?.result ?? null;
}

export async function saveSearch(topicKey, topic, source, result) {
  if (!pool) return;
  await pool.query(
    "INSERT INTO searches (topic_key, topic, source, result) VALUES ($1, $2, $3, $4)",
    [topicKey, topic, source, result]
  );
}

export async function recentSearches(limit = 12) {
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (topic_key) topic, source, created_at
     FROM searches ORDER BY topic_key, created_at DESC`
  );
  return rows.sort((a, b) => b.created_at - a.created_at).slice(0, limit);
}
