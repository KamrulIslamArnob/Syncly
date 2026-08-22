"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Count-up numeral for the performance strip. Animates once when 30% visible;
 * renders the final value immediately under reduced motion.
 */
export default function CountUp({ to, decimals = 0, duration = 600, suffix = "" }) {
  const ref = useRef(null);
  const [display, setDisplay] = useState(to);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(to);
      return;
    }

    setDisplay(0);
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || started.current) continue;
          started.current = true;
          io.disconnect();
          const t0 = performance.now();
          const tick = (now) => {
            const p = Math.min((now - t0) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplay(to * eased);
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref}>
      {display.toFixed(decimals)}
      {suffix && <span className="perf-unit">{suffix}</span>}
    </span>
  );
}
