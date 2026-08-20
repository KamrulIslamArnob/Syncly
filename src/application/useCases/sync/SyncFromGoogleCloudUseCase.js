/* ============================================================
   SyncFromGoogleCloudUseCase — Application Use Case
   
   Manually pulls latest synced data from Google Cloud (chrome.storage.sync)
   and hydrates local repositories and views.
   ============================================================ */

export class SyncFromGoogleCloudUseCase {
  #googleSyncService;
  #events;

  constructor({ googleSyncService, events }) {
    this.#googleSyncService = googleSyncService;
    this.#events = events;
  }

  async execute() {
    if (!this.#googleSyncService) {
      throw new Error("Google Sync Service is not initialized");
    }

    const res = await this.#googleSyncService.pullAll();
    if (!res.success) {
      throw new Error(res.error || res.reason || "Failed to sync from Google Cloud");
    }

    // Auto-remap workspace folderIds by title after pull (native ids differ per browser)
    // Chrome bookmark sync copies folder titles, but ids are random per browser.
    // So a workspace "3Fold Agency" created on browser A as folder id "123" will have
    // bookmarkGroups folderIds ["123"] on sync. Browser B has same folder but id "456".
    // We remap to local id by searching Other Bookmarks for same title.
    if (res.pulledKeys && res.pulledKeys.includes("bookmarkGroups") && typeof chrome !== "undefined" && chrome.bookmarks && chrome.storage?.local) {
      try {
        const stored = await chrome.storage.local.get("bookmarkGroups");
        const groups = Array.isArray(stored.bookmarkGroups) ? stored.bookmarkGroups : [];
        if (groups.length > 0) {
          const tree = await chrome.bookmarks.getTree().catch(() => []);
          const otherId = this._findOtherBookmarksId(tree);
          const getChildren = (pid) => {
            const roots = tree.length === 1 && (tree[0].id === "0" || tree[0].title === "") && tree[0].children ? tree[0].children : tree;
            for (const r of roots) if (r.id === pid) return r.children || [];
            const find = (nodes) => {
              for (const n of nodes) {
                if (n.id === pid) return n.children || [];
                if (n.children) { const res = find(n.children); if (res) return res; }
              }
              return null;
            };
            return find(roots) || [];
          };
          let changed = false;
          for (const group of groups) {
            if (!Array.isArray(group.folderIds) || group.folderIds.length === 0) continue;
            const newIds = [];
            for (const fid of group.folderIds) {
              // If local folder with this id still exists, keep it
              let exists = false;
              try {
                const all = await chrome.bookmarks.getSubTree ? await chrome.bookmarks.get(fid).catch(() => null) : null;
                if (all && all[0]) exists = true;
              } catch {}
              // Fallback: check tree search
              if (!exists) {
                const walk = (nodes) => {
                  for (const n of nodes) {
                    if (n.id === fid) return true;
                    if (n.children && walk(n.children)) return true;
                  }
                  return false;
                };
                const roots = tree.length === 1 && tree[0].children ? tree[0].children : tree;
                exists = walk(roots);
              }
              if (exists) {
                newIds.push(fid);
                continue;
              }
              // Not found locally — find or create folder by workspace name (single-folder workspaces)
              // For multi-folder workspaces, we try group.name as title
              const title = group.name || fid;
              const siblings = getChildren(otherId);
              let localFolder = siblings.find((n) => (n.title || "").trim().toLowerCase() === String(title).trim().toLowerCase() && !n.url);
              if (!localFolder) {
                try {
                  localFolder = await chrome.bookmarks.create({ parentId: otherId, title });
                } catch {}
              }
              if (localFolder) {
                newIds.push(localFolder.id);
                changed = true;
              }
            }
            // If we resolved to different ids, update group
            if (newIds.length > 0 && JSON.stringify(newIds) !== JSON.stringify(group.folderIds)) {
              group.folderIds = newIds;
              group.updatedAt = Date.now();
              changed = true;
            }
          }
          if (changed) {
            await chrome.storage.local.set({ bookmarkGroups: groups });
          }
        }
      } catch (err) {
        console.warn("[Sync] remap failed:", err);
      }
    }

    if (this.#events && Array.isArray(res.pulledKeys)) {
      for (const key of res.pulledKeys) {
        if (key === "categories") this.#events.emit("categories:changed", undefined);
        if (key === "bookmarks") this.#events.emit("bookmarks:changed", undefined);
        if (key === "settings") this.#events.emit("settings:changed", res.payload?.settings);
        if (key === "bookmarkGroups") this.#events.emit("bookmarkGroups:changed", undefined);
        if (key === "bookmarkCollections") this.#events.emit("bookmarkCollections:changed", undefined);
        if (key === "bookmarkTags") this.#events.emit("bookmarkTags:changed", undefined);
      }
    }

    return {
      success: true,
      pulledKeys: res.pulledKeys,
      count: res.pulledKeys.length,
    };
  }

  _findOtherBookmarksId(tree) {
    if (!Array.isArray(tree) || tree.length === 0) return "2";
    const roots = tree.length === 1 && (tree[0].id === "0" || tree[0].title === "") && tree[0].children ? tree[0].children : tree;
    for (const r of roots) if (/other bookmarks/i.test(r.title || "") || r.id === "2") return r.id;
    return roots[0]?.id || "2";
  }
}
