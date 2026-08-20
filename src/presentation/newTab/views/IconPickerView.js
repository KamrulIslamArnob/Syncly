/* ============================================================
   IconPickerView — Icon selection component
   
   Provides a searchable grid of icons for bookmark group profiles.
   Uses the existing icon system from icons.js.
   ============================================================ */

import { el } from "../../shared/dom.js";
import { icon, ICON_NAMES } from "../../shared/icons.js";

const AVAILABLE_ICONS = ICON_NAMES;

export class IconPickerView {
  constructor({ selectedIcon = null } = {}) {
    this.selectedIcon = selectedIcon;
    this.searchQuery = "";
    this.root = null;
    this.searchInput = null;
    this.iconGrid = null;
    this.onSelect = null;
  }

  setOnSelect(callback) {
    this.onSelect = callback;
  }

  render() {
    if (this.root) {
      this.updateGrid();
      return this.root;
    }

    this.root = el("div", { className: "icon-picker" });

    // Search input
    const searchWrap = el("div", { className: "icon-picker-search" });
    this.searchInput = el("input", {
      type: "text",
      className: "icon-picker-input",
      placeholder: "Search icons...",
      autocomplete: "off",
    });
    this.searchInput.addEventListener("input", (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.updateGrid();
    });
    searchWrap.append(this.searchInput);
    this.root.append(searchWrap);

    // Icon grid
    this.iconGrid = el("div", { className: "icon-picker-grid" });
    this.root.append(this.iconGrid);

    this.updateGrid();
    return this.root;
  }

  updateGrid() {
    if (!this.iconGrid) return;

    this.iconGrid.replaceChildren();

    const filteredIcons = AVAILABLE_ICONS.filter(iconName =>
      iconName.toLowerCase().includes(this.searchQuery)
    );

    if (filteredIcons.length === 0) {
      const empty = el("div", { className: "icon-picker-empty" }, "No icons found");
      this.iconGrid.append(empty);
      return;
    }

    filteredIcons.forEach(iconName => {
      const btn = el("button", {
        type: "button",
        className: "icon-picker-btn",
        title: iconName,
        "data-icon": iconName,
        "aria-label": iconName,
        "aria-pressed": this.selectedIcon === iconName ? "true" : "false",
      });

      const iconSvg = icon(iconName, "icon-picker-icon");
      btn.append(iconSvg);

      btn.addEventListener("click", () => {
        this.selectedIcon = iconName;
        this.updateGrid();
        if (this.onSelect) this.onSelect(iconName);
      });

      this.iconGrid.append(btn);
    });
  }

  getSelected() {
    return this.selectedIcon;
  }

  setSelected(iconName) {
    this.selectedIcon = iconName;
    this.updateGrid();
  }

  reset() {
    this.selectedIcon = null;
    this.searchQuery = "";
    if (this.searchInput) this.searchInput.value = "";
    this.updateGrid();
  }
}
