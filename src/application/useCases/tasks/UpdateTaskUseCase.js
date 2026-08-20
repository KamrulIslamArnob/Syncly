import { Id } from "../../../domain/valueObjects/Id.js";

export class UpdateTaskUseCase {
  #repo;
  #sanitizer;
  #events;

  constructor({ repo, sanitizer, events }) {
    this.#repo = repo;
    this.#sanitizer = sanitizer;
    this.#events = events;
  }

  async execute({ id, title, completed, scheduledTime, durationMinutes, dueDate }) {
    const tasks = await this.#repo.list();
    const task = tasks.find((t) => t.id.equals(new Id(id)));
    if (!task) throw new Error("Task not found");
    if (title !== undefined) task.rename(this.#sanitizer.text(title));
    if (completed !== undefined) task.setCompleted(!!completed);
    if (scheduledTime !== undefined || durationMinutes !== undefined) {
      const nextTime = scheduledTime !== undefined ? this.#sanitizer.text(scheduledTime) : task.scheduledTime;
      const nextDuration = durationMinutes !== undefined
        ? (durationMinutes === null || durationMinutes === "" ? null : Number(durationMinutes))
        : task.durationMinutes;
      task.schedule(nextTime, nextDuration);
    }
    if (dueDate !== undefined) task.setDueDate(this.#sanitizer.text(dueDate || ""));
    await this.#repo.save(task);
    this.#events.emit("tasks:changed", undefined);
    return task;
  }
}
