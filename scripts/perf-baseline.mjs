// PERF-T12 — Performance baseline harness (dev-only, local, privacy-first).
//
// Serves the repo over HTTP (same pattern as smoke.mjs — stable Chrome no
// longer honours --load-extension), loads the real new-tab page with an
// in-memory chrome shim backed by N synthetic bookmarks, and collects:
//   - syncly:first-render measure (needs ?perf=1, wired in newTabController)
//   - deck _load() durations (window.__synclyPerf.loads)
//   - navigation timing + long-task count
//   - CDP Performance.getMetrics heap stats
//
// Usage:
//   node scripts/perf-baseline.mjs [--n 500] [--out perf-report.json] [--assert]
//   CHROME_PATH="..." to override the Chrome executable.
//
// Budgets are for before/after deltas on the SAME machine, not absolutes.

import puppeteer from "puppeteer-core";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createServer } from "node:http";

const ROOT = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const N = parseInt(argOf("--n", "300"), 10);
const OUT = argOf("--out", "perf-report.json");
const ASSERT = args.includes("--assert");

const BUDGETS = { firstRenderMs: 500, loadMs: 150 };

const CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
].filter(Boolean).find((p) => existsSync(p));
if (!CHROME) { console.error("Chrome not found; set CHROME_PATH."); process.exit(1); }

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
const server = createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const file = join(ROOT, p);
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[ext(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});
function ext(p) { const i = p.lastIndexOf("."); return i < 0 ? "" : p.slice(i); }
await new Promise((r) => server.listen(0, r));
const PORT = server.address().port;
const NEWTAB = `http://localhost:${PORT}/src/presentation/newTab/newTab.html?perf=1`;

// Synthetic library: N leaf bookmarks spread across folders under Other Bookmarks.
function inject(n) {
  function buildTree(count) {
    const others = [];
    const perFolder = Math.max(10, Math.ceil(count / 10));
    for (let f = 0; f < Math.ceil(count / perFolder); f++) {
      const children = [];
      for (let b = 0; b < perFolder && children.length + others.length * 0 < count; b++) {
        const idx = f * perFolder + b;
        if (idx >= count) break;
        children.push({ id: `s${idx}`, title: `Synthetic Bookmark ${idx} — perf fixture`, url: `https://example${idx}.com/page` });
      }
      others.push({ id: `sf${f}`, title: `Synthetic Folder ${f}`, children });
    }
    return [{ id: "0", title: "", children: [
      { id: "1", title: "Bookmarks Bar", children: [] },
      { id: "2", title: "Other Bookmarks", children: others },
    ] }];
  }
  const TREE = buildTree(n);
  window.__TREE = TREE;
  const KEY = "__nt_store";
  if (localStorage.getItem(KEY) === null) localStorage.setItem(KEY, JSON.stringify({}));
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const write = (o) => localStorage.setItem(KEY, JSON.stringify(o));
  const listeners = [];
  const pick = (store, keys) => {
    if (keys == null) return { ...store };
    if (typeof keys === "string") return keys in store ? { [keys]: store[keys] } : {};
    if (Array.isArray(keys)) { const o = {}; for (const k of keys) if (k in store) o[k] = store[k]; return o; }
    const o = {}; for (const k of Object.keys(keys)) o[k] = k in store ? store[k] : keys[k]; return o;
  };
  window.chrome = {
    runtime: { id: "shim", getURL: (p) => p },
    bookmarks: {
      async getTree() { return JSON.parse(JSON.stringify(TREE)); },
    },
    storage: {
      local: {
        async get(keys) { return pick(read(), keys); },
        async set(obj) { const s = read(); Object.assign(s, obj); write(s); },
        async remove(keys) { const s = read(); for (const k of [keys].flat()) delete s[k]; write(s); },
        async clear() { write({}); },
      },
      sync: { async get(keys) { return pick({}, keys); }, async set() {}, async remove() {} },
      onChanged: { addListener: (fn) => listeners.push(fn), removeListener: () => {} },
    },
  };
  // Long-task counter for frame-health context.
  window.__longTasks = 0;
  try { new PerformanceObserver((l) => { window.__longTasks += l.getEntries().length; }).observe({ entryTypes: ["longtask"] }); } catch {}
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-first-run"] });
const report = { n: N, budgets: BUDGETS, timestamp: new Date().toISOString() };
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const client = await page.target().createCDPSession();
  await client.send("Performance.enable");
  await page.evaluateOnNewDocument(inject, N);

  const t0 = Date.now();
  await page.goto(NEWTAB, { waitUntil: "load" });
  await page.waitForSelector(".raindrop-dashboard", { timeout: 15000 });
  await wait(1200); // let post-render settles finish

  report.wallClockToShellMs = Date.now() - t0;
  report.perf = await page.evaluate(() => {
    const fr = performance.getEntriesByName("syncly:first-render").pop();
    const nav = performance.getEntriesByType("navigation")[0];
    const loads = (window.__synclyPerf?.loads || []);
    return {
      firstRenderMs: fr ? fr.duration : null,
      domContentLoadedMs: nav ? nav.domContentLoadedEventEnd : null,
      loadEventMs: nav ? nav.loadEventEnd : null,
      deckLoads: loads.length,
      deckLoadAvgMs: loads.length ? loads.reduce((a, b) => a + b, 0) / loads.length : null,
      deckLoadMaxMs: loads.length ? Math.max(...loads) : null,
      longTasks: window.__longTasks || 0,
      domNodes: document.getElementsByTagName("*").length,
    };
  });
  const metrics = await client.send("Performance.getMetrics");
  const metric = (name) => metrics.metrics.find((m) => m.name === name)?.value ?? null;
  report.heapMb = {
    jsHeapUsed: +(metric("JSHeapUsedSize") / 1048576).toFixed(2),
    jsHeapTotal: +(metric("JSHeapTotalSize") / 1048576).toFixed(2),
  };
} finally {
  await browser.close();
  server.close();
}

