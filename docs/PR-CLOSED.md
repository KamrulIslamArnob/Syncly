# Closed PR Tickets

> Completed tickets moved out of `PR-TICKETS.md`. Newest at top.

---

## ✅ PERF-T05 — Auto-backup loop efficiency  [CLOSED · Phase 2 · P1]

**Original goal.** Every visible tab read the ENTIRE local storage DB, pretty-printed it,
and hashed it every minute.

### What was done

- `AutoBackupService.js` (`performBackup()` + `performBackupIfChanged()`):
  - `chrome.storage.local.get(BACKUP_ALLOWLIST)` (imported shared const — single source
    of truth) instead of `get(null)`; `filterBackupData()` kept as defense-in-depth
  - compact JSON (dropped `, null, 2`) → cheaper stringify + hash; format change noted
    for CHANGELOG (`validateImportData` is format-agnostic, imports safe)
- `newTabController.js` `triggerAutoBackup()`:
  - interval ticks no-op while `document.visibilityState === "hidden"`
  - immediate catch-up run on `visibilitychange → visible`
  - listener removed in `destroy()` (no handler accumulation across reloads)

### Verification

- `npm test`: **247/247 pass**
- Reference sweep: no `get(null)` / pretty-print remains in AutoBackupService
- ESM syntax check (controller auto-runs at import; validated via SourceTextModule)
- Live end-to-end: `npm run perf -- --assert` passes after changes (BUDGETS OK)

---

## ✅ PERF-T06 — Clock: cached formatters + hidden-tab pause  [CLOSED · Phase 2 · P1]

**Original goal.** `CombinedClockView` constructed two `Intl.DateTimeFormat` objects
every second, forever, even when hidden — known-expensive pure waste.

### What was done (`CombinedClockView.js`)

- Module-level `Map` formatter cache keyed by `timeZone|hour12|seconds`; invalid-timezone
  fallback handled inside the factory so failures are also cached.
- Tick scheduler split into `_startTicking()`/`_stopTicking()`:
  - seconds ON → fixed 1 s interval (as before)
  - seconds OFF → chained `setTimeout` aligned to next minute boundary; alignment is
    recomputed on every wake so OS-sleep drift self-heals
  - ticking fully paused while `document.visibilityState === "hidden"`; immediate repaint
    + realign on return
- `visibilitychange` listener registered once in `render()`, removed in `destroy()`;
  re-render early-return path refreshes cadence (showSeconds toggle).
- **Pomodoro independence preserved**: countdown display is driven by `PomodoroService.onTick`
  (its own interval), never by the clock timer — pausing the clock cannot freeze it.

### Verification

- `npm test`: **247/247 pass**
- Module parse check: CombinedClockView + PomodoroService import cleanly
- Manual QA matrix (per ticket: no unit tests exist for this view): seconds toggle,
  12h/24h switch, world-city change, backgrounded tab → correct time on return,
  pomodoro start/pause/reset during clock-pause window

---

## ✅ PERF-T04 — Reconcile polling moves to service worker  [CLOSED · Phase 2 · P1]

**Original goal.** Pages ran a 30 s reconcile interval AND re-scheduled reconcile after
every local write — N open tabs = N× redundant JSON churn over all synced data. The
service worker already owns push-based delivery.

### What was done

- `container.js`: deleted the `startAutoReconcile(30000)` call and the post-write
  `setTimeout(reconcile)` storage listener. The hydrate chain
  (`adoptNativeWorkspaceFolders.execute()`) untouched.
- `GoogleSyncService.js`: removed the now-unused `startAutoReconcile()` method
  (grep-verified zero references across src/test/docs).
- Page-level instant apply preserved via the existing `area === "sync"` merge listener;
  manual Sync Now / Push / Pull buttons untouched.
- Catch-up convergence now owned by the SW: top-level sync listener (instant),
  `runtime.onStartup`, and the 15-minute reconcile alarm.

### Verification

- `npm test`: **247/247 pass** (three GoogleSyncService test files construct the class
  directly — none touched the interval method)
- Module parse check: container.js + serviceWorker.js import cleanly
- Cross-context echo safety re-checked: a page manual push echoing back through the SW's
  `applyRemoteChanges` is a deterministic JSON-compare no-op → no loop

---

## ✅ PERF-T12 — Performance instrumentation & budgets  [CLOSED · Phase 4 · P1]

> Landed right after T01 per merge order — it is the measuring stick for every remaining ticket.

**Original goal.** Zero performance instrumentation existed; every ticket relied on the
manual baseline protocol. Adds a dev-only, privacy-first harness (nothing ships/uploads).

### What was done

- `newTabController.js`: opt-in instrumentation gated behind `?perf` URL param or
  `localStorage["syncly-perf"]="1"` — zero overhead otherwise:
  - `performance.mark("syncly:init-start")` at init
  - `syncly:first-render` measure after first `render()` completes
  - deck `_load()` wrapped with a duration probe → `window.__synclyPerf.loads`
- **NEW** `scripts/perf-baseline.mjs` — puppeteer-core harness (HTTP-server + chrome-shim
  pattern from smoke.mjs): N synthetic bookmarks (`--n`, default 300), collects
  first-render measure, `_load()` avg/max, navigation timing, long-task count, DOM node
  count, CDP heap metrics; writes JSON report; `--assert` mode fails against budgets
  (first-render < 500 ms · `_load()` < 150 ms).
- `package.json`: `"perf": "node scripts/perf-baseline.mjs"`

### Verification (live Chrome runs)

```
npm run perf -- --n 500 --assert
first render        : 12.2 ms   budget 500 ms
deck _load avg/max  : 27.7 / 27.7 ms   budget 150 ms
dom nodes: 443 · long tasks: 1 · heap used/total: 4.46 / 9.25 MB
BUDGETS OK   (+ perf-report.json / perf-report-500.json written)
```

