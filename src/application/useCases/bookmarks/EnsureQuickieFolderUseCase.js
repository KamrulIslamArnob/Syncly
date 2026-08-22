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
        const data = await this.#storage.get(["quickieFolderId"]);
        if (data?.quickieFolderId) {
          quickieFolderId = String(data.quickieFolderId);
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

    // 3. If ID not valid or not found, look for existing "Quickie" folder by title
    if (!exists) {
      const found = this._findFolderByTitle(tree, "Quickie");
      if (found) {
        quickieFolderId = String(found.id);
        exists = true;
        if (this.#storage) {
          try { await this.#storage.set({ quickieFolderId }); } catch (_) {}
        }
      }
    }

    // 4. Create Quickie folder only if completely missing
    if (!exists) {
      const parentId = this._findOtherBookmarksId(tree) || "2";
      try {
        const created = await this.#bookmarks.create({
          parentId,
          title: "Quickie",
        });
        quickieFolderId = String(created.id);
        if (this.#storage) {
          try { await this.#storage.set({ quickieFolderId }); } catch (_) {}
        }
      } catch (err) {
        console.error("Failed to create Quickie folder:", err);
        return null;
      }
    }

    return quickieFolderId;
  }

  _findFolderById(nodes, id) {
    if (!Array.isArray(nodes) || !id) return false;
    for (const node of nodes) {
      if (String(node.id) === String(id) && (node.children || !node.url)) return true;
      if (node.children && this._findFolderById(node.children, id)) return true;
    }
    return false;
  }

  _findFolderByTitle(nodes, title) {
    if (!Array.isArray(nodes) || !title) return null;
    const targetTitle = String(title).trim().toLowerCase();
    const walk = (list) => {
      if (!Array.isArray(list)) return null;
      for (const n of list) {
        if ((n.children || !n.url) && String(n.title || "").trim().toLowerCase() === targetTitle) {
          return n;
        }
        if (n.children) {
          const res = walk(n.children);
          if (res) return res;
        }
      }
      return null;
    };
    const roots = nodes.length === 1 && nodes[0]?.children ? nodes[0].children : nodes;
    return walk(roots);
  }

  _findOtherBookmarksId(tree) {
    if (!Array.isArray(tree) || tree.length === 0) return "2";
    const roots = tree[0]?.children || tree;
    for (const root of roots) {
      if (/other bookmarks/i.test(root.title || "") || String(root.id) === "2") {
        return String(root.id);
      }
    }
    return roots[0]?.id ? String(roots[0].id) : "2";
  }
}
