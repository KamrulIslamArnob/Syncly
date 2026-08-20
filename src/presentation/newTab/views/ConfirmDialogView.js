/* ============================================================
   ConfirmDialogView — Native modal confirmation dialog
   
   Replaces browser window.confirm() and prompt() flows with
   Syncly's dark/light aesthetic modal.
   ============================================================ */

import { el } from "../../shared/dom.js";
import { icon } from "../../shared/icons.js";

export class ConfirmDialogView {
  constructor({ toast } = {}) {
    this.toast = toast;
    this.root = null;
    this.overlay = null;
    this.dialog = null;
    this.escHandler = null;
  }

  /**
   * Open confirmation dialog.
   * @param {Object} options
   * @param {string} options.title - Dialog heading
   * @param {string} options.message - Confirmation text description
   * @param {string} [options.confirmLabel="Confirm"] - Text for confirm button
   * @param {boolean} [options.isDanger=true] - If true, uses accent/red danger button styling
   * @param {Function} options.onConfirm - Async/sync callback on confirm
   */
  open({ title = "Confirm Action", message = "Are you sure?", confirmLabel = "Confirm", isDanger = true, onConfirm } = {}) {
    this.render({ title, message, confirmLabel, isDanger, onConfirm });
    this.show();
  }

  render({ title, message, confirmLabel, isDanger, onConfirm }) {
    if (this.root) this.root.remove();

    this.overlay = el("div", { className: "overlay" });
    this.dialog = el("div", { className: "dialog confirm-dialog" });

    // Header
    const header = el("div", { className: "group-dialog-header" });
    const h2 = el("h2", {}, title);
    const closeBtn = el(
      "button",
      { type: "button", className: "group-dialog-close", "aria-label": "Close" },
      icon("x")
    );
    closeBtn.addEventListener("click", () => this.hide());
    header.append(h2, closeBtn);
    this.dialog.append(header);

    // Body message
    const body = el("div", { className: "confirm-dialog-body" });
    const msgEl = el("p", { className: "confirm-dialog-msg" }, message);
    body.append(msgEl);
    this.dialog.append(body);

    // Actions
    const actions = el("div", { className: "dialog-actions" });
    const cancelBtn = el("button", { type: "button", className: "btn" }, "Cancel");
    cancelBtn.addEventListener("click", () => this.hide());

    const confirmBtn = el(
      "button",
      {
        type: "button",
        className: `btn ${isDanger ? "btn-danger" : "btn-primary"}`,
      },
      confirmLabel
    );

    confirmBtn.addEventListener("click", async () => {
      confirmBtn.disabled = true;
      try {
        if (onConfirm) await onConfirm();
        this.hide();
      } catch (err) {
        confirmBtn.disabled = false;
        this.toast?.show(err.message || "Action failed", { error: true });
      }
    });

    actions.append(cancelBtn, confirmBtn);
    this.dialog.append(actions);

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

  show() {
    document.body.append(this.root);
    this.root.offsetHeight; // force reflow for transition
    this.overlay.classList.add("is-open");
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
