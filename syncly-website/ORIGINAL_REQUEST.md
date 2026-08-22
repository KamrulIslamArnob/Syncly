# Original User Request

## 2026-08-22T05:26:22Z

Redesign and build the official Syncly product website from scratch into an exceptional, modern, high-converting SaaS landing page. Synthesize design patterns from Simplify.jobs, TealHQ, Huntr, and JobWizard — featuring floating glassmorphism navigation, interactive product demo tabs, high-fidelity generated UI screenshots, an animated zero-server sync visualizer, interactive bento feature grid, and live performance benchmark counters.

Working directory: E:/07_Open-source/Syncly/syncly-website
Integrity mode: development

## Product Truth & Core Facts
Syncly is a free, MIT-licensed Chrome extension that transforms the new tab into a keyboard-first bookmark OS built directly on the user's native Chrome bookmarks tree (`chrome.bookmarks`).
- **Zero Backend / Serverless Sync**: Multi-device sync operates natively through Chrome's built-in account sync (`w-` folder convention) with a lightweight `chrome.storage.sync` metadata mirror merged via background service worker.
- **Privacy & Security**: Local-first, zero telemetry, no user accounts, no subscriptions, 100% offline capable.
- **Internal Benchmarks**: Measured at 500 bookmarks — First paint ≈ 12ms, Data load ≈ 28ms, Tab memory footprint ≈ 4MB.
- **Key Features**: Context Workspaces, Collections & `#tag` tagging, Quickie 1-click capture inbox with recent chips, Omni-search (`nt` omnibox command), and keyboard-first navigation.

## Requirements

### R1. Visual Architecture & Design System (Modern Dark Theme)
- Establish a refined Dark Mode visual system (near-black background `#07080a` / elevated cards `#0e1015` / subtle electric blue & crimson glow accents `#0070F3` & `#D71921` / high-contrast typography using Geist/Plus Jakarta Sans and JetBrains Mono).
- Fixed floating glassmorphism navigation bar with blurred backdrop, brand wordmark, interactive section links (How it Works, Features, Sync Engine, Benchmarks, FAQ), GitHub badge, and prominent "Add to Chrome — Free" CTA with Chrome icon.
- Interactive hero section with live status badge ("Syncly · Local-First Bookmark OS"), impactful headline with gradient highlights, dual CTAs, trust/benchmark stat badges, and an interactive multi-tab feature preview container (switching between Workspaces, Omni-Search, Quickie Capture, and Native Sync).

### R2. High-Fidelity UI Screenshot & Asset Generation
- Generate realistic, high-fidelity UI visual assets and screenshots using image generation for the main extension interfaces:
  1. `syncly_workspace_dashboard`: Clean modern dark-mode new-tab dashboard showing grouped bookmarks, folder hierarchy, search bar, and workspace pill switcher.
  2. `syncly_omnisearch_modal`: Sleek floating command palette with instant search results, hashtag filter chips (`#dev`, `#design`), and keyboard shortcut hints.
  3. `syncly_quickie_popup`: Compact extension popup with 1-click URL capture and destination folder chips.
- Integrate the generated image assets into responsive mockups with window frames, glass reflections, and animated interactive states.

### R3. Interactive Feature Modules & Bento Showcase
- **Animated Sync Engine Flow**: 3-step interactive pipeline visualizer ("Save Anywhere" → "Chrome Sync Carries It" → "Every Device Catches Up") with animated SVG data-packet pulses connecting device outlines to illustrate zero-server native sync.
- **Interactive Bento Grid**: Cards highlighting Workspaces, Collections & Tags, 1-Click Quickie capture, Omni-Search command bar, and keyboard shortcuts (`nt` commands) with interactive hover micro-animations and live preview widgets.
- **Performance & Privacy Strip**: Dark band featuring animated count-up numeral counters (12ms First Paint, 28ms Load, ~4MB RAM, 0 Trackers) with comparison card vs traditional cloud bookmark managers.
- **FAQ Accordion & Conversion Footer**: Smooth collapsible FAQ addressing sync mechanisms, local privacy, MIT license, and final high-conversion CTA banner linking to the Chrome Web Store and GitHub repository.

### R4. Responsive Engineering & Code Quality
- Build clean Next.js (App Router) components with fluid responsiveness across mobile (360px) to desktop (1440px+).
- Implement smooth animations (Framer Motion / CSS transitions) respecting `prefers-reduced-motion`.
- Ensure zero console errors, clean build passing `npm run build`, semantic HTML5 landmarks, and full SEO OpenGraph metadata.

## Acceptance Criteria

### Design & Feature Completeness
- [ ] Landing page renders all key sections: Glass Navbar, Hero with Tabbed Product Preview, How Sync Works 3-Step Visualizer, Bento Feature Grid, Benchmark Counters, Privacy Comparison, FAQ Accordion, and CTA Footer.
- [ ] High-fidelity UI screenshots generated and seamlessly embedded into the interactive demo tabs and mockups.
- [ ] Animated SVG sync path accurately demonstrates Chrome native sync propagation between devices.
- [ ] Interactive controls (tab switcher, FAQ accordions, hover effects, theme elements) function smoothly without glitches.

### Technical & Verification
- [ ] Project builds cleanly without errors or warnings via `npm run build`.
- [ ] Responsive layout adapts flawlessly from 360px viewport to ultra-wide displays without horizontal overflow.
- [ ] Text elements meet accessibility contrast ratio standards (≥ 4.5:1).
- [ ] Semantic HTML structure with proper metadata, tags, and ARIA labels on all interactive controls.
