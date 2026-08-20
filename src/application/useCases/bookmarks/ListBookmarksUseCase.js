import { BookmarkRepository } from "../../../domain/repositories/repositories.js";

export class ListBookmarksUseCase {
  #repo;

  /** @param {BookmarkRepository} repo */
  constructor(repo) {
    this.#repo = repo;
  }

  async execute() {
    return this.#repo.list();
  }
}