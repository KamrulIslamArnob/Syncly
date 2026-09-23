/* ============================================================
   ListBookmarkCollectionsUseCase — Application use case

   Retrieves all curated bookmark collections.
   ============================================================ */

export class ListBookmarkCollectionsUseCase {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  /**
   * @param {object} [params]
   * @param {string} [params.workspaceId] when provided, only collections
   *   belonging to that workspace are returned (workspace-owned model).
   *   Omit to get every collection (migration / All Bookmarks views).
   * @param {boolean} [params.includeUnscoped=false] when filtering by
   *   workspaceId, also include legacy collections with workspaceId null.
   */
  async execute({ workspaceId, includeUnscoped = false } = {}) {
    const all = await this.#repository.findAll();
    if (workspaceId === undefined || workspaceId === null) {
      return all;
    }
    return all.filter((c) => {
      if (c.workspaceId === workspaceId) return true;
      if (includeUnscoped && (c.workspaceId === null || c.workspaceId === undefined)) return true;
      return false;
    });
  }
}
