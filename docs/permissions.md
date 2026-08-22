# Permissions Documentation

Syncly requests only the permissions strictly required to deliver a private, local-first bookmark management workstation.

---

## Chrome Extension Permissions

The following permissions are declared in [`manifest.json`](../manifest.json):

| Permission | Why It Is Required | Where It Is Used |
| :--- | :--- | :--- |
| `bookmarks` | **Core functionality**: Enables reading the browser's bookmark tree, creating/renaming folders, moving bookmarks, and synchronizing changes in real time. | `src/presentation/newTab/`, `src/presentation/popup/`, `src/infrastructure/repositories/` |
| `storage` | **Local data persistence**: Stores custom workspaces, collections, tags, color themes, and user preferences locally on the user's device. | `src/infrastructure/persistence/chromeStorage/` |
| `unlimitedStorage` | **Storage reliability**: Prevents quota exhaustion when users organize large libraries containing thousands of bookmarks, nested hierarchies, and tag indexes. | `chrome.storage.local` operations across all repositories |
| `activeTab` | **Contextual quick-add**: Grants temporary access to the active tab's title, URL, and favicon only when the user explicitly opens the extension action popup. | `src/presentation/popup/popupController.js` |
| `tabs` | **Tab navigation & management**: Allows opening bookmarks in active or background tabs, handling new tab override routing, and querying open tab state. | `src/presentation/newTab/`, `src/presentation/popup/` |
| `favicon` | **Visual identification**: Enables fetching high-resolution website favicons directly through Chrome's secure native favicon cache (`chrome-extension://.../_favicon/`). | `src/presentation/shared/favicon.js`, `src/presentation/newTab/views/BookmarkDeckView.js` |

---

## Host Permissions & Content Security Policy (CSP)

Syncly declares **zero broad host permissions** (`host_permissions: []`), ensuring the extension cannot inspect, inject scripts into, or modify arbitrary web pages you visit.

### Network Connect Origins (`connect-src`)
The Content Security Policy restricts external HTTP connections to:

| Origin | Purpose | Optional / Required |
| :--- | :--- | :--- |
| `'self'` | Internal extension module loading and message passing. | Required |
| `https://api.github.com` | User-initiated GitHub Gist backup/restore (only activated if the user provides a personal access token). | Optional (User Opt-in) |
| `https://api.open-meteo.com` | Weather data retrieval. | Optional |
| `https://geocoding-api.open-meteo.com` | City name geocoding for weather preferences. | Optional |

### Image Origins (`img-src`)
- `'self'`: Internal static extension icons, illustrations, and local assets.
- `data:` / `blob:`: Dynamically generated color previews, canvas exports, and object URLs.
- `https:`: Loading website favicons and bookmark preview thumbnails.

---

## Web Accessible Resources

Syncly declares **zero web accessible resources**. No extension assets or files are exposed to external web pages.

---

## Content Scripts

Syncly declares **zero content scripts**. No code from Syncly is injected into external web pages.
