import { LayoutRepository } from "../../../domain/repositories/repositories.js";
import { WidgetLayout } from "../../../domain/entities/WidgetLayout.js";
import { BaseChromeListRepository } from "./BaseChromeListRepository.js";

const KEY = "layout";

export class ChromeLayoutRepository extends LayoutRepository {
  #base;

  constructor(storage) {
    super();
    this.#base = new BaseChromeListRepository(storage, KEY, WidgetLayout.fromJSON);
  }

  invalidate() {
    this.#base.invalidate();
  }

  async list() {
    return this.#base.list();
  }

  async findById(id) {
    return this.#base.findById(id);
  }

  async save(widget) {
    return this.#base.save(widget);
  }

  async saveAll(widgets) {
    return this.#base.setAll(widgets);
  }
}
