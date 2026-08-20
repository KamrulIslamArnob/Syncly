# NothingTab UI Redesign Completion & Regression Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the migration of the NothingTab Chrome extension UI to the `src/ui_kits-app-index.html` reference design while restoring every feature the previous partial redesign broke (search, pomodoro, clock settings, drag-and-drop reliability, bundled favicons, theme presets) and guaranteeing old JSON backups still import.

**Architecture:** Clean Architecture / DDD (Domain → Application → Infrastructure → Presentation) wired by `src/infrastructure/di/container.js`. All fixes are presentation-layer plus one domain-resilience change (`Bookmark.fromJSON` must never throw on legacy data). The reference HTML at `src/ui_kits-app-index.html` is the single source of truth for visual language; its token CSS is already ported to `src/presentation/shared/styles/tokens.css`.

**Tech Stack:** Vanilla JS ES modules, Chrome MV3, `chrome.storage.local`, no framework. Tests: `node --test` (zero deps) for domain gates; `puppeteer-core` (devDependency) driving real Chrome for the end-to-end smoke gate.

## Global Constraints

- **Never change stored data shapes.** Storage keys stay exactly: `bookmarks`, `categories`, `settings`, `tasks`, `layout`. All `toJSON()` output shapes stay backward compatible.
- **Old backups must import.** A JSON exported by any previous version, written raw via `chrome.storage.local.set(data)`, must load without throwing anywhere in `fromJSON` paths.
- **Do not rewrite working use cases or repositories.** Presentation-layer changes only, except the `Bookmark.fromJSON` resilience fix in Task 2.
- **MV3 CSP:** no inline `<script>`, no `eval`, no external JS. `manifest.json` CSP stays as is.
- **Every referenced asset file must exist** (Chrome-extensions skill rule: no dangling icon/favicon paths).
- **Design truth:** `src/ui_kits-app-index.html`. Reuse its exact class names and CSS patterns (`.overlay`, `.dialog`, `.field`, `.btn`, `.btn-primary`, `.tile`, `.tile-row`, `.clock-card`, etc.) which already exist in `src/presentation/newTab/newTab.css`.
- Windows environment; shell commands below are Git Bash (POSIX). Chrome path: `C:\Program Files\Google\Chrome\Application\chrome.exe`.
- Commit after every task with the trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Regression Inventory (diagnosed, verified against git diff HEAD)

1. **Search is dead.** `SearchView` emits `search:submit`/`search:input` on the EventBus; nothing subscribes. Engine selection (`settings.searchEngine`) and `searchOpenNewTab` are ignored.
2. **Pomodoro deleted.** `CombinedClockView` no longer imports `PomodoroService` (file still exists). Tap-clock-to-pomodoro is a headline README feature.
3. **Clock ignores settings.** Always 12h with seconds; `settings.timeFormat` (24h) and `settings.showSeconds` ignored. World row hard-codes Barcelona; `settings.clocks` (editable in options) ignored.
4. **Drag-and-drop handler accumulation.** `BookmarksView.setupDragAndDropEvents()` adds `document`-level dragover/dragleave/drop listeners on every render → N stacked handlers → duplicate reorder/move operations.
5. **Bundled favicons missing.** `BUNDLED_FAVICONS` references 10 files under `public/favicons/` that do not exist.
6. **Legacy-favicon import fragility.** `Bookmark.#normalizeFaviconUrl` throws inside `fromJSON` → one bad `faviconUrl` value in an imported backup kills `listBookmarks` for the whole page.
7. **Theme presets dead.** Options page saves `themePreset` (minimal/nord/cyberpunk/sage) but nothing applies it anymore (`data-theme` now means dark/light).
8. **CSS gaps.** No styles for `.drop-target-*`, `.is-dragging`, `.pomo-*`, `.widgets-row`, `.resume-backup-btn`, `.fatal-error-*`.
9. **Dead code/junk.** `restoreCachedState` resets to `this.constructor.prototype.state` (undefined); sidebar draft key `showCalendar` is saved nowhere (no entity field); repo root junk files `fix.js`, `fix_css.js`, `fix_ref_error.js`, `old_newTab.css`, `base64.txt`, `~/`.
10. **Fonts from Google CDN.** New-tab/options/popup pages load fonts from fonts.googleapis.com — flashes/breaks offline. Production extension should bundle fonts.
11. **Duplicate ⌘K binding.** Both `SearchView` and `newTabController.bindGlobalKeys` bind Cmd/Ctrl+K.

---

### Task 1: Repo hygiene + bundle fonts locally

**Files:**
- Delete: `fix.js`, `fix_css.js`, `fix_ref_error.js`, `old_newTab.css`, `base64.txt`, `~/` (junk dir with empty `.cache`)
- Create: `public/fonts/` (6 woff2 files), `public/fonts/fonts.css`
- Modify: `src/presentation/newTab/newTab.html`, `src/presentation/options/options.html`, `src/presentation/popup/popup.html`

**Interfaces:**
- Produces: `public/fonts/fonts.css` defining `@font-face` for families `"Doto"` (400;600), `"Space Grotesk"` (400;500;600 via variable file), `"Space Mono"` (400;700). Later tasks assume the CSS custom properties `--font-display`, `--font-body`, `--font-mono` (already in tokens.css) resolve to these local families.

- [ ] **Step 1: Delete junk files**

```bash
git rm --cached -r -q -- 2>/dev/null; rm -f fix.js fix_css.js fix_ref_error.js old_newTab.css base64.txt
rm -rf "./~"
```
(They are untracked; plain `rm` suffices. Verify `git status` no longer lists them.)

- [ ] **Step 2: Download woff2 fonts**

Fetch the Google Fonts CSS with a Chrome UA (to get woff2 URLs), then download each file:

```bash
mkdir -p public/fonts
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
curl -s -A "$UA" "https://fonts.googleapis.com/css2?family=Doto:wght@400;600&family=Space+Grotesk:wght@400..700&family=Space+Mono:wght@400;700&display=swap" -o /tmp/gf.css
grep -oE "https://fonts.gstatic.com/[^)]+\.woff2" /tmp/gf.css | sort -u
# download each (latin subset is enough), name them:
#   doto-400.woff2 doto-600.woff2 spacegrotesk-var.woff2 spacemono-400.woff2 spacemono-700.woff2
```

