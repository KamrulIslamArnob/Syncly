# NothingTab — Complete Product & Engineering Specification

> **Purpose of this document:** A self-contained, copy-pasteable spec. If you hand this to an engineer (or paste it into a fresh repo), it recreates the *same product*: same features, same workflows, same architecture, same design system. It is derived by reading 100% of the source.

> **⚠ Stale as of the bookmark-manager redesign.** The new tab was rebuilt as a two-pane native-Chrome-bookmarks manager (`BookmarkDeckView.js`) with dark/light theming, a workspace switcher, and real tags — replacing the widget dashboard (clock/Pomodoro/tasks/weather/curated-shortcuts grid) that sections 0, 2.2–2.4, 3.1–3.7, 5, and 6 below describe. Those sections are accurate for the *old* dashboard and its still-present-but-unmounted code, not for what actually renders today. See [`docs/agents/CLAUDE.md`](docs/agents/CLAUDE.md)'s "What changed" section for the current architecture; this doc hasn't been re-derived against it yet.

---

## 0. One-Paragraph Product Definition

NothingTab is a **Chrome MV3 new-tab replacement extension** with a Nothing-Phone-inspired, monochrome OLED aesthetic (black canvas, white type, red `#D71921` used *only* as an interrupt). It replaces the new-tab page with a dashboard composed of: a time-aware **greeting**, a **combined clock** (local time + world clock + Pomodoro), a **search bar** (cmd/ctrl-K), a **bookmark shortcuts manager** (categorized, drag-and-drop, favicon-aware), a **to-do list**, a **calendar**, and a **weather** widget. Configuration happens through a slide-in **settings sidebar** (on the new-tab page), a full **options page**, a **toolbar popup** for quick-add, and a **`nt` omnibox** keyword for fast actions. Data lives in `chrome.storage.local`. The code is built on a strict **Clean Architecture / DDD** layering (Domain → Application → Infrastructure → Presentation) wired by a single composition root.

---

## 1. Architecture (the backbone — every other feature hangs off this)

### 1.1 Layering (dependency rule: outer layers import inner, never vice-versa)
```
Presentation (views, controllers, HTML)
        │  calls use cases + reads events
        ▼
Application  (useCases/*.js, ports/*.js, EventBus)
        │  depends on domain interfaces + entities
        ▼
Domain (entities/*, valueObjects/*, repositories/*.js interfaces)
        ▲  implemented by
        │
Infrastructure (persistence/*, services/*, security/*, di/container.js)
```
- **Domain** knows nothing about Chrome, DOM, or storage. It owns invariants.
- **Application** orchestrates domain objects through *ports* (interfaces). It defines repository interfaces (in `domain/repositories`) and ports (in `application/ports`): `IdGeneratorPort`, `ClockPort`, `WeatherService`, `SanitizerPort`, `EventBus`.
- **Infrastructure** is the *only* place that touches `chrome.*`, `fetch`, `crypto`, `IndexedDB`.
- **Presentation** only ever talks to the container (the composition root) — never to concrete infra classes.

### 1.2 Composition root — `src/infrastructure/di/container.js`
- `buildContainer()` instantiates every singleton once and freezes the object.
- Returns `{ events, useCases, internals }`.
  - `events`: the single `EventBus` instance.
  - `useCases`: frozen object of ~35 named use cases (listed in §3).
  - `internals`: `{ storage, bookmarkRepo, categoryRepo, settingsRepo, taskRepo, layoutRepo, subfolderRepo, clock, ids, sanitizer, autoBackupService, githubBackupService, weatherService }` — exposed for tests only; presentation never touches these directly.
- Wires `storage.onChanged` → invalidates the relevant repo cache AND emits a domain event (`bookmarks:changed`, `categories:changed`, `settings:changed`, `tasks:changed`, `layout:changed`, `subfolders:changed`, `bookmarkGroups:changed`). This is how cross-tab/background syncing reaches the UI without the UI binding to `chrome.storage.onChanged` directly.

### 1.3 EventBus — `application/ports/EventBus.js`
- Tiny synchronous pub/sub (`on(event, handler)` returns unsubscribe; `emit(event, payload)`).
- After a use case mutates state, it emits its event; the controllers' `subscribe()` re-fetches and re-renders. This is the **single sync mechanism** for all data changes across every UI surface.

### 1.4 Data flow (example: add bookmark from popup)
`popupController.submit()` → `useCases.createBookmark.execute()` → sanitizes input, validates category exists, computes next `order`, builds `Bookmark` entity, `bookmarkRepo.save()` → `events.emit("bookmarks:changed")` → new-tab controller's subscription re-lists bookmarks and re-renders → because storage also changed, `chrome.storage.onChanged` fires and invalidates caches.

