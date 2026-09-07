import { ShaderRegistry } from "../../../../domain/services/ShaderRegistry.js";
import { VAPOR_SHADERS } from "./vapor.js";

/**
 * Every shader definition in the library.
 * Plan 2 extends this list with the remaining ten families.
 */
export const ALL_SHADERS = [
  ...VAPOR_SHADERS,
];

/**
 * Register every shader with the ShaderRegistry.
 * Idempotent: registering the same id twice replaces the definition.
 * @returns {number} how many shaders were registered
 */
export function registerAllShaders() {
  for (const def of ALL_SHADERS) {
    ShaderRegistry.register(def);
  }
  return ALL_SHADERS.length;
}
