import { useEffect, useRef, useState } from "react";
import { studyTopic, identifyImage } from "./api.js";
import { resizeImage, readText, guessTopic } from "./image.js";
import { useLocal, dayStr } from "./lib/store.js";
import { packToMarkdown, download } from "./lib/export.js";
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

export default function App() {
  const [theme, setTheme] = useLocal("mb-theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const [stats, setStats] = useLocal("mb-stats", { xp: 0, streak: 0, last: null });
  const [library, setLibrary] = useLocal("mb-library", []);
  const [topic, setTopic] = useState("");
  const [source, setSource] = useState("text");
  const [preview, setPreview] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pack, setPack] = useState(null);
  const [tab, setTab] = useState("notes");
  const [drag, setDrag] = useState(false);
  const [toast, setToast] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef(), camRef = useRef(), resultsRef = useRef();

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 1800); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (pack) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [pack]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

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

  async function onPhoto(file) {
    if (!file || !file.type.startsWith("image/")) return;
    setError(""); setPack(null);
    try {
      setStatus("Preparing your photo…");
      const blob = await resizeImage(file);
      setPhoto(blob); setPreview(URL.createObjectURL(blob));
      setStatus("Reading the page… 0%");
      const text = await readText(blob, (p) => setStatus(`Reading the page… ${p}%`));
      const guess = guessTopic(text);
      if (text.trim().length > 25 && guess) {
        setTopic(guess); setSource("ocr");
        setStatus("Found a topic! Check it, then press Make study pack.");
      } else await identify(blob);
    } catch (e) { setError(e.message); setStatus(""); }
  }

  async function identify(blob = photo) {
    if (!blob) return;
    setError(""); setStatus("Asking Google Lens what this is…");
    try {
      const { topic: t } = await identifyImage(blob);
      if (!t) throw new Error("Couldn't recognise this photo. Type the topic yourself.");
      setTopic(t); setSource("lens");
      setStatus("Found a topic! Check it, then press Make study pack.");
    } catch (e) { setError(e.message); setStatus(""); }
  }

  async function generate(t = topic, s = source) {
    if (t.trim().length < 2) return setError("Type or snap a topic first.");
    window.speechSynthesis?.cancel(); setSpeaking(false);
    setError(""); setPack(null); setLoading(true); setStatus("");
    try {
      const data = await studyTopic(t.trim(), s);
      setPack(data); setTab("notes"); addXp(10, "new study pack");
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  const explore = (t) => { setTopic(t); setSource("text"); generate(t, "text"); };
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

  return (
    <div className="app">
      <div className="bg" aria-hidden="true"><i /><i /><i /></div>

      <header className="top">
        <div className="logo"><span>📒</span> My Buddy</div>
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

      <section className="hero">
        <div className="buddyrow">
          <Buddy mood={mood} />
          <p className="bubble" key={bubble}>{bubble}</p>
        </div>
        <h1 className="headline"><span>Snap it.</span><span>Study it.</span><span>Ace it.</span></h1>
        <p className="sub">Turn any page or diagram into notes, flashcards, a quiz and videos.</p>

        <div
          className={`drop ${drag ? "drag" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); onPhoto(e.dataTransfer.files[0]); }}
        >
          {preview ? (
            <div className="previewrow">
              <img src={preview} alt="Your photo" />
              <button className="ghost" onClick={() => identify()}>It's a picture, not text: identify it</button>
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

        <form className="topicrow" onSubmit={(e) => { e.preventDefault(); generate(); }}>
          <input aria-label="Topic" value={topic} onChange={(e) => { setTopic(e.target.value); setSource("text"); }}
            placeholder="…or type a topic, like photosynthesis" />
          <button type="submit" disabled={loading}>{loading ? "Working…" : "Make study pack"}</button>
        </form>

        {!pack && !loading && (
          <div className="examples">
            {EXAMPLES.map((x) => <button key={x} className="bubble-chip" onClick={() => { setTopic(x); setSource("text"); generate(x, "text"); }}>{x}</button>)}
          </div>
        )}
        {status && !loading && <p className="status" role="status">{status}</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {loading && (
        <section className="skeleton" aria-busy="true">
          <i /><i /><i />
        </section>
      )}

      {!pack && !loading && library.length > 0 && (
        <section className="library">
          <h2>Your library</h2>
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
            <h2 className="topic">{pack.topic}</h2>
            <div className="actions">
              <button className={`ghost small ${saved ? "on" : ""}`} onClick={toggleSave}>{saved ? "★ Saved" : "☆ Save"}</button>
              <button className="ghost small" onClick={toggleSpeak}>{speaking ? "⏹ Stop" : "🔊 Read aloud"}</button>
              <button className="ghost small" onClick={copyNotes}>{copied ? "Copied!" : "Copy"}</button>
              <button className="ghost small" onClick={() => download(`${pack.topic.replace(/\W+/g, "-")}.md`, packToMarkdown(pack))}>⬇ Download</button>
            </div>
          </div>
          <nav role="tablist">
            {TABS.map(([id, icon, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
                <span>{icon}</span> {label}
              </button>
            ))}
          </nav>
          <div className="panel" key={tab}>
            {tab === "notes" && <Notes notes={pack.notes} onExplore={explore} />}
            {tab === "qna" && <QnA qna={pack.qna} />}
            {tab === "flash" && <Flashcards cards={pack.flashcards} onXp={addXp} />}
            {tab === "quiz" && <Quiz key={pack.topic} mcqs={pack.mcqs} onXp={addXp} />}
            {tab === "videos" && <Videos videos={pack.videos} />}
          </div>
        </main>
      )}

      <Pomodoro onDone={addXp} />
      {toast && <div className="toast" key={toast} role="status">{toast}</div>}
    </div>
  );
}
