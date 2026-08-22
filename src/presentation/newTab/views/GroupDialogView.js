/* ============================================================
   GroupDialogView — Create/Edit bookmark group dialog
   
   Modal dialog for creating or editing bookmark workspaces with
   name and icon. On creation, automatically creates a dedicated
   folder under Chrome's "Other Bookmarks" / Root.
   ============================================================ */

import { el } from "../../shared/dom.js";
import { icon } from "../../shared/icons.js";
import { IconPickerView } from "./IconPickerView.js";
import { ConfirmDialogView } from "./ConfirmDialogView.js";
import { BookmarkGroup } from "../../../domain/entities/BookmarkGroup.js";
import { WORKSPACE_PREFIX, toFolderTitle, fromFolderTitle, isWorkspaceFolder } from "../../../domain/services/workspaceNaming.js";

export class GroupDialogView {
  constructor({ useCases, getTree, toast } = {}) {
    this.useCases = useCases;
    this.getTree = getTree || (() => (typeof chrome !== "undefined" && chrome.bookmarks?.getTree ? chrome.bookmarks.getTree() : Promise.resolve([])));
    this.toast = toast;
    
    this.root = null;
    this.overlay = null;
    this.dialog = null;
    
    this.iconPicker = new IconPickerView();
    this.confirmDialog = new ConfirmDialogView({ toast: this.toast });
    
    this.nameInput = null;
    this.isEditMode = false;
    this.editGroup = null;
    this.onSave = null;
    this.onDelete = null;
    this._saving = false;
  }

  openForCreate() {
    this.isEditMode = false;
    this.editGroup = null;
    this.render();
    if (this.nameInput) this.nameInput.value = "";
    this.iconPicker.setSelected("folder");
    this.show();
  }

  openForEdit(group) {
    this.isEditMode = true;
    this.editGroup = group;
    this.render();
    
    // Pre-fill data
    if (this.nameInput) this.nameInput.value = group.name;
    this.iconPicker.setSelected(group.icon || "folder");
    
    this.show();
  }

