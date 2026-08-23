/* ============================================================
   UpdateCollectionMembersUseCase — Application use case

   Adds and/or removes bookmark IDs from a collection.
   Persists changes to the repository and emits
   "bookmarkCollections:changed" on the EventBus.
   ============================================================ */

export class UpdateCollectionMembersUseCase {
  #repository;
  #events;
  #bookmarks;

  constructor({ repository, events, bookmarks } = {}) {
    this.#repository = repository;
    this.#events = events;
    this.#bookmarks = bookmarks || (typeof chrome !== "undefined" && chrome.bookmarks ? chrome.bookmarks : null);
  }

  async execute({ collectionId, add = [], remove = [], urls = [], removeUrls = [] }) {
    if (!collectionId) {
      throw new Error("collectionId is required");
    }

    const collection = await this.#repository.findById(collectionId);
    if (!collection) {
      throw new Error(`Collection not found: ${collectionId}`);
    }

    const folderId = collection.folderId || collectionId;

    // Synchronize native Chrome bookmark nodes inside the collection's folder
    if (this.#bookmarks && folderId) {
      try {
        const folderTree = await this.#bookmarks.getSubTree(folderId).catch(() => null);
        const currentChildren = folderTree?.[0]?.children || [];
        const currentUrls = new Set(currentChildren.map((c) => String(c.url || "").toLowerCase()).filter(Boolean));

        // Add bookmarks into native folder
        if (Array.isArray(urls)) {
          for (const u of urls) {
            const rawUrl = typeof u === "object" ? u.url || u.href : u;
            const title = typeof u === "object" ? u.title : "Bookmark";
            if (rawUrl && !currentUrls.has(String(rawUrl).toLowerCase())) {
              try {
                const created = await this.#bookmarks.create({
                  parentId: folderId,
                  title: title || rawUrl,
                  url: rawUrl,
                });
                add.push(String(created.id));
                currentUrls.add(String(rawUrl).toLowerCase());
              } catch (_) {}
            }
          }
        }

        // If bookmark IDs are provided without explicit URLs, find their URLs from live tree and copy
        if (Array.isArray(add) && add.length > 0) {
          for (const item of add) {
            const id = typeof item === "object" ? item.id : item;
            if (id) {
              const node = await this.#bookmarks.get(String(id)).catch(() => null);
              const leaf = node?.[0];
              if (leaf && leaf.url && !currentUrls.has(String(leaf.url).toLowerCase())) {
                try {
                  await this.#bookmarks.create({
                    parentId: folderId,
                    title: leaf.title || leaf.url,
                    url: leaf.url,
                  });
                  currentUrls.add(String(leaf.url).toLowerCase());
                  if (!urls.includes(leaf.url)) urls.push(leaf.url);
                } catch (_) {}
              }
            }
          }
        }

        // Remove matching bookmark nodes from native folder
        if ((Array.isArray(remove) && remove.length > 0) || (Array.isArray(removeUrls) && removeUrls.length > 0)) {
          const toRemoveIdSet = new Set(remove.map(String));
          const toRemoveUrlSet = new Set(removeUrls.map((u) => String(u).toLowerCase()));
          for (const child of currentChildren) {
            if (toRemoveIdSet.has(String(child.id)) || (child.url && toRemoveUrlSet.has(String(child.url).toLowerCase()))) {
              try { await this.#bookmarks.remove(child.id); } catch (_) {}
            }
          }
        }
      } catch (err) {
        console.warn("Could not sync native collection bookmarks:", err);
      }
    }

    if ((Array.isArray(add) && add.length > 0) || (Array.isArray(urls) && urls.length > 0)) {
      collection.addBookmarkIds(add, urls);
    }

    if ((Array.isArray(remove) && remove.length > 0) || (Array.isArray(removeUrls) && removeUrls.length > 0)) {
      collection.removeBookmarkIds(remove, removeUrls);
    }

    const saved = await this.#repository.save(collection);
    this.#events?.emit("bookmarkCollections:changed", { action: "updateMembers", collection: saved.toJSON() });
    return saved;
  }
}
