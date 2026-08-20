import test from "node:test";
import assert from "node:assert/strict";
import {
  isSafeUrl,
  buildBookmarkTree,
  filterTree,
  countLeaves,
  DEFAULT_TREE_STYLE,
  TREE_STYLES,
  isValidTreeStyle,
  normalizeTreeStyle,
  cycleTreeStyle,
  readTreeStyle,
} from "../src/presentation/newTab/views/TreeView.js";
import {
  flattenLeaves,
  collectFolders,
  rankByUsage,
} from "../src/presentation/newTab/views/BookmarkDeckView.js";

/* ── isSafeUrl (security gate) ─────────────────────────────── */
test("isSafeUrl: accepts http and https", () => {
  assert.equal(isSafeUrl("https://example.com"), "https://example.com/");
  assert.equal(isSafeUrl("http://a.b/c?x=1"), "http://a.b/c?x=1");
});

test("isSafeUrl: returns null for relative strings (not auto-prefixed)", () => {
  for (const rel of ["foo", "example.com", "/path", "mailto:a@b.com", "tel:123"]) {
    assert.equal(isSafeUrl(rel), null, `expected null for ${JSON.stringify(rel)}`);
  }
});

test("isSafeUrl: returns the valid http(s) URL unchanged", () => {
  assert.equal(isSafeUrl("https://x.com/a?b=1"), "https://x.com/a?b=1");
});

test("isSafeUrl: rejects dangerous schemes", () => {
  for (const bad of [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "ftp://host/x",
    "",
    null,
    undefined,
    42,
  ]) {
    assert.equal(isSafeUrl(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

/* ── buildBookmarkTree (the live tree builder) ────────────── */
const CHROME_TREE = [
  {
    id: "0",
    title: "",
    children: [
      {
        id: "1",
        title: "Bookmarks Bar",
        children: [
          { id: "11", title: "Gmail", url: "https://mail.google.com" },
          {
            id: "12",
            title: "Work",
            children: [{ id: "121", title: "Figma", url: "https://figma.com" }],
          },
        ],
      },
      {
        id: "2",
        title: "Other Bookmarks",
        children: [{ id: "21", title: "YouTube", url: "https://youtube.com" }],
      },
    ],
  },
];

test("buildBookmarkTree: unwraps synthetic root and types nodes", () => {
  const nodes = buildBookmarkTree(CHROME_TREE);
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].title, "Bookmarks Bar");
  assert.equal(nodes[0].type, "folder");
  assert.equal(nodes[0].count, 2); // Gmail + Figma
  const gmail = nodes[0].children[0];
  assert.equal(gmail.type, "bookmark");
  assert.equal(gmail.url, "https://mail.google.com/");
});

test("buildBookmarkTree: counts nested bookmarks via `count`", () => {
  const nodes = buildBookmarkTree(CHROME_TREE);
  const other = nodes[1];
  assert.equal(other.title, "Other Bookmarks");
  assert.equal(other.count, 1);
});

test("buildBookmarkTree: sanitizes unsafe bookmark URLs to null", () => {
  const tree = [
    {
      id: "0",
      title: "",
      children: [
        {
          id: "1",
          title: "Trap",
          children: [
            { id: "x", title: "Evil", url: "javascript:alert(document.cookie)" },
            { id: "y", title: "Data", url: "data:text/html,<b>x</b>" },
            { id: "z", title: "Ok", url: "https://safe.example" },
          ],
        },
      ],
    },
  ];
  const nodes = buildBookmarkTree(tree);
  const trap = nodes[0];
  assert.equal(trap.children[0].url, null);
  assert.equal(trap.children[1].url, null);
  assert.equal(trap.children[2].url, "https://safe.example/");
});

test("buildBookmarkTree: prunes empty folders and tolerates missing fields", () => {
  const nodes = buildBookmarkTree([
    { id: "1", children: [{ id: "a", title: "ok", url: "https://a.example" }] },
    { id: "2", children: [] }, // empty folder -> pruned
    null,
    { id: "3", url: "https://b.example" },
  ]);
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].title, "Folder"); // default when title missing
  assert.equal(nodes[0].type, "folder");
  assert.equal(nodes[1].type, "bookmark");
});

test("buildBookmarkTree: tolerates a non-array root", () => {
  assert.deepEqual(buildBookmarkTree(null), []);
  assert.deepEqual(buildBookmarkTree({ id: "x", url: "https://a" }), []);
});

/* ── filterTree ───────────────────────────────────────────── */
test("filterTree: empty query returns the same tree (no-op filter)", () => {
  const nodes = buildBookmarkTree(CHROME_TREE);
  const filtered = filterTree(nodes, "");
  assert.equal(filtered.length, 2);
  assert.equal(filtered, nodes); // empty query is a no-op, same reference
});

test("filterTree: keeps matching bookmarks and their ancestor folders", () => {
  const nodes = buildBookmarkTree(CHROME_TREE);
  const filtered = filterTree(nodes, "figma");
  // Only "Work" folder (ancestor) + its Figma leaf should survive.
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].title, "Bookmarks Bar");
  assert.equal(filtered[0].children.length, 1);
  assert.equal(filtered[0].children[0].title, "Work");
  assert.equal(filtered[0].children[0].children[0].title, "Figma");
});

