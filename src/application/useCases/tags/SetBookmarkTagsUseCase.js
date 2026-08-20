const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 24;

/**
 * Normalize one raw tag string: sanitize, trim, drop a leading "#",
 * lowercase, collapse internal whitespace, cap length. Returns "" for
 * anything that ends up empty (caller filters those out).
 */
function normalizeTag(raw, sanitizer) {
  const clean = sanitizer.text(String(raw ?? ""));
  const stripped = clean.replace(/^#+/, "").trim().toLowerCase().replace(/\s+/g, " ");
  return stripped.slice(0, MAX_TAG_LENGTH);
}

// SetBookmarkTagsUseCase — replaces the tag list for one native
// chrome.bookmarks id. Validation lives here (trim/lowercase/strip
// leading "#"/dedupe/cap count+length) rather than in a domain value
// object — a handful of string rules doesn't earn a new VO class.
export class SetBookmarkTagsUseCase {
  #tagRepo;
  #sanitizer;
  #events;

  constructor({ tagRepo, sanitizer, events }) {
    this.#tagRepo = tagRepo;
    this.#sanitizer = sanitizer;
    this.#events = events;
  }

  async execute({ bookmarkId, tags }) {
    if (!bookmarkId) throw new Error("bookmarkId is required");
    const list = Array.isArray(tags) ? tags : [];

    const seen = new Set();
    const clean = [];
    for (const raw of list) {
      const tag = normalizeTag(raw, this.#sanitizer);
      if (!tag || seen.has(tag)) continue;
      seen.add(tag);
      clean.push(tag);
      if (clean.length >= MAX_TAGS) break;
    }

    const saved = await this.#tagRepo.setTags(bookmarkId, clean);
    this.#events.emit("bookmarkTags:changed", { bookmarkId, tags: saved });
    return saved;
  }
}
