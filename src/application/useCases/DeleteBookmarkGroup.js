/* ============================================================
   DeleteBookmarkGroup — Application use case
   
   Deletes a bookmark group by ID.
   ============================================================ */

export class DeleteBookmarkGroup {
  constructor(repository) {
    this.repository = repository;
  }

  async execute(id) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error("Bookmark group not found");
    }

    await this.repository.delete(id);
    return true;
  }
}
