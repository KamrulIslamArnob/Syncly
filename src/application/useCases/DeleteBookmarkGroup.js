/* ============================================================
   DeleteBookmarkGroup — Application use case

   Deletes a bookmark group by ID and clears its structure cache.
   ============================================================ */

export class DeleteBookmarkGroup {
  constructor(repository, { storage = null } = {}) {
    this.repository = repository;
    this.storage = storage || null;
  }

  async execute(id) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error("Bookmark group not found");
    }

    await this.repository.delete(id);
    await this.#clearStructureCache(id);
    return true;
  }

  async #clearStructureCache(workspaceId) {
    if (!this.storage?.get || !this.storage?.set) return;
    try {
      const data = await this.storage.get(["workspaceSystemFolders"]);
      const map = data?.workspaceSystemFolders;
      if (map && typeof map === "object" && map[workspaceId]) {
        delete map[workspaceId];
        await this.storage.set({ workspaceSystemFolders: map });
      }
    } catch {
      /* cache cleanup is best-effort */
    }
  }
}
