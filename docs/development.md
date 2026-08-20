# Development Guide

This guide walks through setting up, developing, testing, and debugging Syncly from scratch.

---

## 1. Prerequisites

- **Chromium Browser**: Google Chrome, Brave, Microsoft Edge, Arc, or Vivaldi.
- **Node.js**: Version 20.x or higher (used for running automated unit and smoke tests).
- **Git**: For version control.

---

## 2. Initial Setup

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/KamrulIslamArnob/NothingTab.git
   cd NothingTab
   ```

2. **Install Test Dependencies:**
   Syncly has zero runtime dependencies. `npm install` only installs devDependencies needed for automated tests:
   ```bash
   npm install
   ```

3. **Optional Configuration:**
   If you wish to test custom Chrome binary paths for Puppeteer smoke tests:
   ```bash
   cp .env.example .env
   ```

---

## 3. Loading the Extension into Chrome

1. Open your browser and navigate to `chrome://extensions`.
2. Toggle **Developer mode** in the upper-right corner.
3. Click the **Load unpacked** button in the top-left toolbar.
4. Select the cloned repository root folder (`NothingTab`).
5. Open a new tab (`Ctrl + T` on Windows/Linux or `Cmd + T` on macOS) to verify that Syncly loads.

---

## 4. Development Workflow

Syncly uses **native ECMAScript modules (ESM)** without bundling or compilation.

### Working with UI, Views, and Styles
- All UI code lives in `src/presentation/`.
- Edit any `.js` or `.css` file in `src/presentation/newTab/`.
- Simply **refresh your new tab page (`F5` or `Ctrl + R`)** to see your updates immediately.

### Working with the Service Worker or Manifest
- When you modify `manifest.json` or `src/presentation/shared/serviceWorker.js`:
  1. Go to `chrome://extensions`.
  2. Click the **Reload (circular arrow)** button on the Syncly extension card.
  3. Reopen or refresh your new tab page.

---

## 5. Testing

### Automated Unit Tests
Syncly includes an automated test suite executed via Node.js's built-in test runner:
```bash
npm test
```
*Tests are located in `test/*.test.mjs` and execute in sub-second time without browser overhead.*

### Headless Smoke Test
To run the end-to-end Puppeteer test suite against a live simulated Chrome storage environment:
```bash
npm run smoke
```

---

## 6. Debugging Techniques

### Debugging the New Tab Dashboard
- Right-click anywhere on the new tab page and select **Inspect** (`Ctrl + Shift + I` / `F12`).
- Use the **Console** tab to view log messages and error traces.
- Use the **Sources** tab to set breakpoints in `src/presentation/` or `src/application/` files.

### Debugging the Action Popup
1. Click the Syncly extension icon in your browser toolbar to open the popup.
2. Right-click inside the open popup and select **Inspect**.
3. A dedicated DevTools window will open for `src/presentation/popup/popup.html`.

### Debugging the Background Service Worker
1. Go to `chrome://extensions`.
2. Locate the Syncly card.
3. Click the link next to **Inspect views: service worker**.
4. A dedicated DevTools window will open attached to `src/presentation/shared/serviceWorker.js`.

### Inspecting Local Storage
In the new tab DevTools:
1. Open the **Application** tab.
2. Under **Storage** in the left sidebar, expand **Extension Storage**.
3. Select the extension ID to view and edit keys stored in `chrome.storage.local`.

---

## 7. Common Development Issues & Troubleshooting

### Issue: Changes to CSS or Views do not appear
- **Solution:** Hard refresh the tab using `Ctrl + Shift + R` (or `Cmd + Shift + R`). If modifying tokens or shared scripts, ensure browser cache is disabled in the DevTools Network panel.

### Issue: Service Worker errors after modifying background code
- **Solution:** Reload the extension card on `chrome://extensions` to terminate the stale worker instance and start the new version.

### Issue: Unit tests report `chrome is not defined`
- **Solution:** The domain and application layers are platform-independent pure JavaScript. When writing new use cases or entities, do not call `chrome.*` APIs directly; access them through infrastructure repositories passed via `container.js`.
