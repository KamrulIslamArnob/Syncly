/* ============================================================
   NewFolderDialogView — Create-new-bookmark-folder dialog

   Replaces the old window.prompt("Enter new folder name:") flow.
   Lets the user name a new NATIVE chrome.bookmarks folder and pick
   where it nests: Bookmarks Bar (default), any existing folder, at
   any depth, under any of Chrome's roots. Creates it immediately
   via chrome.bookmarks.create — every other surface sees it via
   chrome.bookmarks.onCreated.
   ============================================================ */

import { el } from "../../shared/dom.js";
import { icon } from "../../shared/icons.js";
import { FolderTreeSelectorView } from "./FolderTreeSelectorView.js";

export class NewFolderDialogView {
  constructor({ getTree, toast } = {}) {
    this.getTree = typeof getTree === "function" ? getTree : () => chrome.bookmarks.getTree();
    this.toast = toast;

    this.root = null;
    this.overlay = null;
    this.dialog = null;
    this.nameInput = null;
    this.folderSelector = new FolderTreeSelectorView({ getTree: this.getTree, mode: "single" });
    this.escHandler = null;

    /** Set by the caller (BookmarkDeckView) — called after a successful create. */
    this.onCreate = null;
  }

  /** Fetch a fresh tree, render, and show the dialog. */
  async open(defaultParentId = "1", scopeRootFolderId = null) {
    this.folderSelector.reset();
    this.folderSelector.setScopeRootFolderId(scopeRootFolderId);
    if (defaultParentId) {
      this.folderSelector.setSelectedFolderIds([defaultParentId]);
    }
    this.folderSelector.loadTree();
    this.render(defaultParentId);
    this.show();
  }

  render(defaultParentId = "1") {
    if (this.root) this.root.remove();

    this.overlay = el("div", { className: "overlay" });
    this.dialog = el("div", { className: "dialog folder-dialog" });

    const header = el("div", { className: "group-dialog-header" });
    const title = el("h2", {}, "New Folder");
    const closeBtn = el(
      "button",
      { type: "button", className: "group-dialog-close", "aria-label": "Close" },
      icon("x")
    );
    closeBtn.addEventListener("click", () => this.hide());
    header.append(title, closeBtn);
    this.dialog.append(header);

    const form = el("form", { className: "group-dialog-form" });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleCreate();
    });

    const nameField = el("div", { className: "field" });
    this.nameInput = el("input", {
      type: "text",
      placeholder: "e.g., Development, AI Tools",
      required: true,
      autofocus: true,
      autocomplete: "off",
    });
    nameField.append(el("label", {}, "Folder Name"), this.nameInput);
    form.append(nameField);

    const parentField = el("div", { className: "field" });
    parentField.append(el("label", {}, "Location (Parent Folder)"), this.folderSelector.render());
    form.append(parentField);

    const actions = el("div", { className: "dialog-actions" });
    const cancelBtn = el("button", { type: "button", className: "btn" }, "Cancel");
    cancelBtn.addEventListener("click", () => this.hide());
    const createBtn = el("button", { type: "submit", className: "btn btn-primary" }, "Create Folder");
    actions.append(cancelBtn, createBtn);
    form.append(actions);

    this.dialog.append(form);
    this.overlay.append(this.dialog);
    this.root = this.overlay;

    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.hide();
    });

    this.escHandler = (e) => {
      if (e.key === "Escape") this.hide();
    };
    document.addEventListener("keydown", this.escHandler);
  }

  async handleCreate() {
    const title = this.nameInput.value.trim();
    if (!title) {
      this.toast?.show("Please enter a folder name", { error: true });
      return;
    }
    const parentId = this.folderSelector.getSelectedFolderId();
    if (!parentId) {
      this.toast?.show("Please select a location for the folder", { error: true });
      return;
    }

    try {
      await chrome.bookmarks.create({ title, parentId });
      this.toast?.show(`Folder "${title}" created`);
      if (this.onCreate) this.onCreate();
      this.hide();
    } catch (err) {
      this.toast?.show(err.message || "Could not create folder", { error: true });
    }
  }

  show() {
    document.body.append(this.root);
    this.root.offsetHeight; // reflow, so the is-open transition runs
    this.overlay.classList.add("is-open");
    this.nameInput?.focus();
  }

  hide() {
    if (this.overlay) {
      this.overlay.classList.remove("is-open");
      setTimeout(() => {
        if (this.root) this.root.remove();
      }, 180);
    }
    if (this.escHandler) document.removeEventListener("keydown", this.escHandler);
  }
}
