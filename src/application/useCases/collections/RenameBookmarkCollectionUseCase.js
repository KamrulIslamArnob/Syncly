/* ============================================================
   RenameBookmarkCollectionUseCase — Application use case

   Renames a bookmark collection. Sanitizes and validates the new name,
   persists to repository, and emits "bookmarkCollections:changed"
   on the EventBus.
   ============================================================ */

import { BookmarkCollection } from "../../../domain/entities/BookmarkCollection.js";

export class RenameBookmarkCollectionUseCase {
  #repository;
  #sanitizer;
  #events;
  #bookmarks;

  constructor({ repository, sanitizer, events, bookmarks } = {}) {
    this.#repository = repository;
    this.#sanitizer = sanitizer;
    this.#events = events;
    this.#bookmarks = bookmarks || (typeof chrome !== "undefined" && chrome.bookmarks ? chrome.bookmarks : null);
  }

  async execute({ collectionId, name }) {
    if (!collectionId) {
      throw new Error("collectionId is required");
    }

    const collection = await this.#repository.findById(collectionId);
    if (!collection) {
      throw new Error(`Collection not found: ${collectionId}`);
    }

    const rawClean = this.#sanitizer ? this.#sanitizer.text(String(name || "")) : String(name || "").trim();
    const validatedName = BookmarkCollection.validateName(rawClean);

    collection.rename(validatedName);

    // Rename native folder in Chrome bookmarks
    const folderId = collection.folderId || collectionId;
    if (this.#bookmarks && folderId) {
      try {
        await this.#bookmarks.update(folderId, { title: validatedName });
      } catch (err) {
        console.warn(`Could not rename native folder ${folderId}:`, err);
      }
    }

    const saved = await this.#repository.save(collection);
    this.#events?.emit("bookmarkCollections:changed", { action: "rename", collection: saved.toJSON() });
    return saved;
  }
}
