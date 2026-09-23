# Syncly — Complete App Context Memory

> **Purpose:** Single source of truth for every feature, surface, data key, event, permission, and architectural rule in the Syncly Chrome extension. Intended as persistent context for humans and AI agents. Prefer this over `PRODUCT_SPEC.md` (historical) and `docs/PROJECT_SUMMARY.md` (stale).
>
> **Last verified against source:** 2026-09-23 · **Version:** 1.1.0 (workspace-owned collections/shortcuts) · **MV3** · min Chrome 114
>
> **How to load this doc:** Read this file first. Then `docs/agents/CLAUDE.md` for working rules. Read source only when this doc and source disagree — then update this doc.

---

## 1. What Syncly Is

**Syncly** is a privacy-first Chrome Manifest V3 **new-tab replacement** that is a full **bookmark manager over the user's real Chrome bookmarks** (`chrome.bookmarks.getTree()`), not a private second database.

- **Tagline:** "Sync everywhere, stay local."
- **Stack:** Vanilla JS ES modules, zero runtime deps, zero build step, zero telemetry, zero content scripts, zero host permissions.
- **Identity:** Local-first / privacy-first is product identity, not a flag.
- **License:** MIT · Repo: `https://github.com/KamrulIslamArnob/Syncly`
- **Brand rename:** Was **NothingTab** (Nothing-Phone-inspired OLED widget dashboard). Redesigned into the current two-pane bookmark deck; brand is now **Syncly**. Some legacy names remain in storage/index IDs only (`neptab-*` IndexedDB fallbacks, `ntab:*` localStorage keys) — do not rename those without a migration.

### Design philosophy (non-negotiable)

1. **Speed is the feature** — must feel instant at 2,000+ bookmarks.
2. **The user's bookmarks are the truth** — Syncly organizes Chrome's real tree; never becomes a divergent database of record for bookmarks.
3. **Zero-friction trust** — no accounts, no servers, no data exfiltration.
4. **Chrome does the syncing** — prefer native bookmark sync + `chrome.storage.sync` over inventing transports.
5. **Small and auditable** — vanilla, no-build, dependency-light.

---

## 2. Entry Points & Surfaces

| Surface | Manifest wiring | Main file | Role |
| :--- | :--- | :--- | :--- |
| **New Tab** | `chrome_url_overrides.newtab` | `src/presentation/newTab/newTab.html` → `newTabController.js` | Primary product. Mounts `BookmarkDeckView` + `SettingsSidebarView` + `ToastView`. Applies theme, auto-backup timer (visible tab), `Cmd/Ctrl+K`. Exposes `window.__newTab`. |
| **Popup** | `action.default_popup` | `src/presentation/popup/popup.html` → `popupController.js` | Quick-add active tab: Bookmark / Shortcut / Collection modes, workspace selector, tags, "Quickies" 1-click. Detects already-saved URLs. |
| **Side Panel** | `side_panel.default_path` = `popup.html?sidepanel=1` | same popup with `?sidepanel=1` | Popup re-used as full-height panel (`.is-sidepanel`). Toolbar click opens popup, not panel (`setPanelBehavior({ openPanelOnActionClick: false })`). Separate `sidepanel/sidepanel.html` iframe shell exists but is **not** the manifest target. |
| **Options** | `options_ui.page`, `open_in_tab: true` | `src/presentation/options/options.html` → `optionsController.js` | Full-page settings (identity, background, appearance, widgets, clocks, categories, bookmarks). Still uses legacy domain Category/Bookmark entities. |
| **Service Worker** | `background.service_worker`, `type: "module"` | `src/presentation/shared/serviceWorker.js` | Omnibox `nt`, cross-device sync receiver, startup reconcile, 15-min alarm, context menu → side panel. **Does not use DI container** (File System Access API would throw in SW). |
| **Omnibox** | `"omnibox": { "keyword": "nt" }` | serviceWorker.js | `nt todo …` → task; `nt note …` → quick note; else open URL or search. |

---

## 3. Feature Inventory (complete)

### 3.1 Bookmark browsing (new tab core)

- Real tree browser via `chrome.bookmarks.getTree()` — folders + nested links at scale.
- Two-pane layout: **sidebar** (nav + folder tree) + **main stage** (header + card grid/list).
- **Density modes:** Compact / List / Grid (localStorage `syncly_home_layout_style`; list default for All Bookmarks).
- **Focus mode:** Greeting + clock + hero search + shortcuts; collapses sidebar (`GreetingView`, `CombinedClockView`, `PomodoroService` re-mounted inside deck Home).
- **Home triage row:** Quickie-to-file · gone cold · duplicates — each opens a filtered list view (`cold`, `duplicates` selection types).
- **Folder views:** list every nested link; sub-folder chips filter in place.
- **Folder colors:** sibling-position palette `--folder-pal-0…4` + per-folder override in `bookmarkFolderColors`.
- **Card covers:** deterministic gradients via `colorHash.getThumbGradient`.
- **Live listeners:** `chrome.bookmarks.onCreated/onRemoved/onChanged/onMoved/onChildrenReordered/onImportEnded` (debounced `_scheduleLoad`).
- **Multi-select:** header ⋮ → Select; floating bulk bar (add to collection, etc.).
- **Drag-drop:** move/reorder bookmarks and folders (`chrome.bookmarks.move`).
- **Add / edit:** `NewFolderDialogView`, `BookmarkEditDialogView`, `BookmarkPickerModalView`, `ConfirmDialogView`, `FolderTreeSelectorView`.

