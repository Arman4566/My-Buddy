import { useEffect, useRef, useState } from "react";
import Confetti from "./Confetti.jsx";

export function More({ kind, label, onMore, busy }) {
  return (
    <button className="more" onClick={() => onMore(kind)} disabled={busy === kind}>
      {busy === kind ? "Finding more…" : `＋ More ${label}`}
    </button>
  );
}

export function Notes({ notes, onExplore, onMore, busy }) {
  return (
    <article className="notes">
      <h2>{notes.title}</h2>
      {notes.sections.map((s) =>
        s.heading === "Go deeper" ? (
          <section key={s.heading}>
            <h3>Go deeper</h3>
            <div className="explore">
              {s.points.map((p) => (
                <button key={p} className="bubble-chip" onClick={() => onExplore(p)}>{p}</button>
              ))}
            </div>
          </section>
        ) : (
          <section key={s.heading}>
            <h3>{s.heading}</h3>
            <ul>{s.points.map((p, i) => <li key={i} style={{ "--i": i }}>{p}</li>)}</ul>
          </section>
        )
      )}
      <More kind="notes" label="notes" onMore={onMore} busy={busy} />
      {notes.sources.length > 0 && (
        <p className="sources">
          Sources:{" "}
          {notes.sources.map((s, i) => (
            <span key={s.link}>
              <a href={s.link} target="_blank" rel="noreferrer">{s.title}</a>
              {i < notes.sources.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      )}
    </article>
  );
}

export function QnA({ qna, onMore, busy }) {
  if (!qna.length) return <p className="empty">No questions found for this topic. Try a broader topic.</p>;
  return (
    <div className="qna">
      <p className="hint">Try answering out loud first, then tap to check.</p>
      {qna.map((q, i) => (
        <details key={i} style={{ "--i": i }}>
          <summary>{q.question}</summary>
          <p>{q.answer}</p>
        </details>
      ))}
      <More kind="qna" label="Q&A" onMore={onMore} busy={busy} />
    </div>
  );
}

export function Flashcards({ cards, onXp, onMore, busy }) {
  const [queue, setQueue] = useState(cards);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);

  const prev = useRef(cards);
  useEffect(() => {
    const old = prev.current;
    if (cards !== old && cards.length > old.length && cards[0] === old[0]) {
      setQueue((q) => [...q, ...cards.slice(old.length)]); // new cards join the deck, progress is kept
    } else if (cards !== old) {
      setQueue(cards); setKnown(0); setFlipped(false);
    }
    prev.current = cards;
  }, [cards]);

  const gotIt = () => { setQueue((q) => q.slice(1)); setKnown((k) => k + 1); setFlipped(false); onXp(2, "flashcard"); };
  const again = () => { setQueue((q) => [...q.slice(1), q[0]]); setFlipped(false); };
  const shuffle = () => { setQueue((q) => [...q].sort(() => Math.random() - 0.5)); setFlipped(false); };
  const restart = () => { setQueue(cards); setKnown(0); setFlipped(false); };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || !queue.length) return;
      if (e.key === " " && e.target.tagName !== "BUTTON") { e.preventDefault(); setFlipped((f) => !f); }
      if (e.key === "ArrowLeft") again();
      if (e.key === "ArrowRight") gotIt();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // re-bind each render so handlers see fresh state

  if (!cards.length) return <p className="empty">No flashcards could be made from this topic.</p>;

  if (!queue.length)
    return (
      <div className="done">
        <Confetti fire />
        <div className="big">🎉</div>
        <h3>Deck complete!</h3>
        <p>You knew all {cards.length} cards.</p>
        <div className="row">
          <button onClick={restart}>Study again</button>
          <More kind="flashcards" label="flashcards" onMore={onMore} busy={busy} />
        </div>
      </div>
    );

  const card = queue[0];
  return (
    <div className="flash">
      <div className="meter" aria-label={`${known} of ${cards.length} learned`}>
        <i style={{ width: `${(known / cards.length) * 100}%` }} />
      </div>
      <p className="hint">{known} learned · {queue.length} to go · tap the card to flip</p>
      <div
        className={`flip ${flipped ? "is-flipped" : ""}`}
        role="button" tabIndex={0} aria-label="Flip card"
        onClick={() => setFlipped(!flipped)}
      >
        <div className="face front"><span>Question</span><p>{card.front}</p></div>
        <div className="face back"><span>Answer</span><p>{card.back}</p></div>
      </div>
      <div className="row">
        <button className="ghost" onClick={again}>Still learning</button>
        <button className="good" onClick={gotIt}>Got it</button>
        <button className="ghost small" onClick={shuffle}>Shuffle</button>
      </div>
      <p className="hint keys">Keys: Space flips · ← still learning · → got it</p>
      <More kind="flashcards" label="flashcards" onMore={onMore} busy={busy} />
    </div>
  );
}

export function Quiz({ mcqs, onXp, onMore, busy }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [missed, setMissed] = useState([]);
  const [done, setDone] = useState(false);

  // New questions added from the score screen continue the quiz.
  useEffect(() => {
    if (done && mcqs.length > i + 1) { setDone(false); setI(i + 1); setPicked(null); }
  }, [mcqs.length]); // eslint-disable-line

  if (!mcqs.length) return <p className="empty">Not enough material for a quiz yet. Try a more specific topic.</p>;

  const reset = () => { setI(0); setPicked(null); setScore(0); setStreak(0); setMissed([]); setDone(false); };

  if (done) {
    const pct = score / mcqs.length;
    const msg = pct === 1 ? "Perfect score! Legend." : pct >= 0.6 ? "Great work!" : "Good start. Review and try again.";
    return (
      <div className="done">
        <Confetti fire={pct >= 0.6} />
        <div className="big">{pct >= 0.6 ? "🏆" : "💪"}</div>
        <h3>{score} / {mcqs.length}</h3>
        <p>{msg}</p>
        {missed.length > 0 && (
          <div className="missed">
            <h4>Worth another look</h4>
            {missed.map((m, k) => (
              <p key={k}><b>{m.question}</b><br />Answer: {m.options[m.answerIndex]}</p>
            ))}
          </div>
        )}
        <div className="row">
          <button onClick={reset}>Retake quiz</button>
          <More kind="mcqs" label="questions" onMore={onMore} busy={busy} />
        </div>
      </div>
    );
  }

  const q = mcqs[i];
  const choose = (idx) => {
    if (picked !== null) return;
    setPicked(idx);
    if (idx === q.answerIndex) { setScore((s) => s + 1); setStreak((s) => s + 1); onXp(5, "correct answer"); }
    else { setStreak(0); setMissed((m) => [...m, q]); }
  };
  const next = () => {
    if (i + 1 === mcqs.length) return setDone(true);
    setI(i + 1); setPicked(null);
  };

  return (
    <div className="quiz">
      <div className="meter"><i style={{ width: `${((i + (picked !== null ? 1 : 0)) / mcqs.length) * 100}%` }} /></div>
      <div className="quiz-top">
        <span className="hint">Question {i + 1} of {mcqs.length}</span>
        {streak >= 2 && <span className="streak">🔥 {streak} in a row</span>}
      </div>
      <h3 key={i} className="q">{q.question}</h3>
      <div className="options">
        {q.options.map((o, idx) => {
          const state = picked === null ? "" : idx === q.answerIndex ? "right" : idx === picked ? "wrong" : "dim";
          return (
            <button key={`${i}-${idx}`} className={`option ${state}`} style={{ "--i": idx }} onClick={() => choose(idx)}>
              <b>{"ABCD"[idx]}</b>{o}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="after">
          <span className={picked === q.answerIndex ? "ok" : "no"}>
            {picked === q.answerIndex ? "Correct! +5 XP" : "Not quite. The right answer is highlighted."}
          </span>
          <button onClick={next}>{i + 1 === mcqs.length ? "See score" : "Next question"}</button>
        </div>
      )}
    </div>
  );
}

export function Videos({ videos, onMore, busy }) {
  if (!videos.length) return <p className="empty">No videos found. Try different words.</p>;
  return (
    <>
    <div className="videos">
      {videos.map((v, i) => (
        <a key={v.link} href={v.link} target="_blank" rel="noreferrer" className="video" style={{ "--i": i }}>
          <div className="thumb">
            {v.thumbnail && <img src={v.thumbnail} alt="" loading="lazy" />}
            <span className="play">▶</span>
            {v.length && <em>{v.length}</em>}
          </div>
          <div className="meta">
            <strong>{v.title}</strong>
            <span>{[v.channel, v.views ? `${Number(v.views).toLocaleString()} views` : null].filter(Boolean).join(" · ")}</span>
          </div>
        </a>
      ))}
    </div>
    <More kind="videos" label="videos" onMore={onMore} busy={busy} />
    </>
  );
}
