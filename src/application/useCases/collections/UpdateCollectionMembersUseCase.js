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

  async execute({ collectionId, add = [], remove = [] }) {
    if (!collectionId) {
      throw new Error("collectionId is required");
    }

    const collection = await this.#repository.findById(collectionId);
    if (!collection) {
      throw new Error(`Collection not found: ${collectionId}`);
    }

    if (Array.isArray(add) && add.length > 0) {
      collection.addBookmarkIds(add);
    }

    if (Array.isArray(remove) && remove.length > 0) {
      collection.removeBookmarkIds(remove);
    }

    const saved = await this.#repository.save(collection);
    this.#events?.emit("bookmarkCollections:changed", { action: "updateMembers", collection: saved.toJSON() });
    return saved;
  }
}
