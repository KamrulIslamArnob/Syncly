import { Task } from "../../../domain/entities/Task.js";
import { Id } from "../../../domain/valueObjects/Id.js";

export class CreateTaskUseCase {
  #repo;
  #ids;
  #sanitizer;
  #events;

  constructor({ repo, ids, sanitizer, events }) {
    this.#repo = repo;
    this.#ids = ids;
    this.#sanitizer = sanitizer;
    this.#events = events;
  }

  async execute({ title, scheduledTime = "", durationMinutes = null, dueDate = "" }) {
    const tasks = await this.#repo.list();
    const nextOrder = tasks.reduce((m, t) => Math.max(m, t.order), -1) + 1;
    const task = new Task({
      id: new Id(this.#ids.next()),
      title: this.#sanitizer.text(title),
      completed: false,
      order: nextOrder,
      scheduledTime: this.#sanitizer.text(scheduledTime),
      durationMinutes: durationMinutes === null || durationMinutes === "" ? null : Number(durationMinutes),
      dueDate: this.#sanitizer.text(dueDate || ""),
    });
    await this.#repo.save(task);
    this.#events.emit("tasks:changed", undefined);
    return task;
  }
}