test("filterTree: matches on URL text", () => {
  const nodes = buildBookmarkTree(CHROME_TREE);
  const filtered = filterTree(nodes, "youtube.com");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].title, "Other Bookmarks");
});

test("filterTree: a folder matches itself and keeps its whole subtree", () => {
  const nodes = buildBookmarkTree(CHROME_TREE);
  const filtered = filterTree(nodes, "work");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].title, "Bookmarks Bar");
  assert.equal(filtered[0].children[0].title, "Work");
  // A folder matched by name keeps its entire subtree (Figma is retained).
  assert.equal(filtered[0].children[0].children.length, 1);
  assert.equal(filtered[0].children[0].children[0].title, "Figma");
});

test("filterTree: no matches returns empty array", () => {
  const nodes = buildBookmarkTree(CHROME_TREE);
  assert.deepEqual(filterTree(nodes, "zzz-nope"), []);
});

test("countLeaves: counts bookmark leaves through nested folders", () => {
  const nodes = buildBookmarkTree(CHROME_TREE);
  assert.equal(countLeaves(nodes), 3); // Gmail, Figma, YouTube
});

/* ── Deck helpers (the live full-screen tree view) ────────── */
test("flattenLeaves: collects every bookmark leaf, skips folders", () => {
  const nodes = buildBookmarkTree(CHROME_TREE);
  const leaves = flattenLeaves(nodes);
  assert.equal(leaves.length, 3);
  assert.deepEqual(leaves.map((l) => l.title).sort(), ["Figma", "Gmail", "YouTube"]);
});

test("collectFolders: yields the top folders plus a loose block for root-level bookmarks", () => {
  const nodes = buildBookmarkTree([
    { id: "0", title: "", children: [
      { id: "1", title: "Bar", children: [
        { id: "11", title: "A", url: "https://a.example" },
        { id: "12", title: "Sub", children: [{ id: "121", title: "B", url: "https://b.example" }] },
      ] },
      { id: "2", title: "Loose", url: "https://loose.example" }, // directly under root
    ] },
  ]);
  const folders = collectFolders(nodes);
  // Bar (with children) + a synthetic loose block from the root-level link.
  assert.equal(folders.length, 2);
  const loose = folders.find((f) => f.id.startsWith("loose:"));
  assert.ok(loose, "expected a synthetic loose-folder block");
  assert.equal(loose.children.length, 1);
});

test("rankByUsage: sorts by open-count desc and caps length", () => {
  const pool = [
    { id: "1", title: "A", url: "https://a" },
    { id: "2", title: "B", url: "https://b" },
    { id: "3", title: "C", url: "https://c" },
  ];
  const usage = { "1": 5, "3": 9, "2": 1 };
  const ranked = rankByUsage(pool, usage, 2);
  assert.deepEqual(ranked.map((r) => r.id), ["3", "1"]);
  assert.equal(ranked.length, 2);
});

/* ── Tree style (Organic "real tree" vs Editor "code tree") ─────── */
test("tree style: DEFAULT_TREE_STYLE is organic and only two styles exist", () => {
  assert.equal(DEFAULT_TREE_STYLE, "organic");
  assert.deepEqual(TREE_STYLES, ["organic", "editor"]);
});

