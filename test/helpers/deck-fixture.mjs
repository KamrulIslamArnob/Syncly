// Shared fixture for BookmarkDeckView tests: a small bookmark library, an
// open log that yields live / resting / cold links, and a helper that
// renders the deck into the mini DOM through its real _load().

import assert from "node:assert/strict";
import { installMiniDom } from "./mini-dom.mjs";

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const NOW = Date.now();

export const SUBS = ["watch", "clothing shop", "trousers", "gadgets", "perfume", "shirt", "shoes", "electronics"];

export function memoryStorage(initial = {}) {
  const store = { ...initial };
  return {
    store,
    async get(keys) {
      if (keys == null) return { ...store };
      const list = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
      const out = {};
      for (const k of list) if (k in store) out[k] = store[k];
      return out;
    },
    async set(obj) { Object.assign(store, obj); },
  };
}

// Bookmarks Bar: Code (1 link), Buy (1 loose link + 8 sub-folders) and Temp,
// which holds second copies of MDN and Wishlist.
// Other Bookmarks: Quickie with two links saved 3 and 12 days ago.
export function libraryTree() {
  const bm = (id, title, url, parentId, dateAdded) => ({ id, title, url, parentId, dateAdded });
  const buy = [bm("100", "Wishlist", "https://wish.test/", "10", NOW - 400 * DAY)];
  SUBS.forEach((name, i) => {
    const id = String(20 + i);
    buy.push({ id, title: name, parentId: "10", children: [bm(`${id}1`, `${name} one`, `https://${id}.test/one`, id, NOW - 300 * DAY)] });
  });
  buy[1].children.push(bm("202", "watch two", "https://20.test/two", "20", NOW - 5 * DAY));
  return [{
    id: "0", title: "", children: [
      {
        id: "1", title: "Bookmarks Bar", parentId: "0", children: [
          { id: "5", title: "Code", parentId: "1", children: [bm("50", "MDN", "https://mdn.test/", "5", NOW - 30 * DAY)] },
          { id: "10", title: "Buy", parentId: "1", children: buy },
          {
            id: "30", title: "Temp", parentId: "1", children: [
              bm("301", "MDN copy", "https://mdn.test/", "30", NOW - 200 * DAY),
              bm("302", "Wishlist again", "https://wish.test/", "30", NOW - 200 * DAY),
            ],
          },
        ],
      },
      {
        id: "2", title: "Other Bookmarks", parentId: "0", children: [
          {
            id: "40", title: "Quickie", parentId: "2", children: [
              bm("41", "Bun notes", "https://bun.test/", "40", NOW - 3 * DAY),
              bm("42", "CSS :has()", "https://css.test/has", "40", NOW - 12 * DAY - HOUR),
            ],
          },
        ],
      },
    ],
  }];
}

// watch one: live · trousers one: resting · watch two: saved 5 days ago, never opened (resting)
// Wishlist and the other sub-folder links: never opened and saved long ago (cold).
export const OPEN_LOG = {
  bookmarkUsage: { 201: 33, 221: 2 },
  bookmarkLastOpenedAt: { 201: NOW - DAY - 60_000, 221: NOW - 30 * DAY },
  bookmarkSignalSince: NOW - 60 * DAY,
};

export const COLLECTIONS = [
  { id: "c1", name: "Frontend", bookmarkIds: ["50", "201"], bookmarkUrls: ["https://mdn.test/", "https://20.test/one"], createdAt: 1, updatedAt: 1 },
  { id: "c2", name: "Shopping", bookmarkIds: ["221"], bookmarkUrls: ["https://22.test/one"], createdAt: 1, updatedAt: 1 },
];

/** Render the deck through its real _load() and return the view. */
export async function renderDeck({ store = {}, useCases = {}, clock, getColorMode } = {}) {
  if (typeof globalThis.document === "undefined") installMiniDom();
  const { BookmarkDeckView } = await import("../../src/presentation/newTab/views/BookmarkDeckView.js");
  const view = new BookmarkDeckView({
    getTree: async () => libraryTree(),
    storage: memoryStorage({ ...OPEN_LOG, ...store }),
    clock,
    getColorMode,
    useCases: {
      listBookmarkGroups: { execute: async () => [] },
      setActiveGroup: { getActive: async () => null, execute: async () => {} },
      ...useCases,
    },
  });
  // renderInto() starts a load of its own; hold it so the awaited load is the only one.
  view._load = async () => {};
  view.renderInto(document.body.appendChild(document.createElement("main")));
  delete view._load;
  await view._load();
  return view;
}

const label = (el) => el.querySelector(".raindrop-nav-label")?.textContent;

export function sidebarRow(view, text) {
  const row = view._sidebar.querySelectorAll(".raindrop-nav-row").find((r) => label(r) === text);
  assert.ok(row, `sidebar row "${text}"`);
  return row;
}

export function clickFolder(view, title) {
  const row = view._sidebar.querySelectorAll(".raindrop-tree-row").find((r) => label(r) === title);
  assert.ok(row, `sidebar folder "${title}"`);
  row.click();
}
