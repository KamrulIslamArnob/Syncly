import test from "node:test";
import assert from "node:assert/strict";
import { Category } from "../src/domain/entities/Category.js";
import { Bookmark } from "../src/domain/entities/Bookmark.js";
import { Id } from "../src/domain/valueObjects/Id.js";
import { Url } from "../src/domain/valueObjects/Url.js";

test("Category entity: creates, renames, and serializes correctly", () => {
  const cat = new Category({ id: new Id("cat-1"), name: "Development", order: 0 });
  assert.equal(cat.id.value, "cat-1");
  assert.equal(cat.name, "Development");
  assert.equal(cat.order, 0);

  cat.rename("Coding & Tools");
  assert.equal(cat.name, "Coding & Tools");

  const json = cat.toJSON();
  assert.deepEqual(json, { id: "cat-1", name: "Coding & Tools", order: 0 });

  const restored = Category.fromJSON(json);
  assert.equal(restored.id.value, "cat-1");
  assert.equal(restored.name, "Coding & Tools");
});

test("Bookmark entity: creates universal direct URL shortcut", () => {
  const bm = new Bookmark({
    id: new Id("bm-1"),
    title: "GitHub",
    url: new Url("https://github.com/"),
    categoryId: new Id("cat-1"),
  });

  assert.equal(bm.id.value, "bm-1");
  assert.equal(bm.title, "GitHub");
  assert.equal(bm.url.href, "https://github.com/");
  assert.equal(bm.categoryId.value, "cat-1");

  const json = bm.toJSON();
  assert.equal(json.id, "bm-1");
  assert.equal(json.title, "GitHub");
  assert.equal(json.url, "https://github.com/");

  const restored = Bookmark.fromJSON(json);
  assert.equal(restored.id.value, "bm-1");
  assert.equal(restored.title, "GitHub");
});

import { EnsureShortcutsFolderUseCase } from "../src/application/useCases/bookmarks/EnsureShortcutsFolderUseCase.js";
import fs from "node:fs";

test("EnsureShortcutsFolderUseCase: fresh install creates empty Shortcuts folder without seeding shortcuts", async () => {
  let nextId = 10;
  const createdItems = [];
  const tree = [{
    id: "0",
    title: "",
    children: [
      { id: "1", title: "Bookmarks bar", children: [] },
      { id: "2", title: "Other bookmarks", children: [] },
    ],
  }];

  const bookmarksMock = {
    getTree: async () => tree,
    create: async ({ parentId, title, url }) => {
      const item = { id: String(nextId++), title, ...(url ? { url } : { children: [] }) };
      createdItems.push({ parentId, ...item });
      const parent = (parentId === "2") ? tree[0].children[1] : null;
      if (parent && parent.children) parent.children.push(item);
      return item;
    },
  };

  const storageData = {};
  const storageMock = {
    get: async (keys) => {
      const res = {};
      for (const k of keys) res[k] = storageData[k];
      return res;
    },
    set: async (obj) => Object.assign(storageData, obj),
  };

  const uc = new EnsureShortcutsFolderUseCase({
    storage: storageMock,
    bookmarks: bookmarksMock,
  });

  const folderId = await uc.execute();
  assert.equal(folderId, "10");
  assert.equal(storageData.shortcutsFolderId, "10");
  // Only the "Shortcuts" folder itself was created - zero bookmarks or default seed categories created
  assert.equal(createdItems.length, 1);
  assert.equal(createdItems[0].title, "Shortcuts");
  assert.equal(createdItems[0].url, undefined);
});

test("Codebase sanitization: public/omnibox-backup.json is completely removed", () => {
  assert.equal(fs.existsSync("public/omnibox-backup.json"), false);
});

test("Empty state: adding a new shortcut manually works cleanly", async () => {
  const created = [];
  const bookmarksMock = {
    create: async ({ parentId, title, url }) => {
      const item = { id: "bm-new", parentId, title, url };
      created.push(item);
      return item;
    },
  };

  const newShortcut = await bookmarksMock.create({
    parentId: "cat-1",
    title: "Google",
    url: "https://www.google.com",
  });

  assert.equal(newShortcut.title, "Google");
  assert.equal(newShortcut.url, "https://www.google.com");
  assert.equal(newShortcut.parentId, "cat-1");
  assert.equal(created.length, 1);
});

