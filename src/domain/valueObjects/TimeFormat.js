// Domain value object: TimeFormat
export const TimeFormat = Object.freeze({
  H12: "12h",
  H24: "24h",
});

const ALLOWED = new Set(Object.values(TimeFormat));

export class ClockFormat {
  #value;

  constructor(value) {
    if (!ALLOWED.has(value)) {
      throw new Error(`Unknown time format: ${value}`);
    }
    this.#value = value;
  }

  static default() {
    return new ClockFormat(TimeFormat.H24);
  }

  get value() {
    return this.#value;
  }

  toggle() {
    return this.#value === TimeFormat.H12
      ? new ClockFormat(TimeFormat.H24)
      : new ClockFormat(TimeFormat.H12);
  }

  equals(other) {
    return other instanceof ClockFormat && other.#value === this.#value;
  }
}