---

## 2. Data Model (Domain entities & value objects)

All entities use **private `#` fields** with getters + controlled mutators that enforce invariants. Each has `toJSON()` and `static fromJSON()`.

### 2.1 `UserSettings` (`domain/entities/UserSettings.js`) — the master preferences object
Stored under key `settings`. Fields (with defaults):
- Identity: `name` (≤60 chars).
- **Background**: `background` (a `BackgroundConfig` VO), `backgroundBlur` (0–20), `backgroundOverlay` (0–0.8), `bgGrayscale` (0–100), `bgHueRotate` (0–360), `bgPixelation` (0–100), `bgVignette` (bool), `bgFilmGrain` (bool), `backgroundTintColor` (hex), `buttonRoundness` (0–24).
- **Clock**: `timeFormat` (`ClockFormat`; "12h"/"24h"), `clocks` (array of `WorldClockConfig`, default 4: SF/London/Dhaka/Tokyo).
- **Search**: `searchEnabled`, `searchEngine` (google/duckduckgo/bing/yahoo/youtube), `searchOpenNewTab`.
- **Theme**: `themePreset` (minimal/nord/cyberpunk/sage).
- **Weather**: `weatherEnabled`, `weatherLocation`, `weatherUnit` (c/f).
- **Daily focus**: `focusText`, `focusCompleted`, `focusDate`.
- **Widget toggles**: `todoEnabled`, `shortcutsEnabled`, `quickNoteEnabled`.
- **UI/new-tab controls**: `greetingEnabled`, `messageText` (default "FOCUS. BUILD. SHIP."), `clockEnabled`, `showSeconds`, `showDate`.
- **CSS override hooks**: `customCss`.
- **Live CSS-variable sandbox**: `cssVarBg` (default `#000000`), `cssVarText` (`#ffffff`), `cssVarBorder` (`#333333`), `cssVarAccent` (`#D71921`).
- Every setter re-validates (throws on bad enum/range). `toJSON`/`fromJSON` round-trip all fields.

### 2.2 `Bookmark` (`domain/entities/Bookmark.js`)
Fields: `id` (Id), `title` (1–120 chars), `url` (Url VO), `categoryId` (Id), `order` (≥0 int), `lastAccessed` (ms|null), `accessCount` (int), `faviconUrl` (http(s) URL / bundled `/public/favicons/*.svg` / `data:image/...;base64` — strictly validated by `#normalizeFaviconUrl`).
Mutators: `rename`, `retarget` (Url), `setFaviconUrl`, `moveTo` (categoryId), `reorder`, `recordAccess` (bumps lastAccessed + accessCount).

### 2.3 `Category` (`domain/entities/Category.js`)
Fields: `id`, `name` (1–60 chars), `order` (≥0). Mutators: `rename`, `reorder`.

### 2.4 `Task` (`domain/entities/Task.js`)
Fields: `id`, `title` (1–200), `completed` (bool), `order` (≥0), `scheduledTime` ("" or "HH:MM"), `durationMinutes` (5–1440 or null). Mutators: `rename`, `toggle`, `setCompleted`, `reorder`, `schedule`.

### 2.5 `WidgetLayout` (`domain/entities/WidgetLayout.js`)
One per widget placement. Fields: `id`, `type` (`WidgetKind`), `x,y,w,h` (≥1 ints, grid cells), `visible` (bool). `defaults()` seeds 4: greeting (1,1,8×2), clock (9,1,4×2), bookmarks (1,3,8×6), todo (9,3,4×6).
Note: `WidgetType` enum currently = {greeting, clock, bookmarks, todo}. The dashboard's *new-tab controller* (§5) actually renders more widgets (calendar, weather, search, todo) than the `WidgetLayout` grid machinery knows about — those extra widgets are toggled via `UserSettings` booleans, not the grid. The `layout`/`WidgetLayout` subsystem is the "pluggable grid" path (used by Options → Widgets visibility), while the new-tab `render()` composes a fixed stage with conditional blocks.

### 2.6 Value Objects
- `Id` — opaque string wrapper (wraps UUIDs).
- `Url` — validates http(s) only (used to reject `javascript:`/`data:`).
- `BackgroundConfig` / `BackgroundKind` — kinds: `local_image` (data URL or `*.png/jpg/webp/gif` filename), `remote_image` (http(s) URL), `solid_color`, `gradient`.
- `ClockFormat` / `TimeFormat` — "12h"/"24h" (default H24).
- `WorldClockConfig` — `{label, timeZone}` (timeZone = IANA string or "" for local).
- `Greeting` / `PartOfDay` — `Greeting.fromHour(hour, name)` → morning(<12)/afternoon(<18)/evening; `render()` → "Good Morning, Name" or "Good Morning".
- `WidgetType` / `WidgetKind` — closed set of widget kinds.

