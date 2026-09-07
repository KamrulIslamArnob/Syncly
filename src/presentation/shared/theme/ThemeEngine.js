import { ThemeRegistry } from "../../../domain/services/ThemeRegistry.js";
import { ShaderRegistry } from "../../../domain/services/ShaderRegistry.js";
import { Wallpaper } from "../../../domain/entities/Wallpaper.js";
import { deriveAccentShades } from "../colorUtils.js";
import { sanitizeCss } from "../../../infrastructure/security/cssSanitizer.js";
import { registerAllShaders } from "./shaders/index.js";
import "./manifests/index.js";

registerAllShaders();

/**
 * ThemeEngine — Presentation Engine
 * --------------------------------------------------------------------
 * High-performance, reactive theme and token manager.
 * Applies theme presets, dark/light color modes, accent shades, and
 * imported plugin stylesheets without conflicting inline specificity.
 */
export class ThemeEngine {
  /**
   * Apply a theme configuration to a DOM element (defaults to document.documentElement).
   *
   * @param {HTMLElement} [targetEl=document.documentElement]
   * @param {object} options
   * @param {string} [options.themeId="aurora"] - Preset ID or custom theme ID
   * @param {"dark"|"light"} [options.colorMode="dark"]
   * @param {string} [options.accent=null]
   * @param {string} [options.fontSize="default"]
   * @param {string} [options.customCss=""]
   */
  static applyTheme(targetEl = document.documentElement, {
    themeId = "aurora",
    colorMode = "dark",
    accent = null,
    fontSize = "default",
    customCss = "",
  } = {}) {
    if (!targetEl) return;

    const mode = colorMode === "light" ? "light" : "dark";
    const effectivePreset = ThemeRegistry.isValid(themeId) ? themeId : "aurora";

    // 1. Set standard dataset attributes
    if (targetEl.getAttribute("data-color-mode") !== mode) {
      targetEl.setAttribute("data-color-mode", mode);
    }
    if (targetEl.getAttribute("data-theme-preset") !== effectivePreset) {
      targetEl.setAttribute("data-theme-preset", effectivePreset);
    }

    // Wallpaper. Until Plan 3 lands LEGACY_PRESET_MAP, any stored preset id
    // resolves to the default wallpaper rather than its old CSS block.
    this.applyWallpaper(targetEl, this.defaultWallpaper(), mode);

    // 2. Font size scaling
    const normalizedFontSize = fontSize || "default";
    if (targetEl.getAttribute("data-font-size") !== normalizedFontSize) {
      targetEl.setAttribute("data-font-size", normalizedFontSize);
    }
    const fontScales = { small: "0.88", default: "1", large: "1.14", xlarge: "1.28" };
    const scale = fontScales[normalizedFontSize] || "1";
    targetEl.style.setProperty("--ui-font-scale", scale);

    // 3. Dynamic Accent Shades & Accessible On-Accent
    const baseAccent = accent || ThemeRegistry.DEFAULT_ACCENT;
    const accentVars = deriveAccentShades(baseAccent, mode);
    for (const [prop, val] of Object.entries(accentVars)) {
      targetEl.style.setProperty(prop, val);
    }

    // 4. Handle Custom Imported Plugin Themes
    const manifest = ThemeRegistry.get(effectivePreset);
    if (manifest && manifest.type === "custom") {
      this.#applyCustomPluginTheme(manifest, mode);
    } else {
      this.#clearCustomPluginTheme();
    }

    // 5. Apply User Custom CSS override
    if (customCss !== undefined) {
      this.applyCustomCss(customCss);
    }

    // 6. Meta Theme-Color update for browser chrome
    const themeColorMeta = document.getElementById("theme-color-meta") || document.querySelector("meta[name='theme-color']");
    if (themeColorMeta) {
      themeColorMeta.setAttribute("content", mode === "light" ? "#faf8f2" : "#100e0b");
    }
  }

  /**
   * The wallpaper used when settings carry no usable selection.
   * Plan 3 replaces the caller-side fallback with LEGACY_PRESET_MAP.
   */
  static defaultWallpaper() {
    const def = ShaderRegistry.get(ShaderRegistry.DEFAULT_SHADER_ID);
    return new Wallpaper({
      shaderId: def.id,
      colors: def.defaults.colors,
      noise: def.defaults.noise,
      intensity: def.defaults.intensity,
    });
  }

  /**
   * Render a wallpaper and write it onto the element as CSS custom properties.
   * The consuming CSS lives in newTab.css; nothing here touches class names
   * or the aura DOM.
   *
   * @param {HTMLElement} targetEl
   * @param {Wallpaper} wallpaper
   * @param {"dark"|"light"} mode
   */
  static applyWallpaper(targetEl, wallpaper, mode = "dark") {
    if (!targetEl || !targetEl.style || !wallpaper) return;

    const def = ShaderRegistry.get(wallpaper.shaderId);
    if (!def) return;

    const spec = def.render(wallpaper.colors, wallpaper.noise, wallpaper.intensity, mode);
    const s = targetEl.style;

    s.setProperty("--aura-base", spec.base);

    spec.layers.forEach((ly, i) => {
      const n = i + 1;
      if (!ly) {
        s.setProperty(`--aura-${n}-bg`, "none");
        s.setProperty(`--aura-${n}-blend`, "normal");
        s.setProperty(`--aura-${n}-blur`, "0px");
        s.setProperty(`--aura-${n}-opacity`, "0");
        s.setProperty(`--aura-${n}-size`, "auto");
        return;
      }
      s.setProperty(`--aura-${n}-bg`, ly.background);
      s.setProperty(`--aura-${n}-blend`, ly.mixBlendMode);
      s.setProperty(`--aura-${n}-blur`, `${ly.blur}px`);
      s.setProperty(`--aura-${n}-opacity`, String(ly.opacity));
      s.setProperty(`--aura-${n}-size`, ly.backgroundSize);
    });

    s.setProperty("--aura-grain-opacity", String(spec.grain.opacity));
    s.setProperty("--aura-grain-blend", spec.grain.mixBlendMode);
  }

  /**
   * Injects CSS token overrides for custom imported plugin themes.
   */
  static #applyCustomPluginTheme(manifest, mode) {
    let styleTag = document.getElementById("syncly-custom-plugin-theme-style");
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "syncly-custom-plugin-theme-style";
      document.head.appendChild(styleTag);
    }

    const modeData = manifest.modes?.[mode] || {};
    const tokens = modeData.tokens || {};
    const customCss = modeData.customCss || "";

    const tokenRules = Object.entries(tokens)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join("\n");

    const cssRule = `:root[data-theme-preset="${manifest.id}"] {\n${tokenRules}\n}\n${customCss}`;
    styleTag.textContent = sanitizeCss(cssRule);
  }

  static #clearCustomPluginTheme() {
    const styleTag = document.getElementById("syncly-custom-plugin-theme-style");
    if (styleTag) {
      styleTag.textContent = "";
    }
  }

  /**
   * Sanitizes and injects user custom CSS stylesheet.
   */
  static applyCustomCss(css = "") {
    let styleTag = document.getElementById("syncly-custom-css") || document.getElementById("neptab-custom-css");
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "syncly-custom-css";
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = sanitizeCss(css || "");
  }
}
