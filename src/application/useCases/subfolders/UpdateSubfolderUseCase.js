import { Id } from "../../../domain/valueObjects/Id.js";

export class UpdateSubfolderUseCase {
  #subfolderRepo;
  #sanitizer;
  #events;

  constructor({ subfolderRepo, sanitizer, events }) {
    this.#subfolderRepo = subfolderRepo;
    this.#sanitizer = sanitizer;
    this.#events = events;
  }

  async execute({ id, name }) {
    const subfolder = await this.#subfolderRepo.findById(new Id(id));
    if (!subfolder) throw new Error("Subfolder not found");

    const newName = (name ?? "").trim();
    if (newName && newName !== subfolder.name) {
      subfolder.rename(this.#sanitizer.text(newName));
      await this.#subfolderRepo.save(subfolder);
    }

    this.#events.emit("subfolders:changed", undefined);
    this.#events.emit("categories:changed", undefined);
    return subfolder;
  }
}
