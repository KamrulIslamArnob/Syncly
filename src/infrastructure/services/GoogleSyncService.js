/* ============================================================
   GoogleSyncService — Automated Hybrid Google Sync Service

   Synchronizes lightweight user metadata across devices using
   chrome.storage.sync (categories, shortcuts, workspaces, collections,
   tags, settings) while keeping heavy assets in local storage.

   Cross-device model:
   - Workspaces/collections/tags are MERGED at item level (never
     whole-key overwritten) so two live devices cannot clobber each
     other's newly-created items. See crossDeviceSync.js.
   - Deletions propagate via tombstones under `syncTombstones`.
   - Writes we made ourselves are recognized via isOwnEcho() so the
     storage.onChanged listeners ignore our own reflections.
   - Every sync write is byte-checked against the 8KB per-item quota.
   ============================================================ */

import {
  MERGE_KEYS,
  TOMBSTONE_KEY,
  MAX_SYNC_ITEM_BYTES,
  estimateBytes,
  isEmptyValue,
  computeMerged,
  normalizeTombstones,
  mergeTombstones,
  recordTombstone,
  pruneTombstones,
} from "./crossDeviceSync.js";

export { MERGE_KEYS, TOMBSTONE_KEY };

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
    /** JSON snapshots of the last value WE wrote to sync, per key. */
    this._lastSyncWrite = new Map();
  }

  isAvailable() {
    return Boolean(this._sync && typeof this._sync.get === "function");
  }

  /**
   * True when `value` is the reflection of our own recent sync write,
   * i.e. the storage.onChanged event fired for a change we caused.
   * @param {string} key
   * @param {unknown} value
   */
  isOwnEcho(key, value) {
    const last = this._lastSyncWrite.get(key);
    if (last === undefined) return false;
    try {
      return JSON.stringify(value ?? null) === last;
    } catch {
      return false;
    }
  }

  /**
   * Write a payload to chrome.storage.sync, skipping oversized items
   * (8KB per-item quota) and remembering what we wrote (echo guard).
   * @param {Record<string, unknown>} payload
   * @returns {Promise<string[]>} keys actually written
   */
  async _safeSyncSet(payload) {
    const writable = {};
    const writtenKeys = [];
    for (const [key, value] of Object.entries(payload)) {
      const bytes = estimateBytes(value);
      if (bytes > MAX_SYNC_ITEM_BYTES) {
        console.warn(
          `[GoogleSync] Skipping sync write for "${key}" (${bytes}B > ${MAX_SYNC_ITEM_BYTES}B quota). ` +
            `Trim workspaces/collections or reduce folder count.`
        );
        continue;
      }
      writable[key] = value;
      writtenKeys.push(key);
    }
    if (writtenKeys.length === 0) return [];
    try {
      await this._sync.set(writable);
      for (const key of writtenKeys) {
        this._lastSyncWrite.set(key, JSON.stringify(writable[key] ?? null));
      }
      return writtenKeys;
    } catch (err) {
      console.warn(`[GoogleSync] Failed to push keys ${writtenKeys.join(", ")} to sync:`, err);
      return [];
    }
  }

  /** Read the tombstones object from an area (defaults to local). */
  async _getTombstones(area = null) {
    const target = area || this._local;
    if (!target) return {};
    try {
      const raw = await target.get(TOMBSTONE_KEY);
      return normalizeTombstones(raw?.[TOMBSTONE_KEY]);
    } catch {
      return {};
    }
  }

  /** Public read access to current deletion tombstones. */
  async getTombstones() {
    return this._getTombstones();
  }

  /**
   * Record deletions of entity ids so other devices do not resurrect them.
   * Writes tombstones to BOTH local and sync areas.
   * @param {string} listKey one of MERGE_KEYS ("bookmarkGroups", ...)
   * @param {string[]} ids
   * @param {number} [at]
   */
  async recordDeletion(listKey, ids, at = Date.now()) {
    if (!Array.isArray(ids) || ids.length === 0 || !MERGE_KEYS.includes(listKey)) return;
    for (const area of [this._local, this._sync]) {
      if (!area) continue;
      try {
        const cur = normalizeTombstones((await area.get(TOMBSTONE_KEY))?.[TOMBSTONE_KEY]);
        await area.set({ [TOMBSTONE_KEY]: pruneTombstones(recordTombstone(cur, listKey, ids, at)) });
      } catch (err) {
        console.warn(`[GoogleSync] Failed to record deletion tombstone for "${listKey}":`, err);
      }
    }
  }

  /**
   * Push a specific key's data to chrome.storage.sync
   * @param {string} key
   * @param {unknown} value
   */
  async pushKey(key, value) {
    if (!this.isAvailable() || !SYNC_KEYS.includes(key)) return;
    await this._safeSyncSet({ [key]: value });
  }

  /**
   * Push all current local sync-eligible data to chrome.storage.sync
   */
  async pushAll() {
    if (!this.isAvailable() || !this._local) return { success: false, reason: "Sync unavailable" };

    try {
      const localData = await this._local.get(SYNC_KEYS);
      const payload = {};

      for (const key of SYNC_KEYS) {
        if (localData[key] !== undefined && localData[key] !== null) {
          payload[key] = localData[key];
        }
      }

      const written = await this._safeSyncSet(payload);
      return { success: true, count: written.length };
    } catch (err) {
      console.error("[GoogleSync] pushAll failed:", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Pull synced data from Google Cloud (chrome.storage.sync) into local storage.
   * Merge keys are combined item-level with local data (no clobbering of
   * concurrent local edits); whole-value keys keep the legacy overwrite.
   */
  async pullAll() {
    if (!this.isAvailable() || !this._local) {
      return { success: false, reason: "Sync unavailable", pulledKeys: [] };
    }

    try {
      const [syncData, localData] = await Promise.all([
        this._sync.get(SYNC_KEYS),
        this._local.get(SYNC_KEYS),
      ]);
      const tombstones = await this._getTombstones();
      const payload = {};
      const pulledKeys = [];

      for (const key of SYNC_KEYS) {
        const remoteVal = syncData[key];
        if (remoteVal === undefined || remoteVal === null) continue;

        if (MERGE_KEYS.includes(key)) {
          const res = computeMerged(key, localData[key], remoteVal, tombstones);
          if (res?.changedLocal) {
            payload[key] = res.value;
            pulledKeys.push(key);
          }
          continue;
        }

        // Legacy whole-value keys — skip empty/invalid remote payloads
        if (Array.isArray(remoteVal) && remoteVal.length === 0) continue;
        if (typeof remoteVal === "object" && Object.keys(remoteVal).length === 0) continue;

        payload[key] = remoteVal;
        pulledKeys.push(key);
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
   * Apply incoming chrome.storage.onChanged (area === "sync") payloads by
   * MERGING them into local storage. Returns the list of local keys that
   * actually changed so callers can invalidate caches / emit events.
   *
   * Merge keys combine remote items with local items (newer updatedAt wins,
   * tombstoned items dropped); whole-value keys take the remote snapshot.
   *
   * @param {Record<string, {newValue?: unknown, oldValue?: unknown}>} changes
   * @returns {Promise<string[]>}
   */
  async applyRemoteChanges(changes) {
    if (!this.isAvailable() || !this._local) return [];

    const entries = Object.entries(changes).filter(
      ([key, change]) =>
        change && typeof change === "object" && (SYNC_KEYS.includes(key) || key === TOMBSTONE_KEY)
    );
    if (entries.length === 0) return [];

    let tombstones = await this._getTombstones();
    let tombsChanged = false;

    const incomingTombsRaw = changes[TOMBSTONE_KEY]?.newValue;
    if (incomingTombsRaw) {
      const merged = pruneTombstones(mergeTombstones(tombstones, incomingTombsRaw));
      if (JSON.stringify(merged) !== JSON.stringify(tombstones)) {
        tombstones = merged;
        tombsChanged = true;
      }
    }

    const changedKeys = new Set();

    for (const [key, change] of entries) {
      if (key === TOMBSTONE_KEY) continue;
      const remoteVal = change.newValue;
      if (remoteVal === undefined || remoteVal === null) continue;

      const localVal = (await this._local.get(key))?.[key];

      if (MERGE_KEYS.includes(key)) {
        const res = computeMerged(key, localVal, remoteVal, tombstones);
        if (res?.changedLocal) {
          await this._local.set({ [key]: res.value });
          changedKeys.add(key);
        }
      } else {
        // Whole-value keys mirror the remote snapshot (legacy behavior)
        if (JSON.stringify(remoteVal) !== JSON.stringify(localVal ?? null)) {
          await this._local.set({ [key]: remoteVal });
          changedKeys.add(key);
        }
      }
    }

    // New tombstones arrived — re-merge any affected merge-key whose data was
    // NOT part of this batch, so deleted items disappear locally right away.
    if (tombsChanged && incomingTombsRaw) {
      const incomingLists = Object.keys(normalizeTombstones(incomingTombsRaw));
      for (const listKey of incomingLists) {
        if (!MERGE_KEYS.includes(listKey) || changedKeys.has(listKey)) continue;
        const [localVal, syncVal] = await Promise.all([
          Promise.resolve((await this._local.get(listKey))?.[listKey]),
          Promise.resolve((await this._sync.get(listKey))?.[listKey]),
        ]);
        const res = computeMerged(listKey, localVal, syncVal, tombstones);
        if (res?.changedLocal) {
          await this._local.set({ [listKey]: res.value });
          changedKeys.add(listKey);
        }
      }
      await this._local.set({ [TOMBSTONE_KEY]: tombstones });
    }

    return [...changedKeys];
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

      // If local already has custom data, don't overwrite blindly on start —
      // run a bidirectional MERGE instead so neither device loses items.
      if (hasLocalCategories || hasLocalBookmarks || hasLocalGroups) {
        this.reconcile().catch(() => {});
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
   * Bidirectional reconciliation between local and sync storage.
   * Merge keys converge to one canonical merged value on BOTH sides;
   * whole-value keys keep the legacy fill-the-empty-side behavior.
   * Writes happen only when a side actually differs (quota-friendly).
   * @returns {{pushed: string[], pulled: string[]}}
   */
  async reconcile() {
    if (!this.isAvailable() || !this._local || !this._sync) return { pushed: [], pulled: [] };
    try {
      const [localData, syncData] = await Promise.all([
        this._local.get(SYNC_KEYS),
        this._sync.get(SYNC_KEYS),
      ]);
      const tombstones = await this._getTombstones();
      const toPush = {};
      const toPull = {};
      const pushed = [];
      const pulled = [];

      for (const key of SYNC_KEYS) {
        const localVal = localData[key];
        const syncVal = syncData[key];
        const localEmpty = isEmptyValue(localVal);
        const syncEmpty = isEmptyValue(syncVal);

        if (localEmpty && syncEmpty) continue;

        if (MERGE_KEYS.includes(key)) {
          // One canonical merged value applied to both sides
          const res = computeMerged(key, localVal, syncVal, tombstones);
          const merged = res ? res.value : localVal;
          if (JSON.stringify(merged) !== JSON.stringify(localVal ?? null)) {
            toPull[key] = merged;
            pulled.push(key);
          }
          if (JSON.stringify(merged) !== JSON.stringify(syncVal ?? null)) {
            toPush[key] = merged;
            pushed.push(key);
          }
          continue;
        }

        // Whole-value keys: fill whichever side is empty
        if (!localEmpty && syncEmpty) {
          toPush[key] = localVal;
          pushed.push(key);
        } else if (localEmpty && !syncEmpty) {
          toPull[key] = syncVal;
          pulled.push(key);
        }
      }

      if (Object.keys(toPush).length > 0) {
        await this._safeSyncSet(toPush);
      }
      if (Object.keys(toPull).length > 0) {
        try { await this._local.set(toPull); } catch (e) { console.warn("[GoogleSync] reconcile pull failed:", e); }
      }
      return { pushed, pulled };
    } catch (err) {
      console.warn("[GoogleSync] reconcile failed:", err);
      return { pushed: [], pulled: [] };
    }
  }

  /**
   * Start periodic reconciliation for 2-browser auto-push.
   * REMOVED (PERF-T04): pages no longer poll — catch-up convergence is owned
   * by the MV3 service worker (top-level sync listener + onStartup + the
   * 15-minute reconcile alarm). Pages keep only instant event-driven paths.
   */
}
