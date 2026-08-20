import { Id } from "../../../domain/valueObjects/Id.js";

// Base class for ChromeStorage repositories that manage a list of entities
export class BaseChromeListRepository {
  #storage;
  #key;
  #fromJSON;
  #cache = null;

  constructor(storage, key, fromJSON) {
    this.#storage = storage;
    this.#key = key;
    this.#fromJSON = fromJSON;
  }

  async #load() {
    if (this.#cache) return this.#cache;
    const rows = await this.#storage.getAll(this.#key);
    const items = [];
    for (const r of Array.isArray(rows) ? rows : []) {
      try {
        items.push(this.#fromJSON(r));
      } catch (err) {
        // Legacy/imported rows must never brick the whole list.
        console.warn("Skipping unparseable stored row", this.#key, r, err);
      }
    }
    this.#cache = items;
    return this.#cache;
  }

  async #flush() {
    await this.#storage.set(
      this.#key,
      this.#cache.map(item => item.toJSON()),
    );
  }

  invalidate() {
    this.#cache = null;
  }

  async list() {
    return [...(await this.#load())];
  }

  async findById(id) {
    const all = await this.#load();
    return all.find(item => item.id.equals(id)) ?? null;
  }

  async save(item) {
    const all = await this.#load();
    const idx = all.findIndex(i => i.id.equals(item.id));
    if (idx >= 0) all[idx] = item;
    else all.push(item);
    await this.#flush();
  }

  async saveAll(items) {
    await this.#load();
    for (const item of items) {
      const idx = this.#cache.findIndex(i => i.id.equals(item.id));
      if (idx >= 0) this.#cache[idx] = item;
      else this.#cache.push(item);
    }
    await this.#flush();
  }

  async setAll(items) {
    await this.#load();
    this.#cache = [...items];
    await this.#flush();
  }

  async delete(id) {
    const all = await this.#load();
    this.#cache = all.filter(item => !item.id.equals(id));
    await this.#flush();
  }

  async findByIdRaw(rawId) {
    return this.findById(new Id(rawId));
  }
}
