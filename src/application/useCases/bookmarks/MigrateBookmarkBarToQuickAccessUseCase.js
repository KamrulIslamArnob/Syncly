/* ============================================================
   MigrateBookmarkBarToQuickAccessUseCase — Application use case

   Migrates unparented direct links on the Chrome Bookmark Bar
   into the default "Quick Access" category under the native
   "Shortcuts" folder.

   Executes only when the opt-in setting (moveBookmarksToQuickAccess)
   is enabled or when forced.
   ============================================================ */

export class MigrateBookmarkBarToQuickAccessUseCase {
  #storage;
  #bookmarks;
  #ensureShortcutsFolder;

  constructor({ storage, bookmarks, ensureShortcutsFolder } = {}) {
    this.#storage = storage || (typeof chrome !== "undefined" && chrome.storage ? chrome.storage.local : null);
    this.#bookmarks = bookmarks || (typeof chrome !== "undefined" && chrome.bookmarks ? chrome.bookmarks : null);
    this.#ensureShortcutsFolder = ensureShortcutsFolder || null;
  }

  /**
   * @param {object} [options]
   * @param {boolean} [options.force=false] bypass the moveBookmarksToQuickAccess check
   * @returns {Promise<{ success: boolean, count: number, folderId: string|null, reason?: string }>}
   */
  async execute({ force = false } = {}) {
    if (!this.#bookmarks) {
      return { success: false, count: 0, folderId: null, reason: "no_bookmarks_api" };
    }

    // 1. Check user configuration unless force is true
    if (this.#storage && !force) {
      try {
        const data = await this.#storage.get(["moveBookmarksToQuickAccess", "settings"]);
        const enabled = data?.moveBookmarksToQuickAccess === true || data?.settings?.moveBookmarksToQuickAccess === true;
        if (!enabled) {
          return { success: false, count: 0, folderId: null, reason: "disabled" };
        }
      } catch (err) {
        console.warn("Could not check moveBookmarksToQuickAccess setting:", err);
        return { success: false, count: 0, folderId: null, reason: "storage_error" };
      }
    }

    // 2. Ensure Shortcuts folder exists
    let shortcutsFolderId = null;
    if (this.#ensureShortcutsFolder) {
      try {
        shortcutsFolderId = await this.#ensureShortcutsFolder.execute();
      } catch (err) {
        console.warn("ensureShortcutsFolder error:", err);
      }
    }

    if (!shortcutsFolderId && this.#storage) {
      try {
        const data = await this.#storage.get(["shortcutsFolderId"]);
        if (data?.shortcutsFolderId) shortcutsFolderId = data.shortcutsFolderId;
      } catch {}
    }

    let tree = [];
    try {
      tree = await this.#bookmarks.getTree();
    } catch (err) {
      console.warn("Could not inspect bookmark tree:", err);
      return { success: false, count: 0, folderId: null, reason: "tree_error" };
    }

    if (!shortcutsFolderId) {
      const otherId = this._findOtherBookmarksId(tree) || "2";
      try {
        const existing = this._findFolderByTitle(tree, "Shortcuts");
        if (existing) {
          shortcutsFolderId = existing.id;
        } else {
          const created = await this.#bookmarks.create({ parentId: otherId, title: "Shortcuts" });
          shortcutsFolderId = created.id;
        }
        if (this.#storage) await this.#storage.set({ shortcutsFolderId });
        tree = await this.#bookmarks.getTree();
      } catch (err) {
        console.error("Failed to ensure Shortcuts folder:", err);
        return { success: false, count: 0, folderId: null, reason: "shortcuts_create_failed" };
      }
    }

    // 3. Ensure "Quick Access" subfolder under Shortcuts
    const shortcutsNode = this._findFolderById(tree, shortcutsFolderId);
    let quickAccessFolder = (shortcutsNode?.children || []).find(
      (c) => (c.children || !c.url) && (/^quick access$/i.test(c.title || "") || /^general$/i.test(c.title || ""))
    );
    let quickAccessFolderId = quickAccessFolder?.id || null;

    if (!quickAccessFolderId) {
      try {
        const created = await this.#bookmarks.create({ parentId: shortcutsFolderId, title: "Quick Access" });
        quickAccessFolderId = created.id;
        tree = await this.#bookmarks.getTree();
      } catch (err) {
        console.error("Failed to create Quick Access folder:", err);
        return { success: false, count: 0, folderId: null, reason: "quick_access_create_failed" };
      }
    }

    // 4. Find orphan bookmarks sitting directly on the Chrome Bookmark Bar
    const bookmarkBar = this._findBookmarkBarNode(tree);
    if (!bookmarkBar || !Array.isArray(bookmarkBar.children)) {
      return { success: true, count: 0, folderId: quickAccessFolderId };
    }

    const orphanBookmarks = bookmarkBar.children.filter((child) => child.url && child.id !== quickAccessFolderId);

    // 5. Move orphan bookmark bar links to the Quick Access shortcuts category
    let movedCount = 0;
    for (const bm of orphanBookmarks) {
      try {
        await this.#bookmarks.move(bm.id, { parentId: quickAccessFolderId });
        movedCount++;
      } catch (err) {
        console.warn(`Failed to move bookmark bar link ${bm.id}:`, err);
      }
    }

    if (this.#storage) {
      try {
        await this.#storage.set({ moveBookmarksToQuickAccessMigrated: true });
      } catch {}
    }

    return { success: true, count: movedCount, folderId: quickAccessFolderId };
  }

  _findFolderById(nodes, id) {
    if (!Array.isArray(nodes)) return null;
    for (const node of nodes) {
      if (node.id === id && (node.children || !node.url)) return node;
      if (node.children) {
        const found = this._findFolderById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  _findFolderByTitle(nodes, title) {
    if (!Array.isArray(nodes)) return null;
    for (const node of nodes) {
      if (node.title === title && (node.children || !node.url)) return node;
      if (node.children) {
        const found = this._findFolderByTitle(node.children, title);
        if (found) return found;
      }
    }
    return null;
  }

  _findOtherBookmarksId(tree) {
    if (!Array.isArray(tree) || tree.length === 0) return "2";
    const roots = tree[0]?.children || tree;
    for (const root of roots) {
      if (/other bookmarks/i.test(root.title || "") || root.id === "2") return root.id;
    }
    return roots[0]?.id || "2";
  }

  _findBookmarkBarNode(tree) {
    if (!Array.isArray(tree) || tree.length === 0) return null;
    const roots = tree[0]?.children || tree;
    for (const root of roots) {
      if (root.id === "1" || /bookmarks bar|favorites bar/i.test(root.title || "")) {
        return root;
      }
    }
    return roots[0] || null;
  }
}