---

## 3. Use Cases (Application layer — the complete feature surface)

Each use case is a class with `execute(...)`, holds private deps, and emits the right event after mutating. Grouped by domain:

### 3.1 Bookmarks
- `CreateBookmarkUseCase` — sanitizes title/url/categoryId; verifies category exists (else throws); computes next `order` within the category; builds `Bookmark`; saves; emits `bookmarks:changed`.
- `UpdateBookmarkUseCase` — partial update (title/url/categoryId/order/faviconUrl/recordAccess). Re-validates through domain. **Access recording is silent** (does not trigger a full re-render) to avoid flicker on every click.
- `DeleteBookmarkUseCase` — extends `BaseDeleteUseCase` (repo + event `"bookmarks:changed"`).
- `ReorderBookmarksUseCase` — extends `BaseReorderUseCase`: takes `orderedIds`, re-numbers `order` sequentially, pushes any unlisted items to the end; emits `bookmarks:changed`.
- `ListBookmarksUseCase` — returns all.

### 3.2 Categories
- `CreateCategoryUseCase` — sanitizes name; next `order`; emits `categories:changed`.
- `RenameCategoryUseCase` — sanitize + `rename`; emits.
- `DeleteCategoryUseCase` — **cascades**: deletes all child bookmarks first (emits `bookmarks:changed`), then deletes the category (emits `categories:changed`).
- `ReorderCategoriesUseCase` — `BaseReorderUseCase` → `categories:changed`.
- `ListCategoriesUseCase`.

### 3.3 Tasks (to-do)
- `CreateTaskUseCase` — sanitize title; next `order`; default `completed=false`; emits `tasks:changed`.
- `UpdateTaskUseCase` — partial (title/completed/scheduledTime/durationMinutes); emits.
- `DeleteTaskUseCase` — `BaseDeleteUseCase` → `tasks:changed`.
- `ReorderTasksUseCase` — `BaseReorderUseCase` → `tasks:changed`.
- `ListTasksUseCase`.

### 3.4 Settings
- `GetSettingsUseCase` — loads `UserSettings`.
- `SaveUserSettingsUseCase` — **the big one**: takes a patch, applies only defined fields via dynamic `setX()` setters, rebuilds `BackgroundConfig` from `backgroundKind`+`backgroundValue`, sets `ClockFormat` from `timeFormat24h`; saves; emits `settings:changed`.
- `UpdateUserNameUseCase`, `UpdateTimeFormatUseCase`, `UpdateBackgroundAppearanceUseCase` (blur/overlay only), `UpdateBackgroundUseCase` (kind+value), `UpdateDailyFocusUseCase`.

### 3.5 Background / Clock (standalone)
- `BuildGreetingUseCase` — `Greeting.fromHour(clock.now().getHours(), settings.name)`.
- `GetCurrentTimeUseCase` — `clock.now()`.
- `UpdateBackgroundUseCase` (see 3.4).

### 3.6 Weather
- `GetWeatherUseCase` — if location empty returns null; else delegates to `WeatherService.fetchWeather`.

### 3.7 Layout (widget grid)
- `GetLayoutUseCase` — returns stored layout or seeds `WidgetLayout.defaults()` on first launch.
- `MoveWidgetUseCase` — `widget.moveTo(x,y)`.
- `ResizeWidgetUseCase` — `widget.resizeTo(w,h)`.
- `ToggleWidgetVisibilityUseCase` — `widget.setVisible(visible)`.
- All extend `BaseWidgetUseCase` (loads widget by id, mutates, saves, emits `layout:changed`).

### 3.8 Shared base classes
- `BaseDeleteUseCase(repo, events, eventName)` — find+delete+emit.
- `BaseReorderUseCase(repo, events, eventName)` — re-number algorithm.
- `BaseWidgetUseCase({repo, events})` — `_modifyWidget(id, fn)`.

> **Total: 35 use cases** wired in the container.

---

## 4. Infrastructure Layer

