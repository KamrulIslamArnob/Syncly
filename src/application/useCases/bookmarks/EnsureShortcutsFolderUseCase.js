/* ============================================================
   EnsureShortcutsFolderUseCase — native folder for shortcuts

   Ensures a native Chrome bookmark folder named "Shortcuts" exists
   under "Other Bookmarks" (id "2"). This folder becomes the single
   source of truth for shortcuts:

     Other Bookmarks
       └─ Shortcuts
           ├─ Category A (subfolder)
           │   ├─ Bookmark 1
           │   └─ Bookmark 2
           └─ Category B

   - Category = subfolder inside Shortcuts
   - Shortcut = bookmark inside a Category folder

   This replaces the legacy Category/Bookmark domain entities
   (chrome.storage.local keys `categories`/`bookmarks`). On first run
   it migrates existing legacy data into the native folder structure.
   ============================================================ */

export class EnsureShortcutsFolderUseCase {
  #storage;
  #bookmarks;

  constructor({ storage, bookmarks } = {}) {
    this.#storage = storage || (typeof chrome !== "undefined" && chrome.storage ? chrome.storage.local : null);
    this.#bookmarks = bookmarks || (typeof chrome !== "undefined" && chrome.bookmarks ? chrome.bookmarks : null);
  }

  async execute() {
    if (!this.#bookmarks) return null;

    let shortcutsFolderId = null;

    // 1. Check stored id
    if (this.#storage) {
      try {
        const data = await this.#storage.get(["shortcutsFolderId"]);
        if (data?.shortcutsFolderId) shortcutsFolderId = data.shortcutsFolderId;
      } catch (err) {
        console.warn("Could not read shortcutsFolderId:", err);
      }
    }

    // 2. Verify exists in live tree
    let tree = [];
    try {
      tree = await this.#bookmarks.getTree();
      if (shortcutsFolderId) {
        const exists = this._findFolderById(tree, shortcutsFolderId);
        if (!exists) shortcutsFolderId = null;
      }
    } catch (err) {
      console.warn("Could not inspect bookmark tree:", err);
    }

    // 3. Also try find by title under Other Bookmarks if id missing
    if (!shortcutsFolderId) {
      try {
        const found = this._findFolderByTitle(tree, "Shortcuts");
        if (found) shortcutsFolderId = found.id;
      } catch {}
    }

    // 4. Create if still missing
    if (!shortcutsFolderId) {
      const parentId = this._findOtherBookmarksId(tree) || "2";
      try {
        const created = await this.#bookmarks.create({
          parentId,
          title: "Shortcuts",
        });
        shortcutsFolderId = created.id;
        if (this.#storage) {
          await this.#storage.set({ shortcutsFolderId });
        }
      } catch (err) {
        console.error("Failed to create Shortcuts folder:", err);
        return null;
      }
      // Refresh tree after create
      try {
        tree = await this.#bookmarks.getTree();
      } catch {}
    }

    // 5. One-time migration from legacy storage
    if (this.#storage && shortcutsFolderId) {
      try {
        const mig = await this.#storage.get(["shortcutsMigrated"]);
        if (!mig?.shortcutsMigrated) {
          await this._migrateLegacy(tree, shortcutsFolderId);
          await this.#storage.set({ shortcutsMigrated: true });
        }
      } catch (err) {
        console.warn("Migration error for Shortcuts:", err);
      }
    }

    // 6. One-time import of OmniTab backup (just for this transition) — "just for once"
    // Imports 12 categories + 73 bookmarks into native Shortcuts folder, skipping existing names
    if (this.#storage && shortcutsFolderId) {
      try {
        const flag = await this.#storage.get(["omniboxImported"]);
        if (!flag?.omniboxImported) {
          const imported = await this._importOmniTabBackup(shortcutsFolderId);
          if (imported) await this.#storage.set({ omniboxImported: true });
        }
      } catch {}
    }

    return shortcutsFolderId;
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

