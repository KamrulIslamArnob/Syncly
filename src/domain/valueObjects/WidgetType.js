// Domain value object: WidgetType
// The closed set of widget kinds the dashboard knows about. Adding a
// new widget (e.g. weather) means adding a new entry here plus a
// matching use case + view; the layout machinery does not change.
export const WidgetType = Object.freeze({
  GREETING: "greeting",
  CLOCK: "clock",
  BOOKMARKS: "bookmarks",
  TODO: "todo",
});

const ALL = new Set(Object.values(WidgetType));

export class WidgetKind {
  #value;

  constructor(value) {
    if (!ALL.has(value)) {
      throw new Error(`Unknown widget type: ${value}`);
    }
    this.#value = value;
  }

  get value() {
    return this.#value;
  }

  equals(other) {
    return other instanceof WidgetKind && other.#value === this.#value;
  }
}
