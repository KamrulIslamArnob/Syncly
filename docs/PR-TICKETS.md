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
| [PERF-T01](#perf-t01--single-bookmark-tree-fetch-per-reload) | Single bookmark-tree fetch per reload | 1 | P0 | Low-Med | ~50 lines, 3 files |
| [PERF-T02](#perf-t02--coalesced-reload-scheduler) | Coalesced reload scheduler | 1 | P0 | Med | ~30 lines, 1 file |
| [PERF-T03](#perf-t03--debounced-search--filter-in-place) | Debounced search + filter-in-place | 1 | P0 | Med-High | ~100 lines net, 1 file |
| [PERF-T04](#perf-t04--reconcile-polling-moves-to-service-worker) | Reconcile polling moves to service worker | 2 | P1 | Low | −10 lines, 1-2 files |
| [PERF-T05](#perf-t05--auto-backup-loop-efficiency) | Auto-backup loop efficiency | 2 | P1 | Low | ~25 lines, 2 files |
| [PERF-T06](#perf-t06--clock-cached-formatters--hidden-tab-pause) | Clock: cached formatters + hidden-tab pause | 2 | P1 | Low-Med | ~50 lines, 1 file |
| [PERF-T07](#perf-t07--event-delegation-on-grids) | Event delegation on grids | 3 | P2 | High | ~200-line delta, 1 file |
| [PERF-T08](#perf-t08--lazy-dialog-construction) | Lazy dialog construction | 3 | P2 | Low | ~40 lines, 1 file |
| [PERF-T09](#perf-t09--stop-per-load-omnisearchindex-rebuilds) | Stop per-load OmniSearchIndex rebuilds | 3 | P2 | Trivial | ~10 lines, 1 file |
| [PERF-T10](#perf-t10--cssfont-diet) | CSS/font diet | 3 | P2 | Low | ~6 lines + assets |
| [PERF-T11](#perf-t11--delete-dead-preview-machinery) | Delete dead preview machinery | 3 | P2 | Trivial | −120 lines, 1-2 files |
| [PERF-T12](#perf-t12--performance-instrumentation--budgets) | Performance instrumentation & budgets | 4 | P1 | Low | ~60 lines, 2-3 files |
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

## PERF-T01 — Single bookmark-tree fetch per reload

**Phase 1 · P0**

**Goal.** `_load()` triggers `chrome.bookmarks.getTree()` **three times** — once in the
deck itself (`BookmarkDeckView.js:442`) plus one internal fetch inside each ensure use case
(`EnsureQuickieFolderUseCase.js:43`, `EnsureShortcutsFolderUseCase.js:50`). Each call
serializes the whole tree through IPC. Hoist a single fetch and share it.

**Files changed**

| File | Change |
|---|---|
| `src/application/useCases/bookmarks/EnsureQuickieFolderUseCase.js` | `execute({ tree } = {})` — accept pre-fetched tree; skip internal `getTree()` when provided (:43) |
| `src/application/useCases/bookmarks/EnsureShortcutsFolderUseCase.js` | Same pattern (:50) |
| `src/presentation/newTab/views/BookmarkDeckView.js` | `_load()` passes its fetched tree into both calls (:443-444); refresh tree after any folder create/move inside ensure |

**Blast radius (verified callers)**
- `popupController.js:536,613` and `BookmarkPickerModalView.js:396` also call
  `ensureQuickieFolder.execute()` **with no args** → the optional param keeps them compiling;
  they keep their own internal `getTree()` (fine — popup is ephemeral, picker is rare).
  Do not force-migrate these call sites in this PR.
- Constructor signatures unchanged → `container.js:179-180` untouched.
- No test constructs these use cases directly.

**What could go wrong**
- *Stale-tree contract violation:* if the passed tree predates an external folder mutation,
  dedupe/migration logic (`_findAllByTitle`, `_migrateLooseBookmarks`) acts on stale data →
  duplicate "Quickie" folders or re-moved bookmarks. Mitigation: document "tree must be
  same-tick"; deck already re-fetches after ensure creates anything.
- *Return-shape drift:* deck consumes the returned `quickieFolderId` (BookmarkDeckView.js:459)
  — keep the return value identical.
- *Empty-tree fallback:* `execute()` receiving `tree = []` must preserve today's
  parent-fallback `"2"` behavior.

**Keep in mind:** fresh-profile first run (folder creation path), duplicate-Quickie dedupe
path, popup Save-to-Quickie, two-device sync where Chrome creates the folder natively.

---

## PERF-T02 — Coalesced reload scheduler

**Phase 1 · P0**

**Goal.** One mutation can trigger `_load()` from three independent sources: the EventBus
(via `container.js` storage listeners), the debounced `chrome.bookmarks.on*` handler
(`BookmarkDeckView.js:3210-3213`), and dialog `onSave` callbacks. Each source re-renders
sidebar + header + content independently. Collapse into ONE trailing-edge scheduler (~200 ms).

**Files changed**

| File | Change |
|---|---|
| `BookmarkDeckView.js` | Add `_scheduleLoad()` returning the coalesced promise; convert ~20 `this._load()` call sites (group select :293, all dialog `onSuccess`s, bulk actions :2797/:2849/:2962/:2989, bookmark-event handler :3212) |

**Blast radius**
- Only BookmarkDeckView internals — every external entry point already funnels through it.
- `newTabController.refreshSettings` is a separate path — untouched.

**What could go wrong**
- *Broken await sequencing:* several flows do `await this._load()` then toast/clear state.
  If scheduling is fire-and-forget, UI clears selection before the reload lands.
  Mitigation: `_scheduleLoad()` **returns** the shared promise; awaited semantics preserved.
- *Self-triggered loop:* `_load()` runs ensure use cases which may write storage → onChanged
  → schedule again. Today this terminates because the second pass is a no-op; coalescing
  makes it strictly safer, but add an in-flight guard anyway.
- *Perceived latency:* worst case +200 ms before a change appears. Acceptable for background
  events; user-initiated actions may use leading-edge execution if it feels laggy.

**Keep in mind:** spam-deleting bookmarks, rapid workspace switching, drag-reorder bursts,
cross-tab edit while typing in search (interplay with T03).

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

**What could go wrong**
- Hidden-but-alive cards retain stale listeners until T07 lands — harmless; note in review.
- View-mode/theme/density switches are structural → must bypass the fast path and rebuild.
- Focus-mode hero input ↔ header input sync: the fast path removes the rebuild that forced
  the sync hack; verify both inputs stay value-synced when switching layouts mid-query.

**Keep in mind:** type rapidly over a large library (Performance panel: frames <16 ms),
clear-query restores all, `#tag` + query combo, Escape-clears-query path (:3163-3173),
Enter-to-Google (:1268-1274).

---

## PERF-T04 — Reconcile polling moves to service worker

**Phase 2 · P1**

**Goal.** Pages run a 30 s reconcile interval AND re-schedule reconcile after **every**
local write (`container.js:168-175`) — N open tabs = N× redundant `JSON.stringify` churn
over all synced data. The service worker already owns push-based delivery
(`serviceWorker.js:178-207`: top-level sync listener, `onStartup`, `onInstalled`,
15-minute alarm). Pages should keep only instant event-driven paths.

**Files changed**

| File | Change |
|---|---|
| `container.js` | Delete `startAutoReconcile(30000)` call and the post-write `setTimeout(reconcile)` listener (:168-175) |
| `GoogleSyncService.js` | Optionally remove now-unused `startAutoReconcile` method (verified: no tests reference it) |

**Blast radius**
- Manual Sync buttons in SettingsSidebarView call `pushAll()` / `syncFromGoogleCloud`
  directly — untouched.
- Page-level instant apply stays via the `area === "sync"` merge listener
  (`container.js:124-148`).

**What could go wrong**
- *Catch-up gap while browser open, no Syncly page open, Chrome was offline during a push:*
  previously a page's 30 s poll covered it; now only the 15-min alarm does. This is exactly
  the alarm's documented purpose — acceptable; bump alarm to 5 min if users report staleness.
- *Cross-context echo:* a **page** manual push echoes back as a `sync` onChanged event; the
  SW's own `GoogleSyncService` instance has no record of it → `isOwnEcho()` false → SW runs
  `applyRemoteChanges` → values identical → JSON-compare no-op → no local write, no loop.
  Verify this no-op path stays cheap (one stringify per key at manual-push frequency — fine).
- *Cold-start double hydration:* `autoHydrateIfNeeded()` runs in the page container AND in
  SW `onStartup`/`onInstalled`. Both compute merges deterministically (canonical sort in
  `crossDeviceSync.js`) → benign duplicate write at worst. Don't "fix" by removing one side
  without testing fresh-profile boot.

**Keep in mind:** two-device live propagation still instant (push path), offline→online
convergence ≤ alarm window, manual Sync Now / Push / Pull buttons, `npm test` (three
GoogleSyncService test files construct the class directly — none touch the interval method).

---

## PERF-T05 — Auto-backup loop efficiency

**Phase 2 · P1**

**Goal.** Every visible tab reads the ENTIRE local storage DB, pretty-prints it, and hashes
it — every minute (`newTabController.js:267`, `AutoBackupService.js:166-169`).

**Files changed**

| File | Change |
|---|---|
| `AutoBackupService.js` | `performBackupIfChanged()`: `chrome.storage.local.get(BACKUP_ALLOWLIST)` (import the const from `backupAllowlist.js`) instead of `get(null)`; drop `, null, 2` pretty-print. Apply same treatment to `performBackup()` (:136) |
| `newTabController.js` | Gate the 60 s run on `document.visibilityState`; run-once on `visibilitychange→visible`; clean up listener in `destroy()` (:327-334) |

**What could go wrong**
- *Allowlist drift:* `get(ALLOWLIST)` must stay equivalent to `get(null)+filterBackupData`
  — always import the shared const, never re-declare keys (`backupAllowlist.js` is the
  declared single source of truth).
- *Backup format change:* compact JSON is harder to eyeball-diff;
  `validateImportData(JSON.parse(...))` is format-agnostic → imports safe. Call out the
  format change in CHANGELOG.
- *Multi-tab race:* two visible tabs hash/write concurrently — same-content writes, last
  wins, benign. Do NOT add leader election in v1 (complexity > payoff).
- *Listener leak:* the new visibilitychange subscription must be removed in controller
  `destroy()` or reloaded pages accumulate handlers.

**Keep in mind:** Resume-Auto-Backup permission button flow, settings Status readout
(`getStatus()`), export/import round-trip, backup file mtime updates within 60 s of a change
while tab visible, zero disk writes while minimized.

---

## PERF-T06 — Clock: cached formatters + hidden-tab pause

**Phase 2 · P1**

**Goal.** `CombinedClockView` constructs two `Intl.DateTimeFormat` objects EVERY second,
forever, even when the tab is hidden (`CombinedClockView.js:19-33`, interval at :133).
Formatter construction is known-expensive; this is pure waste.

**Files changed**

| File | Change |
|---|---|
| `CombinedClockView.js` | Module-level `Map` cache keyed by `timeZone|hour12|seconds`; interval paused on `visibilitychange`; when `showSeconds !== true`, chained `setTimeout` aligned to next minute instead of fixed 1 s |

**Blast radius**
- `PomodoroService` owns its **own** 1 s interval and drives `_updateText` via `onTick`
  when `mode === "pomodoro"` (:134, :161-165) — pausing the clock interval must NOT freeze
  the pomodoro countdown. Verified independent; add explicit manual test step anyway.
- `destroy()` (:178) must clear the visibility listener too.

**What could go wrong**
- Formatter reuse across dates is Intl-contract-safe (DST recomputes per `.format(date)`
  call); the cache key space is tiny — no growth concern.
- Minute-aligned timers drift after OS sleep → recompute alignment on every
  visibility-restore tick.
- **No unit tests exist** for CombinedClockView/PomodoroService — pure manual QA ticket.

**Keep in mind:** seconds toggle, 12 h/24 h switch, world-city change via settings,
backgrounded 10 min → correct time on return, pomodoro presets/start/pause/reset,
clock-click mode toggle.

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
`ProfileDialogView` / `GroupProfileButtonsView`: leave eager unless proven unused early.

**Keep in mind:** every dialog opens/closes repeatedly; shortcuts-folder id flows into
category/shortcut dialogs correctly after folder creation post-load.

---

## PERF-T09 — Stop per-load OmniSearchIndex rebuilds

**Phase 3 · P2**

**Goal.** `OmniSearchIndex.index()` tokenizes the entire library on every `_load()`
(:604-609) yet search NEVER uses it — `_getActivePool()` filters with plain
`.includes()` over title/url (:1495-1498). The index's only consumer is
`getCategoryName(item)` for shortcut-tile category chips (:1653).

**Options (pick in review):**
- **A (recommended):** replace the `getCategoryName` usage with a direct lookup over
  `this._categories` (few categories); leave `index()` uncalled. The class and both test
  files (`test/omni-search-index.test.mjs`, `presentation-helpers.test.mjs` import the
  class directly) stay green untouched.
- **B:** delete `src/domain/services/OmniSearchIndex.js` + both test files entirely.

**Risk:** Option A is near-zero (a broken category chip is visually obvious). B loses
future search infrastructure.

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

## PERF-T11 — Delete dead preview machinery

**Phase 3 · P2 · FIRST (shrinks T03/T07 diffs)**

**Verified:** `websitePreviewUrl()` hard-returns `null` (favicon.js:87-92); its sole
importer is BookmarkDeckView.js:3. Therefore `previewUrl` is always null → PreviewQueue,
both bounded caches, the IntersectionObserver, and pending-cover logic are unreachable code.

**Delete:** PreviewQueue class + caches + `addBoundedCache` (:57-135), observer creation
(:2563-2588), observe blocks (:2346-2351, :2630-2636), pending-preview cover logic
(:2902-2905), collapsed `previewsEnabled` branches (:2318, :2570, :2871-2872), import.

**Explicitly KEEP:** `UserSettings.showWebsitePreviews` field (entity round-trip :494/:558),
save-allowlist entry (`SaveUserSettingsUseCase.js:34`), settings toggle
(SettingsSidebarView.js:51/:340/:346), and the settings-compare in the deck (:388).
Deleting the *setting* touches entity serialization + sanitizer allowlist + UI for zero
performance gain. Optional cosmetic follow-up: hide the inert toggle.

---

## PERF-T12 — Performance instrumentation & budgets

**Phase 4 · P1 · Land FIRST — it is the measuring stick for every other ticket**

**Goal.** The codebase has ZERO performance instrumentation (verified: no
`performance.mark`, no `PerformanceObserver`, no `requestIdleCallback` anywhere in
`src/`). Every ticket above currently relies on the manual baseline protocol. This adds a
dev-only harness that automates it. **Privacy-first: nothing ships, nothing uploads —
console output and a local JSON report only.**

**Files changed**

| File | Change |
|---|---|
| `src/presentation/newTab/newTabController.js` | `performance.mark`/`measure` spans around init → first render (`syncly:first-render`) and `_load()` duration; gated behind `?perf` URL param or a dev-only localStorage flag so zero overhead in normal use |
| `scripts/perf-baseline.mjs` (NEW) | puppeteer-core harness (same pattern as `scripts/smoke.mjs`, but written fresh — smoke's selectors are documented stale): opens a new tab with N synthetic bookmarks, collects navigation timing, first-render measure, heap usage via CDP `Performance.getMetrics`; writes JSON; `--assert` mode fails against budgets |
| `package.json` | `"perf": "node scripts/perf-baseline.mjs"` script |

**Suggested budgets (finalize after first real run):** first-render < 500 ms ·
`_load()` < 150 ms at 500 bookmarks · DOM nodes bounded by T13's cap · heap per tab <
target from Task Manager baseline.

**What could go wrong**
- *Overhead leakage:* marks left enabled in normal browsing add trivial-but-nonzero cost.
  Keep strictly flag-gated.
- *Machine-dependent absolutes:* timings differ across hardware — budgets are for
  before/after deltas on the SAME machine, not absolute gates.
- *puppeteer-core needs a Chrome executable path* (env var), same constraint smoke.mjs has;
  document it in the script header.

**Keep in mind:** run `npm run perf` immediately after this lands to replace the manual
baseline numbers, then once per subsequent ticket.

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
BookmarkTagsDialogView · ProfileDialogView · SettingsSidebarView chain
(backupAllowlist + cssSanitizer + colorUtils ride along).
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
