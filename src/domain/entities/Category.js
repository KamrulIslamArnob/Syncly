import { Id } from "../valueObjects/Id.js";

// Domain entity: Category
// A user-defined grouping of bookmarks.
export class Category {
  #id;
  #name;
  #order;

  constructor({ id, name, order = 0 }) {
    if (!(id instanceof Id)) throw new Error("Category id must be an Id");
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new Error("Category name must be a non-empty string");
    }
    if (name.length > 60) {
      throw new Error("Category name must be <= 60 chars");
    }
    if (!Number.isInteger(order) || order < 0) {
      throw new Error("Category order must be a non-negative integer");
    }
    this.#id = id;
    this.#name = name.trim();
    this.#order = order;
  }

  get id() {
    return this.#id;
  }
  get name() {
    return this.#name;
  }
  get order() {
    return this.#order;
  }

  rename(newName) {
    if (typeof newName !== "string" || newName.trim().length === 0) {
      throw new Error("Category name must be a non-empty string");
    }
    if (newName.length > 60) {
      throw new Error("Category name must be <= 60 chars");
    }
    this.#name = newName.trim();
  }

  reorder(newOrder) {
    if (!Number.isInteger(newOrder) || newOrder < 0) {
      throw new Error("Category order must be a non-negative integer");
    }
    this.#order = newOrder;
  }

  toJSON() {
    return { id: this.#id.value, name: this.#name, order: this.#order };
  }

  static fromJSON(json) {
    return new Category({
      id: new Id(json.id),
      name: json.name,
      order: Number.isInteger(json.order) ? json.order : 0,
    });
  }
}
