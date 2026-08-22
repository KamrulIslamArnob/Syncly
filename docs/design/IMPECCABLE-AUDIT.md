# Syncly × Impeccable — UI Audit Report

> Generated after installing Impeccable (`npx impeccable install --providers=opencode`)
> and running `/impeccable init` flow: `PRODUCT.md` captured (power users · speed at scale ·
> local-first identity), then the bundled detector ran over `src/presentation/`
> (**full parser mode**, 60 deterministic rules).
>
> Raw findings: `.impeccable-final.json` — **13 remaining (was 31)** after the fix loop.
> Per-fix log at the bottom of this file.

---

## Fix log (all five applied & verified)

| # | Fix | Result | Verification |
|---|---|---|---|
| 1 | Popup readability (text floors, contrast, phantom imgs) | popup+options 17→8 findings; contrast 4.1→5.2:1 | detector + tests |
| 2 | Layout-thrash transitions | newTab.css 10→5; 3 dead rules deleted, progress bar → `scaleX`, sidebar width = documented exception | tests + live perf BUDGETS OK |
| — | **Popup UX redesign** (bonus, user-requested) | last-used folder/collection memory + recent-folder one-tap chips + title autofocus → repeat saves need 0 extra clicks | controller syntax + tests |
| 3 | Type-scale consolidation | popup 10 ad-hoc sizes → structured 6-role scale (9.5 kbd / 10 hint / 11 label / 12 body / 13 emphasis / 14 display) | tests |
| 4 | Decorative AI-slop tells | dead drop-stripes ×4 + pulsing dot deleted; glow/halo/stripes proven false positives (theme-preset wallpapers) | ref sweeps |
| 5 | Options spacing rhythm | sections 24px · groups 16px · clusters 8px hierarchy established | tests |

### Accepted residuals (with reasons)

- `overused-font` ×3 — Plus Jakarta Sans is the brand face; Inter stray removed via T10 font diet
- `layout-transition` ×1 — sidebar width collapse reflows the main pane *by design*
- `dark-glow`/`radial-halo`/`repeating-stripes` ×3 — user-selectable theme-preset wallpapers (real feature)
- `broken-image` ×2 — no-src JS-populated placeholders (correct pattern)
- `flat-type-hierarchy` ×2 — counts deliberate header steps + kbd glyphs on top of a clean body scale
- `monotonous-spacing` ×1 — counts `10px 12px` input padding; layout rhythm itself is now hierarchical
- `tiny-text` ×1 — 11px labels are the intentional compact-popup floor

---

## Original report (pre-fix baseline: 31 findings)

---

## Scorecard by surface

| Surface | Findings | Worst problems |
|---|---|---|
| `popup/popup.html` | **13** | 9–9.5 px functional text (8 findings), WCAG contrast fail, flat type scale, broken `<img>` |
| `newTab/newTab.css` | **10** | 5 layout-property animations (jank), AI-slop side-tab stripes ×4, stray "Inter" |
| `options/options.html` | 4 | 10 px body text, monotone spacing, broken `<img>` |
| `newTab/newTab.html` | 4 | pulsing dot, red glow, radial halo, stripe gradient (inline styles) |

---

## P0 — Fix now (usability of the primary flows)

### 1. Popup text is below readable floors — 9 hits
The quick-capture popup is Syncly's most-used surface, and every field label
("Title", "URL", "Folder", "Collection", "Workspace", "Hashtags") plus helper copy sits at
**9–9.5 px** — under impeccable's 11 px functional-text floor and Chrome's own popup norms.
Fix: raise all functional text to ≥ 11 px; body copy ≥ 12 px. The popup has vertical room;
the current sizing saves pixels users can't read anyway.

### 2. Contrast failure in popup
`#6e7585 on #111215` measures **4.1 : 1** (needs 4.5 : 1). Lighten the gray to ≈ `#7d8595`
or brighter until ≥ 4.5 : 1. Applies anywhere that pair recurs.

### 3. Broken `<img src="">` — options.html & popup.html
Two empty-src images render as broken-image icons. Remove them or give real sources.
(Empty `src` also triggers a wasted request to the page URL itself.)

## P1 — Speed & consistency (aligns with Product Principle #1)

### 4. Five layout-property transitions in newTab.css
`:2891`, `:3167`, `:3504`, `:3512`, `:3913` animate `max-height` / `width` /
`min-width` / `max-width` — these trigger layout thrash on every frame, directly against
the "speed at scale" principle. Replace with `transform`/`opacity`, or
`grid-template-rows: 0fr → 1fr` for expand/collapse cases.

### 5. Popup type hierarchy is flat
Ten sizes from 9→16 px at a ~1.05 ratio reads as noise. Consolidate to a 3-step scale
(11 / 13 / 16 px) with weight/color carrying hierarchy instead of size.

### 6. Stray "Inter" in newTab.css (:2798)
One rule references Inter while the brand faces are Plus Jakarta Sans + JetBrains Mono.
Either a leftover or an inconsistency — normalize it during **PERF-T10**'s planned
font diet (which also removes Doto/Space Grotesk/Space Mono).

## P2 — Polish (decorative tells & options page)

### 7. AI-slop markers (newTab)
- Side-tab accent stripes ×4 (`.drop-target-left/right/top/bottom`) — these are *functional*
  drag-drop indicators, so don't delete: soften to 2 px or swap for outline + background tint.
- `.reminder-badge-dot` infinite pulse, `#e5383b` glow, radial halo, repeating stripes —
  decorative; keep at most one ambient motion element on the page.

### 8. Options page rhythm
10 px body text → 12–13 px; spacing uses ~12 px for 64% of gaps — introduce two larger
steps (16/24 px) to create grouping.

---

## Cross-cutting (from init + existing backlog)

| Item | Source | Note |
|---|---|---|
| Keyboard/WCAG audit never performed | PRODUCT.md | Keyboard-first is a stated product requirement; run a formal pass (focus order, visible focus rings, ARIA on the deck grid) |
| PERF-T03/T07/T08/T10/T13/T14 open | docs/PR-TICKETS.md | Search debounce, event delegation, lazy dialogs, font diet, virtualized grid — the speed half of this audit |
| `--font-header` undefined in popup.css | T10 notes | Latent bug; define it when touching popup styles |

## Recommended execution order

1. **Popup readability patch** (P0 items 1–3) — small diff, biggest user impact
2. **Layout-transition cleanup** (P1 item 4) — pairs naturally with PERF-T10's CSS work
3. **Type-scale consolidation** popup + options (P1 item 5, P2 item 8)
4. Decorative-tell sweep (P2 item 7) during any visual pass
5. Formal keyboard/a11y audit as its own ticket

---

*To use Impeccable interactively: restart opencode (skills load at startup), then run
`/impeccable audit src/presentation/popup`, `/impeccable polish`, etc.*
