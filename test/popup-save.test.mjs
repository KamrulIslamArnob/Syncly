import { test } from "node:test";
import assert from "node:assert/strict";
import { PopupController, rankPopupWorkspaces } from "../src/presentation/popup/popupController.js";

test("workspace shortcuts keep the active workspace visible before frequently used ones", () => {
  const groups = [
    { id: "work", name: "Work" },
    { id: "design", name: "Design" },
    { id: "personal", name: "Personal" },
    { id: "learning", name: "Learning" },
  ];
  const ranked = rankPopupWorkspaces(groups, "learning", { work: 5, design: 12, personal: 2 });
  assert.deepEqual(ranked.slice(0, 3).map(({ id }) => id), ["learning", "design", "work"]);
  assert.equal(ranked.length, 5);
  assert.deepEqual(groups.map(({ id }) => id), ["work", "design", "personal", "learning"]);
});

test("All bookmarks remains selectable when no workspace is active", () => {
  const ranked = rankPopupWorkspaces([{ id: "work", name: "Work" }], "", { work: 10 });
  assert.equal(ranked[0].id, "");
  assert.equal(ranked[1].id, "work");
});

// Exercise save orchestration without replacing it with a second implementation.
function setup() {
  const classes = new Set();
  const status = { textContent: "" };
  globalThis.document = { getElementById: () => status };
  const calls = [];
  globalThis.chrome = {
    bookmarks: {
      create: async (data) => {
        calls.push(["create", data]);
        return { id: "saved", ...data };
      },
      move: async (id, data) => calls.push(["move", id, data]),
      update: async (id, data) => calls.push(["update", id, data]),
    },
  };
  const popup = Object.assign(Object.create(PopupController.prototype), {
    titleInput: { value: "A useful reference" },
    urlInput: { value: "https://example.com/reference" },
    tagsInput: { value: "research, design" },
    tagsList: { querySelectorAll: () => [{ dataset: { tag: "selected" } }] },
    folderHidden: { value: "reading" },
    folderLabel: { textContent: "Reading" },
    categoryHidden: { value: "quick-access" },
    categoryLabel: { textContent: "Quick Access" },
    customCollectionHidden: { value: "references" },
    customCollectionLabel: { textContent: "References" },
    collections: [{ id: "references", folderId: "collection-folder" }],
    categories: [],
    folders: [],
    destinationType: "bookmark",
    btnQuickAddQuickie: {},
    submitBtn: {
      classList: { contains: (v) => classes.has(v), add: (v) => classes.add(v), remove: (v) => classes.delete(v) },
    },
    submitBtnText: {},
    useCases: {
      listBookmarkTags: { execute: async () => ({ saved: ["existing"] }) },
      setBookmarkTags: { execute: async (data) => calls.push(["tags", data]) },
      updateCollectionMembers: { execute: async (data) => calls.push(["members", data]) },
    },
    closeAllDropdowns() {},
    clearError() { this.error = ""; },
    showError(message) { this.error = message; },
    _updateSubmitButtonLabel() {},
    async _rememberCollection() {},
  });
  return { popup, calls };
}

test("popup saves selected and uncommitted tags and blocks duplicate submit", async () => {
  const { popup, calls } = setup();
  await Promise.all([popup.onSubmit(), popup.onSubmit()]);
  assert.equal(calls.filter(([type]) => type === "create").length, 1);
  assert.deepEqual(calls.find(([type]) => type === "tags")[1], {
    bookmarkId: "saved", tags: ["existing", "selected", "research", " design"],
  });
  assert.equal(popup.submitBtn.disabled, true);
});

test("popup moves an existing bookmark without creating a duplicate", async () => {
  const { popup, calls } = setup();
  popup.existingBookmark = { id: "existing", parentId: "quickie", title: popup.titleInput.value };
  await popup.onSubmit();
  assert.deepEqual(calls[0], ["move", "existing", { parentId: "reading" }]);
  assert.equal(calls.some(([type]) => type === "create"), false);
});

test("popup preserves shortcut destination and collection membership", async () => {
  for (const destination of ["shortcut", "collection"]) {
    const { popup, calls } = setup();
    popup.destinationType = destination;
    await popup.onSubmit();
    assert.equal(calls[0][1].parentId, destination === "shortcut" ? "quick-access" : "collection-folder");
    if (destination === "collection") {
      assert.deepEqual(calls.find(([type]) => type === "members")[1], {
        collectionId: "references", add: ["saved"], urls: [popup.urlInput.value],
      });
    }
    assert.ok(calls.some(([type]) => type === "tags"));
  }
});

test("failed native save unlocks both actions for retry", async () => {
  const { popup } = setup();
  chrome.bookmarks.create = async () => { throw new Error("Storage unavailable"); };
  await popup.onSubmit();
  assert.equal(popup.error, "Storage unavailable");
  assert.equal(popup._saving, false);
  assert.equal(popup.submitBtn.disabled, false);
  assert.equal(popup.btnQuickAddQuickie.disabled, false);
});

test("tag failure reports a partial save without duplicating the bookmark", async () => {
  const { popup, calls } = setup();
  popup.useCases.setBookmarkTags.execute = async () => { throw new Error("Tag storage unavailable"); };
  await popup.onSubmit();
  assert.equal(popup.error, "Bookmark saved, but tags could not be saved.");
  assert.equal(calls.filter(([type]) => type === "create").length, 1);
  assert.equal(popup.submitBtnText.textContent, "Saved");
});
