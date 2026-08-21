/* ============================================================
   ChromeBookmarkGroupRepository — Infrastructure repository

   Manages persistence of bookmark groups using chrome.storage.local.

   DECISION: local-only (no chrome.storage.sync).
   docs/agents/AGENTS.md mandates that all user data lives in chrome.storage.local
   — only `aiQuotaPrefs` may use sync.  The previous dual-write to
   chrome.storage.sync was removed because the storage.onChanged
   listener in ChromeStorageClient only watches `area === "local"`,
   so sync-based cross-device propagation was already inconsistent.
   Cross-tab sync still works via the local onChanged listener.
   ============================================================ */

import { BookmarkGroup } from "../../domain/entities/BookmarkGroup.js";
import { GoogleSyncService } from "../services/GoogleSyncService.js";

const STORAGE_KEY = "bookmarkGroups";

// Lightweight tombstone recorder so deletions propagate cross-device
// (without it, a stale snapshot from another device resurrects the group).
const tombstoneRecorder = new GoogleSyncService();

export class ChromeBookmarkGroupRepository {
  constructor() {
    this._cache = null;
  }

  async load() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      if (result[STORAGE_KEY] && Array.isArray(result[STORAGE_KEY])) {
        const raw = result[STORAGE_KEY];
        const parsed = [];
        let needsMigration = false;
        for (const data of raw) {
          try {
            parsed.push(BookmarkGroup.fromJSON(data));
          } catch (err) {
            // Self-heal: coerce invalid icon (e.g. "flame" from older strict allowlist) to fallback and retry
            try {
              const sanitized = { ...data, icon: "folder" };
              // also coerce missing name/folderIds to safe defaults to avoid losing the whole list
              if (!sanitized.name || typeof sanitized.name !== "string") sanitized.name = "Untitled";
              if (!Array.isArray(sanitized.folderIds)) sanitized.folderIds = [];
              parsed.push(BookmarkGroup.fromJSON(sanitized));
              needsMigration = true;
              console.warn(`[BookmarkGroups] healed invalid entry ${data?.id} (icon=${data?.icon}):`, err.message);
            } catch (e2) {
              console.warn(`[BookmarkGroups] skipping unrecoverable entry`, data, e2);
            }
          }
          // detect icon that was auto-fallbacked inside fromJSON (icon changed)
          if (data && data.icon && parsed[parsed.length - 1] && parsed[parsed.length - 1].icon !== data.icon) {
            needsMigration = true;
          }
        }
        this._cache = parsed;
        // persist healed data so the error doesn't repeat every load
        if (needsMigration && parsed.length) {
          try { await this._saveToStorage(parsed); } catch {}
        }
        return this._cache;
      }

      this._cache = [];
      return this._cache;
    } catch (error) {
      console.error("Failed to load bookmark groups:", error);
      this._cache = [];
      return this._cache;
    }
  }

  async save(group) {
    if (!(group instanceof BookmarkGroup)) {
      throw new Error("Invalid BookmarkGroup instance");
    }

    await this.load(); // Ensure cache is loaded
    const index = this._cache.findIndex(g => g.id === group.id);

    if (index >= 0) {
      this._cache[index] = group;
    } else {
      this._cache.push(group);
    }

    await this._saveToStorage(this._cache);
    return group;
  }

  async delete(id) {
    await this.load(); // Ensure cache is loaded
    this._cache = this._cache.filter(g => g.id !== id);
    await this._saveToStorage(this._cache);
    try { await tombstoneRecorder.recordDeletion(STORAGE_KEY, [id]); } catch {}
  }

  async findAll() {
    return await this.load();
  }

  async findById(id) {
    await this.load();
    return this._cache.find(g => g.id === id) || null;
  }

  async _saveToStorage(groups) {
    const data = groups.map(g => g.toJSON());
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.set({ [STORAGE_KEY]: data });
      }
    } catch (err) {
      console.warn("Failed to save bookmark groups to local storage:", err);
    }
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.sync) {
        await chrome.storage.sync.set({ [STORAGE_KEY]: data });
      }
    } catch (err) {
      console.warn("[GoogleSync] Failed to mirror bookmark groups to sync:", err);
    }
  }

  clearCache() {
    this._cache = null;
  }
}