Pick the **latin** subset URL for each family/weight (the block whose `unicode-range` starts `U+0000-00FF`). Write `public/fonts/fonts.css`:

```css
@font-face { font-family: "Doto"; font-style: normal; font-weight: 400; font-display: swap; src: url("doto-400.woff2") format("woff2"); }
@font-face { font-family: "Doto"; font-style: normal; font-weight: 600; font-display: swap; src: url("doto-600.woff2") format("woff2"); }
@font-face { font-family: "Space Grotesk"; font-style: normal; font-weight: 300 700; font-display: swap; src: url("spacegrotesk-var.woff2") format("woff2"); }
@font-face { font-family: "Space Mono"; font-style: normal; font-weight: 400; font-display: swap; src: url("spacemono-400.woff2") format("woff2"); }
@font-face { font-family: "Space Mono"; font-style: normal; font-weight: 700; font-display: swap; src: url("spacemono-700.woff2") format("woff2"); }
```

**If the download fails (offline/blocked): keep the CDN `<link>` tags unchanged, skip Steps 3-4, note it in the task report, and move on.** Do not block the plan on fonts.

- [ ] **Step 3: Swap CDN links for local stylesheet in all three HTML files**

In `newTab.html`, `options.html`, `popup.html` remove all `fonts.googleapis.com` / `fonts.gstatic.com` `<link>` tags and add (path relative to each HTML file):

```html
<link rel="stylesheet" href="../../../public/fonts/fonts.css" />
```
(`newTab.html` is at `src/presentation/newTab/` → `../../../public/fonts/fonts.css`; same depth for options and popup.)

- [ ] **Step 4: Verify fonts resolve**

```bash
ls -la public/fonts/   # 5 woff2 + fonts.css
grep -rn "fonts.googleapis" src/  # expect: no matches
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove junk files, bundle fonts locally for offline new-tab"
```

---

### Task 2: Backward-compat domain gate (`node --test`)

**Files:**
- Modify: `src/domain/entities/Bookmark.js` (fromJSON resilience only)
- Create: `test/backup-compat.test.mjs`

**Interfaces:**
- Consumes: `Bookmark`, `Category`, `Task`, `UserSettings`, `WidgetLayout` entities (`fromJSON`/`toJSON`).
- Produces: `npm`-free test gate run via `node --test test/`. Later tasks (smoke harness) rely on `Bookmark.fromJSON` never throwing for any string `faviconUrl`.

- [ ] **Step 1: Write the failing test**

Create `test/backup-compat.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { Bookmark } from "../src/domain/entities/Bookmark.js";
import { Category } from "../src/domain/entities/Category.js";
import { Task } from "../src/domain/entities/Task.js";
import { UserSettings } from "../src/domain/entities/UserSettings.js";

// Shape exported by the ORIGINAL extension (pre-faviconUrl era)
const OLD_BACKUP = {
  settings: {
    name: "Arnob",
    background: { kind: "local_image", value: "bg.png" },
    timeFormat: "24h",
    backgroundBlur: 4,
    backgroundOverlay: 0.35,
    clocks: [{ label: "Dhaka", timeZone: "Asia/Dhaka" }],
    searchEnabled: true,
    searchEngine: "youtube",
  },
  categories: [{ id: "c1", name: "Quick", order: 0 }],
  bookmarks: [
    { id: "b1", title: "GitHub", url: "https://github.com", categoryId: "c1", order: 0, lastAccessed: null, accessCount: 3 },
  ],
  tasks: [{ id: "t1", title: "Ship it", completed: false, order: 0 }],
};

test("old backup: settings round-trip without throwing", () => {
  const s = UserSettings.fromJSON(OLD_BACKUP.settings);
  assert.equal(s.name, "Arnob");
  assert.equal(s.timeFormat.value, "24h");
  assert.equal(s.searchEngine, "youtube");
  assert.equal(s.clocks[0].timeZone, "Asia/Dhaka");
  // round-trip keeps shape
  const again = UserSettings.fromJSON(s.toJSON());
  assert.equal(again.name, "Arnob");
});

test("old backup: bookmarks/categories/tasks round-trip", () => {
  const c = Category.fromJSON(OLD_BACKUP.categories[0]);
  assert.equal(c.name, "Quick");
  const b = Bookmark.fromJSON(OLD_BACKUP.bookmarks[0]);
  assert.equal(b.title, "GitHub");
  assert.equal(b.faviconUrl, "");
  assert.equal(b.accessCount, 3);
  const t = Task.fromJSON(OLD_BACKUP.tasks[0]);
  assert.equal(t.title, "Ship it");
});

test("bookmark with garbage faviconUrl imports as empty string, never throws", () => {
  for (const bad of ["not a url", "chrome://favicon/x", "public/favicons/ai.svg", "javascript:alert(1)", 42, { a: 1 }]) {
    const b = Bookmark.fromJSON({ ...OLD_BACKUP.bookmarks[0], faviconUrl: bad });
    assert.equal(b.faviconUrl, "");
  }
});

test("bookmark with valid faviconUrl keeps it", () => {
  const ok = Bookmark.fromJSON({ ...OLD_BACKUP.bookmarks[0], faviconUrl: "/public/favicons/ai.svg" });
  assert.equal(ok.faviconUrl, "/public/favicons/ai.svg");
  const http = Bookmark.fromJSON({ ...OLD_BACKUP.bookmarks[0], faviconUrl: "https://github.com/favicon.ico" });
  assert.equal(http.faviconUrl, "https://github.com/favicon.ico");
});
```

Check `Category.fromJSON` / `Task.fromJSON` signatures in `src/domain/entities/` first and adjust field names if the fixture disagrees with the real entity (the entity is the truth; the OLD_BACKUP shape must match what `toJSON()` produced at git tag/HEAD — verify with `git show HEAD:src/domain/entities/Task.js`).

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test test/
```
Expected: the "garbage faviconUrl" test FAILS (normalizeFaviconUrl throws).

- [ ] **Step 3: Make `Bookmark.fromJSON` resilient**

In `src/domain/entities/Bookmark.js`, replace the `faviconUrl` line in `fromJSON`:

```js
  static fromJSON(json) {
    let faviconUrl = "";
    try {
      faviconUrl = Bookmark.#normalizeFaviconUrl(json.faviconUrl ?? "");
    } catch {
      // Legacy/imported data must never brick the whole list; drop the icon.
    }
    return new Bookmark({
      id: new Id(json.id),
      title: json.title,
      url: new Url(json.url),
      categoryId: new Id(json.categoryId),
      order: Number.isInteger(json.order) ? json.order : 0,
      lastAccessed: json.lastAccessed ?? null,
      accessCount: typeof json.accessCount === "number" ? json.accessCount : 0,
      faviconUrl,
    });
  }
