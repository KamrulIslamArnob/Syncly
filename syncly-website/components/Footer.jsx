"use client";

import React, { useRef } from "react";
import { motion } from "framer-motion";
import { ChromeIcon, STORE_URL, GITHUB_URL } from "./Navbar";

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

export default function Footer({
  storeUrl = STORE_URL,
  githubUrl = GITHUB_URL,
  className = "",
}) {
  const currentYear = new Date().getFullYear();

  return (
    <>
      {/* High-Conversion CTA Banner */}
      <section className="final">
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(800px 400px at 50% 0%, var(--aura-1), transparent 70%)",
            opacity: 0.7,
            pointerEvents: "none",
          }}
          aria-hidden="true"
        />
        <div className="container" style={{ position: "relative" }}>
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2>
              Keep your data.
              <br />
              <strong>Lose the chaos.</strong>
            </h2>
            <p
              style={{
                color: "var(--fg-2)",
                fontSize: 18.5,
                maxWidth: 500,
                margin: "24px auto 0",
                fontWeight: 300,
                lineHeight: 1.65,
              }}
            >
              Install the extension in seconds. All your bookmarks remain completely yours, indexed at 12ms cold paint.
            </p>

            <div className="hero-ctas" style={{ justifyContent: "center", marginTop: 40 }}>
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
              <a
                className="btn btn-ghost"
                href={githubUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                <span>Read the source</span>
                <span style={{ fontSize: 13, opacity: 0.7 }}>↗</span>
              </a>
            </div>

            <p
              style={{
                marginTop: 28,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--fg-3)",
              }}
            >
              MIT licensed · No accounts · Zero telemetry · 100% Offline
            </p>
          </motion.div>
        </div>
      </section>

      {/* Semantic Footer Landmark */}
      <footer className={`footer ${className}`} role="contentinfo">
        <div className="container footer-inner">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 16 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--accent)",
                boxShadow: "0 0 10px var(--accent-glow)",
              }}
              aria-hidden="true"
            />
            Syncly
          </span>
          <a href={githubUrl} target="_blank" rel="noreferrer noopener">
            GitHub
          </a>
          <a href={storeUrl} target="_blank" rel="noreferrer noopener">
            Chrome Web Store
          </a>
          <span className="spacer">
            MIT licensed · No accounts · Zero telemetry
          </span>
          <span>© {currentYear} Syncly contributors</span>
        </div>
      </footer>
    </>
  );
}
