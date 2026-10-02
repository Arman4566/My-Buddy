// The My Buddy mascot. Blinks and bobs; mouth changes with mood.
export default function Buddy({ mood = "idle" }) {
  const mouth = {
    idle: "M48 78 Q60 88 72 78",
    think: "M55 80 Q60 76 65 80 Q60 86 55 80",
    happy: "M44 74 Q60 96 76 74 Q60 82 44 74",
  }[mood];
  return (
    <svg viewBox="0 0 120 124" className={`buddy ${mood}`} aria-hidden="true">
      <ellipse className="buddy-shadow" cx="60" cy="118" rx="28" ry="5" />
      <g className="buddy-body">
        <rect x="20" y="28" width="80" height="80" rx="32" fill="var(--grape)" stroke="var(--edge)" strokeWidth="3.5" />
        <rect x="30" y="36" width="26" height="10" rx="5" fill="#fff" opacity=".28" />
        <g className="buddy-eyes">
          <ellipse cx="45" cy="62" rx="9" ry="11" fill="#fff" />
          <ellipse cx="75" cy="62" rx="9" ry="11" fill="#fff" />
          <circle className="pupil" cx="47" cy="64" r="5" fill="#1a1240" />
          <circle className="pupil" cx="77" cy="64" r="5" fill="#1a1240" />
        </g>
        <circle cx="33" cy="80" r="6" fill="var(--pink)" opacity=".7" />
        <circle cx="87" cy="80" r="6" fill="var(--pink)" opacity=".7" />
        <path d={mouth} fill={mood === "happy" ? "#1a1240" : "none"} stroke="#1a1240" strokeWidth="3.5" strokeLinecap="round" />
        <polygon points="60,6 100,22 60,38 20,22" fill="#1a1240" />
        <path d="M92 25 L92 42" stroke="var(--sun)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="92" cy="44" r="4" fill="var(--sun)" />
      </g>
    </svg>
  );
}
