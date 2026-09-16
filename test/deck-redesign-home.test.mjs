import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { renderDeck } from "./helpers/deck-fixture.mjs";

// Library on Home: Code 1 · Buy 10 · Temp 2. Nine links are cold (seven in
// Buy, both Temp copies); MDN and Wishlist are each saved twice.
const triage = (view) => view._content.querySelectorAll(".raindrop-triage-card");
const triageCard = (view, kind) => triage(view).find((c) => c.dataset.triage === kind);
const text = (el, selector) => el.querySelector(selector)?.textContent;
const cards = (view) => view._content.querySelectorAll(".raindrop-card");

describe("Home triage row", () => {
  it("counts what is waiting in Quickie and how long the oldest has sat", async () => {
    const view = await renderDeck();
    const quickie = triageCard(view, "quickie");
    assert.equal(text(quickie, ".raindrop-triage-title"), "2 in Quickie");
    assert.equal(text(quickie, ".raindrop-triage-note"), "oldest sat 12 days · file them");
  });

  it("counts links that have gone cold across the library", async () => {
    const view = await renderDeck();
    assert.equal(text(triageCard(view, "cold"), ".raindrop-triage-title"), "9 gone cold");
  });

  it("counts redundant copies and the folders they sit in", async () => {
    const view = await renderDeck();
    const duplicates = triageCard(view, "duplicates");
    assert.equal(text(duplicates, ".raindrop-triage-title"), "2 duplicates");
    assert.equal(text(duplicates, ".raindrop-triage-note"), "same URL across 3 folders");
  });

  it("opens Quickie from its card", async () => {
    const view = await renderDeck();
    triageCard(view, "quickie").click();
    assert.equal(view._activeSelection.type, "quickie");
    assert.equal(cards(view).length, 2);
  });

  it("opens every cold link from the cold card", async () => {
    const view = await renderDeck();
    triageCard(view, "cold").click();
    assert.equal(text(view._header, ".raindrop-header-title"), "Gone cold");
    assert.equal(cards(view).length, 9);
    assert.ok(cards(view).every((c) => c.classList.contains("is-cold")));
  });

  it("lists each repeated link next to its copy from the duplicates card", async () => {
    const view = await renderDeck();
    triageCard(view, "duplicates").click();
    assert.equal(text(view._header, ".raindrop-header-title"), "Duplicates");
    assert.deepEqual(cards(view).map((c) => c.title), ["MDN", "MDN copy", "Wishlist", "Wishlist again"]);
  });
});

describe("Home bento", () => {
  it("puts Quickie first, then Collections, with To-Do alongside", async () => {
    const view = await renderDeck();
    const tiles = view._content.querySelector(".home-bento-dashboard").children;
    const kinds = tiles.map((t) =>
      ["bento-card-quickies", "bento-card-collections", "bento-card-tasks", "bento-card-calendar"]
        .find((c) => t.classList.contains(c)));
    // First three preserve legacy order; calendar is appended date surface.
    assert.deepEqual(kinds.slice(0, 3), ["bento-card-quickies", "bento-card-collections", "bento-card-tasks"]);
    assert.ok(kinds.includes("bento-card-calendar"), "calendar tile is rendered when showDate is on");
  });

  it("sits below the triage row", async () => {
    const view = await renderDeck();
    const sections = view._content.children.map((c) => c.className.split(" ")[0]);
    assert.ok(sections.indexOf("raindrop-triage-row") >= 0, "triage row is rendered");
    assert.ok(sections.indexOf("raindrop-triage-row") < sections.indexOf("home-bento-dashboard"));
  });
});
