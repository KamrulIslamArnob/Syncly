import { el } from "../../shared/dom.js";

function createDayNightToggle() {
  const wrapper = el("div", { className: "wrapper" });
  const toggle = el("div", { className: "toggle" });
  const input = el("input", { className: "toggle-input", type: "checkbox" });
  const bg = el("div", { className: "toggle-bg" });
  const sw = el("div", { className: "toggle-switch" });
  const fig = el("div", { className: "toggle-switch-figure" });
  const figAlt = el("div", { className: "toggle-switch-figureAlt" });
  sw.append(fig, figAlt);
  toggle.append(input, bg, sw);
  wrapper.append(toggle);
  // exact behavior from provided component
  try {
    const initialState = localStorage.getItem("toggleState") == "true";
    input.checked = initialState;
  } catch {}
  input.addEventListener("change", function () {
    try { localStorage.setItem("toggleState", input.checked); } catch {}
  });
  return wrapper;
}

export class GreetingView {
  constructor({ useCases, clock }) {
    this.useCases = useCases;
    this.clock = clock;
    this.root = null;
  }

  render(settings) {
    if (!this.root) {
      this.root = el("header", { className: "greeting" });
    }
    const name = settings.name?.trim() || "";
    const hour = this.clock.now().getHours();
    let part = "Good Morning";

    if (hour >= 5 && hour < 12) {
      part = "Good Morning";
    } else if (hour >= 12 && hour < 18) {
      part = "Good Afternoon";
    } else if (hour >= 18 && hour < 22) {
      part = "Good Evening";
    } else {
      part = "Good Night";
    }

    const iconEl = createDayNightToggle();
    const greetingIcon = el("span", { className: "greeting-icon greeting-icon--toggle", "aria-hidden": "true" }, iconEl);
    const prefix = el("span", { id: "greeting-prefix" }, part + (name ? "," : ""));
    const nameEl = name ? el("span", { className: "name", id: "greeting-name" }, name) : null;
    const suffix = name ? "!" : "";

    const h1 = el("h1", {}, greetingIcon, prefix, nameEl ? [" ", nameEl, suffix] : "");
    const msg = settings.messageText?.trim() || "Stay focused. Build. Ship. Repeat.";
    const p = el("p", {}, msg);

    this.root.replaceChildren(h1, p);
    return this.root;
  }
}
