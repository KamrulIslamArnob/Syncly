import test from "node:test";
import assert from "node:assert/strict";

import { BookmarkCollection } from "../src/domain/entities/BookmarkCollection.js";
import { ChromeBookmarkCollectionRepository } from "../src/infrastructure/repositories/ChromeBookmarkCollectionRepository.js";
import { ListBookmarkCollectionsUseCase } from "../src/application/useCases/collections/ListBookmarkCollectionsUseCase.js";
import { CreateBookmarkCollectionUseCase } from "../src/application/useCases/collections/CreateBookmarkCollectionUseCase.js";
import { UpdateCollectionMembersUseCase } from "../src/application/useCases/collections/UpdateCollectionMembersUseCase.js";
import { DeleteBookmarkCollectionUseCase } from "../src/application/useCases/collections/DeleteBookmarkCollectionUseCase.js";
import { RenameBookmarkCollectionUseCase } from "../src/application/useCases/collections/RenameBookmarkCollectionUseCase.js";
import { EnsureQuickieFolderUseCase } from "../src/application/useCases/bookmarks/EnsureQuickieFolderUseCase.js";
import { BasicSanitizer } from "../src/infrastructure/security/BasicSanitizer.js";
import { EventBus } from "../src/application/ports/EventBus.js";

// Mock storage helper
function createMockStorage(initial = {}) {
  const store = { ...initial };
  return {
    async get(keys) {
      if (typeof keys === "string") return { [keys]: store[keys] };
      if (Array.isArray(keys)) {
        const out = {};
        for (const k of keys) out[k] = store[k];
        return out;
      }
      return { ...store };
    },
    async set(items) {
      Object.assign(store, items);
    },
    raw: store,
  };
}

test("BookmarkCollection entity: validation, members mutation, toJSON & fromJSON", () => {
  const coll = new BookmarkCollection({
    id: "coll-1",
    name: " AI Research ",
    bookmarkIds: ["b1", "b2", "b1"], // should dedupe
  });

  assert.equal(coll.id, "coll-1");
  assert.equal(coll.name, "AI Research"); // trimmed
  assert.deepEqual(coll.bookmarkIds, ["b1", "b2"]);

  // addBookmarkIds
  coll.addBookmarkIds(["b3", "b2"]);
  assert.deepEqual(coll.bookmarkIds, ["b1", "b2", "b3"]);

  // removeBookmarkIds
  coll.removeBookmarkIds(["b2"]);
  assert.deepEqual(coll.bookmarkIds, ["b1", "b3"]);

  // rename
  coll.rename("New Name");
  assert.equal(coll.name, "New Name");

  // toJSON / fromJSON round-trip
  const json = coll.toJSON();
  const restored = BookmarkCollection.fromJSON(json);
  assert.equal(restored.id, "coll-1");
  assert.equal(restored.name, "New Name");
  assert.deepEqual(restored.bookmarkIds, ["b1", "b3"]);
  assert.equal(restored.workspaceId, null);

  // with workspaceId
  const wsColl = new BookmarkCollection({ id: "c-ws", name: "Client Work", workspaceId: "ws-agency" });
  assert.equal(wsColl.workspaceId, "ws-agency");
  const wsRestored = BookmarkCollection.fromJSON(wsColl.toJSON());
  assert.equal(wsRestored.workspaceId, "ws-agency");

  // Invariant error on empty name
  assert.throws(() => new BookmarkCollection({ id: "c", name: "   " }), /non-empty string/);
  // Invariant error on overly long name
  assert.throws(() => new BookmarkCollection({ id: "c", name: "a".repeat(51) }), /50 characters/);
});

