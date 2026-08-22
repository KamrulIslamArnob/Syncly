/* ============================================================
   AdoptNativeWorkspaceFolders — Application Use Case

   Native-sync fallback for workspaces.

   Workspace root folders are titled "w-{name}" under Other
   Bookmarks and ride Chrome's NATIVE bookmark sync (no quota,
   works even when chrome.storage.sync is throttled). This use
   case runs at startup and:

   1. MIGRATES existing workspaces whose root folder still has the
      pre-prefix plain title (exact name match only — folders the
      user renamed manually in chrome://bookmarks are untouched).
   2. ADOPTS "w-*" folders that arrived from another device but are
      not yet tracked locally, creating local workspace entities so
      the switcher shows them immediately.

   No chrome.* access here — the tree getter and folder updater are
   injected by the composition root.
   ============================================================ */

import { BookmarkGroup } from "../../../domain/entities/BookmarkGroup.js";
import { toFolderTitle, fromFolderTitle, isWorkspaceFolder } from "../../../domain/services/workspaceNaming.js";

export class AdoptNativeWorkspaceFolders {
  /**
   * @param {object} deps
   * @param {object} deps.groupRepository repository with findAll()/save()
   * @param {object} [deps.events] EventBus — emits bookmarkGroups:changed after adoption
   * @param {() => Promise<Array>} deps.getTree returns chrome.bookmarks.getTree() output
   * @param {(folderId: string, title: string) => Promise<void>} [deps.updateFolder] renames a native folder
   * @param {number} [deps.maxGroups] same cap as CreateBookmarkGroup (default 10)
   */
  constructor({ groupRepository, events = null, getTree, updateFolder = null, maxGroups = 10 }) {
    this.groupRepository = groupRepository;
    this.events = events;
    this.getTree = getTree;
    this.updateFolder = updateFolder;
    this.maxGroups = maxGroups;
  }

  async execute() {
    const result = { adopted: [], migrated: [], skipped: [] };

    let tree;
    try {
      tree = await this.getTree();
    } catch {
      return result;
    }
    if (!Array.isArray(tree) || tree.length === 0) return result;

    const parentId = this._findOtherBookmarksId(tree);
    const siblings = this._getChildrenOfParent(tree, parentId);

    const groups = await this.groupRepository.findAll().catch(() => []);
    const tracked = [...groups];

    // ── 1. Migration: prefix our own pre-convention folders ────────────────
    if (this.updateFolder && typeof this.updateFolder === "function") {
      for (const group of tracked) {
        const rootId = Array.isArray(group.folderIds) ? group.folderIds[0] : null;
        if (!rootId) continue;
        const node = this._findNodeById(siblings, rootId) || this._findNodeById(this._allNodes(tree), rootId);
        // Only rename folders WE created with the old plain-title convention.
        // Manually renamed folders (title !== group.name) are left alone.
        if (!node || node.url) continue;
        const title = String(node.title ?? "").trim();
        if (!title || title === group.name || title.toLowerCase() === group.name.toLowerCase()) {
          if (fromFolderTitle(title) === null) {
            try {
              await this.updateFolder(node.id, toFolderTitle(group.name));
              result.migrated.push(group.name);
              node.title = toFolderTitle(group.name); // keep in-memory tree coherent for adoption pass
            } catch {}
          }
        }
      }
    }

    // ── 2. Adoption: claim w-* folders not yet tracked locally ─────────────
    for (const node of siblings) {
      if (!isWorkspaceFolder(node)) continue;
      const stripped = fromFolderTitle(node.title);

      const alreadyTracked =
        tracked.some((g) => Array.isArray(g.folderIds) && g.folderIds.includes(node.id)) ||
        tracked.some((g) => String(g.name).trim().toLowerCase() === stripped.toLowerCase());

      if (alreadyTracked) continue;

      if (tracked.length >= this.maxGroups) {
        result.skipped.push({ name: stripped, reason: `workspace limit of ${this.maxGroups} reached` });
        continue;
      }

      try {
        // Validate BEFORE constructing — the entity constructor does not
        // enforce name rules; reserved names ("w-Quickie", etc.) must be
        // rejected here and recorded as skipped.
        const validatedName = BookmarkGroup.validateName(stripped);
        const entity = new BookmarkGroup({
          id: crypto.randomUUID(),
          name: validatedName,
          icon: "folder",
          folderIds: [node.id],
        });
        await this.groupRepository.save(entity);
        tracked.push(entity);
        result.adopted.push(stripped);
      } catch (err) {
        result.skipped.push({ name: stripped, reason: err?.message || "invalid" });
      }
    }

    if (result.adopted.length > 0 && this.events) {
      this.events.emit("bookmarkGroups:changed", undefined);
    }

    return result;
  }

  /* ── tree helpers ──────────────────────────────────────────────────────── */

  _unwrapRoots(tree) {
    return Array.isArray(tree) &&
      tree.length === 1 &&
      (tree[0].id === "0" || tree[0].title === "") &&
      Array.isArray(tree[0].children)
      ? tree[0].children
      : tree;
  }

  _findOtherBookmarksId(tree) {
    const roots = this._unwrapRoots(tree);
    for (const r of roots) {
      if (r.id === "2" || /other bookmarks|all bookmarks/i.test(r.title || "")) return r.id;
    }
    return roots[0]?.id || "2";
  }

  _getChildrenOfParent(tree, parentId) {
    const roots = this._unwrapRoots(tree);
    for (const r of roots) {
      if (r.id === parentId) return Array.isArray(r.children) ? r.children : [];
    }
    const find = (nodes) => {
      for (const n of nodes) {
        if (n.id === parentId) return Array.isArray(n.children) ? n.children : [];
        if (Array.isArray(n.children)) {
          const res = find(n.children);
          if (res.length > 0 || nodes.some((x) => x.id === parentId)) return res;
        }
      }
      return null;
    };
    const found = find(roots);
    return Array.isArray(found) ? found : [];
  }

  _allNodes(tree) {
    const out = [];
    const walk = (nodes) => {
      for (const n of nodes || []) {
        out.push(n);
        if (Array.isArray(n.children)) walk(n.children);
      }
    };
    walk(this._unwrapRoots(tree));
    return out;
  }

  _findNodeById(nodes, id) {
    for (const n of nodes || []) {
      if (n.id === id) return n;
      if (Array.isArray(n.children)) {
        const found = this._findNodeById(n.children, id);
        if (found) return found;
      }
    }
    return null;
  }
}
