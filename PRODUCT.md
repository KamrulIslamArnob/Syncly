# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: bookmark power users — people with hundreds to thousands of bookmarks who
organize heavily with folders, tags, collections, and workspaces, and move between two or
more devices daily. Secondary: developers and researchers juggling project-specific
bookmark sets. A general "cleaner new tab" audience benefits but is not the design target.

## Product Purpose

Syncly replaces Chrome's new-tab page with a fast, keyboard-friendly bookmark manager:
workspaces, collections, tags, quick-add popup, `nt` omnibox actions, and a dashboard over
the user's REAL Chrome bookmarks. It exists because native Chrome bookmarks have no
organization layer and cloud bookmarking services cost accounts, subscriptions, and trust.
Success for v1 means raw speed at scale: instant paint, instant search, and fluid
navigation on very large libraries.

## Positioning

"Sync everywhere, stay local" — full multi-device workspace/collection/tag sync achieved
entirely through Chrome's own account sync (chrome.storage.sync mirror + native bookmark
sync + MV3 service worker), with zero backend, zero accounts, zero telemetry. A competitor
cannot copy this without abandoning their server business model.

## Operating Context

- Runs as a Chrome extension (Manifest V3): new-tab override, toolbar popup, options page,
  omnibox keyword `nt`.
- Works offline; all reads/writes hit `chrome.bookmarks` + `chrome.storage.local` with a
  `chrome.storage.sync` metadata mirror.
- Two-device users keep both browsers open and expect near-live propagation of workspaces,
  collections, tags, and shortcuts.

## Capabilities and Constraints

- Workspace root folders use the `w-` prefix convention under Other Bookmarks and ride
  Chrome's native bookmark sync as the quota-proof transport (`workspaceNaming.js`,
  `AdoptNativeWorkspaceFolders`).
- chrome.storage.sync is quota-bound (~8 KB/item, write-rate limits) — only small metadata;
  heavy assets stay local.
- Zero-build vanilla JS ES modules; no framework, no bundler, no CI/linter — guarantees are
  `node --test` plus a puppeteer perf harness (`npm run perf`).
- Performance budget culture: first-render < 500 ms, deck `_load()` < 150 ms at 500
  bookmarks; JS payload target ≤ ~150 KB total.
- MV3 CSP forbids remote code; connect-src limited to api.github.com (optional gist backup)
  and open-meteo (optional weather).
- Undecided product facts: whether weather widget stays in v1 GA; whether GitHub-gist
  backup remains opt-in peripheral (currently yes).

## Brand Commitments

- Name: **Syncly** (fixed).
- Stance: local-first / privacy-first is identity, not a feature flag ("No external
  tracking or telemetry" in README; store listing claims depend on it).
- License: MIT.
- Visual style is NOT contractually locked; current monochrome OLED look is incumbent
  evidence, not a permanent constraint.

## Evidence on Hand

- Real product spec: `PRODUCT_SPEC.md`; store copy: `CHROMEWEBSTORE.md`; architecture:
  `docs/architecture.md`, `docs/agents/CLAUDE.md`.
- Live perf numbers from the T12 harness (`perf-report.json`): first render ≈ 12 ms,
  deck `_load()` ≈ 28 ms at 500 synthetic bookmarks, JS heap ≈ 4.5 MB/tab.
- Open performance backlog: `docs/PR-TICKETS.md` (7 of 14 tickets closed).
- No testimonials, press, or user research exist — future work must not fabricate any.

## Product Principles

1. **Speed is the feature** — every interaction must feel instant at 2,000+ bookmarks;
   regressions fail budgets, not reviews.
2. **The user's bookmarks are the truth** — Syncly organizes Chrome's real tree; it never
   becomes a second, divergent database of record.
3. **Zero-friction trust** — no accounts, no servers, no data exfiltration; setup must stay
   install-and-done.
4. **Chrome does the syncing** — prefer native mechanisms (bookmark sync, storage.sync)
   over inventing transports.
5. **Small and auditable** — vanilla, no-build, dependency-light code a reviewer can read
   end-to-end.

## Accessibility & Inclusion

Keyboard-first operation is a product requirement (search, navigation, quick actions) —
power users live on the keyboard. Full WCAG audit not yet performed (open item).
