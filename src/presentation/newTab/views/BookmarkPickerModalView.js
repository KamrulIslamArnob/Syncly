/* ============================================================
   BookmarkPickerModalView — Add bookmarks to collection modal
   
   Allows users to search and multi-select existing bookmarks from
   their library to bundle into the current collection, or create
   a new bookmark directly.
   ============================================================ */

import { el } from "../../shared/dom.js";
import { icon } from "../../shared/icons.js";
import { initial, websiteFaviconUrl } from "../../shared/favicon.js";
import { isSafeUrl } from "./TreeView.js";

export class BookmarkPickerModalView {
  constructor({ useCases, toast } = {}) {
    this.useCases = useCases;
    this.toast = toast;

    this.root = null;
    this.overlay = null;
    this.dialog = null;
    this.escHandler = null;

    this.collection = null;
    this.allLeaves = [];
    this.selectedIds = new Set();
    this.searchQuery = "";
    this.activeTab = "library"; // "library" | "new"

    this.listContainer = null;
    this.searchInput = null;
    this.submitBtn = null;
    this.countBadge = null;
    this.onSuccess = null;
  }

  open(target, allLeaves = [], { onSuccess } = {}) {
    // target can be a Collection entity or a Folder descriptor { id, name, isFolder: true }
    this.target = target;
    this.isFolderTarget = Boolean(target?.isFolder || !target?.bookmarkIds);
    this.collection = this.isFolderTarget ? null : target;
    this.allLeaves = Array.isArray(allLeaves) ? allLeaves : [];
    this.selectedIds = new Set(Array.isArray(target?.bookmarkIds) ? target.bookmarkIds : []);
    this.searchQuery = "";
    this.activeTab = "library";
    this.onSuccess = onSuccess;

    this.render();
    this.show();
  }

