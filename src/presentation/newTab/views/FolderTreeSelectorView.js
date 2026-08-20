/* ============================================================
   FolderTreeSelectorView — Chrome bookmark folder tree selector
   
   Provides an expandable tree view of Chrome bookmark folders
   for selecting folders to include in a bookmark group.
   ============================================================ */

import { el } from "../../shared/dom.js";
import { icon } from "../../shared/icons.js";

function isFolder(node) {
  return node && typeof node === "object" && !(typeof node.url === "string" && node.url.length > 0);
}

export class FolderTreeSelectorView {
  constructor({ getTree, mode = "multiple", scopeRootFolderId = null } = {}) {
    this.getTree = typeof getTree === "function" ? getTree : () => Promise.resolve([]);
    this.mode = mode; // "multiple" (checkboxes) | "single" (radio buttons)
    this.scopeRootFolderId = scopeRootFolderId;
    this.selectedFolderIds = new Set();
    this.root = null;
    this.treeContainer = null;
    this.onSelectionChange = null;
  }

  setScopeRootFolderId(scopeRootFolderId) {
    this.scopeRootFolderId = scopeRootFolderId;
  }

  setOnSelectionChange(callback) {
    this.onSelectionChange = callback;
  }

  render() {
    if (this.root) {
      return this.root;
    }

    this.root = el("div", { className: "folder-tree-selector" });

    this.treeContainer = el("div", { className: "folder-tree-container" });
    this.root.append(this.treeContainer);

    this.loadTree();
    return this.root;
  }

  async loadTree() {
    if (!this.treeContainer) return;

    this.treeContainer.replaceChildren();
    this.treeContainer.append(el("div", { className: "folder-tree-loading" }, "Loading folders..."));

    try {
      let raw = await this.getTree();
      if (!Array.isArray(raw)) raw = [];

      // Unwrap synthetic Chrome root node (id === "0" or empty title)
      let roots = raw;
      if (raw.length === 1 && (raw[0].id === "0" || raw[0].title === "") && Array.isArray(raw[0].children)) {
        roots = raw[0].children;
      }

      this.treeContainer.replaceChildren();

      let folderRoots = roots.filter(isFolder);
      
      // If scoped to a specific workspace root folder, find and display only that folder tree
      if (this.scopeRootFolderId) {
        const findScoped = (nodes, id) => {
          for (const n of nodes) {
            if (isFolder(n) && n.id === id) return n;
            if (Array.isArray(n.children)) {
              const found = findScoped(n.children, id);
              if (found) return found;
            }
          }
          return null;
        };
        const scopedRoot = findScoped(roots, this.scopeRootFolderId);
        if (scopedRoot) {
          folderRoots = [scopedRoot];
        }
      }

      if (folderRoots.length === 0) {
        this.treeContainer.append(el("div", { className: "folder-tree-empty" }, "No folders found"));
        return;
      }

      // Render each root folder
      folderRoots.forEach(rootFolder => {
        const folderNode = this.renderFolderNode(rootFolder, 0);
        if (folderNode) this.treeContainer.append(folderNode);
      });
    } catch (error) {
      console.error("[FolderTreeSelectorView] Failed to load folders:", error);
      this.treeContainer.replaceChildren();
      this.treeContainer.append(el("div", { className: "folder-tree-error" }, "Failed to load folders"));
    }
  }

  renderFolderNode(folder, depth) {
    if (!isFolder(folder)) return null;

    const node = el("div", { 
      className: "folder-tree-node",
      "data-folder-id": folder.id,
      "data-depth": depth
    });

    const isSelected = this.selectedFolderIds.has(folder.id);
    const row = el("div", { className: "folder-tree-row" + (isSelected ? " is-selected" : "") });

    // Indentation
    if (depth > 0) {
      const indent = el("div", { 
        className: "folder-tree-indent",
        style: `width: ${depth * 14}px`
      });
      row.append(indent);
    }

    // Child folders
    const childFolders = Array.isArray(folder.children) ? folder.children.filter(isFolder) : [];
    const hasChildren = childFolders.length > 0;

    // Expand/collapse toggle
    const toggle = el("button", {
      type: "button",
      className: "folder-tree-toggle",
      "aria-expanded": "false",
      disabled: !hasChildren
    });

    if (hasChildren) {
      toggle.append(icon("chevronRight"));
      toggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isExpanded = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!isExpanded));
        toggle.replaceChildren(isExpanded ? icon("chevronRight") : icon("chevronDown"));
        
