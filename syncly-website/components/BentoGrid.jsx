"use client";

import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  IconWorkspaces,
  IconTag,
  IconBolt,
  IconSearch,
  IconKeyboard,
} from "./Icons";

// Tilt Card component for tactile 3D perspective and spotlight reflection
function TiltCard({ children, className = "", ...props }) {
  const ref = useRef(null);
  const handleMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--mx", `${(x + 0.5) * 100}%`);
    el.style.setProperty("--my", `${(y + 0.5) * 100}%`);
    const inner = el.querySelector(".tilt-inner");
    if (inner) {
      inner.style.transform = `perspective(900px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateZ(0)`;
    }
  };
  const handleLeave = () => {
    const inner = ref.current?.querySelector(".tilt-inner");
    if (inner) inner.style.transform = "perspective(900px) rotateY(0) rotateX(0)";
  };
  return (
    <div
      ref={ref}
      className={`tilt-card ${className}`}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      {...props}
    >
      <div className="tilt-inner" style={{ height: "100%" }}>
        {children}
        <span className="spotlight" aria-hidden="true" />
      </div>
    </div>
  );
}

export default function BentoGrid({ className = "" }) {
  // Card 1: Workspaces Live State
  const [selectedWs, setSelectedWs] = useState(0);
  const workspaceOptions = [
    { name: "Agency", color: "#7C3AED", count: 42, preview: "figma.com/design-tokens" },
    { name: "Personal", color: "#8B5CF6", count: 128, preview: "readwise.io/books" },
    { name: "Lab", color: "#A78BFA", count: 67, preview: "arxiv.org/sota-models" },
  ];

  // Card 2: Tag Cloud Active State
  const [activeTags, setActiveTags] = useState(["#research", "#inspo"]);
  const allTags = ["#research", "#inspo", "#client", "#archive", "#dev", "#design"];
  const toggleTag = (t) => {
    setActiveTags((prev) =>
      prev.includes(t) ? prev.filter((item) => item !== t) : [...prev, t]
    );
  };

  // Card 3: Quickie Inbox Capture Simulation
  const [quickieSaved, setQuickieSaved] = useState(false);
  const triggerQuickie = () => {
    setQuickieSaved(true);
    setTimeout(() => setQuickieSaved(false), 2200);
  };

  // Card 4: Omni-Search Input State
  const [omniInput, setOmniInput] = useState("research");

  // Card 5: Keyboard Shortcuts Active Keycap
  const [pressedKey, setPressedKey] = useState(null);
  const keyCaps = [
    { key: "⌘ K", desc: "Open Command Palette instantly" },
    { key: "nt tab", desc: "Search directly from Chrome Omnibox" },
    { key: "↑ ↓", desc: "Navigate fuzzy results effortlessly" },
    { key: "↵", desc: "Open in current active tab" },
    { key: "→", desc: "Open seamlessly in background tab" },
  ];

  return (
    <section
      className={`section bento-section ${className}`}
      id="features"
      style={{ background: "var(--bg-2)", borderBlock: "1px solid var(--border)" }}
    >
      <div className="container">
        {/* Header */}
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
            <span>Engineered for Scale</span>
          </div>
          <h2 className="h2">
            Built for people with <strong>too many</strong> bookmarks.
          </h2>
          <p className="lede">
            Hundreds of links across projects and machines is a system, not a list. Every feature below assumes scale and keyboard-driven velocity.
          </p>
        </motion.div>

        {/* Asymmetrical Bento Grid */}
        <div className="bento" style={{ marginTop: 52 }}>
          {/* 1. Context Workspaces (Span 7, Featured) */}
          <TiltCard className="bento-card span-7 featured">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.08, duration: 0.6 }}
              style={{ height: "100%", display: "flex", flexDirection: "column" }}
            >
              <div className="card-icon accent" aria-hidden="true" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                <IconWorkspaces />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 600 }}>Workspaces</h3>
              <p style={{ color: "var(--fg-2)", fontSize: 14.5 }}>
                Partition your entire bookmark dashboard per context — Agency, Personal, Research.
              </p>

              {/* Interactive Workspace Live Widget */}
              <div style={{ marginTop: 26 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {workspaceOptions.map((w, i) => {
                    const isSelected = selectedWs === i;
                    return (
                      <button
                        key={w.name}
                        type="button"
                        onClick={() => setSelectedWs(i)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "var(--radius-pill)",
                          fontSize: 12,
                          fontFamily: "var(--font-mono)",
                          border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                          background: isSelected ? "var(--accent)" : "var(--surface-2)",
                          color: isSelected ? "#ffffff" : "var(--fg-2)",
                          fontWeight: isSelected ? 600 : 400,
                          cursor: "pointer",
                          transition: "all 200ms var(--ease)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          boxShadow: isSelected ? "0 4px 14px var(--accent-glow)" : "none",
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: isSelected ? "#fff" : w.color,
                          }}
                        />
                        {w.name} ({w.count})
                      </button>
                    );
                  })}
                </div>

                <div
                  style={{
                    marginTop: 16,
                    padding: "12px 16px",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-inner)",
                    fontSize: 12.5,
                    fontFamily: "var(--font-mono)",
                    color: "var(--fg-2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <span>Active Root: <code>w-{workspaceOptions[selectedWs].name}</code></span>
                  <span style={{ color: "var(--accent)", fontWeight: 600 }}>{workspaceOptions[selectedWs].preview}</span>
                </div>
              </div>
            </motion.div>
          </TiltCard>

          {/* 2. Collections & Tags (Span 5) */}
          <TiltCard className="bento-card span-5">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.16, duration: 0.6 }}
              style={{ height: "100%", display: "flex", flexDirection: "column" }}
            >
              <div className="card-icon" aria-hidden="true" style={{ background: "var(--surface-2)", color: "var(--accent)" }}>
                <IconTag />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 600 }}>Collections & tags</h3>
              <p style={{ color: "var(--fg-2)", fontSize: 14.5 }}>
                Curate cross-folder collections. Hashtag anything without rearranging folders.
              </p>

              {/* Interactive Tag Chips */}
              <div style={{ display: "flex", gap: 8, marginTop: 24, flexWrap: "wrap" }}>
                {allTags.map((t) => {
                  const isActive = activeTags.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTag(t)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "var(--radius-pill)",
                        fontSize: 12,
                        fontFamily: "var(--font-mono)",
                        background: isActive ? "var(--accent-soft)" : "var(--surface-2)",
                        border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                        color: isActive ? "var(--accent)" : "var(--fg-3)",
                        cursor: "pointer",
                        transition: "all 180ms var(--ease)",
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      {t} {isActive ? "✓" : ""}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </TiltCard>

          {/* 3. 1-Click Quickie Inbox (Span 5) */}
          <TiltCard className="bento-card span-5">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.24, duration: 0.6 }}
              style={{ height: "100%", display: "flex", flexDirection: "column" }}
            >
              <div className="card-icon" aria-hidden="true" style={{ background: "var(--surface-2)", color: "var(--accent)" }}>
                <IconBolt />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 600 }}>Quickie inbox</h3>
              <p style={{ color: "var(--fg-2)", fontSize: 14.5 }}>
                One click captures immediately. The popup remembers your destination history.
              </p>

              {/* Interactive Quickie Save Button */}
              <div style={{ marginTop: 24 }}>
                <div
                  onClick={triggerQuickie}
                  style={{
                    borderRadius: "var(--radius-inner)",
                    background: "var(--bg)",
                    border: `1px solid ${quickieSaved ? "var(--accent)" : "var(--border)"}`,
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    cursor: "pointer",
                    transition: "all 200ms var(--ease)",
                    boxShadow: quickieSaved ? "0 4px 20px var(--accent-glow)" : "none",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--accent)",
                      boxShadow: "0 0 8px var(--accent-glow)",
                    }}
                  />
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg)" }}>
                    {quickieSaved ? "Saved to Quickie Inbox!" : "1-Click Quick Save"}
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--accent)",
                      fontWeight: 600,
                    }}
                  >
                    ↗ Save
                  </span>
                </div>
              </div>
            </motion.div>
          </TiltCard>

          {/* 4. Omni-Search Command Bar (Span 7) */}
          <TiltCard className="bento-card span-7">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.32, duration: 0.6 }}
              style={{ height: "100%", display: "flex", flexDirection: "column" }}
            >
              <div className="card-icon" aria-hidden="true" style={{ background: "var(--surface-2)", color: "var(--accent)" }}>
                <IconSearch />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 600 }}>Omni-search</h3>
              <p style={{ color: "var(--fg-2)", fontSize: 14.5 }}>
                Sub-millisecond fuzzy search across bookmarks, history shortcuts, and #tags.
              </p>

              {/* Interactive Search Bar Widget */}
              <div style={{ marginTop: 24 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "11px 16px",
                    background: "var(--bg)",
                    border: "1px solid var(--border-accent)",
                    borderRadius: "var(--radius-inner)",
                    boxShadow: "0 0 20px var(--accent-glow)",
                  }}
                >
                  <span style={{ color: "var(--accent)", fontSize: 15, fontWeight: "bold" }}>⌕</span>
                  <input
                    type="text"
                    value={omniInput}
                    onChange={(e) => setOmniInput(e.target.value)}
                    placeholder="Search bookmarks or tags..."
                    style={{
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      color: "var(--fg)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      flex: 1,
                    }}
                  />
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      color: "var(--accent)",
                      background: "var(--accent-soft)",
                      padding: "2px 10px",
                      borderRadius: "var(--radius-pill)",
                      border: "1px solid var(--border-accent)",
                      fontWeight: 600,
                    }}
                  >
                    {omniInput.length > 0 ? "12 results" : "0 results"}
                  </span>
                </div>
              </div>
            </motion.div>
          </TiltCard>

          {/* 5. Keyboard-First Navigation (Span 12, Full Width) */}
          <TiltCard className="bento-card span-12">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 0.6 }}
              style={{ height: "100%", display: "flex", flexDirection: "column" }}
            >
              <div className="card-icon" aria-hidden="true" style={{ background: "var(--surface-2)", color: "var(--accent)" }}>
                <IconKeyboard />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 600 }}>Keyboard-first velocity</h3>
              <p style={{ color: "var(--fg-2)", fontSize: 14.5 }}>
                <code>nt</code> commands from anywhere in your browser. Hands never need to leave the keys.
              </p>

              {/* Interactive Keycap Deck */}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginTop: 24,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                {keyCaps.map((k) => {
                  const isHovered = pressedKey === k.key;
                  return (
                    <button
                      key={k.key}
                      type="button"
                      onMouseEnter={() => setPressedKey(k.key)}
                      onMouseLeave={() => setPressedKey(null)}
                      onClick={() => setPressedKey(k.key)}
                      style={{
                        padding: "10px 18px",
                        borderRadius: "var(--radius-sm)",
                        fontSize: 13,
                        fontFamily: "var(--font-mono)",
                        background: isHovered ? "var(--accent)" : "var(--surface-2)",
                        border: `1px solid ${isHovered ? "var(--accent)" : "var(--border)"}`,
                        color: isHovered ? "#ffffff" : "var(--fg)",
                        fontWeight: 600,
                        cursor: "pointer",
                        boxShadow: isHovered ? "0 6px 20px var(--accent-glow)" : "0 2px 4px rgba(0,0,0,0.06)",
                        transform: isHovered ? "translateY(-2px)" : "none",
                        transition: "all 160ms var(--ease)",
                      }}
                    >
                      {k.key}
                    </button>
                  );
                })}

                {pressedKey && (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--accent)",
                      fontWeight: 600,
                    }}
                  >
                    {keyCaps.find((k) => k.key === pressedKey)?.desc}
                  </span>
                )}
              </div>
            </motion.div>
          </TiltCard>
        </div>
      </div>
    </section>
  );
}
