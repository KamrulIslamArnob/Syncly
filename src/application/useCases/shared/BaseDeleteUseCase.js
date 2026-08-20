import { Id } from "../../../domain/valueObjects/Id.js";

// Base class for deleting domain entities
export class BaseDeleteUseCase {
  #repo;
  #events;
  #eventName;

  constructor(repo, events, eventName) {
    this.#repo = repo;
    this.#events = events;
    this.#eventName = eventName;
  }

  async execute(arg) {
    const rawId = (arg && typeof arg === "object" && "id" in arg) ? arg.id : arg;
    const targetId = rawId instanceof Id ? rawId : new Id(rawId);
    await this.#repo.delete(targetId);
    this.#events.emit(this.#eventName, undefined);
  }
}