### 4.1 Persistence — `infrastructure/persistence/chromeStorage/`
- `ChromeStorageClient` — thin wrapper over `chrome.storage.local` (`getAll`, `getOne`, `set`, `remove`, `onChanged`). **Hardcoded to `local` area.** (Manifest also requests `unlimitedStorage`.)
- `BaseChromeListRepository` — generic list repo with an in-memory `#cache` (invalidated by `invalidate()`). Methods: `list`, `findById`, `save` (upsert by id), `saveAll`, `setAll`, `delete`, `findByIdRaw`. Serializes via entity `toJSON()` / `fromJSON`.
- Concrete repos (each wraps the base with a storage key):
  - `ChromeBookmarkRepository` (key `bookmarks`, `Bookmark.fromJSON`)
  - `ChromeCategoryRepository` (key `categories`, `Category.fromJSON`)
  - `ChromeTaskRepository` (key `tasks`, `Task.fromJSON`)
  - `ChromeLayoutRepository` (key `layout`, `WidgetLayout.fromJSON`; `saveAll` uses `setAll`)
  - `ChromeSettingsRepository` (key `settings`, `UserSettings.fromJSON`) — single-object repo, not list-based.

### 4.2 Services
- `SystemClock` (implements `ClockPort`) — `now()` → `new Date()`. Single seam for "current time."
- `UuidGenerator` (implements `IdGeneratorPort`) — `crypto.randomUUID()` with fallback.
- `HttpWeatherService` (implements `WeatherService`) — **Open-Meteo API** (no key required):
  1. Geocoding: `https://geocoding-api.open-meteo.com/v1/search?name=...&count=1`
  2. Forecast: `https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...&current_weather=true&temperature_unit=celsius|fahrenheit`
  - Returns `{locationName, temp (rounded), condition}`. `describeWeatherCode()` maps WMO codes → text (Clear sky, Rainy, Thunderstorm, etc.).
- `AutoBackupService` — uses **File System Access API** (`window.showSaveFilePicker`) + **IndexedDB** (`neptab-backup-db` → store `handles` → key `backup-file`) to remember a user-chosen backup file. `performBackup()` writes the entire `chrome.storage.local` dump as JSON; returns `"requires_permission"` (rather than failing) if the stored handle lacks readwrite permission, so the UI can surface a "Resume Auto Backup" button. `requestPermission()` re-prompts.

### 4.3 Security — `infrastructure/security/BasicSanitizer` (implements `SanitizerPort`)
- `text(input)` — strips control chars `< > \x7F` and trims (defense-in-depth; presentation also uses `textContent`).
- `url(input)` — re-validates through `Url` VO; **only https:/http:** survive; everything else (javascript:, data:) → `""`.
- Used in every create/update use case that accepts user-supplied strings — bookmarks, categories, subfolders, tasks, and user settings (including `SaveUserSettingsUseCase`, which also applies CSS hardening to `customCss`) — before persistence.

---

## 5. Presentation Layer — New Tab Page (`src/presentation/newTab/`)

### 5.1 Entry — `newTab.html`
- Overrides `chrome_url_overrides.newtab`. Fonts preloaded (Doto, Space Grotesk, Space Mono). Inline critical CSS paints `#000` immediately (no flash).
- DOM: `.bg-wash` (overlay layer) → `#app` → `main#stage` (JS-filled) + `footer.chrome-bar` with `#btn-settings` (gear) button → `#toast`.
- Loads `newTabController.js` as a module.

### 5.2 `newTabController.js` — the orchestrator
- Constructor builds `state = {settings, categories, bookmarks, tasks, layout}`, instantiates all 9 views.
- `init()`:
  1. `document.fonts.ready` → add `fonts-loaded` class.
  2. `buildContainer()`.
  3. Instantiate views: `background, greeting, bookmarks, todo, settings, search, calendar, combinedClock, weather`.
  4. `restoreCachedState()` — reads `localStorage["neptab_state_cache"]` and renders **instantly** (cached snapshot) before async load (perceived performance); falls back to clearing cache on render error.
  5. `subscribe()` to the 5 `*:changed` events → `refresh(kind)` → re-fetch + `cacheState()` + `render()`.
  6. `bindChromeBar()` (settings/find buttons), `bindGlobalKeys()` (cmd/ctrl-K → search focus).
  7. `await loadState()` (parallel Promise.all of getSettings/listCategories/listBookmarks/listTasks/getLayout) → `cacheState()` → `render()` → `triggerAutoBackup()`.
