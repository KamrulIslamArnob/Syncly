"use client";

import { useState } from "react";

/**
 * Accessible FAQ accordion — animated via grid-template-rows 0fr→1fr
 * (no layout-thrash properties), aria-expanded kept truthful.
 */
export default function FaqItem({ question, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="faq-item" data-open={open}>
      <button
        type="button"
        className="faq-q"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {question}
        <span className="faq-chevron" aria-hidden="true" />
      </button>
      <div className="faq-a" role="region">
        <div className="faq-a-inner">
          <p>{children}</p>
        </div>
      </div>
    </div>
  );
}
