"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const STORE_URL = "https://chromewebstore.google.com/";
export const GITHUB_URL = "https://github.com/KamrulIslamArnob/Syncly";

export const NAV_ITEMS = [
  { label: "Features", href: "#features" },
  { label: "Sync Engine", href: "#how-sync-works" },
  { label: "Benchmarks", href: "#performance" },
  { label: "Privacy", href: "#comparison" },
  { label: "FAQ", href: "#faq" },
];

export function ChromeIcon({ size = 16, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
      <line x1="21.17" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <line x1="3.95" y1="6.06" x2="8.54" y2="14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <line x1="10.88" y1="21.94" x2="15.46" y2="14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function GitHubIcon({ size = 16, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

export default function Navbar({
  storeUrl = STORE_URL,
  githubUrl = GITHUB_URL,
  className = "",
}) {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  // Scroll listener for sticky elevation & directional auto-hide
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          setScrolled(currentScrollY > 20);

          if (currentScrollY > 180 && currentScrollY > lastScrollY && !mobileMenuOpen) {
            setHidden(true);
          } else {
            setHidden(false);
          }
          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [mobileMenuOpen]);

  // Section highlight observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    const sections = document.querySelectorAll("section[id]");
    sections.forEach((s) => observer.observe(s));
    return () => sections.forEach((s) => observer.unobserve(s));
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <header
        className={`syncly-navbar-root ${scrolled ? "nav-scrolled" : ""} ${hidden ? "nav-hidden" : ""} ${className}`}
        role="banner"
      >
        <div className="syncly-navbar-container">
          <nav className="syncly-navbar-pill" aria-label="Main navigation">
            {/* Brand Logo & Live Pulse Beacon */}
            <a href="#" className="syncly-brand" aria-label="Syncly Homepage">
              <span className="syncly-pulse-dot" aria-hidden="true">
                <span className="syncly-pulse-ring" />
                <span className="syncly-pulse-core" />
              </span>
              <span>Syncly</span>
              <span className="syncly-version-pill">v0.2</span>
            </a>

            {/* Nav Links Desktop */}
            <div className="syncly-nav-links" role="menubar">
              {NAV_ITEMS.map((item) => {
                const isActive = activeSection === item.href.replace("#", "");
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    role="menuitem"
                    className={`syncly-nav-link ${isActive ? "active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="nav-active-pill"
                        className="syncly-nav-active-pill"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </div>

            {/* Right Action Island */}
            <div className="syncly-nav-actions">
              {/* GitHub Star Badge */}
              <a
                href={githubUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="syncly-github-btn"
                aria-label="Star Syncly on GitHub"
              >
                <GitHubIcon size={14} />
                <span>Star</span>
                <span className="syncly-github-count">MIT</span>
              </a>

              {/* Primary CTA Button (Button-in-Button Architecture) */}
              <a
                href={storeUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="syncly-cta-btn"
                aria-label="Add Syncly to Chrome — Free"
              >
                <ChromeIcon size={14} />
                <span>Add to Chrome</span>
                <span className="syncly-cta-badge" aria-hidden="true">
                  ↗
                </span>
              </a>

              {/* Mobile Hamburger Toggle */}
              <button
                type="button"
                className="syncly-mobile-toggle"
                aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((prev) => !prev)}
              >
                <span className={`syncly-hamburger-icon ${mobileMenuOpen ? "open" : ""}`}>
                  <span />
                  <span />
                  <span />
                </span>
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Mobile Drawer Navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="syncly-mobile-drawer-wrapper" role="dialog" aria-modal="true">
            <motion.div
              className="syncly-drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setMobileMenuOpen(false)}
            />

            <motion.div
              className="syncly-drawer-panel"
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="syncly-drawer-header">
                <div className="syncly-brand">
                  <span className="syncly-pulse-dot">
                    <span className="syncly-pulse-ring" />
                    <span className="syncly-pulse-core" />
                  </span>
                  <span>Syncly</span>
                  <span className="syncly-version-pill">v0.2</span>
                </div>
                <button
                  type="button"
                  className="syncly-drawer-close"
                  aria-label="Close menu"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div className="syncly-drawer-nav">
                {NAV_ITEMS.map((item, index) => (
                  <motion.a
                    key={item.label}
                    href={item.href}
                    className="syncly-drawer-link"
                    onClick={() => setMobileMenuOpen(false)}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 + 0.1, duration: 0.3 }}
                  >
                    <span>{item.label}</span>
                    <span className="syncly-drawer-tag">↗</span>
                  </motion.a>
                ))}
              </div>

              <div className="syncly-drawer-actions">
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="syncly-drawer-cta-primary"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <ChromeIcon size={16} />
                  <span>Add to Chrome — Free</span>
                </a>
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="syncly-drawer-cta-secondary"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <GitHubIcon size={15} />
                  <span>View GitHub Repository</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
