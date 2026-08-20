import test from "node:test";
import assert from "node:assert/strict";
import { OmniSearchIndex, extractTokens } from "../src/domain/services/OmniSearchIndex.js";
import { Bookmark } from "../src/domain/entities/Bookmark.js";
import { Category } from "../src/domain/entities/Category.js";
import { Id } from "../src/domain/valueObjects/Id.js";
import { Url } from "../src/domain/valueObjects/Url.js";

test("extractTokens splits text into search tokens", () => {
  const tokens = extractTokens("https://github.com/facebook/react - Frontend Library");
  assert.ok(tokens.includes("github"));
  assert.ok(tokens.includes("facebook"));
  assert.ok(tokens.includes("react"));
  assert.ok(tokens.includes("frontend"));
  assert.ok(tokens.includes("library"));
  assert.deepEqual(extractTokens(""), []);
  assert.deepEqual(extractTokens(null), []);
});

test("OmniSearchIndex: matches shortcuts and bookmarks with O(1) lookups", () => {
  const index = new OmniSearchIndex();

  const catDev = new Category({ id: new Id("cat-1"), name: "Development", order: 0 });
  const catMarketing = new Category({ id: new Id("cat-2"), name: "Marketing", order: 1 });

  const shortcutGithub = new Bookmark({
    id: new Id("s-1"),
    title: "GitHub Dashboard",
    url: new Url("https://github.com/dashboard"),
    categoryId: new Id("cat-1"),
  });

  const shortcutAds = new Bookmark({
    id: new Id("s-2"),
    title: "Facebook Ads Manager",
    url: new Url("https://adsmanager.facebook.com/"),
    categoryId: new Id("cat-2"),
  });

  const bookmarks = [
    {
      id: "bm-1",
      title: "GitHub - React Repository",
      url: "https://github.com/facebook/react",
      path: ["Development", "Libraries"],
      parentId: "10",
    },
    {
      id: "bm-2",
      title: "Notion Workspace",
      url: "https://notion.so/myworkspace",
      path: ["Productivity"],
      parentId: "11",
    },
  ];

  const tags = {
    "bm-1": ["frontend", "javascript"],
    "bm-2": ["notes"],
  };

  index.index({
    shortcuts: [shortcutGithub, shortcutAds],
    categories: [catDev, catMarketing],
    bookmarks,
    tags,
  });

  // 1. Empty/null queries
  assert.deepEqual(index.search(""), { shortcuts: [], bookmarks: [] });
  assert.deepEqual(index.search(null), { shortcuts: [], bookmarks: [] });

  // 2. Search by shortcut title prefix
  const resGit = index.search("git");
  assert.equal(resGit.shortcuts.length, 1);
  assert.equal(resGit.shortcuts[0].id.value, "s-1");
  assert.equal(resGit.bookmarks.length, 1);
  assert.equal(resGit.bookmarks[0].id, "bm-1");

  // 3. Search by category name
  const resMarket = index.search("marketing");
  assert.equal(resMarket.shortcuts.length, 1);
  assert.equal(resMarket.shortcuts[0].id.value, "s-2");

  // 4. Search by tag
  const resTag = index.search("javascript");
  assert.equal(resTag.shortcuts.length, 0);
  assert.equal(resTag.bookmarks.length, 1);
  assert.equal(resTag.bookmarks[0].id, "bm-1");

  // 5. Search with activeTag filter
  const resFilteredTag = index.search("git", { activeTag: "javascript" });
  assert.equal(resFilteredTag.bookmarks.length, 1);
  const resNoMatchTag = index.search("git", { activeTag: "notes" });
  assert.equal(resNoMatchTag.bookmarks.length, 0);

  // 6. Search with scoped bookmark IDs (e.g. inside specific folder)
  const resScoped = index.search("git", { scopedBookmarkIds: new Set(["bm-2"]) });
  assert.equal(resScoped.shortcuts.length, 1);
  assert.equal(resScoped.bookmarks.length, 0);

  // 7. Search by folder path
  const resPath = index.search("libraries");
  assert.equal(resPath.bookmarks.length, 1);
  assert.equal(resPath.bookmarks[0].id, "bm-1");

  // 8. Multi-token search
  const resMulti = index.search("github react");
  assert.equal(resMulti.shortcuts.length, 0);
  assert.equal(resMulti.bookmarks.length, 1);
  assert.equal(resMulti.bookmarks[0].id, "bm-1");

  // 9. Non-matching query
  const resNone = index.search("nonexistentxyz");
  assert.equal(resNone.shortcuts.length, 0);
  assert.equal(resNone.bookmarks.length, 0);

  // 10. Category name helper
  assert.equal(index.getCategoryName(shortcutGithub), "Development");
  assert.equal(index.getCategoryName(shortcutAds), "Marketing");
});
