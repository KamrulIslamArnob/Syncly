# Architecture Overview

Syncly is built as a modular, privacy-first Manifest V3 Chrome Extension. It follows **Strict Clean Architecture** and **Domain-Driven Design (DDD)** principles to maintain high performance, strict separation of concerns, and zero runtime build overhead.

---

## High-Level System Architecture

```
Chromium Platform
 ├── New Tab Dashboard (src/presentation/newTab/)
 ├── Quick-Add Popup (src/presentation/popup/)
 ├── Options / Settings (src/presentation/options/)
 ├── Background Service Worker (src/presentation/shared/serviceWorker.js)
 ├── Chrome APIs (chrome.bookmarks, chrome.storage, chrome.tabs, chrome.action)
 └── External Services (GitHub API for optional backups)
```

---

## Clean Architecture Layers

Syncly's codebase is organized into four concentric architectural layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│   NewTab Controller, Views, DOM Builder (el), Themes/CSS   │
└──────────────────────────────┬──────────────────────────────┘
                               │ depends on
┌──────────────────────────────▼──────────────────────────────┐
│                    Application Layer                        │
│      Use Cases, Ports (Repository & Service Interfaces)     │
└──────────────┬──────────────────────────────┬───────────────┘
               │ operates on                  │ implemented by
┌──────────────▼──────────────┐┌──────────────▼───────────────┐
│        Domain Layer         ││     Infrastructure Layer     │
│   Entities, Value Objects,  ││   Chrome Storage Repos,      │
│     Pure Domain Services    ││   AutoBackup, DI Container   │
└─────────────────────────────┘└──────────────────────────────┘
```

### 1. Presentation Layer (`src/presentation/`)
- **New Tab Page (`newTab/`)**: Main two-pane dashboard containing the navigation sidebar (`BookmarkDeckView.js`), workspace switcher (`GroupProfileButtonsView.js`), shortcuts strip, collections view, search index, and settings sidebar (`SettingsSidebarView.js`).
- **Popup (`popup/`)**: Compact browser action dialog (`popup.html` / `popupController.js`) enabling one-click bookmark addition and workspace selection for the active tab.
- **Options (`options/`)**: Dedicated full-page settings interface (`options.html` / `optionsController.js`).
- **Shared Presentation (`shared/`)**:
  - `dom.js`: Secure DOM builder (`el()`) replacing `innerHTML` to prevent XSS.
  - `icons.js`: Inline SVG icon registry.
  - `theme.js` & `tokens.css`: Unified design tokens and adaptive light/dark theme variables.

### 2. Application Layer (`src/application/`)
- **Use Cases (`useCases/`)**: Single-responsibility application operations:
  - Bookmarks: `EnsureQuickieFolderUseCase`, `EnsureShortcutsFolderUseCase`.
  - Collections: `ListBookmarkCollectionsUseCase`, `SaveBookmarkCollectionUseCase`, `DeleteBookmarkCollectionUseCase`.
  - Tags: `ListBookmarkTagsUseCase`, `SaveBookmarkTagUseCase`, `DeleteBookmarkTagUseCase`.
  - Settings & Theme: `GetSettingsUseCase`, `SaveUserSettingsUseCase`.
  - Workspaces: `CreateBookmarkGroup`, `SetActiveGroupUseCase`, `DeleteBookmarkGroupUseCase`.
  - Sync & Backup: `SyncFromGoogleCloudUseCase`, `GitHubBackupService`.
- **Ports (`ports/`)**: Abstract contracts defining repository and service interfaces.

### 3. Domain Layer (`src/domain/`)
- **Entities (`entities/`)**: Pure business models with invariant-enforcing private `#` fields and serialization methods (`fromJSON()` / `toJSON()`):
  - `Bookmark.js`, `Category.js`, `BookmarkGroup.js`, `BookmarkCollection.js`, `UserSettings.js`, `Task.js`.
- **Value Objects (`valueObjects/`)**: Immutable value objects (`Url.js`, `Greeting.js`).
- **Domain Services (`services/`)**: High-performance in-memory search and indexing (`OmniSearchIndex.js`).

### 4. Infrastructure Layer (`src/infrastructure/`)
- **Persistence (`persistence/`)**: `ChromeStorageClient.js` wrapping `chrome.storage.local` with fallback memory storage.
- **Repositories (`repositories/`)**: Concrete implementations of domain repository ports (`ChromeBookmarkRepository`, `ChromeBookmarkCollectionRepository`, `ChromeBookmarkGroupRepository`, `ChromeBookmarkTagRepository`).
- **Services (`services/`)**: `AutoBackupService.js` (IndexedDB + File System Access API), `GitHubBackupService.js`, `SystemClock.js`, `UuidGenerator.js`.
- **Composition Root (`di/container.js`)**: The single composition root wiring all repositories, services, and use cases into a frozen container (`{ events, useCases, internals }`).

---

## Data Flow & Reactive State Management

Syncly employs an asynchronous **Unidirectional Data Flow** mediated by a centralized EventBus:

```
[User Action in UI]
       │
       ▼
[Controller invokes Use Case]
       │
       ▼
[Use Case modifies Domain Entities]
       │
       ▼
[Repository persists to chrome.storage.local / chrome.bookmarks]
       │
       ▼
[EventBus emits change event: e.g. "bookmarks:changed"]
       │
       ▼
[Controllers subscribed to EventBus receive event]
       │
       ▼
[View re-renders DOM with updated state]
```

### Cross-Tab Synchronization
The composition root (`container.js`) registers a single `chrome.storage.onChanged` listener that intercepts changes made across other browser tabs and re-emits them on the internal `EventBus`, keeping all open Syncly tabs in sync.

---

## Storage & Backup Architecture

Syncly uses a **multi-tier local storage strategy**:

| Tier | Technology | Purpose |
| :--- | :--- | :--- |
| **Tier 1: Browser Bookmarks** | `chrome.bookmarks` API | Native bookmark tree, hierarchy, folder names, and URLs. |
| **Tier 2: Extension Metadata** | `chrome.storage.local` | Workspaces, collections, tags, shortcut arrangements, and settings. |
| **Tier 3: Local File Backups** | File System Access API + IndexedDB (`neptab-backup-db`) | Automatic, dirty-checked local JSON backups saved directly to the user's chosen directory. |
| **Tier 4: Remote Backup (Opt-in)** | GitHub REST API | Optional, encrypted JSON Gist backup using the user's personal access token. |

---

## Security Architecture

- **Manifest V3 CSP**: `script-src 'self'` prevents arbitrary code execution and disables `eval()`.
- **Zero Inline Scripts**: All logic is partitioned into external ES module files.
- **Safe DOM Construction**: Pure programmatic element creation via `el()` with `textContent` protects against HTML injection.
- **Protocol Allowlist**: External URLs are checked by `isSafeUrl()` to ensure only valid `http:` and `https:` schemes can be launched.
