import puppeteer from "puppeteer-core";

const EXT_PATH = process.cwd().replace(/\\/g, "/");
console.log("EXT_PATH:", EXT_PATH);

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
  dumpio: false,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    `--load-extension=${EXT_PATH}`,
    `--disable-extensions-except=${EXT_PATH}`,
  ],
});

function findExtId() {
  for (const t of browser.targets()) {
    const m = t.url().match(/chrome-extension:\/\/([a-p]{32})/);
    if (m) return m[1];
  }
  return null;
}

let extId = null;
for (let i = 0; i < 20 && !extId; i++) {
  await new Promise((r) => setTimeout(r, 200));
  extId = findExtId();
}
console.log("extId:", extId);

if (!extId) {
  console.log("TARGETS:");
  for (const t of browser.targets()) console.log("  ", t.type(), t.url());
  await browser.close();
  process.exit(2);
}

const page = await browser.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
page.on("requestfailed", (r) => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));

await page.evaluateOnNewDocument(() => {
  globalThis.chrome = globalThis.chrome || {};
  globalThis.chrome.tabs = {
    query: () => Promise.resolve([
      { id: 1, active: true, windowId: 1, title: "Example Domain", url: "https://example.com/" },
    ]),
  };
  const mem = {};
  globalThis.chrome.storage = {
    local: {
      get: (k) => Promise.resolve(typeof k === "string" ? (mem[k] ?? {}) : Object.fromEntries((k || []).map((kk) => [kk, mem[kk]]))),
      set: (v) => { Object.assign(mem, v); return Promise.resolve(); },
    },
    onChanged: { addListener() {} },
  };
});

await page.goto(`chrome-extension://${extId}/src/presentation/popup/popup.html`, { waitUntil: "networkidle0", timeout: 15000 });
await new Promise((r) => setTimeout(r, 800));

const state = await page.evaluate(() => ({
  url: document.getElementById("bm-url")?.value,
  title: document.getElementById("bm-title")?.value,
  category: document.querySelector(".custom-select-label")?.textContent,
  error: document.getElementById("bm-error")?.textContent,
  submitDisabled: document.getElementById("bm-submit")?.disabled,
}));
console.log("=== REAL POPUP STATE (mocked normal-tab) ===");
console.log(JSON.stringify(state, null, 2));
console.log("=== CONSOLE / ERRORS ===");
console.log(logs.join("\n") || "(none)");

await browser.close();
