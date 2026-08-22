# PR Tickets — Performance & Memory Optimization Plan

> **Status:** Planning — nothing here is implemented yet.
> **Context:** The extension's new-tab page costs ~1.5–1.6 MB per open tab and shows
> avoidable CPU churn (redundant IPC reads, full DOM rebuilds, per-tab polling timers).
> This document breaks the optimization work into 11 independently reviewable PR tickets,
> each with a blast-radius analysis: what changes, which files depend on what, what could
> go wrong, and what to verify before merge.

---

## Ticket index

| ID | Title | Phase | Priority | Risk | ~Size |
|----|-------|-------|----------|------|-------|
| ~~PERF-T01~~ | ~~Single bookmark-tree fetch per reload~~ | 1 | P0 | Low-Med | ✅ **DONE → [PR-CLOSED.md](./PR-CLOSED.md)** |
| ~~PERF-T02~~ | ~~Coalesced reload scheduler~~ | 1 | P0 | Med | ✅ **DONE → [PR-CLOSED.md](./PR-CLOSED.md)** |
| [PERF-T03](#perf-t03--debounced-search--filter-in-place) | Debounced search + filter-in-place | 1 | P0 | Med-High | ~100 lines net, 1 file |
| ~~PERF-T04~~ | ~~Reconcile polling moves to service worker~~ | 2 | P1 | Low | ✅ **DONE → [PR-CLOSED.md](./PR-CLOSED.md)** |
| ~~PERF-T05~~ | ~~Auto-backup loop efficiency~~ | 2 | P1 | Low | ✅ **DONE → [PR-CLOSED.md](./PR-CLOSED.md)** |
| ~~PERF-T06~~ | ~~Clock: cached formatters + hidden-tab pause~~ | 2 | P1 | Low-Med | ✅ **DONE → [PR-CLOSED.md](./PR-CLOSED.md)** |
| [PERF-T07](#perf-t07--event-delegation-on-grids) | Event delegation on grids | 3 | P2 | High | ~200-line delta, 1 file |
| [PERF-T08](#perf-t08--lazy-dialog-construction) | Lazy dialog construction | 3 | P2 | Low | ~40 lines, 1 file |
| ⚠️ PERF-T09 | Stop per-load OmniSearchIndex rebuilds | 3 | P2 | Trivial | **STALE PREMISE → [see ticket](#perf-t09--stop-per-load-omnisearchindex-rebuilds)** |
| [PERF-T10](#perf-t10--cssfont-diet) | CSS/font diet | 3 | P2 | Low | ~6 lines + assets |
| ~~PERF-T11~~ | ~~Delete dead preview machinery~~ | 3 | P2 | Trivial | ✅ **DONE → [PR-CLOSED.md](./PR-CLOSED.md)** |
| ~~PERF-T12~~ | ~~Performance instrumentation & budgets~~ | 4 | P1 | Low | ✅ **DONE → [PR-CLOSED.md](./PR-CLOSED.md)** |
| [PERF-T13](#perf-t13--virtualized-card-grid-for-large-libraries) | Virtualized card grid for large libraries | 4 | P2 | High | ~150-line delta, 1 file |
| [PERF-T14](#perf-t14--code-splitting-via-dynamic-import) | Code splitting via dynamic import() | 4 | P3 | Med | ~30 lines, 2 files |

> Tickets T12–T14 were added after cross-checking the codebase against an external
> performance-techniques report (see [Appendix A](#appendix-a--report-cross-check-matrix)).

---

## Baseline & measurement protocol (run BEFORE ticket #1)

No ticket merges on "feels faster." Capture numbers first:

1. **Chrome Task Manager** (Shift+Esc): record per-new-tab memory with a realistic
   library (~300–500 bookmarks), both just-opened and after idle.
2. **DevTools Performance panel:** record page open + a 20-character search session;
   note scripting time and longest frames.
3. **Heap snapshot:** note retained DOM node count and listener count.
4. Paste before/after numbers into every PR description.

---

## ~~PERF-T01 — Single bookmark-tree fetch per reload~~ ✅ CLOSED

> **Moved to [PR-CLOSED.md](./PR-CLOSED.md)** — implemented & verified (247/247 tests green; 3× IPC fetch → 1× per reload).

---

## ~~PERF-T02 — Coalesced reload scheduler~~ ✅ CLOSED

> **Moved to [PR-CLOSED.md](./PR-CLOSED.md)** — implemented & verified (35 call sites coalesced, 247/247 tests green).

---

## PERF-T03 — Debounced search + filter-in-place

**Phase 1 · P0 · Land AFTER T02 and T11**

**Goal.** Every keystroke rebuilds sidebar/header/content from scratch
(`BookmarkDeckView.js:1252-1266`, focus hero input at :2405-2419) — thousands of DOM nodes
and closures recreated per character. Debounce input 120 ms; for query-only changes toggle
card visibility instead of rebuilding DOM.

**Files changed**

| File | Change |
|---|---|
| `BookmarkDeckView.js` | Input handlers debounce; `_renderContent()` fast-path keyed on "only `_query` changed"; count badge + empty-state updated inside the fast path; delete the `syncAndFocus` focus-juggling hack (:2409-2418) once inputs survive renders |

**Blast radius**
- Matching rule must stay single-sourced: reuse `_getActivePool()` ids (:1481-1499) — do not
  duplicate title/url matching logic or tag+query combos will diverge.
- Select-mode + bulk action bar visibility must survive the fast path (bar is appended
  outside the grid loop).
- *Interaction with PERF-T13 (binding rule):* this fast path can only toggle cards that are
  mounted. Once T13 lands, chunking MUST be disabled whenever `_query` or `_activeTag` is
  set — filtered pools render in full; chunking applies to unfiltered browsing only.
  Encoded in both tickets so neither implementation silently violates it.

**What could go wrong**
- Hidden-but-alive cards retain stale listeners until T07 lands — harmless; note in review.
- View-mode/theme/density switches are structural → must bypass the fast path and rebuild.
- Focus-mode hero input ↔ header input sync: the fast path removes the rebuild that forced
  the sync hack; verify both inputs stay value-synced when switching layouts mid-query.

**Keep in mind:** type rapidly over a large library (Performance panel: frames <16 ms),
clear-query restores all, `#tag` + query combo, Escape-clears-query path (:3163-3173),
Enter-to-Google (:1268-1274).

---

## ~~PERF-T04 — Reconcile polling moves to service worker~~ ✅ CLOSED

> **Moved to [PR-CLOSED.md](./PR-CLOSED.md)** — implemented & verified (247/247 tests green; page polling removed, SW owns convergence).

---

## ~~PERF-T05 — Auto-backup loop efficiency~~ ✅ CLOSED

> **Moved to [PR-CLOSED.md](./PR-CLOSED.md)** — implemented & verified (247/247 tests green; allowlist-only reads, compact JSON, visibility-gated loop).

---

## ~~PERF-T06 — Clock: cached formatters + hidden-tab pause~~ ✅ CLOSED

> **Moved to [PR-CLOSED.md](./PR-CLOSED.md)** — implemented & verified (247/247 tests green; formatter cache + visibility-gated ticking, pomodoro independence preserved).

---

## PERF-T07 — Event delegation on grids

**Phase 3 · P2 · LAND LAST**

**Goal.** `_renderCard` attaches ~10 closures/listeners per card
(click/auxclick/dragstart/dragend/dragover/dragleave/drop + tag/delete/remove buttons,
BookmarkDeckView.js:2866-3047). With hundreds of bookmarks that is thousands of live
closures recreated on every render. Replace with container-level delegated listeners
resolving targets via `closest("[data-id]")`.

**Files changed**

| File | Change |
|---|---|
| `BookmarkDeckView.js` | Cards/shortcut tiles/subfolder tiles carry `data-id` (+`data-parent-id`/`data-cat-id`); one delegated set of `click/auxclick/contextmenu/dragstart/dragend/dragover/dragleave/drop` per grid container |

**Scope discipline:** card grid + shortcut grid + subfolder quickbar ONLY. Sidebar tree
rows keep per-node binding (few nodes; nested slash-button makes `closest()` branching
fiddly — separate follow-up).

**What could go wrong**
- *Leaf resolution:* delegated clicks resolve via `_leafIndex`. Verified safe: every rendered
  pool source (all / quickie / collection-resolved / folder subtree) derives from
  `flattenLeaves` over the full tree, so ids are always indexed. Shortcut tiles are
  domain-shaped (`id.value` wrappers) → use a dedicated `Map` over `this._shortcuts`, NOT
  `_leafIndex`.
- *Drag semantics:* `dataTransfer.setData` must happen on the resolved source element;
  `dragend` sweeps all `.is-drag-over`/`.is-dragging` classes globally (pattern already
  exists at :1693); preserve the `setTimeout(0)` dragging-class trick (:1535, :1687).
- *Pre-existing gap surfaced, not introduced:* cards are `div[role=link][tabindex=0]` —
  Enter never fired click before either. Optionally add a `keydown` Enter branch while
  touching; flag it explicitly in the PR rather than silently expanding scope.
- Highest regression surface in the whole set — do not bundle with anything else.

**Keep in mind (QA matrix):** reorder-within-folder · cross-folder move · drop on
collection row / Quickie / sidebar folder row · shortcut reorder within AND across
categories · middle-click open · ctrl/shift-click new tab · select-mode multi-delete ·
context menu on every element type · Escape exits select mode.

---

## PERF-T08 — Lazy dialog construction

**Phase 3 · P2**

**Goal.** Ten dialog views are eagerly constructed per tab in the deck constructor
(`BookmarkDeckView.js:299-313`). Most sessions never open most dialogs.

**Files changed**

| File | Change |
|---|---|
| `BookmarkDeckView.js` | Getters (`get groupDialog()`) building on first access; `onSave`/`onDelete` wiring moves into first build |

**Verified gotcha — the one real trap:** `_load()` calls
`categoryDialog.setShortcutsFolderId(...)` / `shortcutDialog.setShortcutsFolderId(...)`
**unconditionally on every load** (:456-457). With naive getters this instantiates both
dialogs on every load — defeating the purpose. Fix with a stash pattern: store the pending
id; the getter applies it on construction.

`bookmarkPicker.dialog` is only queried after `open()` (:2550) — safe.
`GroupProfileButtonsView`: leave eager (rendered into the sidebar on every load anyway).
`ProfileDialogView`: excluded — it is dead code, handled by T11's deletions.

**Keep in mind:** every dialog opens/closes repeatedly; shortcuts-folder id flows into
category/shortcut dialogs correctly after folder creation post-load.

---

## ⚠️ PERF-T09 — Stop per-load OmniSearchIndex rebuilds — STALE, DO NOT EXECUTE AS WRITTEN

> **Execution review finding:** the ticket's premise no longer matches source. The claim
> "search NEVER uses it" is false in current code — `_renderContent()` runs
> `this._searchIndex.search(this._query, …)` as the live omni-search engine
> (BookmarkDeckView.js:2196), fed by `.index()` on every `_load()` (:548).
> Executing Option A ("leave index() uncalled") would break search entirely.
> **Decision: not executed.** Re-scope required if per-load re-index cost ever shows up
> in `npm run perf` numbers (e.g., incremental indexing on bookmark events instead of
> full rebuild). `getCategoryName` chip lookup (:1597) is a separate micro-optimization.
>
> **Original ticket text (stale, kept for reference):**
>
> **Phase 3 · P2**
>
> **Goal.** `OmniSearchIndex.index()` tokenizes the entire library on every `_load()`
> yet search NEVER uses it — `_getActivePool()` filters with plain `.includes()` over
> title/url. The index's only consumer is `getCategoryName(item)` for shortcut-tile
> category chips.
>
> **Options (pick in review):**
> - **A (recommended):** replace the `getCategoryName` usage with a direct lookup over
>   `this._categories` (few categories); leave `index()` uncalled. The class and both test
>   files stay green untouched.
> - **B:** delete `src/domain/services/OmniSearchIndex.js` + both test files entirely.
>
> **Risk:** Option A is near-zero; B loses future search infrastructure.

---

## PERF-T10 — CSS/font diet

**Phase 3 · P2**

**Goal.** Drop stylesheets and fonts parsed per tab but unused since the redesign.

**Verified facts:**
- penta-bridge `<link>`s exist ONLY in `newTab.html:18-19`.
- `--pb-*` variables are consumed only inside penta-bridge's own CSS files.
- Active design uses Plus Jakarta Sans + JetBrains Mono (`tokens.css:68-70`).
- Doto / Space Grotesk / Space Mono ≈ 60 KB of @font-face declarations that become fully
  unreferenced once penta-bridge CSS is removed.
- **`--font-header` gate RESOLVED (was previously open):** `popup.css:105` uses
  `var(--font-header)` but the variable is defined NOWHERE in the codebase — it currently
  falls back to inheritance (latent bug). Deleting the legacy fonts therefore CANNOT break
  popup typography. Optionally fix the bug while here by defining
  `--font-header` = Plus Jakarta Sans in `popup.css`'s scope.

**Files changed**

| File | Change |
|---|---|
| `newTab.html` | Remove the two penta-bridge `<link>` lines (:18-19); add `<link rel="preload" as="font" type="font/woff2" crossorigin href="../../../public/fonts/plusjakartasans-var.woff2">` and the JetBrains Mono equivalent — resource-hint preloads of the two fonts actually rendered, eliminating first-paint FOUT on every new tab |
| `public/fonts/fonts.css` | Remove the Doto / Space Grotesk / Space Mono @font-face rules; optional: delete the 4 corresponding woff2 files |
| `popup.css` | Optional one-liner: define the missing `--font-header` |

**Note:** popup.html:29 and options.html:7 also link `fonts.css`, so font pruning benefits
all three surfaces; neither references Doto / Space Grotesk / Space Mono.

**Risks:** old-dashboard revival silently loses fonts/styles — accepted per CLAUDE.md
dead-code stance; state it in the PR body. Optional follow-up (separate ticket): split or
minify `newTab.css` (195 KB / 6,628 lines).

---

## ~~PERF-T11 — Delete dead preview machinery~~ ✅ CLOSED

> **Moved to [PR-CLOSED.md](./PR-CLOSED.md)** — implemented & verified (247/247 tests green).

---

## ~~PERF-T12 — Performance instrumentation & budgets~~ ✅ CLOSED

> **Moved to [PR-CLOSED.md](./PR-CLOSED.md)** — implemented & verified live (`npm run perf -- --assert` → BUDGETS OK at N=500; 247/247 tests green).

---

## PERF-T13 — Virtualized card grid for large libraries

**Phase 4 · P2 · High complexity · After T03 (and ideally T07)**

**Goal.** Report technique: virtual scrolling. Today `_renderContent()` builds DOM for
EVERY bookmark in the active pool (:2340-2343, :2621-2637) — a 2,000-bookmark library
means ~20k+ nodes and closures regardless of viewport. Cap rendered DOM to what the user
can see.

**Recommended approach — chunked incremental mount (Option A):**
Render an initial chunk (~60 cards); place a sentinel element after the grid; an
IntersectionObserver mounts the next chunk when the sentinel nears the viewport.
No row-height math, works across all three view modes and densities. True windowing
(unmounting off-screen rows with spacers) only as follow-up if long-scroll sessions still
dominate memory.

**Binding rule (from the T03 × T13 consistency review):** chunking is DISABLED whenever
`_query` or `_activeTag` is set — filtered pools render in full so T03's filter-in-place
fast path can always reveal every match. Chunked mounting applies to unfiltered browsing
only. Reset chunk state on workspace/folder/collection/view-mode changes.

**Files changed**

| File | Change |
|---|---|
| `BookmarkDeckView.js` | Chunk state (`_renderedCount`), sentinel observer, reset hooks wherever `_query`/`_activeSelection`/`_viewMode`/`_activeTag` change or `_load()` rebuilds |

**Verified interactions**
- Select-mode survives unmounting: bulk operations read `_selectedIds` (a Set of ids),
  never the DOM ✓.
- Drag-and-drop across chunk boundaries resolves via `_leafIndex`, not rendered cards —
  verify drop targets exist only for mounted cards (acceptable v1).
- Count badge already uses `pool.length` (:2455) — stays truthful.

**What could go wrong**
- *Scroll anchoring jumps* when chunks append mid-scroll → append below current scroll
  position only; test fast top↔bottom scrubbing.
- *Ctrl+F limitation:* browser find cannot see unmounted cards (find does not trigger
  IntersectionObserver). Document as known trade-off — the in-page search bar remains the
  primary finder. Do not "fix" by rendering everything.
- *Observer root:* confirm the actual scrolling ancestor (`window` vs `.raindrop-main`)
  and set root/rootMargin accordingly; a wrong root silently never fires.

**Keep in mind QA matrix:** 2,000+ synthetic bookmarks · all view modes × densities ·
filter/tag while scrolled deep · select-all semantics with unmounted items selected ·
memory snapshot shows bounded node count · switch workspace/folder resets chunks.

---

## PERF-T14 — Code splitting via dynamic import()

**Phase 4 · P3 · Pair with T08 (same getters)**

**Goal.** Report technique adapted to Syncly's no-bundler vanilla-ESM reality:
`import()` natively defers module parse+compile. T08 already defers dialog *construction*
via lazy getters — but every new tab still PARSES ~10 dialog modules plus
SettingsSidebarView (40.7 KB) because they are statically imported. Convert those imports
to first-use dynamic ones.

**Files changed**

| File | Change |
|---|---|
| `BookmarkDeckView.js` | Dialog static imports (:5-14) become cached async getters (`await import("./GroupDialogView.js")` memoized in a Map) — T08's getter seams are exactly where this slots in |
| `newTabController.js` | Dynamic-import SettingsSidebarView on first settings open; keep ToastView eager (used everywhere) |

**Candidates:** GroupDialogView (12.8 KB) · BookmarkPickerModalView (15 KB) ·
CollectionDialogView · CategoryDialogView · ShortcutDialogView · NewFolderDialogView ·
BookmarkTagsDialogView · SettingsSidebarView chain
(backupAllowlist + cssSanitizer + colorUtils ride along).
~~ProfileDialogView~~ — removed from this list by the consistency review: it is dead code
(zero call sites) and belongs in T11's deletions, not lazy-loading.
**NOT candidates:** dom.js / icons.js / ToastView / deck core / CombinedClockView +
GreetingView (rendered immediately in focus mode).

**What could go wrong**
- *Async seam:* call sites must tolerate promises — dialogs open exclusively from event
  handlers, so `await` inside handlers is safe. Wrap import failure in toast, never let it
  break init.
- *Circular-import surprises* when converting chains — keep module graph acyclic; test
  each surface after conversion.
- *First-open latency shifts* to parse time (~tens of ms) — imperceptible, but optional
  `requestIdleCallback` warm-up of the settings chunk after first render if it feels slow.
- MV3 extension pages support dynamic `import()` of packaged modules; verify one dialog in
  DevTools network panel resolves via `chrome-extension://` before converting the rest.

**Keep in mind:** popup/options pages untouched; measure startup JS-parse reduction with
T12's harness (this is why T12 lands first).

---

## Merge order & dependency graph

```
Render-path chain:
T11 ──► T02 ──► T03 ──► T13 ──► T07    (windowing lands before delegation so chunk mounts are cheap)

           ▲
T01 ───────┘                            (cleaner _load feeds T02's world)

Measurement rail:
T12 ──► lands right after T01; every subsequent PR reports before/after numbers from it

Dialog chain:
T08 ──► T14                             (lazy construction → lazy module parse)

Independent (any slot):  T04 · T05 · T06 · T09
Gate RESOLVED:           T10 (--font-header verified undefined → safe; adds font preloads)
Last:                    T07 (biggest diff, isolated)
```

**Recommended sequence**

| # | Ticket | Why this position |
|---|--------|-------------------|
| 1 | T11 | Pure deletion; shrinks code surface that T03/T13 would otherwise preserve |
| 2 | T02 | Coalescing foundation — later tickets rebase on one load path |
| 3 | T01 | Tree-fetch fix lands inside the now-stable `_load()` |
| 4 | T12 | Harness ready → every remaining PR ships with before/after numbers |
| 5 | T04 | Independent; removes polling before measuring steady-state |
| 6 | T06 | Independent; quick win, manual QA only |
| 7 | T05 | Backup loop; independent |
| 8 | T09 | Index removal; trivial after render path settled |
| 9 | T08 | Lazy dialogs; creates the getter seams |
| 10 | T14 | Swaps those getter seams to dynamic `import()` — same review, no rework |
| 11 | T03 | Search/filter UX change; benefits from everything above |
| 12 | T10 | CSS/fonts diet + font preloads |
| 13 | T13 | Windowed grid — needs T03's fast path; lands just before delegation |
| 14 | T07 | Delegation — biggest diff, isolated last |

### File-conflict warning

`src/presentation/newTab/views/BookmarkDeckView.js` appears in **8 of 14 tickets**
(T01, T02, T03, T07, T08, T09, T11, T13). Never stack unmerged tickets locally; land
strictly in sequence for deck-file PRs.

### Cross-ticket consistency review (pairwise)

Every ticket was compared against every other ticket AND against the current source
state. Outcomes:

| Pair / check | Verdict | Resolution |
|---|---|---|
| T01 × T02 | Compatible — different concerns inside `_load()` | none |
| T02 × T13 | Compatible — chunk reset hooks already specified | none |
| **T03 × T13** | **Conflict** — filter-in-place can only toggle *mounted* cards; matches below the rendered chunk would be invisible | Rule added to both tickets: chunking is DISABLED while `_query`/`_activeTag` is set — filtered pools render in full |
| T07 × T13 | Compatible — delegated listeners live on grid containers, indifferent to which children exist | none |
| T08 × T14 | Deliberately sequential — T14 swaps T08's getter internals to `import()` | none |
| T04 vs current container.js | **Stale refs** — `AdoptNativeWorkspaceFolders` landed in the hydrate chain during planning; reconcile block moved to :187/:191 | T04 line refs updated; idempotency note added |
| T05 anchors | Re-verified valid (`AutoBackupService.js:136/:166`) | none |
| T06 / T01 anchors | Re-verified valid (`CombinedClockView.js:133`, `EnsureQuickieFolderUseCase.js:43`) | T01 gains note about internal refresh refetches (:68, :99) |
| **T11 × test suite** | **Conflict** — `websitePreviewUrl` is imported directly by `deck-view.test.mjs:94` and `presentation-helpers.test.mjs:12`; deleting the export breaks `npm test` | T11 amended: keep the null-returning export |
| **T11 × ProfileDialogView** | **Dead code found** — constructed (BookmarkDeckView.js:299), zero call sites anywhere | Moved from T14's candidate list into T11's deletions |

> **Line-number drift caveat:** every `file:line` reference in these tickets reflects the
> tree at planning time. Each merged PR shifts references for all later PRs in the same
> file — treat line numbers as search anchors and re-grep before implementing.

---

## Shared regression gate (run for EVERY ticket)

`npm test` green, then the manual matrix:

- Cold load (first-run profile AND existing profile)
- Search / filter / tags combinations
- Collections CRUD (+ drag onto collection rows)
- Workspace create / rename / switch / delete + orphan-cleanup behavior
- Folder create / rename / delete
- Full drag matrix (T07 scope especially)
- Context menus on every element type
- Quickie popup save
- Shortcuts grid CRUD + reorder
- Settings save + theme switch + custom CSS
- Cross-tab propagation (two new-tab pages)
- Two-device sync (workspace created on A appears live on B; deletion propagates)
- Auto-backup file updates within 60 s while tab visible
- Export → import round-trip

## Cross-cutting risks

- **Two-device sync is freshly rebuilt** (`crossDeviceSync.js`, tombstones, echo guards).
  Tickets touching storage/listener wiring (T02, T04, T05) must not disturb
  `container.js` sync-listener ordering — review those diffs against
  `test/cross-device-sync.test.mjs` specifically.
- **No linter, typecheck, or CI exists** — every guarantee is `node --test` plus the
  manual matrix; small PRs are the only safety net.
- **One file dominates:** BookmarkDeckView.js (3,251 lines). Rebase discipline matters
  more than usual.
- **Behavioral changes to flag in CHANGELOG:** compact backup JSON format (T05);
  up-to-200 ms event-coalescing latency (T02); reconcile catch-up window becomes
  alarm-driven when no page is open (T04); Ctrl+F cannot find cards below the rendered
  window — in-page search is the finder (T13); first-open of dialogs/settings pays a
  one-time parse cost (T14).

## Open questions

1. **Fonts (T10):** unlink CSS only, or delete the woff2 files outright? (Unlink is
   reversible; the `--font-header` blocker is RESOLVED — see T10.)
2. **OmniSearchIndex (T09):** Option A (keep class, stop calling) or Option B
   (delete file + tests)?
3. **Ship strategy:** fourteen separate PRs as sequenced above, or batch Phase 1
   (T11 + T02 + T01) into one PR given they all touch BookmarkDeckView.js?
4. **T13 strategy:** chunked incremental mount (recommended v1) vs true windowing with
   spacer rows? Decide after measuring chunked memory on a 2,000-bookmark profile.
5. **T12 budgets:** warn-only in `--assert` mode, or hard-fail? (No CI exists, so this is
   a local gate either way.)

---

## Appendix A — Report cross-check matrix

External performance-techniques report mapped against verified codebase state.
"Done ✓" = already present in source; "Covered" = ticketed before this appendix;
"New ticket" = gap introduced by this analysis; "N/A" = not applicable to a
packaged MV3 extension.

| Report technique | Syncly status | Action |
|---|---|---|
| Code splitting / route-based lazy loading | Partial — static ESM graph parses ~60 KB of dialog/settings modules every new tab | New ticket → **PERF-T14** |
| Tree shaking / dead-code removal | No bundler, but same outcome via deletion of unmounted modules | Covered — T10, T11 |
| Bundle analyzer tooling | N/A (no bundler); module sizes audited by file listing | — |
| Image lazy loading (`loading="lazy"`) | Done ✓ — favicon `<img>`s use it (:1614, :3077) | — |
| Component lazy loading | Construction deferred via lazy getters | Covered — PERF-T08 |
| Critical CSS inline for first paint | Done ✓ — inline style block in newTab.html:11-15 | — |
| Async non-critical CSS | N/A — packaged assets load from disk, zero network round trips | — |
| Multi-level caching | Partial — repo in-memory caches (`BaseChromeListRepository`), Chrome's native favicon cache; full tree still refetched per reload | Reduced by T01/T02; tree-snapshot diffing listed under follow-ups |
| DB query/index optimization · connection pooling · GraphQL vs REST | N/A — chrome.* APIs only, no server, no SQL | — |
| CDN + cache headers + HTTP caching | N/A — assets ship inside the extension package | — |
| Modern image formats (WebP/AVIF pipeline) | Done ✓ where applicable — user uploads resized to webp data URLs | — |
| Core Web Vitals monitoring | **Missing entirely** — zero instrumentation (verified) | New ticket → **PERF-T12** |
| Real User Monitoring (RUM) | Deliberately absent (privacy-first extension); local-only harness is the compatible substitute | PERF-T12 |
| Lighthouse CI / performance budgets | No CI exists at all; local budget assertions proposed | PERF-T12 |
| Service-worker asset caching (PWA) | N/A — no remote assets; fonts are self-hosted | — |
| Mobile hints (`will-change`, translateZ) | Desktop-only Chrome extension; skipped deliberately (indiscriminate will-change is an anti-pattern) | — |
| Debounced / batched DOM updates (page-builder case study) | Covered — debounce search, coalesced loads, DocumentFragment batching already used (:2339-2343) | PERF-T02, PERF-T03 |
| Virtual scrolling for large lists | **Missing** — pool rendered in full regardless of size | New ticket → **PERF-T13** |
| Resource hints (preload/preconnect/prefetch) | Missing font preloads; preconnect N/A (no third-party origins) | Folded into PERF-T10 |
| Performance budgets as culture | Manual baseline protocol existed; now automated and enforceable locally | PERF-T12 |

### Follow-up candidates (identified, deliberately NOT ticketed)

- **Tree-snapshot diffing:** reuse the last `getTree()` result across `_load()` calls,
  invalidated by bookmark events, instead of refetching after T01's single fetch — only if
  profiling still shows IPC cost on very large libraries.
- **`transition: all` audit:** many newTab.css rules transition *all* properties
  (e.g. `.source-seg-btn`, density controls), forcing broad style recalcs; narrowing to
  explicit properties (color/background/border/transform) reduces animation cost.
- **Background image pipeline check:** confirm upload resize target still caps data-URL
  size reasonably on the current settings code path.
