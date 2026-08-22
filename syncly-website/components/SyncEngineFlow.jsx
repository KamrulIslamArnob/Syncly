"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { ChromeIcon } from "./Navbar";
import { IconSend, IconSync } from "./Icons";

export const STEPS = [
  {
    num: "01",
    icon: IconSend,
    title: "Save anywhere",
    subtitle: "Direct chrome.bookmarks invocation",
    body: "Capture from the popup, the new tab, or the nt omnibox. Every save lands in your real Chrome bookmarks — a folder like any other with zero proprietary format lock-in.",
    badge: "1-Click / Omnibox",
  },
  {
    num: "02",
    icon: (props) => <ChromeIcon size={18} {...props} />,
    title: "Chrome sync carries it",
    subtitle: "Native Chrome Account transport",
    body: "Workspace folders (w-Agency, w-Personal, w-Research) ride native bookmark sync. A quota-optimized JSON mirror rides chrome.storage.sync. No server of ours sits in between.",
    badge: "Zero Backend",
  },
  {
    num: "03",
    icon: IconSync,
    title: "Every device catches up",
    subtitle: "Background service worker reconciliation",
    body: "A lightweight Manifest V3 background service worker merges what arrives — live while you work, or silently reconciling cross-device deltas within milliseconds when your browser wakes.",
    badge: "Delta Merge",
  },
];

