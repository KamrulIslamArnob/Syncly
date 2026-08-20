// Domain value object: Greeting
// Pure function of (local hour, sanitized user name).
// Lives in the domain layer because the rule "morning / afternoon / evening"
// is a business concept, not a presentation concern.

const PartOfDay = Object.freeze({
  MORNING: "morning",
  AFTERNOON: "afternoon",
  EVENING: "evening",
});

export class Greeting {
  #partOfDay;
  #name;

  constructor(partOfDay, name) {
    if (!Object.values(PartOfDay).includes(partOfDay)) {
      throw new Error(`Unknown part of day: ${partOfDay}`);
    }
    if (typeof name !== "string") {
      throw new Error("Name must be a string");
    }
    this.#partOfDay = partOfDay;
    this.#name = name;
  }

  static fromHour(hour, name) {
    let part;
    if (hour < 12) part = PartOfDay.MORNING;
    else if (hour < 18) part = PartOfDay.AFTERNOON;
    else part = PartOfDay.EVENING;
    return new Greeting(part, name);
  }

  get partOfDay() {
    return this.#partOfDay;
  }

  get name() {
    return this.#name;
  }

  // Returns the exact wording required by the PRD:
  // "Good <part>, <name>".
  render() {
    const capitalized =
      this.#partOfDay.charAt(0).toUpperCase() + this.#partOfDay.slice(1);
    const trimmedName = this.#name.trim();
    if (trimmedName.length === 0) return `Good ${capitalized}`;
    return `Good ${capitalized}, ${trimmedName}`;
  }
}