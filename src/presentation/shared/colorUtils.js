/**
 * Color utilities for dynamically deriving UI accent shades, borders, and soft fills.
 */

/**
 * Normalizes any 3-digit or 6-digit hex string into { r, g, b }.
 * Falls back to Dark Grey rgb(85, 91, 102) on invalid input.
 */
function hexToRgb(hex) {
  if (typeof hex !== "string") return { r: 85, g: 91, b: 102 };
  let clean = hex.trim().replace(/^#/, "");
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return { r: 85, g: 91, b: 102 };
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Converts RGB numbers to #RRGGBB hex string.
 */
function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const hex = [r, g, b]
    .map((v) => clamp(v).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`;
}

/**
 * Adjusts color brightness (factor < 0 darkens, factor > 0 lightens).
 */
function adjustBrightness(hex, factor) {
  const { r, g, b } = hexToRgb(hex);
  if (factor < 0) {
    // Darken towards black
    const mul = 1 + factor;
    return rgbToHex(r * mul, g * mul, b * mul);
  } else {
    // Lighten towards white
    return rgbToHex(r + (255 - r) * factor, g + (255 - g) * factor, b + (255 - b) * factor);
  }
}

/**
 * Derives a full set of CSS accent variables from a base hex color.
 *
 * @param {string} baseHex - The user-chosen base hex color (e.g. #555B66)
 * @param {"dark"|"light"} colorMode - Current color mode
 * @returns {Record<string, string>} Key-value pairs for CSS variables
 */
export function deriveAccentShades(baseHex = "#555B66", colorMode = "dark") {
  const rgb = hexToRgb(baseHex);
  const normalizedHex = rgbToHex(rgb.r, rgb.g, rgb.b);

  const isLight = colorMode === "light";
  const softAlpha = isLight ? 0.12 : 0.16;
  const glowAlpha = isLight ? 0.24 : 0.38;

  // Darker shade for borders and pressed states (-22%)
  const accentDark = adjustBrightness(normalizedHex, -0.22);

  // CTA/Primary highlight
  const accentPrimary = isLight
    ? adjustBrightness(normalizedHex, -0.08)
    : adjustBrightness(normalizedHex, 0.1);

  // Gradient stops
  const accentLight = adjustBrightness(normalizedHex, 0.16);
  const accentDeep = adjustBrightness(normalizedHex, -0.14);

  return {
    "--accent": normalizedHex,
    "--accent-primary": accentPrimary,
    "--accent-dark": accentDark,
    "--accent-light": accentLight,
    "--accent-gradient": `linear-gradient(135deg, ${accentLight} 0%, ${accentDeep} 100%)`,
    "--accent-soft": `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${softAlpha})`,
    "--accent-glow": `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${glowAlpha})`,
    "--border-accent": accentDark,
    "--ring-focus": normalizedHex,
  };
}
