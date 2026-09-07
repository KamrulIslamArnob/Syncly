/**
 * ShaderRegistry — Domain Service
 * --------------------------------------------------------------------
 * Authoritative registry of wallpaper shader definitions. Holds
 * definitions only: no user colours, no persisted state.
 *
 * A ShaderDefinition is:
 *   { id, name, family, colorSlots, defaults: {colors, noise, intensity}, render }
 * where render(colors, noise, intensity, mode) -> AuraSpec and MUST be pure.
 */
export class ShaderRegistry {
  static #shaders = new Map();

  static get DEFAULT_SHADER_ID() {
    return "vapor-bloom";
  }

  /**
   * Register a shader definition.
   * @param {object} def
   * @returns {string} the registered id
   */
  static register(def) {
    if (!def || typeof def !== "object") {
      throw new Error("Shader definition must be an object");
    }
    const id = String(def.id || "").trim();
    if (!id) throw new Error("Shader definition must have a non-empty 'id'");
    if (!def.name) throw new Error(`Shader ${id} must have a 'name'`);
    if (!def.family) throw new Error(`Shader ${id} must have a 'family'`);
    if (!Number.isInteger(def.colorSlots) || def.colorSlots < 1 || def.colorSlots > 3) {
      throw new Error(`Shader ${id} has invalid colorSlots (must be an integer 1-3)`);
    }
    if (!def.defaults || !Array.isArray(def.defaults.colors)) {
      throw new Error(`Shader ${id} must have defaults.colors`);
    }
    if (def.defaults.colors.length !== def.colorSlots) {
      throw new Error(`Shader ${id} defaults.colors must hold exactly ${def.colorSlots} colours`);
    }
    if (typeof def.render !== "function") {
      throw new Error(`Shader ${id} must have a render function`);
    }
    this.#shaders.set(id, Object.freeze({ ...def, id }));
    return id;
  }

  /** Strict membership check — never falls back to the default. */
  static isValid(id) {
    return typeof id === "string" && this.#shaders.has(id.trim());
  }

  /**
   * Look up a shader, falling back to the default shader for an unknown id.
   * Returns null only when the registry is empty.
   */
  static get(id) {
    if (typeof id === "string" && this.#shaders.has(id.trim())) {
      return this.#shaders.get(id.trim());
    }
    return this.#shaders.get(this.DEFAULT_SHADER_ID) || null;
  }

  static all() {
    return Array.from(this.#shaders.values());
  }

  static byFamily(family) {
    return this.all().filter((s) => s.family === family);
  }

  /** Test isolation only. */
  static clear() {
    this.#shaders.clear();
  }
}
