// End-to-end smoke gate for the NothingTab new-tab page.
//
// Stable Chrome no longer honours --load-extension, so we can't load the real
// unpacked extension via puppeteer. Instead we serve the repo over HTTP and
// load the actual newTab page with an in-memory chrome.storage shim backed by
// localStorage (so it survives reloads — the exact behaviour the sidebar
// Import relies on). This runs the real view/controller/use-case code; only
// the chrome.* storage boundary is stubbed.
import puppeteer from "puppeteer-core";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, extname } from "node:path";
import { createServer } from "node:http";

const ROOT = resolve(import.meta.dirname, "..");
const CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
].filter(Boolean).find((p) => existsSync(p));
if (!CHROME) { console.error("Chrome not found; set CHROME_PATH."); process.exit(1); }

const backup = JSON.parse(readFileSync(join(ROOT, "test/fixtures/old-backup.json"), "utf8"));
const backupPath = join(tmpdir(), `nt-import-${Date.now()}.json`);
writeFileSync(backupPath, JSON.stringify(backup));

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".ico": "image/x-icon" };
const server = createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const file = join(ROOT, p);
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const PORT = server.address().port;
const NEWTAB = `http://localhost:${PORT}/src/presentation/newTab/newTab.html`;

// Injected before any page script: chrome.storage (localStorage-backed so it
// survives reloads), chrome.bookmarks (mock tree), and an export capturer.
function inject() {
  const KEY = "__nt_store";
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const write = (o) => localStorage.setItem(KEY, JSON.stringify(o));
  if (localStorage.getItem(KEY) === null) write({}); // start empty; import populates it
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
    identity: {},
    bookmarks: { async getTree() { return [{ id: "0", title: "", children: [
      { id: "1", title: "Bookmarks Bar", children: [
        { id: "11", title: "Gmail", url: "https://mail.google.com" },
        { id: "12", title: "Work", children: [ { id: "121", title: "Figma", url: "https://figma.com" } ] },
      ] },
      { id: "2", title: "Other Bookmarks", children: [ { id: "21", title: "YouTube", url: "https://youtube.com" } ] },
      { id: "9", title: "Trap", children: [
        { id: "91", title: "EvilJS", url: "javascript:alert(document.cookie)" },
        { id: "92", title: "EvilData", url: "data:text/html,<script>alert(1)</script>" },
        { id: "93", title: "Safe", url: "https://safe.example" },
      ] },
    ] }]; } },
    storage: {
      local: {
        async get(keys) { return pick(read(), keys); },
        async set(obj) { const s = read(), ch = {}; for (const k of Object.keys(obj)) { ch[k] = { oldValue: s[k], newValue: obj[k] }; s[k] = obj[k]; } write(s); fire(ch); },
        async remove(keys) { const s = read(), arr = Array.isArray(keys) ? keys : [keys], ch = {}; for (const k of arr) { ch[k] = { oldValue: s[k] }; delete s[k]; } write(s); fire(ch); },
        async clear() { const s = read(), ch = {}; for (const k of Object.keys(s)) ch[k] = { oldValue: s[k] }; write({}); fire(ch); },
      },
      sync: {
        async get(keys) { return pick({ appMode: "home" }, keys); },
        async set() {}, async remove() {},
      },
      onChanged: { addListener: (fn) => listeners.push(fn), removeListener: (fn) => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); } },
    },
  };
  window.__exports = [];
  const orig = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (b) => { try { if (b && b.type === "application/json") b.text().then((t) => window.__exports.push(t)); } catch {} return orig(b); };
}

