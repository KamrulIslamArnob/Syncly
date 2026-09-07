import { ShaderRegistry } from "../services/ShaderRegistry.js";

const HEX = /^#[0-9a-fA-F]{6}$/;

function assertUnit(value, field) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 1) {
    throw new Error(`Invalid ${field}: must be a number between 0 and 1`);
  }
}

/**
 * Wallpaper — Domain Entity (immutable value object)
 * --------------------------------------------------------------------
 * A background reduced to the parameters a user actually chooses:
 * a shader, 1-3 colours, and two 0-1 dials. Rendering lives in the
 * shader; this type only guards the invariants.
 */
export class Wallpaper {
  #shaderId;
  #colors;
  #noise;
  #intensity;

  constructor({ shaderId, colors, noise = 0.5, intensity = 0.5 } = {}) {
    if (!ShaderRegistry.isValid(shaderId)) {
      throw new Error(`Unknown shaderId: ${shaderId}`);
    }
    const def = ShaderRegistry.get(shaderId);
    if (!Array.isArray(colors) || colors.length !== def.colorSlots) {
      throw new Error(`Shader ${shaderId} requires exactly ${def.colorSlots} colour(s)`);
    }
    for (const c of colors) {
      if (typeof c !== "string" || !HEX.test(c)) {
        throw new Error(`Invalid colour: ${c} (expected #RRGGBB)`);
      }
    }
    assertUnit(noise, "noise");
    assertUnit(intensity, "intensity");

    this.#shaderId = shaderId;
    this.#colors = [...colors];
    this.#noise = noise;
    this.#intensity = intensity;
    Object.freeze(this);
  }

  get shaderId() { return this.#shaderId; }
  get colors() { return [...this.#colors]; }
  get noise() { return this.#noise; }
  get intensity() { return this.#intensity; }

  #clone(over) {
    return new Wallpaper({
      shaderId: this.#shaderId,
      colors: this.#colors,
      noise: this.#noise,
      intensity: this.#intensity,
      ...over,
    });
  }

  /**
   * Switch shader, re-fitting the colour list to the new slot count.
   * Missing slots come from the incoming shader's defaults rather than
   * from role derivation: derivation is mode-dependent and this type has
   * no mode. The render path still derives roles per mode on every draw.
   */
  withShader(nextId) {
    if (!ShaderRegistry.isValid(nextId)) throw new Error(`Unknown shaderId: ${nextId}`);
    const def = ShaderRegistry.get(nextId);
    const colors = [];
    for (let i = 0; i < def.colorSlots; i++) {
      colors.push(this.#colors[i] ?? def.defaults.colors[i]);
    }
    return this.#clone({ shaderId: nextId, colors });
  }

  withColor(index, hex) {
    const colors = [...this.#colors];
    if (index < 0 || index >= colors.length) {
      throw new Error(`Colour index ${index} out of range`);
    }
    colors[index] = hex;
    return this.#clone({ colors });
  }

  withNoise(noise) { return this.#clone({ noise }); }
  withIntensity(intensity) { return this.#clone({ intensity }); }

  toJSON() {
    return {
      v: 2,
      shaderId: this.#shaderId,
      colors: [...this.#colors],
      noise: this.#noise,
      intensity: this.#intensity,
    };
  }

  static fromJSON(obj) {
    return new Wallpaper(obj);
  }
}
