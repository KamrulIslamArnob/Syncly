import { Category } from "../../../domain/entities/Category.js";
import { Id } from "../../../domain/valueObjects/Id.js";

export class CreateCategoryUseCase {
  #categoryRepo;
  #bookmarkRepo;
  #ids;
  #sanitizer;
  #events;

  constructor({ categoryRepo, bookmarkRepo, ids, sanitizer, events }) {
    this.#categoryRepo = categoryRepo;
    this.#bookmarkRepo = bookmarkRepo;
    this.#ids = ids;
    this.#sanitizer = sanitizer;
    this.#events = events;
  }

  async execute({ name }) {
    const categories = await this.#categoryRepo.list();
    const nextOrder = categories.reduce((max, category) => Math.max(max, category.order), -1) + 1;
    const category = new Category({
      id: new Id(this.#ids.next()),
      name: this.#sanitizer.text(name),
      order: nextOrder,
    });
    await this.#categoryRepo.save(category);
    this.#events.emit("categories:changed", undefined);
    return category;
  }
}
