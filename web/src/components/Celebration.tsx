import { useEffect, useState } from "react";

/**
 * A lightweight, dependency-free confetti burst — shown once when a completed
 * match is opened (like the little celebration search engines show when a team
 * wins). Pure CSS animation; auto-clears after a few seconds so it doesn't sit
 * on screen. Respects prefers-reduced-motion.
 */
const COLORS = ["#16a34a", "#f59e0b", "#3b82f6", "#ef4444", "#a855f7", "#10b981"];

export default function Celebration({ run }: { run: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!run) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    setShow(true);
    const t = setTimeout(() => setShow(false), 4500);
    return () => clearTimeout(t);
  }, [run]);

  if (!show) return null;

  // 80 pieces fanning out from the top with randomised offsets via index math
  // (no Math.random — keeps it deterministic and SSR-safe).
  const pieces = Array.from({ length: 80 }, (_, i) => {
    const left = (i * 37) % 100; // pseudo-spread across the width
    const delay = (i % 10) * 0.12;
    const duration = 2.6 + ((i % 5) * 0.4);
    const color = COLORS[i % COLORS.length];
    const size = 6 + (i % 4) * 2;
    const rotate = (i * 47) % 360;
    return (
      <span
        key={i}
        style={{
          position: "absolute",
          top: "-5%",
          left: `${left}%`,
          width: size,
          height: size * 1.6,
          background: color,
          transform: `rotate(${rotate}deg)`,
          borderRadius: 1,
          animation: `confetti-fall ${duration}s ${delay}s ease-in forwards`,
        }}
      />
    );
  });

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces}
    </div>
  );
}
