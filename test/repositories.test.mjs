import test, { describe, it } from "node:test";
import assert from "node:assert/strict";

import { BaseChromeListRepository } from "../src/infrastructure/persistence/chromeStorage/BaseChromeListRepository.js";
import { ChromeBookmarkCollectionRepository } from "../src/infrastructure/repositories/ChromeBookmarkCollectionRepository.js";
import { ChromeBookmarkTagRepository } from "../src/infrastructure/repositories/ChromeBookmarkTagRepository.js";
import { ChromeBookmarkGroupRepository } from "../src/infrastructure/repositories/ChromeBookmarkGroupRepository.js";
import { Bookmark } from "../src/domain/entities/Bookmark.js";
import { Category } from "../src/domain/entities/Category.js";
import { Task } from "../src/domain/entities/Task.js";
import { WidgetLayout } from "../src/domain/entities/WidgetLayout.js";
import { BookmarkCollection } from "../src/domain/entities/BookmarkCollection.js";
import { Id } from "../src/domain/valueObjects/Id.js";
import { Url } from "../src/domain/valueObjects/Url.js";

// ─── Memory stubs ──────────────────────────────────────────────────
function createStub(initial = {}) {
  const store = { ...initial };
  let getCalls = 0;
  return {
    getAll: async (key) => {
      getCalls++;
      return store[key] ?? [];
    },
    set: async (key, value) => {
      store[key] = value;
    },
    onChanged: () => {},
    raw: store,
    getCalls: () => getCalls,
  };
}

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
    async set(items) { Object.assign(store, items); },
    async remove(keys) {
      const ks = Array.isArray(keys) ? keys : [keys];
      for (const k of ks) delete store[k];
    },
    raw: store,
  };
}

// ─── BaseChromeListRepository ──────────────────────────────────────
describe("Repositories: BaseChromeListRepository", () => {
  it("REPO-01 list caching & invalidate", async () => {
    const stub = createStub({ bookmarks: [{ id: "b1", title: "GitHub", url: "https://github.com", categoryId: "c1", order: 0 }] });
    const repo = new BaseChromeListRepository(stub, "bookmarks", Bookmark.fromJSON);
    const first = await repo.list();
    assert.equal(first.length, 1);
    assert.equal(stub.getCalls(), 1);
    const second = await repo.list();
    assert.equal(second.length, 1);
    assert.equal(stub.getCalls(), 1, "second list should use cache");
    repo.invalidate();
    await repo.list();
    assert.equal(stub.getCalls(), 2, "after invalidate should reload");
  });

  it("REPO-02 corrupted row skip (warn not throw)", async () => {
    const valid = { id: "widget-clock", type: "clock", x: 1, y: 1, w: 4, h: 2, visible: true };
    const invalid = { id: "w-legacy", type: "quicknote", x: 1, y: 1, w: 2, h: 2 }; // unknown type
    const stub = createStub({ layout: [valid, invalid] });
    const repo = new BaseChromeListRepository(stub, "layout", WidgetLayout.fromJSON);
    const list = await repo.list();
    assert.equal(list.length, 1);
    assert.equal(list[0].type.value, "clock");
  });

  it("REPO-03 save upsert / saveAll / setAll / delete / findById", async () => {
    const stub = createStub({ categories: [] });
    const repo = new BaseChromeListRepository(stub, "categories", Category.fromJSON);
    // save new
    const c1 = new Category({ id: new Id("c1"), name: "Dev", order: 0 });
    await repo.save(c1);
    let list = await repo.list();
    assert.equal(list.length, 1);
    assert.equal(list[0].name, "Dev");
    // save upsert (update)
    c1.rename("Development");
    await repo.save(c1);
    list = await repo.list();
    assert.equal(list.length, 1);
    assert.equal(list[0].name, "Development");
    // findById
    assert.equal((await repo.findById(new Id("c1"))).name, "Development");
    assert.equal(await repo.findById(new Id("missing")), null);
    // findByIdRaw
    assert.equal((await repo.findByIdRaw("c1")).name, "Development");
    // saveAll (additional)
    const c2 = new Category({ id: new Id("c2"), name: "Design", order: 1 });
    await repo.saveAll([c2]);
    list = await repo.list();
    assert.equal(list.length, 2);
    // setAll replaces entirely
    const c3 = new Category({ id: new Id("c3"), name: "Marketing", order: 0 });
    await repo.setAll([c3]);
    list = await repo.list();
    assert.equal(list.length, 1);
    assert.equal(list[0].name, "Marketing");
    // delete
    await repo.delete(new Id("c3"));
    list = await repo.list();
    assert.equal(list.length, 0);
    // delete non-existent does not throw
    await repo.delete(new Id("nope"));
    assert.equal((await repo.list()).length, 0);
    // verify persisted JSON shape
    assert.ok(Array.isArray(stub.raw.categories));
  });

  it("handles missing key as empty", async () => {
    const stub = createStub({});
    const repo = new BaseChromeListRepository(stub, "bookmarks", Bookmark.fromJSON);
    assert.deepEqual(await repo.list(), []);
  });
});

