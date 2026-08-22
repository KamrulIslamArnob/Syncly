"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import WindowFrame from "./WindowFrame";
import { ChromeIcon } from "./Navbar";

export const DEMO_TABS = [
  { id: "workspaces", label: "Workspaces", icon: "◧", subtitle: "Context partitioning with w- folders" },
  { id: "omnisearch", label: "Omni-Search", icon: "⌕", subtitle: "Instant fuzzy lookup & #tags" },
  { id: "quickie", label: "Quickie Capture", icon: "⚡", subtitle: "1-Click popup capture" },
  { id: "sync", label: "Zero-Server Sync", icon: "◈", subtitle: "Native Chrome account sync" },
];

export const WORKSPACE_DATA = [
  {
    name: "Agency",
    wsTag: "w-Agency",
    count: 42,
    color: "#7C3AED",
    bookmarks: [
      { fav: "◧", bg: "var(--surface-3)", title: "Figma — Design System 2026", url: "figma.com/file/…", tag: "design" },
      { fav: "⬢", bg: "var(--surface-3)", title: "Linear — Issue Sync-42", url: "linear.app/issue/…", tag: "work" },
      { fav: "✦", bg: "var(--surface-3)", title: "GitHub — syncly/syncly", url: "github.com/syncly", tag: "code" },
      { fav: "▲", bg: "var(--surface-3)", title: "Vercel — Production Deployments", url: "vercel.com/syncly-app", tag: "infra" },
    ],
  },
  {
    name: "Personal",
    wsTag: "w-Personal",
    count: 128,
    color: "#8B5CF6",
    bookmarks: [
      { fav: "♡", bg: "var(--surface-3)", title: "Are.na — Visual Archive", url: "are.na/board/…", tag: "inspo" },
      { fav: "◐", bg: "var(--surface-3)", title: "Readwise — Highlights", url: "readwise.io/…", tag: "reading" },
      { fav: "◎", bg: "var(--surface-3)", title: "Spotify — Focus Flow", url: "spotify.com/…", tag: "music" },
      { fav: "✎", bg: "var(--surface-3)", title: "Substack — Engineering Essays", url: "substack.com/@dan", tag: "reading" },
    ],
  },
  {
    name: "Research",
    wsTag: "w-Research",
    count: 67,
    color: "#A78BFA",
    bookmarks: [
      { fav: "⬡", bg: "var(--surface-3)", title: "ArXiv — Neural Attention Architecture", url: "arxiv.org/…", tag: "research" },
      { fav: "❖", bg: "var(--surface-3)", title: "Notion — Thesis Outline", url: "notion.so/…", tag: "writing" },
      { fav: "▦", bg: "var(--surface-3)", title: "Figma — Research Board", url: "figma.com/board/…", tag: "design" },
      { fav: "◈", bg: "var(--surface-3)", title: "Papers with Code — State of the Art", url: "paperswithcode.com/sota", tag: "research" },
    ],
  },
];

