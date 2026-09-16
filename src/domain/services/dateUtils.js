// Domain service: dateUtils
// Pure date helpers for tasks, daily focus, calendars and freshness.
// No Chrome, DOM or storage — safe for Node tests and presentation use.
// All YYYY-MM-DD strings are interpreted as LOCAL calendar dates.

const DUE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Local YYYY-MM-DD for a Date (defaults to now). */
export function toISODateLocal(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Strict calendar check: rejects 2026-02-30, 2026-13-01, etc. */
export function isValidDueDateString(s) {
  if (typeof s !== "string" || s === "") return true; // empty = no date
  if (!DUE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Parse YYYY-MM-DD to local-midnight Date, or null. */
export function parseDueDateLocal(dueDate) {
  if (!dueDate || !isValidDueDateString(dueDate) || dueDate === "") return null;
  const [y, m, d] = dueDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(now = new Date()) {
  return toISODateLocal(now instanceof Date ? now : new Date(now));
}

export function addDaysISO(baseISOOrDate, days, nowForEmpty = new Date()) {
  const base =
    typeof baseISOOrDate === "string" && baseISOOrDate
      ? parseDueDateLocal(baseISOOrDate)
      : baseISOOrDate instanceof Date
        ? baseISOOrDate
        : new Date(nowForEmpty);
  if (!base || Number.isNaN(base.getTime())) return "";
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return toISODateLocal(d);
}

/** Next Sunday (inclusive) — matches deck's existing "This week" preset. */
export function thisSundayISO(now = new Date()) {
  const d = now instanceof Date ? new Date(now) : new Date(now);
  const untilSun = (7 - d.getDay()) % 7;
  d.setDate(d.getDate() + untilSun);
  return toISODateLocal(d);
}

/** Preset resolver used by task creation UI. Returns "" for unknown. */
export function dueForPreset(preset, now = new Date()) {
  const base = now instanceof Date ? new Date(now) : new Date(now);
  if (preset === "today") return toISODateLocal(base);
  if (preset === "tomorrow") return addDaysISO(base, 1);
  if (preset === "in3days") return addDaysISO(base, 3);
  if (preset === "thisWeek") return thisSundayISO(base);
  if (preset === "nextWeek") return addDaysISO(base, 7);
  if (preset === "none" || preset === "" || preset == null) return "";
  return "";
}

function startOfDayLocal(d) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function isToday(dueDate, now = new Date()) {
  if (!dueDate) return false;
  return dueDate === todayISO(now);
}

export function isOverdue(dueDate, now = new Date()) {
  if (!dueDate) return false;
  const due = parseDueDateLocal(dueDate);
  if (!due) return false;
  return startOfDayLocal(due).getTime() < startOfDayLocal(now instanceof Date ? now : new Date(now)).getTime();
}

/** Whole days from today to due (negative = overdue). Null when no date. */
export function daysUntil(dueDate, now = new Date()) {
  const due = parseDueDateLocal(dueDate);
  if (!due) return null;
  const ms = startOfDayLocal(due).getTime() - startOfDayLocal(now instanceof Date ? now : new Date(now)).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Human label: Overdue · Today · Tomorrow · In N days · This week · "Mar 3".
 * Overdue shows "Overdue" (or "Yesterday" for -1) so rows can be badged.
 */
export function labelForDue(dueDate, now = new Date()) {
  if (!dueDate) return "";
  const ref = now instanceof Date ? now : new Date(now);
  const today = todayISO(ref);
  if (dueDate === today) return "Today";
  const diff = daysUntil(dueDate, ref);
  if (diff == null) return dueDate;
  if (diff === -1) return "Yesterday · Overdue";
  if (diff < -1) return `Overdue · ${Math.abs(diff)}d ago`;
  if (diff === 1) return "Tomorrow";
  if (diff <= 3) return `In ${diff} days`;
  if (dueDate === thisSundayISO(ref)) return "This week";
  try {
    const dt = parseDueDateLocal(dueDate);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dueDate;
  }
}

/** "Mon, Sep 14" style header date. */
export function formatHeaderDate(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  try {
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return toISODateLocal(d);
  }
}

/** Filter helper for task lists: all|today|overdue|week|none|done|active.
 *  Date filters hide completed tasks so "Today" / "Overdue" / "This week"
 *  always mean "still to do". "Done" shows only completed, "all" shows
 *  everything (active first via sort). Tasks without a completed flag are
 *  treated as active for backwards compatibility. */
export function matchesTaskFilter(task, filter, now = new Date()) {
  if (!filter || filter === "all") return true;
  const done = !!task?.completed;
  if (filter === "done") return done;
  if (filter === "active") return !done;
  const due = task?.dueDate || "";
  if (filter === "none") return !due && !done;
  if (done) return false;
  if (!due) return false;
  if (filter === "today") return isToday(due, now);
  if (filter === "overdue") return isOverdue(due, now);
  if (filter === "week") {
    const diff = daysUntil(due, now);
    return diff != null && diff >= 0 && diff <= 7;
  }
  return true;
}

/**
 * Month grid for calendar widget: 42 cells (6x7), Sunday-first.
 * Each cell: { iso, day, inMonth, isToday, taskCount }.
 */
export function getMonthGrid(year, monthIndex, { today = new Date(), tasksByDue = null } = {}) {
  const first = new Date(year, monthIndex, 1);
  const startOffset = first.getDay(); // 0=Sun
  const todayIso = todayISO(today instanceof Date ? today : new Date(today));
  const cells = [];
  const cursor = new Date(year, monthIndex, 1 - startOffset);
  for (let i = 0; i < 42; i++) {
    const iso = toISODateLocal(cursor);
    cells.push({
      iso,
      day: cursor.getDate(),
      inMonth: cursor.getMonth() === monthIndex,
      isToday: iso === todayIso,
      taskCount: tasksByDue?.get?.(iso) ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}

/** Daily-focus rollover: stored focusDate belongs to a previous day. */
export function shouldResetDailyFocus(focusDate, now = new Date()) {
  if (!focusDate) return false;
  return focusDate !== todayISO(now instanceof Date ? now : new Date(now));
}

/**
 * Reminder label for a task with dueDate + scheduledTime ("14:30").
 * Only fires when due is today: "in 25m", "in 2h 10m", "now", "passed".
 * Returns "" when no time, not today, or invalid.
 */
export function reminderForTask(task, now = new Date()) {
  const due = task?.dueDate || "";
  const time = task?.scheduledTime || "";
  if (!due || !time) return "";
  const ref = now instanceof Date ? now : new Date(now);
  if (!isToday(due, ref)) return "";
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!m) return "";
  const target = new Date(ref);
  target.setHours(Number(m[1]), Number(m[2]), 0, 0);
  const diffMin = Math.round((target.getTime() - ref.getTime()) / 60000);
  if (diffMin < -1) return "passed";
  if (diffMin <= 1) return "now";
  if (diffMin < 60) return `in ${diffMin}m`;
  const h = Math.floor(diffMin / 60);
  const rest = diffMin % 60;
  return rest ? `in ${h}h ${rest}m` : `in ${h}h`;
}
