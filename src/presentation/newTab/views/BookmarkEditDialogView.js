/* ============================================================
   BookmarkEditDialogView — Edit bookmark metadata dialog
   
   Allows users to edit an existing bookmark's title, URL, and
   destination folder in their Chrome bookmarks library.
   ============================================================ */

import { el } from "../../shared/dom.js";
import { icon } from "../../shared/icons.js";
import { FolderTreeSelectorView } from "./FolderTreeSelectorView.js";
import { isSafeUrl } from "./TreeView.js";

function guessTitleFromUrl(urlStr) {
  try {
    const u = new URL(urlStr.startsWith("http") ? urlStr : `https://${urlStr}`);
    const host = u.hostname.replace(/^www\./, "");
    const parts = host.split(".");
    if (parts.length >= 2) {
      const name = parts[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return host;
  } catch {
    return "";
  }
}

export class BookmarkEditDialogView {
  constructor({ getTree, useCases, toast } = {}) {
    this.getTree = typeof getTree === "function" ? getTree : () => (typeof chrome !== "undefined" && chrome.bookmarks?.getTree ? chrome.bookmarks.getTree() : Promise.resolve([]));
    this.useCases = useCases || null;
    this.toast = toast || null;

    this.root = null;
    this.overlay = null;
    this.dialog = null;
    this.urlInput = null;
    this.nameInput = null;
    this.submitBtn = null;
    this.escHandler = null;

    this.folderSelector = new FolderTreeSelectorView({ getTree: this.getTree, mode: "single" });
    this.bookmark = null;
    this.onSuccess = null;
  }

  async open(bookmark, { onSuccess } = {}) {
    this.bookmark = bookmark;
    this.onSuccess = onSuccess;

    this.folderSelector.reset();
    const defaultParentId = bookmark?.parentId || "1";
    this.folderSelector.setSelectedFolderIds([defaultParentId]);
    this.folderSelector.loadTree();

    this.render();

    if (this.nameInput) this.nameInput.value = bookmark?.title || "";
    if (this.urlInput) this.urlInput.value = bookmark?.url || "";

    this.show();
  }

  render() {
    if (this.root) this.root.remove();

    this.overlay = el("div", { className: "overlay" });
    this.dialog = el("div", { className: "dialog folder-dialog bookmark-dialog" });

    // Header
    const header = el("div", { className: "group-dialog-header" });
    const h2 = el("h2", {}, "Edit Bookmark");
    const closeBtn = el(
      "button",
      { type: "button", className: "group-dialog-close", "aria-label": "Close" },
      icon("x")
    );
    closeBtn.addEventListener("click", () => this.hide());
    header.append(h2, closeBtn);
    this.dialog.append(header);

    // Form
    const form = el("form", { className: "group-dialog-form" });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    // URL field
    const urlField = el("div", { className: "field" });
    const urlLabel = el("label", {}, "Website URL");
    this.urlInput = el("input", {
      type: "url",
      placeholder: "https://example.com",
      required: true,
      autocomplete: "off",
    });
    this.urlInput.addEventListener("input", () => {
      if (this.nameInput && !this.nameInput.value.trim() && this.urlInput.value.trim().length > 3) {
        const guessed = guessTitleFromUrl(this.urlInput.value.trim());
        if (guessed) this.nameInput.value = guessed;
      }
    });
    urlField.append(urlLabel, this.urlInput);
    form.append(urlField);

    // Name field
    const nameField = el("div", { className: "field" });
    const nameLabel = el("label", {}, "Bookmark Name");
    this.nameInput = el("input", {
      type: "text",
      placeholder: "e.g., GitHub Repository, MDN Docs",
      required: true,
      maxLength: 120,
      autocomplete: "off",
    });
    nameField.append(nameLabel, this.nameInput);
    form.append(nameField);

    // Folder location selector
    const parentField = el("div", { className: "field" });
    parentField.append(el("label", {}, "Location (Folder)"), this.folderSelector.render());
    form.append(parentField);

    // Actions
    const actions = el("div", { className: "dialog-actions group-dialog-actions" });
    const cancelBtn = el("button", { type: "button", className: "btn" }, "Cancel");
    cancelBtn.addEventListener("click", () => this.hide());

    this.submitBtn = el("button", { type: "submit", className: "btn btn-primary" }, "Save Changes");

    actions.append(cancelBtn, this.submitBtn);
    form.append(actions);
    this.dialog.append(form);

    this.overlay.append(this.dialog);
    this.root = this.overlay;
    document.body.appendChild(this.root);

    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.hide();
    });
  }

  show() {
    if (!this.root) return;
    requestAnimationFrame(() => {
      this.overlay?.classList.add("is-open");
    });
    setTimeout(() => {
      this.nameInput?.focus();
    }, 60);

    this.escHandler = (e) => {
      if (e.key === "Escape") this.hide();
    };
    window.addEventListener("keydown", this.escHandler);
  }

  hide() {
    if (!this.root) return;
    if (this.overlay) {
      this.overlay.classList.remove("is-open");
    }
    if (this.escHandler) {
      window.removeEventListener("keydown", this.escHandler);
      this.escHandler = null;
    }
    setTimeout(() => {
      this.root?.remove();
      this.root = null;
      this.overlay = null;
      this.dialog = null;
    }, 180);
  }

  async handleSubmit() {
    let urlStr = this.urlInput?.value.trim();
    const title = this.nameInput?.value.trim();

    if (!urlStr || !title || !this.bookmark) return;

    if (!/^https?:\/\//i.test(urlStr)) {
      urlStr = `https://${urlStr}`;
    }

    const safeUrl = isSafeUrl(urlStr);
    if (!safeUrl) {
      this.toast?.show("Invalid URL - only http(s) allowed", { error: true });
      if (this.submitBtn) this.submitBtn.disabled = false;
      return;
    }
    urlStr = safeUrl;

    if (this.submitBtn) this.submitBtn.disabled = true;

    try {
      const selectedParentId = this.folderSelector.getSelectedFolderId();
      const bookmarkId = this.bookmark.id;

      if (typeof chrome !== "undefined" && chrome.bookmarks && typeof chrome.bookmarks.update === "function") {
        await chrome.bookmarks.update(bookmarkId, { title, url: urlStr });
        if (selectedParentId && this.bookmark.parentId && selectedParentId !== this.bookmark.parentId) {
          try {
            await chrome.bookmarks.move(bookmarkId, { parentId: selectedParentId });
          } catch (moveErr) {
            console.warn("[BookmarkEditDialog] Failed to move bookmark folder:", moveErr);
          }
        }
      }

      if (this.useCases?.updateBookmark) {
        try {
          await this.useCases.updateBookmark.execute({
            id: bookmarkId,
            title,
            url: urlStr,
            categoryId: selectedParentId || undefined,
          });
        } catch (_) {}
      }

      this.toast?.show(`Updated "${title}"`);
      this.hide();
      if (typeof this.onSuccess === "function") this.onSuccess();
    } catch (err) {
      this.toast?.show(err.message || "Failed to update bookmark", { error: true });
      if (this.submitBtn) this.submitBtn.disabled = false;
    }
  }
}
