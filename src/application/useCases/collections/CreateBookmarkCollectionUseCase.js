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

  constructor({ repository, ids, sanitizer, events }) {
    this.#repository = repository;
    this.#ids = ids;
    this.#sanitizer = sanitizer;
    this.#events = events;
  }

  async execute({ name, bookmarkIds = [], bookmarkUrls = [], workspaceId = null }) {
    const rawClean = this.#sanitizer ? this.#sanitizer.text(String(name || "")) : String(name || "").trim();
    const validatedName = BookmarkCollection.validateName(rawClean);

    const id = this.#ids?.generate ? this.#ids.generate() : (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

    const collection = new BookmarkCollection({
      id,
      name: validatedName,
      bookmarkIds,
      bookmarkUrls,
      workspaceId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const saved = await this.#repository.save(collection);
    this.#events?.emit("bookmarkCollections:changed", { action: "create", collection: saved.toJSON() });
    return saved;
  }
}
