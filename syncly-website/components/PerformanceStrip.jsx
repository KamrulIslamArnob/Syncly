"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

/**
 * Animated Counter Component
 * Interpolates numbers smoothly from 0 to target value using requestAnimationFrame.
 * Immediately displays final value if prefers-reduced-motion is active.
 */
export function Counter({ to, decimals = 0, suffix = "", prefix = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVal(to);
      return;
    }

    let raf;
    let start;
    const dur = 1400;
    const tick = (now) => {
      if (!start) start = now;
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      setVal(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);

  return (
    <span ref={ref} style={{ fontVariantNumeric: "tabular-nums" }}>
      {prefix}
      {val.toFixed(decimals)}
      {suffix && <span className="perf-unit" style={{ fontSize: "0.52em", marginLeft: 2, color: "var(--accent)" }}>{suffix}</span>}
    </span>
  );
}

export const METRICS = [
  {
    n: 12,
    suffix: "ms",
    label: "12ms First paint, cold open",
    sub: "500 bookmarks indexed instantly",
  },
  {
    n: 28,
    suffix: "ms",
    label: "28ms Full dashboard load",
    sub: "Complete tag & search index build",
  },
  {
    n: 4.5,
    suffix: "MB",
    label: "4.5 MB Memory per tab",
    decimals: 1,
    prefix: "≈",
    sub: "Isolated lightweight JS heap",
  },
  {
    n: 0,
    suffix: "",
    label: "0 Trackers & External Servers",
    prefix: "",
    sub: "Strict local-first privacy",
  },
];

export default function PerformanceStrip({ className = "" }) {
  return (
    <section className={`section perf ${className}`} id="performance">
      {/* Anchor alias */}
      <span id="benchmarks" style={{ position: "absolute", top: -80, visibility: "hidden" }} aria-hidden="true" />

      <div className="container">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--accent)",
              marginBottom: 16,
              fontWeight: 600,
            }}
          >
            <span>Measured, Not Marketed</span>
          </div>
          <h2 className="h2">
            Fast is a <strong>requirement</strong>, not a claim.
          </h2>
        </motion.div>

        {/* 4-Item Performance Metric Grid in Concentric Double-Bezel Cards */}
        <div className="perf-grid" style={{ marginTop: 52 }}>
          {METRICS.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="double-bezel-outer"
            >
              <div
                className="double-bezel-inner"
                style={{
                  padding: "28px 24px",
                }}
              >
                <div
                  className="perf-num"
                  style={{
                    fontSize: "clamp(38px, 4.5vw, 56px)",
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    color: "var(--fg)",
                    letterSpacing: "-0.04em",
                    lineHeight: 1,
                    display: "flex",
                    alignItems: "baseline",
                  }}
                >
                  <Counter
                    to={m.n}
                    decimals={m.decimals || 0}
                    suffix={m.suffix}
                    prefix={m.prefix || ""}
                  />
                </div>

                <p
                  className="perf-label"
                  style={{
                    marginTop: 14,
                    fontSize: 14.5,
                    fontWeight: 600,
                    color: "var(--fg)",
                  }}
                >
                  {m.label}
                </p>

                <p
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                    color: "var(--fg-3)",
                  }}
                >
                  {m.sub}
                </p>

                {/* Bottom decorative bar */}
                <motion.div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 2.5,
                    background: "var(--accent)",
                    originX: 0,
                  }}
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + i * 0.1, duration: 0.6 }}
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Reproducibility Footnote */}
        <motion.p
          className="perf-caption"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          style={{
            marginTop: 36,
            fontSize: 12.5,
            fontFamily: "var(--font-mono)",
            color: "var(--fg-3)",
            textAlign: "center",
          }}
        >
          Internal benchmark harness · mid-range laptop · numbers reproducible via our open-source repo.
        </motion.p>
      </div>
    </section>
  );
}
