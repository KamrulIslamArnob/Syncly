import { Id } from "../valueObjects/Id.js";
import { WidgetKind, WidgetType } from "../valueObjects/WidgetType.js";

// Domain entity: WidgetLayout
// One user's placement for a single widget. Coordinates are integer
// grid cells: x=column (1-based), y=row (1-based), w=columns wide,
// h=rows tall. The presentation layer translates these to CSS Grid.
export class WidgetLayout {
  #id;
  #type;
  #x;
  #y;
  #w;
  #h;
  #visible;

  constructor({ id, type, x, y, w, h, visible = true }) {
    if (!(id instanceof Id)) throw new Error("Widget id must be an Id");
    if (!(type instanceof WidgetKind)) {
      throw new Error("Widget type must be a WidgetKind");
    }
    if (![x, y, w, h].every(Number.isInteger)) {
      throw new Error("Widget coordinates must be integers");
    }
    if (x < 1 || y < 1 || w < 1 || h < 1) {
      throw new Error("Widget coordinates must be >= 1");
    }
    if (typeof visible !== "boolean") {
      throw new Error("Widget visible must be a boolean");
    }

    this.#id = id;
    this.#type = type;
    this.#x = x;
    this.#y = y;
    this.#w = w;
    this.#h = h;
    this.#visible = visible;
  }

  get id() { return this.#id; }
  get type() { return this.#type; }
  get x() { return this.#x; }
  get y() { return this.#y; }
  get w() { return this.#w; }
  get h() { return this.#h; }
  get visible() { return this.#visible; }

  moveTo(nx, ny) {
    if (!Number.isInteger(nx) || !Number.isInteger(ny) || nx < 1 || ny < 1) {
      throw new Error("Invalid move target");
    }
    this.#x = nx;
    this.#y = ny;
  }

  resizeTo(nw, nh) {
    if (!Number.isInteger(nw) || !Number.isInteger(nh) || nw < 1 || nh < 1) {
      throw new Error("Invalid resize target");
    }
    this.#w = nw;
    this.#h = nh;
  }

  setVisible(value) {
    if (typeof value !== "boolean") {
      throw new Error("Widget visible must be a boolean");
    }
    this.#visible = value;
  }

  toJSON() {
    return {
      id: this.#id.value,
      type: this.#type.value,
      x: this.#x,
      y: this.#y,
      w: this.#w,
      h: this.#h,
      visible: this.#visible,
    };
  }

  static fromJSON(json) {
    return new WidgetLayout({
      id: new Id(json.id),
      type: new WidgetKind(json.type),
      x: json.x,
      y: json.y,
      w: json.w,
      h: json.h,
      visible: json.visible !== false,
    });
  }

  // The factory used by the application layer on first launch.
  static defaults() {
    return [
      new WidgetLayout({
        id: new Id("widget-greeting"),
        type: new WidgetKind(WidgetType.GREETING),
        x: 1, y: 1, w: 8, h: 2,
      }),
      new WidgetLayout({
        id: new Id("widget-clock"),
        type: new WidgetKind(WidgetType.CLOCK),
        x: 9, y: 1, w: 4, h: 2,
      }),
      new WidgetLayout({
        id: new Id("widget-bookmarks"),
        type: new WidgetKind(WidgetType.BOOKMARKS),
        x: 1, y: 3, w: 8, h: 6,
      }),
      new WidgetLayout({
        id: new Id("widget-todo"),
        type: new WidgetKind(WidgetType.TODO),
        x: 9, y: 3, w: 4, h: 6,
      }),
    ];
  }
}