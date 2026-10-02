import { useEffect, useState } from "react";

const FOCUS = 25 * 60, BREAK = 5 * 60, C = 2 * Math.PI * 44;
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// Floating focus timer: 25 min focus, 5 min break. Finishing a focus session earns XP.
export default function Pomodoro({ onDone }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("focus");
  const [left, setLeft] = useState(FOCUS);
  const [run, setRun] = useState(false);
  const total = mode === "focus" ? FOCUS : BREAK;

  useEffect(() => {
    if (!run) return;
    const id = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(id);
  }, [run]);

  useEffect(() => {
    if (left > 0) return;
    setRun(false);
    if (mode === "focus") { onDone(25, "focus session"); setMode("break"); setLeft(BREAK); }
    else { setMode("focus"); setLeft(FOCUS); }
  }, [left]); // eslint-disable-line

  const reset = () => { setRun(false); setLeft(total); };

  if (!open)
    return (
      <button className={`pomo-pill ${run ? "running" : ""}`} onClick={() => setOpen(true)} aria-label="Open focus timer">
        ⏱ {run ? fmt(left) : "Focus"}
      </button>
    );

  return (
    <div className="pomo" role="dialog" aria-label="Focus timer">
      <button className="x" onClick={() => setOpen(false)} aria-label="Close timer">×</button>
      <p className="pomo-mode">{mode === "focus" ? "Focus time" : "Break time"}</p>
      <div className="ring">
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" className="track" />
          <circle cx="50" cy="50" r="44" className={`bar ${mode}`} strokeDasharray={C} strokeDashoffset={C * (1 - left / total)} />
        </svg>
        <span>{fmt(left)}</span>
      </div>
      <div className="pomo-actions">
        <button onClick={() => setRun(!run)}>{run ? "Pause" : "Start"}</button>
        <button className="ghost" onClick={reset}>Reset</button>
      </div>
    </div>
  );
}
