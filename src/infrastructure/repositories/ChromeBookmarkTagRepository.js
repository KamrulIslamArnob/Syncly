/* ============================================================
   ChromeBookmarkTagRepository — Infrastructure repository

   Tags for NATIVE chrome.bookmarks entries. Chrome's bookmarks API has
   no custom-metadata field, so tags live in an extension-owned side
   table keyed by the native bookmark id: { [bookmarkId]: string[] }.

   Same "local-only, odd one out" shape as ChromeBookmarkGroupRepository
   (native-id-keyed, not a BaseChromeListRepository list-of-entities) —
   just a plain object map instead of an array, so load()/save() are a
   straight passthrough rather than an array find/replace.
   ============================================================ */

const STORAGE_KEY = "bookmarkTags";

export class ChromeBookmarkTagRepository {
  constructor() {
    this._cache = null;
  }

  async load() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const map = result[STORAGE_KEY];
      this._cache = (map && typeof map === "object" && !Array.isArray(map)) ? map : {};
      return this._cache;
    } catch (error) {
      console.error("Failed to load bookmark tags:", error);
      this._cache = {};
      return this._cache;
    }
  }

  /** Returns the tags for one bookmark id, or []. */
  async getTags(bookmarkId) {
    await this.load();
    return this._cache[bookmarkId] || [];
  }

  /** Returns the full { [bookmarkId]: string[] } map. */
  async getAll() {
    await this.load();
    return this._cache;
  }

  /** Replace the tag list for one bookmark id. Empty array removes the entry. */
  async setTags(bookmarkId, tags) {
    await this.load();
    if (tags.length === 0) {
      delete this._cache[bookmarkId];
    } else {
      this._cache[bookmarkId] = tags;
    }
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.set({ [STORAGE_KEY]: this._cache });
      }
    } catch (err) {
      console.warn("Failed to save bookmark tags to local storage:", err);
    }
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.sync) {
        await chrome.storage.sync.set({ [STORAGE_KEY]: this._cache });
      }
    } catch (err) {
      console.warn("[GoogleSync] Failed to mirror bookmark tags to sync:", err);
    }
    return tags;
  }

  clearCache() {
    this._cache = null;
  }
}
