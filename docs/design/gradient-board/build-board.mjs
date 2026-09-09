/**
 * Emits the .dc.html artboards + canvas.json for the gradient design board
 * from the single recipe list in gradients.mjs.
 *
 *   node build-board.mjs
 *
 * Blur radii are authored at viewport scale (1440px wide). Tiles scale them
 * by tileWidth/1440 so a small swatch reads as a true miniature of the
 * full-bleed result rather than a differently-blurred thing.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GRADIENTS, FAMILIES, byFamily } from "./gradients.mjs";

const OUT = dirname(fileURLToPath(import.meta.url));
const VIEWPORT = 1440;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Scale a `blur(Npx)` filter string to tile size. */
function scaleFilter(filter, scale) {
  if (!filter) return "";
  return filter.replace(/blur\(([\d.]+)px\)/g, (_, px) => `blur(${Math.max(1, Math.round(Number(px) * scale))}px)`);
}

/** Render the stacked aura layers + grain for one sample box. */
function renderSample(g, mode, scale) {
  const spec = g[mode];
  const layers = spec.layers.map((l) => {
    const decl = [
      `background:${l.bg}`,
      l.blend && l.blend !== "normal" ? `mix-blend-mode:${l.blend}` : "",
      l.filter ? `filter:${scaleFilter(l.filter, scale)}` : "",
      l.opacity != null ? `opacity:${l.opacity}` : "",
      l.size ? `background-size:${l.size}` : "",
    ].filter(Boolean).join(";");
    return `<i class="ly" style="${esc(decl)}"></i>`;
  }).join("");
  const grainOpacity = mode === "light" ? (g.grain * 0.55).toFixed(2) : g.grain;
  return `<span class="sample" style="background:${esc(spec.base)}">${layers}` +
    `<svg class="gr" style="opacity:${grainOpacity}" aria-hidden="true"><rect width="100%" height="100%" filter="url(#grain)"></rect></svg>` +
    `</span>`;
}

const GRAIN_DEF = `<svg class="defs" aria-hidden="true" focusable="false"><filter id="grain">` +
  `<feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" stitchTiles="stitch"></feTurbulence>` +
  `<feColorMatrix type="matrix" values="0.181 0.608 0.061 0 0.075 0.181 0.608 0.061 0 0.075 0.181 0.608 0.061 0 0.075 0 0 0 1 0"></feColorMatrix>` +
  `</filter></svg>`;

const FONTS = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap">`;

const BASE_CSS = `
  :root{
    --ink:#E8EAEE; --ink-2:#F2F4F7; --dim:#8A919C; --dim-2:#6B7280;
    --line:#24272D; --line-2:#343841; --page:#0E0E10; --card:#161619;
    --sans:"Plus Jakarta Sans",-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
    --mono:"JetBrains Mono",ui-monospace,Menlo,monospace;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--page);color:var(--ink);font-family:var(--sans);
       -webkit-font-smoothing:antialiased}
  a{color:#B9BEC8}a:hover{color:#E8EAEE}
  .defs{position:absolute;width:0;height:0;pointer-events:none}
  .sample{position:relative;display:block;overflow:hidden;isolation:isolate}
  .sample .ly{position:absolute;inset:0;display:block;pointer-events:none}
  .sample .gr{position:absolute;inset:0;width:100%;height:100%;
              mix-blend-mode:overlay;pointer-events:none}
`;

function page(title, css, body) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  ${FONTS}
  <style>${BASE_CSS}${css}</style>
</helmet>
${GRAIN_DEF}
${body}
</x-dc>
</body>
</html>
`;
}

/* ───────────────────────────── Sheets ───────────────────────────── */

const SHEET_W = 980, SHEET_H = 1680, TILE_W = 439, TILE_IMG_H = 230;
const SHEET_SCALE = TILE_W / VIEWPORT;

const SHEET_CSS = `
  .wrap{padding:40px}
  .head{margin:0 0 26px}
  .kicker{font-family:var(--mono);font-size:11px;letter-spacing:.14em;
          text-transform:uppercase;color:var(--dim-2);margin:0 0 10px}
  .h1{font-size:27px;font-weight:600;letter-spacing:-.02em;margin:0 0 8px;color:var(--ink-2)}
  .sub{font-size:13px;line-height:1.55;color:var(--dim);margin:0;max-width:62ch;text-wrap:pretty}
  .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
  .tile{display:flex;flex-direction:column;gap:0}
  .tile .sample{height:${TILE_IMG_H}px;border-radius:10px 10px 0 0;
                box-shadow:inset 0 0 0 1px rgba(232,234,238,.07)}
  .cap{background:var(--card);border:1px solid var(--line);border-top:none;
       border-radius:0 0 10px 10px;padding:11px 13px 12px}
  .cap-top{display:flex;align-items:baseline;gap:8px}
  .num{font-family:var(--mono);font-size:11px;color:var(--dim-2);flex-shrink:0}
  .nm{font-size:13.5px;font-weight:600;letter-spacing:-.01em;color:var(--ink-2)}
  .fam{font-family:var(--mono);font-size:10px;letter-spacing:.08em;
       text-transform:uppercase;color:var(--dim-2);margin-left:auto;flex-shrink:0}
  .note{font-size:11.5px;line-height:1.45;color:var(--dim);margin:5px 0 0}
  .flag{display:inline-block;margin:7px 0 0;padding:2px 7px;border-radius:4px;
        background:rgba(245,215,110,.12);color:#D8C078;font-family:var(--mono);
        font-size:10px;letter-spacing:.04em}
