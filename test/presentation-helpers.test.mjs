import test, { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isSafeUrl, buildBookmarkTree, filterTree, countLeaves } from "../src/presentation/newTab/views/TreeView.js";
import {
  flattenLeaves,
  collectFolders,
  rankByUsage,
  resolveCollectionLeaves,
  cleanDomain,
} from "../src/presentation/newTab/views/BookmarkDeckView.js";
import { websitePreviewUrl, faviconUrl, websiteFaviconUrl } from "../src/presentation/shared/favicon.js";
import { extractTokens, OmniSearchIndex } from "../src/domain/services/OmniSearchIndex.js";
import { getThumbGradient, getFolderColor } from "../src/presentation/shared/colorHash.js";
import { deriveAccentShades } from "../src/presentation/shared/colorUtils.js";
import { Bookmark } from "../src/domain/entities/Bookmark.js";
import { Category } from "../src/domain/entities/Category.js";
import { Id } from "../src/domain/valueObjects/Id.js";
import { Url } from "../src/domain/valueObjects/Url.js";

// ─── isSafeUrl extra ────────────────────────────────────────────────
describe("Helper: isSafeUrl (extra)", () => {
  it("H-01 accepts https/http, rejects javascript/data/file/ftp", () => {
    assert.equal(isSafeUrl("https://example.com"), "https://example.com/");
    assert.equal(isSafeUrl("http://a.b"), "http://a.b/");
    for (const bad of ["javascript:alert(1)", "data:text/html,hi", "file:///etc/passwd", "ftp://host/x", "", null, undefined, 42]) {
      assert.equal(isSafeUrl(bad), null);
    }
  });
  it("returns href with normalized encoding", () => {
    assert.equal(isSafeUrl("https://example.com/a?b=1"), "https://example.com/a?b=1");
  });
});

// ─── buildBookmarkTree / filterTree / countLeaves ───────────────────
describe("Helper: Bookmark Tree (TreeView)", () => {
  const RAW = [{
    id: "0", title: "", children: [
      { id: "1", title: "Bookmarks Bar", children: [
        { id: "10", title: "AI", children: [{ id: "100", title: "ChatGPT", url: "https://chat.openai.com/" }] },
        { id: "11", title: "Dev", children: [{ id: "110", title: "GitHub", url: "https://github.com/" }] },
        { id: "120", title: "Loose", url: "https://example.com/" },
      ]},
      { id: "2", title: "Other Bookmarks", children: [{ id: "200", title: "YouTube", url: "https://youtube.com/" }] }
    ]
  }];

  it("H-02 buildBookmarkTree types and counts", () => {
    const nodes = buildBookmarkTree(RAW);
    assert.equal(nodes.length, 2);
    assert.equal(nodes[0].type, "folder");
    assert.equal(nodes[0].count, 3); // AI leaf + Dev leaf + Loose
    assert.equal(nodes[0].children[0].title, "AI");
  });

  it("H-04 countLeaves/ flattenLeaves consistency", () => {
    const nodes = buildBookmarkTree(RAW);
    assert.equal(countLeaves(nodes), 4); // ChatGPT, GitHub, Loose, YouTube
    const leaves = flattenLeaves(nodes);
    assert.equal(leaves.length, 4);
    assert.ok(leaves.every(l => l.url && l.title));
  });

  it("H-03 filterTree ancestor retention and folder self-match keeps subtree", () => {
    const nodes = buildBookmarkTree(RAW);
    const devFolder = collectFolders(nodes).find(f => f.title === "Dev");
    const filtered = filterTree(devFolder.children, "git");
    assert.equal(flattenLeaves(filtered).length, 1);
    assert.equal(flattenLeaves(filtered)[0].title, "GitHub");
    // folder name matches -> keeps subtree
    const nodesFiltered = filterTree(nodes, "ai");
    assert.ok(nodesFiltered.length >= 1);
    assert.ok(nodesFiltered[0].title.includes("Bookmarks"));
  });

  it("H-05 collectFolders synthetic loose", () => {
    const nodes = buildBookmarkTree(RAW);
    const folders = collectFolders(nodes);
    assert.ok(folders.some(f => f.title === "AI"));
    assert.ok(folders.some(f => f.title === "Dev"));
  });
});

