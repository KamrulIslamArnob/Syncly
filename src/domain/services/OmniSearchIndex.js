/**
 * OmniSearchIndex — In-memory inverted prefix index and query cache
 * providing O(1) amortized search lookups across both Shortcuts and Bookmarks.
 *
 * Adheres to Clean Architecture (Domain service, pure JavaScript, zero dependencies).
 */

const MAX_CACHE_SIZE = 250;
const MAX_PREFIX_LENGTH = 32;

/** Extract searchable tokens from a text string */
export function extractTokens(text) {
  if (!text || typeof text !== "string") return [];
  const normalized = text.toLowerCase().trim();
  // Split on whitespace, common delimiters, and punctuation
  const rawParts = normalized.split(/[\s/_.:?&=#\-+@,;()\[\]{}'"]+/).filter(Boolean);
  const tokens = new Set();

  for (const part of rawParts) {
    if (part.length > 0) {
      tokens.add(part);
    }
  }

  // Also include the full continuous string if non-empty and contains alphanumeric
  if (normalized.length > 0 && normalized.length <= MAX_PREFIX_LENGTH) {
    tokens.add(normalized);
  }

  return Array.from(tokens);
}

export class OmniSearchIndex {
  constructor() {
    this._prefixMap = new Map(); // prefix -> { shortcuts: Set<Bookmark>, bookmarks: Set<BookmarkLeaf> }
    this._cache = new Map(); // query -> { shortcuts: Bookmark[], bookmarks: BookmarkLeaf[] }
    this._categoriesMap = new Map(); // categoryId -> Category
    this._shortcuts = [];
    this._bookmarks = [];
    this._tags = {};
  }

  /**
   * Re-index all shortcuts, categories, bookmarks, and tags.
   * Clears query cache and rebuilds prefix hash table.
   *
   * @param {Object} params
   * @param {Array} [params.shortcuts=[]] Array of domain Bookmark shortcut entities
   * @param {Array} [params.categories=[]] Array of domain Category entities
   * @param {Array} [params.bookmarks=[]] Array of Chrome bookmark leaf objects {id, title, url, path, parentId}
   * @param {Object} [params.tags={}] Map of { [bookmarkId]: string[] }
   */
  index({ shortcuts = [], categories = [], bookmarks = [], tags = {} } = {}) {
    this._prefixMap.clear();
    this._cache.clear();
    this._categoriesMap.clear();

    this._shortcuts = shortcuts || [];
    this._bookmarks = bookmarks || [];
    this._tags = tags || {};

    for (const cat of categories || []) {
      const id = cat?.id?.value || cat?.id;
      if (id) {
        this._categoriesMap.set(String(id), cat);
      }
    }

    // 1. Index Shortcuts
    for (const s of this._shortcuts) {
      const title = s.title || "";
      const rawUrl = s.url?.href || s.url || "";
      const catId = s.categoryId?.value || s.categoryId;
      const cat = catId ? this._categoriesMap.get(String(catId)) : null;
      const catName = cat?.name || "";

      const tokens = new Set([
        ...extractTokens(title),
        ...extractTokens(rawUrl),
        ...extractTokens(catName),
      ]);

      for (const token of tokens) {
        const len = Math.min(token.length, MAX_PREFIX_LENGTH);
        for (let i = 1; i <= len; i++) {
          const prefix = token.slice(0, i);
          let entry = this._prefixMap.get(prefix);
          if (!entry) {
            entry = { shortcuts: new Set(), bookmarks: new Set() };
            this._prefixMap.set(prefix, entry);
          }
          entry.shortcuts.add(s);
        }
      }
    }

    // 2. Index Bookmarks
    for (const b of this._bookmarks) {
      const title = b.title || "";
      const url = b.url || "";
      const pathText = Array.isArray(b.path) ? b.path.join(" ") : "";
      const bmTags = this._tags[b.id] || [];
      const tagText = bmTags.join(" ");

      const tokens = new Set([
        ...extractTokens(title),
        ...extractTokens(url),
        ...extractTokens(pathText),
        ...extractTokens(tagText),
      ]);

      for (const token of tokens) {
        const len = Math.min(token.length, MAX_PREFIX_LENGTH);
        for (let i = 1; i <= len; i++) {
          const prefix = token.slice(0, i);
          let entry = this._prefixMap.get(prefix);
          if (!entry) {
            entry = { shortcuts: new Set(), bookmarks: new Set() };
            this._prefixMap.set(prefix, entry);
          }
          entry.bookmarks.add(b);
        }
      }
    }
  }

  /**
   * Search across indexed shortcuts and bookmarks with O(1) amortized map lookups.
   *
   * @param {string} query Search query string
   * @param {Object} [options={}]
   * @param {string|null} [options.activeTag=null] Optional tag filter
   * @param {Set|Array|null} [options.scopedBookmarkIds=null] Optional scoped bookmark IDs (e.g. active folder / collection)
   * @returns {{ shortcuts: Array, bookmarks: Array }} Matching shortcuts and bookmarks
   */
  search(query, { activeTag = null, scopedBookmarkIds = null } = {}) {
    if (!query || typeof query !== "string") {
      return { shortcuts: [], bookmarks: [] };
    }

    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return { shortcuts: [], bookmarks: [] };
    }

    const cacheKey = `${trimmed}::${activeTag || ""}::${scopedBookmarkIds ? Array.from(scopedBookmarkIds).join(",") : ""}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const terms = trimmed.split(/\s+/).filter(Boolean);
    if (terms.length === 0) {
      return { shortcuts: [], bookmarks: [] };
    }

    let matchingShortcuts = null;
    let matchingBookmarks = null;

    for (const term of terms) {
      const entry = this._prefixMap.get(term);
      let termShortcuts;
      let termBookmarks;

      if (entry) {
        termShortcuts = entry.shortcuts;
        termBookmarks = entry.bookmarks;
      } else {
        // Fallback substring scan for mid-word tokens not in prefix map
        termShortcuts = new Set();
        termBookmarks = new Set();

        for (const s of this._shortcuts) {
          const title = (s.title || "").toLowerCase();
          const url = (s.url?.href || s.url || "").toLowerCase();
          const catId = s.categoryId?.value || s.categoryId;
          const cat = catId ? this._categoriesMap.get(String(catId)) : null;
          const catName = (cat?.name || "").toLowerCase();
          if (title.includes(term) || url.includes(term) || catName.includes(term)) {
            termShortcuts.add(s);
          }
        }

        for (const b of this._bookmarks) {
          const title = (b.title || "").toLowerCase();
          const url = (b.url || "").toLowerCase();
          const pathText = (Array.isArray(b.path) ? b.path.join(" ") : "").toLowerCase();
          const bmTags = (this._tags[b.id] || []).map((t) => t.toLowerCase());
          if (title.includes(term) || url.includes(term) || pathText.includes(term) || bmTags.some((t) => t.includes(term))) {
            termBookmarks.add(b);
          }
        }
      }

      if (matchingShortcuts === null) {
        matchingShortcuts = new Set(termShortcuts);
      } else {
        for (const s of matchingShortcuts) {
          if (!termShortcuts.has(s)) {
            matchingShortcuts.delete(s);
          }
        }
      }

      if (matchingBookmarks === null) {
        matchingBookmarks = new Set(termBookmarks);
      } else {
        for (const b of matchingBookmarks) {
          if (!termBookmarks.has(b)) {
            matchingBookmarks.delete(b);
          }
        }
      }
    }

    let shortcutsArr = Array.from(matchingShortcuts || []);
    let bookmarksArr = Array.from(matchingBookmarks || []);

    // Filter bookmarks by active tag if specified
    if (activeTag) {
      bookmarksArr = bookmarksArr.filter((b) => (this._tags[b.id] || []).includes(activeTag));
    }

    // Filter bookmarks by scope (workspace, folder, or collection) if specified
    if (scopedBookmarkIds) {
      const scopeSet = scopedBookmarkIds instanceof Set ? scopedBookmarkIds : new Set(scopedBookmarkIds);
      bookmarksArr = bookmarksArr.filter((b) => scopeSet.has(b.id));
    }

    const result = {
      shortcuts: shortcutsArr,
      bookmarks: bookmarksArr,
    };

    // Cache result with bounded cache eviction
    if (this._cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = this._cache.keys().next().value;
      if (oldestKey !== undefined) this._cache.delete(oldestKey);
    }
    this._cache.set(cacheKey, result);

    return result;
  }

  /** Retrieve category name for a shortcut */
  getCategoryName(shortcut) {
    if (!shortcut) return "";
    const catId = shortcut.categoryId?.value || shortcut.categoryId;
    if (!catId) return "";
    const cat = this._categoriesMap.get(String(catId));
    return cat?.name || "";
  }
}
