import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { installMiniDom } from "./helpers/mini-dom.mjs";

installMiniDom();

const { BookmarkDeckView, flattenLeaves } = await import("../src/presentation/newTab/views/BookmarkDeckView.js");
const { buildBookmarkTree } = await import("../src/presentation/newTab/views/TreeView.js");
const { filterBackupData } = await import("../src/infrastructure/services/backupAllowlist.js");

const DAY = 86_400_000;

function pick(store, keys) {
  if (keys == null) return { ...store };
  const list = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
  const out = {};
  for (const k of list) if (k in store) out[k] = store[k];
  return out;
}

function memoryStorage(initial = {}) {
  const store = { ...initial };
  const writes = [];
  return {
    store,
    writes,
    async get(keys) { return pick(store, keys); },
    async set(obj) { writes.push(obj); Object.assign(store, obj); },
  };
}

const workspaceUseCases = () => ({
  listBookmarkGroups: { execute: async () => [] },
  setActiveGroup: { getActive: async () => null, execute: async () => {} },
});

// Buy holds one link of its own and two sub-folders.
function buyFolder() {
  return {
    id: "10", title: "Buy", type: "folder", children: [
      { id: "13", title: "Wishlist", type: "bookmark", url: "https://wish.test/", parentId: "10", children: [] },
      {
        id: "11", title: "watch", type: "folder", children: [
          { id: "111", title: "Rolex", type: "bookmark", url: "https://rolex.test/", parentId: "11", children: [] },
          { id: "112", title: "Casio", type: "bookmark", url: "https://casio.test/", parentId: "11", children: [] },
        ],
      },
      {
        id: "12", title: "shoes", type: "folder", children: [
          { id: "121", title: "Nike", type: "bookmark", url: "https://nike.test/", parentId: "12", children: [] },
        ],
      },
    ],
  };
}

function viewingBuy() {
  const view = new BookmarkDeckView();
  const folder = buyFolder();
  view._roots = [{ id: "1", title: "Bookmarks Bar", type: "folder", children: [folder] }];
  view._activeSelection = { type: "folder", id: "10", title: "Buy", folder };
  return view;
}

describe("bookmark dates reach the deck", () => {
  it("buildBookmarkTree keeps Chrome's dateAdded and dateLastUsed on bookmarks", () => {
    const [bar] = buildBookmarkTree([{
      id: "0", title: "", children: [{
        id: "1", title: "Bookmarks Bar", children: [
          { id: "5", title: "Docs", url: "https://docs.test/", dateAdded: 1_700_000_000_000, dateLastUsed: 1_750_000_000_000 },
        ],
      }],
    }], { pruneEmpty: false });
    assert.equal(bar.children[0].dateAdded, 1_700_000_000_000);
    assert.equal(bar.children[0].dateLastUsed, 1_750_000_000_000);
    assert.equal(bar.children[0].parentId, "1", "cards need their real folder to pick a colour and to move");
  });

  it("flattenLeaves carries both dates onto each leaf", () => {
    const [leaf] = flattenLeaves([{
      id: "f", type: "folder", title: "Buy", children: [
        { id: "b", type: "bookmark", title: "Watch", url: "https://w.test/", parentId: "f", dateAdded: 111, dateLastUsed: 222 },
      ],
    }]);
    assert.equal(leaf.dateAdded, 111);
    assert.equal(leaf.dateLastUsed, 222);
  });
});