- `render()` composes the stage **top-to-bottom conditionally** based on `settings` booleans:
  1. `greeting` (if `greetingEnabled`)
  2. `combinedClock` (if `clockEnabled`)
  3. `clock-status` pill (pulse dot + text) — shows active category · link count · density (e.g. "CODE · 4 LINKS · COMPACT GRID")
  4. `search` (if `searchEnabled`)
  5. `bookmarks` shell (if `shortcutsEnabled`) — includes toolbar (Grid/List segmented, Comfort/Compact/Dense segmented, Dark/Light segmented), category tabs row, meta row
  6. **widget row** (flex, wraps): `weather` (if `weatherEnabled`), `calendar` (if `showDate`), `todo` (always)
- Applies CSS vars (`--bg-color`, `--text-main`, `--border-color`, `--accent-color`) and custom CSS (`<style id="neptab-custom-css">`).
- Mounts settings sidebar to `body`.
- **Density / View / Theme** are persisted in `localStorage` (`ntab:density`, `ntab:view`, `ntab:theme`) and reflected as `data-density`/`data-view`/`data-theme` attributes on `<html>`/the bookmarks shell (drives CSS + view mode). Cycle order: comfortable → compact → dense.
- `fatal()` renders a full-screen `#fatal-overlay` with the error stack if architecture/bootstrap fails.
- `triggerAutoBackup()` runs `AutoBackupService.performBackup()`; if it returns `"requires_permission"`, shows a floating "Resume Auto Backup" button that calls `requestPermission()`.

### 5.3 Views (each is a class with `render()`/`update()`; all DOM built via the safe `el()` helper — **never innerHTML for data**)

**`GreetingView`** — time-based greeting ("Good Morning/Afternoon/Evening") + red `greeting-dot` + name + custom `messageText`. Defaults message if empty.

**`CombinedClockView`** — the hero clock card:
- Local time (HH:MM:SS + AM/PM), updates every 1s.
- World-clock sub-row: icon + "World Clock · <city>" + timezone offset (UTC±N) + country + live world time (defaults to Barcelona/Europe/Madrid; `updateWorldCity()` can retarget).
- `clock-status` pill with a pulsing dot.
- Note: this is the *rendered* clock; `ClockView` (separate file) is an alternate implementation with a click-to-start **Pomodoro** and is referenced by the architecture but the active new-tab uses `CombinedClockView`. `PomodoroService` (25/5 cycle, oscillator alert, start/pause/reset, `onTick` listeners) backs the Pomodoro mode.

**`SearchView`** — search input with magnifier icon + `⌘K` kbd hint. On submit emits `search:submit`; on input emits `search:input` (used to filter bookmarks live — wired via events; placeholder "Filter bookmarks · Enter for YouTube"). cmd/ctrl-K focuses.

**`BookmarksView`** — the richest view:
- Renders category tabs (via `CategoryTabs` penta-bridge widget) + a grid/list of shortcut tiles for the **active category**.
- **Tile**: favicon (Google s2 favicon service or uploaded data-URL or bundled SVG or initial-letter fallback) + title (grid) / title+domain (list). Click → records access, opens in same tab (or new tab on meta/ctrl/shift/ middle-click). Right-click → **Edit Shortcut** dialog (URL, title, favicon). Drag tile → reorder within category (left/right in grid, top/bottom in list, with drop-target indicators).
- **Drag bookmark onto a category tab** → re-categorizes (`updateBookmark` with new `categoryId`).
- **Category tabs**: click selects; **double-click** renames; drag to reorder; `+` adds. Scroll arrows for overflow.
- **Add Shortcut** dialog: URL + title + favicon field. Favicon field supports: pick a **bundled SVG** (10 provided: AI, Automation, Code, Design, Document, Link, Mail, Media, Search, Social), **Fetch favicon** (from the URL), **Upload** (image → resized to 128px canvas → webp data URL), or **Clear**.
- All mutations go through use cases; on success re-lists and re-renders.

**`TodoView`** — "TODAY'S FOCUS" widget:
- Add button toggles an inline input (Enter adds via `createTask`, Esc cancels; max 200 chars).
- Renders tasks sorted **incomplete first, then by order**; completed items sink.
- Each item: circular toggle (click → `updateTask` completed flip; shows check icon when done) + title. **Right-click deletes** the task.
- Empty state: "You have no tasks for today."

**`CalendarView`** — month grid widget:
- Month title + prev/next nav (changes `currentDate`).
- 7-col weekday header (S M T W T F S), leading/trailing faded days from adjacent months, **today highlighted**.

**`WeatherView`** — weather widget:
- On render (if `weatherEnabled`), fetches via `HttpWeatherService` (location default "Barcelona, Spain", unit from settings). Auto-refresh every 30 min (`setInterval`). Shows temp (big) + condition + a synthesized footer ("Feels like X° • Humidity 68%"). Loading state shows "Loading...". AbortController cancels in-flight requests on re-fetch.