`;

function sheet(famA, famB, sheetNo) {
  const items = [...byFamily(famA.key), ...byFamily(famB.key)];
  const tiles = items.map((g) => `
      <figure class="tile">
        ${renderSample(g, "dark", SHEET_SCALE)}
        <figcaption class="cap">
          <span class="cap-top">
            <span class="num">${String(g.n).padStart(2, "0")}</span>
            <span class="nm">${esc(g.name)}</span>
            <span class="fam">${esc(g.fam)}</span>
          </span>
          <p class="note">${esc(g.note)}</p>
          ${g.flag ? `<span class="flag">${esc(g.flag)}</span>` : ""}
        </figcaption>
      </figure>`).join("");

  return page(`Sheet ${sheetNo}`, SHEET_CSS, `
<div class="wrap">
  <header class="head">
    <p class="kicker">Sheet ${sheetNo} of 5 · Dark mode</p>
    <h1 class="h1">${esc(famA.key)} &amp; ${esc(famB.key)}</h1>
    <p class="sub">${esc(famA.key)} — ${esc(famA.blurb)}. ${esc(famB.key)} — ${esc(famB.blurb)}.</p>
  </header>
  <div class="grid">${tiles}
  </div>
</div>`);
}

/* ─────────────────────────── Light pass ─────────────────────────── */

const LP_W = 1000, LP_H = 1660, LP_TILE_W = 170;
const LP_SCALE = LP_TILE_W / VIEWPORT;

const LIGHT_CSS = `
  .wrap{padding:40px}
  .kicker{font-family:var(--mono);font-size:11px;letter-spacing:.14em;
          text-transform:uppercase;color:var(--dim-2);margin:0 0 10px}
  .h1{font-size:27px;font-weight:600;letter-spacing:-.02em;margin:0 0 8px;color:var(--ink-2)}
  .sub{font-size:13px;line-height:1.55;color:var(--dim);margin:0 0 26px;max-width:70ch;text-wrap:pretty}
  .lgrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px}
  .lt{display:flex;flex-direction:column;gap:6px}
  .lt .sample{height:110px;border-radius:8px;
              box-shadow:inset 0 0 0 1px rgba(232,234,238,.09)}
  .ll{display:flex;align-items:baseline;gap:6px;padding:0 1px}
  .ll .num{font-family:var(--mono);font-size:10px;color:var(--dim-2)}
  .ll .nm{font-size:11px;color:var(--dim);letter-spacing:-.005em;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`;

function lightPass() {
  const tiles = GRADIENTS.map((g) => `
      <figure class="lt">
        ${renderSample(g, "light", LP_SCALE)}
        <figcaption class="ll">
          <span class="num">${String(g.n).padStart(2, "0")}</span>
          <span class="nm">${esc(g.name)}</span>
        </figcaption>
      </figure>`).join("");

  return page("Light pass", LIGHT_CSS, `
<div class="wrap">
  <p class="kicker">All 50 · Light mode</p>
  <h1 class="h1">Light pass</h1>
  <p class="sub">The same fifty in their light-mode treatment. White fields become the ground and the light layers invert to soft dark washes, so each gradient keeps its composition across both modes.</p>
  <div class="lgrid">${tiles}
  </div>
</div>`);
}

/* ──────────────────────────── Context ───────────────────────────── */

const CTX_W = 1440, CTX_H = 900;
const CTX_PICK = GRADIENTS.find((g) => g.id === "beam-drift");

const COLLECTIONS = [
  ["Reading list", 128], ["Design systems", 64], ["Engineering", 212],
  ["Typography", 37], ["Archive", 481],
];
const CARDS = [
  ["Refactoring UI", "refactoringui.com"], ["Type scale", "typescale.com"],
  ["Radix Primitives", "radix-ui.com"], ["Web.dev — Core Vitals", "web.dev"],
  ["Sources of light", "alistapart.com"], ["Grain & noise in UI", "css-tricks.com"],
  ["Motion principles", "motion.dev"], ["OKLCH picker", "oklch.com"],
];

function contextCss(mode) {
  const d = mode === "dark";
  return `
  .dash{position:relative;display:flex;width:100%;height:100vh;overflow:hidden;
        isolation:isolate;color:${d ? "#E8EAEE" : "#16181D"}}
  .dash .sample{position:absolute;inset:0;height:100%;z-index:0}
  .side{position:relative;z-index:10;width:260px;min-width:260px;height:100%;
        background:${d ? "#121212" : "#FCFCFD"};
        border-right:1px solid ${d ? "#24272D" : "#E6E8EC"};
        display:flex;flex-direction:column;isolation:isolate}
  .ws{display:flex;align-items:center;gap:9px;padding:14px 14px 12px}
  .ws-mark{width:26px;height:26px;border-radius:7px;flex-shrink:0;
           background:${d ? "linear-gradient(135deg,#717886,#3F444E)" : "linear-gradient(135deg,#9AA0AC,#5A606C)"}}
  .ws-nm{font-size:13px;font-weight:600;letter-spacing:-.01em}
  .sbody{display:flex;flex-direction:column;gap:2px;padding:6px 10px;flex:1}
  .slabel{font-family:var(--mono);font-size:10px;letter-spacing:.12em;
          text-transform:uppercase;color:${d ? "#6B7280" : "#8A8F98"};padding:12px 8px 6px}
  .row{display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:7px;
       font-size:12.5px;color:${d ? "#C3C8D0" : "#3A3F48"}}
  .row.on{background:${d ? "rgba(232,234,238,.06)" : "rgba(22,24,29,.05)"};color:${d ? "#F2F4F7" : "#16181D"};font-weight:500}
  .dot{width:7px;height:7px;border-radius:2px;flex-shrink:0;
       background:${d ? "#555B66" : "#A8AEB8"}}
  .ct{margin-left:auto;font-family:var(--mono);font-size:10px;color:${d ? "#6B7280" : "#8A8F98"}}
  .main{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;overflow:hidden}
  .hdr{height:56px;min-height:56px;display:flex;align-items:center;
       gap:12px;padding:0 24px;background:transparent}
  .htitle{font-size:15px;font-weight:600;letter-spacing:-.01em}
  .hcount{font-family:var(--mono);font-size:11px;color:${d ? "#8A919C" : "#555B66"}}
  .hspace{flex:1}
  .pill{height:30px;display:flex;align-items:center;padding:0 13px;border-radius:999px;
        font-size:12px;border:1px solid ${d ? "#343841" : "#CFD4DC"};
        background:${d ? "rgba(232,234,238,.04)" : "rgba(255,255,255,.6)"};
        color:${d ? "#C3C8D0" : "#3A3F48"}}
  .content{flex:1;padding:20px 24px 24px;overflow:hidden}
  .cgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;max-width:1180px}
  .card{background:${d ? "#1E2025" : "#FFFFFF"};
        border:1px solid ${d ? "#24272D" : "#E6E8EC"};border-radius:12px;padding:13px;
        display:flex;flex-direction:column;gap:9px;
        box-shadow:${d ? "none" : "0 1px 2px rgba(16,24,40,.04)"}}
  .fav{width:34px;height:34px;border-radius:9px;
       background:${d ? "#2C3038" : "#F2F4F7"};
       border:1px solid ${d ? "#343841" : "#E6E8EC"}}
  .ctitle{font-size:12.5px;font-weight:600;line-height:1.3;letter-spacing:-.01em}
  .curl{font-family:var(--mono);font-size:10.5px;color:${d ? "#6B7280" : "#8A8F98"}}
  .stamp{position:absolute;right:22px;bottom:18px;z-index:20;display:flex;
         align-items:center;gap:8px;padding:7px 12px;border-radius:999px;
         background:${d ? "rgba(10,10,12,.72)" : "rgba(255,255,255,.8)"};
         border:1px solid ${d ? "#343841" : "#CFD4DC"};
         backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
  .stamp b{font-size:12px;font-weight:600}
  .stamp span{font-family:var(--mono);font-size:10.5px;color:${d ? "#8A919C" : "#555B66"}}
`;
}

function context(mode) {
  const d = mode === "dark";
  const g = CTX_PICK;
  const rows = COLLECTIONS.map(([nm, n], i) =>
    `<div class="row${i === 1 ? " on" : ""}"><i class="dot"></i>${esc(nm)}<span class="ct">${n}</span></div>`
  ).join("");
  const cards = CARDS.map(([t, u]) =>
    `<article class="card"><i class="fav"></i><span class="ctitle">${esc(t)}</span><span class="curl">${esc(u)}</span></article>`
  ).join("");

  return page(`Context ${mode}`, contextCss(mode), `
<div class="dash">
  ${renderSample(g, mode, 1)}
  <aside class="side">
    <div class="ws"><i class="ws-mark"></i><span class="ws-nm">Syncly</span></div>
    <div class="sbody">
      <div class="slabel">Collections</div>
      ${rows}
    </div>
  </aside>
  <main class="main">
    <div class="hdr">
      <span class="htitle">Design systems</span>
      <span class="hcount">64</span>
      <span class="hspace"></span>
      <span class="pill">Recent</span>
      <span class="pill">Grid</span>
    </div>
    <div class="content">
      <div class="cgrid">${cards}</div>
    </div>
  </main>
  <div class="stamp"><b>${esc(g.name)}</b><span>No. ${String(g.n).padStart(2, "0")} · ${d ? "Dark" : "Light"}</span></div>
</div>`);
}

/* ───────────────────────────── Write ────────────────────────────── */

const sheets = [
  ["Main.dc.html", sheet(FAMILIES[0], FAMILIES[1], 1)],
  ["SheetTwo.dc.html", sheet(FAMILIES[2], FAMILIES[3], 2)],
  ["SheetThree.dc.html", sheet(FAMILIES[4], FAMILIES[5], 3)],
  ["SheetFour.dc.html", sheet(FAMILIES[6], FAMILIES[7], 4)],
  ["SheetFive.dc.html", sheet(FAMILIES[8], FAMILIES[9], 5)],
];

const files = [
  ...sheets,
  ["LightPass.dc.html", lightPass()],
  ["ContextDark.dc.html", context("dark")],
  ["ContextLight.dc.html", context("light")],
];

for (const [name, html] of files) {
  writeFileSync(join(OUT, name), html, "utf8");
}

const GAP = 100, ROW2 = SHEET_H + 140;
const canvas = {
  artboards: [
    { file: "Main.dc.html", x: 0, y: 0, w: SHEET_W, h: SHEET_H },
    { file: "SheetTwo.dc.html", x: SHEET_W + GAP, y: 0, w: SHEET_W, h: SHEET_H },
    { file: "SheetThree.dc.html", x: (SHEET_W + GAP) * 2, y: 0, w: SHEET_W, h: SHEET_H },
    { file: "SheetFour.dc.html", x: (SHEET_W + GAP) * 3, y: 0, w: SHEET_W, h: SHEET_H },
    { file: "SheetFive.dc.html", x: (SHEET_W + GAP) * 4, y: 0, w: SHEET_W, h: SHEET_H },
    { file: "LightPass.dc.html", x: (SHEET_W + GAP) * 5, y: 0, w: LP_W, h: LP_H },
    { file: "ContextDark.dc.html", x: 0, y: ROW2, w: CTX_W, h: CTX_H },
    { file: "ContextLight.dc.html", x: CTX_W + 140, y: ROW2, w: CTX_W, h: CTX_H },
  ],
  annotations: [
    {
      id: "how-to-read",
      x: 0, y: -230, w: 620,
      text: "50 monochrome background gradients for the Syncly new tab.\n\nSheets 1–5 hold ten each, grouped into families, in dark mode — that is the picking set. Each sample is built from the app's real aura contract: up to three stacked layers with mix-blend-mode, plus the same feTurbulence grain overlay the app already renders. Blur radii are scaled to tile size, so a swatch is a true miniature of the full-bleed result.\n\nThe two artboards below show No. 06 Beam Drift behind the actual homepage layout, dark and light. Components are unchanged — only the background moves.",
    },
    {
      id: "in-context",
      x: 0, y: ROW2 - 150, w: 560,
      text: "In context — the sidebar stays solid (#121212) and sits above the aura with isolation:isolate, so a gradient only reads through the main area. That is existing behaviour, not a choice made here.",
    },
    {
      id: "next-step",
      x: (SHEET_W + GAP) * 5, y: -230, w: 480,
      text: "Every recipe lives in gradients.mjs, keyed the same way a theme manifest is (base / layers / grain). Porting a keeper is a copy across, not a re-derivation.\n\nTell me the numbers you want and I will wire them into the theme system.",
    },
  ],
  launch: { view: "canvas" },
};

writeFileSync(join(OUT, "canvas.json"), JSON.stringify(canvas, null, 2), "utf8");
console.log(`wrote ${files.length} artboards + canvas.json (${GRADIENTS.length} gradients)`);