```
(Constructor and `setFaviconUrl` keep throwing — user-facing edits still validate.)

- [ ] **Step 4: Run tests to verify pass**

```bash
node --test test/
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/entities/Bookmark.js test/backup-compat.test.mjs
git commit -m "fix: legacy backups with invalid faviconUrl import cleanly; add backup-compat test gate"
```

---

### Task 3: Restore search (filter-as-you-type + engine submit)

**Files:**
- Modify: `src/presentation/newTab/newTabController.js` (subscribe to search events)
- Modify: `src/presentation/newTab/views/SearchView.js` (placeholder from engine, drop duplicate ⌘K listener)
- Modify: `src/presentation/newTab/views/BookmarksView.js` (add `setFilter`)

**Interfaces:**
- Consumes: `EventBus.on(event, handler)`; `BookmarksView.renderGrid()`; `state.settings.searchEngine` ∈ google|duckduckgo|bing|yahoo|youtube; `settings.searchOpenNewTab` boolean.
- Produces: `BookmarksView.setFilter(query: string): void` and `BookmarksView.filterQuery` (lowercased trimmed string, `""` = no filter). `SearchView.render(settings)` updates placeholder on every call.

- [ ] **Step 1: Add `setFilter` + filtering to BookmarksView**

In `BookmarksView` constructor add `this.filterQuery = "";`. Add method:

```js
  setFilter(query) {
    this.filterQuery = (query || "").trim().toLowerCase();
    if (this.gridSlot) this.renderGrid();
  }
```

In `renderGrid()`, after the category filter, apply the query filter:

```js
    const inCategory = this.bookmarks.filter(
      (b) => b.categoryId.value === this.activeCategoryId,
    );
    const q = this.filterQuery;
    const filtered = q
      ? inCategory.filter((b) => {
          const href = (b.url.href ?? String(b.url)).toLowerCase();
          return b.title.toLowerCase().includes(q) || href.includes(q);
        })
      : inCategory;
```

and use `filtered` for `sorted`. Empty state text becomes:

```js
    const emptyText = q ? "No matches · clear search to see all" : "No bookmarks yet · tap + to add";
```

- [ ] **Step 2: Wire the events in newTabController**

In `bindGlobalKeys()` (already runs once), add after the existing `bookmarks:changed` subscription:

```js
    this.events.on("search:input", (query) => {
      this.views.bookmarks.setFilter(query);
      this.refreshBookmarkMeta();
    });

    this.events.on("search:submit", (query) => {
      const s = this.state.settings;
      // exactly one visible match → open it directly (reference behavior)
      const v = this.views.bookmarks;
      const q = (query || "").trim().toLowerCase();
      const matches = this.state.bookmarks.filter((b) =>
        b.categoryId.value === v.activeCategoryId &&
        (b.title.toLowerCase().includes(q) || (b.url.href ?? String(b.url)).toLowerCase().includes(q)));
      const url = matches.length === 1
        ? (matches[0].url.href ?? String(matches[0].url))
        : this.searchUrl(s?.searchEngine, query);
      if (s?.searchOpenNewTab) window.open(url, "_blank", "noopener");
      else window.location.assign(url);
    });
```

Add the engine map as a controller method:

```js
  searchUrl(engine, query) {
    const q = encodeURIComponent(query);
    switch (engine) {
      case "duckduckgo": return `https://duckduckgo.com/?q=${q}`;
      case "bing": return `https://www.bing.com/search?q=${q}`;
      case "yahoo": return `https://search.yahoo.com/search?p=${q}`;
      case "youtube": return `https://www.youtube.com/results?search_query=${q}`;
      default: return `https://www.google.com/search?q=${q}`;
    }
  }
```

- [ ] **Step 3: SearchView — engine-aware placeholder, single ⌘K owner**

In `SearchView.render(settings)`: the root is cached, so set the placeholder on every call (before the `if (this.root) return this.root;` early return):

```js
    const engineNames = { google: "Google", duckduckgo: "DuckDuckGo", bing: "Bing", yahoo: "Yahoo", youtube: "YouTube" };
    const placeholder = `Filter bookmarks · Enter for ${engineNames[settings.searchEngine] || "Google"}`;
    if (this.root) {
      this.input.placeholder = placeholder;
      this.input.setAttribute("aria-label", placeholder);
      return this.root;
    }
```
…and use `placeholder` for the initial `el("input", …)` too. Delete the `focusListener` block entirely (constructor property, the `document.addEventListener` and the removal dance) — `newTabController.bindGlobalKeys` already owns ⌘K and calls `views.search.focus()`.

- [ ] **Step 4: Verify statically + run domain tests**

```bash
node --test test/
grep -n "search:input\|search:submit" -r src/  # emitter in SearchView + listener in controller
```

- [ ] **Step 5: Commit**

```bash
git add src/presentation/newTab/
git commit -m "fix: restore search — live bookmark filter, engine-aware submit, single Cmd+K binding"
```

---

### Task 4: Restore clock features (24h, seconds, settings clocks, Pomodoro)

**Files:**
- Modify: `src/presentation/newTab/views/CombinedClockView.js`
- Modify: `src/presentation/newTab/newTab.css` (pomodoro styles)

**Interfaces:**
- Consumes: `PomodoroService` (`toggle()`, `reset()`, `isRunning`, `mode`, `timeLeft`, `formatTime(s)`, `onTick(fn)→unsub`, `destroy()`); `settings.timeFormat.value` ("12h"|"24h"), `settings.showSeconds` boolean, `settings.clocks` array of `{ label, timeZone }`.
- Produces: `CombinedClockView.render(settings)` returns the `.clock-card` section; `updateStatus(html)` unchanged (controller uses it). `destroy()` clears interval AND pomodoro.

- [ ] **Step 1: Rewrite CombinedClockView**

Replace the file body with (keep `getUtcOffset` helper as is):

```js
import { el } from "../../shared/dom.js";
import { PomodoroService } from "./PomodoroService.js";

