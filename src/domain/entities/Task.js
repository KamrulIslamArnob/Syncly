import { Id } from "../valueObjects/Id.js";

// Domain entity: Task
// Represents one item in the dashboard to-do list.
export class Task {
  #id;
  #title;
  #completed;
  #order;
  #scheduledTime;
  #durationMinutes;
  #dueDate;

  constructor({ id, title, completed = false, order = 0, scheduledTime = "", durationMinutes = null, dueDate = "" }) {
    if (!(id instanceof Id)) throw new Error("Task id must be an Id");
    Task.#validateTitle(title);
    Task.#validateCompleted(completed);
    Task.#validateOrder(order);
    Task.#validateScheduledTime(scheduledTime);
    Task.#validateDurationMinutes(durationMinutes);
    Task.#validateDueDate(dueDate);

    this.#id = id;
    this.#title = title.trim();
    this.#completed = completed;
    this.#order = order;
    this.#scheduledTime = scheduledTime;
    this.#durationMinutes = durationMinutes;
    this.#dueDate = dueDate || "";
  }

  get id() {
    return this.#id;
  }
  get title() {
    return this.#title;
  }
  get completed() {
    return this.#completed;
  }
  get order() {
    return this.#order;
  }
  get scheduledTime() {
    return this.#scheduledTime;
  }
  get durationMinutes() {
    return this.#durationMinutes;
  }

  get dueDate() {
    return this.#dueDate;
  }

  rename(newTitle) {
    Task.#validateTitle(newTitle);
    this.#title = newTitle.trim();
  }

  toggle() {
    this.#completed = !this.#completed;
  }

  setCompleted(value) {
    Task.#validateCompleted(value);
    this.#completed = value;
  }

  reorder(newOrder) {
    Task.#validateOrder(newOrder);
    this.#order = newOrder;
  }

  schedule(scheduledTime, durationMinutes) {
    Task.#validateScheduledTime(scheduledTime);
    Task.#validateDurationMinutes(durationMinutes);
    this.#scheduledTime = scheduledTime;
    this.#durationMinutes = durationMinutes ?? null;
  }

  setDueDate(dueDate) {
    Task.#validateDueDate(dueDate);
    this.#dueDate = dueDate || "";
  }

  toJSON() {
    return {
      id: this.#id.value,
      title: this.#title,
      completed: this.#completed,
      order: this.#order,
      scheduledTime: this.#scheduledTime,
      durationMinutes: this.#durationMinutes,
      dueDate: this.#dueDate || "",
    };
  }

  static fromJSON(json) {
    return new Task({
      id: new Id(json.id),
      title: json.title,
      completed: !!json.completed,
      order: Number.isInteger(json.order) ? json.order : 0,
      scheduledTime: typeof json.scheduledTime === "string" ? json.scheduledTime : "",
      durationMinutes: Number.isInteger(json.durationMinutes) ? json.durationMinutes : null,
      dueDate: typeof json.dueDate === "string" ? json.dueDate : "",
    });
  }

  static #validateTitle(title) {
    if (typeof title !== "string" || title.trim().length === 0) {
      throw new Error("Task title must be a non-empty string");
    }
    if (title.length > 200) throw new Error("Task title must be <= 200 chars");
  }

  static #validateCompleted(completed) {
    if (typeof completed !== "boolean") {
      throw new Error("Task completed must be a boolean");
    }
  }

  static #validateOrder(order) {
    if (!Number.isInteger(order) || order < 0) {
      throw new Error("Task order must be a non-negative integer");
    }
  }

  static #validateScheduledTime(scheduledTime) {
    if (typeof scheduledTime !== "string") {
      throw new Error("Task scheduledTime must be a string");
    }
    if (scheduledTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduledTime)) {
      throw new Error("Task scheduledTime must be HH:MM");
    }
  }

  static #validateDurationMinutes(durationMinutes) {
    if (durationMinutes !== null && durationMinutes !== undefined && (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 1440)) {
      throw new Error("Task durationMinutes must be between 5 and 1440");
    }
  }

  static #validateDueDate(dueDate) {
    if (typeof dueDate !== "string") {
      throw new Error("Task dueDate must be a string");
    }
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      throw new Error("Task dueDate must be YYYY-MM-DD");
    }
    if (dueDate) {
      const d = new Date(dueDate + "T00:00:00");
      if (Number.isNaN(d.getTime())) throw new Error("Task dueDate is not a valid date");
    }
  }
}
