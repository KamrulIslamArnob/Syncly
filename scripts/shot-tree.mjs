import puppeteer from "puppeteer-core";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, extname } from "node:path";
import { createServer } from "node:http";

const ROOT = resolve(import.meta.dirname, "..");
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
if (!existsSync(CHROME)) { console.error("Chrome not found"); process.exit(1); }
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".ico": "image/x-icon" };
const server = createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); const file = join(ROOT, p); if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" }); res.end(readFileSync(file)); });
await new Promise((r) => server.listen(0, r));
const PORT = server.address().port;
const NEWTAB = `http://localhost:${PORT}/src/presentation/newTab/newTab.html`;

function inject() {
  const KEY = "__nt_store"; const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }; const write = (o) => localStorage.setItem(KEY, JSON.stringify(o)); if (localStorage.getItem(KEY) === null) write({});
  const listeners = []; const fire = (ch) => listeners.forEach((l) => { try { l(ch, "local"); } catch {} });
  const pick = (s, k) => { if (k == null) return { ...s }; if (typeof k === "string") return k in s ? { [k]: s[k] } : {}; if (Array.isArray(k)) { const o = {}; for (const x of k) if (x in s) o[x] = s[x]; return o; } const o = {}; for (const x of Object.keys(k)) o[x] = x in s ? s[x] : k[x]; return o; };
  window.chrome = { runtime: { id: "shim", getURL: (p) => p, lastError: null }, identity: {}, bookmarks: { async getTree() { return [{ id: "0", title: "", children: [
    { id: "1", title: "Bookmarks Bar", children: [ { id: "11", title: "Gmail", url: "https://mail.google.com" }, { id: "12", title: "Work", children: [ { id: "121", title: "Figma", url: "https://figma.com" }, { id: "122", title: "Notion", url: "https://notion.so" } ] }, { id: "13", title: "Reading", children: [ { id: "131", title: "Hacker News", url: "https://news.ycombinator.com" } ] } ] },
    { id: "2", title: "Other Bookmarks", children: [ { id: "21", title: "YouTube", url: "https://youtube.com" }, { id: "22", title: "Wikipedia", url: "https://wikipedia.org" } ] },
    { id: "3", title: "Dev", children: [ { id: "31", title: "GitHub", url: "https://github.com" }, { id: "32", title: "MDN", url: "https://developer.mozilla.org" } ] },
  ] }]; } }, storage: { local: { async get(k) { return pick(read(), k); }, async set(o) { const s = read(); for (const x of Object.keys(o)) s[x] = o[x]; write(s); fire({}); }, async remove() {}, async clear() {} }, onChanged: { addListener: () => {}, removeListener: () => {} } } };
}
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-first-run", "--force-color-profile=srgb"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(inject);
  await page.goto(NEWTAB, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".bookmarks-shell", { timeout: 8000 });
  await page.evaluate(() => document.getElementById("btn-tree")?.click());
  await page.waitForSelector(".tree-view .tv-body", { timeout: 6000 });
  await new Promise((r) => setTimeout(r, 400));
  const organic = join(tmpdir(), "tree-organic.png");
  await page.screenshot({ path: organic });
  console.log("organic shot:", organic);
  await page.evaluate(() => document.querySelector('.tv-style-btn[data-style="editor"]')?.click());
  await new Promise((r) => setTimeout(r, 400));
  const editor = join(tmpdir(), "tree-editor.png");
  await page.screenshot({ path: editor });
  console.log("editor shot:", editor);
} finally { await browser.close(); server.close(); }
