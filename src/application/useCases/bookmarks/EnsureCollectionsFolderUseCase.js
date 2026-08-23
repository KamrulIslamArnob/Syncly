/* ============================================================
   EnsureCollectionsFolderUseCase — Application use case

   Ensures that a native Chrome bookmark folder named "Collections" exists
   under "Other Bookmarks" (native id "2").

   Every Collection is backed by a native subfolder under "Collections",
   e.g.:
     Other Bookmarks
       └─ Collections
           ├─ 📁 Design Tools
           │    ├─ 🔖 Figma
           │    └─ 🔖 Spline
           └─ 📁 Reading List
                └─ 🔖 Article 1

   Auto-migrates existing virtual collections from storage into physical
   native folders and categorizes their bookmarks so they sync globally
   across all devices natively for free with zero server setup.
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

    // 5. Migrate any existing legacy collections from storage into physical subfolders
    if (collectionsFolderId && this.#storage) {
      try {
        await this._migrateStoredCollections(collectionsFolderId, tree);
      } catch (err) {
        console.warn("Collections native migration warning:", err);
      }
    }

    return collectionsFolderId;
  }

  async _migrateStoredCollections(collectionsFolderId, tree) {
    if (!this.#storage || !this.#bookmarks) return;
    const data = await this.#storage.get(["bookmarkCollections", "collectionsNativeMigrated"]);
    const rawColls = data?.bookmarkCollections;
    if (!rawColls || typeof rawColls !== "object") return;

    // Refresh tree if needed
    let liveTree = tree;
    try { liveTree = await this.#bookmarks.getTree(); } catch (_) {}

    const collectionsNode = this._findFolderNodeById(liveTree, collectionsFolderId);
    const existingSubfolders = (collectionsNode?.children || []).filter((c) => c.children || !c.url);
    const existingByName = new Map(existingSubfolders.map((f) => [String(f.title).toLowerCase(), f]));

    const collList = Array.isArray(rawColls) ? rawColls : Object.values(rawColls);
    const updatedStorageColls = typeof rawColls === "object" && !Array.isArray(rawColls) ? { ...rawColls } : {};

    // Collect all bookmarks in tree by ID and URL for fast lookup
    const allLeavesById = new Map();
    const allLeavesByUrl = new Map();
    const indexWalk = (nodes) => {
      if (!Array.isArray(nodes)) return;
      for (const n of nodes) {
        if (n.url) {
          allLeavesById.set(String(n.id), n);
          allLeavesByUrl.set(String(n.url).toLowerCase(), n);
        }
        if (n.children) indexWalk(n.children);
      }
    };
    indexWalk(liveTree);

    for (const coll of collList) {
      if (!coll || !coll.name) continue;
      const key = String(coll.name).toLowerCase();
      let subfolder = existingByName.get(key);

      // Create native subfolder if missing
      if (!subfolder) {
        try {
          subfolder = await this.#bookmarks.create({
            parentId: collectionsFolderId,
            title: coll.name,
          });
          existingByName.set(key, subfolder);
        } catch (err) {
          console.warn(`Could not create native collection folder for "${coll.name}":`, err);
          continue;
        }
      }

      // Populate native subfolder with member bookmarks if empty
      const existingChildUrls = new Set(
        (subfolder.children || []).map((c) => String(c.url || "").toLowerCase()).filter(Boolean)
      );

      const targetUrls = coll.bookmarkUrls || [];
      const targetIds = coll.bookmarkIds || [];

      // Collect items to copy
      const toAdd = [];
      for (const id of targetIds) {
        const found = allLeavesById.get(String(id));
        if (found && found.url && !existingChildUrls.has(String(found.url).toLowerCase())) {
          toAdd.push({ title: found.title || "Bookmark", url: found.url });
          existingChildUrls.add(String(found.url).toLowerCase());
        }
      }
      for (const url of targetUrls) {
        if (url && !existingChildUrls.has(String(url).toLowerCase())) {
          const found = allLeavesByUrl.get(String(url).toLowerCase());
          toAdd.push({ title: found?.title || url, url });
          existingChildUrls.add(String(url).toLowerCase());
        }
      }

      for (const item of toAdd) {
        try {
          await this.#bookmarks.create({
            parentId: subfolder.id,
            title: item.title,
            url: item.url,
          });
        } catch (_) {}
      }

      // Update storage collection entity with native folderId
      if (coll.id) {
        updatedStorageColls[coll.id] = {
          ...coll,
          folderId: subfolder.id,
        };
      }
    }

    // Also import any native subfolders in Collections folder that aren't yet in storage
    for (const sub of existingSubfolders) {
      const alreadyTracked = Object.values(updatedStorageColls).some(
        (c) => c.folderId === sub.id || String(c.name).toLowerCase() === String(sub.title).toLowerCase()
      );
      if (!alreadyTracked && sub.title) {
        const newId = `coll-${sub.id}`;
        const childBookmarks = (sub.children || []).filter((c) => c.url);
        updatedStorageColls[newId] = {
          id: newId,
          name: sub.title,
          folderId: sub.id,
          bookmarkIds: childBookmarks.map((b) => String(b.id)),
          bookmarkUrls: childBookmarks.map((b) => String(b.url)),
          workspaceId: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }
    }

    await this.#storage.set({
      bookmarkCollections: updatedStorageColls,
      collectionsNativeMigrated: true,
    });
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

  _findFolderNodeById(nodes, id) {
    if (!Array.isArray(nodes) || !id) return null;
    const targetId = String(id);
    for (const node of nodes) {
      if (String(node.id) === targetId && (node.children || !node.url)) return node;
      if (node.children) {
        const found = this._findFolderNodeById(node.children, targetId);
        if (found) return found;
      }
    }
    return null;
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

