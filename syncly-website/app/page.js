"use client";

import { motion, useScroll, useTransform, useSpring, useInView, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import Navbar, { STORE_URL, GITHUB_URL } from "../components/Navbar";
import Hero from "../components/Hero";
import SyncEngineFlow from "../components/SyncEngineFlow";
import BentoGrid from "../components/BentoGrid";
import PerformanceStrip, { Counter } from "../components/PerformanceStrip";
import ComparisonSection from "../components/ComparisonSection";
import FAQSection from "../components/FAQSection";
import Footer from "../components/Footer";
import ParticleField from "../components/ParticleField";
import { ChromeIcon } from "../components/Icons";

// ── Scroll Progress ──
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  return <motion.div className="scroll-progress" style={{ scaleX }} />;
}

// ── Cursor Glow ──
function CursorGlow() {
  const [pos, setPos] = useState({ x: -1000, y: -1000 });
  useEffect(() => {
    const h = (e) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);
  return <div className="cursor-glow" style={{ left: pos.x, top: pos.y }} />;
}

// ── Custom Cursor ──
function InsaneCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const mouse = useRef({ x: -100, y: -100 });
  const dotPos = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  useEffect(() => {
    const onMove = (e) => { mouse.current = { x: e.clientX, y: e.clientY }; };
    const onEnter = (e) => {
      const t = e.target;
      if (t instanceof Element && t.closest("a, button, .bento-card, .step")) ringRef.current?.classList.add("hover");
    };
    const onLeave = (e) => {
      const t = e.target;
      if (t instanceof Element && t.closest("a, button, .bento-card, .step")) ringRef.current?.classList.remove("hover");
    };
    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseover", onEnter);
    document.addEventListener("mouseout", onLeave);
    let raf;
    const tick = () => {
      dotPos.current.x += (mouse.current.x - dotPos.current.x) * 0.35;
      dotPos.current.y += (mouse.current.y - dotPos.current.y) * 0.35;
      ringPos.current.x += (mouse.current.x - ringPos.current.x) * 0.12;
      ringPos.current.y += (mouse.current.y - ringPos.current.y) * 0.12;
      if (dotRef.current) dotRef.current.style.transform = `translate(${dotPos.current.x}px, ${dotPos.current.y}px) translate(-50%, -50%)`;
      if (ringRef.current) ringRef.current.style.transform = `translate(${ringPos.current.x}px, ${ringPos.current.y}px) translate(-50%, -50%)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onEnter);
      document.removeEventListener("mouseout", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <>
      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring" />
    </>
  );
}

// ── Lenis Smooth Scroll ──
function useLenis() {
  useEffect(() => {
    let lenis;
    (async () => {
      const Lenis = (await import("lenis")).default;
      lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
      const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
      document.documentElement.classList.add("lenis");
    })();
    return () => { lenis?.destroy(); document.documentElement.classList.remove("lenis"); };
  }, []);
}

// ── Pinned Showcase — Live Workspace Switcher scrub ──
function PinnedShowcase() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const scale = useTransform(scrollYProgress, [0, 1], [0.96, 1]);
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -30]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);
  const progress = useTransform(scrollYProgress, [0, 1], [0, 1]);

  const demos = [
    { ws: "Agency", col: "#7C3AED", title: "Q4 Campaign Assets", count: 84, tags: ["#client", "#urgent"] },
    { ws: "Personal", col: "#8B5CF6", title: "Weekend Reading List", count: 31, tags: ["#inspo", "#longread"] },
    { ws: "Research", col: "#A78BFA", title: "Thesis — References", count: 112, tags: ["#paper", "#archive"] },
  ];

  return (
    <section ref={ref} style={{ height: "200vh", position: "relative" }}>
      <div style={{ position: "sticky", top: 0, height: "100vh", display: "flex", alignItems: "center", overflow: "hidden" }}>
        <div className="container" style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 48, alignItems: "center", width: "100%" }}>
          <div>
            <motion.p className="kicker" style={{ opacity, y: y3 }}>Live Demo</motion.p>
            <h2 className="h2" style={{ fontSize: "clamp(28px, 3.5vw, 44px)" }}>
              <motion.span style={{ display: "block", overflow: "hidden" }}>
                <motion.span style={{ display: "block", y: y1 }}>Switch workspaces.</motion.span>
              </motion.span>
              <motion.span style={{ display: "block", overflow: "hidden" }}>
                <motion.span style={{ display: "block", y: y2 }}><strong>Watch everything move.</strong></motion.span>
              </motion.span>
            </h2>
            <p className="lede" style={{ marginTop: 20, fontSize: 15 }}>
              Scroll to scrub through workspaces. Real Chrome bookmark data, reorganized in milliseconds.
            </p>
            <div style={{ marginTop: 24, height: 2, background: "var(--border)", borderRadius: 999, overflow: "hidden" }}>
              <motion.div style={{ height: "100%", background: "var(--accent)", scaleX: progress, originX: 0 }} />
            </div>
          </div>

          <motion.div style={{ scale, position: "relative" }}>
            <div className="browser" style={{ transform: "none" }}>
              <div className="browser-bar">
                <span className="dots"><i /><i /><i /></span>
                <span className="browser-url">syncly.app — Live Preview</span>
              </div>
              <div className="browser-body">
                {demos.map((d, i) => (
                  <motion.div
                    key={d.ws}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    whileHover={{ scale: 1.02, x: 4 }}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12 }}
                  >
                    <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }} style={{ width: 10, height: 10, borderRadius: "50%", background: d.col, boxShadow: `0 0 10px ${d.col}66`, display: "inline-block" }} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: "var(--fg)" }}>w-{d.ws}</span>
                    <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                      {d.tags.map(t => <span key={t} style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 7px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 999, color: "var(--fg-3)" }}>{t}</span>)}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>{d.count}</span>
                  </motion.div>
                ))}
              </div>
            </div>
            <motion.div style={{ position: "absolute", inset: -12, border: "1px solid var(--border-accent)", borderRadius: 20, pointerEvents: "none", opacity: 0.5 }} animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 2, repeat: Infinity }} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ── Browser Mockup Reference (Used in Hero & Direct Tab Switcher) ──
export function BrowserMockup() {
  const [activeWs, setActiveWs] = useState(0);
  const [typed, setTyped] = useState("");
  const workspaces = [
    { name: "Agency", wsTag: "w-Agency", count: 42, color: "#7C3AED" },
    { name: "Personal", wsTag: "w-Personal", count: 128, color: "#8B5CF6" },
    { name: "Research", wsTag: "w-Research", count: 67, color: "#A78BFA" },
  ];
  const allBookmarks = [
    [
      { fav: "◧", bg: "var(--surface-3)", title: "Figma — Design System 2024", url: "figma.com/file/…", tag: "design" },
      { fav: "⬢", bg: "var(--surface-3)", title: "Linear — Issue Sync-42", url: "linear.app/issue/…", tag: "work" },
      { fav: "✦", bg: "var(--surface-3)", title: "GitHub — syncly/syncly", url: "github.com/syncly", tag: "code" },
    ],
    [
      { fav: "♡", bg: "var(--surface-3)", title: "Are.na — Visual Archive", url: "are.na/board/…", tag: "inspo" },
      { fav: "◐", bg: "var(--surface-3)", title: "Readwise — Highlights", url: "readwise.io/…", tag: "reading" },
      { fav: "◎", bg: "var(--surface-3)", title: "Spotify — Focus Flow", url: "spotify.com/…", tag: "music" },
    ],
    [
      { fav: "⬡", bg: "var(--surface-3)", title: "ArXiv — Attention is All You Need", url: "arxiv.org/…", tag: "research" },
      { fav: "❖", bg: "var(--surface-3)", title: "Notion — Thesis Outline", url: "notion.so/…", tag: "writing" },
      { fav: "▦", bg: "var(--surface-3)", title: "Figma — Research Board", url: "figma.com/board/…", tag: "design" },
    ],
  ];

  useEffect(() => {
    const id = setInterval(() => setActiveWs((v) => (v + 1) % workspaces.length), 2600);
    return () => clearInterval(id);
  }, [workspaces.length]);

  useEffect(() => {
    const full = "research system";
    let i = 0;
    let dir = 1;
    const tick = () => {
      setTyped(full.slice(0, i));
      if (dir === 1) {
        i++;
        if (i > full.length) { dir = -1; setTimeout(tick, 1200); return; }
      } else {
        i--;
        if (i < 0) { dir = 1; i = 0; setTimeout(tick, 600); return; }
      }
      setTimeout(tick, dir === 1 ? 90 : 40);
    };
    const t = setTimeout(tick, 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="browser-wrap">
      <div className="browser">
        <div className="browser-bar">
          <span className="dots"><i /><i /><i /></span>
          <span className="browser-url">
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
            syncly.app — {workspaces[activeWs].name}
          </span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            {workspaces.map((w, i) => (
              <span
                key={w.name}
                onClick={() => setActiveWs(i)}
                style={{
                  padding: "3px 8px",
                  borderRadius: 999,
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  background: i === activeWs ? "var(--accent)" : "var(--surface-2)",
                  color: i === activeWs ? "#fff" : "var(--fg-3)",
                  border: `1px solid ${i === activeWs ? "var(--accent)" : "var(--border)"}`,
                  cursor: "pointer",
                  transition: "all 200ms ease",
                }}
              >
                {w.name}
              </span>
            ))}
          </span>
        </div>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, background: "var(--bg)" }}>
          <span style={{ color: "var(--accent)", fontSize: 13 }}>⌕</span>
          <span style={{ fontSize: 13, color: typed ? "var(--fg)" : "var(--fg-3)", fontFamily: "var(--font-mono)" }}>{typed || "Search bookmarks…"}</span>
          <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--accent)", background: "var(--accent-soft)", padding: "2px 6px", borderRadius: 6, border: "1px solid var(--border-accent)", fontWeight: 600 }}>{allBookmarks[activeWs].length} results</span>
        </div>
        <div className="browser-body">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeWs}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ display: "grid", gap: 10 }}
            >
              {allBookmarks[activeWs].map((b, i) => (
                <motion.div
                  key={b.title}
                  className="bm-row"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.4 }}
                  style={{ borderColor: i === 0 ? "var(--border-accent)" : undefined, background: i === 0 ? "var(--accent-soft)" : undefined }}
                >
                  <span className="bm-fav" style={{ background: b.bg }}>{b.fav}</span>
                  <span className="bm-meta">
                    <span className="bm-title">{b.title}</span>
                    <span className="bm-url">{b.url}</span>
                  </span>
                  <span className="bm-tag" style={{ color: "var(--accent)" }}>#{b.tag}</span>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <motion.div
        className="floating-badge"
        style={{ top: -12, right: -12 }}
        initial={{ opacity: 0, y: 10, scale: 0.9 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.8, duration: 0.5 }}
        animate={{ y: [0, -4, 0] }}
      >
        <motion.span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }} transition={{ duration: 1.6, repeat: Infinity }} />
        Synced to 3 devices <b>· now</b>
      </motion.div>
      <motion.div
        className="floating-badge"
        style={{ bottom: 12, left: -16 }}
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 1, duration: 0.5 }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 6, background: workspaces[activeWs].color, display: "inline-block" }} />
        w-{workspaces[activeWs].name} <span style={{ color: "var(--fg-3)" }}>· {workspaces[activeWs].count} bookmarks</span>
      </motion.div>
    </div>
  );
}

export default function Home() {
  useLenis();

  return (
    <>
      {/* Visual & Physics Overlays */}
      <ScrollProgress />
      <CursorGlow />
      <InsaneCursor />
      <ParticleField />
      <div className="aura-pattern" data-pattern="dots" aria-hidden="true" />

      {/* Floating Glassmorphism Navbar */}
      <Navbar storeUrl={STORE_URL} githubUrl={GITHUB_URL} />

      {/* Main Content Landmark */}
      <main>
        {/* Milestone M2: Hero Section with Live Badge, Headline, Dual CTAs & 4-Tab Demo */}
        <Hero storeUrl={STORE_URL} githubUrl={GITHUB_URL} />

        {/* Dynamic Infinite Marquee Ribbon */}
        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {Array(2).fill(["Workspaces", "Collections", "Tags", "Quickie inbox", "Omni-search", "Keyboard-first", "Zero backend", "MIT licensed"]).flat().map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>
        </div>

        {/* Milestone M3: 3-Step Animated Sync Engine Flow */}
        <SyncEngineFlow />

        {/* Pinned Showcase scrub demo */}
        <PinnedShowcase />

        {/* Milestone M3: Interactive Bento Feature Grid */}
        <BentoGrid />

        {/* Milestone M4: Performance & Privacy Benchmark Strip */}
        <PerformanceStrip />

        {/* Milestone M4: Cloud Comparison & Privacy Matrix */}
        <ComparisonSection />

        {/* Milestone M4: Collapsible FAQ Accordion */}
        <FAQSection />
      </main>

      {/* Milestone M4: High-Conversion CTA Banner & Semantic Footer */}
      <Footer storeUrl={STORE_URL} githubUrl={GITHUB_URL} />
    </>
  );
}
