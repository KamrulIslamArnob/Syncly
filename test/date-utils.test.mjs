import test, { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  toISODateLocal,
  isValidDueDateString,
  parseDueDateLocal,
  dueForPreset,
  isOverdue,
  isToday,
  daysUntil,
  labelForDue,
  matchesTaskFilter,
  getMonthGrid,
  shouldResetDailyFocus,
  todayISO,
  thisSundayISO,
  formatHeaderDate,
  reminderForTask,
} from "../src/domain/services/dateUtils.js";
import { Task } from "../src/domain/entities/Task.js";
import { Id } from "../src/domain/valueObjects/Id.js";
import { ReorderTasksUseCase } from "../src/application/useCases/tasks/ReorderTasksUseCase.js";
import { UpdateDailyFocusUseCase } from "../src/application/useCases/settings/UpdateDailyFocusUseCase.js";
import { EventBus } from "../src/application/ports/EventBus.js";
import { BasicSanitizer } from "../src/infrastructure/security/BasicSanitizer.js";

const D = (y, m, d, h = 12) => new Date(y, m - 1, d, h);

describe("dateUtils", () => {
  it("toISODateLocal pads", () => {
    assert.equal(toISODateLocal(D(2026, 9, 5)), "2026-09-05");
  });
  it("strict validation rejects Feb 30 / month 13", () => {
    assert.equal(isValidDueDateString("2026-02-30"), false);
    assert.equal(isValidDueDateString("2026-13-01"), false);
    assert.equal(isValidDueDateString("2026-02-28"), true);
    assert.equal(isValidDueDateString("2024-02-29"), true); // leap
    assert.equal(isValidDueDateString("2025-02-29"), false);
    assert.equal(isValidDueDateString(""), true);
  });
  it("dueForPreset matches legacy behavior", () => {
    const now = D(2026, 9, 14); // Monday
    assert.equal(dueForPreset("today", now), "2026-09-14");
    assert.equal(dueForPreset("tomorrow", now), "2026-09-15");
    assert.equal(dueForPreset("in3days", now), "2026-09-17");
    assert.equal(dueForPreset("thisWeek", now), "2026-09-20"); // Sunday
    assert.equal(dueForPreset("none", now), "");
    assert.equal(dueForPreset("bogus", now), "");
  });
  it("overdue / today / daysUntil", () => {
    const now = D(2026, 9, 14);
    assert.equal(isOverdue("2026-09-13", now), true);
    assert.equal(isOverdue("2026-09-14", now), false);
    assert.equal(isOverdue("", now), false);
    assert.equal(isToday("2026-09-14", now), true);
    assert.equal(daysUntil("2026-09-13", now), -1);
    assert.equal(daysUntil("2026-09-17", now), 3);
  });
  it("labelForDue covers overdue + presets", () => {
    const now = D(2026, 9, 14);
    assert.equal(labelForDue("2026-09-14", now), "Today");
    assert.equal(labelForDue("2026-09-15", now), "Tomorrow");
    assert.equal(labelForDue("2026-09-13", now), "Yesterday · Overdue");
    assert.match(labelForDue("2026-09-10", now), /Overdue/);
    assert.equal(labelForDue("2026-09-20", now), "This week");
    assert.equal(labelForDue("", now), "");
  });
  it("matchesTaskFilter", () => {
    const now = D(2026, 9, 14);
    assert.equal(matchesTaskFilter({ dueDate: "2026-09-13" }, "overdue", now), true);
    assert.equal(matchesTaskFilter({ dueDate: "2026-09-14" }, "today", now), true);
    assert.equal(matchesTaskFilter({ dueDate: "" }, "none", now), true);
    assert.equal(matchesTaskFilter({ dueDate: "2026-09-14" }, "none", now), false);
    assert.equal(matchesTaskFilter({ dueDate: "2026-09-20" }, "week", now), true);
    assert.equal(matchesTaskFilter({ dueDate: "2026-10-20" }, "week", now), false);
  });
  it("getMonthGrid 42 cells, today flagged", () => {
    const cells = getMonthGrid(2026, 8, { today: D(2026, 9, 14), tasksByDue: new Map([["2026-09-14", 2]]) });
    assert.equal(cells.length, 42);
    const today = cells.find((c) => c.iso === "2026-09-14");
    assert.ok(today.isToday);
    assert.equal(today.taskCount, 2);
  });
  it("shouldResetDailyFocus + formatHeaderDate", () => {
    const now = D(2026, 9, 14);
    assert.equal(shouldResetDailyFocus("2026-09-13", now), true);
    assert.equal(shouldResetDailyFocus("2026-09-14", now), false);
    assert.equal(shouldResetDailyFocus("", now), false);
    assert.match(formatHeaderDate(now), /Sep/);
    assert.equal(todayISO(now), "2026-09-14");
    assert.equal(thisSundayISO(now), "2026-09-20");
    assert.ok(parseDueDateLocal("bogus") === null);
  });
  it("reminderForTask only today with time", () => {
    const morning = new Date(2026, 8, 14, 9, 0);
    assert.equal(reminderForTask({ dueDate: "2026-09-14", scheduledTime: "09:30" }, morning), "in 30m");
    assert.equal(reminderForTask({ dueDate: "2026-09-14", scheduledTime: "12:00" }, morning), "in 3h");
    assert.equal(reminderForTask({ dueDate: "2026-09-15", scheduledTime: "09:30" }, morning), "");
    assert.equal(reminderForTask({ dueDate: "2026-09-14", scheduledTime: "" }, morning), "");
    assert.equal(reminderForTask({ dueDate: "2026-09-14", scheduledTime: "08:00" }, morning), "passed");
  });
});