test("ChromeBookmarkCollectionRepository & use cases round-trip", async () => {
  const storage = createMockStorage();
  const repo = new ChromeBookmarkCollectionRepository({ storage });
  const events = new EventBus();
  const sanitizer = new BasicSanitizer();
  const ids = { generate: () => "gen-uuid-1" };

  const listUC = new ListBookmarkCollectionsUseCase(repo);
  const createUC = new CreateBookmarkCollectionUseCase({ repository: repo, ids, sanitizer, events });
  const updateMembersUC = new UpdateCollectionMembersUseCase({ repository: repo, events });
  const renameUC = new RenameBookmarkCollectionUseCase({ repository: repo, sanitizer, events });
  const deleteUC = new DeleteBookmarkCollectionUseCase({ repository: repo, events });

  // Initial list is empty
  assert.deepEqual(await listUC.execute(), []);

  // Create collection
  let emitted = [];
  events.on("bookmarkCollections:changed", (payload) => emitted.push(payload));

  const created = await createUC.execute({ name: "Dev Tools", bookmarkIds: ["100", "101"], workspaceId: "ws-1" });
  assert.equal(created.id, "gen-uuid-1");
  assert.equal(created.name, "Dev Tools");
  assert.deepEqual(created.bookmarkIds, ["100", "101"]);
  assert.equal(created.workspaceId, "ws-1");
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].action, "create");

  // Find all
  const all = await listUC.execute();
  assert.equal(all.length, 1);
  assert.equal(all[0].name, "Dev Tools");

  // Update members (add & remove)
  await updateMembersUC.execute({ collectionId: "gen-uuid-1", add: ["102"], remove: ["100"] });
  const updated = await repo.findById("gen-uuid-1");
  assert.deepEqual(updated.bookmarkIds, ["101", "102"]);

  // Rename
  await renameUC.execute({ collectionId: "gen-uuid-1", name: "Core Dev" });
  assert.equal((await repo.findById("gen-uuid-1")).name, "Core Dev");

  // Delete
  await deleteUC.execute({ collectionId: "gen-uuid-1" });
  assert.equal(await repo.findById("gen-uuid-1"), null);
  assert.deepEqual(await listUC.execute(), []);
});

test("EnsureQuickieFolderUseCase: creates Quickie folder, migrates loose bookmarks idempotently", async () => {
  const storage = createMockStorage();

  const moved = [];
  let createdFolders = [];
  const fakeTree = [{
    id: "0",
    children: [
      { id: "1", title: "Bookmarks Bar", children: [] },
      {
        id: "2",
        title: "Other Bookmarks",
        children: [
          { id: "loose-1", title: "Loose Bookmark 1", url: "https://loose1.com" },
          { id: "loose-2", title: "Loose Bookmark 2", url: "https://loose2.com" },
          { id: "subfolder-1", title: "Existing Folder", children: [] },
        ],
      },
    ],
  }];

  const bookmarksMock = {
    async getTree() {
      return fakeTree;
    },
    async create({ parentId, title }) {
      const folder = { id: "quickie-id-99", title, parentId, children: [] };
      createdFolders.push(folder);
      // Simulate adding to other bookmarks in tree
      fakeTree[0].children[1].children.push(folder);
      return folder;
    },
    async move(id, { parentId }) {
      moved.push({ id, parentId });
    },
  };

  const useCase = new EnsureQuickieFolderUseCase({ storage, bookmarks: bookmarksMock });

  // 1st run: creates folder and leaves loose bookmarks untouched
  const id1 = await useCase.execute();
  assert.equal(id1, "quickie-id-99");
  assert.equal(createdFolders.length, 1);
  assert.equal(moved.length, 0, "loose bookmarks should NOT be relocated on first install");
  assert.equal(storage.raw.quickieFolderId, "quickie-id-99");

  // 2nd run: does NOT re-create (idempotent)
  moved.length = 0;
  createdFolders.length = 0;
  const id2 = await useCase.execute();
  assert.equal(id2, "quickie-id-99");
  assert.equal(createdFolders.length, 0);
  assert.equal(moved.length, 0);
});

test("Add to Collection: adds both bookmark IDs and shortcut IDs to target collection", async () => {
  const storage = createMockStorage();
  const repo = new ChromeBookmarkCollectionRepository({ storage });
  const events = new EventBus();
  const ids = { generate: () => "coll-curated" };
  const sanitizer = new BasicSanitizer();

  const createUC = new CreateBookmarkCollectionUseCase({ repository: repo, ids, sanitizer, events });
  const updateMembersUC = new UpdateCollectionMembersUseCase({ repository: repo, events });

  const coll = await createUC.execute({ name: "Reading List" });
  assert.deepEqual(coll.bookmarkIds, []);

  // Add bookmark ID from right-click context menu
  await updateMembersUC.execute({ collectionId: "coll-curated", add: ["bm-card-1"] });
  let saved = await repo.findById("coll-curated");
  assert.deepEqual(saved.bookmarkIds, ["bm-card-1"]);

  // Add shortcut ID from right-click shortcut context menu
  await updateMembersUC.execute({ collectionId: "coll-curated", add: ["sc-tile-2"] });
  saved = await repo.findById("coll-curated");
  assert.deepEqual(saved.bookmarkIds, ["bm-card-1", "sc-tile-2"]);
});