### 3.2 Quickie (inbox)

- Native folder **"Quickie"** under Other Bookmarks.
- Created lazily by `EnsureQuickieFolderUseCase` (cached id `quickieFolderId`).
- Popup "Quick Add to Quickies"; sidebar drop target.

### 3.3 Workspaces (BookmarkGroup)

- Contextual scopes (Work, Personal, …) that filter the BOOKMARKS folder tree.
- Each workspace = dedicated native folder titled `w-{name}` under Other Bookmarks → rides **Chrome native bookmark sync** (quota-proof).
- **v2 ownership structure (canonical):** each `w-*` root owns its own **`Collections`** + **`Shortcuts`** children. Quickie stays **global** (Other Bookmarks only) and is never duplicated into a workspace.
- Naming helpers: `src/domain/services/workspaceNaming.js` (`WORKSPACE_PREFIX = "w-"`).
- Active workspace: storage key `activeBookmarkGroup`; UI `GroupProfileButtonsView` + `GroupDialogView` + `IconPickerView`.
- Entity field **`rootFolderId`** is the preferred ownership boundary (`folderIds[0]` is legacy fallback). `RESERVED_ROOT_CHILDREN = ["Collections", "Shortcuts"]` (case-insensitive at workspace root only).
- Structure use cases: `ResolveWorkspaceStructureUseCase` (read-only), `EnsureWorkspaceStructureUseCase` (idempotent bootstrap + `workspaceSystemFolders` cache), `MigrateWorkspaceStructureV2UseCase` (flag `workspaceStructureVersion: 2`).
- Reserved workspace **names** blocked (Quickie, Shortcuts, Collections, Bookmarks bar, …); max 50 folders per workspace. New-folder dialog also blocks reserved **child titles**.
- Startup migration/adopt: `AdoptNativeWorkspaceFolders` → ensure Collections folder → **`migrateWorkspaceStructureV2`** (container chain).
- Per-workspace theme overrides: `settings.workspaceThemes[id]`.
- CRUD use cases: `CreateBookmarkGroup` (bootstraps structure), `UpdateBookmarkGroup` (accepts `rootFolderId`), `DeleteBookmarkGroup` (clears structure cache), `ListBookmarkGroups`, `SetActiveGroup`.
- Events: structural refresh via `bookmarkGroups:changed`; active switch via **`bookmarkGroup:changed`** (singular) → deck reloads scoped collections/shortcuts/sidebar.

### 3.4 Collections

- Curated bundles of **native bookmark IDs**, **owned by a workspace** when `workspaceId` is set (workspace-owned model).
- Storage: `bookmarkCollections` map `{ [id]: { id, name, bookmarkIds, bookmarkUrls, workspaceId, folderId, createdAt, updatedAt } }`.
- Native folder path: **`w-{ws}/Collections/{name}`** when `workspaceId` is set; legacy global `Other Bookmarks/Collections` only for unscoped/migration.
- List filtering: `ListBookmarkCollectionsUseCase.execute({ workspaceId, includeUnscoped })` — omit `workspaceId` for all (migration / All Bookmarks unscoped view).
- UI: collections index/detail in deck (workspace-filtered via `_getVisibleCollections`); `CollectionDialogView` passes `workspaceId`; multi-select + bulk add; `BookmarkPickerModalView`.
- Use cases: `List/Create/UpdateMembers/Delete/RenameBookmarkCollection*`.
- Helper: `resolveCollectionLeaves(bookmarkIds, leafIndex)`.

### 3.5 Tags

- Side table `bookmarkTags`: `{ [bookmarkId]: string[] }`.
- `SetBookmarkTagsUseCase`: trim, lowercase, strip `#`, dedupe, cap.
- Tag filter bar + pills on cards; popup suggested hashtag chips (keyword extraction).
- Dialog: `BookmarkTagsDialogView`.

### 3.6 Shortcuts / Categories (legacy-adjacent, still mounted)

