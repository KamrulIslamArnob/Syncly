/* ============================================================
   BookmarkCollection — Domain entity for curated bookmark bundles

   Represents a user-curated collection of native Chrome bookmark IDs.
   A bookmark can belong to several collections at once (reference-only,
   never moves the underlying native bookmark).
   ============================================================ */

export class BookmarkCollection {
  #id;
  #name;
  #bookmarkIds;
  #bookmarkUrls;
  #workspaceId;
  #createdAt;
  #updatedAt;

  constructor({ id, name, bookmarkIds = [], bookmarkUrls = [], workspaceId = null, createdAt, updatedAt }) {
    if (!id || typeof id !== "string") {
      throw new Error("BookmarkCollection id must be a non-empty string");
    }
    this.#id = id;
    this.#name = BookmarkCollection.validateName(name);
    this.#bookmarkIds = BookmarkCollection.validateBookmarkIds(bookmarkIds);
    this.#bookmarkUrls = BookmarkCollection.validateBookmarkUrls(bookmarkUrls);
    this.#workspaceId = typeof workspaceId === "string" && workspaceId.trim() ? workspaceId.trim() : null;
    this.#createdAt = typeof createdAt === "number" ? createdAt : Date.now();
    this.#updatedAt = typeof updatedAt === "number" ? updatedAt : this.#createdAt;
  }

  // Getters
  get id() { return this.#id; }
  get name() { return this.#name; }
  get bookmarkIds() { return [...this.#bookmarkIds]; }
  get bookmarkUrls() { return [...this.#bookmarkUrls]; }
  get workspaceId() { return this.#workspaceId; }
  get createdAt() { return this.#createdAt; }
  get updatedAt() { return this.#updatedAt; }

  // Validation
  static validateName(name) {
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new Error("Collection name must be a non-empty string");
    }
    const trimmed = name.trim();
    if (trimmed.length > 50) {
      throw new Error("Collection name must be 50 characters or less");
    }
    return trimmed;
  }

  static validateBookmarkIds(bookmarkIds) {
    if (!Array.isArray(bookmarkIds)) {
      return [];
    }
    const set = new Set();
    for (const id of bookmarkIds) {
      if (typeof id === "string" && id.trim().length > 0) {
        set.add(id.trim());
      }
    }
    return Array.from(set);
  }

  static validateBookmarkUrls(bookmarkUrls) {
    if (!Array.isArray(bookmarkUrls)) {
      return [];
    }
    const set = new Set();
    for (const url of bookmarkUrls) {
      if (typeof url === "string" && url.trim().length > 0) {
        set.add(url.trim());
      }
    }
    return Array.from(set);
  }

  // Mutators
  rename(name) {
    this.#name = BookmarkCollection.validateName(name);
    this.#updatedAt = Date.now();
  }

  addBookmarkIds(ids, urls = []) {
    if ((!Array.isArray(ids) || ids.length === 0) && (!Array.isArray(urls) || urls.length === 0)) return;
    const idSet = new Set(this.#bookmarkIds);
    const urlSet = new Set(this.#bookmarkUrls);
    if (Array.isArray(ids)) {
      for (const item of ids) {
        if (item && typeof item === "object") {
          if (item.id) idSet.add(String(item.id).trim());
          if (item.url) urlSet.add(String(item.url).trim());
        } else if (typeof item === "string" && item.trim().length > 0) {
          idSet.add(item.trim());
        }
      }
    }
    if (Array.isArray(urls)) {
      for (const u of urls) {
        if (typeof u === "string" && u.trim().length > 0) {
          urlSet.add(u.trim());
        }
      }
    }
    this.#bookmarkIds = Array.from(idSet);
    this.#bookmarkUrls = Array.from(urlSet);
    this.#updatedAt = Date.now();
  }

  removeBookmarkIds(ids, urls = []) {
    if ((!Array.isArray(ids) || ids.length === 0) && (!Array.isArray(urls) || urls.length === 0)) return;
    const toRemoveIds = new Set(ids);
    const toRemoveUrls = new Set(urls);
    this.#bookmarkIds = this.#bookmarkIds.filter((id) => !toRemoveIds.has(id));
    if (toRemoveUrls.size > 0) {
      this.#bookmarkUrls = this.#bookmarkUrls.filter((url) => !toRemoveUrls.has(url));
    }
    this.#updatedAt = Date.now();
  }

  setBookmarkIds(ids, urls = []) {
    this.#bookmarkIds = BookmarkCollection.validateBookmarkIds(ids);
    if (Array.isArray(urls) && urls.length > 0) {
      this.#bookmarkUrls = BookmarkCollection.validateBookmarkUrls(urls);
    }
    this.#updatedAt = Date.now();
  }

  // Serialization
  toJSON() {
    return {
      id: this.#id,
      name: this.#name,
      bookmarkIds: this.#bookmarkIds,
      bookmarkUrls: this.#bookmarkUrls,
      workspaceId: this.#workspaceId,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
    };
  }

  static fromJSON(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid BookmarkCollection data");
    }
    return new BookmarkCollection({
      id: data.id,
      name: data.name,
      bookmarkIds: data.bookmarkIds || [],
      bookmarkUrls: data.bookmarkUrls || [],
      workspaceId: data.workspaceId || null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