  async _migrateLegacy(tree, shortcutsFolderId) {
    if (!this.#storage || !this.#bookmarks) return;
    let legacyCategories = [];
    let legacyBookmarks = [];
    try {
      const data = await this.#storage.get(["categories", "bookmarks"]);
      if (Array.isArray(data.categories)) legacyCategories = data.categories;
      if (Array.isArray(data.bookmarks)) legacyBookmarks = data.bookmarks;
    } catch { return; }

    if (legacyCategories.length === 0 && legacyBookmarks.length === 0) return;

    // Check if Shortcuts already has children (already migrated)
    const shortcutsNode = this._findFolderById(tree, shortcutsFolderId);
    if (shortcutsNode && Array.isArray(shortcutsNode.children) && shortcutsNode.children.length > 0) {
      return; // already has content, skip
    }

    // Create subfolders for each category, then bookmarks inside
    for (const cat of legacyCategories) {
      const catName = cat.name || cat.title || "Untitled";
      const catIdLegacy = cat.id;
      let subFolderId = null;
      try {
        const created = await this.#bookmarks.create({
          parentId: shortcutsFolderId,
          title: catName,
        });
        subFolderId = created.id;
      } catch (err) {
        console.warn(`Failed to migrate category ${catName}:`, err);
        continue;
      }
      // Migrate bookmarks for this category
      const bms = legacyBookmarks.filter((b) => (b.categoryId === catIdLegacy || b.categoryId?.value === catIdLegacy));
      for (const bm of bms) {
        const title = bm.title || "Bookmark";
        const url = bm.url?.href || bm.url || "";
        if (!url) continue;
        try {
          // Validate url via same safe check as before - only http(s)
          const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
          if (!/^https?:$/.test(parsed.protocol)) continue;
          await this.#bookmarks.create({
            parentId: subFolderId,
            title,
            url: parsed.href,
          });
        } catch (err) {
          console.warn(`Failed to migrate bookmark ${title}:`, err);
        }
      }
    }

    // Also handle bookmarks without category (put into General)
    const unassigned = legacyBookmarks.filter((b) => !b.categoryId);
    if (unassigned.length > 0) {
      let generalId = null;
      try {
        const existing = (shortcutsNode?.children || []).find((c) => c.title === "General");
        if (existing) generalId = existing.id;
        else {
          const created = await this.#bookmarks.create({ parentId: shortcutsFolderId, title: "General" });
          generalId = created.id;
        }
      } catch {}
      if (generalId) {
        for (const bm of unassigned) {
          const title = bm.title || "Bookmark";
          const url = bm.url?.href || bm.url || "";
          if (!url) continue;
          try {
            const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
            if (!/^https?:$/.test(parsed.protocol)) continue;
            await this.#bookmarks.create({ parentId: generalId, title, url: parsed.href });
          } catch {}
        }
      }
    }
  }

  async _importOmniTabBackup(shortcutsFolderId) {
    let data = null;
    // Try fetch from extension public folder (works in newTab page)
    try {
      const url = (typeof chrome !== "undefined" && chrome.runtime?.getURL) ? chrome.runtime.getURL("public/omnibox-backup.json") : "public/omnibox-backup.json";
      const res = await fetch(url).catch(() => null);
      if (res && res.ok) data = await res.json().catch(() => null);
    } catch {}
    // Fallback: try relative fetch (for tests or file://)
    if (!data) {
      try {
        const res = await fetch("public/omnibox-backup.json").catch(() => null);
        if (res && res.ok) data = await res.json().catch(() => null);
      } catch {}
    }
    if (!data || !Array.isArray(data.bookmarks) || !Array.isArray(data.categories)) return false;

    const cats = [...data.categories].sort((a, b) => (a.order || 0) - (b.order || 0));
    const bms = [...data.bookmarks].sort((a, b) => (a.order || 0) - (b.order || 0));

    // Check existing subfolders to avoid duplicates
    const tree = await this.#bookmarks.getTree().catch(() => []);
    const shortcutsNode = this._findFolderById(tree, shortcutsFolderId);
    const existingNames = new Set((shortcutsNode?.children || []).filter((c) => !c.url).map((c) => c.title.trim().toLowerCase()));

    for (const cat of cats) {
      const catName = (cat.name || "Untitled").trim();
      if (existingNames.has(catName.toLowerCase())) continue;
      let subId = null;
      try {
        const created = await this.#bookmarks.create({ parentId: shortcutsFolderId, title: catName });
        subId = created.id;
      } catch { continue; }
      const catBms = bms.filter((b) => b.categoryId === cat.id);
      for (const bm of catBms) {
        const title = (bm.title || "Bookmark").trim();
        const urlRaw = bm.url?.href || bm.url || "";
        if (!urlRaw) continue;
        try {
          const parsed = new URL(/^https?:\/\//i.test(urlRaw) ? urlRaw : `https://${urlRaw}`);
          if (!/^https?:$/.test(parsed.protocol)) continue;
          await this.#bookmarks.create({ parentId: subId, title, url: parsed.href });
        } catch {}
      }
    }
    return true;
  }
}