- **v2:** native **`w-{ws}/Shortcuts`** when a workspace is active; global `Other Bookmarks/Shortcuts` only when no workspace (legacy migration / All Bookmarks). **Central resolver:** `ResolveShortcutsFolderUseCase.execute({ workspaceId, tree, ensure })` → `{ mode: "workspace"|"global", shortcutsFolderId, path }`. Views call this instead of re-branching (`EnsureShortcutsFolderUseCase` remains the ensure primitive).
- Circular shortcut UI: `ShortcutDialogView`, `CategoryDialogView` (deck sets `shortcutsFolderId` from `resolveShortcutsFolder` on each load).
- Domain entities `Category` / `Bookmark` / `Subfolder` still used by **options page** CRUD.
- Optional one-time move of Bookmark Bar → Shortcuts/"Quick Access" (`MigrateBookmarkBarToQuickAccessUseCase`, flag `moveBookmarksToQuickAccessMigrated`).

### 3.7 Search & keyboard

- In-deck / hero search over `OmniSearchIndex` (inverted prefix index + 250-entry query cache).
- **`Cmd/Ctrl+K`** focus search (global).
- **`[`** toggle sidebar collapse; **`Esc`** exit select → clear query → close dialogs; **`Cmd/Ctrl+Enter`** popup submit.
- Card: Enter/Space open; modifier clicks for background/new window.
- Omnibox keyword **`nt`** (see §2).
- Search engines in SW: google, youtube, duckduckgo, bing (options may offer yahoo — SW falls back to google if unknown).

### 3.8 Freshness / signal / prune

- Bands via `shared/signal.js`: **live** (≤7d), **rest** (≤90d or saved≤90d never opened), **cold** (≥90d or never+old).
- Data: `bookmarkUsage`, `bookmarkLastOpened`, `bookmarkLastOpenedAt`, `bookmarkSignalSince`, Chrome `dateLastUsed`/`dateAdded`.
- UI: signal strip + **Prune** above folder grids; meta line `folder · last opened · open count` (count in grid only); Home triage uses same bands.

### 3.9 Tasks / To-Do

- Right-slide To-Do panel inside deck; due presets via `dateUtils.dueForPreset`.
- Entity `Task`: title, completed, order, scheduledTime, durationMinutes, dueDate.
- Use cases: List/Create/Update/Delete/Reorder Tasks → event `tasks:changed`.
- Omnibox `nt todo …` also appends tasks.

### 3.10 Themes & appearance

- **Color mode:** `UserSettings.colorMode` ∈ `{dark, light}` → `data-color-mode` on `<html>`.
- **Theme presets (14):** `aurora, glacier_mist, orchid_bloom, ocean_pearl, retro_grid, diamond_storm, graphite_flow, sky_deep_sea, rose_gold, solid, minimal, nord, cyberpunk, sage`.
- Featured starters: `["aurora","glacier_mist","orchid_bloom","ocean_pearl"]`.
- **ThemeEngine** (`shared/theme/ThemeEngine.js`) applies `data-theme-preset`, accent shades, font scale, sanitized custom CSS.
- **Custom themes:** save / import / export / delete (JSON manifest); storage `customThemes`; use cases under `useCases/themes/`; import guards `__proto__`/`constructor`/`prototype`.
- **Font size:** `data-font-size` small/default/large/xlarge → `--ui-font-scale` 0.88 / 1 / 1.14 / 1.28.
- **Accent:** custom color + eyedropper + WCAG contrast readout; workspace-scoped themes via `settings.workspaceThemes`.
- **Background system** (options + `BackgroundView`): kinds `local_image | remote_image | solid_color | gradient` + blur/overlay/tint/etc. on `UserSettings`.
- Settings sidebar cards: Appearance & Theme, Focus Mode & Clock, Shortcuts, Backup & Restore, GitHub Gist Sync, Google Cloud Sync, Custom CSS, Extension Reload, Danger Zone.

### 3.11 Wallpapers / shaders

- Entity `Wallpaper` (frozen): `shaderId`, `colors[]`, `noise`, `intensity` — validated against `ShaderRegistry`.
- Shader kit: `shared/theme/shaders/` (vapor family; default `vapor-bloom`).
- `deriveWallpaperColors.js` for perceptual OKLCH-ish derivation.
- Specs: `docs/superpowers/specs/2026-09-07-parametric-wallpaper-system-design.md`.

### 3.12 Backups (local + GitHub Gist)

| Mechanism | Service | Notes |
| :--- | :--- | :--- |
| **Auto local JSON** | `AutoBackupService` | File System Access API; IndexedDB handle store `syncly-backup-db` (legacy `neptab-backup-db`); dirty-hash `syncly:lastBackupHash` / `ntab:lastBackupHash`; 1-min dirty check on visible tab; Resume on revoked permission (`requires_permission`). |
| **Manual export/import** | Settings sidebar | `filterBackupData` + `validateImportData` (allowlist + type checks). |
| **GitHub Gist** | `GitHubBackupService` + `PushBackupToGitHubUseCase` | PAT AES-GCM encrypted (`patCrypto`, IDB `syncly-pat-keys`); keys `githubBackupPAT`, `githubBackupGistId`, `githubBackupFilename`; never logs PAT. Emits `backup:pushed` (currently no subscriber). |

