# CLAUDE.md

> **Canonical location:** `docs/agents/CLAUDE.md` — moved from repo root `CLAUDE.md` (strict move 2026-08-21). Configure Claude Code to read `docs/agents/CLAUDE.md` if your tooling expects it at root.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Syncly — a Chrome MV3 new-tab replacement extension (vanilla JS, ES modules, no framework). The new tab is a two-pane **bookmark manager** over the user's real Chrome bookmarks: sidebar (workspace switcher + smart filters + collections tree) and a searchable card grid. Dark (`#121316` slate) and light (`#F8F9FA`) themes, terracotta `#D2683F`/`#E64A19` accent, Plus Jakarta Sans + JetBrains Mono. This replaced an earlier Nothing-Phone-inspired monochrome OLED widget dashboard (clock/Pomodoro/tasks/weather/curated-shortcuts) — see "What changed" below for what's still in the tree but no longer mounted.

[`AGENTS.md`](AGENTS.md) is a companion instruction file (written for OpenCode) covering the same ground — read it too if present (canonical at [`docs/agents/AGENTS.md`](AGENTS.md)); it may be stale on the redesign specifics below since it predates it.

## Commands

No build system, bundler, linter, or typecheck. The extension runs directly from source:

- **Run/test the extension**: load the repo root as an unpacked extension at `chrome://extensions` (Developer mode → Load unpacked), then open a new tab. After code changes, click the reload icon on the extension card (new-tab page changes only need a tab refresh; `manifest.json` or service-worker changes need the extension reload).
- **Debug**: DevTools on the new-tab page; for the service worker, use the "service worker" link on the extension card.
- **Unit tests**: `npm test` runs `node --test`, which discovers everything under `test/*.test.mjs` (currently `ai-quota-derive`, `backup-compat`, `deck-view`, `tree-view`). Pure Node, no Chrome needed.
- **Smoke test**: `npm run smoke` (`scripts/smoke.mjs`) and the `scripts/probe-deck*.mjs`/`tree-integration.mjs` dev scripts predate the bookmark-manager rewrite and target selectors (`#btn-tree`, `.deck-*`) that no longer exist — they were already broken before this pass and are not a reliable signal; don't use them to validate new-tab changes, and treat fixing them as a separate, unrequested cleanup.
- `scripts/smoke-ai-quota-backend.mjs` is a separate manual-only script (needs live Supabase env vars) — not part of `npm test`.

Constraint: MV3 CSP is `script-src 'self'; style-src 'self' 'unsafe-inline'` — no inline scripts, no external JS/CSS/fonts (Google Fonts CDN is blocked; fonts must be self-hosted under `public/fonts/`).

## Architecture

Strict Clean Architecture / DDD layering under `src/`. Dependency rule: outer layers import inner, never the reverse.

```
presentation  →  application (use cases, ports, EventBus)  →  domain (entities, VOs, repo interfaces)
                                                                  ↑ implemented by
infrastructure (chromeStorage repos, services, sanitizer, di/container.js)
```

- **Domain** (`src/domain/`) knows nothing about Chrome, DOM, or storage. Entities use private `#` fields with invariant-enforcing mutators, plus `toJSON()` / `static fromJSON()`. Repository *interfaces* live in `domain/repositories/repositories.js`.
- **Application** (`src/application/useCases/`) — one class per use case (`execute()` method), constructed with its dependencies. Ports (Clock, IdGenerator, Sanitizer, WeatherService, EventBus, BackupTargetPort) live in `application/ports/`.
- **Infrastructure** (`src/infrastructure/`) is the only layer that touches `chrome.*` / `fetch`. List repos in `persistence/chromeStorage/` extend `BaseChromeListRepository` (in-memory cache + `invalidate()`) over a shared `ChromeStorageClient` (hardcoded to `chrome.storage.local`). `ChromeBookmarkGroupRepository`, `ChromeBookmarkTagRepository`, and `ChromeBookmarkCollectionRepository` (`infrastructure/repositories/`) are the odd ones out — native-Chrome-bookmark-id-keyed data, so they talk to `chrome.storage.local` directly rather than through `ChromeStorageClient`/`BaseChromeListRepository`. Local storage keys in active use: `bookmarks`, `categories`, `settings`, `tasks`, `layout`, `subfolders`, `bookmarkGroups`, `bookmarkTags`, `bookmarkCollections`, `quickieFolderId`, `quickieMigrated`, `bookmarkUsage`, `bookmarkLastOpened`, `activeBookmarkGroup`. `ChromeSyncStorageClient` exists for `chrome.storage.sync` but is not wired into the DI container.
- **Presentation** (`src/presentation/`) has four surfaces: `newTab/` (the bookmark-manager workspace: `newTabController.js` + `views/BookmarkDeckView.js` as the sole content view + `SettingsSidebarView`), `popup/` (quick-add with one-click Save to Quickie or folder picker, writes native `chrome.bookmarks`), `options/`, and `shared/serviceWorker.js` (also handles the `nt` omnibox keyword). Views/controllers only consume the container — never concrete infra classes.