// ─── ChromeBookmarkCollectionRepository ──────────────────────────────
describe("Repositories: ChromeBookmarkCollectionRepository", () => {
  it("REPO-04 save/list/findById/delete, dedupe, workspaceId", async () => {
    const storage = createMockStorage();
    const repo = new ChromeBookmarkCollectionRepository({ storage });
    assert.deepEqual(await repo.findAll(), []);
    // save
    const coll = new BookmarkCollection({ id: "coll-1", name: "Dev", bookmarkIds: ["b1", "b1", "b2"], workspaceId: "ws-1" });
    await repo.save(coll);
    let list = await repo.findAll();
    assert.equal(list.length, 1);
    assert.deepEqual(list[0].bookmarkIds, ["b1", "b2"]);
    assert.equal(list[0].workspaceId, "ws-1");
    // findById
    const found = await repo.findById("coll-1");
    assert.equal(found.name, "Dev");
    assert.equal(await repo.findById("missing"), null);
    // upsert update
    found.rename("Dev Tools");
    await repo.save(found);
    assert.equal((await repo.findById("coll-1")).name, "Dev Tools");
    // workspaceId null case
    const coll2 = new BookmarkCollection({ id: "coll-2", name: "No WS", bookmarkIds: [], workspaceId: null });
    await repo.save(coll2);
    assert.equal((await repo.findById("coll-2")).workspaceId, null);
    // delete
    await repo.delete("coll-1");
    assert.equal(await repo.findById("coll-1"), null);
    list = await repo.findAll();
    assert.equal(list.length, 1);
    // clearCache path (via delete/list caching)
    repo.clearCache();
    list = await repo.findAll();
    assert.equal(list.length, 1);
  });

  it("findAll returns copies, not shared refs", async () => {
    const storage = createMockStorage();
    const repo = new ChromeBookmarkCollectionRepository({ storage });
    await repo.save(new BookmarkCollection({ id: "c1", name: "A", bookmarkIds: ["b1"] }));
    const a = await repo.findAll();
    a.push(new BookmarkCollection({ id: "c2", name: "B", bookmarkIds: [] }));
    const b = await repo.findAll();
    assert.equal(b.length, 1);
  });
});