**Backup allowlist (19 keys):** `bookmarks, categories, settings, tasks, layout, subfolders, bookmarkGroups, bookmarkTags, bookmarkCollections, quickNote, bookmarkUsage, bookmarkLastOpened, bookmarkLastOpenedAt, bookmarkSignalSince, activeBookmarkGroup, aiQuotaCache, aiQuotaPrefs, popupColorMode, customThemes`  
**Sensitive denylist (never in backups):** GitHub PAT/gist/filename (+ doc-only `aiQuotaPAT`).

### 3.13 Cross-device sync

- **Mirror allowlist `SYNC_KEYS`:** `categories, bookmarks, settings, bookmarkGroups, bookmarkCollections, bookmarkTags` (+ `syncTombstones` in both areas).
- **Merge keys** (item-level, never whole-key overwrite): `bookmarkGroups, bookmarkBookmarkCollections` → actually `bookmarkCollections`, `bookmarkTags` — see `crossDeviceSync.js` `MERGE_KEYS = [bookmarkGroups, bookmarkCollections, bookmarkTags]`.
- **Tombstones:** `syncTombstones`, TTL 30 days.
- **Guards:** 8KB/item quota (`MAX_SYNC_ITEM_BYTES=8000`); `isOwnEcho` skip.
- **Triggers:** SW `storage.onChanged` (sync area); `onStartup`/`onInstalled` → `reconcile()`; alarm **`syncly-sync-reconcile`** every 15 min; container startup `autoHydrateIfNeeded()`; manual Push/Pull in settings (`SyncFromGoogleCloudUseCase`).
- **Native fallback:** `w-*` workspace folders + Collections native subfolders ride Chrome bookmark sync.

### 3.14 Side panel & context menu

- Context menu **`open_side_panel`** ("Open from sidebar") on toolbar action → `chrome.sidePanel.open()`.
- Popup open-from-sidebar button.

### 3.15 AI quota (scaffolded only — not wired)

- Pure logic: `src/domain/services/quotaDerivation.js` + `test/ai-quota-derive.test.mjs`.
- Spec: `docs/AI-Quota-Tracker-Extension-Build-Task.md`; schema `supabase/schema.sql`; manual `scripts/smoke-ai-quota-backend.mjs`; standalone `dashboard/index.html` (not in extension bundle).
- **No use case, repo, or container wiring.** Allowlist mentions `aiQuotaCache`/`aiQuotaPrefs` but src does not read/write them yet.

### 3.16 Security posture

- **No** content scripts, **no** host_permissions, **no** remote code, **no** `eval`.
- DOM only via `el()` + `textContent` — never `innerHTML` for user data.
- URL allowlist: `isSafeUrl()` / domain `Url` → http/https only.
- `BasicSanitizer.text/url`; `cssSanitizer.sanitizeCss` for custom CSS.
- CSP: `script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://api.github.com https://geocoding-api.open-meteo.com https://api.open-meteo.com`
- PAT at rest: AES-GCM, non-extractable CryptoKey in IndexedDB.

---

## 4. Architecture

### 4.1 Layers (dependency rule: outer → inner only)

```
presentation  →  application (use cases, ports, EventBus)  →  domain (entities, VOs, repo interfaces)
                                                                  ↑ implemented by
                                                    infrastructure (repos, services, sanitizer, di/container.js)
```

| Layer | Path | Owns |
| :--- | :--- | :--- |
| Domain | `src/domain/` | Entities, value objects, pure services, repo **interfaces**. No Chrome/DOM. |
| Application | `src/application/` | One class per use case (`execute()`), ports, EventBus. |
| Infrastructure | `src/infrastructure/` | Only place touching `chrome.*` / `fetch` / IndexedDB. |
| Presentation | `src/presentation/` | Views, controllers, HTML/CSS. Only talks to container. |

### 4.2 Composition root

**`src/infrastructure/di/container.js`** — sole wiring point. Returns **frozen** `{ events, useCases, internals }` (`internals` for tests only).

- Wires list repos, native-id repos, theme repo, sanitizer, clock, ids, EventBus, AutoBackup, GitHubBackup, GoogleSync, Ensure* use cases, AdoptNativeWorkspaceFolders, **Resolve/Ensure WorkspaceStructure + MigrateWorkspaceStructureV2 + ResolveShortcutsFolder**.
- `storage.onChanged` **local** → invalidate caches + re-emit `*:changed`.
- `storage.onChanged` **sync** → filter SYNC_KEYS/tombstones, skip own echo → `googleSync.applyRemoteChanges()`.
- Startup: `autoHydrateIfNeeded()` → adopt workspaces → ensure Collections folder → **`migrateWorkspaceStructureV2`**.
- Registers `resolveWorkspaceStructure`, `ensureWorkspaceStructure`, `migrateWorkspaceStructureV2`, **`resolveShortcutsFolder`**; wires them into create group / create collection / ensure shortcuts. Deck + popup call `resolveShortcutsFolder` for SHORTCUTS destinations (workspace vs global).

