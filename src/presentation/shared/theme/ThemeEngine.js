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

    // 2. Resolve manifest for active preset
    const manifest = ThemeRegistry.get(effectivePreset);
    const modeData = manifest?.modes?.[mode] || {};
    const tokens = modeData.tokens || {};

    // 3. Word tokens for readability on the theme background (canvas & foreground text)
    const defaultFg = mode === "light" ? "#16181D" : "#E8EAEE";
    const defaultFgSecondary = mode === "light" ? "#2A2E35" : "#F2F4F7";
    const defaultMuted = mode === "light" ? "#555B66" : "#8A919C";
    const defaultMuted2 = mode === "light" ? "#4B5563" : "#6B7280";
    const defaultBg = mode === "light" ? "#faf8f2" : "#100e0b";

    targetEl.style.setProperty("--fg", tokens["--fg"] || defaultFg);
    targetEl.style.setProperty("--fg-secondary", tokens["--fg-secondary"] || defaultFgSecondary);
    targetEl.style.setProperty("--muted", tokens["--muted"] || defaultMuted);
    targetEl.style.setProperty("--muted-2", tokens["--muted-2"] || defaultMuted2);
    targetEl.style.setProperty("--bg", tokens["--bg"] || defaultBg);

    // Clean up component surfaces/borders so normal components keep standard neutral design tokens
    if (typeof targetEl.style.removeProperty === "function") {
      targetEl.style.removeProperty("--surface");
      targetEl.style.removeProperty("--surface-2");
      targetEl.style.removeProperty("--surface-active");
      targetEl.style.removeProperty("--border");
      targetEl.style.removeProperty("--border-strong");
    }

    // 4. Atmospheric Wallpaper / Aura Background
    const baseColor = tokens["--bg"] || (mode === "light" ? "#faf8f2" : "#100e0b");
    if (modeData.aura?.enabled !== false && modeData.aura) {
      ThemeEngine.applyManifestAura(targetEl, modeData.aura, baseColor, mode);
    } else {
      ThemeEngine.applyManifestAura(targetEl, {
        layer1: null,
        layer2: null,
        layer3: null,
        grain: {
          enabled: true,
          opacity: mode === "light" ? 0.03 : 0.05,
          mixBlendMode: "overlay",
        },
      }, baseColor, mode);
    }

    // 5. Font size scaling
    const normalizedFontSize = fontSize || "default";
    if (targetEl.getAttribute("data-font-size") !== normalizedFontSize) {
      targetEl.setAttribute("data-font-size", normalizedFontSize);
    }
    const fontScales = { small: "0.88", default: "1", large: "1.14", xlarge: "1.28" };
    const scale = fontScales[normalizedFontSize] || "1";
    targetEl.style.setProperty("--ui-font-scale", scale);

    // 6. Normal Component Accent — always stays consistent with user choice or default.
    // Switching themes does NOT change the total accent of components.
    const componentAccent = accent || ThemeRegistry.DEFAULT_ACCENT;
    const accentVars = deriveAccentShades(componentAccent, mode);
    for (const [prop, val] of Object.entries(accentVars)) {
      targetEl.style.setProperty(prop, val);
    }

    // 7. Theme Signature Accent — used only for the selected section from the sidebar
    const themeAccent = tokens["--accent"] || componentAccent;
    const themeAccentSoft = tokens["--accent-soft"] || (mode === "light" ? "rgba(85, 91, 102, 0.12)" : "rgba(85, 91, 102, 0.16)");
    targetEl.style.setProperty("--theme-accent", themeAccent);
    targetEl.style.setProperty("--theme-accent-soft", themeAccentSoft);

    // 8. Handle Custom Imported Plugin Themes or custom CSS overrides
    if (manifest && (manifest.type === "custom" || modeData.customCss)) {
      this.#applyCustomPluginTheme(manifest, mode);
    } else {
      this.#clearCustomPluginTheme();
    }

    // 9. Apply User Custom CSS override
    if (customCss !== undefined) {
      this.applyCustomCss(customCss);
    }

    // 10. Meta Theme-Color update for browser chrome
    if (typeof document !== "undefined") {
      const themeColorMeta = document.getElementById("theme-color-meta") || document.querySelector("meta[name='theme-color']");
      if (themeColorMeta) {
        themeColorMeta.setAttribute("content", tokens["--bg"] || (mode === "light" ? "#faf8f2" : "#100e0b"));
      }
    }
  }

  /**
   * Apply an Aura specification from a theme manifest directly to CSS variables.
   *
   * @param {HTMLElement} targetEl
   * @param {object} aura
   * @param {string} baseColor
   */
  static applyManifestAura(targetEl, aura, baseColor = "#100e0b", mode = "dark") {
    if (!targetEl || !targetEl.style) return;
    const s = targetEl.style;
    s.setProperty("--aura-base", baseColor);

    for (const n of [1, 2, 3]) {
      const ly = aura?.[`layer${n}`];
      if (!ly) {
        s.setProperty(`--aura-${n}-bg`, "none");
        s.setProperty(`--aura-${n}-blend`, "normal");
        s.setProperty(`--aura-${n}-blur`, "0px");
        s.setProperty(`--aura-${n}-opacity`, "0");
        s.setProperty(`--aura-${n}-size`, "auto");
      } else {
        s.setProperty(`--aura-${n}-bg`, ly.background || ly.bg || "none");
        s.setProperty(`--aura-${n}-blend`, ly.mixBlendMode || ly.blend || "normal");
        let blurVal = "0px";
        if (ly.blur !== undefined && ly.blur !== null) {
          blurVal = typeof ly.blur === "number" ? `${ly.blur}px` : String(ly.blur);
        } else if (ly.filter) {
          const m = String(ly.filter).match(/blur\(([^)]+)\)/);
          if (m) blurVal = m[1];
        }
        if (!blurVal.endsWith("px")) blurVal += "px";
        s.setProperty(`--aura-${n}-blur`, blurVal);
        s.setProperty(`--aura-${n}-opacity`, String(ly.opacity ?? 1));
        s.setProperty(`--aura-${n}-size`, ly.backgroundSize || ly.size || "auto");
      }
    }

    // Every theme bg will have grain to it:
    // If grain opacity is explicitly defined (> 0), honor it;
    // otherwise fallback to subtle analog film grain (0.05 in dark mode, 0.03 in light mode).
    const defaultGrainOpacity = mode === "light" ? "0.03" : "0.05";
    const grainSpec = aura?.grain;
    let grainOpacity = defaultGrainOpacity;
    if (grainSpec && grainSpec.enabled !== false && grainSpec.opacity !== undefined && Number(grainSpec.opacity) > 0) {
      const num = Number(grainSpec.opacity);
      if (mode === "dark" && num >= 0.5) {
        grainOpacity = "0.05";
      } else if (mode === "light" && num >= 0.15) {
        grainOpacity = "0.03";
      } else {
        grainOpacity = String(grainSpec.opacity);
      }
    }
    const grainBlend = grainSpec?.mixBlendMode || grainSpec?.blend || "overlay";

    s.setProperty("--aura-grain-opacity", grainOpacity);
    s.setProperty("--aura-grain-blend", grainBlend);
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
    if (typeof document === "undefined") return;
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
    if (typeof document === "undefined") return;
    const styleTag = document.getElementById("syncly-custom-plugin-theme-style");
    if (styleTag) {
      styleTag.textContent = "";
    }
  }

  /**
   * Sanitizes and injects user custom CSS stylesheet.
   */
  static applyCustomCss(css = "") {
    if (typeof document === "undefined") return;
    let styleTag = document.getElementById("syncly-custom-css") || document.getElementById("neptab-custom-css");
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "syncly-custom-css";
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = sanitizeCss(css || "");
  }
}
