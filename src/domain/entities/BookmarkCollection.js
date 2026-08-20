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
  #workspaceId;
  #createdAt;
  #updatedAt;

  constructor({ id, name, bookmarkIds = [], workspaceId = null, createdAt, updatedAt }) {
    if (!id || typeof id !== "string") {
      throw new Error("BookmarkCollection id must be a non-empty string");
    }
    this.#id = id;
    this.#name = BookmarkCollection.validateName(name);
    this.#bookmarkIds = BookmarkCollection.validateBookmarkIds(bookmarkIds);
    this.#workspaceId = typeof workspaceId === "string" && workspaceId.trim() ? workspaceId.trim() : null;
    this.#createdAt = typeof createdAt === "number" ? createdAt : Date.now();
    this.#updatedAt = typeof updatedAt === "number" ? updatedAt : this.#createdAt;
  }

  // Getters
  get id() { return this.#id; }
  get name() { return this.#name; }
  get bookmarkIds() { return [...this.#bookmarkIds]; }
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
    // Deduplicate and filter non-empty strings
    const set = new Set();
    for (const id of bookmarkIds) {
      if (typeof id === "string" && id.trim().length > 0) {
        set.add(id.trim());
      }
    }
    return Array.from(set);
  }

  // Mutators
  rename(name) {
    this.#name = BookmarkCollection.validateName(name);
    this.#updatedAt = Date.now();
  }

  addBookmarkIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const set = new Set(this.#bookmarkIds);
    for (const id of ids) {
      if (typeof id === "string" && id.trim().length > 0) {
        set.add(id.trim());
      }
    }
    this.#bookmarkIds = Array.from(set);
    this.#updatedAt = Date.now();
  }

  removeBookmarkIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const toRemove = new Set(ids);
    this.#bookmarkIds = this.#bookmarkIds.filter((id) => !toRemove.has(id));
    this.#updatedAt = Date.now();
  }

  setBookmarkIds(ids) {
    this.#bookmarkIds = BookmarkCollection.validateBookmarkIds(ids);
    this.#updatedAt = Date.now();
  }

  // Serialization
  toJSON() {
    return {
      id: this.#id,
      name: this.#name,
      bookmarkIds: this.#bookmarkIds,
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
      workspaceId: data.workspaceId || null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
