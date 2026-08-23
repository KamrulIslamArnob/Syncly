/* ============================================================
   BookmarkGroup — Domain entity for bookmark profile groups
   
   Represents a user-created group of Chrome bookmark folders
   for organizing bookmarks by team/business context.
   ============================================================ */

export class BookmarkGroup {
  #id;
  #name;
  #icon;
  #folderIds;
  #createdAt;
  #updatedAt;

  constructor({ id, name, icon, folderIds, createdAt, updatedAt }) {
    this.#id = id;
    this.#name = name;
    this.#icon = icon;
    this.#folderIds = Array.isArray(folderIds) ? [...folderIds] : [];
    this.#createdAt = createdAt || Date.now();
    this.#updatedAt = updatedAt || Date.now();
  }

  // Getters
  get id() { return this.#id; }
  get name() { return this.#name; }
  get icon() { return this.#icon; }
  get folderIds() { return [...this.#folderIds]; }
  get createdAt() { return this.#createdAt; }
  get updatedAt() { return this.#updatedAt; }

  // Reserved folder names that are central/system (cannot be used as workspace name)
  static RESERVED_NAMES = ["Quickie", "Shortcuts", "Collections", "Bookmarks bar", "Other Bookmarks", "Mobile Bookmarks", "All Bookmarks"];

  // Validation
  static validateName(name) {
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new Error("Group name must be a non-empty string");
    }
    const trimmed = name.trim();
    if (trimmed.length > 50) {
      throw new Error("Group name must be 50 characters or less");
    }
    const lower = trimmed.toLowerCase();
    for (const r of BookmarkGroup.RESERVED_NAMES) {
      if (r.toLowerCase() === lower) {
        throw new Error(`"${trimmed}" is a reserved folder name`);
      }
    }
    return trimmed;
  }

  static validateIcon(icon) {
    // Accept any icon from the shared icon set; previously restricted to 24 caused "Invalid icon" on workspace create.
    // ICON_NAMES includes 100+ icons (type, crop, camera, etc.). Keep permissive but still validate shape.
    if (typeof icon !== "string" || icon.trim().length === 0) {
      throw new Error("Icon must be a non-empty string");
    }
    const trimmed = icon.trim();
    // Allow any icon name that matches the icon set pattern (alphanumeric + dash/underscore)
    if (!/^[a-z0-9_-]+$/i.test(trimmed)) {
      throw new Error(`Invalid icon: ${icon}`);
    }
    return trimmed;
  }

  static validateFolderIds(folderIds) {
    if (!Array.isArray(folderIds)) {
      throw new Error("Folder IDs must be an array");
    }
    if (folderIds.length > 50) {
      throw new Error("Cannot select more than 50 folders");
    }
    return folderIds.filter(id => typeof id === "string" && id.length > 0);
  }

  // Mutators
  updateName(name) {
    this.#name = BookmarkGroup.validateName(name);
    this.#updatedAt = Date.now();
  }

  updateIcon(icon) {
    this.#icon = BookmarkGroup.validateIcon(icon);
    this.#updatedAt = Date.now();
  }

  updateFolderIds(folderIds) {
    this.#folderIds = BookmarkGroup.validateFolderIds(folderIds);
    this.#updatedAt = Date.now();
  }

  // Serialization
  toJSON() {
    return {
      id: this.#id,
      name: this.#name,
      icon: this.#icon,
      folderIds: this.#folderIds,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
    };
  }

  static fromJSON(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid BookmarkGroup data");
    }
    let icon = "folder";
    try {
      icon = BookmarkGroup.validateIcon(data.icon || "folder");
    } catch {
      icon = "folder";
    }
    return new BookmarkGroup({
      id: data.id,
      name: BookmarkGroup.validateName(data.name),
      icon,
      folderIds: BookmarkGroup.validateFolderIds(data.folderIds || []),
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