**`BackgroundView`** — applies the background to the page:
- Sets CSS vars: `--bg-blur`, `--bg-scale` (1.04 when blur>0), `--bg-overlay`, `--bg-overlay-color`, `--bg-solid`, `--button-radius`, `--bg-grayscale`, `--bg-hue`, pixelation vars.
- For `local_image`: data URLs → `URL.createObjectURL` (cached, revoked on change); filenames → `url("img/<name>")`. For `remote_image`: sanitized URL. For `solid_color`: sets `backgroundColor`. For `gradient`: sets background image.
- Builds a `bg-effects-layer` (fixed, pointer-events:none) for the **vignette** radial gradient when enabled.

**`SettingsSidebarView`** — the customization surface (slide-in `<aside class="settings-sidebar">`):
- Opened via `#btn-settings` (`toggle()`). Focus-trapped, Escape closes, aria-expanded wired.
- Works on a **draft** object; saves (debounced `scheduleSave(400)` for sliders, immediate for toggles) via `SaveUserSettingsUseCase`.
- Sections:
  1. **Greeting** toggle + username input (Remove button) + message input (Save button).
  2. **Background Image** toggle + upload local image (resized ≤2560px → webp data URL) + blur slider (0–20) + brightness/overlay slider (0–80%) + **Advanced Effects** (grayscale 0–100, hue rotation 0–360, vignette toggle).
  3. **Clock** toggle + Seconds toggle + 24-hour toggle.
  4. **Date & Calendar** → Show Date toggle.
  5. **Search Bar** toggle + Open-in-new-tab toggle.
  6. **Shortcuts** toggle.
  7. **Setting Management** → Export (download `Nothing-Tab-backup.json` of all `chrome.storage.local`), Import (file → `chrome.storage.local.set` → reload), Setup Auto Backup (File System Access picker).
  8. **Custom CSS** textarea (live preview as you type, Copy Default CSS, Clear, Save).
  9. **Color Sandbox** → 4 color pickers bound to `--bg-color`/`--text-main`/`--border-color`/`--accent-red` (live preview + save).
  10. **Reset All Settings** → `chrome.storage.local.clear()` + reload (confirm-guarded).

**`ToastView`** — tiny status toast (`#toast`), `show(msg, {error})`, auto-hides (~2.4s). Used everywhere for success/error feedback (replaces alert()s).

### 5.4 Shared presentation utilities
- `shared/dom.js` — `el(tag, props, ...children)`: safe element builder. Never `innerHTML` for data; maps `className`, `dataset`, `style` (kebab-cased, supports grid shorthand), `on*` → addEventListener, else property/attribute. `clear`, `setChildren` helpers.
- `shared/icons.js` — `icon(name)` returns inline SVG (plus, check, x, cloud, sun, moon, chevronLeft/Right, etc.).
- `shared/favicon.js` — `faviconUrl`, `websiteFaviconUrl` (Google s2 service), `initial(title)`.
- `shared/i18n.js` — `t(key)` with an English string table (extensible shape; single language for now).
- `shared/youtubeIcon.js` — YouTube glyph.
- **penta-bridge** (design-system primitives): `theme.js`, `tokens.css`, `primitives.css`, `widgets/CategoryTabs.js` (dumb, draggable, pointer-based category tab bar with scroll arrows + add button), `widgets/widgets.css`, `primitives/draggableScroller.js`, `primitives/halftone.js` (dot-matrix motif).

### 5.5 Design system (Nothing aesthetic) — `styles/tokens.css` + `penta-bridge/tokens.css`
- **Color**: OLED black `--bg #050505`, surfaces `#161616`/`#242424`, text white, muted grays, borders = white @ low alpha. **Accent `--accent #D71921` used ONLY as an interrupt** (greeting dot, active tab, world-clock time, dialog error, reset button). Status colors (success/warn/danger) only for validation/loading.
- **Type**: Doto (display/clock), Space Grotesk (body), Space Mono (ALL-CAPS meta). Three-layer hierarchy rule.
- **Density**: `data-density` = comfortable / compact (default) / dense → controls tile size, gap, icon size, label size, bookmark max-height.
- **Light theme**: `data-theme="light"` → warm off-white paper; accent/red unchanged.
- **Motion**: percussive ease-out (`cubic-bezier(0.16,1,0.3,1)`), short durations, no bounce.
- **Anti-patterns enforced**: no gradients in chrome, no shadows (except 2 defined), no skeleton spinners (use `[LOADING...]`), no toast popups (inline status — though a small `#toast` is used for transient feedback), no emojis as UI, radius ≤16px on cards, pills for buttons.

