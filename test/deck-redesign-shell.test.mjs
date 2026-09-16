import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { renderDeck, clickFolder, sidebarRow, COLLECTIONS } from "./helpers/deck-fixture.mjs";

const withCollections = { listBookmarkCollections: { execute: async () => COLLECTIONS } };
const header = (view) => view._header;
const headerText = (view, selector) => header(view).querySelector(selector)?.textContent;

describe("sidebar", () => {
  it("shows each folder with a folder icon in the folder's colour", async () => {
    const view = await renderDeck();
    const buy = sidebarRow(view, "Buy");
    assert.ok(buy.querySelector(".raindrop-tree-icon svg"), "a folder icon rather than a glyph");
    assert.equal(buy.style.getPropertyValue("--row-accent"), "var(--folder-pal-1)");
  });

  it("uses a colour picked for the folder on its row", async () => {
    const view = await renderDeck({ store: { bookmarkFolderColors: { 10: "#EF4444" } } });
    assert.equal(sidebarRow(view, "Buy").style.getPropertyValue("--row-accent"), "#EF4444");
  });

  it("opens the colour picker from a folder's icon without opening the folder", async () => {
    const view = await renderDeck();
    sidebarRow(view, "Buy").querySelector(".raindrop-tree-icon").click();
    assert.ok(view._activeColorPopover?.isConnected, "colour picker is open");
    assert.equal(view._activeSelection.type, "all");
    view._activeColorPopover.remove();
    view._activeColorPopover = null;
  });

  it("lists collections under Collections, each with the collection icon in its own colour", async () => {
    const view = await renderDeck({ useCases: withCollections });
    sidebarRow(view, "Collections").click();
    const rows = view._sidebar.querySelectorAll(".raindrop-coll-sub-row");
    assert.deepEqual(rows.map((r) => r.querySelector(".raindrop-nav-label").textContent), ["Frontend", "Shopping"]);
    assert.deepEqual(rows.map((r) => r.style.getPropertyValue("--row-accent")), ["var(--folder-pal-0)", "var(--folder-pal-1)"]);
    assert.ok(rows[0].querySelector(".raindrop-nav-icon svg"));
  });
});

describe("header", () => {
  it("names the open folder and counts every link inside it", async () => {
    const view = await renderDeck();
    clickFolder(view, "Buy");
    assert.equal(headerText(view, ".raindrop-header-title"), "Buy");
    assert.equal(headerText(view, ".raindrop-header-meta"), "10 links");
    clickFolder(view, "Code");
    assert.equal(headerText(view, ".raindrop-header-meta"), "1 link");
  });

  it("tints the folder icon with the folder's colour", async () => {
    const view = await renderDeck();
    clickFolder(view, "Buy");
    assert.equal(header(view).querySelector(".raindrop-header-icon").style.getPropertyValue("color"), "var(--folder-pal-1)");
  });

  it("greets you on Home by the part of the day", async () => {
    const view = await renderDeck({
      clock: { now: () => new Date(2026, 8, 13, 19, 30) },
      useCases: { getSettings: { execute: async () => ({ name: "Kamrul" }) } },
    });
    assert.equal(headerText(view, ".raindrop-header-title"), "Good evening, Kamrul");
  });

  it("counts collections and the links they hold on the Collections page", async () => {
    const view = await renderDeck({ useCases: withCollections });
    sidebarRow(view, "Collections").click();
    assert.equal(headerText(view, ".raindrop-header-title"), "Collections");
    assert.equal(headerText(view, ".raindrop-header-meta"), "2 collections · 3 links");
  });

  it("switches density from the segmented view control and labels the active one", async () => {
    const view = await renderDeck();
    clickFolder(view, "Buy");
    const segments = header(view).querySelectorAll(".raindrop-view-seg");
    assert.deepEqual(segments.map((s) => s.dataset.view), ["compact", "list", "grid"]);
    assert.equal(headerText(view, ".raindrop-view-seg.is-active .raindrop-view-seg-label"), "Compact");

    segments.find((s) => s.dataset.view === "list").click();
    assert.ok(view._content.querySelector(".raindrop-layout").classList.contains("raindrop-list"));
    assert.equal(headerText(view, ".raindrop-view-seg.is-active .raindrop-view-seg-label"), "List");
  });

  it("adds bookmarks to the open folder from Add", async () => {
    const view = await renderDeck();
    clickFolder(view, "Buy");
    let target = null;
    view.bookmarkPicker = { open: (t) => { target = t; } };
    header(view).querySelector(".raindrop-add-btn").click();
    assert.equal(String(target?.id), "10");
  });

  it("adds bookmarks straight into Quickie from Add", async () => {
    const view = await renderDeck();
    view._quickieFolderId = "q1";
    sidebarRow(view, "Quickie").click();
    let target = null;
    view.bookmarkPicker = { open: (t) => { target = t; } };
    header(view).querySelector(".raindrop-add-btn").click();
    assert.equal(target?.id, "q1");
  });

  it("keeps Select, Add Folder and Focus mode in the more menu", async () => {
    const view = await renderDeck();
    clickFolder(view, "Buy");
    const items = header(view).querySelectorAll(".raindrop-more-menu button");
    assert.deepEqual(items.map((b) => b.textContent), ["Select bookmarks", "Add Folder", "Focus mode"]);

    items[0].click();
    assert.equal(view._selectMode, true);
    assert.ok(view._content.querySelector(".raindrop-card").classList.contains("is-selectable"));
  });

  it("opens To-Do from the Home header", async () => {
    const view = await renderDeck();
    header(view).querySelector(".raindrop-panel-trigger-btn").click();
    assert.ok(view._rightPanel?.classList.contains("is-open"));
  });
});
