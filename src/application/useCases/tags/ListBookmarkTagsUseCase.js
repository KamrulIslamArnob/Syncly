// ListBookmarkTagsUseCase — reads the full bookmark-id -> tags[] map.
// Used by BookmarkDeckView to derive per-card tag pills and the tag
// cloud/filter bar without a separate aggregate use case.
export class ListBookmarkTagsUseCase {
  #tagRepo;

  constructor({ tagRepo }) {
    this.#tagRepo = tagRepo;
  }

  async execute() {
    return this.#tagRepo.getAll();
  }
}
