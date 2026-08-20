// Domain layer repository interfaces (a.k.a. "ports").
// The domain defines *what* it needs; infrastructure defines *how*.
// Concrete implementations live under src/infrastructure/.

import { Bookmark } from "../entities/Bookmark.js";
import { Category } from "../entities/Category.js";
import { UserSettings } from "../entities/UserSettings.js";
import { Task } from "../entities/Task.js";
import { WidgetLayout } from "../entities/WidgetLayout.js";
import { Subfolder } from "../entities/Subfolder.js";

export class BookmarkRepository {
  /** @returns {Promise<Bookmark[]>} */
  async list() { throw new Error("not implemented"); }
  /** @param {Bookmark} bookmark */
  async save(bookmark) { throw new Error("not implemented"); }
  /** @param {Bookmark[]} bookmarks all bookmarks in the new order */
  async saveAll(bookmarks) { throw new Error("not implemented"); }
  /** @param {import("../valueObjects/Id.js").Id} id */
  async delete(id) { throw new Error("not implemented"); }
  /** @param {import("../valueObjects/Id.js").Id} id */
  async findById(id) { throw new Error("not implemented"); }
}

export class CategoryRepository {
  /** @returns {Promise<Category[]>} */
  async list() { throw new Error("not implemented"); }
  /** @param {Category} category */
  async save(category) { throw new Error("not implemented"); }
  /** @param {Category[]} categories all categories in the new order */
  async saveAll(categories) { throw new Error("not implemented"); }
  /** @param {import("../valueObjects/Id.js").Id} id */
  async delete(id) { throw new Error("not implemented"); }
  /** @param {import("../valueObjects/Id.js").Id} id */
  async findById(id) { throw new Error("not implemented"); }
}

export class SettingsRepository {
  /** @returns {Promise<UserSettings>} */
  async load() { throw new Error("not implemented"); }
  /** @param {UserSettings} settings */
  async save(settings) { throw new Error("not implemented"); }
}

export class TaskRepository {
  /** @returns {Promise<Task[]>} */
  async list() { throw new Error("not implemented"); }
  /** @param {Task} task */
  async save(task) { throw new Error("not implemented"); }
  /** @param {Task[]} tasks all tasks in the new order */
  async saveAll(tasks) { throw new Error("not implemented"); }
  /** @param {import("../valueObjects/Id.js").Id} id */
  async delete(id) { throw new Error("not implemented"); }
}


export class LayoutRepository {
  /** @returns {Promise<WidgetLayout[]>} */
  async list() { throw new Error("not implemented"); }
  /** @param {WidgetLayout} widget */
  async save(widget) { throw new Error("not implemented"); }
  /** @param {WidgetLayout[]} widgets */
  async saveAll(widgets) { throw new Error("not implemented"); }
}

export class SubfolderRepository {
  /** @returns {Promise<Subfolder[]>} */
  async list() { throw new Error("not implemented"); }
  /** @param {Subfolder} subfolder */
  async save(subfolder) { throw new Error("not implemented"); }
  /** @param {Subfolder[]} subfolders all subfolders in the new order */
  async saveAll(subfolders) { throw new Error("not implemented"); }
  /** @param {import("../valueObjects/Id.js").Id} id */
  async delete(id) { throw new Error("not implemented"); }
  /** @param {import("../valueObjects/Id.js").Id} id */
  async findById(id) { throw new Error("not implemented"); }
}

export class ModeRepository {
  /** @returns {Promise<string>} "home" | "ai" */
  async get() { throw new Error("not implemented"); }
  /** @param {string} mode */
  async set(mode) { throw new Error("not implemented"); }
}
