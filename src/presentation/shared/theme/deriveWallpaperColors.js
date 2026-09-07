import { hexToOklch, oklchToHex } from "../colorUtils.js";

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * Ground is the canvas the light falls on: pushed to the far end of the
 * lightness range for the mode, with chroma pulled well down so a vivid
 * light colour does not produce a vivid backdrop. Hue is preserved.
 *
 * @param {string} lightHex
 * @param {"dark"|"light"} mode
 * @returns {string} "#rrggbb"
 */
export function deriveGround(lightHex, mode) {
  const { l, c, h } = hexToOklch(lightHex);
  return mode === "light"
    ? oklchToHex({ l: clamp(l, 0.94, 0.97), c: c * 0.15, h })
    : oklchToHex({ l: clamp(l, 0.08, 0.14), c: c * 0.25, h });
}

/**
 * Tint is a secondary illuminant: same lightness and chroma as the light
 * colour, hue rotated 30 degrees.
 *
 * @param {string} lightHex
 * @returns {string} "#rrggbb"
 */
export function deriveTint(lightHex) {
  const { l, c, h } = hexToOklch(lightHex);
  return oklchToHex({ l, c, h: (h + 30) % 360 });
}

/**
 * Resolve however many colours the user supplied into all three roles.
 * Slots are positional: [light, ground, tint].
 *
 * @param {string[]} colors
 * @param {number} colorSlots - how many of `colors` this shader declares
 * @param {"dark"|"light"} mode
 * @returns {{light: string, ground: string, tint: string}}
 */
export function resolveRoles(colors, colorSlots, mode) {
  const given = colors.slice(0, colorSlots);
  const light = given[0];
  return {
    light,
    ground: given[1] ?? deriveGround(light, mode),
    tint: given[2] ?? deriveTint(light),
  };
}
