import { Id } from "../../../domain/valueObjects/Id.js";
import { Url } from "../../../domain/valueObjects/Url.js";

export class UpdateBookmarkUseCase {
  #bookmarkRepo;
  #sanitizer;
  #events;

  constructor({ bookmarkRepo, sanitizer, events }) {
    this.#bookmarkRepo = bookmarkRepo;
    this.#sanitizer = sanitizer;
    this.#events = events;
  }

  async execute({
    id,
    title,
    url,
    categoryId,
    order,
    recordAccess,
    faviconUrl,
  }) {
    const bookmark = await this.#bookmarkRepo.findById(new Id(id));
    if (!bookmark) throw new Error("Bookmark not found");

    if (title !== undefined) bookmark.rename(this.#sanitizer.text(title));
    if (url !== undefined) bookmark.retarget(new Url(this.#sanitizer.url(url)));
    if (faviconUrl !== undefined) bookmark.setFaviconUrl(faviconUrl);
    if (categoryId !== undefined) {
      bookmark.moveTo(new Id(this.#sanitizer.text(categoryId)));
    }
    if (order !== undefined) bookmark.reorder(Number(order));
    if (recordAccess === true) bookmark.recordAccess();

    await this.#bookmarkRepo.save(bookmark);
    // Silently persist access tracking without triggering a full re-render
    if (
      !recordAccess ||
      title !== undefined ||
      url !== undefined ||
      faviconUrl !== undefined ||
      categoryId !== undefined ||
      order !== undefined
    ) {
      this.#events.emit("bookmarks:changed", undefined);
    }
    return bookmark;
  }
}
