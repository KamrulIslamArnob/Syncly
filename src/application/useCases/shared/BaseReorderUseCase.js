// Base class for reordering domain entities
export class BaseReorderUseCase {
  #repo;
  #events;
  #eventName;

  constructor(repo, events, eventName) {
    this.#repo = repo;
    this.#events = events;
    this.#eventName = eventName;
  }

  async execute({ orderedIds }) {
    const all = await this.#repo.list();
    const byId = new Map(all.map((item) => [item.id.value, item]));
    const seen = new Set();
    let next = 0;

    const reordered = [];
    for (const raw of orderedIds) {
      const item = byId.get(raw);
      if (!item) continue;
      seen.add(raw);
      item.reorder(next++);
      reordered.push(item);
    }
    for (const item of all) {
      if (seen.has(item.id.value)) continue;
      item.reorder(next++);
      reordered.push(item);
    }
    await this.#repo.saveAll(reordered);
    this.#events.emit(this.#eventName, undefined);
    return reordered;
  }
}
