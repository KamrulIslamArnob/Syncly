import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(".");
const PORT = 9125;
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/src/presentation/newTab/newTab.html";
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
await page.setViewport({ width: 1200, height: 800 });

const store = {
  bookmarks: [],
  categories: [{ id: "cat-1", name: "Inbox", order: 0 }],
  settings: { colorMode: "dark" },
};

await page.evaluateOnNewDocument(() => {
  const mem = {
    bookmarks: [],
    categories: [{ id: "cat-1", name: "Inbox", order: 0 }],
    settings: { colorMode: "dark" },
  };
  globalThis.chrome = {
    runtime: {
      getURL: (p) => p,
    },
    tabs: {
      query: () => Promise.resolve([{ id: 1, active: true, url: "https://example.com" }]),
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
                  { id: "10", title: "AI & ML", children: [{ id: "101", title: "ChatGPT", url: "https://chatgpt.com" }] },
                  { id: "11", title: "MCP & Skill", children: [{ id: "102", title: "GitHub", url: "https://github.com" }] },
                ],
              },
              {
                id: "2",
                title: "Other bookmarks",
                children: [{ id: "20", title: "Quickie", children: [] }],
              },
            ],
          },
        ]),
      create: (item) => Promise.resolve({ id: "bm-" + Date.now(), ...item }),
      onCreated: { addListener() {} },
      onRemoved: { addListener() {} },
      onChanged: { addListener() {} },
      onMoved: { addListener() {} },
      onChildrenReordered: { addListener() {} },
      onImportEnded: { addListener() {} },
    },
    storage: {
      local: {
        get: (keys) => Promise.resolve(typeof keys === "string" ? { [keys]: mem[keys] } : mem),
        set: (obj) => { Object.assign(mem, obj); return Promise.resolve(); },
      },
      onChanged: { addListener() {} },
    },
  };
});

await page.goto(`http://localhost:${PORT}/src/presentation/newTab/newTab.html`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 800));

// Click "+ Add Folder" button to open NewFolderDialogView
const btn = await page.$(".raindrop-add-col-btn");
if (btn) {
  await btn.click();
  await new Promise((r) => setTimeout(r, 300));
}

await page.screenshot({ path: "C:/Users/Kamru/.gemini/antigravity/brain/6ace10ad-9472-4767-8fec-630e2491a623/new_folder_modal_preview.png" });
console.log("Screenshot saved to new_folder_modal_preview.png");

const selectedLocation = await page.evaluate(() => {
  const sel = document.querySelector(".folder-dialog select");
  return sel ? sel.value : null;
});
console.log("Selected Location in Dialog:", selectedLocation);

await browser.close();
server.close();
