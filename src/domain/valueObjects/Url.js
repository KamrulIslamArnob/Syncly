// Domain value object: Url
// Validates and normalizes URLs at the domain boundary so that the
// application / presentation layers never have to re-validate.
export class Url {
  #raw;
  #href;

  constructor(raw) {
    if (typeof raw !== "string") {
      throw new Error("Url must be a string");
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new Error("Url must not be empty");
    }

    const normalized = Url.#normalize(trimmed);
    // URL constructor throws on invalid input; let it bubble up.
    // eslint-disable-next-line no-new
    const parsed = new URL(normalized);
    if (!/^https?:$/.test(parsed.protocol)) {
      throw new Error("Url must be http(s)");
    }

    this.#raw = trimmed;
    this.#href = parsed.href;
  }

  static #normalize(input) {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) return input;
    // Treat scheme-less inputs as http by default.
    return `http://${input}`;
  }

  get raw() {
    return this.#raw;
  }

  get href() {
    return this.#href;
  }

  get host() {
    return new URL(this.#href).host;
  }

  equals(other) {
    return other instanceof Url && other.#href === this.#href;
  }

  toString() {
    return this.#href;
  }
}