  render() {
    if (this.root) {
      this.root.remove();
    }

    // Overlay
    this.overlay = el("div", { className: "overlay" });
    
    // Dialog
    this.dialog = el("div", { className: "dialog group-dialog" });
    
    // Header
    const header = el("div", { className: "group-dialog-header" });
    const title = el("h2", {}, this.isEditMode ? "Edit Workspace" : "Create Workspace");
    const closeBtn = el("button", { 
      type: "button", 
      className: "group-dialog-close",
      "aria-label": "Close"
    }, icon("x"));
    closeBtn.addEventListener("click", () => this.hide());
    header.append(title, closeBtn);
    this.dialog.append(header);

    // Form
    const form = el("form", { className: "group-dialog-form" });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleSave();
    });

    // Name field
    const nameField = el("div", { className: "field" });
    const nameLabel = el("label", {}, "Workspace Name");
    this.nameInput = el("input", {
      type: "text",
      placeholder: "e.g., Marketing, Personal, Agency A",
      required: true,
      maxLength: 50,
      autofocus: true,
      autocomplete: "off",
    });
    nameField.append(nameLabel, this.nameInput);
    form.append(nameField);

    // Icon picker
    const iconField = el("div", { className: "field" });
    const iconLabel = el("label", {}, "Icon");
    iconField.append(iconLabel, this.iconPicker.render());
    form.append(iconField);

    // Actions: Delete on the left, Cancel & Save on the right
    const actions = el("div", { className: "dialog-actions", style: "display: flex; justify-content: space-between; align-items: center; width: 100%;" });
    
    const leftActions = el("div", { className: "dialog-actions-left" });
    if (this.isEditMode) {
      const deleteBtn = el("button", { 
        type: "button", 
        className: "btn btn-red" 
      }, "Delete");
      deleteBtn.addEventListener("click", () => this.handleDelete());
      leftActions.append(deleteBtn);
    }
    
    const rightActions = el("div", { className: "dialog-actions-right", style: "display: flex; gap: 8px; margin-left: auto;" });
    const cancelBtn = el("button", { 
      type: "button", 
      className: "btn" 
    }, "Cancel");
    cancelBtn.addEventListener("click", () => this.hide());
    
    const saveBtn = el("button", { 
      type: "submit", 
      className: "btn btn-primary" 
    }, this.isEditMode ? "Save Changes" : "Create Workspace");
    this.saveBtn = saveBtn;
    
    rightActions.append(cancelBtn, saveBtn);
    actions.append(leftActions, rightActions);
    
    form.append(actions);
    this.dialog.append(form);

    this.overlay.append(this.dialog);
    this.root = this.overlay;

    // Close on overlay click
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.hide();
    });

    // Close on Escape
    this.escHandler = (e) => {
      if (e.key === "Escape") this.hide();
    };
    document.addEventListener("keydown", this.escHandler);
  }

  async _resolveTargetParentId() {
    try {
      const raw = await this.getTree();
      const topChildren = (raw.length === 1 && (raw[0].id === "0" || raw[0].title === "") && raw[0].children)
        ? raw[0].children
        : raw;
      // Prefer "Other Bookmarks" (id "2") to keep bookmarks bar uncluttered, or root[1] / root[0]
      const otherBookmarks = topChildren.find(
        (r) => r.id === "2" || /other bookmarks|all bookmarks/i.test(r.title)
      );
      if (otherBookmarks?.id) return otherBookmarks.id;
      return topChildren[0]?.id || "2";
    } catch {
      return "2";
    }
  }

  async handleSave() {
    if (this._saving) return;
    const name = this.nameInput.value.trim();
    const iconName = this.iconPicker.getSelected() || "folder";

    if (!name) {
      this.toast?.show("Please enter a workspace name", { error: true });
      return;
    }

    // Validate before any side-effect (prevents orphan folder on invalid icon)
    try {
      BookmarkGroup.validateName(name);
      BookmarkGroup.validateIcon(iconName);
    } catch (e) {
      this.toast?.show(e.message, { error: true });
      return;
    }

    // Auto-sync: if workspace with same name (case-insensitive) already exists locally, switch to it instead of duplicating
    // This handles "3fold Agency" vs "3Fold Agency" and the case where Chrome sync already pulled the workspace but UI hasn't refreshed
    try {
      if (!this.isEditMode && this.useCases?.listBookmarkGroups && this.useCases?.setActiveGroup) {
        const existing = await this.useCases.listBookmarkGroups.execute();
        const match = existing.find((g) => g.name.trim().toLowerCase() === name.trim().toLowerCase());
        if (match) {
          // Ensure its folder still exists locally (remap if needed), then activate
          if (match.folderIds?.[0] && typeof chrome !== "undefined" && chrome.bookmarks) {
            try {
              const tree = await this.getTree().catch(() => []);
              const siblings = this._getChildrenOfParent(tree, await this._resolveTargetParentId());
              const folderExists = siblings.some((n) => n.id === match.folderIds[0]);
              if (!folderExists) {
                // Try find by title and remap — prefer the "w-" convention, then plain
                const wanted = name.trim().toLowerCase();
                const byTitle = siblings.find(
                  (n) => isWorkspaceFolder(n) && fromFolderTitle(n.title).toLowerCase() === wanted
                ) || siblings.find((n) => (n.title || "").trim().toLowerCase() === wanted && !n.url);
                if (byTitle) {
                  try { await this.useCases.updateBookmarkGroup.execute({ id: match.id, folderIds: [byTitle.id] }); } catch {}
                }
              }
            } catch {}
          }
          await this.useCases.setActiveGroup.execute(match.id);
          this.toast?.show(`Switched to "${match.name}" — already exists`);
          if (this.onSave) this.onSave();
          this.hide();
          return;
        }
      }
    } catch (e) {
      // If auto-switch fails, fall through to normal create path
      if (e.message && e.message.includes("Switched to")) throw e;
    }

    this._saving = true;
    if (this.saveBtn) this.saveBtn.disabled = true;

    try {
      if (this.isEditMode && this.editGroup) {
        // Update workspace name & icon
        await this.useCases.updateBookmarkGroup.execute({
          id: this.editGroup.id,
          name,
          icon: iconName,
        });

        // Optionally rename the root folder in Chrome if it exists —
        // the "w-" prefixed title propagates to all devices via native sync
        const rootFolderId = this.editGroup.folderIds?.[0];
        if (rootFolderId && typeof chrome !== "undefined" && chrome.bookmarks?.update) {
          try {
            await chrome.bookmarks.update(rootFolderId, { title: toFolderTitle(name) });
          } catch {
            // Non-fatal if native folder rename fails
          }
        }

        this.toast?.show("Workspace updated");
      } else {
        // 1. Auto-sync: if a workspace root folder for this name already exists
        //    (synced natively from another browser via the "w-" convention), reuse it.
        // Reserved names already rejected by validateName, so safe to reuse
        let folderId = null;
        let createdFolderId = null;
        let parentId = null;
        if (typeof chrome !== "undefined" && chrome.bookmarks?.create) {
          parentId = await this._resolveTargetParentId();
          const tree = await this.getTree().catch(() => []);
          const siblings = this._getChildrenOfParent(tree, parentId);
          const wanted = name.trim().toLowerCase();
          const existingFolder = siblings.find(
            (n) => isWorkspaceFolder(n) && fromFolderTitle(n.title).toLowerCase() === wanted
          );
          if (existingFolder) {
            // Auto-sync: reuse existing native workspace folder (from other browser's sync)
            folderId = existingFolder.id;
            createdFolderId = null;
          } else {
            const newFolder = await chrome.bookmarks.create({
              parentId,
              title: toFolderTitle(name),
            });
            folderId = newFolder.id;
            createdFolderId = newFolder.id;
          }
        }

        const folderIds = folderId ? [folderId] : [];

        // 2. Save the workspace entity — if this fails, rollback folder
        let newGroup;
        try {
          newGroup = await this.useCases.createBookmarkGroup.execute({
            name,
            icon: iconName,
            folderIds,
          });
        } catch (err) {
          // Rollback orphan folder
          if (createdFolderId && typeof chrome !== "undefined" && chrome.bookmarks?.removeTree) {
            try { await chrome.bookmarks.removeTree(createdFolderId); } catch {}
          }
          throw err;
        }

        // 3. Set the new workspace as active
        if (this.useCases?.setActiveGroup) {
          await this.useCases.setActiveGroup.execute(newGroup.id);
        }

        this.toast?.show(`Workspace "${name}" created`);
      }

      if (this.onSave) this.onSave();
      this.hide();
    } catch (error) {
      this.toast?.show(error.message, { error: true });
    } finally {
      this._saving = false;
      if (this.saveBtn) this.saveBtn.disabled = false;
    }
  }

  _getChildrenOfParent(tree, parentId) {
    if (!Array.isArray(tree)) return [];
    const roots = tree.length === 1 && (tree[0].id === "0" || tree[0].title === "") && tree[0].children ? tree[0].children : tree;
    const find = (nodes) => {
      for (const n of nodes) {
        if (n.id === parentId) return n.children || [];
        if (n.children) {
          const res = find(n.children);
          if (res) return res;
        }
      }
      return null;
    };
    // Check if parent is a root folder itself
    for (const r of roots) {
      if (r.id === parentId) return r.children || [];
    }
    return find(roots) || [];
  }

  _findNodeById(nodes, id) {
    if (!Array.isArray(nodes)) return null;
    const roots = nodes.length === 1 && (nodes[0].id === "0" || nodes[0].title === "") && nodes[0].children ? nodes[0].children : nodes;
    const walk = (list) => {
      for (const n of list) {
        if (n?.id === id) return n;
        if (Array.isArray(n?.children)) {
          const found = walk(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    return walk(roots);
  }

  async handleDelete() {
    if (!this.editGroup?.id) return;

    const targetGroup = this.editGroup;
    // Detect whether the workspace's root folder is DEDICATED to it (carries
    // the "w-" prefix we create). Dedicated roots are removed natively so the
    // deletion syncs everywhere; referenced external folders are never touched.
    let dedicatedRootId = null;
    try {
      const rootFolderId = targetGroup.folderIds?.[0];
      if (rootFolderId && typeof chrome !== "undefined" && chrome.bookmarks) {
        const tree = await this.getTree().catch(() => []);
        const node = this._findNodeById(tree, rootFolderId);
        if (node && !node.url && String(node.title ?? "").startsWith(WORKSPACE_PREFIX)) {
          dedicatedRootId = node.id;
        }
      }
    } catch {}

    this.confirmDialog.open({
      title: "Delete Workspace",
      message: `Delete workspace "${targetGroup.name}"? Its workspace folder and the bookmarks inside it will be removed on ALL synced devices. Folders you linked into this workspace from elsewhere are not affected.`,
      confirmLabel: "Delete Workspace",
      isDanger: true,
      onConfirm: async () => {
        try {
          await this.useCases.deleteBookmarkGroup.execute(targetGroup.id);
          if (dedicatedRootId && typeof chrome !== "undefined" && chrome.bookmarks?.removeTree) {
            try { await chrome.bookmarks.removeTree(dedicatedRootId); } catch {}
          }
          this.toast?.show("Workspace deleted");
          if (this.onDelete) this.onDelete();
          this.hide();
        } catch (error) {
          this.toast?.show(error.message, { error: true });
        }
      }
    });
  }

  show() {
    if (!this.root) this.render();
    document.body.append(this.root);
    // Trigger reflow for animation
    this.root.offsetHeight;
    this.overlay.classList.add("is-open");
  }

  hide() {
    if (this.overlay) {
      this.overlay.classList.remove("is-open");
      setTimeout(() => {
        if (this.root) this.root.remove();
      }, 180);
    }
    document.removeEventListener("keydown", this.escHandler);
  }

  destroy() {
    this.hide();
    this.root = null;
    this.overlay = null;
    this.dialog = null;
  }
}
