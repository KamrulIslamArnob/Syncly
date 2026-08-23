/* ============================================================
   DeleteBookmarkCollectionUseCase — Application use case

   Deletes a bookmark collection by ID and emits
   "bookmarkCollections:changed" on the EventBus.
   ============================================================ */

export class DeleteBookmarkCollectionUseCase {
  #repository;
  #events;
  #bookmarks;

  constructor({ repository, events, bookmarks } = {}) {
    this.#repository = repository;
    this.#events = events;
    this.#bookmarks = bookmarks || (typeof chrome !== "undefined" && chrome.bookmarks ? chrome.bookmarks : null);
  }

  async execute({ collectionId }) {
    if (!collectionId) {
      throw new Error("collectionId is required");
    }

    const collection = await this.#repository.findById(collectionId);
    const folderId = collection?.folderId || collectionId;

    // Remove native folder in Chrome bookmarks
    if (this.#bookmarks && folderId) {
      try {
        await this.#bookmarks.removeTree(folderId);
      } catch (err) {
        console.warn(`Could not remove native collection folder ${folderId}:`, err);
      }
    }

    await this.#repository.delete(collectionId);
    this.#events?.emit("bookmarkCollections:changed", { action: "delete", collectionId });
  }
}