writeFileSync(join(ROOT, OUT), JSON.stringify(report, null, 2));
console.log(`\n=== Syncly perf baseline (N=${N}) ===`);
console.log(`first render        : ${report.perf.firstRenderMs != null ? report.perf.firstRenderMs.toFixed(1) + " ms" : "n/a (flag missing?)"}   budget ${BUDGETS.firstRenderMs} ms`);
console.log(`deck _load avg/max  : ${report.perf.deckLoadAvgMs?.toFixed(1)} / ${report.perf.deckLoadMaxMs?.toFixed(1)} ms   budget ${BUDGETS.loadMs} ms`);
console.log(`wall clock to shell : ${report.wallClockToShellMs} ms`);
console.log(`dom nodes           : ${report.perf.domNodes}`);
console.log(`long tasks          : ${report.perf.longTasks}`);
console.log(`heap used/total     : ${report.heapMb.jsHeapUsed} / ${report.heapMb.jsHeapTotal} MB`);
console.log(`report written      : ${OUT}`);

if (ASSERT) {
  const fails = [];
  if (report.perf.firstRenderMs != null && report.perf.firstRenderMs > BUDGETS.firstRenderMs) fails.push(`first-render ${report.perf.firstRenderMs.toFixed(1)}ms > ${BUDGETS.firstRenderMs}ms`);
  if (report.perf.deckLoadMaxMs != null && report.perf.deckLoadMaxMs > BUDGETS.loadMs) fails.push(`_load max ${report.perf.deckLoadMaxMs.toFixed(1)}ms > ${BUDGETS.loadMs}ms`);
  if (fails.length) { console.error(`\nBUDGET FAILED:\n- ${fails.join("\n- ")}`); process.exit(1); }
  console.log("BUDGETS OK");
}
