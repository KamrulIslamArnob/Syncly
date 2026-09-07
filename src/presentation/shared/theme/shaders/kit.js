import { hexToRgb } from "../../colorUtils.js";
import { resolveRoles } from "../deriveWallpaperColors.js";

const clamp01 = (n) => Math.min(1, Math.max(0, n));
/** Trim float noise so generated CSS stays readable and render() output is stable. */
const round3 = (n) => Math.round(n * 1000) / 1000;

/**
 * Expand a hex plus an alpha into a CSS rgba() string.
 * @param {string} hex
 * @param {number} alpha 0-1
 */
export function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${round3(clamp01(alpha))})`;
}

/**
 * Scale a layer's authored alpha by the user's intensity dial.
 * 0 -> 0.4x, 0.5 -> 1.0x (unity), 1 -> 1.6x.
 */
export function scaleAlpha(alpha, intensity) {
  return clamp01(alpha * (0.4 + intensity * 1.2));
}

/** Build one aura layer, filling the defaults the CSS contract expects. */
export function layer({ background, blend = "normal", blur = 0, opacity = 1, size = "auto" }) {
  return {
    background,
    mixBlendMode: blend,
    blur,
    opacity: round3(clamp01(opacity)),
    backgroundSize: size,
  };
}

/** Map the noise dial onto the grain overlay's opacity for a colour mode. */
export function grainFor(noise, mode) {
  return {
    opacity: round3(clamp01(noise * (mode === "light" ? 0.35 : 0.6))),
    mixBlendMode: "overlay",
  };
}

/**
 * Wrap a composition function into a ShaderDefinition.
 *
 * `build` receives resolved colour roles and the render parameters, and
 * returns { base, layers }. Layers are padded to exactly three slots and
 * the grain overlay is attached here, so no shader repeats that plumbing.
 *
 * The resulting render() is pure: no DOM, no globals, no time, no randomness.
 */
export function defineShader({ id, name, family, colorSlots, defaults, build }) {
  return {
    id,
    name,
    family,
    colorSlots,
    defaults,
    render(colors, noise, intensity, mode) {
      const roles = resolveRoles(colors, colorSlots, mode);
      const { base, layers } = build(roles, { noise, intensity, mode });
      return {
        base,
        layers: [layers[0] ?? null, layers[1] ?? null, layers[2] ?? null],
        grain: grainFor(noise, mode),
      };
    },
  };
}