**Any new use case, repo, or service must be registered here.**

### 4.3 Data-change flow (single sync mechanism)

```
UI action → controller → use case.execute()
  → sanitize → persist (repo / chrome.bookmarks)
  → events.emit("<domain>:changed")
  → subscribers re-fetch + re-render

Also: chrome.storage.onChanged (local) → invalidate + re-emit (cross-tab)
Also: chrome.bookmarks.* events → deck debounced reload (live native tree)
```

### 4.4 EventBus events

| Event | Primary emitters | Primary subscribers |
| :--- | :--- | :--- |
| `bookmarks:changed` | bookmark use cases, container, SyncFromGoogleCloud | BookmarkDeckView, options |
| `categories:changed` | category/subfolder use cases, container, sync | deck, options |
| `settings:changed` | SaveUserSettings, container, sync, SettingsSidebar | newTabController, deck, settings, GroupProfile, options |
| `tasks:changed` | task use cases, container | deck To-Do panel |
| `layout:changed` | ToggleWidgetVisibility, container | options |
| `subfolders:changed` | subfolder use cases, container | (emitted; few subscribers) |
| `bookmarkGroups:changed` | AdoptNativeWorkspaceFolders, EnsureWorkspaceStructure, MigrateWorkspaceStructureV2, container, sync | deck bulk refresh |
| **`bookmarkGroup:changed`** (singular) | GroupProfileButtonsView (active id) | newTabController, **deck (`_scheduleLoad` for structure-scoped data)**, SettingsSidebar |
| `bookmarkTags:changed` | SetBookmarkTags, container, sync | deck |
| `bookmarkCollections:changed` | EnsureCollectionsFolder, container, sync | deck |
| `themes:changed` | theme use cases, container (`customThemes`), SettingsSidebar | newTabController `applyTheme` |
| `backup:pushed` | PushBackupToGitHubUseCase | **none currently** |

EventBus: synchronous Map-of-Sets; `on()` returns unsubscribe; handler errors caught per-handler.

### 4.5 Domain entities (private `#` fields, mutators, `toJSON`/`fromJSON`)

| Entity | Key fields / invariants |
| :--- | :--- |
| `Bookmark` | title 1–120, url `Url`, categoryId, order≥0, lastAccessed, accessCount, faviconUrl, subfolderId |
| `Category` | name 1–60, order≥0 |
| `Subfolder` | name, categoryId, order |
| `Task` | title, completed, order, scheduledTime, durationMinutes, dueDate |
| `WidgetLayout` | type WidgetKind, x/y/w/h ≥1, visible (legacy widget grid; options only) |
| `UserSettings` | ~45 fields: name, background*, timeFormat, clocks[], search*, themePreset/Dark/Light, **colorMode**, weather*, focus*, widget toggles, customCss, cssVar*, greeting, messageText, clock flags, showWebsitePreviews, avatarUrl, **workspaceThemes**, moveBookmarksToQuickAccess, **fontSize**, etc. |
| `BookmarkGroup` | name ≤50 not reserved, icon `/^[a-z0-9_-]+$/i`, folderIds[] ≤50, **rootFolderId**, **RESERVED_ROOT_CHILDREN**, timestamps |
| `BookmarkCollection` | name ≤50, bookmarkIds[]/bookmarkUrls[] deduped, workspaceId, folderId, timestamps |
| `CustomTheme` | id, name, description, author, manifest ThemeManifest, timestamps |
| `ThemeManifest` | id, name, version, type builtin/custom/community, **modes {dark, light} both required** |
| `Wallpaper` | frozen; shaderId in registry; colors match colorSlots; noise/intensity 0–1 |

### 4.6 Value objects

`Id`, `Url` (http/https only, normalizes scheme-less), `BackgroundConfig`/`BackgroundKind`, `TimeFormat`/`ClockFormat`, `Greeting`, `WidgetType`/`WidgetKind`, `WorldClockConfig`, `WorldClockPresets` (14 cities + `__custom__`).

### 4.7 Domain services

| Service | Role |
| :--- | :--- |
| `OmniSearchIndex` | Inverted prefix index + query cache |
| `dateUtils` | Due presets, month grid, daily focus reset, header date |
| `quotaDerivation` | AI quota states (pure; unwired) |
| `ShaderRegistry` | Wallpaper shader defs |
| `ThemeRegistry` | Builtin theme ids + custom map; `DEFAULT_PRESET="aurora"` |
| `workspaceNaming` | `w-` prefix helpers |

### 4.8 Infrastructure services

