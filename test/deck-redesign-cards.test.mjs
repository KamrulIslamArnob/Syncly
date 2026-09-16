import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { renderDeck, clickFolder } from "./helpers/deck-fixture.mjs";

const cards = (view) => view._content.querySelectorAll(".raindrop-card");
const card = (view, title) => cards(view).find((c) => c.title === title);
const chips = (view) => view._content.querySelectorAll(".raindrop-chip");
const chipLabel = (c) => c.querySelector(".raindrop-chip-label")?.textContent;
const chipLabels = (view) => chips(view).map(chipLabel);
const chip = (view, text) => chips(view).find((c) => chipLabel(c) === text);

describe("bookmark cards", () => {
  it("mark how recently each link was opened", async () => {
    const view = await renderDeck();
    clickFolder(view, "Buy");
    assert.ok(card(view, "watch one").classList.contains("is-live"));
    assert.ok(card(view, "trousers one").classList.contains("is-rest"));
    assert.ok(card(view, "watch two").classList.contains("is-rest"), "a fresh save is not cold yet");
    assert.ok(card(view, "Wishlist").classList.contains("is-cold"));
  });

  it("name the link's folder, when it was last opened and how often", async () => {
    const view = await renderDeck();
    clickFolder(view, "Buy");
    const watch = card(view, "watch one");
    assert.equal(watch.querySelector(".raindrop-card-bottom .raindrop-card-meta-folder").textContent, "watch");
    assert.equal(watch.querySelector(".raindrop-card-bottom .raindrop-card-meta-age").textContent, "1d");
    assert.equal(watch.querySelector(".raindrop-card-bottom .raindrop-card-meta-count").textContent, "33×");

    const wishlist = card(view, "Wishlist");
    assert.equal(wishlist.querySelector(".raindrop-card-bottom .raindrop-card-meta-folder").textContent, "Buy");
    assert.equal(wishlist.querySelector(".raindrop-card-bottom .raindrop-card-meta-age").textContent, "1y", "never opened: time since it was saved");
    assert.equal(wishlist.querySelector(".raindrop-card-bottom .raindrop-card-meta-count").textContent, "never");
  });

  it("repeat the meta line under the title for the compact density", async () => {
    const view = await renderDeck();
    clickFolder(view, "Buy");
    assert.equal(card(view, "watch one").querySelector(".raindrop-card-info .raindrop-card-meta-folder")?.textContent, "watch");
  });

  it("take the colour of the folder they live in, by its position among its siblings", async () => {
    const view = await renderDeck();
    clickFolder(view, "Buy");
    assert.equal(card(view, "watch one").style.getPropertyValue("--card-accent"), "var(--folder-pal-0)");
    assert.equal(card(view, "trousers one").style.getPropertyValue("--card-accent"), "var(--folder-pal-2)");
    assert.equal(card(view, "Wishlist").style.getPropertyValue("--card-accent"), "var(--folder-pal-1)", "Buy is the second folder in the bar");
  });

  it("use a colour picked for the folder over its position", async () => {
    const view = await renderDeck({ store: { bookmarkFolderColors: { 22: "#EF4444" } } });
    clickFolder(view, "Buy");
    assert.equal(card(view, "trousers one").style.getPropertyValue("--card-accent"), "#EF4444");
  });
});

describe("folder chip row", () => {
  it("offers All, the folder's own links and the first six sub-folders, with link counts", async () => {
    const view = await renderDeck();
    clickFolder(view, "Buy");
    assert.deepEqual(chipLabels(view), ["All", "Direct", "watch", "clothing shop", "trousers", "gadgets", "perfume", "shirt", "+2 more"]);
    assert.equal(chip(view, "All").querySelector(".raindrop-chip-count").textContent, "10");
    assert.equal(chip(view, "Direct").querySelector(".raindrop-chip-count").textContent, "1");
    assert.equal(chip(view, "watch").querySelector(".raindrop-chip-count").textContent, "2");
  });

  it("reveals the remaining sub-folders from +N more", async () => {
    const view = await renderDeck();
    clickFolder(view, "Buy");
    chip(view, "+2 more").click();
    assert.deepEqual(chipLabels(view).slice(-2), ["shoes", "electronics"]);
  });

  it("narrows the grid to one sub-folder and back to all", async () => {
    const view = await renderDeck();
    clickFolder(view, "Buy");
    chip(view, "watch").click();
    assert.deepEqual(cards(view).map((c) => c.title), ["watch one", "watch two"]);
    assert.ok(chip(view, "watch").classList.contains("is-active"));
    assert.equal(chip(view, "All").classList.contains("is-active"), false);

    chip(view, "All").click();
    assert.equal(cards(view).length, 10);
  });

  it("clears its filters when you move to another folder", async () => {
    const view = await renderDeck();
    clickFolder(view, "Buy");
    chip(view, "watch").click();
    clickFolder(view, "Code");
    clickFolder(view, "Buy");
    assert.equal(cards(view).length, 10);
    assert.ok(chip(view, "All").classList.contains("is-active"));
  });
});

describe("signal strip", () => {
  it("counts live, resting and cold links in the folder", async () => {
    const view = await renderDeck();
    clickFolder(view, "Buy");
    assert.equal(view._content.querySelector(".raindrop-signal-text").textContent, "1 live · 2 resting · 7 cold");
  });

  it("prunes the grid down to cold links and back", async () => {
    const view = await renderDeck();
    clickFolder(view, "Buy");
    view._content.querySelector(".raindrop-signal-prune").click();
    assert.equal(cards(view).length, 7);
    assert.ok(cards(view).every((c) => c.classList.contains("is-cold")));

    view._content.querySelector(".raindrop-signal-prune").click();
    assert.equal(cards(view).length, 10);
  });

  it("stays out of the way when nothing has gone cold", async () => {
    const view = await renderDeck();
    clickFolder(view, "Code");
    assert.equal(view._content.querySelector(".raindrop-signal"), null);
  });
});
