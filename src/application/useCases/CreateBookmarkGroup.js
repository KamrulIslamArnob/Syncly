/* ============================================================
   CreateBookmarkGroup — Application use case
   
   Creates a new bookmark group with validation.
   ============================================================ */

import { BookmarkGroup } from "../../domain/entities/BookmarkGroup.js";

export class CreateBookmarkGroup {
  constructor(repository) {
    this.repository = repository;
  }

  async execute({ name, icon, folderIds }) {
    const id = crypto.randomUUID();
    const group = new BookmarkGroup({
      id,
      name: BookmarkGroup.validateName(name),
      icon: BookmarkGroup.validateIcon(icon),
      folderIds: BookmarkGroup.validateFolderIds(folderIds),
    });

    const existingGroups = await this.repository.findAll();
    if (existingGroups.length >= 10) {
      throw new Error("Maximum of 10 bookmark groups allowed");
    }
    if (existingGroups.some((g) => g.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      throw new Error(`A workspace named "${name}" already exists`);
    }

    return await this.repository.save(group);
  }
}
