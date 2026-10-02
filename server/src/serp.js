// Every external call in this app goes through SerpApi.
import { getJson } from "serpapi";

const api_key = () => {
  if (!process.env.SERPAPI_KEY) throw new Error("SERPAPI_KEY is not set on the server.");
  return process.env.SERPAPI_KEY;
};

export const searchGoogle = (q, extra = {}) =>
  getJson({ engine: "google", q, hl: "en", ...extra, api_key: api_key() });

export const searchYouTube = (q) =>
  getJson({ engine: "youtube", search_query: q, api_key: api_key() });

export const googleLens = (url) =>
  getJson({ engine: "google_lens", url, api_key: api_key() });
