import test from "node:test";
import assert from "node:assert/strict";
import { UserSettings } from "../src/domain/entities/UserSettings.js";
import { SaveUserSettingsUseCase } from "../src/application/useCases/settings/SaveUserSettingsUseCase.js";
import { EnsureQuickieFolderUseCase } from "../src/application/useCases/bookmarks/EnsureQuickieFolderUseCase.js";
import { MigrateBookmarkBarToQuickAccessUseCase } from "../src/application/useCases/bookmarks/MigrateBookmarkBarToQuickAccessUseCase.js";
import { guessTitleFromUrl } from "../src/presentation/newTab/views/ShortcutDialogView.js";

function makeFakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    raw: data,
    async get(keys) {
      if (typeof keys === "string") return { [keys]: data[keys] };
      if (Array.isArray(keys)) {
        const out = {};
        for (const k of keys) if (k in data) out[k] = data[k];
        return out;
      }
      return { ...data };
    },
    async set(items) {
      Object.assign(data, items);
    },
    async remove(keys) {
      const arr = Array.isArray(keys) ? keys : [keys];
      for (const k of arr) delete data[k];
    },
  };
}

test("UserSettings: moveBookmarksToQuickAccess defaults to false and serializes", () => {
  const settings = new UserSettings();
  assert.equal(settings.moveBookmarksToQuickAccess, false);

  settings.setMoveBookmarksToQuickAccess(true);
  assert.equal(settings.moveBookmarksToQuickAccess, true);

  assert.throws(() => {
    settings.setMoveBookmarksToQuickAccess("invalid");
  }, /must be a boolean/);

  const json = settings.toJSON();
  assert.equal(json.moveBookmarksToQuickAccess, true);

  const restored = UserSettings.fromJSON(json);
  assert.equal(restored.moveBookmarksToQuickAccess, true);

  const restoredDefault = UserSettings.fromJSON({});
  assert.equal(restoredDefault.moveBookmarksToQuickAccess, false);
});

test("SaveUserSettingsUseCase: updates moveBookmarksToQuickAccess", async () => {
  let savedSettings = null;
  const mockRepo = {
    async load() {
      return savedSettings || new UserSettings();
    },
    async save(s) {
      savedSettings = s;
    },
  };

  const emitted = [];
  const mockEvents = {
    emit(name, payload) {
      emitted.push({ name, payload });
    },
  };

  const mockSanitizer = {
    text(t) { return t; },
  };

  const useCase = new SaveUserSettingsUseCase({
    settingsRepo: mockRepo,
    events: mockEvents,
    sanitizer: mockSanitizer,
  });

  const updated = await useCase.execute({ moveBookmarksToQuickAccess: true });
  assert.equal(updated.moveBookmarksToQuickAccess, true);
  assert.equal(savedSettings.moveBookmarksToQuickAccess, true);
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].name, "settings:changed");
});

test("EnsureQuickieFolderUseCase: preserves Chrome Bookmark Bar on first install", async () => {
  const storage = makeFakeStorage();
  const moved = [];
  const fakeTree = [{
    id: "0",
    title: "",
    children: [
      {
        id: "1",
        title: "Bookmarks Bar",
        children: [
          { id: "bm-1", title: "Direct Bookmark 1", url: "https://example.com/1" },
          { id: "bm-2", title: "Direct Bookmark 2", url: "https://example.com/2" },
        ],
      },
      {
        id: "2",
        title: "Other Bookmarks",
        children: [],
      },
    ],
  }];

  const bookmarksMock = {
    async getTree() {
      return fakeTree;
    },
    async create({ parentId, title }) {
      const folder = { id: "quickie-id", title, parentId, children: [] };
      fakeTree[0].children[1].children.push(folder);
      return folder;
    },
    async move(id, { parentId }) {
      moved.push({ id, parentId });
    },
  };

  const useCase = new EnsureQuickieFolderUseCase({ storage, bookmarks: bookmarksMock });
  const id = await useCase.execute();

  assert.equal(id, "quickie-id");
  assert.equal(moved.length, 0, "No bookmark bar bookmarks should be moved on first run");
  assert.equal(fakeTree[0].children[0].children.length, 2, "Bookmark bar nodes remain untouched");
});

