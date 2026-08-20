# Syncly

> A minimalist, privacy-first bookmark manager and new tab dashboard for Google Chrome.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-success.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![CI](https://github.com/KamrulIslamArnob/NothingTab/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml)
[![Zero Build](https://img.shields.io/badge/Build-Zero%20Dependencies-orange.svg)](#architecture)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## Overview

### The Problem
Browser bookmarks are essential tools for navigating the web, yet modern bookmark management is often cluttered, slow, or invasive:
- Native browser bookmark managers lack contextual grouping, collection bundling, and responsive visual organization.
- Third-party cloud bookmark services require creating external accounts, send browsing data to remote servers, and lock features behind monthly subscriptions.
- Heavy new-tab replacements introduce multi-megabyte bundles, complex framework runtimes, and aggressive tracking that slows down tab creation.

### The Solution
**Syncly** is built on a simple philosophy: **Sync everywhere, stay local.**

Syncly transforms your new tab page into a high-performance, two-pane workstation operating directly over your **native Chrome bookmarks**. It introduces workspace profiles, cross-folder collections, instant fuzzy search, and quick circular category strips—without third-party telemetry or build-step overhead.

---

## Features

- **Native Chrome Bookmarks Integration**: Directly syncs with Chrome's native bookmark tree (`chrome.bookmarks`) in real time. Changes made in the extension reflect in your browser, and vice versa.
- **Contextual Workspaces**: Group and scope folders into dedicated workspace contexts (*Work*, *Development*, *Design*, *Personal*) to eliminate visual clutter.
- **Cross-Folder Collections**: Bundle related bookmarks into themed collections without altering their physical folder hierarchy.
- **Universal Category Shortcuts**: Top-level circular category strip (*Quick*, *AI*, *Development*, *Design*, *Marketing*) with direct one-click navigation.
- **Instant Search & Tagging**: Full-library search with `#tag` filtering and keyboard shortcuts (`Ctrl+K` / `Cmd+K`).
- **Zero-Build Vanilla Architecture**: Pure modern JavaScript (ES modules) and native CSS tokens. No Webpack, Vite, Babel, or runtime bundle bloat.
- **Local-First Privacy**: All user data, tags, and workspace mappings are stored locally in `chrome.storage.local`. No external tracking or telemetry.
- **Automated Local Backups**: File System Access API integration paired with IndexedDB for automatic, timestamped local JSON backups.
- **Adaptive Color System**: Clean Light and Dark modes with custom accent color theming following minimalist design principles.

---

## Demo & Visuals

Syncly features a clean, two-pane workspace layout:

| Light Mode | Dark Mode |
| :--- | :--- |
| ![Syncly Light Mode Dashboard](public/screenshot_dashboard.png) | ![Syncly Dark Mode Banner](public/banner.png) |

*(Note: Visual assets are located in `public/`.)*

---

## Installation

### Chrome Web Store
> **Status:** *Currently in active development / Pending Chrome Web Store publication.*

Once approved on the Chrome Web Store, the direct store installation link will be published here.

### Development Installation (Load Unpacked)

To run Syncly locally on any Chromium-based browser (Google Chrome, Brave, Microsoft Edge, Arc, Vivaldi):

1. **Clone the repository:**
   ```bash
   git clone https://github.com/KamrulIslamArnob/NothingTab.git
   cd NothingTab
   ```

2. **Open the Extensions page:**
   Navigate to `chrome://extensions` in your browser.

3. **Enable Developer Mode:**
   Toggle the **Developer mode** switch in the top-right corner.

4. **Load the extension:**
   Click the **Load unpacked** button and select the repository root directory.

5. **Open a new tab:**
   Open a new tab (`Ctrl + T` on Windows/Linux or `Cmd + T` on macOS) to launch Syncly.

---

## Development

Syncly is intentionally built with **zero runtime dependencies** and **no compilation build step**. Source code is directly interpreted by Chromium as native ES Modules.

### Prerequisites
- **Node.js:** Node 20.x or higher (required only for running tests).
- **Package Manager:** `npm` (bundled with Node.js).

### Commands

| Command | Purpose |
| :--- | :--- |
| `npm install` | Installs test devDependencies (`puppeteer-core`). |
| `npm test` | Runs the automated unit test suite (`node --test`). |
| `npm run smoke` | Runs the headless Puppeteer end-to-end smoke test. |

### Development Workflow
- **Editing Views & Styles:** Edit files in `src/presentation/` or `src/infrastructure/`. Refresh your new tab page to see changes immediately.
- **Editing Service Worker / Manifest:** Make changes to `manifest.json` or `src/presentation/shared/serviceWorker.js`, then click the reload icon on `chrome://extensions`.

---

## Architecture

Syncly strictly adheres to **Clean Architecture** and **Domain-Driven Design (DDD)** principles:

```
src/
├── presentation/          # User Interface layer (DOM creation, views, styles)
│   ├── newTab/            # New Tab dashboard views and controller
│   ├── popup/             # Browser action quick-add popup
│   ├── options/           # Options / settings page
│   └── shared/            # DOM helper (el), icons, colors, service worker
├── application/           # Application layer (Use Cases, orchestration)
│   ├── ports/             # Abstract interfaces (Repositories, Services)
│   └── useCases/          # Business logic use cases (bookmarks, tags, settings)
├── domain/                # Enterprise domain layer (Entities, Value Objects)
│   ├── entities/          # Invariant-enforcing models (Bookmark, Category, Task)
│   ├── valueObjects/      # Value objects (Url, Greeting)
│   └── services/          # Domain services (OmniSearchIndex)
└── infrastructure/        # Infrastructure layer (Chrome APIs, persistence)
    ├── persistence/       # chrome.storage.local repository implementations
    ├── repositories/      # Concrete collection and tag repositories
    ├── services/          # AutoBackupService, GitHubBackupService, SystemClock
    └── di/                # Dependency Injection container (composition root)
```

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│  [NewTab Dashboard]      [Quick-Add Popup]    [Options UI]  │
└──────────────────────────────┬──────────────────────────────┘
                               │ invokes
┌──────────────────────────────▼──────────────────────────────┐
│                    Application Layer                        │
│   Use Cases: EnsureQuickieFolder, ListCollections, Search   │
└──────────────┬──────────────────────────────┬───────────────┘
               │ operates on                  │ depends on
┌──────────────▼──────────────┐┌──────────────▼───────────────┐
│        Domain Layer         ││     Infrastructure Layer     │
│ Entities & Value Objects    ││ ChromeStorage, IndexedDB, DI │
└─────────────────────────────┘└──────────────────────────────┘
```

### Component Roles
- **Popup (`src/presentation/popup/`)**: Lightweight action popup for quick-saving active tabs to collections or folders without opening a new tab.
- **Service Worker (`src/presentation/shared/serviceWorker.js`)**: Background service worker handling extension lifecycle, omnibox queries (`nt <query>`), and cross-tab synchronization.
- **Options Page (`src/presentation/options/`)**: Dedicated settings page for backup management and preferences.
- **Content Scripts**: Syncly intentionally uses **zero content scripts**, ensuring no code is ever injected into external websites you visit.
- **Storage**: Core application state lives in `chrome.storage.local`, while automated file backups leverage the File System Access API and IndexedDB.

---

## Permissions

Syncly requests only the permissions strictly required to function as a bookmark manager:

| Permission | Justification |
| :--- | :--- |
| `bookmarks` | **Core functionality**: Enables reading, creating, editing, and syncing your bookmark tree. |
| `storage` | **Local state**: Persists workspace layouts, custom tags, and user preferences locally. |
| `unlimitedStorage` | **Reliability**: Ensures large bookmark libraries and tag indexes are not truncated by quota limits. |
| `activeTab` | **Quick-add popup**: Captures the current page title and URL when explicitly clicking the extension icon. |
| `tabs` | **Navigation**: Allows opening bookmarks in active or background tabs and querying current window state. |
| `favicon` | **Visual identification**: Fetches native cached website favicons via Chrome's secure favicon provider. |

---

## Contributing

We welcome contributions of all kinds! Please read our **[Contributing Guidelines](CONTRIBUTING.md)** and **[Code of Conduct](CODE_OF_CONDUCT.md)** before submitting pull requests or opening issues.

---

## Security

For vulnerability disclosures and security policies, please review **[SECURITY.md](SECURITY.md)**.

---

## License

Syncly is open-source software licensed under the **[MIT License](LICENSE)**.

Copyright © 2026 [Kamrul Islam Arnob](https://github.com/KamrulIslamArnob).