import { useEffect, useRef } from "react";

export default function Confetti({ fire }) {
  const ref = useRef();
  useEffect(() => {
    if (!fire || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = ref.current, ctx = c.getContext("2d");
    c.width = innerWidth; c.height = innerHeight;
    const colors = ["#6c4dff", "#16d9a5", "#ffc83d", "#ff5c8a", "#38bdf8"];
    const bits = Array.from({ length: 150 }, () => ({
      x: c.width / 2, y: c.height * 0.4,
      vx: (Math.random() - 0.5) * 18, vy: -Math.random() * 15 - 4,
      s: 7 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      color: colors[(Math.random() * colors.length) | 0],
    }));
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      ctx.clearRect(0, 0, c.width, c.height);
      for (const p of bits) {
        p.vy += 0.36; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.color; ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.6);
        ctx.restore();
      }
      if (t - t0 < 2800) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, c.width, c.height);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fire]);
  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}