### The new tab is a REAL Chrome bookmarks browser, not the app's old curated list

`BookmarkDeckView.js` reads `chrome.bookmarks.getTree()` directly (native folders/bookmarks — potentially hundreds/thousands of items), not the domain `Category`/`Subfolder`/`Bookmark` entities.
- **Quickie**: A temporary inbox backed by a real native Chrome folder ("Quickie" under "Other Bookmarks"). `EnsureQuickieFolderUseCase` lazily/eagerly creates it and ran a one-time migration for loose root bookmarks (`quickieMigrated` key).
- **All Bookmarks**: Complete searchable library defaulting to list view density (`_viewMode = "list"`).
- **Collections**: Curated bundles of bookmarks referencing native bookmark IDs cross-cutting workspaces (`ChromeBookmarkCollectionRepository`, key `bookmarkCollections`, shape `{ [collectionId]: { id, name, bookmarkIds, createdAt, updatedAt } }`) + use cases under `application/useCases/collections/` (`List`, `Create`, `UpdateMembers`, `Delete`, `Rename`). Pure helper `resolveCollectionLeaves(bookmarkIds, leafIndex)` resolves members against the full unscoped tree.
- **Sidebar & Header**: Quick nav: `All Bookmarks` (grid icon), `Quickie` (inbox icon, drop target), `Collections` (layers icon). Folder tree section is titled `BOOKMARKS`. Header features a "Select" button enabling multi-select checkbox mode and a floating bulk action bar to add selected items to new or existing collections.
- **Workspace switcher**: The `BookmarkGroup` entity + its use cases (`create/update/delete/listBookmarkGroup`, `setActiveGroup`) — scopes the `BOOKMARKS` folder tree.
- **Tags**: Persisted in side table `ChromeBookmarkTagRepository` (key `bookmarkTags`, shape `{ [bookmarkId]: string[] }`) + `ListBookmarkTagsUseCase`/`SetBookmarkTagsUseCase` (`application/useCases/tags/`).

### What changed (bookmark-manager redesign & navigation restructure)

The new tab used to be a widget dashboard (dot-matrix clock + Pomodoro, tasks, weather, calendar, and a small curated "shortcuts" grid backed by the domain `Category`/`Subfolder`/`Bookmark` entities). That whole surface was replaced. **Nothing was deleted** — the old view classes, their use cases, and their CSS are still in the tree, just no longer constructed/mounted by `newTabController.js`:

- Widgets: `GreetingView`, `BackgroundView`, `SearchView` (the old omnibox-style search — `BookmarkDeckView` has its own built-in search bar now), `WeatherView`, `CombinedClockView`/`PomodoroService`, `TodoView`, `CalendarView`, `TimerReminderView`.
- The curated-shortcuts stack: domain `Category.js`/`Subfolder.js`/`Bookmark.js`, their ~15 use cases under `application/useCases/{bookmarks,categories,subfolders}/`, and `BookmarksView.js`/`CategoryTabs.js`.
- `TreeView.js`'s `TreeView` class (full-screen tree explorer) is superseded by `BookmarkDeckView`, but its pure helpers (`isSafeUrl`, `buildBookmarkTree`, `filterTree`, `countLeaves`) are still imported by it.
- Restructuring pass: Replaced Unsorted/Favorites with Quickie (inbox folder) and Collections (curated bundles index/detail), renamed folder section to BOOKMARKS, added list-first default density and multi-select bulk collection adding.

Reviving any of the above means re-wiring it into `newTabController.js`'s view list — it's otherwise dead code, a known cleanup candidate. `src/presentation/options/*` was untouched by the redesign.

### Composition root — `src/infrastructure/di/container.js`

`buildContainer()` is the ONLY place concrete infrastructure is wired. It returns a frozen `{ events, useCases, internals }` (`internals` is for tests only). **A new use case, repo, or service must be registered here.**

### Data-change flow (the single sync mechanism)

Use case mutates state → repo persists → use case emits on the `EventBus` (`bookmarks:changed`, `categories:changed`, `settings:changed`, `tasks:changed`, `layout:changed`, `subfolders:changed`, `bookmarkGroups:changed`, `bookmarkTags:changed`, `bookmarkCollections:changed`) → subscribers re-fetch and re-render. `BookmarkDeckView` additionally listens directly to `chrome.bookmarks.onCreated/onRemoved/onChanged/onMoved/onChildrenReordered/onImportEnded` (debounced) since it renders *live* native bookmarks, not a cached domain repo. The container also wires `chrome.storage.onChanged` (local area only) → invalidate repo caches + re-emit the same events, which is how changes from other tabs/popup/options propagate. Follow this pattern for any new mutation: sanitize inputs via the sanitizer port, persist, emit.