| Service | Role |
| :--- | :--- |
| `SystemClock` / `UuidGenerator` | ClockPort / IdGeneratorPort |
| `AutoBackupService` | Local JSON auto-backup |
| `GitHubBackupService` | Gist backup |
| `GoogleSyncService` | storage.sync push/pull/reconcile/applyRemoteChanges |
| `crossDeviceSync` | Pure merge + tombstone helpers |
| `backupAllowlist` | Allowlist + filter/validate |
| `BasicSanitizer` / `cssSanitizer` / `patCrypto` | Security |

### 4.9 Repositories

**Via `ChromeStorageClient` + `BaseChromeListRepository` (key → cache):**  
`bookmarks`, `categories`, `settings`, `tasks`, `layout`, `subfolders`, `customThemes`

**Native-id repos (direct `chrome.storage.local`, optional sync dual-write):**  
`bookmarkGroups`, `bookmarkTags`, `bookmarkCollections`

`ChromeStorageClient` is hardcoded to **local**; dual-write mirror `SYNCABLE_KEYS` to sync on set/remove for the six SYNC_KEYS.

---

## 5. Storage model

### 5.1 `chrome.storage.local` (primary — all user data)

**Repo-backed:** `bookmarks`, `categories`, `settings`, `tasks`, `layout`, `subfolders`, `customThemes`, `bookmarkGroups`, `bookmarkTags`, `bookmarkCollections`

**Deck / signal:** `bookmarkUsage`, `bookmarkLastOpened`, `bookmarkLastOpenedAt`, `bookmarkSignalSince`, `bookmarkFolderColors`, `activeBookmarkGroup`

**Native-folder caches:** `quickieFolderId`, `shortcutsFolderId`, `collectionsFolderId`, **`workspaceSystemFolders`** (per-workspace structure cache; tree is truth), **`workspaceStructureVersion`** (migration flag), `moveBookmarksToQuickAccess`, `moveBookmarksToQuickAccessMigrated`

**Omnibox / notes:** `quickNote`

**Popup recents:** `popupLastFolder`, `popupRecentFolders`, `popupLastCategory`, `popupRecentCategories`, `popupLastCollection`, `popupRecentCollections`, `popupColorMode`

**GitHub (sensitive):** `githubBackupPAT`, `githubBackupGistId`, `githubBackupFilename`

**Tombstones:** `syncTombstones`

**Scaffolded AI (allowlist only, not wired):** `aiQuotaCache`, `aiQuotaPrefs`

### 5.2 `chrome.storage.sync` (mirror only)

`SYNC_KEYS` + `syncTombstones`. Never store large or sensitive data here. Merge keys go through `applyRemoteChanges()`/`reconcile()` only.

### 5.3 `localStorage` (page UI prefs)

`syncly-perf`, `syncly_home_layout_style` (legacy `neptab_home_layout_style`), `syncly_sidebar_collapsed`, `syncly_all_bookmarks_collapsed`, `syncly_settings_collapsed_${id}`, `syncly:lastBackupHash` / `ntab:lastBackupHash`, `toggleState`.

### 5.4 IndexedDB

| DB | Store / key | Purpose |
| :--- | :--- | :--- |
| `syncly-backup-db` (legacy `neptab-backup-db`) | `handles` / `backup-file` | File System Access handle for auto-backup |
| `syncly-pat-keys` | `keys` / `pat-aes-key` | AES key for GitHub PAT |

---

## 6. Permissions (manifest source of truth)

```json
["storage", "unlimitedStorage", "activeTab", "bookmarks", "tabs", "favicon", "alarms", "sidePanel", "contextMenus"]
```

| Permission | Why |
| :--- | :--- |
| `storage` | All extension state (local + sync mirror) |
| `unlimitedStorage` | Large libraries / tag indexes |
| `activeTab` | Read active tab title/URL when popup opened |
| `bookmarks` | Read/write native bookmark tree + live events |
| `tabs` | Open bookmarks, omnibox nav, popup autofill |
| `favicon` | Native `_favicon/` cache |
| `alarms` | 15-min `syncly-sync-reconcile` safety net |
| `sidePanel` | Open side panel |
| `contextMenus` | "Open from sidebar" on toolbar |

**No host_permissions. No content scripts. No web_accessible_resources.**

---

## 7. Design system

### 7.1 Fonts (self-hosted `public/fonts/fonts.css`)

| Font | Token | Status |
| :--- | :--- | :--- |
| **Plus Jakarta Sans** | `--font-display`, `--font-body` | Active |
| **JetBrains Mono** | `--font-mono` | Active |
| Doto, Space Grotesk, Space Mono | — | Present but unreferenced by current tokens (old dashboard) |

CSP blocks Google Fonts CDN.

### 7.2 Tokens — sole source of truth: `src/presentation/shared/styles/tokens.css`

