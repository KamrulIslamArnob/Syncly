/* ============================================================
   GoogleSyncService — Automated Hybrid Google Sync Service
   
   Synchronizes lightweight user metadata across devices using
   chrome.storage.sync (categories, shortcuts, workspaces, collections,
   tags, settings) while keeping heavy assets in local storage.
   ============================================================ */

export const SYNC_KEYS = Object.freeze([
  "categories",
  "bookmarks",
  "settings",
  "bookmarkGroups",
  "bookmarkCollections",
  "bookmarkTags",
]);

export class GoogleSyncService {
  constructor({ local = null, sync = null } = {}) {
    this._local = local || (typeof chrome !== "undefined" && chrome.storage ? chrome.storage.local : null);
    this._sync = sync || (typeof chrome !== "undefined" && chrome.storage ? chrome.storage.sync : null);
  }

  isAvailable() {
    return Boolean(this._sync && typeof this._sync.get === "function");
  }

  /**
   * Push a specific key's data to chrome.storage.sync
   * @param {string} key 
   * @param {unknown} value 
   */
  async pushKey(key, value) {
    if (!this.isAvailable() || !SYNC_KEYS.includes(key)) return;
    try {
      await this._sync.set({ [key]: value });
    } catch (err) {
      console.warn(`[GoogleSync] Failed to push "${key}" to sync:`, err);
    }
  }

  /**
   * Push all current local sync-eligible data to chrome.storage.sync
   */
  async pushAll() {
    if (!this.isAvailable() || !this._local) return { success: false, reason: "Sync unavailable" };

    try {
      const localData = await this._local.get(SYNC_KEYS);
      const payload = {};
      let count = 0;

      for (const key of SYNC_KEYS) {
        if (localData[key] !== undefined && localData[key] !== null) {
          payload[key] = localData[key];
          count++;
        }
      }

      if (count > 0) {
        await this._sync.set(payload);
      }

      return { success: true, count };
    } catch (err) {
      console.error("[GoogleSync] pushAll failed:", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Pull synced data from Google Cloud (chrome.storage.sync) into local storage
   */
  async pullAll() {
    if (!this.isAvailable() || !this._local) {
      return { success: false, reason: "Sync unavailable", pulledKeys: [] };
    }

    try {
      const syncData = await this._sync.get(SYNC_KEYS);
      const payload = {};
      const pulledKeys = [];

      for (const key of SYNC_KEYS) {
        if (syncData[key] !== undefined && syncData[key] !== null) {
          // If array, ensure it's not empty or invalid
          if (Array.isArray(syncData[key]) && syncData[key].length === 0) continue;
          if (typeof syncData[key] === "object" && Object.keys(syncData[key]).length === 0) continue;

          payload[key] = syncData[key];
          pulledKeys.push(key);
        }
      }

      if (pulledKeys.length > 0) {
        await this._local.set(payload);
      }

      return { success: true, pulledKeys, payload };
    } catch (err) {
      console.error("[GoogleSync] pullAll failed:", err);
      return { success: false, error: err.message, pulledKeys: [] };
    }
  }

  /**
   * Auto-hydrate on cold boot if local storage has no categories/shortcuts but sync storage does.
   */
  async autoHydrateIfNeeded() {
    if (!this.isAvailable() || !this._local) return false;

    try {
      const localData = await this._local.get(["categories", "bookmarks", "bookmarkGroups"]);
      const hasLocalCategories = Array.isArray(localData.categories) && localData.categories.length > 0;
      const hasLocalBookmarks = Array.isArray(localData.bookmarks) && localData.bookmarks.length > 0;
      const hasLocalGroups = Array.isArray(localData.bookmarkGroups) && localData.bookmarkGroups.length > 0;

      // If local already has custom data, don't overwrite blindly on start
      if (hasLocalCategories || hasLocalBookmarks || hasLocalGroups) {
        // Still dual-push local to sync to keep sync warm
        this.pushAll().catch(() => {});
        return false;
      }

      // Check if sync has data
      const syncData = await this._sync.get(SYNC_KEYS);
      const hasSyncData = SYNC_KEYS.some((k) => syncData[k] && (
        (Array.isArray(syncData[k]) && syncData[k].length > 0) ||
        (typeof syncData[k] === "object" && Object.keys(syncData[k]).length > 0)
      ));

      if (hasSyncData) {
        const pullRes = await this.pullAll();
        return pullRes.success && pullRes.pulledKeys.length > 0;
      }

      return false;
    } catch (err) {
      console.warn("[GoogleSync] autoHydrateIfNeeded check failed:", err);
      return false;
    }
  }

  /**
   * Reconcile missing keys between local and sync — for 2 browsers open same Google profile.
   * If local has data but sync is empty → push that key to sync (so new browser can pull).
   * If sync has data but local is empty → pull that key to local.
   * Runs periodically when both browsers are open.
   * @returns {{pushed: string[], pulled: string[]}}
   */
  async reconcile() {
    if (!this.isAvailable() || !this._local || !this._sync) return { pushed: [], pulled: [] };
    try {
      const [localData, syncData] = await Promise.all([
        this._local.get(SYNC_KEYS),
        this._sync.get(SYNC_KEYS),
      ]);
      const isEmpty = (v) => v === undefined || v === null || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);
      const toPush = {};
      const toPushKeys = [];
      const toPull = {};
      const toPullKeys = [];
      for (const key of SYNC_KEYS) {
        const localEmpty = isEmpty(localData[key]);
        const syncEmpty = isEmpty(syncData[key]);
        if (!localEmpty && syncEmpty) {
          toPush[key] = localData[key];
          toPushKeys.push(key);
        } else if (localEmpty && !syncEmpty) {
          toPull[key] = syncData[key];
          toPullKeys.push(key);
        }
      }
      if (toPushKeys.length > 0) {
        try { await this._sync.set(toPush); } catch (e) { console.warn("[GoogleSync] reconcile push failed:", e); }
      }
      if (toPullKeys.length > 0) {
        try { await this._local.set(toPull); } catch (e) { console.warn("[GoogleSync] reconcile pull failed:", e); }
      }
      return { pushed: toPushKeys, pulled: toPullKeys };
    } catch (err) {
      console.warn("[GoogleSync] reconcile failed:", err);
      return { pushed: [], pulled: [] };
    }
  }

  /**
   * Start periodic reconciliation for 2-browser auto-push (runs every 30s while extension is open)
   * @returns {number} interval id
   */
  startAutoReconcile(intervalMs = 30000) {
    if (!this.isAvailable()) return null;
    // Run once soon after start
    setTimeout(() => this.reconcile().catch(() => {}), 3000);
    return setInterval(() => this.reconcile().catch(() => {}), intervalMs);
  }
}