### Theme (`colorMode`)

`UserSettings.colorMode` (`"dark"|"light"`, default `"dark"`) is applied as `document.documentElement.setAttribute("data-color-mode", ...)`. `tokens.css` defines the dark palette on `:root` and light overrides under `html[data-color-mode="light"]` — every other stylesheet consumes the CSS custom properties (`--bg`, `--surface`, `--surface-2`, `--fg`, `--muted`, `--border`, `--accent`, `--accent-primary`, `--font-*`, etc.), never hardcoded hex, so both themes stay in sync automatically. The toggle lives in `BookmarkDeckView`'s header and in Settings → Appearance. The old per-CSS-variable "Color Sandbox" picker and `themePreset` accent-swap system were removed as part of this (the `themePreset` domain field is left alone for storage back-compat, it just has no visual effect anymore).

### Backup (two independent mechanisms)

- **`AutoBackupService`** (`infrastructure/services/`) — daily local JSON backup via the File System Access API, with an IndexedDB (`neptab-backup-db`) fallback when that API isn't available. `backupAllowlist.js` defines which storage keys get included (includes `bookmarkTags`/`bookmarkGroups`/`bookmarkUsage`).
- **`GitHubBackupService`** + `PushBackupToGitHubUseCase` (`application/useCases/backup/`) — pushes the same backup payload to a private GitHub Gist. The PAT is stored under `chrome.storage.local` key `githubBackupPAT` (gist id under `githubBackupGistId`); never logged or included in thrown errors.

### AI-quota tracking (scaffolded, not wired up)

`docs/AI-Quota-Tracker-Extension-Build-Task.md` specs a Supabase-backed AI provider quota tracker (raw `fetch` to PostgREST `/rest/v1/`, Bearer PAT, schema in `supabase/schema.sql`). So far only the pure derivation logic exists (`src/domain/services/quotaDerivation.js`, covered by `test/ai-quota-derive.test.mjs`) plus a manual backend smoke script and a standalone `dashboard/index.html` (loads `@supabase/supabase-js` from a CDN — that page is *not* part of the extension bundle, so its CDN script doesn't violate the extension's CSP). No use case, repo, or container wiring exists yet for this feature.

### Design tokens & fonts

`src/presentation/shared/styles/tokens.css` is the sole source of truth for colors/typography/spacing (dark default + `[data-color-mode="light"]` overrides, see Theme above). Fonts are self-hosted variable `.woff2` files under `public/fonts/` with plain `@font-face` rules in `public/fonts/fonts.css` (Plus Jakarta Sans, JetBrains Mono, plus the still-present but no-longer-referenced Doto/Space Grotesk/Space Mono from the old widget dashboard). `src/presentation/shared/colorHash.js` holds the deterministic string→color helpers (`getThumbGradient`, `getFolderColor`) shared by `BookmarkDeckView` (card covers, tree swatches) and `popupController.js` (workspace swatch) — re-derive, don't duplicate.

`src/presentation/shared/penta-bridge/theme.js` + `penta-bridge/tokens.css` are a **separate**, untouched palette used only by the old widget dashboard's canvas primitives (`penta-bridge/primitives/*`, e.g. the halftone effect) — they were deliberately left as-is since nothing that imports them is mounted anymore. Don't assume they mirror `shared/styles/tokens.css`; they don't.

## Reference docs

- [`PRODUCT_SPEC.md`](../../PRODUCT_SPEC.md) — exhaustive product + engineering spec; section 5 (New Tab) and the widget sections predate the bookmark-manager redesign and describe the old dashboard — treat as historical/stale until updated, prefer reading source for current new-tab behavior.
- [`Design.md`](../design/Design.md) — design system notes; predates the redesign's terracotta/Plus-Jakarta-Sans visual system.
- [`AI-Quota-Tracker-Extension-Build-Task.md`](../AI-Quota-Tracker-Extension-Build-Task.md) — spec for the not-yet-wired AI-quota feature above.
- `OPTIMIZATION_PLAN.md` (if present at repo root) — architecture audit / known-issues list from a past pass; useful context, may be stale on specifics.

## Repo hygiene

`shot.mjs` at the repo root is a personal screenshot harness with a hardcoded absolute path (`e:/Chrome_theme_for_homescreen`) — don't rely on it working from another checkout location, and don't extend it as if it were a maintained script.