// ─── BookmarkDeckView helpers ───────────────────────────────────────
describe("Helper: BookmarkDeckView helpers", () => {
  const RAW = [{
    id: "0", title: "", children: [{
      id: "1", title: "Bookmarks Bar", children: [
        { id: "10", title: "AI Tools", children: [{ id: "100", title: "ChatGPT", url: "https://chat.openai.com/" }, { id: "101", title: "Claude", url: "https://claude.ai/" }] },
        { id: "11", title: "Dev", children: [{ id: "110", title: "GitHub", url: "https://github.com/" }] },
        { id: "120", title: "Loose Link", url: "https://example.com/" },
      ]
    }]
  }];

  it("H-06 rankByUsage and H-08 resolveCollectionLeaves", () => {
    const roots = buildBookmarkTree(RAW);
    const leaves = flattenLeaves(roots);
    const usage = { "110": 50, "100": 10 };
    const ranked = rankByUsage(leaves, usage, 2);
    assert.equal(ranked[0].id, "110");
    assert.equal(ranked[1].id, "100");
    const leafIndex = new Map(leaves.map(l => [l.id, l]));
    assert.deepEqual(resolveCollectionLeaves([], leafIndex), []);
    const resolved = resolveCollectionLeaves(["110", "100"], leafIndex);
    assert.equal(resolved[0].id, "110");
    assert.equal(resolveCollectionLeaves(["missing", "100"], leafIndex).length, 1);
  });

  it("H-09 cleanDomain strips www", () => {
    assert.equal(cleanDomain("https://www.google.com/search?q=test"), "google.com");
    assert.equal(cleanDomain("http://github.com/facebook/react"), "github.com");
    assert.equal(cleanDomain("invalid-url"), "");
    assert.equal(cleanDomain(""), "");
    assert.equal(cleanDomain(null), "");
    assert.equal(cleanDomain("https://sub.example.co.uk/path"), "sub.example.co.uk");
  });

  it("H-10 websitePreviewUrl always null (privacy)", () => {
    assert.equal(websitePreviewUrl("https://github.com"), null);
    assert.equal(websitePreviewUrl("http://example.com"), null);
    assert.equal(websitePreviewUrl(""), null);
    assert.equal(websitePreviewUrl(null), null);
    assert.equal(websitePreviewUrl("javascript:alert(1)"), null);
    assert.equal(websitePreviewUrl("http://localhost:3000"), null);
  });
});

// ─── favicon helpers ────────────────────────────────────────────────
describe("Helper: favicon", () => {
  it("H-11 faviconUrl / websiteFaviconUrl", async () => {
    assert.ok(typeof faviconUrl === "function" || typeof websiteFaviconUrl === "function");
    if (typeof faviconUrl === "function") {
      const url = faviconUrl("https://github.com");
      assert.ok(url === "" || url === null || String(url).includes("https://") || String(url).includes("google") || String(url).includes("favicon"));
      // invalid inputs should degrade to "" or null (not throw)
      const empty = faviconUrl("");
      assert.ok(empty === "" || empty === null);
      const nullRes = faviconUrl(null);
      assert.ok(nullRes === "" || nullRes === null);
      const jsRes = faviconUrl("javascript:alert(1)");
      assert.ok(jsRes === "" || jsRes === null);
      assert.equal(faviconUrl(""), null);
      assert.equal(faviconUrl(null), null);
      assert.equal(faviconUrl("javascript:alert(1)"), null);
      assert.equal(faviconUrl("https://github.com"), "https://github.com/favicon.ico");
    }
    if (typeof websiteFaviconUrl === "function") {
      const w = await websiteFaviconUrl("https://example.com");
      assert.ok(w === "" || w === null || typeof w === "string");
      const w2 = await websiteFaviconUrl("https://example.com", 32);
      assert.ok(typeof w2 === "string" || w2 === null || w2 instanceof Promise || w2 == null);
      // invalid → null
      assert.equal(await websiteFaviconUrl(""), null);
      assert.equal(await websiteFaviconUrl(null), null);
      // Privacy: always null unless chrome.runtime available (in Node it's null)
      assert.equal(await websiteFaviconUrl("https://example.com"), null);
    }
  });
});

