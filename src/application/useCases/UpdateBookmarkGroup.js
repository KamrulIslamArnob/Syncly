/* ============================================================
   UpdateBookmarkGroup — Application use case
   
   Updates an existing bookmark group.
   ============================================================ */

import { BookmarkGroup } from "../../domain/entities/BookmarkGroup.js";

export class UpdateBookmarkGroup {
  constructor(repository) {
    this.repository = repository;
  }

  async execute({ id, name, icon, folderIds }) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error("Bookmark group not found");
    }

    if (name !== undefined) {
      existing.updateName(name);
    }
    if (icon !== undefined) {
      existing.updateIcon(icon);
    }
    if (folderIds !== undefined) {
      existing.updateFolderIds(folderIds);
    }

    return await this.repository.save(existing);
  }
}
