import { Subfolder } from "../../../domain/entities/Subfolder.js";
import { Id } from "../../../domain/valueObjects/Id.js";

export class CreateSubfolderUseCase {
  #subfolderRepo;
  #categoryRepo;
  #bookmarkRepo;
  #ids;
  #sanitizer;
  #events;

  constructor({ subfolderRepo, categoryRepo, bookmarkRepo, ids, sanitizer, events }) {
    this.#subfolderRepo = subfolderRepo;
    this.#categoryRepo = categoryRepo;
    this.#bookmarkRepo = bookmarkRepo;
    this.#ids = ids;
    this.#sanitizer = sanitizer;
    this.#events = events;
  }

  async execute({ name, categoryId }) {
    const categories = await this.#categoryRepo.list();
    const cat = categories.find((c) => c.id.value === categoryId);
    if (!cat) throw new Error("Category not found");

    const subfolders = await this.#subfolderRepo.list();
    const catSubfolders = subfolders.filter((s) => s.categoryId.value === categoryId);
    const nextOrder = catSubfolders.reduce((max, sf) => Math.max(max, sf.order), -1) + 1;

    const subfolder = new Subfolder({
      id: new Id(this.#ids.next()),
      name: this.#sanitizer.text(name),
      categoryId: new Id(categoryId),
      order: nextOrder,
    });

    await this.#subfolderRepo.save(subfolder);
    this.#events.emit("subfolders:changed", undefined);
    this.#events.emit("categories:changed", undefined);
    return subfolder;
  }
}