test("tree style: isValidTreeStyle accepts only the two known styles", () => {
  assert.equal(isValidTreeStyle("organic"), true);
  assert.equal(isValidTreeStyle("editor"), true);
  for (const bad of ["ORGANIC", "Organic", "code", "real", "", null, undefined, 1, {}]) {
    assert.equal(isValidTreeStyle(bad), false, `expected false for ${JSON.stringify(bad)}`);
  }
});

test("tree style: normalizeTreeStyle coerces unknown input to organic", () => {
  assert.equal(normalizeTreeStyle("editor"), "editor");
  assert.equal(normalizeTreeStyle("organic"), "organic");
  for (const bad of ["", "nope", null, undefined, 7, true]) {
    assert.equal(normalizeTreeStyle(bad), "organic", `expected default for ${JSON.stringify(bad)}`);
  }
});

test("tree style: cycleTreeStyle flips between the two styles", () => {
  assert.equal(cycleTreeStyle("organic"), "editor");
  assert.equal(cycleTreeStyle("editor"), "organic");
  // Unknown input normalizes first, so it still cycles deterministically.
  assert.equal(cycleTreeStyle("bogus"), "editor");
});

test("tree style: readTreeStyle reads persisted value, falls back to organic", () => {
  const store = {
    _m: { "ntab:treeStyle": "editor" },
    getItem(k) { return this._m[k] ?? null; },
  };
  assert.equal(readTreeStyle(store), "editor");
  const empty = { getItem() { return null; } };
  assert.equal(readTreeStyle(empty), "organic");
  // Corrupt value falls back to default rather than throwing.
  const corrupt = { getItem() { return "paper"; } };
  assert.equal(readTreeStyle(corrupt), "organic");
  // Missing/invalid store never throws.
  assert.equal(readTreeStyle(null), "organic");
  assert.equal(readTreeStyle(undefined), "organic");
  const thrower = { getItem() { throw new Error("blocked"); } };
  assert.equal(readTreeStyle(thrower), "organic");
});

/* ── flattenFoldersForPicker (parent-folder select, empty folders kept) ── */
import { flattenFoldersForPicker } from "../src/presentation/newTab/views/TreeView.js";

const PICKER_TREE = [
  {
    id: "0",
    title: "",
    children: [
      {
        id: "1",
        title: "Bookmarks Bar",
        children: [
          {
            id: "10",
            title: "Marketing",
            children: [
              { id: "11", title: "Empty Sub", children: [] },
              { id: "12", title: "Leaf", url: "https://example.com" },
            ],
          },
          { id: "13", title: "Also Empty", children: [] },
        ],
      },
      { id: "2", title: "Other Bookmarks", children: [] },
      { id: "3", title: "Mobile Bookmarks", children: [] },
    ],
  },
];

test("flattenFoldersForPicker: unwraps synthetic root, one group per named root", () => {
  const groups = flattenFoldersForPicker(PICKER_TREE);
  assert.equal(groups.length, 3);
  assert.deepEqual(
    groups.map((g) => g.rootId),
    ["1", "2", "3"]
  );
  assert.deepEqual(
    groups.map((g) => g.rootTitle),
    ["Bookmarks Bar", "Other Bookmarks", "Mobile Bookmarks"]
  );
});

test("flattenFoldersForPicker: includes empty folders (unlike buildBookmarkTree)", () => {
  const groups = flattenFoldersForPicker(PICKER_TREE);
  const barOptions = groups[0].options;
  assert.deepEqual(
    barOptions.map((o) => o.id),
    ["10", "11", "13"]
  );
});

test("flattenFoldersForPicker: depth increases per nesting level, bookmarks excluded", () => {
  const groups = flattenFoldersForPicker(PICKER_TREE);
  const barOptions = groups[0].options;
  const marketing = barOptions.find((o) => o.id === "10");
  const emptySub = barOptions.find((o) => o.id === "11");
  const alsoEmpty = barOptions.find((o) => o.id === "13");
  assert.equal(marketing.depth, 1);
  assert.equal(emptySub.depth, 2);
  assert.equal(alsoEmpty.depth, 1);
  assert.equal(barOptions.some((o) => o.id === "12"), false); // "Leaf" is a bookmark, not a folder
});

test("flattenFoldersForPicker: empty/garbage input returns []", () => {
  assert.deepEqual(flattenFoldersForPicker([]), []);
  assert.deepEqual(flattenFoldersForPicker(null), []);
  assert.deepEqual(flattenFoldersForPicker(undefined), []);
});
