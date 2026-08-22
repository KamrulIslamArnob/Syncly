# Syncly E2E Test Infrastructure & Methodology

## 1. Overview & Philosophy

The Syncly product website test suite is engineered as an **opaque-box requirement verification engine** adhering to the Project Pattern 4-tier methodology. Rather than brittle, flaky browser automation that depends on external browser binaries or arbitrary sleep timeouts, this test infrastructure executes comprehensive multi-layer requirement assertions covering design tokens, component contracts, accessibility compliance, state machines, cross-feature interactions, and end-to-end user journeys.

---

## 2. Test Architecture: The 4-Tier Methodology

```
┌────────────────────────────────────────────────────────────────────────┐
│                        4-TIER TEST ARCHITECTURE                        │
├────────────────────────────────────────────────────────────────────────┤
│  TIER 1: Feature Coverage                                              │
│  • >= 5 atomic tests per feature across all 12 feature areas           │
│  • Total: 65+ unit/feature assertions                                  │
├────────────────────────────────────────────────────────────────────────┤
│  TIER 2: Boundary & Corner Cases                                       │
│  • Viewport extremes (360px mobile to 1440px+ ultra-wide)              │
│  • WCAG 2.1 AAA Contrast calculations (>= 7:1 normal, >= 4.5:1 text)  │
│  • Asset fallbacks, accordion physics, tab modulo bounds, motion       │
├────────────────────────────────────────────────────────────────────────┤
│  TIER 3: Cross-Feature Combinations                                    │
│  • Pairwise feature coordination (Nav anchors ↔ Section IDs)           │
│  • Tab demo ↔ Bento grid feature parity                                │
│  • UI layering, z-index hierarchy, global CTA destination consistency   │
├────────────────────────────────────────────────────────────────────────┤
│  TIER 4: Real-World Application Scenarios                              │
│  • Complete User Onboarding & Conversion Journey                       │
│  • Offline & Zero-Telemetry Privacy Truth Consistency                  │
│  • Zero-Server Chrome Native Sync Architecture Technical Accuracy      │
│  • Performance Guarantee Traceability (12ms, 28ms, 4MB)                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Tier Breakdown & Test Specifications

### Tier 1: Feature Coverage (>=5 per feature)
1. **Visual Architecture & Tokens**: Verifies `--bg`, `--surface`, `--accent`, `--font-body`, `--font-mono`, and glassmorphism styling.
2. **High-Fidelity UI Assets Pipeline**: Verifies asset directory layout and vector mockups for Workspace, Omni-search, Quickie, and Sync Flow with accessibility attributes.
3. **Floating Glassmorphism Navbar**: Verifies fixed positioning, brand wordmark, anchor links, Add to Chrome CTA, and mobile drawer.
4. **Hero Section Headline & Dual CTAs**: Verifies live status badge, multi-line typography, Chrome & GitHub CTAs, and benchmark badges.
5. **Interactive 4-Tab Product Demo**: Verifies context switching, pill buttons, macOS window frame, dynamic data updates, and omni-search typing simulation.
6. **3-Step Animated Sync Engine Flow**: Verifies Step 1 (Save anywhere), Step 2 (Chrome sync carries it), Step 3 (Every device catches up), zero-server messaging, and step badges.
7. **Interactive Bento Feature Grid**: Verifies Workspaces, Collections & #tags, Quickie inbox, Omni-search, and Keyboard shortcuts cards.
8. **Performance & Privacy Benchmark Strip**: Verifies 12ms First Paint, 28ms Load, ~4MB RAM counters, tabular-nums formatting, and mid-range laptop citation.
9. **Cloud Comparison & Privacy Matrix**: Verifies "Nothing leaves your browser", zero cloud servers, zero accounts, and MIT auditable code guarantees.
10. **Collapsible FAQ Accordion**: Verifies FAQ container, pricing, account-free setup, sync mechanism explanation, and `aria-expanded` native button triggers.
11. **High-Conversion Footer**: Verifies final CTA card, Chrome Web Store link, GitHub source link, semantic `<footer>` landmark, and copyright notice.
12. **Responsive & Semantic Engineering**: Verifies semantic HTML5 landmarks (`<header>`, `<main>`, `<section>`, `<nav>`, `<footer>`), Next.js OpenGraph SEO metadata, and anti-FOUC theme restoration script.

### Tier 2: Boundary & Corner Cases (>=5 per category)
1. **Viewport Extremes & Responsive Breakdown**: Validates `@media (max-width: 860px)` collapse, fluid `clamp()` typography, mobile menu drawer behavior, and `--max: 1240px` ultra-wide clamping.
2. **Dark Theme Tokens & WCAG AAA Contrast**: Uses true mathematical relative luminance calculations (`calculateContrastRatio`) to prove `#ffffff` on `#080a0d` (19.6:1) and `#111318` (18.4:1) exceed WCAG AAA (7.0:1), secondary text `#9aa0ad` exceeds WCAG AA (4.5:1), and focus-visible outlines exist.
3. **Asset Fallback & Resilient Rendering**: Validates `display: "swap"` on local variable fonts, CSS system font fallbacks, SVG viewBox coordinates, and Unicode glyph fallbacks for bookmark icons.
4. **Accordion Toggling Edge Cases**: Validates CSS `grid-template-rows: 0fr -> 1fr` layout-thrash-free transitions, overflow clipping, native button controls, and isolated per-item state management.
5. **Tab Switching Edge Cases**: Validates modulo cycling bounds `(v + 1) % workspaces.length`, manual click override handlers, variable dataset length handling, and `AnimatePresence mode="wait"`.
6. **Motion & Accessibility Preferences**: Validates `@media (prefers-reduced-motion: reduce)` overrides (`animation-duration: 0.001s`, `transition-duration: 0.001s`, `scroll-behavior: auto`, marquee animation disabling).

### Tier 3: Cross-Feature Combinations
1. **Navigation Anchors ↔ Section ID Contract**: Asserts strict 1:1 parity between Navbar links (`#how-sync-works`, `#features`, `#performance`, `#faq`) and DOM section IDs.
2. **Hero Tab Demo ↔ Bento Feature Grid Parity**: Ensures feature capabilities demonstrated in the Hero preview match the technical descriptions in the Bento Grid.
3. **Multi-Theme & UI Layering Integrity**: Validates `z-index` hierarchy between navigation (`z-index: 100`), interactive canvas, and custom cursor elements (`z-index: 9998`).
4. **CTA Consistency**: Ensures all conversion links point to official Chrome Web Store and GitHub repositories.

### Tier 4: Real-World Application Scenarios
1. **Complete User Onboarding & Conversion Flow**: Evaluates the full end-to-end visitor conversion story from initial headline landing through interactive exploration to final CTA.
2. **Offline & Zero-Telemetry Privacy Truth Consistency**: Asserts zero contradictory telemetry, cloud database, or user login claims across all 7 page sections.
3. **Zero-Server Chrome Native Sync Architecture Accuracy**: Asserts technical fidelity regarding `chrome.bookmarks`, `w-` folder conventions, `chrome.storage.sync`, and background service workers.
4. **Performance Guarantee Traceability**: Validates benchmark numbers against documented testing conditions and reproducible methodology.

---

## 4. Execution Commands

### Running All Tests
```bash
node scripts/test-e2e.mjs
# or
npm test
```

### Exit Codes
- `0`: All test suites across Tiers 1 through 4 passed successfully.
- `1`: One or more assertions failed (detailed error diagnostics, file references, and stack traces printed to stdout).