describe("Task strict dueDate", () => {
  it("rejects Feb 30", () => {
    assert.throws(() => new Task({ id: new Id("t1"), title: "ok", dueDate: "2026-02-30" }), /valid date/);
    assert.throws(() => new Task({ id: new Id("t1"), title: "ok", dueDate: "2026-13-01" }), /valid date|YYYY-MM-DD/);
    const t = new Task({ id: new Id("t1"), title: "ok", dueDate: "2026-02-28" });
    assert.equal(t.dueDate, "2026-02-28");
    assert.throws(() => t.setDueDate("2025-02-29"), /valid date/);
  });
});

describe("ReorderTasksUseCase", () => {
  function repoWith(tasks) {
    return {
      _tasks: tasks,
      async list() { return this._tasks; },
      async saveAll(items) { this._tasks = items; },
    };
  }
  it("renumbers by orderedIds, pushes missing to end, emits", async () => {
    const mk = (id, order) => new Task({ id: new Id(id), title: id, order });
    const repo = repoWith([mk("a", 0), mk("b", 1), mk("c", 2)]);
    const events = new EventBus();
    let emitted = "";
    events.on("tasks:changed", () => (emitted = "yes"));
    const uc = new ReorderTasksUseCase({ repo, events });
    const out = await uc.execute({ orderedIds: ["c", "a"] });
    assert.deepEqual(out.map((t) => t.id.value), ["c", "a", "b"]);
    assert.deepEqual(out.map((t) => t.order), [0, 1, 2]);
    assert.equal(emitted, "yes");
  });
});

describe("UpdateDailyFocusUseCase", () => {
  function settingsRepo(settings) {
    return {
      _s: settings,
      async load() { return this._s; },
      async save(s) { this._s = s; },
    };
  }
  it("execute stamps today + sanitizes, ensureToday resets stale", async () => {
    const { UserSettings } = await import("../src/domain/entities/UserSettings.js");
    const s = new UserSettings({ focusText: "old", focusCompleted: true, focusDate: "2026-09-10" });
    const repo = settingsRepo(s);
    const events = new EventBus();
    let emits = 0;
    events.on("settings:changed", () => emits++);
    const clock = { now: () => D(2026, 9, 14) };
    const uc = new UpdateDailyFocusUseCase({ settingsRepo: repo, sanitizer: new BasicSanitizer(), events, clock });
    const r1 = await uc.ensureToday();
    assert.equal(r1.reset, true);
    assert.equal(repo._s.focusCompleted, false);
    assert.equal(repo._s.focusDate, "2026-09-14");
    await uc.execute({ text: "Ship <b>v1</b>", completed: true });
    assert.equal(repo._s.focusText, "Ship bv1/b");
    assert.equal(repo._s.focusCompleted, true);
    const r2 = await uc.ensureToday();
    assert.equal(r2.reset, false);
    assert.ok(emits >= 2);
  });
});
