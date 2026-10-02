# My Buddy

Snap or upload a photo of a textbook page or diagram and get notes, Q&A, flashcards, a quiz and YouTube videos.

**Stack:** React (Vite), Node.js/Express, PostgreSQL, Render. **SerpApi is the only external API.**

## Features
- Photo or topic in, study pack out: notes, Q&A, flashcards, quiz, YouTube videos
- Animated mascot, drag-and-drop photo box, dark mode, loading skeletons
- 3D flip flashcards with "Got it / Still learning" queue, shuffle and keyboard shortcuts
- Quiz with progress bar, streaks, confetti and a review of missed questions
- XP, levels and a daily study streak (saved in the browser)
- Personal library: save study packs and reopen them instantly
- Read notes aloud, copy or download notes as Markdown
- "Go deeper" topic bubbles that start a new study pack
- Floating focus timer (25 min focus, 5 min break) that earns XP

## How it works
1. The photo is resized in the browser. **Tesseract.js** (an open-source library, not an API) reads any text.
2. If there is no readable text, **SerpApi Google Lens** identifies the picture.
3. The topic is shown so the student can fix it. Then the server calls **SerpApi Google Search** and **SerpApi YouTube**.
4. `server/src/generate.js` turns the results into notes, Q&A, flashcards and MCQs with plain code (no AI model).
5. Results are cached in Postgres by topic for 7 days (saves SerpApi credits).
## Try it by yourself
only at https://my-buddy-k65a.onrender.com/
## Run locally
```bash
cp server/.env.example server/.env     # add SERPAPI_KEY (DATABASE_URL optional)
npm --prefix server install
npm --prefix client install
npm run dev:server                     # terminal 1 -> http://localhost:4000
npm run dev:client                     # terminal 2 -> http://localhost:5173
```
Typing a topic works right away. Identifying pictures with Google Lens also needs `PUBLIC_URL` to be a public https address, e.g. `ngrok http 4000`.

## Deploy on Render
1. Push this folder to GitHub.
2. Render dashboard -> New -> Blueprint -> pick the repo (uses `render.yaml`: web service + Postgres).
3. Set `SERPAPI_KEY` and `PUBLIC_URL` (your `https://<name>.onrender.com` address).
4. Deploy. The server creates its tables on start.

## API
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/identify` | multipart `image` | `{ topic, candidates }` |
| POST | `/api/study` | `{ topic, source }` | notes, qna, flashcards, mcqs, videos |
| GET | `/api/history` | | recent topics |

## Known limits
- Quality depends on Google snippets. MCQs are simple fill-in-the-blank or pick-the-answer.
- Handwriting OCR is weak, so students can edit the detected topic before generating.
- Next steps: user accounts, spaced-repetition scheduling, saved decks.
