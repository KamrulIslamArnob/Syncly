import { Id } from "../valueObjects/Id.js";

export class Subfolder {
  #id;
  #name;
  #categoryId;
  #order;

  constructor({ id, name, categoryId, order = 0 }) {
    if (!(id instanceof Id)) throw new Error("Subfolder id must be an Id");
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new Error("Subfolder name must be a non-empty string");
    }
    if (name.length > 60) {
      throw new Error("Subfolder name must be <= 60 chars");
    }
    if (!(categoryId instanceof Id)) {
      throw new Error("Subfolder categoryId must be an Id");
    }
    if (!Number.isInteger(order) || order < 0) {
      throw new Error("Subfolder order must be a non-negative integer");
    }

    this.#id = id;
    this.#name = name.trim();
    this.#categoryId = categoryId;
    this.#order = order;
  }

  get id() { return this.#id; }
  get name() { return this.#name; }
  get categoryId() { return this.#categoryId; }
  get order() { return this.#order; }

  rename(newName) {
    if (typeof newName !== "string" || newName.trim().length === 0) {
      throw new Error("Subfolder name must be a non-empty string");
    }
    if (newName.length > 60) {
      throw new Error("Subfolder name must be <= 60 chars");
    }
    this.#name = newName.trim();
  }

  reorder(newOrder) {
    if (!Number.isInteger(newOrder) || newOrder < 0) {
      throw new Error("Subfolder order must be a non-negative integer");
    }
    this.#order = newOrder;
  }

  toJSON() {
    return {
      id: this.#id.value,
      name: this.#name,
      categoryId: this.#categoryId.value,
      order: this.#order,
    };
  }

  static fromJSON(json) {
    return new Subfolder({
      id: new Id(json.id),
      name: json.name,
      categoryId: new Id(json.categoryId),
      order: Number.isInteger(json.order) ? json.order : 0,
    });
  }
}
