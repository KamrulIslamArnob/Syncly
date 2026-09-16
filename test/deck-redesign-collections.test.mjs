import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { renderDeck, sidebarRow } from "./helpers/deck-fixture.mjs";

// Frontend: MDN (Code) + watch one (Buy, opened a day ago)
// Apparel:  trousers one (Buy, opened 30 days ago)
// Kit:      six never-opened Buy links
const PAGE = [
  { id: "c1", name: "Frontend", bookmarkIds: ["50", "201"], bookmarkUrls: [], createdAt: 1, updatedAt: 1 },
  { id: "c2", name: "Apparel", bookmarkIds: ["221"], bookmarkUrls: [], createdAt: 1, updatedAt: 1 },
  { id: "c3", name: "Kit", bookmarkIds: ["211", "231", "241", "251", "261", "271"], bookmarkUrls: [], createdAt: 1, updatedAt: 1 },
];

async function openCollections() {
  const view = await renderDeck({ useCases: { listBookmarkCollections: { execute: async () => PAGE } } });
  sidebarRow(view, "Collections").click();
  return view;
}

const collectionCard = (view, name) => view._content.querySelectorAll(".raindrop-collection-card")
  .find((c) => c.querySelector(".raindrop-coll-name")?.textContent === name);
const names = (view) => view._content.querySelectorAll(".raindrop-coll-name").map((n) => n.textContent);
const text = (el, selector) => el.querySelector(selector)?.textContent;

function sortBy(view, value) {
  const select = view._header.querySelector(".raindrop-sort-select");
  select.value = value;
  select.dispatchEvent({ type: "change" });
}

describe("Collections page", () => {
  it("says how many folders a collection draws from", async () => {
    const view = await openCollections();
    assert.equal(text(collectionCard(view, "Frontend"), ".raindrop-coll-span"), "2 folders");
    assert.equal(text(collectionCard(view, "Apparel"), ".raindrop-coll-span"), "1 folder");
  });

  it("says when any of its links was last opened", async () => {
    const view = await openCollections();
    assert.equal(text(collectionCard(view, "Frontend"), ".raindrop-coll-last"), "opened 1d");
    assert.equal(text(collectionCard(view, "Apparel"), ".raindrop-coll-last"), "opened 1mo");
    assert.equal(text(collectionCard(view, "Kit"), ".raindrop-coll-last"), "never opened");
  });

  it("shows up to four member tiles and counts the rest", async () => {
    const view = await openCollections();
    const kit = collectionCard(view, "Kit");
    assert.equal(kit.querySelectorAll(".raindrop-coll-member").length, 4);
    assert.equal(text(kit, ".raindrop-coll-rest"), "+2");
    assert.equal(collectionCard(view, "Apparel").querySelector(".raindrop-coll-rest"), null);
  });

  it("sorts by last opened, then by name or size from the header", async () => {
    const view = await openCollections();
    assert.deepEqual(names(view), ["Frontend", "Apparel", "Kit"]);
    sortBy(view, "name");
    assert.deepEqual(names(view), ["Apparel", "Frontend", "Kit"]);
    sortBy(view, "size");
    assert.deepEqual(names(view), ["Kit", "Frontend", "Apparel"]);
  });
});
