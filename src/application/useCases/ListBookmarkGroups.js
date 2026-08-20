/* ============================================================
   ListBookmarkGroups — Application use case
   
   Lists all bookmark groups.
   ============================================================ */

export class ListBookmarkGroups {
  constructor(repository) {
    this.repository = repository;
  }

  async execute() {
    return await this.repository.findAll();
  }
}