describe("recording opens", () => {
  it("stores when a bookmark was opened alongside its open count", async () => {
    const storage = memoryStorage();
    const view = new BookmarkDeckView({ storage });
    const before = Date.now();
    await view._recordOpen({ id: "b1", title: "Docs" });
    const saved = storage.writes.at(-1);
    assert.equal(saved.bookmarkUsage.b1, 1);
    assert.ok(saved.bookmarkLastOpenedAt.b1 >= before && saved.bookmarkLastOpenedAt.b1 <= Date.now());
  });

  it("loads stored open timestamps and stamps when tracking began on first run", async () => {
    const openedAt = Date.now() - DAY;
    const storage = memoryStorage({ bookmarkUsage: { 111: 4 }, bookmarkLastOpenedAt: { 111: openedAt } });
    const tree = [{
      id: "0", title: "", children: [
        { id: "1", title: "Bookmarks Bar", children: [{ id: "111", title: "Rolex", url: "https://rolex.test/", parentId: "1" }] },
        { id: "2", title: "Other Bookmarks", children: [] },
      ],
    }];
    const view = new BookmarkDeckView({ getTree: async () => tree, storage, useCases: workspaceUseCases() });
    view.renderInto(document.body.appendChild(document.createElement("main")));
    await view._load();

    assert.equal(view._lastOpenedAt["111"], openedAt);
    assert.equal(typeof storage.store.bookmarkSignalSince, "number");
  });

  it("keeps the first tracking start instead of restamping it on later loads", async () => {
    const since = Date.now() - 30 * DAY;
    const storage = memoryStorage({ bookmarkSignalSince: since });
    const tree = [{ id: "0", title: "", children: [{ id: "1", title: "Bookmarks Bar", children: [] }] }];
    const view = new BookmarkDeckView({ getTree: async () => tree, storage, useCases: workspaceUseCases() });
    view.renderInto(document.body.appendChild(document.createElement("main")));
    await view._load();

    assert.equal(storage.store.bookmarkSignalSince, since);
    assert.equal(view._signalSince, since);
  });
});

describe("folder pool", () => {
  it("includes links from every sub-folder", () => {
    assert.deepEqual(viewingBuy()._getActivePool().map((b) => b.id), ["13", "111", "112", "121"]);
  });

  it("narrows to one sub-folder when its chip is active", () => {
    const view = viewingBuy();
    view._subfolderFilter = "11";
    assert.deepEqual(view._getActivePool().map((b) => b.id), ["111", "112"]);
  });

  it("narrows to the folder's own links when its loose-links chip is active", () => {
    const view = viewingBuy();
    view._subfolderFilter = "direct";
    assert.deepEqual(view._getActivePool().map((b) => b.id), ["13"]);
  });

  it("shows only cold links while pruning", () => {
    const view = viewingBuy();
    view._usage = { 111: 3, 13: 1 };
    view._lastOpenedAt = { 111: Date.now() - DAY, 13: Date.now() - 200 * DAY };
    view._signalFilter = "cold";
    // 13 was last opened 200 days ago; 112 and 121 were never opened and have no save date.
    assert.deepEqual(view._getActivePool().map((b) => b.id), ["13", "112", "121"]);
  });

  it("keeps a loose-links folder to the links saved directly in its root", () => {
    const view = new BookmarkDeckView();
    const root = {
      id: "1", title: "Bookmarks Bar", type: "folder", children: [
        { id: "7", title: "Gmail", type: "bookmark", url: "https://mail.test/", parentId: "1", children: [] },
        buyFolder(),
      ],
    };
    view._roots = [root];
    view._activeSelection = { type: "folder", id: "loose:1", title: "Bookmarks Bar", folder: root };
    assert.deepEqual(view._getActivePool().map((b) => b.id), ["7"]);
  });

  it("reorders a dropped card to its sibling's position in the Chrome folder", async () => {
    const moves = [];
    globalThis.chrome = { bookmarks: { move: async (id, dest) => { moves.push([id, dest]); } } };
    try {
      const view = viewingBuy();
      view._drag = { id: "112", parentId: "11" };
      await view._handleDropOnCard({ id: "111", parentId: "11" });
      assert.deepEqual(moves, [["112", { index: 0 }]]);
    } finally {
      delete globalThis.chrome;
    }
  });
});

describe("backups", () => {
  it("keep the open timestamps the signal strip depends on", () => {
    const out = filterBackupData({ bookmarkLastOpenedAt: { a: 1 }, bookmarkSignalSince: 5, githubBackupPAT: "secret" });
    assert.deepEqual(out, { bookmarkLastOpenedAt: { a: 1 }, bookmarkSignalSince: 5 });
  });
});