const failures = [];
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`); if (!ok) failures.push(name); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-first-run"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const jsErrors = [];      // uncaught JS / real console.error
  const localMisses = [];   // 404s from OUR http server (real missing assets)
  page.on("pageerror", (e) => jsErrors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) jsErrors.push(`console: ${m.text()}`); });
  page.on("response", (r) => { if (r.status() === 404 && r.url().startsWith(`http://localhost:${PORT}/`)) localMisses.push(r.url().replace(`http://localhost:${PORT}`, "")); });
  await page.evaluateOnNewDocument(inject);

  // Start empty.
  await page.goto(NEWTAB, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".bookmarks-shell", { timeout: 8000 });

  // 1) Real Import: upload the old backup to the sidebar's JSON file input.
  //    Handler does JSON.parse -> chrome.storage.local.set -> location.reload().
  const fileInput = await page.$('input[type="file"][accept=".json"]');
  check("import file input exists in settings", !!fileInput);
  if (fileInput) {
    await fileInput.uploadFile(backupPath);
    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 6000 }).catch(() => {});
    await page.waitForSelector(".tile, .tile-row, .empty", { timeout: 8000 }).catch(() => {});
  }
  const tabs = await page.$$eval("#category-tabs .tab", (els) => els.map((e) => e.textContent.trim()));
  check("old backup imported: category tabs render", tabs.includes("Quick") && tabs.includes("Dev"), tabs.join(","));
  const greeting = await page.$eval(".greeting h1", (e) => e.textContent).catch(() => "");
  check("old backup imported: greeting shows name", greeting.includes("SmokeUser"), greeting);
  const quickTiles = await page.$$eval(".tile:not(.tile-add), .tile-row:not(.tile-row-add)", (els) => els.length);
  check("old backup imported: Quick shows its 2 bookmarks (incl bad-favicon one)", quickTiles === 2, `got ${quickTiles}`);

  // 2) Live search filter.
  await page.type("#search-input", "youtube");
  await wait(300);
  const filtered = await page.$$eval(".tile:not(.tile-add), .tile-row:not(.tile-row-add)", (els) => els.length);
  check("search filters shortcuts live", filtered === 1, `got ${filtered}`);
  await page.$eval("#search-input", (e) => { e.value = ""; e.dispatchEvent(new Event("input", { bubbles: true })); });
  await wait(150);

  // 3) Add a bookmark via the dialog; verify it persists with the stored shape.
  await page.click(".tile-add, .tile-row-add");
  await page.waitForSelector(".overlay.bm-dialog input[type=text]", { timeout: 5000 });
  const inputs = await page.$$(".overlay.bm-dialog input[type=text]");
  await inputs[0].type("https://news.ycombinator.com");
  await inputs[1].type("HN");
  await page.click(".overlay.bm-dialog .btn-primary");
  await wait(500);
  const added = await page.evaluate(() => chrome.storage.local.get("bookmarks"));
  check("add-bookmark dialog persists with intact shape", Array.isArray(added.bookmarks) && added.bookmarks.some((b) => b.title === "HN" && typeof b.order === "number"));

  // 4) Export produces a complete, re-importable JSON backup.
  await page.click("#btn-settings");
  await wait(300);
  await page.evaluate(() => { const b = [...document.querySelectorAll(".settings-sidebar button")].find((x) => x.textContent.trim() === "Export"); b && b.click(); });
  await wait(400);
  const exported = await page.evaluate(() => window.__exports[window.__exports.length - 1] || "");
  let parsed = null; try { parsed = JSON.parse(exported); } catch {}
  check("export builds valid JSON with all storage keys", !!parsed && ["settings", "categories", "bookmarks", "tasks"].every((k) => k in parsed), parsed ? Object.keys(parsed).join(",") : "unparseable");
  check("exported backup contains the added bookmark", !!parsed && parsed.bookmarks.some((b) => b.title === "HN"));

  // 5) A settings toggle persists to storage (24-Hour Time -> off).
  await page.evaluate(() => { const row = [...document.querySelectorAll(".settings-sidebar .setting-row")].find((r) => r.textContent.includes("24-Hour")); row?.querySelector('input[type="checkbox"]')?.click(); });
  await wait(400);
  const tf = await page.evaluate(() => chrome.storage.local.get("settings"));
  check("settings toggle persists (24h -> 12h)", tf.settings && tf.settings.timeFormat === "12h", tf.settings && tf.settings.timeFormat);
  await page.click("#btn-settings"); // close
  await wait(300);

  // 6) Full-screen tree/deck view: clicking TREE swaps the whole stage into the
  //    explorable bookmark tree. (Deeper deck assertions — both visual styles,
  //    persistence, subfolder expand, search, and security — live in
  //    scripts/tree-integration.mjs.)
  await page.evaluate(() => document.getElementById("btn-tree")?.click());
  await page.waitForSelector(".deck .deck-board", { timeout: 6000 });
  const tree = await page.evaluate(() => ({
    stageHasDeck: !!document.querySelector(".deck"),
    bodyClass: document.body.className,
    links: document.querySelectorAll(".deck-link").length,
    folders: document.querySelectorAll(".deck-folder").length,
    homeHidden: !document.querySelector(".bookmarks-shell"),
  }));
  check("tree button swaps whole stage into the deck (home hidden, bookmarks shown)",
    tree.stageHasDeck && tree.homeHidden && tree.bodyClass.includes("mode-deck") && tree.links >= 1 && tree.folders >= 1,
    JSON.stringify(tree));

  await page.keyboard.press("Escape");
  await wait(250);
  const backHome = await page.evaluate(() => ({
    deckGone: !document.querySelector(".deck"),
    homeBack: !!document.querySelector(".bookmarks-shell"),
    bodyClass: document.body.className,
  }));
  check("ESC returns to home view (deck gone, dashboard back)",
    backHome.deckGone && backHome.homeBack && !backHome.bodyClass.includes("mode-deck"),
    JSON.stringify(backHome));


  const layout = await page.evaluate(() => ({
    themeSeg: document.querySelectorAll(".theme-seg").length,
    widgets: document.querySelectorAll(".widgets-row").length,
    scrolls: document.body.scrollHeight > window.innerHeight + 2,
    gridJustify: (() => { const g = document.querySelector(".bookmark-grid, .bookmark-list"); return g ? getComputedStyle(g).justifyContent : ""; })(),
  }));
  check("no dark/light theme toggle present", layout.themeSeg === 0);
  check("no calendar/todo widget row present", layout.widgets === 0);
  check("page does not scroll vertically", layout.scrolls === false);
  check("shortcuts are centre-justified", layout.gridJustify === "center", layout.gridJustify);

  check("no uncaught JS / console errors (external favicon 404s ignored)", jsErrors.length === 0, jsErrors.slice(0, 5).join(" | "));
  check("no missing local assets (404 from the extension itself)", localMisses.length === 0, [...new Set(localMisses)].join(", "));
} finally {
  await browser.close();
  server.close();
}

console.log(failures.length ? `\n${failures.length} CHECK(S) FAILED` : "\nALL SMOKE CHECKS PASSED");
process.exit(failures.length ? 1 : 0);
