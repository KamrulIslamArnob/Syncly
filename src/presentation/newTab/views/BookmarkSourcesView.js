import { el } from "../../shared/dom.js";

const SOURCES = [
  ["chrome", "Chrome bookmarks", "Show your existing bookmarks-bar folders. They stay in their Chrome locations."],
  ["workspace", "Workspace folders", "Focus on the active workspace. Your other bookmarks stay available in All bookmarks."],
  ["both", "Both", "Show Chrome bookmarks and workspace folders together."],
];

function choices(mode, onChange) {
  const group = el("div", { className: "bookmark-source-choices", role: "group", "aria-label": "Show in the sidebar" });
  for (const [value, title, description] of SOURCES) {
    const button = el("button", { type: "button", className: "bookmark-source-choice", "data-source-mode": value,
      "aria-pressed": String(value === mode) }, el("strong", {}, title), el("span", {}, description));
    button.addEventListener("click", () => {
      for (const option of group.children) option.setAttribute("aria-pressed", String(option === button));
      onChange(value);
    });
    group.append(button);
  }
  return group;
}

function nativeBarHelp() {
  const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ Shift B" : "Ctrl+Shift+B";
  return el("details", { className: "bookmark-bar-help" },
    el("summary", {}, "Prefer more room in Chrome?"),
    el("p", {}, `If Chrome's bookmarks bar is visible, you can hide it with ${shortcut}. Use the same shortcut to show it again.`),
    el("p", {}, "You can also use Chrome’s menu → Bookmarks and lists → Show bookmarks bar. Syncly does not change or detect that setting."));
}

/** Same source operation for onboarding and Settings; no bookmark writes on view changes. */
export class BookmarkSourcesView {
  constructor({ useCases, toast }) { this.useCases = useCases; this.toast = toast; }
  render() {
    const root = el("div", { className: "bookmark-sources-settings" });
    this._fill(root).catch(() => root.append(el("p", { role: "alert" }, "Could not load bookmark preferences. Reopen Settings to retry.")));
    return root;
  }
  async _fill(root) {
    const settings = await this.useCases.getBookmarkLibrary.execute();
    let current = settings.mode;
    let saving = false;
    const status = el("p", { className: "bookmark-source-status", role: "status", "aria-live": "polite" });
    const undo = el("button", { type: "button", className: "bookmark-source-undo", hidden: true }, "Undo view change");
    let previous = null;
    const save = async mode => {
      if (saving) return;
      saving = true;
      for (const button of root.querySelectorAll("[data-source-mode]")) button.disabled = true;
      try {
        await this.useCases.setBookmarkSources.execute(mode);
        previous = current;
        current = mode;
        undo.hidden = false;
        status.textContent = "Sidebar updated. Your bookmarks have not moved.";
      } catch (error) {
        status.textContent = error.message || "Could not save this preference.";
      } finally {
        saving = false;
        for (const button of root.querySelectorAll("[data-source-mode]")) {
          button.disabled = false;
          button.setAttribute("aria-pressed", String(button.dataset.sourceMode === current));
        }
      }
    };
    // Undo restores legacy scope through the same explicit local preference path.
    undo.addEventListener("click", async () => {
      if (previous == null || saving) return;
      await save(previous);
      undo.hidden = true;
    });
    root.append(el("p", { className: "bookmark-source-description" }, "Choose what appears in your new-tab sidebar. All bookmarks and search always remain available."),
      choices(current, save), status, undo,
      el("p", { className: "bookmark-source-description" }, settings.layout === "managed"
        ? "New Syncly items live in your Syncly folder in Chrome bookmarks."
        : "Your existing folder layout is preserved. Switching views does not reorganize it."), nativeBarHelp());
    const location = el("button", { type: "button", className: "bookmark-source-undo" }, settings.completed ? "Bookmark location…" : "Finish bookmark setup…");
    location.addEventListener("click", async () => {
      await new BookmarkSetupView({ useCases: this.useCases, reconnect: true }).open();
      root.replaceChildren();
      await this._fill(root);
    });
    root.append(location);
  }
}

