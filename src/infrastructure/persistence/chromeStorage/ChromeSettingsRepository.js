import { SettingsRepository } from "../../../domain/repositories/repositories.js";
import { UserSettings } from "../../../domain/entities/UserSettings.js";

const KEY = "settings";

export class ChromeSettingsRepository extends SettingsRepository {
  #storage;
  #cache = null;

  constructor(storage) {
    super();
    this.#storage = storage;
  }

  invalidate() {
    this.#cache = null;
  }

  async load() {
    if (this.#cache) return this.#cache;
    const raw = await this.#storage.getOne(KEY);
    this.#cache = UserSettings.fromJSON(raw);
    return this.#cache;
  }

  async save(settings) {
    this.#cache = settings;
    await this.#storage.set(KEY, settings.toJSON());
  }
}