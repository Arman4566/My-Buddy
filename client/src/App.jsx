import { useEffect, useMemo, useRef, useState } from "react";
import { studyTopic, moreStudy, identifyImage } from "./api.js";
import { resizeImage, readText, analyzePage } from "./image.js";
import { useLocal, dayStr } from "./lib/store.js";
import { cleanPack } from "./lib/latex.js";
import { packToMarkdown, download } from "./lib/export.js";
import { haveFor, mergeMore, countOf } from "./lib/merge.js";
import { HOME_TITLE, HOME_DESC, setSeo, slugify, unslug, readEmbeddedPack } from "./lib/seo.js";
import Buddy from "./components/Buddy.jsx";
import Pomodoro from "./components/Pomodoro.jsx";
import { Notes, QnA, Flashcards, Quiz, Videos } from "./components/Study.jsx";

const TABS = [
  ["notes", "📝", "Notes"],
  ["qna", "❓", "Q&A"],
  ["flash", "🃏", "Flashcards"],
  ["quiz", "🎯", "Quiz"],
  ["videos", "▶️", "Videos"],
];
const EXAMPLES = ["Photosynthesis", "Newton's laws of motion", "Mitosis", "French Revolution", "Pythagoras theorem", "Chemical bonding"];
const TIPS = [
  "Tip: explaining a topic out loud beats re-reading it.",
  "Tip: short sessions with breaks help you remember more.",
  "Tip: quiz yourself before you feel ready.",
];
const STEPS = [
  ["📷", "Snap or type", "Take a photo of a page or diagram, or just type what you're studying."],
  ["🔎", "I read & research", "My Buddy reads your page, finds the key ideas and searches the web for more."],
  ["🎓", "Study your way", "Notes, flashcards, Q&A and a quiz. Tap ＋ More any time for fresh material."],
];
const FAQ = [
  ["How does My Buddy turn a photo into study material?", "It reads the text on your photo, finds the main topic and key ideas, searches the web for supporting information, and builds notes, flashcards, questions and a quiz from both your page and the search results."],
  ["Do I need an account?", "No. You can create study packs without signing up. Your saved library and progress are kept in your own browser."],
  ["Can I get more questions or flashcards?", "Yes. Every tab has a More button that finds fresh notes, questions, flashcards or videos from a new angle."],
  ["Which subjects does it work for?", "It works best for topics with good coverage online, such as science, history, geography and general concepts. Clear printed text is read better than handwriting."],
];
const LABELS = { notes: "notes", qna: "Q&A", flashcards: "flashcards", mcqs: "questions", videos: "videos" };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function App() {
  const [embedded] = useState(readEmbeddedPack);
  const [theme, setTheme] = useLocal("mb-theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const [stats, setStats] = useLocal("mb-stats", { xp: 0, streak: 0, last: null });
  const [rawLibrary, setLibrary] = useLocal("mb-library", []);
  const library = useMemo(() => rawLibrary.map(cleanPack), [rawLibrary]);
  const [topic, setTopic] = useState(() =>
    embedded?.topic || (location.pathname.startsWith("/study/") ? unslug(location.pathname.split("/")[2] || "") : ""));
  const [source, setSource] = useState("text");
  const [preview, setPreview] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [topics, setTopics] = useState([]);
  const [context, setContext] = useState("");
  const [useCtx, setUseCtx] = useState(true);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pack, setPack] = useState(embedded);
  const [tab, setTab] = useState("notes");
  const [drag, setDrag] = useState(false);
  const [toast, setToast] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [moreBusy, setMoreBusy] = useState("");
  const fileRef = useRef(), camRef = useRef(), resultsRef = useRef();

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 1900); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (pack) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [pack?.topic]); // eslint-disable-line
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  useEffect(() => {
    const back = () => { if (location.pathname === "/") setPack(null); };
    addEventListener("popstate", back);
    return () => removeEventListener("popstate", back);
  }, []);

  // SEO: title, description and canonical follow what is on screen.
  useEffect(() => {
    if (pack) {
      const lead = pack.qna?.[0]?.answer || pack.notes?.sections?.[0]?.points?.[0] || "";
      setSeo({
        title: `${cap(pack.topic)}: Notes, Flashcards & Quiz | My Buddy`,
        description: `Free notes, ${pack.flashcards?.length || 0} flashcards and ${pack.mcqs?.length || 0} quiz questions on ${pack.topic}. ${lead}`.slice(0, 158),
        path: pack.fromPage ? "/" : `/study/${slugify(pack.topic)}`,
      });
    } else setSeo({ title: HOME_TITLE, description: HOME_DESC, path: "/" });
  }, [pack?.topic, pack?.fromPage]); // eslint-disable-line

  // Keep a saved copy in the library up to date when "more" adds items.
  useEffect(() => {
    if (pack) setLibrary((lib) => (lib.some((p) => p.topic === pack.topic) ? lib.map((p) => (p.topic === pack.topic ? pack : p)) : lib));
  }, [pack]); // eslint-disable-line

  const level = Math.floor(stats.xp / 100) + 1;
  const saved = pack && library.some((p) => p.topic === pack.topic);

  function addXp(n, why) {
    setStats((s) => {
      const today = dayStr();
      const streak = s.last === today ? s.streak : s.last === dayStr(-1) ? s.streak + 1 : 1;
      return { xp: s.xp + n, streak, last: today };
    });
    setToast(`+${n} XP · ${why}`);
  }

  function clearPhoto() {
    setPreview(null); setPhoto(null); setTopics([]); setContext(""); setUseCtx(true); setStatus(""); setSource("text");
  }

  async function onPhoto(file) {
    if (!file || !file.type.startsWith("image/")) return;
    setError(""); setPack(null);
    try {
      setStatus("Preparing your photo…");
      const blob = await resizeImage(file);
      setPhoto(blob); setPreview(URL.createObjectURL(blob));
      setStatus("Reading the page… 0%");
      const { text, lines } = await readText(blob, (p) => setStatus(`Reading the page… ${p}%`));
      const info = analyzePage(text, lines);
      if (info.words >= 12 && info.topic) {
        setTopic(info.topic); setTopics(info.topics); setContext(info.context); setUseCtx(true); setSource("ocr");
        setStatus(`Read ${info.words} words from your page. Pick the right topic below, then press Make study pack.`);
      } else {
        setContext(""); setTopics([]);
        await identify(blob);
      }
    } catch (e) { setError(e.message); setStatus(""); }
  }

  async function identify(blob = photo) {
    if (!blob) return;
    setError(""); setStatus("Asking Google Lens what this is…");
    try {
      const { topic: t, candidates = [] } = await identifyImage(blob);
      if (!t) throw new Error("Couldn't recognise this photo. Type the topic yourself.");
      setTopic(t); setTopics(candidates); setContext(""); setSource("lens");
      setStatus("Found a topic! Check it, then press Make study pack.");
    } catch (e) { setError(e.message); setStatus(""); }
  }

  async function generate(t = topic, s = source, ctx = useCtx ? context : "") {
    if (t.trim().length < 2) return setError("Type or snap a topic first.");
    window.speechSynthesis?.cancel(); setSpeaking(false);
    setError(""); setPack(null); setLoading(true); setStatus("");
    try {
      const data = await studyTopic(t.trim(), s, ctx);
      const next = { ...data, context: ctx, rounds: {} };
      setPack(next); setTab("notes"); addXp(10, "new study pack");
      const target = data.fromPage ? "/" : `/study/${slugify(data.topic)}`;
      if (location.pathname !== target) history.pushState(null, "", target);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function loadMore(kind) {
    if (!pack || moreBusy) return;
    setMoreBusy(kind);
    try {
      const { items } = await moreStudy({
        topic: pack.topic, kind, round: pack.rounds?.[kind] || 0, context: pack.context || "", have: haveFor(kind, pack),
      });
      const n = countOf(kind, items);
      setPack((p) => mergeMore(p, kind, items));
      if (n) addXp(3, `${n} new ${LABELS[kind]}`);
      else setToast("Nothing new this time. Tap again to try another angle.");
    } catch (e) { setError(e.message); }
    setMoreBusy("");
  }

  const explore = (t) => { setTopic(t); setSource("text"); generate(t, "text", ""); };
  const openSaved = (p) => { setTopic(p.topic); setPack(p); setTab("notes"); setError(""); };
  const toggleSave = () =>
    setLibrary((lib) => (saved ? lib.filter((p) => p.topic !== pack.topic) : [pack, ...lib].slice(0, 20)));

  function toggleSpeak() {
    if (!("speechSynthesis" in window)) return setError("Read aloud isn't supported in this browser.");
    if (speaking) { speechSynthesis.cancel(); return setSpeaking(false); }
    const text = pack.notes.sections.filter((s) => s.heading !== "Go deeper").flatMap((s) => [s.heading, ...s.points]).join(". ");
    const u = new SpeechSynthesisUtterance(text);
    u.onend = () => setSpeaking(false);
    speechSynthesis.speak(u); setSpeaking(true);
  }
  async function copyNotes() {
    await navigator.clipboard.writeText(packToMarkdown(pack));
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  const mood = loading ? "think" : pack ? "happy" : "idle";
  const bubble = loading ? TIPS[Math.floor(Math.random() * TIPS.length)] : status || (pack ? "Nice! Pick a tab and let's study." : "Show me a page, a diagram, or just type a topic!");
  const Hero = pack ? "p" : "h1";

  return (
    <div className="app">
      <div className="bg" aria-hidden="true"><i /><i /><i /></div>

      <header className="top">
        <a className="logo" href="/" onClick={(e) => { e.preventDefault(); setPack(null); history.pushState(null, "", "/"); }}><span>📒</span> My Buddy</a>
        <div className="hud">
          <span className="chip-stat" title="Days in a row you studied">🔥 {stats.streak}</span>
          <span className="chip-stat level" title={`${stats.xp % 100}/100 XP to next level`}>
            ⭐ Lv {level}<i style={{ "--p": `${stats.xp % 100}%` }} />
          </span>
          <button className="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle dark mode">
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      <section className="hero" aria-label="Create a study pack">
        <div className="buddyrow">
          <Buddy mood={mood} />
          <p className="bubble" key={bubble}>{bubble}</p>
        </div>
        <Hero className="headline"><span className="sr">My Buddy: </span><span>Snap it.</span><span>Study it.</span><span>Ace it.</span></Hero>
        <p className="sub">Turn a photo of any textbook page into study notes, flashcards, practice questions and videos.</p>

        <div
          className={`drop ${drag ? "drag" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); onPhoto(e.dataTransfer.files[0]); }}
        >
          {preview ? (
            <div className="previewrow">
              <img src={preview} alt="Your photo" />
              <div className="previewbtns">
                <button className="ghost small" onClick={() => identify()}>It's a picture, not text: identify it</button>
                <button className="ghost small" onClick={clearPhoto}>Remove photo</button>
              </div>
            </div>
          ) : (
            <p className="drop-text">Drop a photo here</p>
          )}
          <div className="buttons">
            <button onClick={() => camRef.current.click()}>📷 Take a photo</button>
            <button className="ghost" onClick={() => fileRef.current.click()}>🖼️ Upload</button>
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e.target.files[0])} />
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files[0])} />
        </div>

        {topics.length > 0 && (
          <div className="detected">
            <p className="hint">Topics found on your page. Tap the one you want to study:</p>
            <div className="examples">
              {topics.map((t) => (
                <button key={t} className={`bubble-chip ${t === topic ? "picked" : ""}`} onClick={() => setTopic(t)}>{t}</button>
              ))}
            </div>
            {context && (
              <details className="ctx">
                <summary>Text I read from your photo ({context.split(/\s+/).length} words)</summary>
                <label className="usectx"><input type="checkbox" checked={useCtx} onChange={(e) => setUseCtx(e.target.checked)} /> Use this text to build notes, flashcards and questions</label>
                <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={7} aria-label="Text read from your photo (you can fix mistakes)" />
              </details>
            )}
          </div>
        )}

        <form className="topicrow" onSubmit={(e) => { e.preventDefault(); generate(); }}>
          <input aria-label="Topic" value={topic} onChange={(e) => { setTopic(e.target.value); if (!context) setSource("text"); }}
            placeholder="…or type a topic, like photosynthesis" />
          <button type="submit" disabled={loading}>{loading ? "Working…" : "Make study pack"}</button>
        </form>

        {!pack && !loading && !topics.length && (
          <div className="examples">
            {EXAMPLES.map((x) => <button key={x} className="bubble-chip" onClick={() => { setTopic(x); setSource("text"); generate(x, "text", ""); }}>{x}</button>)}
          </div>
        )}
        {status && !loading && <p className="status" role="status">{status}</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {loading && <section className="skeleton" aria-busy="true"><i /><i /><i /></section>}

      {!pack && !loading && library.length > 0 && (
        <section className="library" aria-labelledby="lib-h">
          <h2 id="lib-h">Your library</h2>
          <div className="lib-grid">
            {library.map((p, i) => (
              <button key={p.topic} className="lib-card" style={{ "--i": i }} onClick={() => openSaved(p)}>
                <strong>{p.topic}</strong>
                <span>{p.flashcards.length} cards · {p.mcqs.length} questions</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {pack && (
        <main className="results" ref={resultsRef}>
          <div className="results-head">
            <h1 className="topic">{pack.topic}</h1>
            <div className="actions">
              <button className={`ghost small ${saved ? "on" : ""}`} onClick={toggleSave}>{saved ? "★ Saved" : "☆ Save"}</button>
              <button className="ghost small" onClick={toggleSpeak}>{speaking ? "⏹ Stop" : "🔊 Read aloud"}</button>
              <button className="ghost small" onClick={copyNotes}>{copied ? "Copied!" : "Copy"}</button>
              <button className="ghost small" onClick={() => download(`${pack.topic.replace(/\W+/g, "-")}.md`, packToMarkdown(pack))}>⬇ Download</button>
            </div>
          </div>
          <nav role="tablist" aria-label="Study tools">
            {TABS.map(([id, icon, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
                <span>{icon}</span> {label}
              </button>
            ))}
          </nav>
          <div className="panel" key={tab}>
            {tab === "notes" && <Notes notes={pack.notes} onExplore={explore} onMore={loadMore} busy={moreBusy} />}
            {tab === "qna" && <QnA qna={pack.qna} onMore={loadMore} busy={moreBusy} />}
            {tab === "flash" && <Flashcards cards={pack.flashcards} onXp={addXp} onMore={loadMore} busy={moreBusy} />}
            {tab === "quiz" && <Quiz key={pack.topic} mcqs={pack.mcqs} onXp={addXp} onMore={loadMore} busy={moreBusy} />}
            {tab === "videos" && <Videos videos={pack.videos} onMore={loadMore} busy={moreBusy} />}
          </div>
        </main>
      )}

      {!pack && !loading && (
        <>
          <section className="how" aria-labelledby="how-h">
            <h2 id="how-h">How it works</h2>
            <div className="steps">
              {STEPS.map(([icon, title, text], i) => (
                <article key={title} style={{ "--i": i }}><span>{icon}</span><h3>{title}</h3><p>{text}</p></article>
              ))}
            </div>
          </section>
          <section className="faq qna" aria-labelledby="faq-h">
            <h2 id="faq-h">Frequently asked questions</h2>
            {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
          </section>
        </>
      )}

      <footer className="foot">
        <p>My Buddy helps you study faster. Always check important facts with your textbook or teacher.</p>
      </footer>

      <Pomodoro onDone={addXp} />
      {toast && <div className="toast" key={toast} role="status">{toast}</div>}
    </div>
  );
}
