import { Id } from "../../../domain/valueObjects/Id.js";

export class ToggleWidgetVisibilityUseCase {
  #layoutRepo;
  #events;

  constructor({ layoutRepo, events }) {
    this.#layoutRepo = layoutRepo;
    this.#events = events;
  }

  async execute({ id, visible }) {
    const list = await this.#layoutRepo.list();
    const targetId = new Id(id);
    const widget = list.find((w) => w.id.equals(targetId));
    if (!widget) {
      throw new Error(`Widget not found: ${id}`);
    }
    const nextVisible = typeof visible === "boolean" ? visible : !widget.visible;
    widget.setVisible(nextVisible);
    await this.#layoutRepo.save(widget);
    this.#events?.emit("layout:changed", widget);
    return widget;
  }
}