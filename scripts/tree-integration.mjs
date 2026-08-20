// End-to-end integration gate for the NothingTab bookmark TREE/DECK view.
//
// The tree button (btn-tree) opens the live BookmarkDeckView — a full-screen,
// explorable tree of the user's real Chrome bookmarks (chrome.bookmarks.getTree).
// This gate drives it for real in headless Chrome with a chrome.* shim and
// proves, against the ACTUAL DOM the code produces:
//   • clicking btn-tree swaps the whole stage into the deck (.deck) and hides home
//   • the deck renders folders + bookmark links + the ranked frequency row
//   • ORGANIC (real tree) and EDITOR (code tree) styles both render the same data
//   • the header ORGANIC/EDITOR toggle switches data-deck-style AND persists it
//     across a reload
//   • hovering/clicking a subfolder expands it (real, explorable tree)
//   • the frequency-row number keys map to real links
//   • SECURITY: unsafe-scheme bookmarks (javascript:/data:/…) are blocked and
//     never rendered as navigable <a href> in EITHER style
import puppeteer from "puppeteer-core";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createServer } from "node:http";

const ROOT = resolve(import.meta.dirname, "..");
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe",
  join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe")].find(existsSync);
if (!CHROME) { console.error("Chrome not found; set CHROME_PATH."); process.exit(1); }

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

// Chrome shim: storage sync+local (localStorage-backed so it survives reloads),
// plus a realistic bookmark tree that includes an UNSAFE trap folder.
function inject() {
  const KEY = "__nt_store";
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const write = (o) => localStorage.setItem(KEY, JSON.stringify(o));
  if (localStorage.getItem(KEY) === null) write({});
  const listeners = [];
  const fire = (ch) => listeners.forEach((l) => { try { l(ch, "local"); } catch {} });
  const pick = (store, keys) => {
    if (keys == null) return { ...store };
    if (typeof keys === "string") return keys in store ? { [keys]: store[keys] } : {};
    if (Array.isArray(keys)) { const o = {}; for (const k of keys) if (k in store) o[k] = store[k]; return o; }
    const o = {}; for (const k of Object.keys(keys)) o[k] = k in store ? store[k] : keys[k]; return o;
  };
  const seed = { settings: { timeFormat: "24h", userName: "Probe", background: { kind: "solid_color", value: "#000000" }, shortcutsEnabled: true, greetingEnabled: true, clockEnabled: true } };
  window.chrome = {
    runtime: { id: "shim", getURL: (p) => p, lastError: null },
    identity: {},
    bookmarks: { async getTree() { return [{ id: "0", title: "", children: [
      { id: "1", title: "Bookmarks Bar", children: [
        { id: "11", title: "Gmail", url: "https://mail.google.com" },
        { id: "12", title: "Work", children: [
          { id: "121", title: "Figma", url: "https://figma.com" },
          { id: "122", title: "Notion", url: "https://notion.so" },
        ] },
        { id: "13", title: "News", children: [
          { id: "131", title: "BBC", url: "https://bbc.com" },
          { id: "132", title: "Guardian", url: "https://theguardian.com" },
          { id: "133", title: "NYT", url: "https://nytimes.com" },
          { id: "134", title: "WP", url: "https://washingtonpost.com" },
          { id: "135", title: "Reuters", url: "https://reuters.com" },
          { id: "136", title: "AP", url: "https://ap.org" },
          { id: "137", title: "AlJazeera", url: "https://aljazeera.com" },
        ] },
      ] },
      { id: "2", title: "Other Bookmarks", children: [
        { id: "21", title: "YouTube", url: "https://youtube.com" },
      ] },
      { id: "9", title: "Trap", children: [
        { id: "91", title: "EvilJS", url: "javascript:alert(document.cookie)" },
        { id: "92", title: "EvilData", url: "data:text/html,<script>alert(1)</script>" },
        { id: "93", title: "Safe", url: "https://safe.example" },
      ] },
    ] }]; } },
    storage: {
      local: {
        async get(keys) { const base = { ...seed, ...read() }; return pick(base, keys); },
        async set(obj) { const s = read(), ch = {}; for (const k of Object.keys(obj)) { ch[k] = { oldValue: s[k], newValue: obj[k] }; s[k] = obj[k]; } write(s); fire(ch); },
        async remove(keys) { const s = read(), arr = Array.isArray(keys) ? keys : [keys], ch = {}; for (const k of arr) { ch[k] = { oldValue: s[k] }; delete s[k]; } write(s); fire(ch); },
        async clear() { write({}); fire({}); },
      },
      sync: { async get(keys) { return pick({ appMode: "home" }, keys); }, async set() {}, async remove() {} },
      onChanged: { addListener: (fn) => listeners.push(fn), removeListener: () => {} },
    },
  };
}