- Dark on `:root`; light under `html[data-color-mode="light"]`.
- Surfaces dark: `--bg #121316`, `--surface #181A1E`, `--surface-2 #1E2025`, `--surface-active #2C3038`.
- Text: `--fg #E8EAEE`, muted `#8A919C` / `#6B7280`.
- Borders: `#24272D` / `#343841`.
- Accent default: `--accent #555B66` (+ primary/dark/light shades). Historical terracotta `#D2683F` / danger `#E64A19` appear in folder palette / status.
- Folder palette: `#D2683F, #6C6FD4, #7E9B76, #E0A33E, #C25A9E`.
- Signal: live `#7E9B76`, rest `#4B5563`, cold `#D2683F`.
- Radius: 6 / 10 / 16 / 999 / 12 · Motion: 160ms ease · Spacing: 4–32 · z-index: dialog 1000, toast 1100.
- Density: `html[data-density]` comfortable (default) / compact / dense.
- Light bg: `#faf8f2` / surfaces near-white; darker folder palette variants.

**Do not hardcode hex in feature CSS — consume CSS variables.**

**Do not confuse with:** `penta-bridge/tokens.css` (old monochrome canvas palette, loaded but unmounted primitives — deliberately divergent).

**CSS order (newTab):** fonts → tokens → penta-bridge → `newTab.css` → `redesign.css` (override layer).

### 7.3 Shared presentation utilities

`dom.js` `el()` · `icons.js` (100+ icons, `ICON_NAMES`) · `favicon.js` · `colorHash.js` · `colorUtils.js` (OKLCH, accent shades) · `signal.js` · `greetingIcons.js` · `theme/*`.

---

## 8. Chrome APIs used

`storage` (local/sync/onChanged) · `bookmarks` (getTree/create/update/move/remove/removeTree + 6 events) · `tabs` (create/update/query + onActivated/onUpdated) · `windows` (create/getCurrent/onFocusChanged) · `omnibox` · `alarms` · `runtime` (onInstalled/onStartup/reload/getURL/lastError) · `contextMenus` · `sidePanel` · Web: `crypto.randomUUID`, `crypto.subtle`, IndexedDB, `showSaveFilePicker`, `fetch` (GitHub only), `localStorage`, `Intl`.

**Not used:** identity, i18n, content scripts, host_permissions.

---

## 9. Commands, tests, scripts

### Commands

| Command | Purpose |
| :--- | :--- |
| `npm install` | devDependencies only (`puppeteer-core`, CSS parsers) |
| `npm test` | `node --test` → all `test/*.test.mjs` (**452 cases / 42 test files** as of 2026-09-23; **9 pre-existing fails** — missing `css-tree` install / helpers, not workspace-structure regressions) |
| `npm run perf` | `scripts/perf-baseline.mjs` — first-render / `_load` / heap harness (`?perf=1`, `--n/--out/--assert`, `CHROME_PATH`) |
| `npm run smoke` | `scripts/smoke.mjs` — **stale** (pre-redesign selectors); not a reliable signal |

### No build / no linter / no typecheck / **no CI workflows** (`.github/` has templates only).

### Test coverage map

Domain entities/VOs · date/shader/wallpaper · use cases · EventBus + sync services · collections · cross-device + native workspaces · **workspace structure (resolve/ensure/migrate v2)** · backup + GitHub · security · deck shell/cards/home/collections/signal · tree helpers · presentation helpers · theme/wallpaper/shaders/OKLCH · repositories · AI quota derivation.

Docs: `docs/TEST_CASES.md`, `docs/TESTING_STANDARD.md`.

---

## 10. What changed from the old widget dashboard

**Replaced:** Nothing-Phone OLED widget dashboard (dot-matrix clock/Pomodoro, tasks widget, weather, calendar, curated shortcuts grid over domain Category/Bookmark lists).

**Now:** Two-pane real-bookmarks manager (`BookmarkDeckView`).

| Artifact | Status |
| :--- | :--- |
| `WeatherView`, `SearchView`, `TodoView`, `CalendarView`, `TimerReminderView`, `BookmarksView`, `CategoryTabs`, `HttpWeatherService` | **Deleted** (docs that say "still in tree" are wrong) |
| Domain Category/Subfolder/Bookmark + ~15 use cases | Alive for **options** + migration only |
| `WidgetLayout` / layout use cases | Options widget toggles only |
| `BackgroundView` | Mounted by **options**, not newTabController |
| `TreeView` class | Superseded; **pure helpers** still imported by deck/dialogs |
| `GreetingView`, `CombinedClockView`, `PomodoroService` | Re-mounted in **Focus/Home** |
| `CategoryDialogView`, `ShortcutDialogView` | Still mounted for Shortcuts |
| `penta-bridge/*` | Loaded, primitives unmounted |
| Doto / Space fonts | Unreferenced |
| `sidepanel/sidepanel.html` | Orphan vs manifest path |
| Pre-redesign scripts (`smoke`, `probe-deck*`, `tree-integration`) | Broken selectors |

