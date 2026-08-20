import { Id } from "../valueObjects/Id.js";
import { Url } from "../valueObjects/Url.js";

// Domain entity: Bookmark
// Mutable aggregate with controlled mutation methods so invariants
// (title length, valid Url) are always preserved.
export class Bookmark {
  #id;
  #title;
  #url;
  #categoryId;
  #order;
  #lastAccessed; // timestamp ms or null
  #accessCount; // number
  #faviconUrl; // custom favicon URL/data URL or empty string
  #subfolderId; // optional: Id of subfolder this bookmark belongs to

  constructor({
    id,
    title,
    url,
    categoryId,
    order = 0,
    lastAccessed = null,
    accessCount = 0,
    faviconUrl = "",
    subfolderId = null,
  }) {
    if (!(id instanceof Id)) throw new Error("Bookmark id must be an Id");
    if (!(url instanceof Url)) throw new Error("Bookmark url must be a Url");
    if (!(categoryId instanceof Id))
      throw new Error("Bookmark categoryId must be an Id");
    if (typeof title !== "string" || title.trim().length === 0) {
      throw new Error("Bookmark title must be a non-empty string");
    }
    if (title.length > 120) {
      throw new Error("Bookmark title must be <= 120 chars");
    }
    if (!Number.isInteger(order) || order < 0) {
      throw new Error("Bookmark order must be a non-negative integer");
    }

    this.#id = id;
    this.#title = title.trim();
    this.#url = url;
    this.#categoryId = categoryId;
    this.#order = order;
    this.#lastAccessed = lastAccessed;
    this.#accessCount = typeof accessCount === "number" ? accessCount : 0;
    this.#faviconUrl = Bookmark.#normalizeFaviconUrl(faviconUrl);
    this.#subfolderId = subfolderId;
  }

  get id() {
    return this.#id;
  }
  get title() {
    return this.#title;
  }
  get url() {
    return this.#url;
  }
  get categoryId() {
    return this.#categoryId;
  }
  get order() {
    return this.#order;
  }
  get lastAccessed() {
    return this.#lastAccessed;
  }
  get accessCount() {
    return this.#accessCount;
  }
  get faviconUrl() {
    return this.#faviconUrl;
  }

  get subfolderId() {
    return this.#subfolderId;
  }

  static #normalizeFaviconUrl(value) {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value !== "string")
      throw new Error("faviconUrl must be a string");
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/i.test(trimmed))
      return trimmed;
    if (/^\/public\/favicons\/[a-z0-9_-]+\.svg$/i.test(trimmed)) return trimmed;
    try {
      const parsed = new URL(trimmed);
      if (!/^https?:$/.test(parsed.protocol))
        throw new Error("faviconUrl must be http(s) or an image data URL");
      return parsed.href;
    } catch {
      throw new Error(
        "faviconUrl must be a valid http(s) URL, bundled favicon, or image data URL",
      );
    }
  }

  recordAccess() {
    this.#lastAccessed = Date.now();
    this.#accessCount += 1;
  }

  rename(newTitle) {
    if (typeof newTitle !== "string" || newTitle.trim().length === 0) {
      throw new Error("Bookmark title must be a non-empty string");
    }
    if (newTitle.length > 120) {
      throw new Error("Bookmark title must be <= 120 chars");
    }
    this.#title = newTitle.trim();
  }

  retarget(newUrl) {
    if (!(newUrl instanceof Url)) {
      throw new Error("Bookmark url must be a Url");
    }
    this.#url = newUrl;
  }

  setFaviconUrl(newFaviconUrl) {
    this.#faviconUrl = Bookmark.#normalizeFaviconUrl(newFaviconUrl);
  }

  moveTo(newCategoryId) {
    if (!(newCategoryId instanceof Id)) {
      throw new Error("Bookmark categoryId must be an Id");
    }
    this.#categoryId = newCategoryId;
  }

  reorder(newOrder) {
    if (!Number.isInteger(newOrder) || newOrder < 0) {
      throw new Error("Bookmark order must be a non-negative integer");
    }
    this.#order = newOrder;
  }

  setSubfolderId(newSubfolderId) {
    this.#subfolderId = newSubfolderId;
  }

  toJSON() {
    return {
      id: this.#id.value,
      title: this.#title,
      url: this.#url.href,
      categoryId: this.#categoryId.value,
      order: this.#order,
      lastAccessed: this.#lastAccessed,
      accessCount: this.#accessCount,
      faviconUrl: this.#faviconUrl,
      subfolderId: this.#subfolderId,
    };
  }

  static fromJSON(json) {
    let faviconUrl = "";
    try {
      faviconUrl = Bookmark.#normalizeFaviconUrl(json.faviconUrl ?? "");
    } catch {
      // Legacy/imported data must never brick the whole list; drop the icon.
    }
    return new Bookmark({
      id: new Id(json.id),
      title: json.title,
      url: new Url(json.url),
      categoryId: new Id(json.categoryId),
      order: Number.isInteger(json.order) ? json.order : 0,
      lastAccessed: json.lastAccessed ?? null,
      accessCount: typeof json.accessCount === "number" ? json.accessCount : 0,
      faviconUrl,
      subfolderId: json.subfolderId || null,
    });
  }
}
