"use client";

import React from "react";
import { motion } from "framer-motion";

export const COMPARISON_ROWS = [
  {
    feature: "Hosting Architecture",
    syncly: "Zero Server / Local-First",
    cloud: "Centralized Cloud Server (AWS/GCP)",
    chrome: "Local Browser DB",
    highlight: true,
  },
  {
    feature: "User Account & Login",
    syncly: "None (Zero Signup / No Account)",
    cloud: "Mandatory Email / OAuth Account",
    chrome: "Google Account (Optional)",
    highlight: true,
  },
  {
    feature: "Data Breach Risk",
    syncly: "Zero (No Central Server to Breach)",
    cloud: "High (Stored in 3rd-Party Cloud)",
    chrome: "Zero (Managed by Google)",
    highlight: true,
  },
  {
    feature: "Multi-Device Sync",
    syncly: "Native Chrome Sync Pipeline",
    cloud: "Proprietary Webhook / Cloud DB",
    chrome: "Standard Bookmark Sync",
    highlight: false,
  },
  {
    feature: "Telemetry & Tracking",
    syncly: "0 Trackers / Zero Analytics",
    cloud: "User Analytics & Event Tracking",
    chrome: "Google Usage Stats",
    highlight: true,
  },
  {
    feature: "Offline Capability",
    syncly: "100% Fully Functional Offline",
    cloud: "Degraded / Cached Read-Only",
    chrome: "Functional",
    highlight: false,
  },
  {
    feature: "Hashtags & Workspaces",
    syncly: "Yes (#tags + w- Workspaces)",
    cloud: "Yes (Often Behind Paywall)",
    chrome: "Basic Folders Only",
    highlight: false,
  },
  {
    feature: "Keyboard & Omnibox (nt)",
    syncly: "Full Cmd+K + nt Omnibox Command",
    cloud: "Limited / In-App Only",
    chrome: "Omnibox URL Match Only",
    highlight: false,
  },
  {
    feature: "Pricing & License",
    syncly: "Free Forever (MIT Open Source)",
    cloud: "$3–$6/mo Subscription (Proprietary)",
    chrome: "Free (Proprietary)",
    highlight: true,
  },
];

export const PRIVACY_PILLARS = [
  {
    title: "No backend to breach.",
    body: "There is no Syncly server holding your data. Nothing can leak from a thing that does not exist.",
    icon: "◈",
  },
  {
    title: "No account to make.",
    body: "Your Chrome profile is the only identity involved. Install and it works with zero friction.",
    icon: "⬢",
  },
  {
    title: "MIT source you can read.",
    body: "The entire codebase is small and transparent enough to audit in an afternoon.",
    icon: "⬣",
  },
];

export default function ComparisonSection({ className = "" }) {
  return (
    <section className={`section privacy comparison-section ${className}`} id="comparison">
      {/* Anchor alias */}
      <span id="privacy" style={{ position: "absolute", top: -80, visibility: "hidden" }} aria-hidden="true" />

      <div className="container">
        {/* Privacy Headline Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ textAlign: "center" }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
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
            <span>Privacy & Architecture</span>
          </div>
          <h2 className="privacy-big" aria-label="Nothing leaves your browser">
            Nothing leaves <strong>your browser.</strong>
          </h2>
          <p className="lede" style={{ margin: "20px auto 0", maxWidth: 640 }}>
            Syncly turns Chrome&apos;s built-in account sync into an enterprise-grade bookmark OS without a single line of backend server code.
          </p>
        </motion.div>

        {/* 3 Privacy Pillar Cards */}
        <motion.ul
          className="privacy-list"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.6 }}
          style={{ marginTop: 48 }}
        >
          {PRIVACY_PILLARS.map((item, i) => (
            <motion.li
              key={item.title}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
              }}
            >
              <span className="privacy-icon">{item.icon}</span>
              <div>
                <strong style={{ fontSize: 16, color: "var(--fg)" }}>{item.title}</strong>
                <p className="p-mech" style={{ marginTop: 6, fontSize: 14, color: "var(--fg-2)", lineHeight: 1.6 }}>{item.body}</p>
              </div>
            </motion.li>
          ))}
        </motion.ul>

        {/* Side-by-Side Comparison Matrix */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.7 }}
          className="double-bezel-outer"
          style={{ marginTop: 64 }}
        >
          <div className="double-bezel-inner" style={{ overflow: "hidden" }}>
            <div
              style={{
                padding: "22px 28px",
                borderBottom: "1px solid var(--border)",
                background: "var(--surface-2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--fg)" }}>
                  Cloud Bookmark Managers vs Syncly
                </h3>
                <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 2 }}>
                  Side-by-side technical and security comparison
                </p>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  padding: "4px 12px",
                  borderRadius: "var(--radius-pill)",
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  border: "1px solid var(--border-accent)",
                  fontWeight: 600,
                }}
              >
                100% Local-First
              </span>
            </div>

            {/* Table Container */}
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: 13.5,
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
                    <th style={{ padding: "16px 24px", color: "var(--fg-3)", fontWeight: 500, width: "30%" }}>Dimension</th>
                    <th style={{ padding: "16px 24px", color: "var(--accent)", fontWeight: 700, width: "28%", background: "var(--accent-soft)" }}>
                      Syncly (Local-First OS)
                    </th>
                    <th style={{ padding: "16px 24px", color: "var(--fg-2)", fontWeight: 500, width: "22%" }}>
                      Cloud Managers (Raindrop, Toby)
                    </th>
                    <th style={{ padding: "16px 24px", color: "var(--fg-3)", fontWeight: 500, width: "20%" }}>
                      Chrome Default
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, idx) => (
                    <tr
                      key={row.feature}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        background: idx % 2 === 0 ? "transparent" : "var(--surface-2)",
                      }}
                    >
                      <td style={{ padding: "14px 24px", fontWeight: 500, color: "var(--fg)" }}>
                        {row.feature}
                      </td>
                      <td
                        style={{
                          padding: "14px 24px",
                          fontWeight: 600,
                          color: "var(--accent)",
                          background: "var(--accent-soft)",
                        }}
                      >
                        ✓ {row.syncly}
                      </td>
                      <td style={{ padding: "14px 24px", color: "var(--fg-2)" }}>
                        {row.cloud}
                      </td>
                      <td style={{ padding: "14px 24px", color: "var(--fg-3)" }}>
                        {row.chrome}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