export default function SyncEngineFlow({ className = "" }) {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.2 });
  const [activeStep, setActiveStep] = useState(1);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Step cycling preview
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev % 3) + 1);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className={`section sync-engine-section ${className}`} id="how-sync-works">
      {/* Anchor alias support */}
      <span id="sync-engine" style={{ position: "absolute", top: -80, visibility: "hidden" }} aria-hidden="true" />
      <span id="how-it-works" style={{ position: "absolute", top: -80, visibility: "hidden" }} aria-hidden="true" />

      <div className="container" ref={containerRef}>
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
            <span>The Mechanism</span>
          </div>
          <h2 className="h2">
            Sync <strong>without</strong> a middleman.
          </h2>
          <p className="lede">
            Most bookmark managers copy your data onto their servers. Syncly never touches it — Chrome already solved multi-device sync with end-to-end encryption. We build the high-speed organization layer directly on top.
          </p>
        </motion.div>

        {/* 3-Step Interactive Pipeline Cards */}
        <div className="steps" style={{ marginTop: 52 }}>
          {STEPS.map((s, i) => {
            const isHighlighted = activeStep === i + 1;
            const IconComp = s.icon;
            return (
              <motion.div
                key={s.num}
                className={`step ${isHighlighted ? "step-active" : ""}`}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -4 }}
                onClick={() => setActiveStep(i + 1)}
                style={{
                  cursor: "pointer",
                  position: "relative",
                  background: isHighlighted ? "var(--surface)" : "var(--surface)",
                  borderColor: isHighlighted ? "var(--border-accent)" : "var(--border)",
                  boxShadow: isHighlighted ? "0 12px 36px rgba(124, 58, 237, 0.16)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                  <div
                    className="step-icon"
                    aria-hidden="true"
                    style={{
                      background: isHighlighted ? "var(--accent)" : "var(--surface-2)",
                      color: isHighlighted ? "#fff" : "var(--accent)",
                      transition: "all 200ms var(--ease)",
                    }}
                  >
                    <IconComp />
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      padding: "3px 9px",
                      borderRadius: "var(--radius-pill)",
                      background: isHighlighted ? "var(--accent-soft)" : "var(--surface-2)",
                      border: `1px solid ${isHighlighted ? "var(--border-accent)" : "var(--border)"}`,
                      color: isHighlighted ? "var(--accent)" : "var(--fg-3)",
                      fontWeight: 600,
                    }}
                  >
                    {s.badge}
                  </span>
                </div>

                <span className="step-num" style={{ color: isHighlighted ? "var(--accent)" : "var(--fg-3)" }}>
                  {s.num}
                </span>
                <h3 style={{ marginTop: 8, fontSize: 19, color: "var(--fg)", fontWeight: 600 }}>{s.title}</h3>
                <p style={{ marginTop: 8, fontSize: 14.5, color: "var(--fg-2)", lineHeight: 1.6 }}>{s.body}</p>

                {/* Bottom accent indicator line */}
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
                  animate={{ scaleX: isHighlighted ? 1 : 0 }}
                  transition={{ duration: 0.4 }}
                />
              </motion.div>
            );
          })}
        </div>

        {/* Animated Zero-Server Cross-Device Visualizer in Double-Bezel Outer Shell */}
        <motion.div
          className="double-bezel-outer"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.8 }}
          style={{ marginTop: 52 }}
        >
          <div
            className="double-bezel-inner"
            style={{
              padding: "36px 28px",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11.5,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--accent)",
                  background: "var(--accent-soft)",
                  padding: "5px 16px",
                  borderRadius: "var(--radius-pill)",
                  border: "1px solid var(--border-accent)",
                  fontWeight: 600,
                }}
              >
                Zero-Server Sync Pipeline · Live Simulation
              </span>
            </div>

            {/* SVG Pipeline Canvas */}
            <div style={{ position: "relative", maxWidth: 960, margin: "0 auto" }}>
              <svg
                viewBox="0 0 800 160"
                style={{ width: "100%", height: "auto", overflow: "visible" }}
                aria-label="Animated SVG data-packet pulses showing zero-server synchronization between devices"
              >
                <defs>
                  {/* Glow Filter */}
                  <filter id="packet-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  {/* Purple Gradient Stroke */}
                  <linearGradient id="sync-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.9" />
                    <stop offset="50%" stopColor="#A78BFA" stopOpacity="1" />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.9" />
                  </linearGradient>
                </defs>

                {/* Background Connection Path */}
                <path
                  d="M 160 80 C 280 80, 280 80, 400 80 C 520 80, 520 80, 640 80"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />

                <path
                  d="M 160 80 C 280 40, 280 40, 400 80 C 520 120, 520 120, 640 80"
                  fill="none"
                  stroke="url(#sync-gradient)"
                  strokeWidth="2.5"
                  strokeOpacity="0.85"
                />

                {/* Device 1: Node A (Laptop / Workstation) */}
                <g transform="translate(60, 30)">
                  <rect width="110" height="96" rx="12" fill="var(--surface-2)" stroke="var(--border)" strokeWidth="1.5" />
                  <rect x="10" y="10" width="90" height="50" rx="6" fill="var(--bg)" stroke="var(--border)" />
                  <circle cx="20" cy="20" r="3" fill="#7C3AED" />
                  <text x="30" y="23" fill="var(--fg-2)" fontSize="8" fontFamily="var(--font-mono)">w-Agency</text>
                  <text x="20" y="44" fill="var(--fg)" fontSize="7.5" fontFamily="var(--font-mono)">+1 bookmark</text>
                  <rect x="35" y="70" width="40" height="6" rx="2" fill="var(--border)" />
                  <text x="55" y="90" fill="var(--fg-3)" fontSize="8" textAnchor="middle" fontFamily="var(--font-mono)">Device A (MacBook)</text>
                </g>

                {/* Center Hub: Google Chrome Account Sync (Serverless Transport) */}
                <g transform="translate(340, 20)">
                  <rect width="120" height="116" rx="16" fill="var(--surface-2)" stroke="var(--border-accent)" strokeWidth="1.5" />
                  <circle cx="60" cy="42" r="18" fill="var(--bg)" stroke="#7C3AED" strokeWidth="1.5" />
                  <text x="60" y="46" fill="#7C3AED" fontSize="14" textAnchor="middle">☁</text>
                  <text x="60" y="74" fill="var(--fg)" fontSize="9" fontWeight="600" textAnchor="middle">Chrome Sync</text>
                  <text x="60" y="88" fill="var(--fg-2)" fontSize="7.5" textAnchor="middle" fontFamily="var(--font-mono)">chrome.storage.sync</text>
                  <text x="60" y="100" fill="#7C3AED" fontSize="7" fontWeight="600" textAnchor="middle" fontFamily="var(--font-mono)">0 Syncly Servers</text>
                </g>

                {/* Device 2: Node B (Desktop / Target) */}
                <g transform="translate(630, 30)">
                  <rect width="110" height="96" rx="12" fill="var(--surface-2)" stroke="var(--border)" strokeWidth="1.5" />
                  <rect x="10" y="10" width="90" height="50" rx="6" fill="var(--bg)" stroke="var(--border)" />
                  <circle cx="20" cy="20" r="3" fill="#7C3AED" />
                  <text x="30" y="23" fill="var(--fg-2)" fontSize="8" fontFamily="var(--font-mono)">w-Agency</text>
                  <text x="20" y="44" fill="#7C3AED" fontSize="7.5" fontWeight="600" fontFamily="var(--font-mono)">✓ Merged in 12ms</text>
                  <rect x="35" y="70" width="40" height="6" rx="2" fill="var(--border)" />
                  <text x="55" y="90" fill="var(--fg-3)" fontSize="8" textAnchor="middle" fontFamily="var(--font-mono)">Device B (Desktop)</text>
                </g>

                {/* Animated Traveling Data Packet Pulses */}
                {!prefersReducedMotion && (
                  <>
                    <circle r="5" fill="#7C3AED" filter="url(#packet-glow)">
                      <animateMotion
                        path="M 160 80 C 280 40, 280 40, 400 80 C 520 120, 520 120, 640 80"
                        dur="3.2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle r="4" fill="#A78BFA" filter="url(#packet-glow)">
                      <animateMotion
                        path="M 160 80 C 280 40, 280 40, 400 80 C 520 120, 520 120, 640 80"
                        dur="3.2s"
                        begin="1.6s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </>
                )}
              </svg>
            </div>

            <div
              style={{
                marginTop: 24,
                padding: "14px 20px",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-inner)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--fg-2)",
              }}
            >
              <span>
                <strong style={{ color: "var(--fg)" }}>Transport Protocol:</strong> Google Chrome Sync (`chrome.bookmarks` & `chrome.storage.sync`)
              </span>
              <span style={{ color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
                End-to-End Encrypted by Google Account
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
