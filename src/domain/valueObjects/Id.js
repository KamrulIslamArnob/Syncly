// Domain value object: Id
// Opaque identifier for any aggregate root or child entity.
// Equality is based on the underlying string value; instances are immutable.
export class Id {
  #value;

  constructor(value) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error("Id must be a non-empty string");
    }
    this.#value = value;
  }

  get value() {
    return this.#value;
  }

  equals(other) {
    return other instanceof Id && other.#value === this.#value;
  }

  toString() {
    return this.#value;
  }
}