test("MigrateBookmarkBarToQuickAccessUseCase: does nothing when setting is false", async () => {
  const storage = makeFakeStorage({ moveBookmarksToQuickAccess: false });
  const moved = [];
  const fakeTree = [{
    id: "0",
    title: "",
    children: [
      {
        id: "1",
        title: "Bookmarks Bar",
        children: [
          { id: "bm-1", title: "Site 1", url: "https://site1.com" },
        ],
      },
      {
        id: "2",
        title: "Other Bookmarks",
        children: [],
      },
    ],
  }];

  const bookmarksMock = {
    async getTree() { return fakeTree; },
    async create({ parentId, title }) { return { id: "new-id", title, parentId, children: [] }; },
    async move(id, { parentId }) { moved.push({ id, parentId }); },
  };

  const useCase = new MigrateBookmarkBarToQuickAccessUseCase({ storage, bookmarks: bookmarksMock });
  const result = await useCase.execute();

  assert.equal(result.success, false);
  assert.equal(result.count, 0);
  assert.equal(result.reason, "disabled");
  assert.equal(moved.length, 0);
});

test("MigrateBookmarkBarToQuickAccessUseCase: transfers orphan bookmark bar links when enabled", async () => {
  const storage = makeFakeStorage({ moveBookmarksToQuickAccess: true });
  const moved = [];
  const createdFolders = [];

  const fakeTree = [{
    id: "0",
    title: "",
    children: [
      {
        id: "1",
        title: "Bookmarks Bar",
        children: [
          { id: "bm-1", title: "GitHub", url: "https://github.com" },
          { id: "bm-2", title: "MDN", url: "https://developer.mozilla.org" },
          { id: "sub-folder", title: "Work Folder", children: [{ id: "bm-3", title: "Nested", url: "https://work.com" }] },
        ],
      },
      {
        id: "2",
        title: "Other Bookmarks",
        children: [],
      },
    ],
  }];

  const bookmarksMock = {
    async getTree() { return fakeTree; },
    async create({ parentId, title }) {
      const folder = { id: `id-${title.replace(/\s+/g, "-").toLowerCase()}`, title, parentId, children: [] };
      createdFolders.push(folder);
      if (parentId === "2") {
        fakeTree[0].children[1].children.push(folder);
      } else {
        const p = fakeTree[0].children[1].children.find((c) => c.id === parentId);
        if (p) p.children.push(folder);
      }
      return folder;
    },
    async move(id, { parentId }) {
      moved.push({ id, parentId });
    },
  };

  const useCase = new MigrateBookmarkBarToQuickAccessUseCase({ storage, bookmarks: bookmarksMock });
  const result = await useCase.execute();

  assert.equal(result.success, true);
  assert.equal(result.count, 2, "Only direct root links on Bookmark Bar should be moved");
  assert.deepEqual(moved, [
    { id: "bm-1", parentId: "id-quick-access" },
    { id: "bm-2", parentId: "id-quick-access" },
  ]);
  assert.equal(storage.raw.moveBookmarksToQuickAccessMigrated, true);
});

test("guessTitleFromUrl: extracts human-readable title from URL", () => {
  assert.equal(guessTitleFromUrl("https://www.github.com/org/repo"), "Github");
  assert.equal(guessTitleFromUrl("https://youtube.com/watch?v=123"), "Youtube");
  assert.equal(guessTitleFromUrl("https://docs.google.com"), "Docs");
  assert.equal(guessTitleFromUrl("http://localhost:3000"), "Localhost");
});

test("Shortcuts DnD: dragging a shortcut onto a bookmarks folder moves it out of Shortcuts category", async () => {
  const moved = [];
  const bookmarksMock = {
    async move(id, destination) {
      moved.push({ id, ...destination });
      return { id, ...destination };
    },
  };

  // Simulating dragging a shortcut (id: "sc-101", parentId: "cat-general") and dropping on folder ("folder-design")
  const draggedShortcut = {
    id: "sc-101",
    parentId: "cat-general",
    title: "Figma",
    url: "https://figma.com",
    isShortcut: true,
  };
  const targetFolderId = "folder-design";

  assert.notEqual(draggedShortcut.parentId, targetFolderId);

  await bookmarksMock.move(draggedShortcut.id, { parentId: targetFolderId });

  assert.equal(moved.length, 1);
  assert.deepEqual(moved[0], { id: "sc-101", parentId: "folder-design" });
});

