/* ============================================================
   CollectionDialogView — Create/Rename bookmark collection dialog
   
   Provides a clean modal popup for creating or renaming curated
   bookmark collections.
   ============================================================ */

import { el } from "../../shared/dom.js";
import { icon } from "../../shared/icons.js";

export class CollectionDialogView {
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
    this.targetCollection = null;
    this.initialBookmarkIds = [];
    this.onSuccess = null;
  }

  openForCreate({ initialBookmarkIds = [], workspaceId = null, onSuccess } = {}) {
    this.isRename = false;
    this.targetCollection = null;
    this.initialBookmarkIds = Array.isArray(initialBookmarkIds) ? initialBookmarkIds : [];
    this.workspaceId = workspaceId;
    this.onSuccess = onSuccess;

    this.render();
    this.show();
  }

  openForRename(collection, { onSuccess } = {}) {
    this.isRename = true;
    this.targetCollection = collection;
    this.initialBookmarkIds = [];
    this.onSuccess = onSuccess;

    this.render();
    if (this.nameInput && collection) {
      this.nameInput.value = collection.name;
    }
    this.show();
  }

  render() {
    if (this.root) this.root.remove();

    this.overlay = el("div", { className: "overlay" });
    this.dialog = el("div", { className: "dialog collection-dialog" });

    // Header
    const header = el("div", { className: "group-dialog-header" });
    const titleText = this.isRename ? "Rename Collection" : "New Collection";
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
    const nameLabel = el("label", {}, "Collection Name");
    this.nameInput = el("input", {
      type: "text",
      placeholder: "e.g., Design Inspo, Reading List",
      required: true,
      maxLength: 50,
      autocomplete: "off",
    });
    nameField.append(nameLabel, this.nameInput);
    form.append(nameField);

    // Member count hint if adding from multi-select
    if (!this.isRename && this.initialBookmarkIds.length > 0) {
      const hint = el(
        "div",
        { className: "collection-dialog-hint" },
        `Adding ${this.initialBookmarkIds.length} selected bookmark${this.initialBookmarkIds.length === 1 ? "" : "s"}`
      );
      form.append(hint);
    }

    // Actions
    const actions = el("div", { className: "dialog-actions" });
    const cancelBtn = el("button", { type: "button", className: "btn" }, "Cancel");
    cancelBtn.addEventListener("click", () => this.hide());

    const submitText = this.isRename ? "Save Changes" : "Create Collection";
    this.submitBtn = el("button", { type: "submit", className: "btn btn-primary" }, submitText);

    actions.append(cancelBtn, this.submitBtn);
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

  async handleSubmit() {
    const name = this.nameInput.value.trim();
    if (!name) {
      this.toast?.show("Please enter a collection name", { error: true });
      return;
    }

    if (this.submitBtn) this.submitBtn.disabled = true;

    try {
      if (this.isRename && this.targetCollection) {
        await this.useCases.renameBookmarkCollection.execute({
          collectionId: this.targetCollection.id,
          name,
        });
        this.toast?.show(`Collection renamed to "${name}"`);
        if (this.onSuccess) this.onSuccess();
      } else {
        const created = await this.useCases.createBookmarkCollection.execute({
          name,
          bookmarkIds: this.initialBookmarkIds,
          workspaceId: this.workspaceId || null,
        });
        this.toast?.show(`Collection "${created.name}" created!`);
        if (this.onSuccess) this.onSuccess(created);
      }
      this.hide();
    } catch (err) {
      if (this.submitBtn) this.submitBtn.disabled = false;
      this.toast?.show(err.message || "Action failed", { error: true });
    }
  }

  show() {
    document.body.append(this.root);
    this.root.offsetHeight; // reflow
    this.overlay.classList.add("is-open");
    this.nameInput?.focus();
    if (this.nameInput?.value) {
      this.nameInput.setSelectionRange(this.nameInput.value.length, this.nameInput.value.length);
    }
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
