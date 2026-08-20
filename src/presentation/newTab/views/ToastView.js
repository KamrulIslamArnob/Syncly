export class ToastView {
  constructor(id = "toast") {
    this.node = document.getElementById(id);
    this.timer = null;
  }

  show(message, opts = {}) {
    if (!this.node) return;
    this.node.textContent = message;
    this.node.classList.add("is-on");
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.node.classList.remove("is-on");
    }, opts.durationMs ?? 2400);
  }
}
