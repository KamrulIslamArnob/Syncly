// Domain value object: WorldClockConfig
// Represents a clock timezone configuration selected by the user.
export class WorldClockConfig {
  #label;
  #timeZone; // Empty string for local machine time, or a standard IANA timezone name (e.g. "Asia/Tokyo")

  constructor(label, timeZone) {
    if (typeof label !== "string" || label.trim().length === 0) {
      throw new Error("Clock label must be a non-empty string");
    }
    if (typeof timeZone !== "string") {
      throw new Error("Clock timezone must be a string");
    }
    this.#label = label.trim();
    this.#timeZone = timeZone.trim();
  }

  get label() {
    return this.#label;
  }

  get timeZone() {
    return this.#timeZone;
  }

  toJSON() {
    return {
      label: this.#label,
      timeZone: this.#timeZone,
    };
  }

  static fromJSON(json) {
    const safe = json ?? {};
    return new WorldClockConfig(safe.label ?? "Local", safe.timeZone ?? "");
  }
}