- `npm test`: **247/247 pass**

---

## ✅ PERF-T01 — Single bookmark-tree fetch per reload  [CLOSED · Phase 1 · P0]

**Original goal.** `_load()` triggered `chrome.bookmarks.getTree()` three times per
reload (deck + one internal fetch inside each ensure use case), serializing the whole
tree through IPC three times.

### What was done

- `EnsureQuickieFolderUseCase.execute({ tree } = {})` — accepts a pre-fetched tree;
  skips its internal `getTree()` when one is provided. Empty-array contract preserved
  (parent lookup falls back to `"2"`). Internal refresh refetches after folder-create /
  dedupe kept (rare paths only).
- `EnsureShortcutsFolderUseCase` — same pattern.
- `BookmarkDeckView._load()`: fetches the tree ONCE up front, passes `{ tree: raw }`
  to both ensure calls; remaining parallel reads unchanged. Return values identical
  (`quickieFolderId` / `shortcutsFolderId` consumed exactly as before).
- Popup (`popupController.js`) and `BookmarkPickerModalView.js` no-arg call sites
  deliberately NOT migrated (ephemeral contexts) — verified intact (3 sites).

### Stale-tree safety

The shared tree is same-tick fresh by construction (fetched immediately before the
ensure calls). If an ensure mutates folders, it still refetches internally before its
dedupe/migration steps, matching pre-T01 behavior.

### Verification

- `npm test`: **247/247 pass**
- No-arg backward compatibility confirmed via default parameter

---

## ✅ PERF-T02 — Coalesced reload scheduler  [CLOSED · Phase 1 · P0]

**Original goal.** One mutation triggered `_load()` from up to three independent sources
(EventBus storage listeners, debounced `chrome.bookmarks.on*` handler, dialog callbacks),
each re-rendering sidebar + header + content independently.

### What was done (all in `BookmarkDeckView.js`)

- Added `_scheduleLoad(delayMs = 200)` — trailing-edge coalescing scheduler that:
  - collapses all callers in a window into ONE `_load()`
  - **returns the shared promise** → every former `await this._load()` site keeps its
    sequencing semantics (toast/clear-state after data lands)
  - clears its pending refs *before* running `_load()`, so writes emitted during a load
    can schedule a follow-up pass (self-trigger loop protection)
- Converted **35 call sites** (`this._load()` → `this._scheduleLoad()`): group select,
  all dialog `onSave`/`onSuccess`/`onDelete`, bulk actions, EventBus subscriptions
- Initial mount call left immediate (`this._load()` right after `_bindBookmarkEvents()`)
- `_bindBookmarkEvents`: removed the old ad-hoc 150 ms `setTimeout` debounce — native
  bookmark-event bursts now flow through the same scheduler
- `destroy()`: clears the pending timer/promise refs

### Verification

- `npm test`: **247/247 pass**
- Reference sweep: exactly one non-scheduler `this._load()` call remains (initial mount)

---

## ✅ PERF-T11 — Delete dead preview machinery  [CLOSED · Phase 3 · P2]

> Landed FIRST per merge order (shrinks later T03/T07 diffs). Executed before T02/T01
> because pure deletions reduce the surface those tickets would otherwise preserve.

**Original goal.** `websitePreviewUrl()` hard-returns `null` (`favicon.js`), so the entire
screenshot-preview pipeline was unreachable code.

### What was done

| Deletion | Location (pre-change) |
|---|---|
| `websitePreviewUrl` removed from deck import | `BookmarkDeckView.js:3` |
| `ProfileDialogView` import removed | `BookmarkDeckView.js:14` |
| `MAX_CACHE_SIZE`, `previewSuccessCache`, `previewFailedCache`, `addBoundedCache()` | `:56-67` |
| `PreviewQueue` class + `previewQueue` singleton | `:69-135` |
| `this._previewObserver = null` init | `:273` |
| `this.profileDialog = new ProfileDialogView(...)` | `:299` |
| Omni-search render path: observer disconnect/reset, `previewsEnabled`, IntersectionObserver creation | `:2311-2336` |
| Omni-search render path: post-mount observe block | `:2346-2351` |
| Main pool render path: same observer block | `:2563-2588` |
| Main pool render path: post-mount observe block | `:2630-2636` |
| `_renderCard`: `isGridView`/`previewsEnabled`/`previewUrl` locals | `:2870-2872` |
| `_renderCard`: pending-preview cover logic | `:2902-2905` |
| **File deleted:** `src/presentation/newTab/views/ProfileDialogView.js` (8.6 KB) | — |

Verified dead before deleting: grep across `src/` + `test/` showed zero call sites for
`profileDialog` / `PreviewDialogView` beyond the import+construction pair.

### Explicitly KEPT (per ticket)

- `UserSettings.showWebsitePreviews` field + entity round-trip
- `SaveUserSettingsUseCase.js` save-allowlist entry
- Settings toggle UI (`SettingsSidebarView.js`) — inert but harmless
- Deck settings-compare branch (`nameChanged || previewsChanged`)
- `websitePreviewUrl()` export in `favicon.js` — imported directly by
  `test/deck-view.test.mjs` and `test/presentation-helpers.test.mjs`; removing it breaks `npm test`

### Verification

- `npm test`: **247/247 pass**
- Module parse check: `BookmarkDeckView.js` imports cleanly under stubbed `chrome`
- Reference sweep: no remaining `PreviewQueue|previewQueue|_previewObserver|previewsEnabled|
  websitePreviewUrl|ProfileDialogView|profileDialog` anywhere in `src/` except the kept
  favicon.js export
