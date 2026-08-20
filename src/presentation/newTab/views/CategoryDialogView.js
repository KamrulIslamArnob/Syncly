/* ============================================================
   CategoryDialogView — Create/Rename shortcut category dialog
   ============================================================ */

import { el } from "../../shared/dom.js";
import { icon } from "../../shared/icons.js";

export class CategoryDialogView {
  constructor({ useCases, toast } = {}) {
    this.useCases = useCases;
    this.toast = toast;

    this.root = null;
    this.overlay = null;
    this.dialog = null;
    this.nameInput = null;
    this.submitBtn = null;
    this.escHandler = null;

    this.isRename = false;
    this.targetCategory = null;
    this.onSuccess = null;
    this.shortcutsFolderId = null;
  }

  setShortcutsFolderId(id) {
    this.shortcutsFolderId = id || null;
  }

  openForCreate({ onSuccess } = {}) {
    this.isRename = false;
    this.targetCategory = null;
    this.onSuccess = onSuccess;

    this.render();
    this.show();
  }

  openForRename(category, { onSuccess } = {}) {
    this.isRename = true;
    this.targetCategory = category;
    this.onSuccess = onSuccess;

    this.render();
    if (this.nameInput && category) {
      this.nameInput.value = category.name;
    }
    this.show();
  }

  render() {
    if (this.root) this.root.remove();

    this.overlay = el("div", { className: "overlay" });
    this.dialog = el("div", { className: "dialog collection-dialog" });

    // Header
    const header = el("div", { className: "group-dialog-header" });
    const titleText = this.isRename ? "Rename Category" : "New Category";
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

    // Name field
    const nameField = el("div", { className: "field" });
    const nameLabel = el("label", {}, "Category Name");
    this.nameInput = el("input", {
      type: "text",
      placeholder: "e.g., Work, Social, Dev, Tools",
      required: true,
      maxLength: 50,
      autocomplete: "off",
    });
    nameField.append(nameLabel, this.nameInput);
    form.append(nameField);

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
      this.isRename ? "Save Changes" : "Create Category"
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
    setTimeout(() => this.nameInput?.focus(), 60);

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
    const name = this.nameInput?.value.trim();
    if (!name) return;

    this.submitBtn.disabled = true;

    try {
      // Native folder mode: Shortcuts → Category = subfolder inside Shortcuts
      if (this.shortcutsFolderId && typeof chrome !== "undefined" && chrome.bookmarks) {
        if (this.isRename) {
          if (!this.targetCategory) return;
          const catId = this.targetCategory.id?.value || this.targetCategory.id || this.targetCategory.nativeId;
          await chrome.bookmarks.update(catId, { title: name });
          this.toast?.show(`Renamed category to "${name}"`);
        } else {
          await chrome.bookmarks.create({ parentId: this.shortcutsFolderId, title: name });
          this.toast?.show(`Created category "${name}"`);
        }
      } else {
        if (this.isRename) {
          if (!this.targetCategory) return;
          await this.useCases.renameCategory.execute({
            id: this.targetCategory.id.value || this.targetCategory.id,
            name,
          });
          this.toast?.show(`Renamed category to "${name}"`);
        } else {
          await this.useCases.createCategory.execute({ name });
          this.toast?.show(`Created category "${name}"`);
        }
      }

      this.hide();
      if (typeof this.onSuccess === "function") this.onSuccess();
    } catch (err) {
      this.toast?.show(err.message || "Failed to save category", { error: true });
      this.submitBtn.disabled = false;
    }
  }
}
