import { Bookmark } from "../../../domain/entities/Bookmark.js";
import { Id } from "../../../domain/valueObjects/Id.js";
import { Url } from "../../../domain/valueObjects/Url.js";

export class CreateBookmarkUseCase {
  #bookmarkRepo;
  #categoryRepo;
  #ids;
  #sanitizer;
  #events;

  constructor({ bookmarkRepo, categoryRepo, ids, sanitizer, events }) {
    this.#bookmarkRepo = bookmarkRepo;
    this.#categoryRepo = categoryRepo;
    this.#ids = ids;
    this.#sanitizer = sanitizer;
    this.#events = events;
  }

  async execute({ title, url, categoryId, faviconUrl, subfolderId }) {
    const safeTitle = this.#sanitizer.text(title);
    const safeUrl = this.#sanitizer.url(url);
    const safeCategoryId = this.#sanitizer.text(categoryId);

    const category = await this.#categoryRepo.findById(new Id(safeCategoryId));
    if (!category) {
      throw new Error("Cannot add bookmark: category does not exist");
    }

    const bookmarks = await this.#bookmarkRepo.list();
    const inCategory = bookmarks.filter((bookmark) =>
      bookmark.categoryId.equals(category.id),
    );
    const nextOrder =
      inCategory.reduce((max, bookmark) => Math.max(max, bookmark.order), -1) +
      1;

    const bookmark = new Bookmark({
      id: new Id(this.#ids.next()),
      title: safeTitle,
      url: new Url(safeUrl),
      categoryId: category.id,
      order: nextOrder,
      faviconUrl,
      subfolderId: subfolderId || null,
    });

    await this.#bookmarkRepo.save(bookmark);
    this.#events.emit("bookmarks:changed", undefined);
    return bookmark;
  }
}
