import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

const EXT = "E:/07_Open-source/Chrome_theme_for_homescreen";
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe",
  join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe")].find(existsSync);
if (!CHROME) { console.error("Chrome not found"); process.exit(1); }

const userData = join(os.tmpdir(), "ntab-real2-" + Date.now());
const flags = ["--no-first-run", "--headless=new", "--disable-gpu",
  `--user-data-dir=${userData}`, `--load-extension=${EXT}`, "--enable-extensions"];

function inject() {
  if (window.chrome && chrome.bookmarks) {
    const TREE = [{ id: "0", title: "", children: [
      { id: "1", title: "Bookmarks Bar", children: [
        { id: "11", title: "Gmail", url: "https://mail.google.com" },
        { id: "12", title: "Work", children: [
          { id: "121", title: "Figma", url: "https://figma.com" },
          { id: "122", title: "Sub", children: [{ id: "1221", title: "Deep", url: "https://deep.example" }] },
        ] },
      ] },
      { id: "2", title: "Other Bookmarks", children: [{ id: "21", title: "YouTube", url: "https://youtube.com" }] },
    ] }];
    chrome.bookmarks.getTree = () => Promise.resolve(JSON.parse(JSON.stringify(TREE)));
  }
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: false, args: flags });
try {
  // Find the Syncly extension id.
  const mgr = await browser.newPage();
  await mgr.goto("chrome://extensions", { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 800));
  const id = await mgr.evaluate(() => {
    const rows = [...document.querySelectorAll("extensions-item")];
    const nt = rows.find((r) => (r.shadowRoot?.textContent || "").includes("Syncly"));
    if (!nt) return null;
    return nt.id; // extensions-item exposes .id
  });
  const id2 = id || await mgr.evaluate(() => {
    // fallback: read from the disable/delete buttons' data
    const rows = [...document.querySelectorAll("extensions-item")];
    const nt = rows.find((r) => (r.shadowRoot?.textContent || "").includes("Syncly"));
    return nt ? (nt.getAttribute("id") || null) : null;
  });
  console.log("EXT ID:", id2);
  await mgr.close();
  if (!id2) { console.log("Syncly not loaded — check manifest/load errors."); process.exit(2); }

  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
  await page.evaluateOnNewDocument(inject);

  await page.goto(`chrome-extension://${id2}/src/presentation/newTab/newTab.html`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1500));

  const home = await page.evaluate(() => ({
    url: location.href,
    hasShell: !!document.querySelector(".bookmarks-shell, .home-shell, #app, .dashboard"),
    bodyClass: document.body.className,
  }));
  console.log("HOME:", JSON.stringify(home));

  const clicked = await page.evaluate(() => {
    const b = document.getElementById("btn-tree") || document.querySelector("[data-view=tree]");
    if (b) { b.click(); return true; }
    return false;
  });
  console.log("TREE BTN CLICKED:", clicked);
  await new Promise((r) => setTimeout(r, 1200));

  const deck = await page.evaluate(() => ({
    deck: !!document.querySelector(".deck"),
    folders: document.querySelectorAll(".deck-folder").length,
    links: document.querySelectorAll(".deck-link").length,
    subs: document.querySelectorAll(".deck-sub").length,
    empty: document.querySelector(".deck-empty")?.textContent || "",
    bodyClass: document.body.className,
  }));
  console.log("DECK:", JSON.stringify(deck));
  console.log("ERRORS:", errs.length ? errs.slice(0, 8).join(" | ") : "none");
} finally {
  await browser.close();
}
