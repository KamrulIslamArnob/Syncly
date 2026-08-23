/* ============================================================
   EnsureCollectionsFolderUseCase — Application use case

   Ensures that a native Chrome bookmark folder named "Collections" exists
   under "Other Bookmarks" (native id "2"). Persists collectionsFolderId
   in chrome.storage.local.

   Bookmarks created specifically inside a collection (e.g. from popup
   or new-bookmark dialog) live physically inside this folder, keeping
   the user's Bookmarks Bar clean. Bookmarks added to collections as
   references from other folders remain in their original folders.
   ============================================================ */

export class EnsureCollectionsFolderUseCase {
  #storage;
  #bookmarks;

  constructor({ storage, bookmarks } = {}) {
    this.#storage = storage || (typeof chrome !== "undefined" && chrome.storage ? chrome.storage.local : null);
    this.#bookmarks = bookmarks || (typeof chrome !== "undefined" && chrome.bookmarks ? chrome.bookmarks : null);
  }

  /**
   * @param {object} [options]
   * @param {Array} [options.tree] pre-fetched chrome.bookmarks.getTree() output
   */
  async execute({ tree: providedTree } = {}) {
    if (!this.#bookmarks) return null;

    let collectionsFolderId = null;

    // 1. Check stored collectionsFolderId
    if (this.#storage) {
      try {
        const data = await this.#storage.get(["collectionsFolderId"]);
        if (data?.collectionsFolderId) {
          collectionsFolderId = String(data.collectionsFolderId);
        }
      } catch (err) {
        console.warn("Could not read collectionsFolderId from storage:", err);
      }
    }

    // 2. Verify folder exists in live Chrome bookmark tree
    let exists = false;
    let tree = Array.isArray(providedTree) ? providedTree : null;
    try {
      if (tree === null) {
        tree = await this.#bookmarks.getTree();
      }
      if (collectionsFolderId) {
        exists = this._findFolderById(tree, collectionsFolderId);
      }
    } catch (err) {
      console.warn("Could not inspect bookmark tree:", err);
    }

    // 3. If ID not valid or not found, look for existing "Collections" folder by title
    if (!exists) {
      const found = this._findFolderByTitle(tree, "Collections");
      if (found) {
        collectionsFolderId = String(found.id);
        exists = true;
        if (this.#storage) {
          try { await this.#storage.set({ collectionsFolderId }); } catch (_) {}
        }
      }
    }

    // 4. Create Collections folder only if completely missing
    if (!exists) {
      const parentId = this._findOtherBookmarksId(tree) || "2";
      try {
        const created = await this.#bookmarks.create({
          parentId,
          title: "Collections",
        });
        collectionsFolderId = String(created.id);
        if (this.#storage) {
          try { await this.#storage.set({ collectionsFolderId }); } catch (_) {}
        }
      } catch (err) {
        console.error("Failed to create Collections folder:", err);
        return null;
      }
    }

    return collectionsFolderId;
  }

  _findFolderById(nodes, id) {
    if (!Array.isArray(nodes) || !id) return false;
    const targetId = String(id);
    for (const node of nodes) {
      if (String(node.id) === targetId && (node.children || !node.url)) return true;
      if (node.children && this._findFolderById(node.children, targetId)) return true;
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