test("EnsureCollectionsFolderUseCase: creates and idempotently manages native Collections folder under Other Bookmarks", async () => {
  const { EnsureCollectionsFolderUseCase } = await import("../src/application/useCases/bookmarks/EnsureCollectionsFolderUseCase.js");
  const storage = createMockStorage();
  const createdFolders = [];
  const fakeTree = [
    {
      id: "0",
      title: "",
      children: [
        { id: "1", title: "Bookmarks Bar", children: [] },
        { id: "2", title: "Other Bookmarks", children: [] },
      ],
    },
  ];

  const bookmarksMock = {
    async getTree() {
      return JSON.parse(JSON.stringify(fakeTree));
    },
    async create({ parentId, title }) {
      const folder = { id: "collections-id-88", title, parentId, children: [] };
      createdFolders.push(folder);
      fakeTree[0].children[1].children.push(folder);
      return folder;
    },
  };

  const useCase = new EnsureCollectionsFolderUseCase({ storage, bookmarks: bookmarksMock });

  // 1st run: creates native folder under Other Bookmarks (id 2)
  const id1 = await useCase.execute();
  assert.equal(id1, "collections-id-88");
  assert.equal(createdFolders.length, 1);
  assert.equal(createdFolders[0].parentId, "2");
  assert.equal(createdFolders[0].title, "Collections");
  assert.equal(storage.raw.collectionsFolderId, "collections-id-88");

  // 2nd run: does not recreate (idempotent)
  createdFolders.length = 0;
  const id2 = await useCase.execute();
  assert.equal(id2, "collections-id-88");
  assert.equal(createdFolders.length, 0);
});

test("Create, Rename, Delete & Member Sync with native Chrome bookmark folders", async () => {
  const storage = createMockStorage();
  const repo = new ChromeBookmarkCollectionRepository({ storage });
  const events = new EventBus();
  const sanitizer = new BasicSanitizer();
  const createdNodes = [];
  const updatedNodes = [];
  const removedTrees = [];
  const removedNodes = [];

  const fakeTree = [
    {
      id: "0",
      title: "",
      children: [
        { id: "1", title: "Bookmarks Bar", children: [] },
        {
          id: "2",
          title: "Other Bookmarks",
          children: [
            {
              id: "coll-root-1",
              title: "Collections",
              children: [],
            },
          ],
        },
      ],
    },
  ];

  const bookmarksMock = {
    async getTree() {
      return JSON.parse(JSON.stringify(fakeTree));
    },
    async getSubTree(id) {
      return [{ id, children: createdNodes.filter((n) => n.parentId === id) }];
    },
    async get(id) {
      const node = createdNodes.find((n) => n.id === id) || { id, title: "Bookmark", url: "https://example.com" };
      return [node];
    },
    async create({ parentId, title, url }) {
      const node = { id: `node-${Date.now()}-${Math.random()}`, parentId, title, url, children: url ? undefined : [] };
      createdNodes.push(node);
      return node;
    },
    async update(id, { title }) {
      updatedNodes.push({ id, title });
      return { id, title };
    },
    async remove(id) {
      removedNodes.push(id);
    },
    async removeTree(id) {
      removedTrees.push(id);
    },
  };

  const ensureCollectionsFolder = {
    execute: async () => "coll-root-1",
  };

  const createUC = new CreateBookmarkCollectionUseCase({
    repository: repo,
    sanitizer,
    events,
    bookmarks: bookmarksMock,
    ensureCollectionsFolder,
  });

  const renameUC = new RenameBookmarkCollectionUseCase({
    repository: repo,
    sanitizer,
    events,
    bookmarks: bookmarksMock,
  });

  const deleteUC = new DeleteBookmarkCollectionUseCase({
    repository: repo,
    events,
    bookmarks: bookmarksMock,
  });

  const updateMembersUC = new UpdateCollectionMembersUseCase({
    repository: repo,
    events,
    bookmarks: bookmarksMock,
  });

  // 1. Create collection with native folder
  const coll = await createUC.execute({ name: "Design Inspo", bookmarkUrls: ["https://dribbble.com"] });
  assert.equal(coll.name, "Design Inspo");
  assert.ok(createdNodes.some((n) => n.title === "Design Inspo" && n.parentId === "coll-root-1"));
  assert.ok(createdNodes.some((n) => n.url === "https://dribbble.com"));

  // 2. Add member
  await updateMembersUC.execute({ collectionId: coll.id, urls: ["https://behance.net"] });
  assert.ok(createdNodes.some((n) => n.url === "https://behance.net"));

  // 3. Rename collection
  await renameUC.execute({ collectionId: coll.id, name: "Design Vault" });
  assert.ok(updatedNodes.some((n) => n.title === "Design Vault"));

  // 4. Delete collection
  await deleteUC.execute({ collectionId: coll.id });
  assert.ok(removedTrees.includes(coll.folderId));
  assert.equal(await repo.findById(coll.id), null);
});

