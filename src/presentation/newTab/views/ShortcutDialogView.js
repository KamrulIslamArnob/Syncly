/* ============================================================
   ShortcutDialogView — Create/Edit circular shortcut dialog
   ============================================================ */

import { el } from "../../shared/dom.js";
import { icon } from "../../shared/icons.js";

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

export class ShortcutDialogView {
  constructor({ useCases, toast } = {}) {
    this.useCases = useCases;
    this.toast = toast;

    this.root = null;
    this.overlay = null;
    this.dialog = null;
    this.urlInput = null;
    this.nameInput = null;
    this.categorySelect = null;
    this.submitBtn = null;
    this.escHandler = null;

    this.isEdit = false;
    this.targetShortcut = null;
    this.defaultCategoryId = null;
    this.categories = [];
    this.onSuccess = null;
    this.shortcutsFolderId = null;
  }

  setShortcutsFolderId(id) {
    this.shortcutsFolderId = id || null;
  }

  openForCreate({ categoryId = null, categories = [], onSuccess } = {}) {
    this.isEdit = false;
    this.targetShortcut = null;
    this.defaultCategoryId = categoryId;
    this.selectedCategoryId = categoryId || (categories[0] ? (categories[0].id?.value || categories[0].id) : null);
    this.categories = categories || [];
    this.onSuccess = onSuccess;

    this.render();
    this.show();
  }

  openForEdit(shortcut, { categories = [], onSuccess } = {}) {
    this.isEdit = true;
    this.targetShortcut = shortcut;
    this.defaultCategoryId = shortcut?.categoryId?.value || shortcut?.categoryId || null;
    this.selectedCategoryId = this.defaultCategoryId || (categories[0] ? (categories[0].id?.value || categories[0].id) : null);
    this.categories = categories || [];
    this.onSuccess = onSuccess;

    this.render();
    if (shortcut) {
      if (this.urlInput) this.urlInput.value = shortcut.url?.href || shortcut.url || "";
      if (this.nameInput) this.nameInput.value = shortcut.title || "";
    }
    this.show();
  }

