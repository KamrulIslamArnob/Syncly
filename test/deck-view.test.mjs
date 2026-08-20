import test from "node:test";
import assert from "node:assert/strict";
import {
  flattenLeaves,
  collectFolders,
  rankByUsage,
  resolveCollectionLeaves,
  cleanDomain,
} from "../src/presentation/newTab/views/BookmarkDeckView.js";
import { buildBookmarkTree, filterTree, countLeaves } from "../src/presentation/newTab/views/TreeView.js";

// Chrome-shaped getTree() output: root 0 -> "Bookmarks Bar" -> folders + loose bm
const RAW = [{
  id: "0", title: "", children: [{
    id: "1", title: "Bookmarks Bar", children: [
      { id: "10", title: "AI Tools", children: [
        { id: "100", title: "ChatGPT", url: "https://chat.openai.com/" },
        { id: "101", title: "Claude", url: "https://claude.ai/" },
      ]},
      { id: "11", title: "Dev", children: [
        { id: "110", title: "GitHub", url: "https://github.com/" },
        { id: "111", title: "MDN", url: "https://developer.mozilla.org/" },
        { id: "112", title: "npm", url: "https://npmjs.com/" },
      ]},
      { id: "120", title: "Loose Link", url: "https://example.com/" },
    ],
  }],
}];

test("flattenLeaves collects every bookmark leaf, skips folders", () => {
  const roots = buildBookmarkTree(RAW);
  const leaves = flattenLeaves(roots);
  assert.equal(leaves.length, 6);
  assert.ok(leaves.every((b) => b.url && b.title));
});

test("collectFolders yields the top folders (children preserved) plus a loose block", () => {
  const roots = buildBookmarkTree(RAW);
  const folders = collectFolders(roots);
  const names = folders.map((f) => f.title);
  assert.ok(names.includes("AI Tools"));
  assert.ok(names.includes("Dev"));
  // loose bookmark directly under the root becomes its own block
  assert.ok(names.includes("Bookmarks Bar"));
  // nested children retained (not flattened), so counts stay legit
  const dev = folders.find((f) => f.title === "Dev");
  assert.equal(countLeaves(dev.children), 3);
});

test("rankByUsage sorts by open-count desc and caps length", () => {
  const roots = buildBookmarkTree(RAW);
  const leaves = flattenLeaves(roots);
  const usage = { "111": 50, "100": 10, "110": 5 };
  const ranked = rankByUsage(leaves, usage, 8);
  assert.equal(ranked[0].id, "111"); // MDN, highest count
  assert.equal(ranked[1].id, "100"); // ChatGPT
  assert.equal(ranked[2].id, "110"); // GitHub
  const top2 = rankByUsage(leaves, usage, 2);
  assert.equal(top2.length, 2);
});

test("filterTree keeps only matching leaves in a folder, empty when none", () => {
  const roots = buildBookmarkTree(RAW);
  const dev = collectFolders(roots).find((f) => f.title === "Dev");
  const hit = filterTree(dev.children, "git");
  assert.equal(flattenLeaves(hit).length, 1);
  assert.equal(flattenLeaves(hit)[0].title, "GitHub");
  assert.equal(filterTree(dev.children, "zzz").length, 0);
});

test("resolveCollectionLeaves: resolves members, preserves order, filters stale ids", () => {
  const roots = buildBookmarkTree(RAW);
  const leaves = flattenLeaves(roots);
  const leafIndex = new Map(leaves.map((l) => [l.id, l]));

  // Empty bundle
  assert.deepEqual(resolveCollectionLeaves([], leafIndex), []);

  // Normal bundle with order preserved
  const resolved = resolveCollectionLeaves(["111", "100", "112"], leafIndex);
  assert.equal(resolved.length, 3);
  assert.equal(resolved[0].title, "MDN");
  assert.equal(resolved[1].title, "ChatGPT");
  assert.equal(resolved[2].title, "npm");

  // Stale id (bookmark deleted in Chrome) is filtered out
  const staleResolved = resolveCollectionLeaves(["111", "deleted-999", "100"], leafIndex);
  assert.equal(staleResolved.length, 2);
  assert.equal(staleResolved[0].id, "111");
  assert.equal(staleResolved[1].id, "100");
});

/* ── websitePreviewUrl (website screenshot preview generation) ─── */
import { websitePreviewUrl } from "../src/presentation/shared/favicon.js";

test("websitePreviewUrl: returns null for public URLs (privacy - external mShots disabled)", () => {
  // Privacy-hardened: external preview service removed to prevent URL leakage
  // Previously returned mShots URL, now returns null and shows gradient fallback
  const preview = websitePreviewUrl("https://github.com");
  assert.equal(preview, null);

  const previewHttp = websitePreviewUrl("http://example.com/test");
  assert.equal(previewHttp, null);
});

test("websitePreviewUrl: returns null for invalid, non-http, or private URLs", () => {
  assert.equal(websitePreviewUrl(""), null);
  assert.equal(websitePreviewUrl(null), null);
  assert.equal(websitePreviewUrl("javascript:alert(1)"), null);
  assert.equal(websitePreviewUrl("chrome://extensions"), null);
  assert.equal(websitePreviewUrl("file:///etc/passwd"), null);
  assert.equal(websitePreviewUrl("http://localhost:3000"), null);
  assert.equal(websitePreviewUrl("http://127.0.0.1:8080"), null);
  assert.equal(websitePreviewUrl("http://192.168.1.1/router"), null);
});

/* ── UserSettings showWebsitePreviews preference ──────────────── */
import { UserSettings } from "../src/domain/entities/UserSettings.js";

test("UserSettings: showWebsitePreviews defaults to true and round-trips correctly", () => {
  const sDefault = new UserSettings({});
  assert.equal(sDefault.showWebsitePreviews, true);

  sDefault.setShowWebsitePreviews(false);
  assert.equal(sDefault.showWebsitePreviews, false);

  const json = sDefault.toJSON();
  assert.equal(json.showWebsitePreviews, false);

  const restored = UserSettings.fromJSON(json);
  assert.equal(restored.showWebsitePreviews, false);
});

test("cleanDomain: extracts clean domain without www", () => {
  assert.equal(cleanDomain("https://www.google.com/search?q=test"), "google.com");
  assert.equal(cleanDomain("http://github.com/facebook/react"), "github.com");
  assert.equal(cleanDomain("invalid-url"), "");
  assert.equal(cleanDomain(""), "");
  assert.equal(cleanDomain(null), "");
});

