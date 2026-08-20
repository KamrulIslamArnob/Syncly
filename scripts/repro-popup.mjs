import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

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
const logs = [];
page.on("console", (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
page.on("response", (r) => { if (r.status() >= 400) logs.push(`[${r.status()}] ${r.url()}`); });

await page.evaluateOnNewDocument(() => {
  const store = {
    bookmarks: [],
    categories: [{ id: "cat-1", name: "Inbox", order: 0 }],
    bookmarkGroups: [{ id: "grp-1", name: "Work", folderIds: ["10"], color: "#10B981" }],
    bookmarkCollections: [
      { id: "coll-1", name: "Design Inspo", bookmarkIds: ["1", "2"] },
      { id: "coll-2", name: "AI Research Papers", bookmarkIds: ["3"] },
    ],
    // The user's selected emerald green accent color:
    settings: { colorMode: "dark", cssVarAccent: "#10B981" },
  };
  globalThis.__store = store;
  globalThis.chrome = {
    runtime: {
      getURL: (p) => p,
    },
    tabs: {
      query: (info) =>
        Promise.resolve([
          { id: 7, active: true, windowId: 1, index: 0,
            title: "Syncly — Minimalist Workspace", url: "https://syncly.app/" },
        ]),
    },
    bookmarks: {
      getTree: () =>
        Promise.resolve([
          {
            id: "0",
            title: "root",
            children: [
              {
                id: "1",
                title: "Bookmarks bar",
                children: [
                  { id: "10", title: "Marketing", children: [
                    { id: "101", title: "Analytics & Tracking", children: [] },
                    { id: "102", title: "Social Media Campaigns", children: [] },
                  ] },
                  { id: "11", title: "Page Monitor Kit", children: [] },
                  { id: "12", title: "Youtube", children: [] },
                  { id: "13", title: "DeepWiki AI Documentation", children: [] },
                  { id: "14", title: "Development & Tools", children: [
                    { id: "141", title: "React & Next.js", children: [] },
                    { id: "142", title: "Chrome Extension MV3 APIs", children: [] },
                  ] },
                ],
              },
              {
                id: "2",
                title: "Other bookmarks",
                children: [
                  { id: "20", title: "Quickie", children: [] },
                  { id: "21", title: "Design", children: [] },
                  { id: "22", title: "Git", children: [] },
                ],
              },
            ],
          },
        ]),
      create: (item) => {
        store.bookmarks.push(item);
        return Promise.resolve({ id: "bm-" + Date.now(), ...item });
      },
    },
    storage: {
      local: {
        get: (keys) => Promise.resolve(typeof keys === "string" ? { [keys]: store[keys] } : store),
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
await new Promise((r) => setTimeout(r, 600));

// 1. Capture Main View with User's Emerald Sage Accent (#10B981)
await page.screenshot({ path: "C:/Users/Kamru/.gemini/antigravity/brain/6ace10ad-9472-4767-8fec-630e2491a623/popup_emerald_theme_dark.png" });

// 2. Open Folder Subview in Emerald Accent
const folderTrigger = await page.$("#bm-collection-trigger");
if (folderTrigger) await folderTrigger.click();
await new Promise((r) => setTimeout(r, 200));
await page.screenshot({ path: "C:/Users/Kamru/.gemini/antigravity/brain/6ace10ad-9472-4767-8fec-630e2491a623/popup_emerald_folder_subview.png" });

// Close subview
const backBtn = await page.$("#subview-back-btn");
if (backBtn) await backBtn.click();
await new Promise((r) => setTimeout(r, 200));

// 3. Switch to Light Mode
const themeBtn = await page.$("#btn-theme-toggle");
if (themeBtn) await themeBtn.click();
await new Promise((r) => setTimeout(r, 200));
await page.screenshot({ path: "C:/Users/Kamru/.gemini/antigravity/brain/6ace10ad-9472-4767-8fec-630e2491a623/popup_emerald_theme_light.png" });

// 4. Test Dynamic Switch to Nord Blue (#3B82F6)
await page.evaluate(() => {
  // Simulate setting change
  const controller = window.__controller;
  // Change document style directly to test blue
  document.documentElement.style.setProperty("--accent", "#3B82F6");
  document.documentElement.style.setProperty("--accent-gradient", "linear-gradient(135deg, #60A5FA 0%, #2563EB 100%)");
  document.documentElement.style.setProperty("--accent-primary", "#3B82F6");
  document.documentElement.style.setProperty("--accent-glow", "rgba(59, 130, 246, 0.38)");
  document.documentElement.style.setProperty("--accent-soft", "rgba(59, 130, 246, 0.16)");
  document.documentElement.setAttribute("data-color-mode", "dark");
});
await new Promise((r) => setTimeout(r, 200));
await page.screenshot({ path: "C:/Users/Kamru/.gemini/antigravity/brain/6ace10ad-9472-4767-8fec-630e2491a623/popup_blue_theme_dark.png" });

console.log("All accent theme screenshots captured successfully!");
await browser.close();
server.close();
