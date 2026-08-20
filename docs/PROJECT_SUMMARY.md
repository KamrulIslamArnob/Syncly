# NothingTab — Full Project Summary

> One file to rule them all. Any AI agent reads this first, then knows everything about this codebase.

---

## 1. What Is This?

**NothingTab** is a Chrome MV3 new-tab replacement extension. Nothing-Phone-inspired: OLED-black canvas, white type, red `#D71921` only as interrupt color. Replaces Chrome's new tab with a dashboard of clock, greeting, bookmarks, search, todo, calendar, weather, and settings.

- **Framework**: Vanilla JS, ES modules, no build system, no npm, no framework.
- **Runs directly from source** — load repo root as unpacked extension at `chrome://extensions`.
- **No linter, no typecheck, no CI** — verify manually.
- **Tests**: `node test/tree-view.test.mjs` and `node test/backup-compat.test.mjs` (Node built-in `node:test`).

---

## 2. Project Structure (top-level)

```
Chrome_theme_for_homescreen/
├── manifest.json              # Chrome MV3 manifest
├── CLAUDE.md                  # Canonical agent instructions (READ FIRST)
├── AGENTS.md                  # OpenCode-specific agent guidance
├── PRODUCT_SPEC.md            # Exhaustive product + engineering spec (404 lines)
├── Design.md                  # Design system rules
├── README.md                  # User-facing readme
│
├── src/                       # === MAIN SOURCE ===
│   ├── domain/                # Entities, value objects, repo interfaces
│   ├── application/           # Use cases, ports, EventBus
│   ├── infrastructure/        # Chrome storage repos, services, DI container
│   └── presentation/          # Views, controllers, HTML, CSS
│
├── public/                    # Static assets
│   ├── fonts/                 # Doto, Space Grotesk, Space Mono (woff2)
│   ├── favicons/              # Bundled SVG icons for bookmark categories
│   └── icons/                 # Extension icons (16/32/48/128px)
│
├── test/                      # Unit tests
│   ├── tree-view.test.mjs     # isSafeUrl, normalizeBookmarkTree, filterNodes
│   ├── backup-compat.test.mjs # Old backup round-trip, garbage faviconUrl resilience
│   └── fixtures/              # old-backup.json
│
├── v2/                        # Earlier monolithic version (reference only)
│   └── index.html             # v2 design — block/chip layout (tree view matches this)
│
├── scripts/                   # Dev utilities (smoke tests, screenshots)
└── docs/                      # Plans
```

---

## 3. Architecture — Clean Architecture / DDD

Dependency rule: **outer layers import inner, never the reverse.**

```
Presentation → Application (use cases, ports, EventBus) → Domain (entities, VOs, repo interfaces)
                                                                    ↑ implemented by
                                                          Infrastructure (chrome repos, services, DI)
```

### 3.1 Domain Layer (`src/domain/`)

Knows nothing about Chrome, DOM, or storage. Owns invariants.

**Entities** (private `#` fields, invariant-enforcing mutators, `toJSON()` / `static fromJSON()`):
- `Bookmark` — id, title, url, categoryId, order, lastAccessed, accessCount, faviconUrl
- `Category` — id, name, order
- `Task` — id, title, completed, order, scheduledTime, durationMinutes
- `UserSettings` — 40+ fields: background, clocks, search, weather, theme, cssVar*, greeting, messageText, todo/shortcuts/quickNote toggles, customCss
- `WidgetLayout` — id, type (WidgetKind), x/y/w/h, visible. `defaults()` seeds 4 widgets

**Value Objects** (immutable):
- `Id` — opaque string wrapper
- `Url` — validates http(s) only, normalizes scheme-less input
- `BackgroundConfig` — BackgroundKind enum (local_image/remote_image/solid_color/gradient) + factory methods
- `TimeFormat` — "12h"/"24h" with toggle()
- `Greeting` — PartOfDay enum + fromHour() + render()
- `WidgetType` — WidgetType enum (greeting/clock/bookmarks/todo) + WidgetKind
- `WorldClockConfig` — label + IANA timeZone

**Repository interfaces** (`domain/repositories/repositories.js`):
BookmarkRepo, CategoryRepo, SettingsRepo, TaskRepo, LayoutRepo — all throw "not implemented".

### 3.2 Application Layer (`src/application/`)

One class per use case (`execute()` method), constructed with dependencies.