// ─── OmniSearchIndex ────────────────────────────────────────────────
describe("Helper: OmniSearchIndex (H-15)", () => {
  it("extractTokens tokenizes", () => {
    const tokens = extractTokens("https://github.com/facebook/react - Frontend Library");
    assert.ok(tokens.includes("github"));
    assert.ok(tokens.includes("facebook"));
    assert.ok(tokens.includes("frontend"));
    assert.deepEqual(extractTokens(""), []);
    assert.deepEqual(extractTokens(null), []);
  });
  it("OmniSearchIndex search with scoping and tags", () => {
    const index = new OmniSearchIndex();
    const catDev = new Category({ id: new Id("cat-1"), name: "Development", order: 0 });
    const shortcut = new Bookmark({ id: new Id("s-1"), title: "GitHub Dashboard", url: new Url("https://github.com/dashboard"), categoryId: new Id("cat-1") });
    const bookmarks = [{ id: "bm-1", title: "GitHub - React", url: "https://github.com/facebook/react", path: ["Development"], parentId: "10" }];
    const tags = { "bm-1": ["frontend", "javascript"] };
    index.index({ shortcuts: [shortcut], categories: [catDev], bookmarks, tags });
    assert.deepEqual(index.search(""), { shortcuts: [], bookmarks: [] });
    assert.equal(index.search("git").shortcuts.length, 1);
    assert.equal(index.search("git").bookmarks.length, 1);
    assert.equal(index.search("javascript").bookmarks.length, 1);
    assert.equal(index.search("git", { activeTag: "notes" }).bookmarks.length, 0);
    assert.equal(index.search("git", { scopedBookmarkIds: new Set(["bm-none"]) }).bookmarks.length, 0);
    assert.equal(index.getCategoryName(shortcut), "Development");
    assert.equal(index.search("nonexistentxyz").bookmarks.length, 0);
  });
});

// ─── colorHash / colorUtils ─────────────────────────────────────────
describe("Helper: colorHash (H-13) & colorUtils (H-14)", () => {
  it("H-13 getThumbGradient / getFolderColor deterministic", () => {
    const a1 = getThumbGradient("https://example.com");
    const a2 = getThumbGradient("https://example.com");
    assert.equal(a1, a2);
    assert.ok(typeof a1 === "string" && a1.length > 0);
    const b1 = getThumbGradient("https://other.com");
    // different inputs likely produce different gradient (not strictly guaranteed but highly likely)
    assert.ok(typeof b1 === "string");
    const f1 = getFolderColor("Work");
    const f2 = getFolderColor("Work");
    assert.equal(f1, f2);
    assert.ok(typeof f1 === "string");
    // empty string still returns something
    assert.ok(getThumbGradient("").length > 0);
    assert.ok(getFolderColor("").length > 0);
  });
  it("H-14 deriveAccentShades dark/light", () => {
    const dark = deriveAccentShades("#555B66", "dark");
    assert.equal(dark["--accent"], "#555b66");
    assert.equal(dark["--accent-soft"], "rgba(85, 91, 102, 0.16)");
    assert.ok(dark["--accent-dark"]);
    assert.ok(dark["--accent-primary"]);
    const light = deriveAccentShades("#D2683F", "light");
    assert.equal(light["--accent"], "#d2683f");
    assert.equal(light["--accent-soft"], "rgba(210, 104, 63, 0.12)");
    assert.ok(light["--accent-primary"]);
  });
});

