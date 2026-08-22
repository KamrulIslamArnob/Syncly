# Project: Syncly Product Website

## Architecture
The Syncly product website is built with Next.js 16 App Router, React 19, and Framer Motion / pure CSS transitions, engineered for ultra-fast load times, zero runtime errors, and flawless responsiveness from 360px mobile viewports to ultra-wide 4K displays.

### Design System & Visual Tokens
- **Background**: Deep canvas `#07080a` with subtle ambient aura glows (Electric Crimson `#D71921` & Vercel Electric Blue `#0070F3`).
- **Elevated Surfaces**: Glassmorphism cards `#0e1015` / `#14171f` with 1px border `#232730` and `backdrop-filter: blur(20px)`.
- **Typography**: Primary `Plus Jakarta Sans` / `Geist` + Monospace `JetBrains Mono` for latency numbers, shortcuts, and code tokens.
- **Contrast**: WCAG AAA compliant (≥ 4.5:1 text contrast, body text 19.8:1).

### Component Layout Hierarchy
```
app/
├── layout.js                 # Root layout (Metadata, Fonts, Dark theme wrapper, SEO)
├── page.js                   # Landing page master composition
├── globals.css               # Design tokens, keyframes, glassmorphism, responsive utilities
components/
├── Navbar.jsx                # Floating glassmorphism navigation with mobile menu drawer
├── Hero.jsx                  # Hero with live badge, headline, dual CTAs, and 4-Tab Interactive Demo
├── HeroTabDemo.jsx           # Interactive 4-tab container (Workspaces, Omni-Search, Quickie, Sync)
├── WindowFrame.jsx           # macOS-style window frame with traffic lights & glass reflection
├── SyncEngineFlow.jsx        # 3-Step Animated Sync Engine Flow with SVG data-packet pulses
├── BentoGrid.jsx             # Interactive Bento Grid featuring live mini-widgets
├── PerformanceStrip.jsx      # Count-up benchmark numbers (12ms, 28ms, 4.5MB, 0 Trackers)
├── ComparisonSection.jsx     # Side-by-side matrix vs Cloud Managers vs Chrome Default
├── FAQSection.jsx            # Smooth collapsible FAQ accordion
└── Footer.jsx                # High-conversion CTA banner & footer links
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Visual Architecture & Tokens | Dark mode palette (#07080a, #0e1015, #0070F3, #D71921), typography, glass styles | M1 | ORIGINAL_REQUEST §R1 |
| 2 | High-Fidelity UI Assets | Realistic screenshots for Workspace, Omni-Search, Quickie popup, Sync Flow | M1 | ORIGINAL_REQUEST §R2 |
| 3 | Floating Glassmorphism Navbar | Blurred pill nav, section links, GitHub pill, Add to Chrome CTA, mobile drawer | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Hero Section Headline & Dual CTAs | Impactful typography, live status badge, trust metrics, Chrome & GitHub CTAs | M2 | ORIGINAL_REQUEST §R1 |
| 5 | Interactive 4-Tab Product Demo | Tab switcher (Workspaces, Omni-Search, Quickie, Sync) with dynamic UI preview | M2 | ORIGINAL_REQUEST §R1, R2 |
| 6 | 3-Step Animated Sync Engine Flow | "Save Anywhere" -> "Chrome Sync Carries It" -> "Every Device Catches Up" with SVG pulses | M3 | ORIGINAL_REQUEST §R3 |
| 7 | Interactive Bento Feature Grid | Workspaces, Collections & #tags, 1-Click Quickie, Omni-Search, Keyboard Shortcuts | M3 | ORIGINAL_REQUEST §R3 |
| 8 | Performance & Privacy Strip | Live count-up numeral counters (12ms First Paint, 28ms Load, 4.5MB RAM, 0 Trackers) | M4 | ORIGINAL_REQUEST §R3 |
| 9 | Cloud Comparison Matrix | Feature breakdown vs Raindrop/Toby cloud bookmark managers and native Chrome | M4 | ORIGINAL_REQUEST §R3 |
| 10 | Collapsible FAQ Accordion | Privacy, zero server sync, MIT license, multi-device mechanics | M4 | ORIGINAL_REQUEST §R3 |
| 11 | High-Conversion Footer | Ambient glow CTA card, Chrome Web Store + GitHub links, copyright & metadata | M4 | ORIGINAL_REQUEST §R3 |
| 12 | Responsive & Accessibility Engineering | 360px to 1440px+ responsiveness, zero console errors, semantic HTML5, clean build | M4 | ORIGINAL_REQUEST §R4 |
| 13 | E2E Opaque-Box Test Suite | 4-tier requirement-driven verification suite with runner and TEST_READY signal | M-E2E | ORIGINAL_REQUEST §Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Visual Tokens, Assets & Navbar | Design system, UI screenshot assets in public/images, floating glass navbar | none | DONE |
| M2 | Hero & 4-Tab Product Preview | Live status badge, headline, dual CTAs, interactive 4-tab demo container | M1 | DONE |
| M3 | Sync Engine & Bento Showcase | 3-step animated SVG sync visualizer, interactive bento feature cards | M1 | DONE |
| M4 | Benchmarks, FAQ & Conversion Footer | Count-up counters, comparison matrix, FAQ accordion, conversion footer, SEO | M2, M3 | DONE |
| M-E2E | E2E Testing Suite (Tiers 1-4) | Requirement-driven test runner, 4-tier test cases, TEST_READY.md publication | none | DONE |
| M-FINAL | E2E Test Pass & Hardening | 100% E2E test pass + Forensic Audit Clean Sign-Off | M4, M-E2E | DONE |

## Interface Contracts
### UI Assets ↔ Hero & Bento Mockups
- Assets stored in `/images/` (`syncly_workspace_dashboard.png`, `syncly_omnisearch_modal.png`, `syncly_quickie_popup.png`, `syncly_sync_flow.png`).
- Standard responsive window frame wrapper accepting `title`, `activeTab`, `interactiveElement`, and image fallback.

### Navigation ↔ Section Anchors
- `#features` -> Bento Feature Grid
- `#how-sync-works` / `#sync-engine` -> 3-Step Animated Sync Engine Flow
- `#performance` / `#benchmarks` -> Performance & Privacy Benchmark Strip
- `#comparison` -> Cloud Bookmark Manager Comparison Matrix
- `#faq` -> Collapsible FAQ Accordion

### E2E Test Suite Runner Contract
- Runner command: `node scripts/test-e2e.mjs` or `npm test`
- Exit Code 0: All Tier 1 to Tier 4 assertions pass (100% passing).

## Code Layout
```
public/
  images/
    syncly_workspace_dashboard.png
    syncly_omnisearch_modal.png
    syncly_quickie_popup.png
    syncly_sync_flow.png
app/
  layout.js
  page.js
  globals.css
components/
  Navbar.jsx
  Hero.jsx
  HeroTabDemo.jsx
  WindowFrame.jsx
  SyncEngineFlow.jsx
  BentoGrid.jsx
  PerformanceStrip.jsx
  ComparisonSection.jsx
  FAQSection.jsx
  Footer.jsx
scripts/
  test-e2e.mjs
```