// ─── ChromeBookmarkTagRepository (uses global chrome) ─────────────────
describe("Repositories: ChromeBookmarkTagRepository", () => {
  function installChromeMock(initial = {}) {
    const data = { ...initial };
    const local = {
      get: async (key) => {
        if (typeof key === "string") return { [key]: data[key] };
        if (Array.isArray(key)) { const out = {}; for (const k of key) out[k] = data[k]; return out; }
        if (typeof key === "object" && key !== null) return { ...data };
        return { ...data };
      },
      set: async (items) => Object.assign(data, items),
    };
    const sync = { get: async () => ({}), set: async () => {} };
    globalThis.chrome = { storage: { local, sync, onChanged: { addListener: () => {} } } };
    return { data, local };
  }

  it("REPO-05 setTags/getTags/getAll/clearCache", async () => {
    installChromeMock();
    const repo = new ChromeBookmarkTagRepository();
    // empty initially
    assert.deepEqual(await repo.getTags("bm-1"), []);
    assert.deepEqual(await repo.getAll(), {});
    await repo.setTags("bm-1", ["javascript", "frontend"]);
    assert.deepEqual((await repo.getTags("bm-1")).sort(), ["frontend", "javascript"]);
    await repo.setTags("bm-2", ["notes"]);
    const all = await repo.getAll();
    assert.ok(all["bm-1"]);
    assert.ok(all["bm-2"]);
    // overwrite with empty → removes entry
    await repo.setTags("bm-1", []);
    assert.deepEqual(await repo.getTags("bm-1"), []);
    assert.equal((await repo.getAll())["bm-1"], undefined);
    // cache clear reloads
    repo.clearCache();
    assert.deepEqual(await repo.getTags("bm-2"), ["notes"]);
    delete globalThis.chrome;
  });

  it("REPO-05b load handles corrupted storage gracefully", async () => {
    // simulate get returning non-object
    globalThis.chrome = {
      storage: {
        local: { get: async () => ({ bookmarkTags: "bad-string" }), set: async () => {} },
        sync: { get: async () => ({}), set: async () => {} },
        onChanged: { addListener: () => {} },
      },
    };
    const repo = new ChromeBookmarkTagRepository();
    assert.deepEqual(await repo.getAll(), {});
    delete globalThis.chrome;
  });
});

// ─── ChromeBookmarkGroupRepository (uses global chrome) ─────────────
describe("Repositories: ChromeBookmarkGroupRepository", () => {
  function installChromeMock(initial = {}) {
    const data = { ...initial };
    const local = {
      get: async (key) => {
        if (typeof key === "string") return { [key]: data[key] };
        if (Array.isArray(key)) { const out = {}; for (const k of key) out[k] = data[k]; return out; }
        return { ...data };
      },
      set: async (items) => Object.assign(data, items),
    };
    const sync = { get: async () => ({}), set: async () => {} };
    globalThis.chrome = { storage: { local, sync, onChanged: { addListener: () => {} } } };
    return { data };
  }

  it("REPO-06 save/findById/findAll/delete + clearCache", async () => {
    installChromeMock();
    const repo = new ChromeBookmarkGroupRepository();
    assert.deepEqual(await repo.findAll(), []);
    const { BookmarkGroup } = await import("../src/domain/entities/BookmarkGroup.js");
    const g = new BookmarkGroup({ id: "g1", name: "Team Alpha", icon: "code", folderIds: ["1", "2"] });
    await repo.save(g);
    assert.equal((await repo.findById("g1")).name, "Team Alpha");
    assert.equal(await repo.findById("missing"), null);
    let list = await repo.findAll();
    assert.equal(list.length, 1);
    // update via save
    g.updateName("Team Beta");
    await repo.save(g);
    assert.equal((await repo.findById("g1")).name, "Team Beta");
    // second group
    const g2 = new BookmarkGroup({ id: "g2", name: "Team Gamma", icon: "briefcase", folderIds: [] });
    await repo.save(g2);
    assert.equal((await repo.findAll()).length, 2);
    await repo.delete("g1");
    assert.equal(await repo.findById("g1"), null);
    assert.equal((await repo.findAll()).length, 1);
    repo.clearCache();
    assert.equal((await repo.findAll()).length, 1);
    delete globalThis.chrome;
  });

  it("REPO-06b self-heals invalid icon entry", async () => {
    installChromeMock({ bookmarkGroups: [{ id: "g1", name: "Bad Icon", icon: "bad icon!", folderIds: ["1"] }] });
    const repo = new ChromeBookmarkGroupRepository();
    const list = await repo.findAll();
    assert.equal(list.length, 1);
    assert.equal(list[0].icon, "folder");
    delete globalThis.chrome;
  });
});