---

## 6. Presentation — Toolbar Popup (`src/presentation/popup/`)

- `popup.html` + `popupController.js` + `popup.css`. Opened from the toolbar icon (`action.default_popup`).
- **Quick-add a bookmark** for the *current tab*: on init, `chrome.tabs.query({active,currentWindow})` seeds title+URL from the active tab.
- Custom dropdown to pick a **category** (auto-creates an "Inbox" category if none exist; auto-selects first).
- Submit validates title/URL/category, calls `useCases.createBookmark.execute`, shows "Saved!" (green), closes popup after 500ms. Errors show inline.

---

## 7. Presentation — Options Page (`src/presentation/options/`)

- `options.html` + `optionsController.js` + `options.css`. Opened via `options_ui.page` (full tab).
- Builds a `draft` from current settings and wires **live preview** through `BackgroundView.update()` (so background/blur/overlay/tint/roundness/theme changes preview instantly without saving).
- Sections (each with render + wire):
  - **Identity** (name)
  - **Background** (source select: default/uploaded/url/solid/gradient; file upload with preview; value input; live preview)
  - **Appearance** (blur 0–20, overlay 0–80%, tint color, button roundness 0–24, theme preset minimal/nord/cyberpunk/sage, 24h toggle, search enable + engine, weather enable + location + unit)
  - **Widgets** (checkbox list bound to `toggleWidgetVisibility` per `WidgetLayout`)
  - **World Clocks** (add `{label, timeZone}` rows; delete)
  - **Categories** (add/rename/delete)
  - **Bookmarks** (add with category select; list with per-row category reassignment + delete)
  - **Save settings** button → `SaveUserSettingsUseCase`.
- Subscribes to all `*:changed` events so it stays in sync if the new-tab page edits data elsewhere.

---

## 8. Background Service Worker (`src/presentation/shared/serviceWorker.js`)

- Registered as `background.service_worker` (module).
- **Omnibox keyword `nt`** (`manifest.omnibox.keyword`):
  - `nt todo <text>` → appends a task to `chrome.storage.local.tasks` (computes next order, UUID id).
  - `nt note <text>` → appends to `chrome.storage.local.quickNote` (newline-separated).
  - `nt <anything else>` → opens URL (fixed `https://` if missing) or, if not a URL, searches via the user's `settings.searchEngine` (google/youtube/duckduckgo/bing).
  - `onInputChanged` provides live suggestions (`todo …`, `note …`).
