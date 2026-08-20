import { BookmarkRepository } from "../../../domain/repositories/repositories.js";
import { Bookmark } from "../../../domain/entities/Bookmark.js";
import { BaseChromeListRepository } from "./BaseChromeListRepository.js";

const KEY = "bookmarks";

export class ChromeBookmarkRepository extends BookmarkRepository {
  #base;

  constructor(storage) {
    super();
    this.#base = new BaseChromeListRepository(storage, KEY, Bookmark.fromJSON);
  }

  invalidate() {
    this.#base.invalidate();
  }

  async list() {
    return this.#base.list();
  }

  async findById(id) {
    return this.#base.findById(id);
  }

  async save(bookmark) {
    return this.#base.save(bookmark);
  }

  async saveAll(bookmarks) {
    return this.#base.saveAll(bookmarks);
  }

  async delete(id) {
    return this.#base.delete(id);
  }

  async findByIdRaw(rawId) {
    return this.#base.findByIdRaw(rawId);
  }
}