**Ports** (`application/ports/`):
- `EventBus` — synchronous pub/sub (`on()` returns unsubscribe; `emit()`)
- `IdGeneratorPort` — `next()` → string
- `ClockPort` — `now()` → Date
- `WeatherService` — `fetchWeather(location, unit)` → {locationName, temp, condition}
- `SanitizerPort` — `text(input)`, `url(input)`

**Use Cases** (~35 total, organized by domain):

| Domain | Use Cases |
|--------|-----------|
| Bookmarks | Create, Update, Delete, Reorder, List |
| Categories | Create, Rename, Delete (cascading), Reorder, List |
| Tasks | Create, Update, Delete, Reorder, List |
| Settings | Get, Save, UpdateUserName, UpdateTimeFormat, UpdateBackgroundAppearance, UpdateDailyFocus |
| Background | BuildGreeting, GetCurrentTime, UpdateBackground |
| Weather | GetWeather |
| Layout | Get, MoveWidget, ResizeWidget, ToggleWidgetVisibility |
| Shared | BaseDeleteUseCase, BaseReorderUseCase, BaseWidgetUseCase |

### 3.3 Infrastructure Layer (`src/infrastructure/`)

Only layer touching `chrome.*`, `fetch`, `crypto`, `IndexedDB`.

**Composition Root** — `src/infrastructure/di/container.js`:
- `buildContainer()` wires ALL repos, services, use cases. Returns frozen `{ events, useCases, internals }`.
- **Any new use case, repo, or service MUST be registered here.**
- Wires `chrome.storage.onChanged` → invalidate repo caches + re-emit domain events (cross-tab sync).

**Persistence** (`infrastructure/persistence/chromeStorage/`):
- `ChromeStorageClient` — thin wrapper over `chrome.storage.local`
- `BaseChromeListRepository` — generic list repo with in-memory cache + `invalidate()`
- Concrete repos: `ChromeBookmarkRepository`, `ChromeCategoryRepository`, `ChromeTaskRepository`, `ChromeLayoutRepository`, `ChromeSettingsRepository`
- Storage keys: `bookmarks`, `categories`, `settings`, `tasks`, `layout`

**Services**:
- `SystemClock` — implements ClockPort
- `UuidGenerator` — implements IdGeneratorPort (crypto.randomUUID() with fallback)
- `HttpWeatherService` — implements WeatherService (Open-Meteo API, no key needed)
- `AutoBackupService` — File System Access API + IndexedDB for persistent file handle

**Security**:
- `BasicSanitizer` — implements SanitizerPort: strips control chars, re-validates URLs

### 3.4 Presentation Layer (`src/presentation/`)

Three surfaces, all consuming the container (never concrete infra classes).

**Shared** (`presentation/shared/`):
- `dom.js` — `el(tag, props, ...children)`: safe DOM builder, NEVER innerHTML
- `icons.js` — `icon(name)` → inline SVG
- `favicon.js` — `websiteFaviconUrl()` → Google s2 service; `initial()` → first letter
- `i18n.js` — `t(key, ...args)` with English string table
- `styles/tokens.css` — PRIMARY design tokens (oklch colors, type scale, spacing, motion, density)
- `penta-bridge/theme.js` — JS mirror of tokens.css (must stay in sync)

**New Tab** (`presentation/newTab/`):
- `newTab.html` — entry point
- `newTab.css` — all new-tab styles
- `newTabController.js` — orchestrator: builds container, instantiates views, manages state, subscribes to events, renders conditionally

**Views** (`presentation/newTab/views/`):

| View | Purpose |
|------|---------|
| `BackgroundView.js` | Applies background: CSS vars, image handling, vignette, pixelation, grayscale, hue |
| `GreetingView.js` | Time-based greeting + messageText |
| `CombinedClockView.js` | Hero clock: local time, world clock, Pomodoro toggle |
| `SearchView.js` | Search input, Cmd+K, emits search:input/search:submit |
| `BookmarksView.js` | Category tabs, grid/list tiles, drag-drop, add/edit/delete, favicon management |
| `TreeView.js` | Full-screen Chrome bookmark tree, block/chip layout (v2 style), collapse, density, search |
| `TodoView.js` | TODAY'S FOCUS widget |
| `CalendarView.js` | Month grid with nav |
| `WeatherView.js` | Open-Meteo fetch, 30min refresh |
| `SettingsSidebarView.js` | Slide-in settings: background, clock, search, shortcuts, export/import, custom CSS |
| `ToastView.js` | Status toast |
| `PomodoroService.js` | 25/5 Pomodoro cycle |