- (Note: the domain `quickNote` concept exists in storage/omnibox but the new-tab `render()` does not currently surface a quick-note widget — it's a storage + omnibox feature.)

---

## 9. Manifest & Packaging (`manifest.json`)
- `manifest_version: 3`, name **NothingTab**, version `0.2.0`, MIT.
- `chrome_url_overrides.newtab` → `src/presentation/newTab/newTab.html`.
- `action`: default popup `popup.html`, default icon (16/32/48/128).
- `options_ui`: `options.html`, `open_in_tab: true`.
- `permissions`: `storage`, `unlimitedStorage`, `activeTab`.
- `omnibox.keyword`: `nt`.
- `content_security_policy.extension_pages`: `script-src 'self'; object-src 'self'; img-src 'self' data: blob: https:;` (allows remote images for backgrounds/weather/favicons; blocks inline scripts).
- `background.service_worker`: `serviceWorker.js` (module).
- Icons in `public/icons/`.

---

## 10. Cross-Cutting Workflows (the "how it all fits" flows)

1. **First launch**: `GetLayoutUseCase` seeds default widget grid; `UserSettings.fromJSON({})` produces defaults (black bg, red accent, greeting on, message "FOCUS. BUILD. SHIP.", 4 default world clocks). New-tab renders instantly from `localStorage` cache (empty) then from loaded state.
2. **Add bookmark (3 ways)**: popup (current tab) · new-tab "+ Add New" dialog · options page. All → `CreateBookmarkUseCase` → event → new-tab re-renders.
3. **Organize**: drag tiles to reorder; drag tile onto a category tab to move; drag category tabs to reorder; double-click tab to rename. All persisted via reorder/move use cases.
4. **Customize look**: settings sidebar (live color sandbox, background upload, blur/overlay/grayscale/hue/vignette, custom CSS, theme preset, density/view/theme toggles persisted to localStorage). Or the full options page with live background preview.
5. **Daily focus**: to-do list (add/check/delete); daily-focus text in settings; Pomodoro launched by clicking the clock.
6. **Weather**: enable + set city in options/settings → `WeatherView` fetches Open-Meteo every 30 min.
7. **Fast capture**: `nt todo …` / `nt note …` from the address bar; or click toolbar icon to save the current page.
8. **Backup/restore**: Settings sidebar → Export/Import JSON; or Setup Auto Backup (File System Access to a chosen file, written on every load via `AutoBackupService`); "Resume Auto Backup" button appears if permission lapsed.
9. **Multi-surface sync**: any write emits a domain event AND changes `chrome.storage.local`; `container.storage.onChanged` invalidates caches and re-emits events → new-tab *and* options pages (both subscribed) re-render. Open two new tabs and edit in one — the other updates.

---

## 11. Security Model (defense-in-depth)
- **Sanitization at the boundary**: every user string passes `BasicSanitizer.text()`/`url()` in use cases; URLs re-validated through `Url` VO (http(s) only).
- **Safe DOM**: `el()` uses `textContent`/`setAttribute` only — no `innerHTML` with data; favicons load as `<img src>` (the only injection surface, and sources are scheme-validated).
- **CSP**: no inline scripts; remote images allowed but scripts are `'self'` only.
- **Storage isolation**: data in `chrome.storage.local`; File System Access handle stored in IndexedDB (not synced).
- **Invariant enforcement**: domain entities throw on bad input (length/range/enum), so invalid state cannot be persisted.

---

## 12. File Map (what to recreate)
```
manifest.json
public/icons/{16,32,48,128}.png
src/
  domain/
    entities/      UserSettings, Bookmark, Category, Task, WidgetLayout
    valueObjects/  Id, Url, BackgroundConfig, ClockFormat, WorldClockConfig,
                   Greeting, WidgetType
    repositories/  repositories.js (interfaces)
  application/
    ports/         EventBus, ports(IdGeneratorPort,ClockPort), WeatherService,
                   SanitizerPort
    useCases/
      bookmarks/   Create, Update, Delete, Reorder, List
      categories/  Create, Rename, Delete, Reorder, List
      tasks/       Create, Update, Delete, Reorder, List
      settings/    Get, SaveUserSettings, UpdateUserName, UpdateTimeFormat,
                   UpdateBackgroundAppearance, UpdateBackground, UpdateDailyFocus
      background/  BuildGreeting, GetCurrentTime, UpdateBackground
      weather/     GetWeather
      layout/      GetLayout, MoveWidget, ResizeWidget, ToggleWidgetVisibility
      shared/      BaseDeleteUseCase, BaseReorderUseCase, BaseWidgetUseCase
  infrastructure/
    di/container.js
    persistence/chromeStorage/  ChromeStorageClient, BaseChromeListRepository,
      ChromeBookmark/Category/Settings/Task/LayoutRepository
    services/     AutoBackupService, HttpWeatherService, SystemClock, UuidGenerator
    security/     BasicSanitizer
  presentation/
    newTab/       newTab.html, newTab.css, newTabController.js,
                  views/ Background, Greeting, Bookmarks, Todo, SettingsSidebar,
                         Toast, Search, Calendar, Weather, CombinedClock,
                         Clock, WorldClock, PomodoroService
    popup/        popup.html, popup.css, popupController.js
    options/      options.html, options.css, optionsController.js
    shared/       dom.js, icons.js, favicon.js, i18n.js, youtubeIcon.js,
                  serviceWorker.js, styles/{tokens,base}.css,
                  penta-bridge/ theme.js, tokens.css, primitives.css,
                    primitives/{draggableScroller,halftone}.js,
                    widgets/{CategoryTabs,widgets.css}
```
> Dev/helper artifacts present in repo but not part of the product runtime: `fix.js`, `fix_css.js`, `fix_ref_error.js`, `base64.txt`, `old_newTab.css`, `ui_kits-app-index.html`, `Design.md` shim at repo root (canonical `docs/design/Design.md`), `README.md`. The canonical runtime entry is `newTab.html` + the module graph above.

---

## 13. Build / Run Notes
- **No build step, no npm, no framework.** Pure ES modules loaded directly by Chrome (`<script type="module">`). CSP forbids bundlers injecting inline code.
- Load unpacked: `chrome://extensions` → Developer mode → Load unpacked → select repo root.
- Fonts: Doto + Space Grotesk + Space Mono via Google Fonts `<link>` (preconnected).
- External network: Open-Meteo (weather, no key), Google s2 favicons (icons). Both https, both allowed by CSP `img-src`.
- The product is intentionally vanilla; React/Vue were explicitly excluded — any rewrite must stay framework-free to preserve the MV3-no-build constraint.
