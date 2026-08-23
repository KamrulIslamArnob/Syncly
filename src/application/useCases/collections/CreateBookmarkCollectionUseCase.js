/* ============================================================
   CreateBookmarkCollectionUseCase — Application use case

   Creates a new curated bookmark collection. Sanitizes name, dedupes
   bookmark IDs, generates an ID, persists to repository, and emits
   "bookmarkCollections:changed" on the EventBus.
   ============================================================ */

import { BookmarkCollection } from "../../../domain/entities/BookmarkCollection.js";

export class CreateBookmarkCollectionUseCase {
  #repository;
  #ids;
  #sanitizer;
  #events;
  #bookmarks;
  #ensureCollectionsFolder;

  constructor({ repository, ids, sanitizer, events, bookmarks, ensureCollectionsFolder } = {}) {
    this.#repository = repository;
    this.#ids = ids;
    this.#sanitizer = sanitizer;
    this.#events = events;
    this.#bookmarks = bookmarks || (typeof chrome !== "undefined" && chrome.bookmarks ? chrome.bookmarks : null);
    this.#ensureCollectionsFolder = ensureCollectionsFolder || null;
  }

  async execute({ name, bookmarkIds = [], bookmarkUrls = [], workspaceId = null }) {
    const rawClean = this.#sanitizer ? this.#sanitizer.text(String(name || "")) : String(name || "").trim();
    const validatedName = BookmarkCollection.validateName(rawClean);

    let folderId = null;
    let initialIds = Array.isArray(bookmarkIds) ? [...bookmarkIds] : [];
    let initialUrls = Array.isArray(bookmarkUrls) ? [...bookmarkUrls] : [];

    if (this.#bookmarks) {
      try {
        let parentId = "2";
        if (this.#ensureCollectionsFolder) {
          parentId = (await this.#ensureCollectionsFolder.execute()) || "2";
        }
        const createdFolder = await this.#bookmarks.create({
          parentId,
          title: validatedName,
        });
        folderId = String(createdFolder.id);

        // If initial bookmarkUrls are provided, create them in the new folder
        for (const url of initialUrls) {
          try {
            const leaf = await this.#bookmarks.create({
              parentId: folderId,
              title: validatedName,
              url,
            });
            initialIds.push(String(leaf.id));
          } catch (_) {}
        }
      } catch (err) {
        console.warn("Could not create native collection folder:", err);
      }
    }

    const id = folderId || (this.#ids?.generate ? this.#ids.generate() : (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())));

    const collection = new BookmarkCollection({
      id,
      name: validatedName,
      bookmarkIds: initialIds,
      bookmarkUrls: initialUrls,
      workspaceId,
      folderId: folderId || id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const saved = await this.#repository.save(collection);
    this.#events?.emit("bookmarkCollections:changed", { action: "create", collection: saved.toJSON() });
    return saved;
  }
}
