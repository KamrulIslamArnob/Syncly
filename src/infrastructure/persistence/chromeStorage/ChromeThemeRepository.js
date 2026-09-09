import { CustomTheme } from "../../../domain/entities/CustomTheme.js";
import { ThemeRepository } from "../../../domain/repositories/ThemeRepository.js";
import { ThemeRegistry } from "../../../domain/services/ThemeRegistry.js";

/**
 * ChromeThemeRepository
 * --------------------------------------------------------------------
 * Chrome Storage implementation of ThemeRepository.
 * Manages persistence of custom themes and keeps ThemeRegistry in sync.
 */
export class ChromeThemeRepository extends ThemeRepository {
  #storage;
  #key = "customThemes";
  #cache = null;

  constructor(storage) {
    super();
    this.#storage = storage;
  }

  async #load() {
    if (this.#cache) return this.#cache;
    let data = null;
    try {
      data = await this.#storage.get(this.#key);
    } catch {
      data = null;
    }

    const items = [];
    if (Array.isArray(data)) {
      for (const row of data) {
        try {
          const theme = CustomTheme.fromJSON(row);
          items.push(theme);
          ThemeRegistry.register(theme.manifest);
        } catch (err) {
          console.warn("Skipping unparseable custom theme:", row, err);
        }
      }
    } else if (data && typeof data === "object") {
      for (const row of Object.values(data)) {
        try {
          const theme = CustomTheme.fromJSON(row);
          items.push(theme);
          ThemeRegistry.register(theme.manifest);
        } catch (err) {
          console.warn("Skipping unparseable custom theme:", row, err);
        }
      }
    }

    this.#cache = items;
    return this.#cache;
  }

  async #flush() {
    const serialized = (this.#cache || []).map(t => t.toJSON());
    await this.#storage.set(this.#key, serialized);
  }

  clearCache() {
    this.#cache = null;
  }

  async findAll() {
    const all = await this.#load();
    return [...all];
  }

  async findById(id) {
    if (!id) return null;
    const all = await this.#load();
    return all.find(t => t.id === id) || null;
  }

  async save(customTheme) {
    if (!(customTheme instanceof CustomTheme)) {
      throw new Error("Expected CustomTheme entity instance");
    }
    const all = await this.#load();
    const idx = all.findIndex(t => t.id === customTheme.id);
    if (idx >= 0) {
      all[idx] = customTheme;
    } else {
      all.push(customTheme);
    }
    ThemeRegistry.register(customTheme.manifest);
    await this.#flush();
    return customTheme;
  }

  async delete(id) {
    if (!id) return;
    const all = await this.#load();
    const filtered = all.filter(t => t.id !== id);
    this.#cache = filtered;
    ThemeRegistry.unregister(id);
    await this.#flush();
  }

  async exists(id) {
    if (!id) return false;
    const all = await this.#load();
    return all.some(t => t.id === id);
  }
}
