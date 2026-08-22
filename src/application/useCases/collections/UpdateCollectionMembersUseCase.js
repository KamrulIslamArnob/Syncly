/* ============================================================
   UpdateCollectionMembersUseCase — Application use case

   Adds and/or removes bookmark IDs from a collection.
   Persists changes to the repository and emits
   "bookmarkCollections:changed" on the EventBus.
   ============================================================ */

export class UpdateCollectionMembersUseCase {
  #repository;
  #events;

  constructor({ repository, events }) {
    this.#repository = repository;
    this.#events = events;
  }

  async execute({ collectionId, add = [], remove = [], urls = [], removeUrls = [] }) {
    if (!collectionId) {
      throw new Error("collectionId is required");
    }

    const collection = await this.#repository.findById(collectionId);
    if (!collection) {
      throw new Error(`Collection not found: ${collectionId}`);
    }

    if ((Array.isArray(add) && add.length > 0) || (Array.isArray(urls) && urls.length > 0)) {
      collection.addBookmarkIds(add, urls);
    }

    if ((Array.isArray(remove) && remove.length > 0) || (Array.isArray(removeUrls) && removeUrls.length > 0)) {
      collection.removeBookmarkIds(remove, removeUrls);
    }

    const saved = await this.#repository.save(collection);
    this.#events?.emit("bookmarkCollections:changed", { action: "updateMembers", collection: saved.toJSON() });
    return saved;
  }
}
