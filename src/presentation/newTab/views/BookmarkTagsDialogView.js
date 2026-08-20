/* ============================================================
   BookmarkTagsDialogView — Modal dialog for editing bookmark tags
   
   Replaces window.prompt tag editing with interactive chips and
   tag input.
   ============================================================ */

import { el } from "../../shared/dom.js";
import { icon } from "../../shared/icons.js";

export class BookmarkTagsDialogView {
  constructor({ useCases, toast } = {}) {
    this.useCases = useCases;
    this.toast = toast;

    this.root = null;
    this.overlay = null;
    this.dialog = null;
    this.tagInput = null;
    this.chipsContainer = null;
    this.submitBtn = null;
    this.escHandler = null;

    this.bookmark = null;
    this.tags = new Set();
    this.onSuccess = null;
  }

  open(bookmark, { currentTags = [], onSuccess } = {}) {
    this.bookmark = bookmark;
    this.tags = new Set(Array.isArray(currentTags) ? currentTags : []);
    this.onSuccess = onSuccess;

    this.render();
    this.show();
  }

  render() {
    if (this.root) this.root.remove();

    this.overlay = el("div", { className: "overlay" });
    this.dialog = el("div", { className: "dialog tags-dialog" });

    // Header
    const header = el("div", { className: "group-dialog-header" });
    const h2 = el("h2", {}, "Edit Tags");
    const closeBtn = el(
      "button",
      { type: "button", className: "group-dialog-close", "aria-label": "Close" },
      icon("x")
    );
    closeBtn.addEventListener("click", () => this.hide());
    header.append(h2, closeBtn);
    this.dialog.append(header);

    // Bookmark info
    if (this.bookmark) {
      const info = el("div", { className: "tags-dialog-bm-info" });
      const title = el("div", { className: "tags-dialog-bm-title" }, this.bookmark.title || "Bookmark");
      info.append(title);
      this.dialog.append(info);
    }

    // Form
    const form = el("form", { className: "group-dialog-form" });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    // Tag field
    const field = el("div", { className: "field" });
    const label = el("label", {}, "Tags");
    field.append(label);

    const tagsBox = el("div", { className: "tags-dialog-box" });
    this.chipsContainer = el("div", { className: "tags-dialog-chips" });
    this._renderChips();
    tagsBox.append(this.chipsContainer);

    this.tagInput = el("input", {
      type: "text",
      className: "tags-dialog-input",
      placeholder: "Add tag (press Enter or comma)...",
      autocomplete: "off",
    });

    this.tagInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const val = this.tagInput.value.replace(/,/g, "").trim().toLowerCase();
        if (val) {
          this.tags.add(val);
          this._renderChips();
          this.tagInput.value = "";
        }
      }
    });

    tagsBox.append(this.tagInput);
    field.append(tagsBox);
    form.append(field);

    // Actions
    const actions = el("div", { className: "dialog-actions" });
    const cancelBtn = el("button", { type: "button", className: "btn" }, "Cancel");
    cancelBtn.addEventListener("click", () => this.hide());

    this.submitBtn = el("button", { type: "submit", className: "btn btn-primary" }, "Save Tags");
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

  _renderChips() {
    if (!this.chipsContainer) return;
    this.chipsContainer.replaceChildren();

    for (const tag of this.tags) {
      const chip = el("span", { className: "tags-dialog-chip" });
      const text = el("span", {}, `#${tag}`);
      const removeBtn = el(
        "button",
        {
          type: "button",
          className: "tags-dialog-chip-remove",
          "aria-label": `Remove tag ${tag}`,
        },
        "×"
      );
      removeBtn.addEventListener("click", () => {
        this.tags.delete(tag);
        this._renderChips();
      });
      chip.append(text, removeBtn);
      this.chipsContainer.append(chip);
    }
  }

  async handleSubmit() {
    // If user typed something in input without pressing Enter, add it now
    if (this.tagInput && this.tagInput.value.trim()) {
      const val = this.tagInput.value.replace(/,/g, "").trim().toLowerCase();
      if (val) this.tags.add(val);
    }

    if (!this.bookmark) return;
    if (this.submitBtn) this.submitBtn.disabled = true;

    try {
      if (this.useCases?.setBookmarkTags) {
        await this.useCases.setBookmarkTags.execute({
          bookmarkId: this.bookmark.id,
          tags: Array.from(this.tags),
        });
      }
      this.toast?.show("Tags updated");
      if (this.onSuccess) this.onSuccess();
      this.hide();
    } catch (err) {
      if (this.submitBtn) this.submitBtn.disabled = false;
      this.toast?.show(err.message || "Failed to update tags", { error: true });
    }
  }

  show() {
    document.body.append(this.root);
    this.root.offsetHeight; // reflow
    this.overlay.classList.add("is-open");
    this.tagInput?.focus();
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
