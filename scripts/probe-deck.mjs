import puppeteer from "puppeteer-core";
import { readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:http";

const ROOT = resolve(import.meta.dirname, "..");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
if (!existsSync(CHROME)) { console.error("Chrome not found"); process.exit(1); }

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".ico": "image/x-icon" };
const server = createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const file = join(ROOT, p);
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[file.slice(file.lastIndexOf("."))] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const PORT = server.address().port;
const NEWTAB = `http://localhost:${PORT}/src/presentation/newTab/newTab.html`;

function inject() {
  const KEY = "__nt_store";
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const write = (o) => localStorage.setItem(KEY, JSON.stringify(o));
  const listeners = [];
  const fire = (ch) => listeners.forEach((l) => { try { l(ch, "local"); } catch {} });
  const pick = (store, keys) => {
    if (keys == null) return { ...store };
    if (typeof keys === "string") return keys in store ? { [keys]: store[keys] } : {};
    if (Array.isArray(keys)) { const o = {}; for (const k of keys) if (k in store) o[k] = store[k]; return o; }
    const o = {}; for (const k of Object.keys(keys)) o[k] = k in store ? store[k] : keys[k]; return o;
  };
  window.chrome = {
    runtime: { id: "shim", getURL: (p) => p, lastError: null },
    bookmarks: { async getTree() { return [{ id: "0", title: "", children: [
      { id: "1", title: "Bookmarks Bar", children: [
        { id: "11", title: "Gmail", url: "https://mail.google.com" },
        { id: "12", title: "Work", children: [ { id: "121", title: "Figma", url: "https://figma.com" } ] },
      ] },
      { id: "2", title: "Other Bookmarks", children: [ { id: "21", title: "YouTube", url: "https://youtube.com" } ] },
    ] }]; } },
    storage: { local: {
      async get(keys) { return pick(read(), keys); },
      async set(obj) { const s = read(), ch = {}; for (const k of Object.keys(obj)) { ch[k] = { oldValue: s[k], newValue: obj[k] }; s[k] = obj[k]; } write(s); fire(ch); },
      async remove(keys) { const s = read(), arr = Array.isArray(keys) ? keys : [keys], ch = {}; for (const k of arr) { ch[k] = { oldValue: s[k] }; delete s[k]; } write(s); fire(ch); },
      async clear() { write({}); fire({}); },
    }, onChanged: { addListener: (fn) => listeners.push(fn), removeListener: () => {} } },
  };
}

const errors = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-first-run"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
  await page.evaluateOnNewDocument(inject);
  await page.goto(NEWTAB, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".bookmarks-shell", { timeout: 8000 });
  console.log("home rendered OK");
  await page.evaluate(() => document.getElementById("btn-tree")?.click());
  await new Promise((r) => setTimeout(r, 1500));
  const report = await page.evaluate(() => ({
    deck: !!document.querySelector(".deck"),
    folders: document.querySelectorAll(".deck-folder").length,
    links: document.querySelectorAll(".deck-link").length,
    freq: document.querySelectorAll(".deck-freq-chip").length,
    bodyStyle: document.body.getAttribute("data-deck-style"),
    modeDeck: document.body.classList.contains("mode-deck"),
    meta: document.querySelector(".deck-meta")?.textContent || "",
    boardHTMLlen: document.querySelector(".deck-board")?.innerHTML.length || 0,
  }));
  console.log("DECK REPORT:", JSON.stringify(report, null, 2));
  console.log("JS ERRORS:", errors.length ? errors.join("\n") : "none");
} finally {
  await browser.close();
  server.close();
}
