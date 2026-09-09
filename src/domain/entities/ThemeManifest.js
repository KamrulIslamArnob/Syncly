/**
 * ThemeManifest — Domain Entity
 * --------------------------------------------------------------------
 * Canonical theme manifest representing a complete Syncly theme package.
 * Supports dual-mode (dark & light), token mappings, atmospheric lighting, and optional custom CSS.
 */

export class ThemeManifest {
  #id;
  #name;
  #version;
  #description;
  #author;
  #license;
  #type; // "builtin" | "custom" | "community"
  #modes; // { dark: { tokens, aura, customCss }, light: { tokens, aura, customCss } }

  constructor({
    id,
    name,
    version = "1.0.0",
    description = "",
    author = "Syncly Team",
    license = "MIT",
    type = "builtin",
    modes,
  } = {}) {
    if (!id || typeof id !== "string") {
      throw new Error("ThemeManifest requires a valid non-empty string 'id'");
    }
    if (!name || typeof name !== "string") {
      throw new Error("ThemeManifest requires a valid non-empty string 'name'");
    }
    if (!modes || typeof modes !== "object" || !modes.dark || !modes.light) {
      throw new Error("ThemeManifest requires both 'dark' and 'light' mode definitions in 'modes'");
    }

    this.#id = id.trim();
    this.#name = name.trim();
    this.#version = String(version || "1.0.0").trim();
    this.#description = String(description || "").trim();
    this.#author = typeof author === "object" ? author : String(author || "").trim();
    this.#license = String(license || "MIT").trim();
    this.#type = ["builtin", "custom", "community"].includes(type) ? type : "custom";

    this.#modes = {
      dark: this.#normalizeMode(modes.dark, "dark"),
      light: this.#normalizeMode(modes.light, "light"),
    };
  }

  get id() { return this.#id; }
  get name() { return this.#name; }
  get version() { return this.#version; }
  get description() { return this.#description; }
  get author() { return this.#author; }
  get license() { return this.#license; }
  get type() { return this.#type; }
  get isBuiltin() { return this.#type === "builtin"; }
  get modes() { return { ...this.#modes }; }

  getMode(mode = "dark") {
    return this.#modes[mode === "light" ? "light" : "dark"];
  }

  getTokens(mode = "dark") {
    return { ...this.getMode(mode).tokens };
  }

  getAura(mode = "dark") {
    return { ...this.getMode(mode).aura };
  }

  getCustomCss(mode = "dark") {
    return this.getMode(mode).customCss || "";
  }

  #normalizeMode(modeDef, modeName) {
    if (!modeDef || typeof modeDef !== "object") {
      throw new Error(`Mode '${modeName}' definition must be an object`);
    }
    const tokens = typeof modeDef.tokens === "object" && modeDef.tokens !== null ? { ...modeDef.tokens } : {};
    const aura = typeof modeDef.aura === "object" && modeDef.aura !== null ? { ...modeDef.aura } : { enabled: false };
    const customCss = typeof modeDef.customCss === "string" ? modeDef.customCss : "";

    return Object.freeze({
      tokens: Object.freeze(tokens),
      aura: Object.freeze(aura),
      customCss,
    });
  }

  toJSON() {
    return {
      schemaVersion: "1.0.0",
      id: this.#id,
      name: this.#name,
      version: this.#version,
      description: this.#description,
      author: this.#author,
      license: this.#license,
      type: this.#type,
      modes: {
        dark: {
          tokens: { ...this.#modes.dark.tokens },
          aura: { ...this.#modes.dark.aura },
          customCss: this.#modes.dark.customCss,
        },
        light: {
          tokens: { ...this.#modes.light.tokens },
          aura: { ...this.#modes.light.aura },
          customCss: this.#modes.light.customCss,
        },
      },
    };
  }

  static fromJSON(json) {
    if (!json || typeof json !== "object") {
      throw new Error("Invalid theme manifest JSON");
    }
    return new ThemeManifest({
      id: json.id,
      name: json.name,
      version: json.version,
      description: json.description,
      author: json.author,
      license: json.license,
      type: json.type || (json.isBuiltin ? "builtin" : "custom"),
      modes: json.modes || {
        dark: {
          tokens: json.colors?.dark || json.dark?.tokens || json.dark || {},
          aura: json.aura?.dark || json.dark?.aura || {},
          customCss: json.customCss?.dark || json.dark?.customCss || json.customCss || "",
        },
        light: {
          tokens: json.colors?.light || json.light?.tokens || json.light || {},
          aura: json.aura?.light || json.light?.aura || {},
          customCss: json.customCss?.light || json.light?.customCss || json.customCss || "",
        },
      },
    });
  }
}