  render() {
    if (this.root) this.root.remove();

    this.overlay = el("div", { className: "overlay" });
    this.dialog = el("div", { className: "dialog bookmark-picker-dialog" });

    // Header
    const targetName = this.target?.name || this.target?.title || "Folder";
    const header = el("div", { className: "group-dialog-header" });
    const h2 = el("h2", {}, `Add Bookmarks to "${targetName}"`);
    const closeBtn = el(
      "button",
      { type: "button", className: "group-dialog-close", "aria-label": "Close" },
      icon("x")
    );
    closeBtn.addEventListener("click", () => this.hide());
    header.append(h2, closeBtn);
    this.dialog.append(header);

    // Tab switcher
    const tabs = el("div", { className: "picker-tabs" });
    const tabLib = el("button", {
      type: "button",
      className: `picker-tab${this.activeTab === "library" ? " is-active" : ""}`,
    }, "From Library");
    const tabNew = el("button", {
      type: "button",
      className: `picker-tab${this.activeTab === "new" ? " is-active" : ""}`,
    }, "+ New Bookmark");

    tabLib.addEventListener("click", () => {
      this.activeTab = "library";
      tabLib.classList.add("is-active");
      tabNew.classList.remove("is-active");
      this._renderTabBody();
    });

    tabNew.addEventListener("click", () => {
      this.activeTab = "new";
      tabNew.classList.add("is-active");
      tabLib.classList.remove("is-active");
      this._renderTabBody();
    });

    tabs.append(tabLib, tabNew);
    this.dialog.append(tabs);

    // Tab Body Container
    this.bodyContainer = el("div", { className: "picker-body" });
    this.dialog.append(this.bodyContainer);
    this._renderTabBody();

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

  _renderTabBody() {
    this.bodyContainer.replaceChildren();

    if (this.activeTab === "library") {
      this._renderLibraryTab();
    } else {
      this._renderNewLinkTab();
    }
  }

  _renderLibraryTab() {
    // Top search & filter bar
    const searchWrap = el("div", { className: "picker-search-bar" });
    const searchIcon = el("span", { className: "picker-search-icon" }, icon("search"));
    this.searchInput = el("input", {
      type: "text",
      className: "picker-search-input",
      placeholder: "Search bookmarks by title or URL...",
      value: this.searchQuery,
      autocomplete: "off",
    });

    this.searchInput.addEventListener("input", (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this._updateBookmarkList();
    });

    searchWrap.append(searchIcon, this.searchInput);

    // Filter controls row (Select all / Clear) with distinct badges
    const toolbar = el("div", { className: "picker-toolbar" });
    this.countBadge = el("span", { className: "picker-count-badge" }, this._getCountLabel());

    const selectAllBtn = el("button", {
      type: "button",
      className: "picker-action-chip picker-action-primary",
    }, "Select all matching");
    selectAllBtn.addEventListener("click", () => {
      const matching = this._getFilteredLeaves();
      for (const m of matching) this.selectedIds.add(m.id);
      this._updateBookmarkList();
    });

    const clearBtn = el("button", {
      type: "button",
      className: "picker-action-chip",
    }, "Clear");
    clearBtn.addEventListener("click", () => {
      this.selectedIds.clear();
      this._updateBookmarkList();
    });

    const actionsGroup = el("div", { className: "picker-actions-group" }, selectAllBtn, clearBtn);
    toolbar.append(this.countBadge, actionsGroup);

    // Scrollable bookmarks list
    this.listContainer = el("div", { className: "picker-list" });
    this._updateBookmarkList();

    // Footer actions
    const footer = el("div", { className: "dialog-actions" });
    const cancelBtn = el("button", { type: "button", className: "btn" }, "Cancel");
    cancelBtn.addEventListener("click", () => this.hide());

    this.submitBtn = el("button", {
      type: "button",
      className: "btn btn-primary",
    }, `Save to Collection (${this.selectedIds.size})`);

    this.submitBtn.addEventListener("click", () => this._handleSaveLibrary());

    footer.append(cancelBtn, this.submitBtn);

    this.bodyContainer.append(searchWrap, toolbar, this.listContainer, footer);
  }

  _getFilteredLeaves() {
    if (!this.searchQuery) return this.allLeaves;
    return this.allLeaves.filter((leaf) => {
      const title = (leaf.title || "").toLowerCase();
      const url = (leaf.url || "").toLowerCase();
      return title.includes(this.searchQuery) || url.includes(this.searchQuery);
    });
  }

  _getCountLabel() {
    const totalMatching = this._getFilteredLeaves().length;
    return `${this.selectedIds.size} selected · ${totalMatching} shown`;
  }

  _updateBookmarkList() {
    if (!this.listContainer) return;
    this.listContainer.replaceChildren();

    if (this.countBadge) this.countBadge.textContent = this._getCountLabel();
    if (this.submitBtn) this.submitBtn.textContent = `Save to Collection (${this.selectedIds.size})`;

    const filtered = this._getFilteredLeaves();

    if (filtered.length === 0) {
      const empty = el("div", { className: "picker-empty" },
        this.searchQuery ? `No bookmarks match "${this.searchQuery}"` : "No bookmarks found in library."
      );
      this.listContainer.append(empty);
      return;
    }

    for (const leaf of filtered) {
      const isSelected = this.selectedIds.has(leaf.id);
      const row = el("div", {
        className: `picker-item${isSelected ? " is-selected" : ""}`,
      });

      const checkbox = el("input", {
        type: "checkbox",
        className: "picker-item-checkbox",
        checked: isSelected,
      });

      checkbox.addEventListener("change", (e) => {
        if (e.target.checked) {
          this.selectedIds.add(leaf.id);
          row.classList.add("is-selected");
        } else {
          this.selectedIds.delete(leaf.id);
          row.classList.remove("is-selected");
        }
        if (this.countBadge) this.countBadge.textContent = this._getCountLabel();
        if (this.submitBtn) this.submitBtn.textContent = `Save to Collection (${this.selectedIds.size})`;
      });

      // Favicon
      const favWrap = el("span", { className: "picker-item-fav" }, initial(leaf.title));
      const safe = isSafeUrl(leaf.url);
      if (safe) {
        Promise.resolve(websiteFaviconUrl(safe)).then((src) => {
          if (!src || !favWrap.isConnected) return;
          const img = el("img", { src, alt: "", loading: "lazy" });
          img.addEventListener("error", () => {
            if (favWrap.isConnected) favWrap.textContent = initial(leaf.title);
          });
          favWrap.replaceChildren(img);
        });
      }

      // Info
      const info = el("div", { className: "picker-item-info" });
      const title = el("div", { className: "picker-item-title" }, leaf.title || "Bookmark");
      
      const meta = el("div", { className: "picker-item-meta" });
      if (leaf.path && leaf.path.length > 0) {
        const pathChip = el("span", { className: "picker-item-path" }, leaf.path.join(" / "));
        meta.append(pathChip);
      }
      try {
        const domain = new URL(leaf.url).hostname.replace(/^www\./, "");
        meta.append(el("span", { className: "picker-item-domain" }, domain));
      } catch {}

      info.append(title, meta);

      row.append(checkbox, favWrap, info);

      row.addEventListener("click", (e) => {
        if (e.target === checkbox) return;
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event("change"));
      });

      this.listContainer.append(row);
    }
  }

