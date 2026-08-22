"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ChromeIcon } from "./Navbar";
import HeroTabDemo from "./HeroTabDemo";

export const STORE_URL = "https://chromewebstore.google.com/";
export const GITHUB_URL = "https://github.com/KamrulIslamArnob/Syncly";

// Magnetic hover physics wrapper
function Magnetic({ children }) {
  const ref = useRef(null);
  const handle = (e) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = (e.clientX - r.left - r.width / 2) * 0.18;
    const y = (e.clientY - r.top - r.height / 2) * 0.24;
    ref.current.style.transform = `translate(${x}px, ${y}px)`;
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = "translate(0,0)";
  };
  return (
    <span ref={ref} className="magnetic" onMouseMove={handle} onMouseLeave={reset}>
      {children}
    </span>
  );
}

export default function Hero({
  storeUrl = STORE_URL,
  githubUrl = GITHUB_URL,
  className = "",
}) {
  const heroRef = useRef(null);
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const heroY = useTransform(heroProgress, [0, 1], [0, 90]);
  const heroOpacity = useTransform(heroProgress, [0, 0.8], [1, 0]);
  const heroScale = useTransform(heroProgress, [0, 1], [1, 0.97]);

  return (
    <motion.section
      ref={heroRef}
      className={`hero syncly-hero-section ${className}`}
      style={{ opacity: heroOpacity, scale: heroScale }}
    >
      <div className="hero-bg" aria-hidden="true" />
      <div className="hero-orb" aria-hidden="true" />
      <div
        className="hero-orb"
        style={{
          width: 560,
          height: 560,
          top: "40%",
          left: "-15%",
          background: "radial-gradient(circle, var(--aura-orb-2) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="hero-inner container">
        {/* Left Column: Headlines & High-Conversion CTAs */}
        <div className="hero-content">
          {/* Eyebrow Live Badge */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 14px",
                background: "var(--accent-soft)",
                border: "1px solid var(--border-accent)",
                borderRadius: "var(--radius-pill)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--accent)",
                marginBottom: 24,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  boxShadow: "0 0 8px var(--accent-glow)",
                }}
                aria-hidden="true"
              />
              <span>Local-First Bookmark OS · Chrome Extension · MIT</span>
            </div>
          </motion.div>

          {/* Primary H1 Headline with Editorial Weight Contrast */}
          <h1 className="hero-h1">
            <motion.span style={{ display: "block", overflow: "hidden" }}>
              <motion.span
                style={{ display: "block" }}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ delay: 0.25, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
              >
                Your bookmarks,
              </motion.span>
            </motion.span>
            <motion.span style={{ display: "block", overflow: "hidden" }}>
              <motion.span
                style={{ display: "block" }}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ delay: 0.35, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
              >
                <strong>everywhere.</strong>
              </motion.span>
            </motion.span>
            <motion.span style={{ display: "block", overflow: "hidden" }}>
              <motion.span
                style={{ display: "block" }}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ delay: 0.45, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
              >
                <em>Your data,</em>
              </motion.span>
            </motion.span>
            <motion.span style={{ display: "block", overflow: "hidden" }}>
              <motion.span
                style={{ display: "block" }}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ delay: 0.55, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
              >
                <em>nowhere.</em>
              </motion.span>
            </motion.span>
          </h1>

          {/* Subtitle */}
          <motion.p
            className="hero-sub"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.6 }}
          >
            Syncly turns Chrome&apos;s own native sync into a zero-backend bookmark manager. Workspaces, collections, and tags built right into your real bookmarks — no server, no account, zero telemetry.
          </motion.p>

          {/* Dual CTAs with Button-in-Button trailing physics */}
          <motion.div
            className="hero-ctas"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.6 }}
          >
            <Magnetic>
              <a
                className="btn btn-primary"
                href={storeUrl}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Add Syncly to Chrome — Free"
              >
                <ChromeIcon size={16} />
                <span>Add to Chrome — Free</span>
                <span className="btn-icon-circle" aria-hidden="true">
                  ↗
                </span>
              </a>
            </Magnetic>
            <a className="btn btn-ghost" href="#how-sync-works">
              <span>See how sync works</span>
              <span style={{ fontSize: 13, opacity: 0.7 }}>↓</span>
            </a>
          </motion.div>

          {/* Benchmark & Trust Micro Badges */}
          <motion.p
            className="hero-meta"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.6 }}
          >
            <span>MIT Licensed</span> <i aria-hidden="true" />{" "}
            <span>4.5 MB RAM / tab</span> <i aria-hidden="true" />{" "}
            <span>12ms cold paint</span> <i aria-hidden="true" />{" "}
            <span>0 Trackers</span>
          </motion.p>
        </div>

        {/* Right Column: 4-Tab Interactive Product Preview in Double-Bezel Enclosure */}
        <motion.div
          style={{ y: heroY }}
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.35, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="hero-demo-container"
        >
          <div className="double-bezel-outer">
            <HeroTabDemo />
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