  render() {
    if (this.root) this.root.remove();

    this.overlay = el("div", { className: "overlay" });
    this.dialog = el("div", { className: "dialog collection-dialog" });

    // Header
    const header = el("div", { className: "group-dialog-header" });
    const titleText = this.isEdit ? "Edit Shortcut" : "Add Website Shortcut";
    const h2 = el("h2", {}, titleText);
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
      if (!this.nameInput.value.trim() && this.urlInput.value.trim().length > 3) {
        const guessed = guessTitleFromUrl(this.urlInput.value.trim());
        if (guessed) this.nameInput.value = guessed;
      }
    });
    urlField.append(urlLabel, this.urlInput);
    form.append(urlField);

    // Name field
    const nameField = el("div", { className: "field" });
    const nameLabel = el("label", {}, "Shortcut Name");
    this.nameInput = el("input", {
      type: "text",
      placeholder: "e.g., YouTube, Figma, GitHub",
      required: true,
      maxLength: 60,
      autocomplete: "off",
    });
    nameField.append(nameLabel, this.nameInput);
    form.append(nameField);

    // Category select field (if categories exist)
    if (this.categories.length > 0) {
      const catField = el("div", { className: "field" });
      const catLabel = el("label", {}, "Category");

      if (!this.selectedCategoryId) {
        this.selectedCategoryId = this.defaultCategoryId || (this.categories[0]?.id?.value || this.categories[0]?.id);
      }

      const activeCat = this.categories.find(
        (c) => (c.id?.value || c.id) === this.selectedCategoryId
      ) || this.categories[0];

      const triggerText = el("span", { className: "custom-select-text" }, activeCat ? activeCat.name : "Select Category");
      const trigger = el("button", {
        type: "button",
        className: "custom-select-trigger",
        "aria-haspopup": "listbox",
        "aria-expanded": "false",
      },
        el("span", { className: "custom-select-val" },
          el("span", { className: "custom-select-bullet" }, "•"),
          triggerText
        ),
        el("span", { className: "custom-select-caret" }, icon("chevronDown"))
      );

      const dropdown = el("div", { className: "custom-select-dropdown", role: "listbox" });

      const updateDropdown = () => {
        dropdown.replaceChildren();
        for (const cat of this.categories) {
          const catId = cat.id?.value || cat.id;
          const isSelected = catId === this.selectedCategoryId;
          const opt = el("button", {
            type: "button",
            className: "custom-select-option" + (isSelected ? " is-selected" : ""),
            role: "option",
            "aria-selected": String(isSelected),
          },
            el("div", { className: "custom-select-option-left" },
              el("span", { className: "custom-select-bullet" }, "•"),
              el("span", { className: "custom-select-option-name" }, cat.name)
            ),
            el("span", { className: "custom-select-check" }, icon("check"))
          );

          opt.addEventListener("click", (e) => {
            e.stopPropagation();
            this.selectedCategoryId = catId;
            triggerText.textContent = cat.name;
            closeDropdown();
          });

          dropdown.appendChild(opt);
        }
      };

      const openDropdown = () => {
        updateDropdown();
        dropdown.classList.add("is-open");
        trigger.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
        document.addEventListener("pointerdown", onOutside);
      };

      const closeDropdown = () => {
        dropdown.classList.remove("is-open");
        trigger.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
        document.removeEventListener("pointerdown", onOutside);
      };

      const onOutside = (e) => {
        if (!selectWrap.contains(e.target)) {
          closeDropdown();
        }
      };

      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        if (dropdown.classList.contains("is-open")) {
          closeDropdown();
        } else {
          openDropdown();
        }
      });

      const selectWrap = el("div", { className: "custom-select-wrap" }, trigger, dropdown);
      catField.append(catLabel, selectWrap);
      form.append(catField);
    }

    // Actions
    const actions = el("div", { className: "dialog-actions group-dialog-actions" });
    const cancelBtn = el(
      "button",
      { type: "button", className: "btn" },
      "Cancel"
    );
    cancelBtn.addEventListener("click", () => this.hide());

    this.submitBtn = el(
      "button",
      { type: "submit", className: "btn btn-primary" },
      this.isEdit ? "Save Changes" : "Add Shortcut"
    );

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
      if (this.isEdit) this.nameInput?.focus();
      else this.urlInput?.focus();
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
    let categoryId = this.selectedCategoryId || this.defaultCategoryId;

    if (!urlStr || !title) return;
    if (!/^https?:\/\//i.test(urlStr)) {
      urlStr = `https://${urlStr}`;
    }
    // Validate URL is http(s)
    try {
      const parsed = new URL(urlStr);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error("Only http(s) allowed");
      urlStr = parsed.href;
    } catch (e) {
      this.toast?.show("Invalid URL - only http(s) allowed", { error: true });
      this.submitBtn.disabled = false;
      return;
    }

    this.submitBtn.disabled = true;

    try {
      // Native folder mode
      if (this.shortcutsFolderId && typeof chrome !== "undefined" && chrome.bookmarks) {
        if (this.isEdit) {
          if (!this.targetShortcut) return;
          const bid = this.targetShortcut.id?.value || this.targetShortcut.id;
          await chrome.bookmarks.update(bid, { title, url: urlStr });
          // Move to new category if changed
          const currentCat = this.targetShortcut.categoryId?.value || this.targetShortcut.categoryId;
          if (categoryId && categoryId !== currentCat) {
            try { await chrome.bookmarks.move(bid, { parentId: categoryId }); } catch {}
          }
          this.toast?.show(`Updated shortcut "${title}"`);
        } else {
          const parentId = categoryId || this.shortcutsFolderId;
          await chrome.bookmarks.create({ parentId, title, url: urlStr });
          this.toast?.show(`Added shortcut "${title}"`);
        }
      } else {
        if (this.isEdit) {
          if (!this.targetShortcut) return;
          await this.useCases.updateBookmark.execute({
            id: this.targetShortcut.id?.value || this.targetShortcut.id,
            title,
            url: urlStr,
            categoryId: categoryId || undefined,
          });
          this.toast?.show(`Updated shortcut "${title}"`);
        } else {
          await this.useCases.createBookmark.execute({
            title,
            url: urlStr,
            categoryId,
          });
          this.toast?.show(`Added shortcut "${title}"`);
        }
      }

      this.hide();
      if (typeof this.onSuccess === "function") this.onSuccess();
    } catch (err) {
      this.toast?.show(err.message || "Failed to save shortcut", { error: true });
      this.submitBtn.disabled = false;
    }
  }
}
