"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";

export const FAQS = [
  {
    q: "Is it really free and open source?",
    a: "Yes. Syncly is MIT-licensed open source software. There is no pro tier, no paywalled features, no trial, and nothing to upgrade. You own the code and your data completely.",
  },
  {
    q: "Do I need to create an account or sign up?",
    a: "No. Syncly uses the Chrome profile you already have. If Chrome syncs your bookmarks today, Syncly works today. There is no email signup, password, or OAuth required.",
  },
  {
    q: "How does multi-device sync work without a server?",
    a: "Syncly rides mechanisms Chrome already provides: workspace folders are plain bookmark folders carried by native bookmark sync, and small metadata rides chrome.storage.sync. A Manifest V3 background service worker merges changes seamlessly between devices.",
  },
  {
    q: "Does any data leave my browser?",
    a: "No telemetry, no analytics, no external servers. The only outbound call Syncly can make is one you switch on yourself: an optional backup to your own private GitHub gist.",
  },
  {
    q: "What happens if I uninstall Syncly?",
    a: "Because Syncly operates directly on chrome.bookmarks, every single bookmark, folder, and hierarchy remains completely safe, intact, and accessible in your browser's native bookmark manager.",
  },
  {
    q: "What browsers are supported?",
    a: "Syncly runs natively on Google Chrome, Brave, Arc, Microsoft Edge, and any modern Chromium-based browser supporting Manifest V3 extension APIs.",
  },
];

export function FaqAccordionItem({ question, answer }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="faq-item" data-open={open}>
      <button
        type="button"
        className="faq-q"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{question}</span>
        <span className="faq-chevron" aria-hidden="true">+</span>
      </button>
      <div className="faq-a" role="region" aria-hidden={!open}>
        <div className="faq-a-inner">
          <p>{answer}</p>
        </div>
      </div>
    </div>
  );
}

export default function FAQSection({ className = "" }) {
  return (
    <section className={`section faq-section ${className}`} id="faq">
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
            <span>Questions & Clarifications</span>
          </div>
          <h2 className="h2">
            Fair questions, <strong>straight answers.</strong>
          </h2>
          <p className="lede">
            Zero-backend architecture is unfamiliar because most SaaS tools profit from holding your data hostage. Here is how Syncly stays genuinely local-first.
          </p>
        </motion.div>

        {/* FAQ List */}
        <motion.div
          className="faq-list"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.6 }}
          style={{ marginTop: 48 }}
        >
          {FAQS.map((f) => (
            <FaqAccordionItem key={f.q} question={f.q} answer={f.a} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
