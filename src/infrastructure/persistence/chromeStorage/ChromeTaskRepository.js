import { TaskRepository } from "../../../domain/repositories/repositories.js";
import { Task } from "../../../domain/entities/Task.js";
import { BaseChromeListRepository } from "./BaseChromeListRepository.js";

const KEY = "tasks";

export class ChromeTaskRepository extends TaskRepository {
  #base;

  constructor(storage) {
    super();
    this.#base = new BaseChromeListRepository(storage, KEY, Task.fromJSON);
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

  async save(task) {
    return this.#base.save(task);
  }

  async saveAll(tasks) {
    return this.#base.setAll(tasks);
  }

  async delete(id) {
    return this.#base.delete(id);
  }
}