  async _handleSaveLibrary() {
    if (!this.collection) return;
    if (this.submitBtn) this.submitBtn.disabled = true;

    const currentMembers = new Set(this.collection.bookmarkIds || []);
    const newMembers = this.selectedIds;

    const toAdd = Array.from(newMembers).filter((id) => !currentMembers.has(id));
    const toRemove = Array.from(currentMembers).filter((id) => !newMembers.has(id));

    try {
      if (this.isFolderTarget) {
        // Move newly selected bookmarks into this Chrome folder
        const targetParentId = this.target.id;
        for (const id of toAdd) {
          try {
            await chrome.bookmarks.move(id, { parentId: targetParentId });
          } catch (e) {
            console.warn(`Failed to move bookmark ${id}:`, e);
          }
        }
        this.toast?.show(`Added ${toAdd.length} bookmark(s) to "${this.target.title || "Folder"}"`);
      } else {
        if (toAdd.length > 0 || toRemove.length > 0) {
          await this.useCases.updateCollectionMembers.execute({
            collectionId: this.collection.id,
            add: toAdd,
            remove: toRemove,
          });
          this.toast?.show(`Updated "${this.collection.name}" (${newMembers.size} bookmarks)`);
        }
      }
      if (this.onSuccess) this.onSuccess();
      this.hide();
    } catch (err) {
      if (this.submitBtn) this.submitBtn.disabled = false;
      this.toast?.show(err.message || "Failed to update bookmarks", { error: true });
    }
  }

  _renderNewLinkTab() {
    const form = el("form", { className: "picker-new-link-form" });

    const fieldsWrap = el("div", { className: "picker-new-link-fields" });

    const targetName = this.target?.name || this.target?.title || "destination";
    const desc = el("p", { className: "picker-new-link-desc" },
      `Create a new bookmark in your browser and automatically place it in "${targetName}".`
    );

    const urlField = el("div", { className: "field" });
    urlField.append(el("label", {}, "Page URL"));
    const urlInput = el("input", {
      type: "url",
      placeholder: "https://example.com",
      required: true,
      autocomplete: "off",
    });
    urlField.append(urlInput);

    const titleField = el("div", { className: "field" });
    titleField.append(el("label", {}, "Title (optional)"));
    const titleInput = el("input", {
      type: "text",
      placeholder: "e.g., Cool Design Inspiration",
      autocomplete: "off",
    });
    titleField.append(titleInput);

    fieldsWrap.append(desc, urlField, titleField);

    const footer = el("div", { className: "dialog-actions" });
    const cancelBtn = el("button", { type: "button", className: "btn" }, "Cancel");
    cancelBtn.addEventListener("click", () => this.hide());

    const saveBtn = el("button", { type: "submit", className: "btn btn-primary" }, "Save Bookmark");
    footer.append(cancelBtn, saveBtn);
    form.append(fieldsWrap, footer);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const rawUrl = urlInput.value.trim();
      if (!rawUrl) return;

      // Strictly validate via isSafeUrl only; never use raw scheme-bearing string directly
      let url = isSafeUrl(rawUrl);
      if (!url) {
        const candidate = rawUrl.includes("://") ? rawUrl : `https://${rawUrl}`;
        url = isSafeUrl(candidate);
      }
      if (!url) {
        this.toast?.show("Invalid URL - only http(s) allowed", { error: true });
        return;
      }
      let domain = "";
      try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch {}
      const title = titleInput.value.trim() || domain || "Bookmark";

      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";

      try {
        let parentId = "2";
        if (this.isFolderTarget && this.target?.id) {
          parentId = this.target.id;
        } else if (this.useCases?.ensureQuickieFolder) {
          parentId = (await this.useCases.ensureQuickieFolder.execute()) || "2";
        }

        // Create Chrome bookmark
        const created = await chrome.bookmarks.create({
          parentId,
          title,
          url,
        });

        // If collection, also link into collection
        if (this.collection?.id) {
          await this.useCases.updateCollectionMembers.execute({
            collectionId: this.collection.id,
            add: [created.id],
          });
        }

        this.toast?.show(`Added "${title}" to "${targetName}"`);
        if (this.onSuccess) this.onSuccess();
        this.hide();
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Bookmark";
        this.toast?.show(err.message || "Failed to create bookmark", { error: true });
      }
    });

    this.bodyContainer.append(form);
    urlInput.focus();
  }

  show() {
    document.body.append(this.root);
    this.root.offsetHeight; // reflow
    this.overlay.classList.add("is-open");
    if (this.searchInput) this.searchInput.focus();
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
