import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import assert from "node:assert";

const ROOT = path.resolve(".");
const PORT = 9123;
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/src/presentation/popup/popup.html";
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp)) { res.writeHead(404); res.end("nf"); return; }
  res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream" });
  fs.createReadStream(fp).pipe(res);
});

await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const page = await browser.newPage();
await page.setViewport({ width: 380, height: 600 });

await page.evaluateOnNewDocument(() => {
  const store = {
    bookmarks: [],
    categories: [{ id: "cat-1", name: "Inbox", order: 0 }],
    bookmarkGroups: [],
    bookmarkCollections: [],
    settings: { colorMode: "dark", cssVarAccent: "#10B981" },
  };
  globalThis.__store = store;
  globalThis.chrome = {
    runtime: { getURL: (p) => p },
    tabs: { query: () => Promise.resolve([{ url: "https://syncly.app", title: "Syncly" }]) },
    bookmarks: { getTree: () => Promise.resolve([]) },
    storage: {
      local: {
        get: (keys) => {
          if (typeof keys === "string") return Promise.resolve({ [keys]: store[keys] });
          if (Array.isArray(keys)) {
            const out = {};
            for (const k of keys) out[k] = store[k];
            return Promise.resolve(out);
          }
          return Promise.resolve(store);
        },
        set: (obj) => {
          Object.assign(store, obj);
          return Promise.resolve();
        },
      },
      onChanged: { addListener() {} },
    },
  };
});

await page.goto(`http://localhost:${PORT}/src/presentation/popup/popup.html`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 400));

// Initial state: popup should be dark
const initialPopupMode = await page.evaluate(() => document.documentElement.getAttribute("data-color-mode"));
assert.strictEqual(initialPopupMode, "dark", "Initial popup mode should be dark");

// Click theme toggle button in popup
const themeBtn = await page.$("#btn-theme-toggle");
assert(themeBtn, "Theme toggle button exists");
await themeBtn.click();
await new Promise((r) => setTimeout(r, 200));

// Verify popup is now light mode
const toggledPopupMode = await page.evaluate(() => document.documentElement.getAttribute("data-color-mode"));
assert.strictEqual(toggledPopupMode, "light", "Popup mode should now be light");

// Check what was stored in chrome.storage.local
const storeState = await page.evaluate(() => globalThis.__store);
console.log("Store state after popup toggle:", JSON.stringify(storeState, null, 2));

assert.strictEqual(storeState.popupColorMode, "light", "popupColorMode in storage should be 'light'");
assert.strictEqual(storeState.settings.colorMode, "dark", "Dashboard settings.colorMode MUST REMAIN 'dark'");

console.log("PASS: Popup dark/light mode toggle is completely independent of the dashboard settings!");

await browser.close();
server.close();