**Popup** (`presentation/popup/`):
- `popup.html` / `popupController.js` — quick-add bookmark from active tab

**Options** (`presentation/options/`):
- `options.html` / `optionsController.js` — full settings page with live preview

**Service Worker** (`presentation/shared/serviceWorker.js`):
- Omnibox `nt` keyword: `nt todo <text>` → task; `nt note <text>` → quick note; `nt <url/query>` → opens URL

---

## 4. Data-Change Flow (single sync mechanism)

```
Use case mutates state
  → repo persists
    → use case emits on EventBus
      → controller's subscribe() re-fetches + re-renders

Also: chrome.storage.onChanged → invalidate repo caches → re-emit same events (cross-tab sync)
```

Events: `bookmarks:changed`, `categories:changed`, `settings:changed`, `tasks:changed`, `layout:changed`

---

## 5. Design System

- **Colors**: OLED black (#000), white (#fafafa), red (#D71921) only as interrupt
- **Fonts**: Doto (display/clock), Space Grotesk (body), Space Mono (meta/labels, ALL CAPS)
- **Tokens**: `src/presentation/shared/styles/tokens.css` (CSS) + `src/presentation/shared/penta-bridge/theme.js` (JS) — MUST stay in sync
- **Density variants**: compact (default), comfortable, dense — on `html[data-density]`
- **Theme presets**: minimal (default), nord, cyberpunk, sage — accent-only overrides
- **All DOM via `el()` helper** — never innerHTML
- **All input sanitized** through BasicSanitizer at use-case layer

---

## 6. Tree View (v2 block/chip layout)

The tree view (`TreeView.js`) renders Chrome bookmarks (`chrome.bookmaps.getTree`) in a block/chip layout matching `v2/index.html` exactly:

**DOM structure:**
```
.tree-view
  .tv-header > .tv-title + .tv-search + .tv-link-count + .tv-hint
  .tree[data-density="..."]
    .empty > .x + "No bookmarks match"
    .block[data-cat="folderId"]
      .block-head > .idx + .name + .n + .coll (chevron SVG, rotates on collapse)
      .chips
        .chip > .fav (--lk bg, --fkc color, Google s2 img) + .t
```

**CSS class mapping (v2 → extension):**
- `.tree` = scrollable container (not `.tv-body`)
- `.block` = category section (not `.tv-block`)
- `.block-head` / `.idx` / `.name` / `.n` / `.coll` = header row
- `.chips` / `.chip` / `.fav` / `.t` = bookmark grid
- `.collapsed` on `.block` hides `.chips`, rotates `.coll svg` -90deg
- Density: `.tree[data-density="compact"]`, `.tree[data-density="dense"]`

**Features:**
- Collapse/expand per folder, persisted to localStorage (`ntab:treeCollapsed`)
- Search filters chips within blocks, hides empty blocks
- Favicons: hash-based color tile + Google s2 service
- Link count in header updates on filter

---

## 7. Files to Avoid

Root scratch files (one-off artifacts, NOT part of the extension):
- `fix.js`, `fix_css.js`, `fix_ref_error.js`, `old_newTab.css`, `base64.txt`
- `src/ui_kits-app-index.html` (UI reference, not runtime)

---

## 8. Reference Documents

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Canonical agent instructions — READ FIRST |
| `AGENTS.md` | OpenCode-specific agent guidance |
| `PRODUCT_SPEC.md` | Exhaustive product + engineering spec (404 lines) |
| `Design.md` | Design system rules |
| `src/presentation/shared/styles/tokens.css` | Design tokens (source of truth) |
| `src/presentation/shared/penta-bridge/theme.js` | JS mirror of tokens |
| `src/infrastructure/di/container.js` | Composition root — wire everything here |
| `v2/index.html` | Reference design for tree view block/chip layout |

---

## 9. Key Stats

- 5 domain entities, 7 value objects
- 5 repository interfaces, 5 concrete repos
- 5 application ports, ~35 use cases
- 4 infrastructure services, 1 security service
- 3 presentation surfaces (newTab: 15 views, popup, options)
- 1 composition root (container.js)
- No build system — pure ES modules, runs from source
