# Chrome Web Store Readiness & Metadata

This document contains metadata, permission justifications, and store listing assets prepared for publishing **Syncly** to the Chrome Web Store.

---

## Listing Metadata

- **Extension Name:** Syncly
- **Summary / Short Description (max 132 characters):**
  > Sync everywhere, stay local — A minimalist, privacy-first bookmark manager & new tab for Chrome.
- **Primary Category:** Productivity
- **Language:** English (United States)
- **Current Version:** `0.2.0`
- **Chrome Web Store URL:** `TODO` *(Pending publication)*

---

## Detailed Description (Store Listing Copy)

```
Sync everywhere, stay local.

Syncly transforms your new tab page into a high-performance, minimalist bookmark management workstation operating directly on top of your native Chrome bookmarks.

✦ KEY FEATURES ✦

• Native Chrome Bookmarks Integration: Operates directly over your browser's existing bookmarks with instantaneous two-way synchronization.
• Workspaces: Group your folders into dedicated contexts (Work, Personal, Development, Design) to eliminate tab and bookmark clutter.
• Themed Collections: Bundle cross-folder bookmarks into custom collections without altering your folder tree.
• Universal Category Shortcuts: Clean circular shortcut strips for quick access to your most critical daily tools.
• Instant Fuzzy Search: Search through thousands of bookmarks and filter by #tags with sub-millisecond response times (Ctrl+K / Cmd+K).
• 100% Local-First & Private: No accounts, no cloud database locks, and zero telemetry. All data stays safely in your local browser storage.
• Automatic Local Backups: Scheduled dirty-checked backups save timestamped JSON archives to your local disk.
• Adaptive Design: Minimalist Nothing-inspired interface with responsive Light and Dark themes.
• Zero Bloat: Built purely with native modern JavaScript (ES Modules). No heavy frameworks or background analytics slowing down your tabs.

Organize your web efficiently with Syncly.
```

---

## Permission Justifications (For Store Review)

| Requested Permission | Store Justification Statement |
| :--- | :--- |
| `bookmarks` | Essential core permission. Syncly requires access to read, display, organize, and update the user's native Chrome bookmark library in the new tab dashboard. |
| `storage` | Required to store user workspace groupings, custom collections, tag mappings, and appearance settings locally in `chrome.storage.local`. |
| `unlimitedStorage` | Required to ensure users with large libraries (thousands of bookmarks and tag indexes) do not hit default storage quota limits. |
| `activeTab` | Used only when the user clicks the extension toolbar icon to read the current tab's title and URL so they can quickly add it to a collection or workspace. |
| `tabs` | Required to open bookmarks in new or background tabs and query current window tab state. |
| `favicon` | Required to fetch and display native cached site icons via Chrome's secure favicon provider (`chrome://favicon/`). |

---

## Privacy Practice Declarations

- **Single Purpose Description:** Minimalist, local-first bookmark manager and new tab dashboard.
- **Data Collection:** Syncly collects **NO personal data, NO authentication credentials, NO financial data, and NO browsing activity history**. All state is stored locally on the client device.
- **Remote Code Execution:** Syncly uses **NO remote scripts, NO dynamic eval, and NO external CDNs** (strictly compliant with MV3 CSP requirements).

---

## Required Visual Assets

| Asset Type | Specifications | Status / File Path |
| :--- | :--- | :--- |
| **Store Icon** | 128 x 128 px PNG | :white_check_mark: `public/icons/icon128.png` |
| **Primary Screenshot** | 1280 x 800 px PNG | :white_check_mark: `public/screenshot_dashboard.png` |
| **Small Promo Tile** | 440 x 280 px PNG | `TODO` *(Recommended before feature promotion)* |
| **Marquee Promo Tile** | 920 x 680 px PNG | `TODO` *(Optional)* |

---

## Pre-Submission Publishing Checklist

- [x] Manifest V3 compliant (`manifest_version: 3`).
- [x] No `innerHTML` usage with dynamic user input.
- [x] No unbundled node_modules or development files in production package.
- [x] All permissions genuinely utilized and justified.
- [x] Unit tests passing (`npm test`).
- [ ] Production ZIP package generated (`zip -r syncly.zip manifest.json src public README.md LICENSE`).
- [ ] ZIP uploaded to Chrome Developer Dashboard.
- [ ] Privacy questionnaire completed in Developer Dashboard.
- [ ] Store listing submitted for review.