function getUtcOffset(timezone) { /* keep existing implementation */ }

function formatParts(date, { is24h, withSeconds, timeZone }) {
  const opts = { hour: "2-digit", minute: "2-digit", hour12: !is24h };
  if (withSeconds) opts.second = "2-digit";
  if (timeZone) opts.timeZone = timeZone;
  let text;
  try {
    text = new Intl.DateTimeFormat("en-US", opts).format(date);
  } catch {
    delete opts.timeZone;
    text = new Intl.DateTimeFormat("en-US", opts).format(date);
  }
  // "03:14:24 PM" → { time: "03:14:24", period: "PM" } ; 24h has no period
  const m = text.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*([AP]M)?$/i);
  return { time: m ? m[1] : text, period: m?.[2] ?? "" };
}

export class CombinedClockView {
  constructor({ clock }) {
    this.clock = clock;
    this.intervalId = null;
    this.root = null;
    this.settings = null;
    this.mode = "clock"; // "clock" | "pomodoro"
    this.pomodoro = new PomodoroService();
    this.unsubPomo = null;
  }

  render(settings) {
    this.settings = settings;
    if (this.root) { this._updateWorldMeta(); return this.root; }

    this._localTimeEl = el("span", { className: "clock-time", id: "local-time", title: "Click to start a Pomodoro session" }, "");
    this._localPeriodEl = el("span", { className: "clock-period", id: "local-period" }, "");
    this._clockMain = el("div", { className: "clock-main" }, this._localTimeEl, this._localPeriodEl);
    this._clockMain.addEventListener("click", () => this._toggleMode());

    this._pomoLabel = el("div", { className: "pomo-label" }, "");
    const startBtn = el("button", { type: "button", className: "btn btn-primary" }, "Start");
    startBtn.addEventListener("click", () => { this.pomodoro.toggle(); startBtn.textContent = this.pomodoro.isRunning ? "Pause" : "Start"; });
    const resetBtn = el("button", { type: "button", className: "btn" }, "Reset");
    resetBtn.addEventListener("click", () => { this.pomodoro.reset(); startBtn.textContent = "Start"; this._updateText(); });
    this._pomoStartBtn = startBtn;
    this._pomoControls = el("div", { className: "pomo-controls" }, startBtn, resetBtn);
    this._pomoControls.style.display = "none";

    const worldIcon = el("div", { className: "world-icon", "aria-hidden": "true" });
    worldIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="18" height="18"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
    this._worldLabel = el("div", { className: "world-label" }, "");
    this._worldSub = el("div", { className: "world-sub" }, "");
    this._worldTimeEl = el("div", { className: "world-time", id: "world-time" }, "");
    const worldRow = el("div", { className: "world-row" }, worldIcon, el("div", {}, this._worldLabel, this._worldSub), this._worldTimeEl);

    this._clockStatusText = el("span", { id: "clock-status-text" }, "");
    const clockStatus = el("div", { className: "clock-status", id: "clock-status" },
      el("span", { className: "pulse", "aria-hidden": "true" }), this._clockStatusText);

    this.root = el("section", { className: "clock-card", "aria-label": "Clock" },
      this._pomoLabel, this._clockMain, this._pomoControls,
      el("div", { className: "clock-divider", "aria-hidden": "true" }),
      worldRow, clockStatus);

    this._updateWorldMeta();
    this._updateText();
    this.intervalId = setInterval(() => this._updateText(), 1000);
    this.unsubPomo = this.pomodoro.onTick(() => { if (this.mode === "pomodoro") this._updateText(); });
    return this.root;
  }

  _worldClock() {
    const c = this.settings?.clocks?.[0];
    return c ? { label: c.label, timeZone: c.timeZone } : { label: "Barcelona", timeZone: "Europe/Madrid" };
  }

  _updateWorldMeta() {
    const c = this._worldClock();
    this._worldLabel.textContent = `World Clock · ${c.label}`;
    this._worldSub.textContent = `Timezone ${getUtcOffset(c.timeZone)}`;
  }

  _toggleMode() {
    this.mode = this.mode === "clock" ? "pomodoro" : "clock";
    const pomo = this.mode === "pomodoro";
    this._pomoControls.style.display = pomo ? "flex" : "none";
    this._pomoLabel.style.display = pomo ? "" : "none";
    this._localTimeEl.classList.toggle("pomodoro-active", pomo);
    if (!pomo) { this.pomodoro.reset(); this._pomoStartBtn.textContent = "Start"; }
    this._updateText();
  }

  _updateText() {
    if (!this.root) return;
    if (this.mode === "pomodoro") {
      const p = this.pomodoro;
      this._localTimeEl.textContent = p.formatTime(p.mode === "idle" ? 25 * 60 : p.timeLeft);
      this._localPeriodEl.textContent = "";
      this._pomoLabel.textContent = p.mode === "break" ? "BREAK · 5 MIN" : "FOCUS · 25 MIN";
      return;
    }
    const is24h = this.settings?.timeFormat?.value === "24h";
    const withSeconds = this.settings?.showSeconds === true;
    const now = this.clock.now();
    const local = formatParts(now, { is24h, withSeconds });
    this._localTimeEl.textContent = local.time;
    this._localPeriodEl.textContent = local.period;
    const c = this._worldClock();
    const world = formatParts(now, { is24h, withSeconds: false, timeZone: c.timeZone });
    this._worldTimeEl.textContent = world.period ? `${world.time} ${world.period}` : world.time;
  }

  updateStatus(text) { if (this._clockStatusText) this._clockStatusText.innerHTML = text; }