        const childrenContainer = node.querySelector(".folder-tree-children");
        if (childrenContainer) {
          childrenContainer.style.display = isExpanded ? "none" : "flex";
        }
      });
    }
    row.append(toggle);

    // Checkbox or Radio based on mode
    const inputType = this.mode === "single" ? "radio" : "checkbox";
    const inputName = this.mode === "single" ? "folder-tree-radio-group" : undefined;
    const inputId = `folder-input-${folder.id || Math.random().toString(36).slice(2)}`;
    const inputAttributes = {
      type: inputType,
      className: this.mode === "single" ? "folder-tree-radio" : "folder-tree-checkbox",
      id: inputId,
      "data-folder-id": folder.id,
      checked: isSelected,
    };
    if (inputName) inputAttributes.name = inputName;

    const input = el("input", inputAttributes);
    input.addEventListener("change", (e) => {
      if (this.mode === "single") {
        if (e.target.checked) {
          this.selectedFolderIds = new Set([folder.id]);
          this.treeContainer?.querySelectorAll(".folder-tree-row.is-selected").forEach(r => r.classList.remove("is-selected"));
          row.classList.add("is-selected");
        }
      } else {
        if (e.target.checked) {
          this.selectedFolderIds.add(folder.id);
          row.classList.add("is-selected");
        } else {
          this.selectedFolderIds.delete(folder.id);
          row.classList.remove("is-selected");
        }
      }
      if (this.onSelectionChange) {
        this.onSelectionChange([...this.selectedFolderIds]);
      }
    });
    row.append(input);

    // Folder icon
    const folderIcon = el("span", { className: "folder-tree-icon" }, icon("folder"));
    row.append(folderIcon);

    // Folder label
    const label = el("label", { 
      className: "folder-tree-label",
      htmlFor: inputId,
    }, folder.title || "Folder");
    row.append(label);

    // Clicking row (outside toggle) selects the input
    row.addEventListener("click", (e) => {
      if (e.target === toggle || toggle.contains(e.target) || e.target === input || e.target === label) return;
      if (this.mode === "single") {
        input.checked = true;
      } else {
        input.checked = !input.checked;
      }
      input.dispatchEvent(new Event("change"));
    });

    node.append(row);

    // Children container
    if (hasChildren) {
      const childrenContainer = el("div", { 
        className: "folder-tree-children",
        style: "display: none"
      });
      
      childFolders.forEach(child => {
        const childNode = this.renderFolderNode(child, depth + 1);
        if (childNode) childrenContainer.append(childNode);
      });

      node.append(childrenContainer);
    }

    return node;
  }

  getSelectedFolderIds() {
    return [...this.selectedFolderIds];
  }

  getSelectedFolderId() {
    return this.selectedFolderIds.values().next().value || null;
  }

  setSelectedFolderIds(ids) {
    this.selectedFolderIds = new Set(ids);
    if (this.treeContainer) {
      const inputs = this.treeContainer.querySelectorAll(".folder-tree-checkbox, .folder-tree-radio");
      inputs.forEach(input => {
        const isChecked = this.selectedFolderIds.has(input.dataset.folderId);
        input.checked = isChecked;
        const row = input.closest(".folder-tree-row");
        if (row) {
          row.classList.toggle("is-selected", isChecked);
        }
        if (isChecked) {
          // Expand all ancestor container elements so the selected folder is visible
          let parent = input.closest(".folder-tree-children");
          while (parent) {
            parent.style.display = "flex";
            const parentNode = parent.closest(".folder-tree-node");
            const toggle = parentNode?.querySelector(":scope > .folder-tree-row > .folder-tree-toggle");
            if (toggle) {
              toggle.setAttribute("aria-expanded", "true");
              toggle.replaceChildren(icon("chevronDown"));
            }
            parent = parentNode?.parentElement?.closest(".folder-tree-children");
          }
        }
      });
    }
  }

  reset() {
    this.selectedFolderIds.clear();
    if (this.treeContainer) {
      const inputs = this.treeContainer.querySelectorAll(".folder-tree-checkbox, .folder-tree-radio");
      inputs.forEach(input => { input.checked = false; });
      this.treeContainer.querySelectorAll(".folder-tree-row.is-selected").forEach(r => r.classList.remove("is-selected"));
    }
  }
}