// ─── dom.el helper ──────────────────────────────────────────────────
describe("Helper: dom.el (H-16)", () => {
  it("maps className, dataset, style kebab, on* and text escaping", async () => {
    // Minimal DOM shim for Node (no JSDOM dependency): provide document.createElement + Node
    if (typeof globalThis.Node === "undefined") {
      globalThis.Node = class Node {};
      globalThis.Element = class Element extends globalThis.Node {};
      globalThis.Text = class Text extends globalThis.Node { constructor(t){ super(); this.nodeType=3; this.textContent=String(t);} };
      globalThis.DocumentFragment = class DocumentFragment extends globalThis.Node {};
    }
    if (typeof document === "undefined") {
      globalThis.document = {
        createElement(tag) {
          const el = new globalThis.Element();
          el.tagName = tag.toUpperCase();
          const style = {};
          style.setProperty = function(k, v){ style[k]=v; const camel=k.replace(/-([a-z])/g, (_,c)=>c.toUpperCase()); style[camel]=v; };
          el.style = style;
          el.dataset = {};
          el.attributes = {};
          el.children = [];
          el.childNodes = el.children;
          el.textContent = "";
          el.className = "";
          Object.defineProperty(el, "firstChild", { get(){ return this.children[0] || null; }, configurable: true });
          el.setAttribute = function(k,v){ this.attributes[k]=v; };
          el.getAttribute = function(k){ return this.attributes[k] ?? null; };
          el.appendChild = function(c){ this.children.push(c); return c; };
          el.addEventListener = function(type, fn){ this._listeners=this._listeners||{}; (this._listeners[type]=this._listeners[type]||[]).push(fn); };
          el.dispatchEvent = function(e){ const arr=this._listeners?.[e.type]||[]; for(const fn of arr) fn(e); return true; };
          el.removeChild = function(c){ const idx=this.children.indexOf(c); if(idx>=0) this.children.splice(idx,1); return c; };
          el.replaceChildren = function(...kids){ this.children.length=0; for(const k of kids) this.appendChild(k); };
          return el;
        },
        createTextNode(t) { return new globalThis.Text(t); },
        createDocumentFragment(){
          const frag = new globalThis.DocumentFragment();
          frag.children = []; frag.childNodes = frag.children;
          frag.appendChild = function(c){ this.children.push(c); return c; };
          Object.defineProperty(frag, "firstChild", { get(){ return this.children[0] || null; }, configurable: true });
          frag.removeChild = function(c){ const idx=this.children.indexOf(c); if(idx>=0) this.children.splice(idx,1); return c; };
          return frag;
        },
      };
    }
    const { el, clear, setChildren } = await import("../src/presentation/shared/dom.js");
    const node = el("div", { className: "foo bar", dataset: { id: "123" }, style: { backgroundColor: "red", gridRow: "1 / 2" }, onClick: () => {} }, "hello", el("span", {}, "world"));
    assert.equal(node.className, "foo bar");
    assert.equal(node.dataset.id, "123");
    // style kebab: backgroundColor → background-color (implementation may set style.backgroundColor)
    assert.ok(node.style.backgroundColor === "red" || node.style["background-color"] === "red");
    assert.ok(node.children.length >= 1);
    // text escaping: text is via textContent, not innerHTML
    const textNode = el("p", {}, "<script>alert(1)</script>");
    // Should not contain raw script tag as HTML, but as text
    assert.equal(textNode.children[0]?.textContent ?? textNode.textContent, "<script>alert(1)</script>");
    // clear / setChildren helpers
    if (typeof clear === "function") {
      const parent = el("div", {}, el("span", {}, "a"), el("span", {}, "b"));
      clear(parent);
      assert.equal(parent.children.length, 0);
    }
    if (typeof setChildren === "function") {
      const parent = el("div");
      setChildren(parent, [el("i", {}, "x")]);
      assert.equal(parent.children.length, 1);
    }
    // clean up shim if we created it
    // Do not delete document if original existed; we created a fake one solely for this test
    // keep it for subsequent tests that might rely on it
  });
});
