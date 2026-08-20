import { CategoryRepository } from "../../../domain/repositories/repositories.js";
import { Category } from "../../../domain/entities/Category.js";
import { BaseChromeListRepository } from "./BaseChromeListRepository.js";

const KEY = "categories";

export class ChromeCategoryRepository extends CategoryRepository {
  #base;

  constructor(storage) {
    super();
    this.#base = new BaseChromeListRepository(storage, KEY, Category.fromJSON);
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

  async save(category) {
    return this.#base.save(category);
  }

  async saveAll(categories) {
    return this.#base.saveAll(categories);
  }

  async delete(id) {
    return this.#base.delete(id);
  }

  async findByIdRaw(rawId) {
    return this.#base.findByIdRaw(rawId);
  }
}