  destroy() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    this.unsubPomo?.();
    this.pomodoro.destroy();
    this.root = null;
  }
}
```

Note: the controller calls `render(settings)` on every refresh; `_updateWorldMeta()` in the cached branch keeps the world row synced when options change `clocks`. The next tick picks up `timeFormat`/`showSeconds` changes automatically because `_updateText` reads `this.settings`.

- [ ] **Step 2: Add pomodoro CSS to newTab.css**

Append near the clock-card styles:

```css
.pomo-label{display:none;text-align:center;font-family:var(--font-mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:10px}
.pomo-controls{display:flex;justify-content:center;gap:8px;margin-top:14px}
.clock-main{cursor:pointer}
.clock-time.pomodoro-active{color:var(--accent)}
```

- [ ] **Step 3: Verify**

```bash
node --test test/
grep -n "PomodoroService" src/presentation/newTab/views/CombinedClockView.js
```
Manual check happens in Task 8 smoke run (clock click switches to 25:00, Start counts down).

- [ ] **Step 4: Commit**

```bash
git add src/presentation/newTab/
git commit -m "fix: clock honors 24h/seconds/world-clock settings; restore tap-to-pomodoro"
```

---

### Task 5: BookmarksView — drag-and-drop fix, bundled favicons, reference dialogs

**Files:**
- Modify: `src/presentation/newTab/views/BookmarksView.js`
- Modify: `src/presentation/newTab/newTab.css` (drop-target/dragging styles; remove `.shortcut-dialog*` block)
- Create: `public/favicons/ai.svg`, `automation.svg`, `code.svg`, `design.svg`, `document.svg`, `link.svg`, `mail.svg`, `media.svg`, `search.svg`, `social.svg`

**Interfaces:**
- Consumes: `.overlay`, `.dialog`, `.field`, `.field-error`, `.dialog-actions`, `.btn`, `.btn-primary` classes already in `newTab.css` (from reference kit).
- Produces: `showDialog({ title, sub, fields, onSubmit, onDelete })` where each field is `{ id, label, placeholder, value, type? }`; favicon SVGs at `/public/favicons/<name>.svg` (paths must match `BUNDLED_FAVICONS` exactly).

- [ ] **Step 1: Bind document-level drag listeners once**

Move the three `document.addEventListener(...)` blocks out of `setupDragAndDropEvents()` into a new method `bindDocumentDnD()` called from the **constructor**, guarded:

```js
  constructor({ useCases, events, toast }) {
    // ...existing fields...
    this._docDnDBound = false;
    this.bindDocumentDnD();
  }

  bindDocumentDnD() {
    if (this._docDnDBound) return;
    this._docDnDBound = true;
    document.addEventListener("dragover", (e) => { /* existing tab highlight body */ });
    document.addEventListener("dragleave", (e) => { /* existing body */ });
    document.addEventListener("drop", async (e) => { /* existing body */ });
  }
```

`setupDragAndDropEvents()` keeps only the `gridSlot` dragover/drop listeners (gridSlot is recreated each render, so those don't accumulate). Rename it `bindGridDnD()` for honesty.

- [ ] **Step 2: Add drag feedback CSS**

Append to `newTab.css`:

```css
.tile.is-dragging,.tile-row.is-dragging{opacity:.4}
.tile.drop-target-left{box-shadow:-2px 0 0 0 var(--accent)}
.tile.drop-target-right{box-shadow:2px 0 0 0 var(--accent)}
.tile-row.drop-target-top{box-shadow:0 -2px 0 0 var(--accent)}
.tile-row.drop-target-bottom{box-shadow:0 2px 0 0 var(--accent)}
.tab.drop-target-category{border-color:var(--accent);color:var(--fg)}
```

- [ ] **Step 3: Create the 10 bundled favicon SVGs**

Each file is a 24×24 line icon consistent with the kit's stroke style. Template (vary the paths per icon):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fafafa" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><!-- paths --></svg>
```

Concrete paths:
- `ai.svg`: `<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="#fafafa"/>`
- `automation.svg`: `<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M19.1 4.9l-2.8 2.8M7.7 16.3l-2.8 2.8"/>`
- `code.svg`: `<path d="M8 6l-6 6 6 6M16 6l6 6-6 6"/>`
- `design.svg`: `<circle cx="9" cy="9" r="6"/><circle cx="15" cy="15" r="6"/>`
- `document.svg`: `<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/>`
- `link.svg`: `<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7L12.5 18.5"/>`
- `mail.svg`: `<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 7l10 6L22 7"/>`
- `media.svg`: `<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3z"/>`
- `search.svg`: `<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>`
- `social.svg`: `<circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8.7 10.6l6.6-3.2M8.7 13.4l6.6 3.2"/>`

- [ ] **Step 4: Migrate showDialog to the reference dialog pattern**

Replace `showDialog` so it renders the kit's structure (labels + error slots + pill buttons), keeping the same call signature plus optional `label`/`sub`:

```js
  showDialog({ title, sub = "", fields, onSubmit, onDelete }) {
    document.body.querySelector(".overlay.bm-dialog")?.remove();
    const overlay = el("div", { className: "overlay bm-dialog is-open", "aria-hidden": "false" });
    const dialog = el("div", { className: "dialog", role: "dialog", "aria-modal": "true" },
      el("h2", {}, title),
      sub ? el("p", { className: "sub" }, sub) : null,
    );
    const inputs = {};
    fields.forEach((f, i) => {
      const input = el("input", { type: "text", id: `bm-f-${f.id}`, placeholder: f.placeholder || "", value: f.value || "", autocomplete: "off" });
      inputs[f.id] = input;
      const err = el("div", { className: "field-error", "aria-live": "polite" });
      input.addEventListener("input", () => { input.classList.remove("is-error"); err.textContent = ""; });
      const control = f.type === "favicon" ? this.renderFaviconField(f, input, inputs) : input;
      dialog.appendChild(el("div", { className: "field" }, el("label", { htmlFor: `bm-f-${f.id}` }, f.label || f.id), control, err));
      if (i === 0) setTimeout(() => input.focus(), 30);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); submitBtn.click(); }
      });
    });
    const cancelBtn = el("button", { type: "button", className: "btn" }, "Cancel");
    const submitBtn = el("button", { type: "button", className: "btn btn-primary" }, "Save");
    cancelBtn.addEventListener("click", () => overlay.remove());
    submitBtn.addEventListener("click", () => {
      const values = Object.fromEntries(Object.entries(inputs).map(([id, input]) => [id, input.value]));
      overlay.remove();
      onSubmit(values);
    });
    const actions = el("div", { className: "dialog-actions" }, cancelBtn, submitBtn);
    if (onDelete) {
      const deleteBtn = el("button", { type: "button", className: "btn", style: "border-color:var(--danger);color:var(--danger);margin-right:auto" }, "Delete");
      deleteBtn.addEventListener("click", () => { overlay.remove(); onDelete(); });
      actions.prepend(deleteBtn);
    }
    dialog.appendChild(actions);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    const escHandler = (e) => { if (e.key === "Escape") { overlay.remove(); document.removeEventListener("keydown", escHandler); } };
    document.addEventListener("keydown", escHandler);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  }
```

Update every `showDialog` call site to pass `label`s: Add/Edit Shortcut fields → `{ id: "url", label: "URL", … }`, `{ id: "title", label: "Name", … }`, `{ id: "faviconUrl", label: "Favicon", type: "favicon", … }`; category dialogs → `{ id: "cat-name", label: "Name", … }`. In `renderFaviconField`, change button classNames from `shortcut-dialog-btn` to `btn` and the select className to `settings-select shortcut-favicon-select` (keep the layout classes `shortcut-favicon-field` / `shortcut-favicon-actions`).

- [ ] **Step 5: Remove dead `.shortcut-dialog*` CSS**

In `newTab.css` delete the `.shortcut-dialog-overlay`, `.shortcut-dialog`, `.shortcut-dialog-title`, `.shortcut-dialog-input`, `.shortcut-dialog-actions`, `.shortcut-dialog-btn` rules (keep `.shortcut-favicon-field`, `.shortcut-favicon-select`, `.shortcut-favicon-actions`; restyle inputs inside `.field` are covered by the kit's `.field input` rule). Verify no JS references remain:

```bash
grep -rn "shortcut-dialog" src/  # expect: no matches
```

- [ ] **Step 6: Verify + commit**

```bash
node --test test/
ls public/favicons/  # 10 svg files
git add -A
git commit -m "fix: bind bookmark DnD once, add drag feedback, bundled favicons, reference-style dialogs"
```

---

### Task 6: Sidebar/controller cleanups + theme presets restored

**Files:**
- Modify: `src/presentation/newTab/newTabController.js` (`restoreCachedState` reset)
- Modify: `src/presentation/newTab/views/SettingsSidebarView.js` (drop dead `showCalendar` draft key)
- Modify: `src/presentation/newTab/views/BackgroundView.js` (apply `data-theme-preset`)
- Modify: `src/presentation/shared/styles/tokens.css` (preset accent overrides)

**Interfaces:**
- Consumes: `settings.themePreset` ∈ minimal|nord|cyberpunk|sage (already stored/validated by `UserSettings`).
- Produces: `<html data-theme-preset="nord">` attribute; tokens override `--accent`/`--accent-soft`/`--accent-hex` under that attribute. `data-theme` (dark|light) remains an orthogonal axis owned by the controller.

- [ ] **Step 1: Fix the broken cache-reset in `restoreCachedState`**

Replace:

```js
            this.state = { ...this.constructor.prototype.state };
```
with:

```js
            this.state = { settings: null, categories: [], bookmarks: [], tasks: [], layout: [] };
```

- [ ] **Step 2: Remove the dead `showCalendar` draft key**

In `SettingsSidebarView.ensureDraft()` delete the line `showCalendar: s.showCalendar !== false,` (no entity field, no setter, no UI toggle — it silently does nothing).

- [ ] **Step 3: Re-apply theme presets via a dedicated attribute**

In `BackgroundView.update(settings)` add back (using the new attribute so it can't fight the dark/light toggle):

```js
    if (settings.themePreset !== undefined) {
      document.documentElement.setAttribute("data-theme-preset", settings.themePreset || "minimal");
    }
```

- [ ] **Step 4: Add preset token overrides**

Append to `src/presentation/shared/styles/tokens.css` (accent values ported from the pre-redesign tokens at HEAD):

```css
/* Theme presets — legacy feature, accent-only overrides (minimal = kit default) */
html[data-theme-preset="nord"] { --accent: #88c0d0; --accent-soft: rgba(136, 192, 208, .16); --accent-hex: #88c0d0; }
html[data-theme-preset="cyberpunk"] { --accent: #ff0055; --accent-soft: rgba(255, 0, 85, .16); --accent-hex: #ff0055; }
html[data-theme-preset="sage"] { --accent: #8fbc8f; --accent-soft: rgba(143, 188, 143, .16); --accent-hex: #8fbc8f; }
```

- [ ] **Step 5: Add the missing utility CSS**

Append to `newTab.css`:

```css
.widgets-row{display:flex;gap:var(--space-4);width:100%;max-width:var(--bookmarks-max);flex-wrap:wrap}
.resume-backup-btn{position:fixed;bottom:24px;right:24px;z-index:var(--z-toast);height:36px;padding:0 16px;border-radius:var(--radius-pill);border:1px solid var(--accent);background:var(--accent-soft);color:var(--fg);font-family:var(--font-mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
.fatal-error-overlay{position:fixed;inset:0;z-index:calc(var(--z-dialog) + 1);background:var(--bg);padding:48px;overflow:auto}
.fatal-error-title{font-family:var(--font-body);font-size:20px;margin-bottom:16px;color:var(--danger)}
.fatal-error-details{font-family:var(--font-mono);font-size:12px;color:var(--muted);white-space:pre-wrap}
```

Then remove the now-redundant inline `style:` object from the `widgetRow` `el()` call in `newTabController.render()` (keep only `className: "widgets-row"`).

- [ ] **Step 6: Verify + commit**

```bash
node --test test/
grep -rn "showCalendar" src/  # expect: no matches
git add -A
git commit -m "fix: cache-reset bug, dead draft key, restore theme presets, missing utility CSS"
```

---

### Task 7: Options + popup visual audit against the kit

**Files:**
- Modify: `src/presentation/options/options.css`, `src/presentation/options/options.html` (only if drift found)
- Modify: `src/presentation/popup/popup.css` (only if drift found)

**Interfaces:**
- Consumes: token variables from `tokens.css` (`--bg`, `--surface`, `--fg`, `--muted`, `--border`, `--accent`, `--font-*`, `--radius-*`, `--dur`, `--ease`).

- [ ] **Step 1: Audit for legacy variable references**

```bash
grep -nE "var\(--(bg-color|text-main|text-muted|accent-red|border-color|surface-color|glass-bg|glass-border|text-display|text-primary|text-secondary)\)" src/presentation/options/*.css src/presentation/popup/*.css src/presentation/newTab/newTab.css
```
Any hit = legacy token not defined by the new tokens.css. Replace: `--bg-color`→`--bg`, `--text-main`→`--fg`, `--text-muted`→`--muted`, `--accent-red`→`--accent`, `--border-color`→`--border`, `--surface-color`→`--surface`, `--glass-bg`→`--glass`, `--glass-border`→`--border`, `--text-display`→`--font-display`, `--text-primary`→`--font-body`, `--text-secondary`→`--font-mono`.
**Exception:** `--bg-color`, `--text-main`, `--border-color`, `--accent-red` are ALSO set at runtime by the Color Sandbox (`SettingsSidebarView.applyCssVars`, `newTabController.applyCssVars`). Keep that feature working: in `tokens.css` define bridge defaults once —

```css
:root { --bg-color: var(--bg-hex); --text-main: var(--fg-hex); --border-color: var(--border-hex); --accent-red: var(--accent-hex); }
```
and leave any rule that intentionally consumes the sandbox variables pointing at the bridge names.

- [ ] **Step 2: Check every element ID the controllers query exists in the HTML**

```bash
for id in $(grep -ohE 'getElementById\("[^"]+"\)' src/presentation/options/optionsController.js | sed -E 's/.*\("([^"]+)"\).*/\1/' | sort -u); do grep -q "id=\"$id\"" src/presentation/options/options.html || echo "MISSING: $id"; done
```
Expected: no MISSING lines (else add the missing element to options.html following the kit's `.field` pattern).
Run the same loop for `src/presentation/popup/popupController.js` against `popup.html`.

- [ ] **Step 3: Commit (if changes)**

```bash
git add -A
git commit -m "style: align options/popup with kit tokens; bridge color-sandbox variables"
```

---

### Task 8: End-to-end smoke gate (real Chrome, real extension)

**Files:**
- Create: `package.json`, `scripts/smoke.mjs`, `test/fixtures/old-backup.json`
- Modify: `.gitignore` (add `node_modules/`)

**Interfaces:**
- Consumes: everything. This is the production gate the whole plan aims at.
- Produces: `npm run smoke` — loads the unpacked extension into real Chrome, exercises the critical flows, exits 0 only if all assertions pass with zero console errors.

- [ ] **Step 1: Init npm + install puppeteer-core**

```bash
printf '{\n  "name": "nothingtab-dev",\n  "private": true,\n  "type": "module",\n  "scripts": { "smoke": "node scripts/smoke.mjs", "test": "node --test test/" },\n  "devDependencies": {}\n}\n' > package.json
npm i -D puppeteer-core
printf 'node_modules/\n' >> .gitignore
```

- [ ] **Step 2: Create the old-backup fixture**

`test/fixtures/old-backup.json` — an as-exported storage dump from the pre-redesign version:

```json
{
  "settings": {
    "name": "SmokeUser",
    "background": { "kind": "solid_color", "value": "#000000" },
    "timeFormat": "24h",
    "backgroundBlur": 0,
    "backgroundOverlay": 0.35,
    "clocks": [{ "label": "Dhaka", "timeZone": "Asia/Dhaka" }],
    "searchEnabled": true,
    "searchEngine": "duckduckgo",
    "shortcutsEnabled": true
  },
  "categories": [
    { "id": "cat-quick", "name": "Quick", "order": 0 },
    { "id": "cat-dev", "name": "Dev", "order": 1 }
  ],
  "bookmarks": [
    { "id": "bm-1", "title": "GitHub", "url": "https://github.com", "categoryId": "cat-dev", "order": 0, "lastAccessed": null, "accessCount": 0 },
    { "id": "bm-2", "title": "YouTube", "url": "https://youtube.com", "categoryId": "cat-quick", "order": 0, "lastAccessed": null, "accessCount": 2 },
    { "id": "bm-3", "title": "BadIcon", "url": "https://example.com", "categoryId": "cat-quick", "order": 1, "faviconUrl": "not a real url", "accessCount": 0 }
  ],
  "tasks": [{ "id": "task-1", "title": "Smoke task", "completed": false, "order": 0 }]
}
```
(Adjust field names only if `git show HEAD:src/domain/entities/Task.js` disagrees.)

- [ ] **Step 3: Write `scripts/smoke.mjs`**

```js
import puppeteer from "puppeteer-core";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const EXT = resolve(import.meta.dirname, "..");
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const fixture = JSON.parse(readFileSync(join(EXT, "test/fixtures/old-backup.json"), "utf8"));

const failures = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures.push(name);
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  userDataDir: mkdtempSync(join(tmpdir(), "nt-smoke-")),
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "--no-first-run", "--window-size=1280,900"],
});

try {
  // Find the extension id from the service worker target
  const swTarget = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().startsWith("chrome-extension://"), { timeout: 15000 });
  const extId = new URL(swTarget.url()).host;
  const NEWTAB = `chrome-extension://${extId}/src/presentation/newTab/newTab.html`;

  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });

  // 1) Import an old backup exactly like the sidebar import does
  await page.goto(NEWTAB, { waitUntil: "networkidle0" });
  await page.evaluate(async (data) => { await chrome.storage.local.clear(); await chrome.storage.local.set(data); }, fixture);
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector(".tile, .tile-row", { timeout: 10000 }).catch(() => {});

  check("no page/console errors after old-backup import", errors.length === 0, errors.slice(0, 3).join(" | "));
  const tabLabels = await page.$$eval("#category-tabs .tab", (els) => els.map((e) => e.textContent.trim()));
  check("category tabs render from backup", tabLabels.includes("Quick") && tabLabels.includes("Dev"), tabLabels.join(","));
  const tileCount = await page.$$eval(".tile:not(.tile-add), .tile-row:not(.tile-row-add)", (els) => els.length);
  check("bookmarks render from backup (Quick has 2)", tileCount === 2, `got ${tileCount}`);
  const greeting = await page.$eval(".greeting h1", (e) => e.textContent);
  check("greeting shows imported name", greeting.includes("SmokeUser"), greeting);

  // 2) Search filters bookmarks live
  await page.type("#search-input", "youtube");
  await new Promise((r) => setTimeout(r, 300));
  const afterFilter = await page.$$eval(".tile:not(.tile-add), .tile-row:not(.tile-row-add)", (els) => els.length);
  check("search filters tiles", afterFilter === 1, `got ${afterFilter}`);
  await page.$eval("#search-input", (e) => { e.value = ""; e.dispatchEvent(new Event("input", { bubbles: true })); });

  // 3) Add a bookmark through the dialog
  await page.click(".tile-add, .tile-row-add");
  await page.waitForSelector(".overlay.bm-dialog input", { timeout: 5000 });
  const dialogInputs = await page.$$(".overlay.bm-dialog input[type=text]");
  await dialogInputs[0].type("https://news.ycombinator.com");
  await dialogInputs[1].type("HN");
  await page.click(".overlay.bm-dialog .btn-primary");
  await new Promise((r) => setTimeout(r, 500));
  const afterAdd = await page.$$eval(".tile:not(.tile-add), .tile-row:not(.tile-row-add)", (els) => els.length);
  check("add-bookmark dialog creates a tile", afterAdd === 3, `got ${afterAdd}`);
  const stored = await page.evaluate(() => chrome.storage.local.get("bookmarks"));
  check("new bookmark persisted with old shape intact", stored.bookmarks.some((b) => b.title === "HN" && typeof b.order === "number"));

  // 4) Settings sidebar opens; export data is complete
  await page.click("#btn-settings");
  await new Promise((r) => setTimeout(r, 400));
  const sidebarOpen = await page.$eval(".settings-sidebar", (e) => e.classList.contains("open"));
  check("settings sidebar opens", sidebarOpen);
  const exported = await page.evaluate(() => chrome.storage.local.get());
  check("export snapshot contains all storage keys", ["settings", "categories", "bookmarks", "tasks"].every((k) => k in exported));

  // 5) Clock: pomodoro toggles on click
  await page.click("#btn-settings"); // close sidebar first (it overlays)
  await new Promise((r) => setTimeout(r, 400));
  await page.click(".clock-main");
  const pomoText = await page.$eval("#local-time", (e) => e.textContent);
  check("clock click enters pomodoro (25:00)", pomoText === "25:00", pomoText);
  await page.click(".clock-main"); // back to clock

  // 6) 24h format honored (fixture sets 24h → no AM/PM)
  const period = await page.$eval("#local-period", (e) => e.textContent.trim());
  check("24h format hides AM/PM", period === "", period || "(empty)");

  check("zero accumulated console errors at end", errors.length === 0, errors.slice(0, 5).join(" | "));
} finally {
  await browser.close();
}

console.log(failures.length ? `\n${failures.length} FAILURES` : "\nALL SMOKE CHECKS PASSED");
process.exit(failures.length ? 1 : 0);
```

- [ ] **Step 4: Run the smoke gate**

```bash
npm run smoke
```
Expected: `ALL SMOKE CHECKS PASSED`, exit 0. **If any check fails: diagnose and fix the product code (or, only if the check itself is provably wrong, the check), rerun until green.** This step is the point of the whole plan — do not skip failures.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json scripts/smoke.mjs test/fixtures/old-backup.json .gitignore
git commit -m "test: add real-Chrome smoke gate covering backup import, search, dialogs, pomodoro"
```

---

### Task 9: Production readiness — CHROMEWEBSTORE.md + final audit

**Files:**
- Create: `CHROMEWEBSTORE.md`
- Modify: `CLAUDE.md` (commands section), `manifest.json` (version bump to 0.3.0)

- [ ] **Step 1: Final checklist audit** (from the chrome-extensions skill)

```bash
grep -rn "<script" src --include=*.html | grep -v 'src='   # expect: no inline scripts
grep -rn "\.then(" src/presentation src/infrastructure | grep -v "catch" | head   # review any hits
ls public/icons/  # icon16/32/48/128 exist (manifest references them)
grep -rn "fonts.googleapis\|cdn\." src/  # expect: none (Task 1)
```
Fix anything found.

- [ ] **Step 2: Bump version + write CHROMEWEBSTORE.md**

`manifest.json`: `"version": "0.3.0"`.

Create `CHROMEWEBSTORE.md` with: store name (NothingTab), summary, description (lead with function: new-tab dashboard with categorized bookmark shortcuts, clock + pomodoro, tasks, calendar, weather; local-only storage), category (Productivity), **permissions justification** — `storage`/`unlimitedStorage`: "Saves your bookmarks, tasks and preferences on your device, including image backgrounds"; `activeTab`: "Reads the current page's title and URL only when you click the toolbar button, to pre-fill the quick-add form"; omnibox keyword `nt`; **privacy**: all data stays in local browser storage; the only network requests are favicon fetches and the weather service when enabled; no analytics, no accounts. Version history entry for 0.3.0 (UI redesign + fixes). Note: screenshots needed at 1280×800 before submission; ZIP must exclude `node_modules/`, `test/`, `scripts/`, `docs/`, `CHROMEWEBSTORE.md`, `src/ui_kits-app-index.html`.

- [ ] **Step 3: Update CLAUDE.md commands**

Add to the Commands section: `node --test test/` (domain gates) and `npm run smoke` (real-Chrome E2E; needs Chrome at default path or `CHROME_PATH`). Remove the "Repo hygiene" note about fix.js/old_newTab.css (deleted in Task 1); keep the note that `src/ui_kits-app-index.html` is the UI design reference.

- [ ] **Step 4: Final full run + commit**

```bash
node --test test/ && npm run smoke
git add -A
git commit -m "chore: v0.3.0 — production audit, store listing doc, dev commands"
```

---

## Self-Review Notes

- Spec coverage: search (T3), pomodoro/clock settings (T4), bookmark DnD + dialogs + favicons (T5), backup import compatibility (T2 + T8 fixture with garbage faviconUrl), theme presets + sidebar cleanups + CSS gaps (T6), options/popup polish (T7), fonts/offline + junk removal (T1), production gate + store doc (T8, T9).
- Deliberate scope cuts: `data-theme` dark/light stays controller-owned per the reference kit; `themePreset` restored as an orthogonal accent-only attribute (smallest change preserving the feature). Sidebar import/export code is untouched — it was never broken; T8 proves it end-to-end via the same `chrome.storage.local.set` path.
- Types checked: `setFilter(query)` (T3) matches `BookmarksView` usage in controller; `updateStatus(html)` retained for `refreshGlobalStatus`; pomodoro API matches `PomodoroService` as read.
