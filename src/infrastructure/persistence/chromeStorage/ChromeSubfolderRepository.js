import { SubfolderRepository } from "../../../domain/repositories/repositories.js";
import { Subfolder } from "../../../domain/entities/Subfolder.js";
import { BaseChromeListRepository } from "./BaseChromeListRepository.js";

const KEY = "subfolders";

export class ChromeSubfolderRepository extends SubfolderRepository {
  #base;

  constructor(storage) {
    super();
    this.#base = new BaseChromeListRepository(storage, KEY, Subfolder.fromJSON);
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

  async save(subfolder) {
    return this.#base.save(subfolder);
  }

  async saveAll(subfolders) {
    return this.#base.saveAll(subfolders);
  }

  async delete(id) {
    return this.#base.delete(id);
  }

  async findByIdRaw(rawId) {
    return this.#base.findByIdRaw(rawId);
  }
}