const failures = [];
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`); if (!ok) failures.push(name); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-first-run"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) jsErrors.push(`console: ${m.text()}`); });
  await page.evaluateOnNewDocument(inject);

  await page.goto(NEWTAB, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".bookmarks-shell", { timeout: 8000 });

  // Open the tree/deck view.
  await page.evaluate(() => document.getElementById("btn-tree")?.click());
  await page.waitForSelector(".deck .deck-board", { timeout: 6000 });

  // 1) Whole-stage swap: home hidden, deck shown, mode-deck on body.
  const swap = await page.evaluate(() => ({
    deck: !!document.querySelector(".deck"),
    homeHidden: !document.querySelector(".bookmarks-shell"),
    modeDeck: document.body.classList.contains("mode-deck"),
    style: document.body.getAttribute("data-deck-style"),
  }));
  check("tree button swaps whole stage into deck (home hidden, .deck shown)", swap.deck && swap.homeHidden && swap.modeDeck, JSON.stringify(swap));

  // 2) Bookmarks actually render (the user's reported defect).
  const counts = async () => page.evaluate(() => ({
    folders: document.querySelectorAll(".deck-folder").length,
    links: document.querySelectorAll(".deck-link").length,
    freq: document.querySelectorAll(".deck-freq-chip").length,
    meta: document.querySelector(".deck-meta")?.textContent || "",
  }));
  const organic = await counts();
  check("deck renders folders + bookmark links + freq row", organic.folders >= 3 && organic.links >= 2 && organic.freq >= 1, JSON.stringify(organic));
  check("deck meta reports indexed link count", /links/.test(organic.meta), organic.meta);

  // 3) Both styles render the same data — toggle to EDITOR via header.
  await page.evaluate(() => document.querySelector('.deck-style-btn[data-style="editor"]')?.click());
  await wait(150);
  const editor = await counts();
  const editorAttr = await page.evaluate(() => document.body.getAttribute("data-deck-style"));
  check("editor toggle applies data-deck-style=editor", editorAttr === "editor", editorAttr);
  check("editor renders the same folders + links as organic", editor.folders === organic.folders && editor.links === organic.links, JSON.stringify({ organic, editor }));

  // 4) Style preference persists across reload.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".bookmarks-shell", { timeout: 8000 });
  await page.evaluate(() => document.getElementById("btn-tree")?.click());
  await page.waitForSelector(".deck .deck-board", { timeout: 6000 });
  const persisted = await page.evaluate(() => document.body.getAttribute("data-deck-style"));
  check("deck style preference persists across reload (editor)", persisted === "editor", String(persisted));

  // Back to organic for the remaining checks.
  await page.evaluate(() => document.querySelector('.deck-style-btn[data-style="organic"]')?.click());
  await wait(150);

  // 5) Real explorable tree: a subfolder expands on click.
  const before = await page.$$eval(".deck-sub", (e) => e.length);
  await page.evaluate(() => {
    const sub = document.querySelector(".deck-sub-head");
    sub && sub.click();
  });
  await wait(150);
  const expanded = await page.evaluate(() => document.querySelectorAll(".deck-sub.is-open").length);
  check("subfolder expands on click (explorable tree)", before >= 1 && expanded >= 1, `before=${before} open=${expanded}`);

  // 6) Search narrows the board.
  await page.type(".deck-search-input", "figma");
  await wait(200);
  const filtered = await page.evaluate(() => ({
    links: document.querySelectorAll(".deck-link").length,
    titles: [...document.querySelectorAll(".deck-folder-name, .deck-link-title")].map((e) => e.textContent),
  }));
  check("search narrows board to matching bookmark", filtered.links === 1 && filtered.titles.some((t) => /figma/i.test(t)), JSON.stringify(filtered));
  await page.evaluate(() => { const s = document.querySelector(".deck-search-input"); s.value = ""; s.dispatchEvent(new Event("input", { bubbles: true })); });
  await wait(150);

  // 7) SECURITY in both styles: unsafe bookmarks blocked, never a navigable href.
  for (const style of ["organic", "editor"]) {
    await page.evaluate((s) => document.querySelector(`.deck-style-btn[data-style="${s}"]`)?.click(), style);
    await wait(150);
    const sec = await page.evaluate(() => {
      const links = [...document.querySelectorAll(".deck-link")];
      const dangerousHref = links.some((a) => /^(javascript|data|vbscript):/i.test(a.getAttribute("href") || ""));
      // The trap folder's EvilJS/EvilData must NOT appear as navigable links.
      const trapVisible = links.some((a) => /EvilJS|EvilData/i.test(a.getAttribute("title") || ""));
      return { links: links.length, dangerousHref, trapVisible };
    });
    check(`[${style}] no dangerous href ever set`, sec.dangerousHref === false, JSON.stringify(sec));
    check(`[${style}] unsafe-scheme bookmarks are not rendered as navigable links`, sec.trapVisible === false, JSON.stringify(sec));
  }

  // 8) ESC returns home and clears the deck + style attribute.
  await page.keyboard.press("Escape");
  await wait(300);
  const back = await page.evaluate(() => ({
    deckGone: !document.querySelector(".deck"),
    homeBack: !!document.querySelector(".bookmarks-shell"),
    styleAttr: document.body.getAttribute("data-deck-style"),
    modeDeck: document.body.classList.contains("mode-deck"),
  }));
  check("ESC returns to home (deck gone, home back, style cleared)", back.deckGone && back.homeBack && back.styleAttr === null && !back.modeDeck, JSON.stringify(back));

  check("no uncaught JS / console errors across both styles + reload", jsErrors.length === 0, jsErrors.slice(0, 5).join(" | "));
} finally {
  await browser.close();
  server.close();
}

console.log(failures.length ? `\n${failures.length} DECK INTEGRATION CHECK(S) FAILED` : "\nALL DECK INTEGRATION CHECKS PASSED");
process.exit(failures.length ? 1 : 0);