export default function HeroTabDemo({ className = "" }) {
  const [activeTab, setActiveTab] = useState("workspaces");
  const [activeWs, setActiveWs] = useState(0);
  const [typed, setTyped] = useState("");
  const [omniFilter, setOmniFilter] = useState("all");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState("w-Agency/Design");

  const workspaces = WORKSPACE_DATA;
  const allBookmarks = WORKSPACE_DATA.map((w) => w.bookmarks);

  // Auto-cycle workspaces in preview
  useEffect(() => {
    if (activeTab !== "workspaces") return;
    const id = setInterval(() => {
      setActiveWs((v) => (v + 1) % workspaces.length);
    }, 2800);
    return () => clearInterval(id);
  }, [activeTab, workspaces.length]);

  // Automated search typing simulation
  useEffect(() => {
    const full = "research system";
    let i = 0;
    let dir = 1;
    let timer;
    const tick = () => {
      setTyped(full.slice(0, i));
      if (dir === 1) {
        i++;
        if (i > full.length) {
          dir = -1;
          timer = setTimeout(tick, 1400);
          return;
        }
      } else {
        i--;
        if (i < 0) {
          dir = 1;
          i = 0;
          timer = setTimeout(tick, 700);
          return;
        }
      }
      timer = setTimeout(tick, dir === 1 ? 95 : 45);
    };
    timer = setTimeout(tick, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleQuickieSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2400);
  };

  const filteredResults = [
    { title: "ArXiv — Neural Attention Architecture", url: "arxiv.org/abs/2301…", tag: "research", icon: "⬡" },
    { title: "Figma — Syncly Component Library", url: "figma.com/@syncly", tag: "design", icon: "◧" },
    { title: "Linear — Performance Pipeline Milestones", url: "linear.app/team", tag: "dev", icon: "⬢" },
    { title: "Notion — Engineering Principles & Sync", url: "notion.so/sync-spec", tag: "docs", icon: "❖" },
  ].filter((item) => omniFilter === "all" || item.tag === omniFilter);

  return (
    <div className={`hero-tab-demo-wrapper ${className}`} style={{ position: "relative" }}>
      {/* Tab Selector Pill Bar */}
      <div
        className="demo-tabs-bar"
        role="tablist"
        aria-label="Interactive Product Preview Tabs"
        style={{
          display: "flex",
          gap: 6,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          padding: "6px",
          borderRadius: "var(--radius-inner)",
          marginBottom: 16,
          boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
          overflowX: "auto",
        }}
      >
        {DEMO_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className="demo-tab-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                borderRadius: "var(--radius-sm)",
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "#ffffff" : "var(--fg-2)",
                background: isActive ? "var(--accent)" : "transparent",
                border: "none",
                cursor: "pointer",
                position: "relative",
                whiteSpace: "nowrap",
                transition: "all 200ms var(--ease)",
                boxShadow: isActive ? "0 4px 16px var(--accent-glow)" : "none",
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Window Mockup Container */}
      <WindowFrame
        title={`Syncly · ${DEMO_TABS.find((t) => t.id === activeTab)?.subtitle || "Product Demo"}`}
        badge={`${activeWs + 1} / ${workspaces.length} Workspaces`}
        active={true}
        className="hero-tab-window-frame"
      >
        <div style={{ minHeight: 340, position: "relative", overflow: "hidden" }}>
          <AnimatePresence mode="wait">
            {/* TAB 1: WORKSPACES */}
            {activeTab === "workspaces" && (
              <motion.div
                key="tab-workspaces"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                style={{ height: "100%", display: "flex", flexDirection: "column" }}
              >
                {/* Search Bar Subheader */}
                <div
                  style={{
                    padding: "10px 16px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "var(--bg)",
                  }}
                >
                  <span style={{ color: "var(--accent)", fontSize: 14 }}>⌕</span>
                  <span
                    style={{
                      fontSize: 12.5,
                      color: typed ? "var(--fg)" : "var(--fg-3)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {typed || "Search bookmarks or #tags..."}
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 10.5,
                      fontFamily: "var(--font-mono)",
                      color: "var(--accent)",
                      background: "var(--accent-soft)",
                      padding: "2px 8px",
                      borderRadius: 6,
                      border: "1px solid var(--border-accent)",
                      fontWeight: 600,
                    }}
                  >
                    {allBookmarks[activeWs].length} bookmarks
                  </span>
                </div>

                {/* Workspace Pills Header */}
                <div
                  style={{
                    padding: "10px 16px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "var(--surface-2)",
                  }}
                >
                  <span style={{ fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
                    Workspaces:
                  </span>
                  {workspaces.map((w, i) => {
                    const isSelected = activeWs === i;
                    return (
                      <button
                        key={w.name}
                        type="button"
                        onClick={() => setActiveWs(i)}
                        style={{
                          padding: "4px 12px",
                          borderRadius: "var(--radius-pill)",
                          fontSize: 11.5,
                          fontFamily: "var(--font-mono)",
                          background: isSelected ? "var(--accent)" : "var(--surface)",
                          color: isSelected ? "#ffffff" : "var(--fg-2)",
                          border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                          cursor: "pointer",
                          transition: "all 200ms var(--ease)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontWeight: isSelected ? 600 : 400,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: isSelected ? "#ffffff" : w.color,
                          }}
                        />
                        {w.name} ({w.count})
                      </button>
                    );
                  })}
                </div>

                {/* Bookmark List Body */}
                <div style={{ padding: 14, display: "grid", gap: 8, overflowY: "auto" }}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeWs}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25 }}
                      style={{ display: "grid", gap: 8 }}
                    >
                      {allBookmarks[activeWs].map((b, i) => (
                        <motion.div
                          key={b.title}
                          className="bm-row"
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05, duration: 0.3 }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "10px 14px",
                            background: i === 0 ? "var(--accent-soft)" : "var(--bg)",
                            border: `1px solid ${i === 0 ? "var(--border-accent)" : "var(--border)"}`,
                            borderRadius: 10,
                            cursor: "pointer",
                            transition: "transform 180ms ease, border-color 180ms ease",
                          }}
                        >
                          <span
                            className="bm-fav"
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              background: "var(--surface-3)",
                              display: "grid",
                              placeItems: "center",
                              fontSize: 12,
                              color: "var(--fg)",
                            }}
                          >
                            {b.fav}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500, fontSize: 13, color: "var(--fg)" }}>{b.title}</div>
                            <div style={{ fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>{b.url}</div>
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              fontFamily: "var(--font-mono)",
                              color: "var(--accent)",
                              background: "var(--accent-soft)",
                              padding: "2px 8px",
                              borderRadius: "var(--radius-pill)",
                              border: "1px solid var(--border-accent)",
                              flexShrink: 0,
                            }}
                          >
                            #{b.tag}
                          </span>
                        </motion.div>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* TAB 2: OMNI-SEARCH */}
            {activeTab === "omnisearch" && (
              <motion.div
                key="tab-omnisearch"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                style={{ padding: 18 }}
              >
                {/* Search Command Input Bar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    background: "var(--bg)",
                    border: "1px solid var(--border-accent)",
                    borderRadius: 10,
                    boxShadow: "0 0 20px var(--accent-glow)",
                    marginBottom: 12,
                  }}
                >
                  <span style={{ color: "var(--accent)", fontSize: 15, fontWeight: "bold" }}>⌕</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg)", flex: 1 }}>
                    {typed || "research system"}
                    <span style={{ display: "inline-block", width: 2, height: 14, background: "var(--accent)", marginLeft: 2, verticalAlign: "middle" }} />
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10.5,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                      border: "1px solid var(--border-accent)",
                      fontWeight: 600,
                    }}
                  >
                    ⚡ 2.1ms instant
                  </span>
                </div>

                {/* Filter Tag Chips Ribbon */}
                <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                  {[
                    { id: "all", label: "All Results" },
                    { id: "dev", label: "#dev" },
                    { id: "design", label: "#design" },
                    { id: "research", label: "#research" },
                    { id: "docs", label: "#docs" },
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setOmniFilter(chip.id)}
                      style={{
                        padding: "3px 10px",
                        borderRadius: "var(--radius-pill)",
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        background: omniFilter === chip.id ? "var(--accent)" : "var(--surface-2)",
                        color: omniFilter === chip.id ? "#ffffff" : "var(--fg-2)",
                        border: `1px solid ${omniFilter === chip.id ? "var(--accent)" : "var(--border)"}`,
                        cursor: "pointer",
                        transition: "all 150ms ease",
                        fontWeight: omniFilter === chip.id ? 600 : 400,
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* Results Stream */}
                <div style={{ display: "grid", gap: 8 }}>
                  {filteredResults.map((res, i) => (
                    <div
                      key={res.title}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 12px",
                        background: i === 0 ? "var(--accent-soft)" : "var(--bg)",
                        border: `1px solid ${i === 0 ? "var(--border-accent)" : "var(--border)"}`,
                        borderRadius: 8,
                        fontSize: 12.5,
                      }}
                    >
                      <span style={{ width: 24, height: 24, borderRadius: 6, background: "var(--surface-3)", display: "grid", placeItems: "center", fontSize: 11, color: "var(--fg)" }}>
                        {res.icon}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, color: "var(--fg)" }}>{res.title}</div>
                        <div style={{ fontSize: 10.5, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>{res.url}</div>
                      </div>
                      <span style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--accent)", background: "var(--accent-soft)", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>
                        #{res.tag}
                      </span>
                      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-3)", background: "var(--surface-2)", padding: "2px 6px", borderRadius: 4 }}>
                        ↵ Open
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* TAB 3: QUICKIE CAPTURE */}
            {activeTab === "quickie" && (
              <motion.div
                key="tab-quickie"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                style={{ padding: 20, display: "flex", justifyContent: "center" }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: 420,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-card)",
                    padding: 20,
                    boxShadow: "0 16px 40px rgba(0,0,0,0.12)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />
                      Quickie 1-Click Capture
                    </span>
                    <span style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--accent)", background: "var(--accent-soft)", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>
                      ⌥S Shortcut
                    </span>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 10.5, color: "var(--fg-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                      Page Title & URL
                    </label>
                    <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
                      <div style={{ fontWeight: 500, color: "var(--fg)", marginBottom: 2 }}>Productivity Tools for Modern Designers</div>
                      <div style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)", fontSize: 10.5 }}>https://example.com/designer-tools</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 10.5, color: "var(--fg-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                      Destination Folder
                    </label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {["w-Agency/Design", "w-Personal", "⚡ Quickie Inbox"].map((folder) => (
                        <button
                          key={folder}
                          type="button"
                          onClick={() => setSelectedFolder(folder)}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            background: selectedFolder === folder ? "var(--accent-soft)" : "var(--surface-2)",
                            color: selectedFolder === folder ? "var(--accent)" : "var(--fg-2)",
                            border: `1px solid ${selectedFolder === folder ? "var(--accent)" : "var(--border)"}`,
                            cursor: "pointer",
                            fontWeight: selectedFolder === folder ? 600 : 400,
                          }}
                        >
                          {folder}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleQuickieSave}
                    style={{
                      width: "100%",
                      padding: "11px",
                      borderRadius: "var(--radius-sm)",
                      border: "none",
                      background: savedSuccess ? "#22c55e" : "var(--accent)",
                      color: "#fff",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      transition: "all 200ms var(--ease)",
                      boxShadow: "0 4px 16px var(--accent-glow)",
                    }}
                  >
                    {savedSuccess ? (
                      <>
                        <span>✓</span> Saved to {selectedFolder} in 4ms
                      </>
                    ) : (
                      <>
                        <ChromeIcon size={14} /> Save to Real Chrome Bookmarks
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* TAB 4: ZERO-SERVER SYNC */}
            {activeTab === "sync" && (
              <motion.div
                key="tab-sync"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                style={{ padding: 20 }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 16, alignItems: "center", marginBottom: 16 }}>
                  {/* Node A */}
                  <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />
                      <span style={{ fontSize: 12, fontWeight: 600 }}>Workstation A (Laptop)</span>
                    </div>
                    <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>
                      <div>📁 w-Agency (42)</div>
                      <div>📁 w-Personal (128)</div>
                      <div style={{ color: "var(--accent)", fontWeight: 600 }}>+ Saved 1 new link</div>
                    </div>
                  </div>

                  {/* Sync Channel */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 18, color: "var(--accent)" }}>⇄</span>
                    <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-3)", textAlign: "center" }}>
                      Chrome Account Sync<br />(Zero Servers)
                    </span>
                  </div>

                  {/* Node B */}
                  <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
                      <span style={{ fontSize: 12, fontWeight: 600 }}>Workstation B (Desktop)</span>
                    </div>
                    <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>
                      <div>📁 w-Agency (42)</div>
                      <div>📁 w-Personal (128)</div>
                      <div style={{ color: "#22c55e", fontWeight: 600 }}>✓ Delta merged live</div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: "12px 16px",
                    background: "var(--accent-soft)",
                    border: "1px solid var(--border-accent)",
                    borderRadius: 10,
                    fontSize: 12,
                    color: "var(--fg-2)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span style={{ color: "var(--accent)", fontWeight: "bold" }}>●</span>
                  <span>
                    Syncly stores zero user data on third-party servers. All bookmark items ride native <code>chrome.bookmarks</code> and <code>chrome.storage.sync</code>.
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </WindowFrame>

      {/* Floating Status Badges */}
      <motion.div
        className="floating-badge"
        style={{ position: "absolute", top: -14, right: -12, zIndex: 10 }}
        initial={{ opacity: 0, y: 10, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
      >
        <motion.span
          style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }}
          animate={{ scale: [1, 1.4, 1], opacity: [1, 0.7, 1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
        <span>Synced to 3 devices <b>· now</b></span>
      </motion.div>

      <motion.div
        className="floating-badge"
        style={{ position: "absolute", bottom: 12, left: -16, zIndex: 10 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.5 }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: workspaces[activeWs].color,
            display: "inline-block",
          }}
        />
        <span>
          w-{workspaces[activeWs].name} <span style={{ color: "var(--fg-3)" }}>· {workspaces[activeWs].count} bookmarks</span>
        </span>
      </motion.div>
    </div>
  );
}
