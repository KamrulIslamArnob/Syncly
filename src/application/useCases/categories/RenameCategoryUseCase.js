import { Id } from "../../../domain/valueObjects/Id.js";

export class RenameCategoryUseCase {
  #categoryRepo;
  #sanitizer;
  #events;

  constructor({ categoryRepo, sanitizer, events }) {
    this.#categoryRepo = categoryRepo;
    this.#sanitizer = sanitizer;
    this.#events = events;
  }

  async execute({ id, name }) {
    const category = await this.#categoryRepo.findById(new Id(id));
    if (!category) throw new Error("Category not found");
    category.rename(this.#sanitizer.text(name));
    await this.#categoryRepo.save(category);
    this.#events.emit("categories:changed", undefined);
    return category;
  }
}