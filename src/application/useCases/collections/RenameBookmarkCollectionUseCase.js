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

  constructor({ repository, sanitizer, events }) {
    this.#repository = repository;
    this.#sanitizer = sanitizer;
    this.#events = events;
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
    const saved = await this.#repository.save(collection);
    this.#events?.emit("bookmarkCollections:changed", { action: "rename", collection: saved.toJSON() });
    return saved;
  }
}
