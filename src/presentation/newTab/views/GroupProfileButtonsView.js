/* ============================================================
   GroupProfileButtonsView — Workspace switcher

   A single trigger card at the top of the sidebar showing the active
   "workspace" (BookmarkGroup — a name + icon + set of native bookmark
   folder ids that scopes the Collections tree), with a dropdown
   listing every workspace plus "All Bookmarks" (no scoping) and
   "+ New workspace".
   ============================================================ */

import { el } from "../../shared/dom.js";
import { icon } from "../../shared/icons.js";

export class GroupProfileButtonsView {
  constructor({ useCases, events, toast, onCollapse } = {}) {
    this.useCases = useCases;
    this.events = events;
    this.toast = toast;
    this.onCollapse = onCollapse;

    this.root = null;
    this.groups = [];
    this.activeGroupId = null;
    this.onGroupSelect = null;
    this.onGroupCreate = null;

    this._menuOpen = false;
    this._outsideClickHandler = null;

    if (this.events) {
      this.events.on("settings:changed", () => this.refresh());
    }
  }

  setOnGroupSelect(callback) {
    this.onGroupSelect = callback;
  }

  setOnGroupCreate(callback) {
    this.onGroupCreate = callback;
  }

  async render() {
    if (this.root) {
      this.updateButtons();
      return this.root;
    }

    this.root = el("div", { className: "workspace-switcher" });
    await this.loadState();
    this.updateButtons();
    return this.root;
  }

  async loadState() {
    this.groups = await this.useCases.listBookmarkGroups.execute();
    this.activeGroupId = await this.useCases.setActiveGroup.getActive();
  }

  get activeGroup() {
    return this.groups.find((g) => g.id === this.activeGroupId) || null;
  }

  updateButtons() {
    if (!this.root) return;
    this.root.replaceChildren();
    this._menuOpen = false;

    const active = this.activeGroup;

    // Dotted Selector Box (Placeholder / Active trigger)
    const triggerLabel = active ? active.name : "Select Workspace";
    const trigger = el("button", {
      type: "button",
      className: "workspace-dotted-trigger" + (active ? " is-active-workspace" : " is-placeholder"),
      "aria-haspopup": "true",
      "aria-expanded": "false",
      title: active ? `Active Workspace: ${active.name}` : "Select Workspace",
    },
      el("div", { className: "workspace-dotted-left" },
        active
          ? el("span", { className: "workspace-dotted-icon" }, icon(active.icon || "folder"))
          : el("span", { className: "workspace-dotted-dot" }),
        el("span", { className: "workspace-dotted-text" }, triggerLabel)
      ),
      el("div", { className: "workspace-dotted-right" },
        active
          ? el("span", { className: "workspace-dotted-count" }, String(active.folderIds?.length || 0))
          : null,
        el("span", { className: "workspace-dotted-caret" }, icon("chevronDown"))
      )
    );

    const menu = this._renderMenu();
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      this._toggleMenu(menu, trigger);
    });

    this.root.append(trigger, menu);
  }

  _renderMenu() {
    const menu = el("div", { className: "workspace-menu", role: "menu" });
    const isAllActive = !this.activeGroupId;

    // 1. All Bookmarks / Default (No Filter)
    const allRow = el("button", {
      type: "button",
      className: "workspace-menu-row" + (isAllActive ? " is-active" : ""),
      role: "menuitem",
    },
      el("span", { className: "workspace-menu-icon" }, icon("layers")),
      el("span", { className: "workspace-menu-name" }, "All Bookmarks (Default)"),
      el("span", { className: "workspace-menu-count" }, "Global")
    );
    allRow.addEventListener("click", (e) => {
      e.stopPropagation();
      this.handleGroupSelect(null);
    });
    menu.append(allRow);

    // Divider line between default and custom workspaces
    if (this.groups.length > 0) {
      const divider = el("div", { className: "workspace-menu-divider" });
      menu.append(divider);
    }

    // 2. Custom Workspaces (e.g. atTech Agency, 3 Fold Agency)
    for (const group of this.groups) {
      const isActive = group.id === this.activeGroupId;
      const row = el("div", { className: "workspace-menu-row" + (isActive ? " is-active" : ""), role: "menuitem" },
        el("button", { type: "button", className: "workspace-menu-select" },
          el("span", { className: "workspace-menu-icon" }, icon(group.icon || "folder")),
          el("span", { className: "workspace-menu-name" }, group.name),
          el("span", { className: "workspace-menu-count" }, `${group.folderIds?.length || 0} folder${group.folderIds?.length === 1 ? "" : "s"}`)
        ),
        el("button", {
          type: "button",
          className: "workspace-menu-edit",
          title: `Edit ${group.name}`,
          "aria-label": `Edit ${group.name}`,
        }, "···")
      );
      row.querySelector(".workspace-menu-select").addEventListener("click", (e) => {
        e.stopPropagation();
        this.handleGroupSelect(group);
      });
      row.querySelector(".workspace-menu-edit").addEventListener("click", (e) => {
        e.stopPropagation();
        this._closeMenu();
        this.onGroupCreate?.(group);
      });
      menu.append(row);
    }

    // 3. Add new workspace
    if (this.groups.length < 10) {
      const addRow = el("button", { type: "button", className: "workspace-menu-row workspace-menu-add", role: "menuitem" },
        el("span", { className: "workspace-menu-icon" }, icon("plus")),
        el("span", { className: "workspace-menu-name" }, "New workspace...")
      );
      addRow.addEventListener("click", (e) => {
        e.stopPropagation();
        this._closeMenu();
        this.onGroupCreate?.(null);
      });
      menu.append(addRow);
    }

    return menu;
  }

  _toggleMenu(menu, trigger) {
    this._menuOpen = !this._menuOpen;
    menu.classList.toggle("is-open", this._menuOpen);
    trigger.setAttribute("aria-expanded", String(this._menuOpen));
    if (this._menuOpen) {
      this._outsideClickHandler = () => this._closeMenu();
      document.addEventListener("click", this._outsideClickHandler, { once: true });
    }
  }

  _closeMenu() {
    this._menuOpen = false;
    this.root?.querySelector(".workspace-menu")?.classList.remove("is-open");
    this.root?.querySelector(".workspace-trigger")?.setAttribute("aria-expanded", "false");
    if (this._outsideClickHandler) {
      document.removeEventListener("click", this._outsideClickHandler);
      this._outsideClickHandler = null;
    }
  }

  async handleGroupSelect(group) {
    const nextId = group ? group.id : null;
    if (this.activeGroupId === nextId) {
      this._closeMenu();
      return;
    }
    await this.useCases.setActiveGroup.execute(nextId);
    this.activeGroupId = nextId;
    this.updateButtons();

    this.onGroupSelect?.(this.activeGroupId);
    this.events.emit("bookmarkGroup:changed", this.activeGroupId);
  }

  async refresh() {
    await this.loadState();
    this.updateButtons();
  }

  destroy() {
    if (this._outsideClickHandler) document.removeEventListener("click", this._outsideClickHandler);
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
  }
}
