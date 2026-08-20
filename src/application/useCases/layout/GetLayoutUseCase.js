import { WidgetLayout } from "../../../domain/entities/WidgetLayout.js";

export class GetLayoutUseCase {
  #repo;

  constructor(repo) {
    this.#repo = repo;
  }

  async execute() {
    const stored = await this.#repo.list();
    if (stored.length > 0) return stored;
    // First launch: seed a clean default layout.
    const defaults = WidgetLayout.defaults();
    await this.#repo.saveAll(defaults);
    return defaults;
  }
}