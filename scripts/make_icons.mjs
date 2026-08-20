import puppeteer from "puppeteer-core";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
].filter(Boolean).find((p) => existsSync(p));

if (!CHROME) {
  console.error("Chrome not found.");
  process.exit(1);
}

const svgPath = join(ROOT, "public/icons/logo-fill-icon-gradient.svg");
const svgData = readFileSync(svgPath, "utf8");
const svgBase64 = Buffer.from(svgData).toString("base64");
const svgDataUrl = `data:image/svg+xml;base64,${svgBase64}`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();

  const results = await page.evaluate(async (dataUrl) => {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = dataUrl;
    });

    const sizes = [16, 32, 48, 128];
    const out = {};

    for (const size of sizes) {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, size, size);
      out[size] = canvas.toDataURL("image/png");
    }

    return out;
  }, svgDataUrl);

  for (const [size, dataUrl] of Object.entries(results)) {
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const outPath = join(ROOT, `public/icons/icon${size}.png`);
    writeFileSync(outPath, buffer);
    console.log(`Generated ${outPath} (${size}x${size}, ${buffer.length} bytes)`);
  }
} finally {
  await browser.close();
}
