import { useEffect, useRef, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";

/**
 * A thin progress bar pinned to the very top of the viewport that animates
 * whenever ANY React Query request is in flight — every fetch (loading lists,
 * live score polling on first load) and every mutation (create/delete/update).
 * This gives a single, consistent "something is happening" signal across the
 * whole app, on top of each button's own pending state.
 */
export default function TopProgressBar() {
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const active = fetching + mutating > 0;

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (active) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setVisible(true);
      setProgress((p) => (p < 10 ? 10 : p));
      // Creep toward (but never reach) 90% while work is ongoing.
      if (!timer.current) {
        timer.current = setInterval(() => {
          setProgress((p) => (p >= 90 ? 90 : p + Math.max(1, (90 - p) * 0.1)));
        }, 200);
      }
    } else {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
      // Snap to 100%, then fade out.
      setProgress(100);
      hideTimer.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 350);
    }
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [active]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5">
      <div
        className="h-full bg-pitch-500 shadow-[0_0_8px_rgba(22,163,74,0.7)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%`, opacity: progress === 100 ? 0 : 1 }}
      />
    </div>
  );
}
