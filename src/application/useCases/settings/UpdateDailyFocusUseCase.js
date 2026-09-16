import { todayISO, shouldResetDailyFocus } from "../../../domain/services/dateUtils.js";

/**
 * UpdateDailyFocusUseCase — daily-focus text with date rollover.
 * Storage shape lives on UserSettings: focusText/focusCompleted/focusDate.
 * - execute({ text, completed }) writes today's focus (stamping focusDate).
 * - ensureToday() resets completed when stored focusDate is a previous day.
 */
export class UpdateDailyFocusUseCase {
  #settingsRepo;
  #sanitizer;
  #events;
  #clock;

  constructor({ settingsRepo, sanitizer, events, clock } = {}) {
    this.#settingsRepo = settingsRepo;
    this.#sanitizer = sanitizer;
    this.#events = events;
    this.#clock = clock;
  }

  #now() {
    try {
      const n = this.#clock?.now?.();
      return n instanceof Date ? n : new Date(n ?? Date.now());
    } catch {
      return new Date();
    }
  }

  async execute({ text, completed } = {}) {
    const settings = await this.#settingsRepo.load();
    const now = this.#now();
    if (text !== undefined) {
      const clean = this.#sanitizer ? this.#sanitizer.text(text) : String(text ?? "");
      settings.setFocus(clean, settings.focusCompleted, todayISO(now));
    }
    if (completed !== undefined) {
      settings.setFocus(settings.focusText, !!completed, todayISO(now));
    }
    // Stamp date even when only toggling, so rollover has an anchor.
    if (text === undefined && completed === undefined && !settings.focusDate) {
      settings.setFocus(settings.focusText, settings.focusCompleted, todayISO(now));
    }
    await this.#settingsRepo.save(settings);
    this.#events?.emit?.("settings:changed", settings);
    return settings;
  }

  async ensureToday() {
    const settings = await this.#settingsRepo.load();
    const now = this.#now();
    if (shouldResetDailyFocus(settings.focusDate, now)) {
      settings.setFocus(settings.focusText, false, todayISO(now));
      await this.#settingsRepo.save(settings);
      this.#events?.emit?.("settings:changed", settings);
      return { reset: true, settings };
    }
    return { reset: false, settings };
  }
}
