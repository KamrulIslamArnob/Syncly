/**
 * ThemeRegistry — Domain Service
 * --------------------------------------------------------------------
 * Authoritative registry for built-in theme presets and dynamic custom theme plugins.
 * Replaces hardcoded whitelist in UserSettings with an extensible registry.
 */

export class ThemeRegistry {
  static #builtins = new Map();
  static #customThemes = new Map();

  /**
   * The 11 standard built-in preset IDs preserved for 100% backward compatibility.
   */
  static get VALID_BUILTIN_IDS() {
    return Object.freeze([
      "aurora",
      "retro_grid",
      "diamond_storm",
      "graphite_flow",
      "sky_deep_sea",
      "rose_gold",
      "solid",
      "minimal",
      "nord",
      "cyberpunk",
      "sage",
    ]);
  }

  /**
   * Additional atmospheric aura presets.
   */
  static get AURA_PRESET_IDS() {
    return Object.freeze([
      "glacier_mist",
      "orchid_bloom",
      "ocean_pearl",
    ]);
  }

  static get DEFAULT_PRESET() {
    return "aurora";
  }

  static get DEFAULT_ACCENT() {
    return "#555B66";
  }

  /**
   * Register a built-in or custom theme manifest.
   * @param {object} manifest - Manifest object conforming to ThemeManifest schema
   */
  static register(manifest) {
    if (!manifest || typeof manifest !== "object") {
      throw new Error("Theme manifest must be an object");
    }
    const id = String(manifest.id || "").trim();
    if (!id) {
      throw new Error("Theme manifest must have a valid non-empty 'id'");
    }
    if (manifest.type === "builtin" || this.VALID_BUILTIN_IDS.includes(id) || this.AURA_PRESET_IDS.includes(id)) {
      this.#builtins.set(id, Object.freeze({ ...manifest }));
    } else {
      this.#customThemes.set(id, Object.freeze({ ...manifest }));
    }
    return id;
  }

  /**
   * Unregister a custom theme by ID.
   * Built-in themes cannot be unregistered.
   */
  static unregister(id) {
    if (typeof id !== "string") return false;
    return this.#customThemes.delete(id);
  }

  /**
   * Check if a theme ID is valid (registered or built-in, or formatted custom ID).
   * @param {string} id
   * @returns {boolean}
   */
  static isValid(id) {
    if (typeof id !== "string" || !id.trim()) return false;
    const clean = id.trim();
    if (this.VALID_BUILTIN_IDS.includes(clean)) return true;
    if (this.AURA_PRESET_IDS.includes(clean)) return true;
    if (this.#builtins.has(clean) || this.#customThemes.has(clean)) return true;
    if (/^(custom:|theme_|custom-|@[a-z0-9-_.]+\/)[a-z0-9_-]{1,64}$/i.test(clean)) return true;
    return false;
  }

  /**
   * Check if a specific theme ID is currently registered in memory.
   */
  static has(id) {
    if (typeof id !== "string") return false;
    const clean = id.trim();
    return this.VALID_BUILTIN_IDS.includes(clean) || this.AURA_PRESET_IDS.includes(clean) || this.#builtins.has(clean) || this.#customThemes.has(clean);
  }

  /**
   * Get manifest by ID, falling back to default built-in if not found.
   */
  static get(id) {
    if (typeof id === "string") {
      const clean = id.trim();
      if (this.#customThemes.has(clean)) return this.#customThemes.get(clean);
      if (this.#builtins.has(clean)) return this.#builtins.get(clean);
    }
    return this.#builtins.get(this.DEFAULT_PRESET) || null;
  }

  /**
   * Check if a specific theme ID is currently registered in memory.
   */
  static has(id) {
    if (typeof id !== "string") return false;
    const clean = id.trim();
    return this.VALID_BUILTIN_IDS.includes(clean) || this.#builtins.has(clean) || this.#customThemes.has(clean);
  }

  /**
   * Get all registered theme manifests (built-ins + custom).
   */
  static getAll() {
    return [
      ...Array.from(this.#builtins.values()),
      ...Array.from(this.#customThemes.values()),
    ];
  }

  /**
   * Get UI presets for settings selector.
   */
  static getUIPresets({ featuredOnly = false } = {}) {
    const featured = [
      { id: "aurora", label: "Aurora Beams", hint: "Layered atmospheric aura with oceanic & cyan glow" },
      { id: "glacier_mist", label: "Glacier Mist", hint: "Cool atmospheric glacier mint & cyan aura" },
      { id: "orchid_bloom", label: "Orchid Bloom", hint: "Vivid atmospheric magenta & violet aura" },
      { id: "ocean_pearl", label: "Ocean Pearl", hint: "Cool atmospheric oceanic pearl & turquoise aura" },
    ];

    const otherBuiltins = [
      { id: "sky_deep_sea", label: "Sky Deep Sea", hint: "Oceanic sky atmospheric aura" },
      { id: "rose_gold", label: "Rose Gold", hint: "Kogane Momo warm gradient aura" },
      { id: "retro_grid", label: "Retro Grid", hint: "Matrix blueprint grid pattern" },
      { id: "diamond_storm", label: "Diamond Storm", hint: "Cool diamond lattice aura" },
      { id: "graphite_flow", label: "Graphite Flow", hint: "Soft ambient flux aura" },
      { id: "solid", label: "Minimal Solid", hint: "Clean distraction-free solid" },
      { id: "minimal", label: "Minimal Zinc", hint: "Monochromatic architectural zinc" },
      { id: "nord", label: "Nordic Frost", hint: "Arctic polar night and frost teal" },
      { id: "cyberpunk", label: "Cyberpunk Neon", hint: "High-voltage neon flame" },
      { id: "sage", label: "Sage Botanical", hint: "Calm herbal matcha and cedar" },
    ];

    const builtins = featuredOnly ? featured : [...featured, ...otherBuiltins];

    const customs = Array.from(this.#customThemes.values()).map(t => ({
      id: t.id,
      label: t.name || t.id,
      hint: t.description || "Custom user theme",
      isCustom: true,
    }));

    return [...builtins, ...customs];
  }

  /**
   * Clear all registered custom themes (useful for testing or cache reset).
   */
  static clearCustomThemes() {
    this.#customThemes.clear();
  }
}
