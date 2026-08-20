import { Id } from "../../../domain/valueObjects/Id.js";

export class DeleteSubfolderUseCase {
  #subfolderRepo;
  #bookmarkRepo;
  #events;

  constructor({ subfolderRepo, bookmarkRepo, events }) {
    this.#subfolderRepo = subfolderRepo;
    this.#bookmarkRepo = bookmarkRepo;
    this.#events = events;
  }

  async execute({ id }) {
    const subfolder = await this.#subfolderRepo.findById(new Id(id));
    if (!subfolder) throw new Error("Subfolder not found");

    const bookmarks = await this.#bookmarkRepo.list();
    const orphaned = bookmarks.filter((b) => {
      // Move bookmarks that had this subfolder as their category back to... 
      // they stay here — subfolders are a view-level concept.
      // Bookmarks are categorized by categoryId, not subfolderId.
      return false;
    });

    await this.#subfolderRepo.delete(new Id(id));
    this.#events.emit("subfolders:changed", undefined);
    this.#events.emit("categories:changed", undefined);
  }
}
