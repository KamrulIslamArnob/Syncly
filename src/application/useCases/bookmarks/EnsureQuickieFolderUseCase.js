/* ============================================================
   EnsureQuickieFolderUseCase — Application use case

   Ensures that a native Chrome bookmark folder named "Quickie" exists
   under "Other Bookmarks" (native id "2"). Persists quickieFolderId
   in chrome.storage.local.
   ============================================================ */

export class EnsureQuickieFolderUseCase {
  #storage;
  #bookmarks;

  constructor({ storage, bookmarks } = {}) {
    this.#storage = storage || (typeof chrome !== "undefined" && chrome.storage ? chrome.storage.local : null);
    this.#bookmarks = bookmarks || (typeof chrome !== "undefined" && chrome.bookmarks ? chrome.bookmarks : null);
  }

  /**
   * @param {object} [options]
   * @param {Array} [options.tree] pre-fetched chrome.bookmarks.getTree() output
   *   (PERF-T01: lets callers share one tree fetch per reload). Must be fresh
   *   (same tick as fetch). An empty array is honored as-is — parent lookup
   *   then falls back to "2", matching the no-tree behavior.
   */
  async execute({ tree: providedTree } = {}) {
    if (!this.#bookmarks) return null;

    let quickieFolderId = null;

    // 1. Check stored quickieFolderId
    if (this.#storage) {
      try {
        const data = await this.#storage.get(["quickieFolderId", "quickieMigrated"]);
        if (data?.quickieFolderId) {
          quickieFolderId = data.quickieFolderId;
        }
      } catch (err) {
        console.warn("Could not read quickieFolderId from storage:", err);
      }
    }

    // 2. Verify folder exists in live Chrome bookmark tree
    let exists = false;
    let tree = Array.isArray(providedTree) ? providedTree : null;
    try {
      if (tree === null) {
        tree = await this.#bookmarks.getTree();
      }
      if (quickieFolderId) {
        exists = this._findFolderById(tree, quickieFolderId);
      }
    } catch (err) {
      console.warn("Could not inspect bookmark tree:", err);
    }

    // 3. Create Quickie folder if missing
    if (!exists) {
      const parentId = this._findOtherBookmarksId(tree) || "2";
      try {
        const created = await this.#bookmarks.create({
          parentId,
          title: "Quickie",
        });
        quickieFolderId = created.id;
        if (this.#storage) {
          await this.#storage.set({ quickieFolderId });
        }
      } catch (err) {
        console.error("Failed to create Quickie folder:", err);
        return null;
      }
      // Refresh tree after create
      try { tree = await this.#bookmarks.getTree(); } catch {}
    }

    // 3b. Deduplicate: Quickie is central, single under All Bookmarks → Other Bookmarks/Quickie
    // If multiple "Quickie" folders exist (per-workspace duplicates), merge into central
    try {
      const allQuickies = this._findAllByTitle(tree, "Quickie");
      if (allQuickies.length > 1) {
        // Choose central: stored id first, then one under Other Bookmarks, then most items
        let central = allQuickies.find((n) => n.id === quickieFolderId) || null;
        if (!central) {
          const otherId = this._findOtherBookmarksId(tree);
          central = allQuickies.find((n) => this._getParentId(tree, n.id) === otherId) || null;
        }
        if (!central) {
          central = allQuickies.sort((a, b) => (b.children?.length || 0) - (a.children?.length || 0))[0];
        }
        quickieFolderId = central.id;
        if (this.#storage) await this.#storage.set({ quickieFolderId });

        for (const dup of allQuickies) {
          if (dup.id === central.id) continue;
          // Move all children (bookmarks + subfolders) into central
          const children = dup.children ? [...dup.children] : [];
          for (const child of children) {
            try { await this.#bookmarks.move(child.id, { parentId: central.id }); } catch {}
          }
          // Remove empty duplicate folder
          try { await this.#bookmarks.removeTree(dup.id); } catch {}
        }
        // Refresh tree after dedupe
        try { tree = await this.#bookmarks.getTree(); } catch {}
      }
    } catch (err) {
      console.warn("Quickie dedupe failed:", err);
    }

    return quickieFolderId;
  }

  _findFolderById(nodes, id) {
    if (!Array.isArray(nodes)) return false;
    for (const node of nodes) {
      if (node.id === id && (node.children || !node.url)) return true;
      if (node.children && this._findFolderById(node.children, id)) return true;
    }
    return false;
  }

  _findOtherBookmarksId(tree) {
    if (!Array.isArray(tree) || tree.length === 0) return "2";
    const roots = tree[0]?.children || tree;
    for (const root of roots) {
      if (/other bookmarks/i.test(root.title || "") || root.id === "2") {
        return root.id;
      }
    }
    // Fall back to first root child's id or "2"
    return roots[0]?.id || "2";
  }

  _findAllByTitle(nodes, title) {
    const out = [];
    const walk = (list) => {
      if (!Array.isArray(list)) return;
      for (const n of list) {
        if (n.title === title && (n.children || !n.url)) out.push(n);
        if (n.children) walk(n.children);
      }
    };
    if (Array.isArray(nodes) && nodes.length === 1 && nodes[0]?.children) walk(nodes[0].children);
    else walk(nodes);
    return out;
  }

  _getParentId(tree, targetId) {
    let parentId = null;
    const walk = (nodes, parent) => {
      if (!Array.isArray(nodes)) return;
      for (const n of nodes) {
        if (n.id === targetId) { parentId = parent?.id || null; return; }
        if (n.children) walk(n.children, n);
      }
    };
    const roots = Array.isArray(tree) && tree.length === 1 && tree[0]?.children ? tree[0].children : tree;
    walk(roots, null);
    // Also check top-level roots parent
    if (!parentId) {
      const top = Array.isArray(tree) ? tree : [];
      for (const r of top) {
        if (r.id === targetId) return r.id;
        if (r.children) {
          for (const c of r.children) if (c.id === targetId) return r.id;
        }
      }
    }
    return parentId;
  }
}
