/**
 * Color utilities for dynamically deriving UI accent shades, borders, soft fills, and WCAG contrast ratios.
 */

/**
 * Normalizes any 3-digit, 6-digit, or 8-digit hex string into { r, g, b }.
 * Falls back to Dark Grey rgb(85, 91, 102) on invalid input.
 */
export function hexToRgb(hex) {
  if (typeof hex !== "string") return { r: 85, g: 91, b: 102 };
  let clean = hex.trim().replace(/^#/, "");
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(clean)) {
    return { r: 85, g: 91, b: 102 };
  }
  const num = parseInt(clean.slice(0, 6), 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Converts RGB numbers to #RRGGBB hex string.
 */
export function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const hex = [r, g, b]
    .map((v) => clamp(v).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`;
}

/**
 * Calculates relative luminance according to WCAG 2.1 specifications (0.0 to 1.0).
 */
export function getLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Calculates contrast ratio between two hex colors (returns a number between 1.0 and 21.0).
 */
export function calculateContrastRatio(hex1, hex2) {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return Number(((lightest + 0.05) / (darkest + 0.05)).toFixed(2));
}

/**
 * Adjusts color brightness (factor < 0 darkens, factor > 0 lightens).
 */
export function adjustBrightness(hex, factor) {
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

  // Accessible foreground text over accent fill (WCAG AA/AAA)
  const whiteContrast = calculateContrastRatio(normalizedHex, "#FFFFFF");
  const onAccent = whiteContrast < 4.5 ? "#121316" : "#FFFFFF";

  return {
    "--accent": normalizedHex,
    "--accent-primary": accentPrimary,
    "--accent-dark": accentDark,
    "--accent-light": accentLight,
    "--accent-gradient": `linear-gradient(135deg, ${accentLight} 0%, ${accentDeep} 100%)`,
    "--accent-soft": `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${softAlpha})`,
    "--accent-glow": `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${glowAlpha})`,
    "--on-accent": onAccent,
    "--border-accent": accentDark,
    "--ring-focus": normalizedHex,
  };
}

/* ── OKLCH ─────────────────────────────────────────────────────────────
   Implemented in-repo because the project carries zero runtime deps.
   Matrices are the reference Oklab values (Ottosson).
   Used by the wallpaper shader system to derive colour roles with
   perceptually-even lightness and hue-preserving chroma changes.
   ------------------------------------------------------------------ */

const srgbToLinear = (u) => (u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4));
const linearToSrgb = (u) => (u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055);
const clampRange = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * Convert a hex colour to OKLCH.
 * @param {string} hex - "#RRGGBB"
 * @returns {{l: number, c: number, h: number}} L 0-1, C 0-~0.4, H degrees 0-360
 */
export function hexToOklch(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lr = srgbToLinear(r / 255);
  const lg = srgbToLinear(g / 255);
  const lb = srgbToLinear(b / 255);

  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c: Math.sqrt(A * A + B * B), h };
}

/** Oklab (L, a, b) to linear-light sRGB. May fall outside [0,1] when out of gamut. */
function oklabToLinearRgb(l, A, B) {
  const l_ = l + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = l - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = l - 0.0894841775 * A - 1.2914855480 * B;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  return {
    r:  4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    g: -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    b: -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3,
  };
}

const GAMUT_EPS = 1e-5;
const inGamut = ({ r, g, b }) =>
  r >= -GAMUT_EPS && r <= 1 + GAMUT_EPS &&
  g >= -GAMUT_EPS && g <= 1 + GAMUT_EPS &&
  b >= -GAMUT_EPS && b <= 1 + GAMUT_EPS;

/**
 * Convert OKLCH back to a hex colour.
 *
 * Out-of-gamut colours are mapped by REDUCING CHROMA rather than by clamping
 * RGB channels. Channel clamping shifts hue badly - forcing a saturated blue
 * to a low lightness drifted its hue by 4+ degrees - and the wallpaper system
 * relies on hue survival when deriving a dark ground from a bright light
 * colour. Binary-searching the largest in-gamut chroma keeps L and H exact.
 *
 * @param {{l: number, c: number, h: number}} oklch
 * @returns {string} "#rrggbb"
 */
export function oklchToHex({ l, c, h }) {
  const hr = (h * Math.PI) / 180;
  const cos = Math.cos(hr);
  const sin = Math.sin(hr);

  let rgb = oklabToLinearRgb(l, cos * c, sin * c);

  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = c;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklabToLinearRgb(l, cos * mid, sin * mid))) lo = mid;
      else hi = mid;
    }
    rgb = oklabToLinearRgb(l, cos * lo, sin * lo);
  }

  const to255 = (u) => Math.round(clampRange(linearToSrgb(clampRange(u, 0, 1)), 0, 1) * 255);
  return rgbToHex(to255(rgb.r), to255(rgb.g), to255(rgb.b));
}