export class BookmarkSetupView {
  constructor({ useCases, reconnect = false }) { this.useCases = useCases; this.reconnect = reconnect; }
  async open() {
    let info;
    try { info = await this.useCases.getBookmarkLibrary.inspect(); }
    catch { info = { roots: [], bars: [] }; }
    let mode = info.bars.some(n => n.children?.length) ? "chrome" : "workspace";
    if (SOURCES.some(([value]) => value === info.settings?.mode)) mode = info.settings.mode;
    const error = el("p", { className: "bookmark-setup-error", role: "alert" });
    const rootSelect = el("select", { id: "bookmark-setup-location", className: "bookmark-setup-location" });
    const targets = [];
    for (const root of info.roots) {
      const context = root.syncing === true ? "Google account" : root.syncing === false ? "On this device" : "Sync status unavailable";
      for (const folder of root.children || []) {
        if (!folder.url && !folder.unmodifiable && folder.title === "Syncly" && folder.children?.some(n => !n.url && n.title === "Workspaces")) {
          targets.push({ value: `library:${folder.id}`, parentId: root.id, libraryId: folder.id, label: `Use existing Syncly · ${context}` });
        }
      }
      targets.push({ value: root.id, parentId: root.id, label: `Chrome bookmarks · ${context}` });
    }
    for (const target of targets) rootSelect.append(el("option", { value: target.value }, target.label));
    if (targets.length > 1) rootSelect.prepend(el("option", { value: "" }, "Choose where Syncly saves new items…"));
    rootSelect.value = targets.length === 1 ? targets[0].value : "";
    const continueButton = el("button", { type: "button", className: "bookmark-setup-continue" }, "Continue");
    const skip = el("button", { type: "button", className: "bookmark-setup-skip" }, this.reconnect ? "Cancel" : "Skip for now");
    const heading = el("h1", { id: "bookmark-setup-heading" }, this.reconnect ? "Choose your bookmark location" : "How would you like to start?");
    const panel = el("section", { className: "bookmark-setup-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": heading.id },
      el("span", { className: "bookmark-setup-eyebrow" }, "Welcome to Syncly"), heading,
      el("p", {}, "Your Chrome bookmarks stay yours. Choose a starting view; you can change it anytime."),
      choices(mode, value => { mode = value; }),
      el("label", { htmlFor: rootSelect.id, className: "bookmark-setup-location-label" }, "Where should Syncly organize new saves?"), rootSelect,
      el("p", { className: "bookmark-source-description" }, "New setups use a Syncly folder. Existing workspace layouts stay in place. Google sync requires bookmarks saved to your Google Account."),
      error, el("div", { className: "bookmark-setup-actions" }, skip, continueButton),
      el("p", { className: "bookmark-source-description" }, "Change this later in Settings → Bookmarks. Nothing from your bookmarks bar will be moved."));
    const overlay = el("div", { className: "bookmark-setup-overlay" }, panel);
    const previousFocus = document.activeElement;
    document.body.append(overlay);
    continueButton.focus();
    return new Promise(resolve => {
      let busy = false;
      const finish = async skipped => {
        if (busy) return;
        const target = targets.find(item => item.value === rootSelect.value);
        if (!skipped && !target) { error.textContent = "Choose a bookmark location, or skip setup for now."; rootSelect.focus(); return; }
        busy = true;
        continueButton.disabled = skip.disabled = true;
        try {
          if (!(skipped && this.reconnect)) await this.useCases.completeBookmarkSetup.execute({ mode, skip: skipped,
            reconnect: this.reconnect, parentId: target?.parentId, libraryId: target?.libraryId });
          overlay.remove();
          previousFocus?.focus?.();
          resolve();
        } catch (err) {
          error.textContent = err.message || "Could not finish setup. Your existing bookmarks have not moved.";
        } finally { busy = false; continueButton.disabled = skip.disabled = false; }
      };
      continueButton.addEventListener("click", () => finish(false));
      skip.addEventListener("click", () => finish(true));
      panel.addEventListener("keydown", event => {
        if (event.key === "Escape") { event.preventDefault(); finish(true); }
        if (event.key !== "Tab") return;
        const items = [...panel.querySelectorAll("button, select")].filter(n => !n.disabled);
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
      });
    });
  }
}
