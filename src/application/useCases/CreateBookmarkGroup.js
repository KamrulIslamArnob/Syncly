/* ============================================================
   CreateBookmarkGroup — Application use case
   
   Creates a new bookmark group with validation.
   ============================================================ */

import { BookmarkGroup } from "../../domain/entities/BookmarkGroup.js";

export class CreateBookmarkGroup {
  /**
   * @param {object} repository
   * @param {object} [deps]
   * @param {{ execute(workspaceId, opts?): Promise<object> }} [deps.ensureWorkspaceStructure]
   *   Bootstraps Collections + Shortcuts under the new w-* root after save.
   */
  constructor(repository, { ensureWorkspaceStructure = null } = {}) {
    this.repository = repository;
    this.ensureWorkspaceStructure = ensureWorkspaceStructure;
  }

  async execute({ name, icon, folderIds, rootFolderId = null }) {
    const id = crypto.randomUUID();
    const resolvedRoot = rootFolderId || (Array.isArray(folderIds) && folderIds[0] ? String(folderIds[0]) : null);
    const group = new BookmarkGroup({
      id,
      name: BookmarkGroup.validateName(name),
      icon: BookmarkGroup.validateIcon(icon),
      folderIds: BookmarkGroup.validateFolderIds(folderIds),
      rootFolderId: resolvedRoot,
    });

    const existingGroups = await this.repository.findAll();
    if (existingGroups.length >= 10) {
      throw new Error("Maximum of 10 bookmark groups allowed");
    }
    if (existingGroups.some((g) => g.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      throw new Error(`A workspace named "${name}" already exists`);
    }

    const saved = await this.repository.save(group);

    // Bootstrap workspace-owned Collections + Shortcuts under the w-* root
    if (this.ensureWorkspaceStructure && resolvedRoot) {
      try {
        await this.ensureWorkspaceStructure.execute(id);
      } catch (err) {
        console.warn("CreateBookmarkGroup: workspace structure bootstrap failed:", err);
      }
    }

    return saved;
  }
}
