// Domain value object: BackgroundConfig
// Represents one of three user-selectable background strategies.
// The rendering layer picks the CSS based on `kind`.

export const BackgroundKind = Object.freeze({
  LOCAL_IMAGE: "local_image",
  REMOTE_IMAGE: "remote_image",
  SOLID_COLOR: "solid_color",
  GRADIENT: "gradient",
});

export class BackgroundConfig {
  #kind;
  #value;

  constructor(kind, value) {
    if (!Object.values(BackgroundKind).includes(kind)) {
      throw new Error(`Unsupported background kind: ${kind}`);
    }
    if (typeof value !== "string" || value.length === 0) {
      throw new Error("Background value must be a non-empty string");
    }
    this.#kind = kind;
    this.#value = value;
  }

  static localImage(value) {
    if (!/^data:image\//.test(value) && !/\.(png|jpe?g|webp|gif)$/i.test(value)) {
      throw new Error("Local image must be a data URL or a valid image filename");
    }
    return new BackgroundConfig(BackgroundKind.LOCAL_IMAGE, value);
  }

  static remoteImage(urlString) {
    const u = new URL(urlString);
    if (!/^https?:$/.test(u.protocol)) {
      throw new Error("Remote image URL must be http(s)");
    }
    return new BackgroundConfig(BackgroundKind.REMOTE_IMAGE, urlString);
  }

  static solidColor(cssColor) {
    return new BackgroundConfig(BackgroundKind.SOLID_COLOR, cssColor);
  }

  static gradient(cssGradient) {
    return new BackgroundConfig(BackgroundKind.GRADIENT, cssGradient);
  }

  get kind() {
    return this.#kind;
  }

  get value() {
    return this.#value;
  }

  equals(other) {
    return (
      other instanceof BackgroundConfig &&
      other.#kind === this.#kind &&
      other.#value === this.#value
    );
  }
}