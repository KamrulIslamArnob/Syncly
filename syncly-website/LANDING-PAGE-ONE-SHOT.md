# Syncly Landing Page — One-Shot Prompt

**How to use:** Restart opencode (so the Impeccable skill loads), open this repo, paste
everything inside the fenced block below as a single message. The prompt is fully
self-contained — it embeds product truth, design direction, copy brief, animation spec,
and acceptance criteria — and instructs the agent to plan with Impeccable and run a
dedicated copywriting pass before building.

Output lands in `website/` (static, zero-dependency, GitHub-Pages-ready).

---

## THE PROMPT (copy everything below)

```text
You are building the official landing page website for Syncly — a one-shot,
production-quality deliverable. Plan with the Impeccable skill, write the copy through a
dedicated copywriting pass, then build. Do not ask me questions unless something here is
physically impossible; every decision you need is embedded below.

════════════════════════════════════════════════
1 · CONTEXT (read first, in this order)
════════════════════════════════════════════════
- PRODUCT.md (repo root) — confirmed product truth. It is authoritative.
- .opencode/skills/impeccable/ — the Impeccable skill is installed.
  Run: node .opencode/skills/impeccable/scripts/context.mjs
  PRODUCT.md already exists, so init is DONE — do not re-interview me.
  Then follow the skill's craft flow (reference/craft.md) for planning discipline.
- Skim for accuracy only: README.md, CHROMEWEBSTORE.md, docs/architecture.md.
  Where this prompt and those files disagree, THIS PROMPT wins.

Deliverable location: create ./website/ with exactly:
  index.html · styles.css · main.js · (copy woff2 fonts from public/fonts/)
Zero build step, zero external JS libraries, zero CDNs. Everything ships in the folder.

════════════════════════════════════════════════
2 · PRODUCT FACTS (every claim must trace to these)
════════════════════════════════════════════════
Syncly is a free, open-source (MIT) Chrome extension that replaces the new tab with a
fast bookmark manager built on your REAL Chrome bookmarks.

Core mechanism — this is the hero story:
- Workspaces, collections, tags, and shortcuts organize your actual chrome.bookmarks tree.
- Multi-device sync runs entirely on Chrome's own account sync: workspace folders are
  plain bookmark folders (prefixed "w-") riding native bookmark sync, plus a tiny
  chrome.storage.sync metadata mirror kept merged by a background service worker.
- Therefore: no backend, no account, no subscription, no telemetry, nothing to trust —
  if Chrome syncs your bookmarks today, Syncly works today.

Feature inventory (site sections draw from these):
1. Workspaces — switch your whole dashboard per context (Agency / Personal / Research).
2. Collections & Tags — curated groups + hashtag tagging over any bookmark.
3. Quickie inbox — 1-click capture now, organize later; popup quick-save with recent
   destination chips.
4. Omni-search — instant search across shortcuts, bookmarks, tags (#tag filters).
5. Real performance — measured on our own harness at 500 bookmarks: first paint ≈ 12 ms,
   full data load ≈ 28 ms, ~4 MB memory per tab. You may cite these as internal
   benchmarks ("measured, not marketed").
6. `nt` omnibox commands and keyboard-first operation.

HARD TRUTH RULES (violating any of these fails the task):
- NO fabricated testimonials, user counts, ratings, press logos, pricing, or roadmap dates.
- No superlatives that cannot be demonstrated ("best", "#1", "revolutionary").
- Privacy claims must match: local-first, zero telemetry, MIT-licensed.
- The extension is in active development (v0.2) — say "available today" about the
  extension only where true; the CTA may say "Install from Chrome Web Store" linking to
  https://chromewebstore.google.com (placeholder href fine).

════════════════════════════════════════════════
3 · COPYWRITING PASS (run BEFORE layout code)
════════════════════════════════════════════════
Spawn a focused copywriting pass (use a subagent named e.g. "copywriter" if available;
otherwise do two inline passes: draft → self-critique → select).

Voice: quiet confidence, technical precision, short declarative sentences. Reads like a
well-written changelog crossed with an editor's note. Second person for the reader.
Banned words: revolutionary, game-changing, seamless (overused), supercharge, unlock,
effortless, blazing, next-gen, elevate, empower.

Write FIVE candidate hero headlines + supporting sublines that express the core tension:
"Your bookmarks should live everywhere you do — without living on someone else's server."
Evaluate each against: clarity > cleverness · under 60 characters · concrete mechanism ·
no banned words. Select ONE winner and one runner-up (runner-up becomes an OG/meta
description variant).

Then write final copy for every section listed in §4. Rules: every sentence either states
a mechanism, a fact from §2, or speaks to the power user's daily pain (bookmark sprawl,
context switching, distrust of cloud bookmark services). Cut every adjective that survives
without information loss.

Micro-copy requirements: install button label "Add to Chrome — Free"; secondary CTA
"See how sync works"; footer legal line "MIT licensed. No accounts. No telemetry."

════════════════════════════════════════════════
4 · PAGE STRUCTURE (single page, top to bottom)
════════════════════════════════════════════════
1. NAV (fixed, translucent blur, 64px): wordmark "Syncly" left; links: How it works ·
   Sync · Performance · FAQ; right: Add to Chrome button.
2. HERO (100vh): winning headline (48–72px, tight leading), subline, primary CTA +
   secondary CTA. Below/beside: the SIGNATURE ANIMATION (§6a).
3. HOW SYNC WORKS: three-step horizontal flow —
   "Save anywhere" → "Chrome carries it" → "Every device catches up".
   Each step: one sentence of mechanism (native bookmark sync · storage.sync mirror ·
   service worker merge). This section IS the differentiator; give it room.
4. FEATURES GRID: 4–6 cards (Workspaces, Collections & Tags, Quickie capture,
   Omni-search, Keyboard-first). Thin 1px-border cards, generous padding, icon +
   title + two lines max. Hover: border brightens, card lifts 2px.
5. PERFORMANCE STRIP: dark band with three oversized numerals (12ms / 28ms / ~4MB) and
   caption "Measured on our own benchmark harness — 500 bookmarks, mid-range laptop."
   Numerals count up once when scrolled into view.
6. PRIVACY SECTION: centered column, lockup statement: "Nothing leaves your browser."
   Three bullet mechanisms (no backend · no accounts · source-available MIT).
7. FAQ (details/summary accordions, native HTML): Is it really free? · Do I need an
   account? · How does sync work without a server? · Does it send my data anywhere?
8. FINAL CTA band + FOOTER: repeat install CTA; footer with GitHub link
   (https://github.com/ — placeholder ok), "MIT", "Built on Chrome Sync",
   © year Syncly contributors.

════════════════════════════════════════════════
5 · VISUAL DIRECTION — "thin & slick"
════════════════════════════════════════════════
Mood: precision instrument, not marketing site. Apple-product-page restraint meets
terminal-native dark mode. The page itself must feel like the extension: fast, thin,
exact.

- Theme: DARK ONLY. Background near-black #0A0B0D; elevated surfaces #111215.
- Accent: ONE red — #D71921 (brand interrupt). Red appears ONLY on: primary CTA fill,
  one underline per section heading, and the sync-path animation stroke. Nowhere else.
- Text: white #FFFFFF primary; #9BA1AC secondary; #5C626E tertiary. Contrast ≥ 4.5:1
  for all body text (verify pairs).
- Type: "Plus Jakarta Sans" for display/body (copy woff2 from public/fonts/),
  "JetBrains Mono" for numerals/code-ish labels. Scale: 12 / 14 / 16 body ·
  20 sub · clamp(32px,5vw,72px) hero. Weight range 400–700 only. Line-height 1.6 body,
  1.05 hero. Letter-spacing -0.02em on display sizes.
- Geometry: max content width 1120px; cards radius 10px; borders 1px solid #1E2126;
  hairline dividers instead of boxes wherever possible. Whitespace is the luxury:
  section padding ≥ 120px vertical desktop / 72px mobile.
- Texture: at most ONE ambient background element (a faint dot grid or single radial
  glow behind hero, ≤ 6% opacity). No gradients elsewhere. No shadows except card lift.
- Buttons: primary = red fill, white text, radius 8px, weight 600, no gradient;
  hover = brightness(1.08) + translateY(-1px); active = translateY(0).

════════════════════════════════════════════════
6 · MOTION SPEC (the "good animations")
════════════════════════════════════════════════
Global rules: animate ONLY transform & opacity (never width/top/left/margin);
durations 150–500ms; easing cubic-bezier(0.16, 1, 0.3, 1); everything wrapped in
@media (prefers-reduced-motion: reduce) { * { animation: none !important;
transition: none !important } }.

a) SIGNATURE HERO ANIMATION — "the sync path":
   An SVG of two rounded-rect device silhouettes connected by a thin path. A small
   pulse travels node-A → path → node-B on a loop (~3.2s), leaving a brief trailing
   dash; on arrival the receiving device ticks a subtle checkmark. Stroke uses the red
   accent at 80% opacity; devices are hairline outlines. Build as inline SVG +
   CSS keyframes (stroke-dashoffset). This animation is the brand moment — refine it
   until it feels expensive.

b) SCROLL REVEALS: IntersectionObserver adds .is-visible → opacity 0→1 +
   translateY(16px)→0, 420ms, staggered 60ms per child within grids. Once only.

c) NUMERAL COUNT-UP in the performance strip: rAF-based, 600ms, ease-out, starts when
   30% visible, respects reduced-motion (shows final values instantly).

d) MICRO: nav link underline grows from left (transform scaleX); FAQ accordions animate
   grid-template-rows 0fr→1fr; card hovers per §5.

e) NO parallax, NO cursor followers, NO autoplaying anything. Restraint is the style.

════════════════════════════════════════════════
7 · ENGINEERING & ACCEPTANCE CRITERIA
════════════════════════════════════════════════
- Semantic HTML5 (header/nav/main/section/footer, one h1), lang="en", full meta set
  (title ≤ 60ch, meta description from runner-up headline, OG/Twitter tags).
- Accessibility: visible focus rings (2px accent outline offset 2px), all interactive
  elements keyboard-operable, aria-expanded on accordions, alt text everywhere,
  landmarks correct. Target axe-clean.
- Responsive: 360px → 1440px fluid; grids collapse to single column ≤ 720px; nav
  collapses to just logo + CTA on mobile (links hidden, no hamburger needed).
- Performance budget: styles.css ≤ 25KB, main.js ≤ 15KB unminified-acceptable, fonts
  subset from public/fonts (woff2, font-display: swap, preload the two used faces).
  Zero render-blocking third parties. Target Lighthouse ≥ 95 across all four categories.
- SEO: honest metadata only; no keyword stuffing; canonical placeholder comment.
- Self-review checklist printed at the end: confirm each hard-truth rule in §2, each
  banned word absent, motion spec §6 fully honored, and all acceptance bullets above.

When done: summarize (a) chosen headline + why, (b) file tree, (c) the checklist
results. Open website/index.html as the deliverable entry point.
```

---

## Post-run checklist (for you, not the agent)

1. `cd website && npx serve .` — eyeball hero animation, scroll reveals, mobile 360px.
2. Run Lighthouse (perf/a11y/BP/SEO ≥ 95) — budget is enforced by the prompt but verify.
3. Fact-check every claim against `README.md` / `CHROMEWEBSTORE.md`.
4. Replace the two placeholders before publishing: Chrome Web Store URL + GitHub URL.
5. Deploy = push `website/` to a `gh-pages` branch or repo setting (static, no build).
