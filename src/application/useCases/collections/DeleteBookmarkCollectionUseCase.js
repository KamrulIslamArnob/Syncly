/* ============================================================
   DeleteBookmarkCollectionUseCase — Application use case

   Deletes a bookmark collection by ID and emits
   "bookmarkCollections:changed" on the EventBus.
   ============================================================ */

export class DeleteBookmarkCollectionUseCase {
  #repository;
  #events;

  constructor({ repository, events }) {
    this.#repository = repository;
    this.#events = events;
  }

  async execute({ collectionId }) {
    if (!collectionId) {
      throw new Error("collectionId is required");
    }

    await this.#repository.delete(collectionId);
    this.#events?.emit("bookmarkCollections:changed", { action: "delete", collectionId });
  }
}
