/* ============================================================
   ChromeBookmarkCollectionRepository — Infrastructure repository

   Manages persistence of bookmark collections in chrome.storage.local
   under the key "bookmarkCollections".

   Storage shape:
   { [collectionId]: { id, name, bookmarkIds: string[], createdAt, updatedAt } }
   ============================================================ */

import { BookmarkCollection } from "../../domain/entities/BookmarkCollection.js";
import { GoogleSyncService } from "../services/GoogleSyncService.js";

const STORAGE_KEY = "bookmarkCollections";

// Deletion tombstones so removed collections are not resurrected by a
// stale snapshot arriving from another device via chrome.storage.sync.
const tombstoneRecorder = new GoogleSyncService();

export class ChromeBookmarkCollectionRepository {
  constructor({ storage } = {}) {
    this._storage = storage || (typeof chrome !== "undefined" && chrome.storage ? chrome.storage.local : null);
    this._cache = null; // Map<string, BookmarkCollection> or object { [id]: BookmarkCollection }
  }

  async load() {
    if (this._cache !== null) return this._cache;

    try {
      if (!this._storage) {
        this._cache = {};
        return this._cache;
      }

      const result = await this._storage.get(STORAGE_KEY);
      const raw = result?.[STORAGE_KEY];

      this._cache = {};
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        for (const [id, data] of Object.entries(raw)) {
          if (data && typeof data === "object") {
            try {
              this._cache[id] = BookmarkCollection.fromJSON({ ...data, id });
            } catch (e) {
              console.warn(`Skipping invalid collection "${id}":`, e);
            }
          }
        }
      } else if (Array.isArray(raw)) {
        // Tolerates legacy array shape if ever stored
        for (const data of raw) {
          if (data?.id) {
            try {
              this._cache[data.id] = BookmarkCollection.fromJSON(data);
            } catch (e) {
              console.warn(`Skipping invalid collection item:`, e);
            }
          }
        }
      }
      return this._cache;
    } catch (error) {
      console.error("Failed to load bookmark collections:", error);
      this._cache = {};
      return this._cache;
    }
  }

  async findAll() {
    await this.load();
    return Object.values(this._cache);
  }

  async findById(id) {
    await this.load();
    return this._cache[id] || null;
  }

  async save(collection) {
    if (!(collection instanceof BookmarkCollection)) {
      throw new Error("Invalid BookmarkCollection instance");
    }
    await this.load();
    this._cache[collection.id] = collection;
    await this._saveToStorage();
    return collection;
  }

  async delete(id) {
    await this.load();
    if (this._cache[id]) {
      delete this._cache[id];
      await this._saveToStorage();
      try { await tombstoneRecorder.recordDeletion(STORAGE_KEY, [id]); } catch {}
    }
  }

  async _saveToStorage() {
    if (!this._storage) return;
    const serialized = {};
    for (const [id, coll] of Object.entries(this._cache)) {
      serialized[id] = coll.toJSON();
    }
    try {
      await this._storage.set({ [STORAGE_KEY]: serialized });
    } catch (err) {
      console.warn("Failed to save bookmark collections to local storage:", err);
    }
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.sync) {
        await chrome.storage.sync.set({ [STORAGE_KEY]: serialized });
      }
    } catch (err) {
      console.warn("[GoogleSync] Failed to mirror collections to sync:", err);
    }
  }

  clearCache() {
    this._cache = null;
  }
}
