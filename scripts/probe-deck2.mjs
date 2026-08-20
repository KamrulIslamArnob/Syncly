import puppeteer from "puppeteer-core";
import { readFileSync, existsSync } from "node:fs";
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
const URL = `http://localhost:${PORT}/scripts/deck-harness.html`;

const errors = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-first-run"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
  await page.goto(URL, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1200));
  const report = await page.evaluate(() => ({
    deck: !!document.querySelector(".deck"),
    folders: document.querySelectorAll(".deck-folder").length,
    links: document.querySelectorAll(".deck-link").length,
    freq: document.querySelectorAll(".deck-freq-chip").length,
    bodyStyle: document.body.getAttribute("data-deck-style"),
    meta: document.querySelector(".deck-meta")?.textContent || "",
    boardLen: document.querySelector(".deck-board")?.innerHTML.length || 0,
    firstFolderHTML: document.querySelector(".deck-folder")?.outerHTML.slice(0, 400) || "",
  }));
  console.log("DECK REPORT:", JSON.stringify(report, null, 2));
  console.log("JS ERRORS:", errors.length ? errors.join("\n") : "none");
} finally {
  await browser.close();
  server.close();
}