---

## 11. Known doc/code discrepancies (do not trust blindly)

| Claim | Reality |
| :--- | :--- |
| README "372 tests passing" | Badge/docs now say **452 total** (yellow; 443 pass / 9 pre-existing fail as of 2026-09-23 workspace-structure work) |
| CHANGELOG "GitHub Actions CI" | Fixed → noted as planned, not present |
| CONTRIBUTING "Ensure CI Passes" | Fixed → local `npm test` required; no CI yet |
| PRODUCT.md `perf-report.json` | Fixed → file not in tree; run `npm run perf` |
| README / CHROMEWEBSTORE missing 3 permissions | Fixed → full 9-permission tables |
| CLAUDE.md "`ChromeSyncStorageClient` exists" | **Not in tree** (still stale in CLAUDE body) |
| CLAUDE.md "Nothing was deleted" (old views) | Weather/Todo/Calendar/Search views **deleted** (still stale in CLAUDE body) |
| CLAUDE.md "themePreset has no visual effect" | ThemeEngine still applies `data-theme-preset` — treat as uncertain |
| AGENTS.md "~35 use cases", 8 storage keys | ~50 use cases; many more keys (see §5) |
| PRODUCT_SPEC / PROJECT_SUMMARY title "NothingTab" | Banners mark historical; product is **Syncly** |
| `quickieMigrated` key (some docs) | Not found in `src/` |
| `aiQuotaCache`/`aiQuotaPrefs` in allowlist | Not read/written in `src/` yet |
| Yahoo search engine in options | Not in SW `SEARCH_ENGINES` → falls back to google |

---

## 12. File map (high signal)

```
Syncly/
├── manifest.json                 # MV3 — permissions, surfaces, CSP, omnibox nt
├── package.json                  # scripts: test, perf, smoke
├── README.md · CONTRIBUTING.md · CHANGELOG.md · PRODUCT.md
├── PRODUCT_SPEC.md               # HISTORICAL (see banner)
├── CHROMEWEBSTORE.md             # store listing + permission justifications
├── docs/
│   ├── CONTEXT.md                # ← THIS FILE (canonical context memory)
│   ├── agents/CLAUDE.md · AGENTS.md
│   ├── architecture.md · permissions.md · development.md
│   ├── THEME_DEVELOPMENT.md · TEST_CASES.md · TESTING_STANDARD.md
│   ├── PR-TICKETS.md · design/Design.md · security/SECURITY.md
├── src/
│   ├── domain/          entities · valueObjects · services · repositories
│   ├── application/     useCases/* (incl. workspaces/) · ports/ (EventBus, Sanitizer, BackupTarget, …)
│   ├── infrastructure/  di/container.js · persistence/ · repositories/ · services/ · security/
│   └── presentation/
│       ├── newTab/      newTabController · views/BookmarkDeckView · SettingsSidebar · dialogs…
│       ├── popup/       popupController (quick-add)
│       ├── options/     optionsController (full settings page)
│       ├── sidepanel/   orphan iframe shell (manifest uses popup?sidepanel=1)
│       └── shared/      serviceWorker · dom · icons · theme/ · styles/tokens.css
├── public/              icons · fonts · screenshots · banner
├── test/                *.test.mjs (incl. workspace-structure) · helpers/ · fixtures/
├── scripts/             perf-baseline · smoke (stale) · probes…
└── packages/            syncly-theme-template
```

---

## 13. Working rules for agents & contributors

1. **Read this file first**, then `docs/agents/CLAUDE.md`.
2. Prefer **source of truth order:** `manifest.json` / `tokens.css` / `container.js` / live source → this doc → other md files.
3. Wire new use cases only in `container.js`; emit a `*:changed` event; never touch `chrome.storage.sync` outside GoogleSyncService allowlist.
4. DOM via `el()` only; sanitize at use-case layer; MV3 CSP: no inline script, no external JS/fonts.
5. Do not invent testimonials, CI status, or test counts — verify with `npm test`.
6. When behavior changes, **update §3, §5, §4.4, and §11** in this file in the same PR.
7. Stale scripts (`smoke`, probes) are not a green/red signal — do not "fix docs" by claiming they pass.

---

## 14. Open product facts

- Chrome Web Store publication: **pending** (see `CHROMEWEBSTORE.md`).
- Weather widget: **not in current product** (CSP still allows open-meteo hosts — leftover).
- AI quota: scaffold only.
- WCAG full audit: not performed.
- CI: does not exist yet (CHANGELOG claims are false until workflows land).
- Performance budget culture: first paint < 500 ms, deck `_load()` < 150 ms @ 500 bookmarks, JS payload ≤ ~150 KB (targets from PRODUCT.md — verify via `npm run perf`).

---

*When this document and any other markdown disagree, trust the source tree, then fix the markdown — starting with this file.*
