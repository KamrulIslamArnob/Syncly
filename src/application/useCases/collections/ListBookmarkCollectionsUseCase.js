/* ============================================================
   ListBookmarkCollectionsUseCase — Application use case

   Retrieves all curated bookmark collections.
   ============================================================ */

export class ListBookmarkCollectionsUseCase {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  async execute() {
    return await this.#repository.findAll();
  }
}
