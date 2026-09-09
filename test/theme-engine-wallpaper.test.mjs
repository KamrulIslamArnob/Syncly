import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ShaderRegistry } from "../src/domain/services/ShaderRegistry.js";
import { Wallpaper } from "../src/domain/entities/Wallpaper.js";
import { registerAllShaders } from "../src/presentation/shared/theme/shaders/index.js";
import { ThemeEngine } from "../src/presentation/shared/theme/ThemeEngine.js";

/** Minimal stand-in for an element's style object. */
function fakeEl() {
  const props = new Map();
  return {
    props,
    style: {
      setProperty: (k, v) => props.set(k, String(v)),
      getPropertyValue: (k) => props.get(k) ?? "",
    },
  };
}

beforeEach(() => {
  ShaderRegistry.clear();
  registerAllShaders();
});

describe("ThemeEngine.applyWallpaper", () => {
  const wp = () => new Wallpaper({ shaderId: "vapor-bloom", colors: ["#FFFFFF", "#0B0B0D"] });

  test("writes the base colour", () => {
    const el = fakeEl();
    ThemeEngine.applyWallpaper(el, wp(), "dark");
    assert.equal(el.props.get("--aura-base").toLowerCase(), "#0b0b0d");
  });

  test("writes all five properties for each of the three layers", () => {
    const el = fakeEl();
    ThemeEngine.applyWallpaper(el, wp(), "dark");
    for (const n of [1, 2, 3]) {
      for (const suffix of ["bg", "blend", "blur", "opacity", "size"]) {
        assert.ok(el.props.has(`--aura-${n}-${suffix}`), `missing --aura-${n}-${suffix}`);
      }
    }
  });

  test("blur always carries a px unit", () => {
    const el = fakeEl();
    ThemeEngine.applyWallpaper(el, wp(), "dark");
    for (const n of [1, 2, 3]) {
      assert.match(el.props.get(`--aura-${n}-blur`), /^\d+(\.\d+)?px$/, `layer ${n} blur lacks px`);
    }
  });

  test("a null layer is written as none / 0 / 0px / auto", () => {
    const el = fakeEl();
    ThemeEngine.applyWallpaper(el, new Wallpaper({ shaderId: "vapor-band", colors: ["#FFFFFF", "#0A0A0C"] }), "dark");
    assert.equal(el.props.get("--aura-3-bg"), "none");
    assert.equal(el.props.get("--aura-3-opacity"), "0");
    assert.equal(el.props.get("--aura-3-blur"), "0px");
    assert.equal(el.props.get("--aura-3-size"), "auto");
    assert.equal(el.props.get("--aura-3-blend"), "normal");
  });

  test("writes grain properties", () => {
    const el = fakeEl();
    ThemeEngine.applyWallpaper(el, wp(), "dark");
    assert.equal(el.props.get("--aura-grain-opacity"), "0.3");
    assert.equal(el.props.get("--aura-grain-blend"), "overlay");
  });

  test("dark and light modes produce different output", () => {
    const d = fakeEl(), l = fakeEl();
    ThemeEngine.applyWallpaper(d, wp(), "dark");
    ThemeEngine.applyWallpaper(l, wp(), "light");
    assert.notEqual(d.props.get("--aura-grain-opacity"), l.props.get("--aura-grain-opacity"));
  });

  test("defaultWallpaper is valid and uses the registry default shader", () => {
    const w = ThemeEngine.defaultWallpaper();
    assert.equal(w.shaderId, ShaderRegistry.DEFAULT_SHADER_ID);
    assert.equal(w.colors.length, ShaderRegistry.get(w.shaderId).colorSlots);
  });

  test("tolerates a null element without throwing", () => {
    assert.doesNotThrow(() => ThemeEngine.applyWallpaper(null, wp(), "dark"));
  });
});

describe("ThemeEngine.applyTheme", () => {
  function fakeTarget() {
    const props = new Map();
    const attrs = new Map();
    return {
      props,
      attrs,
      style: {
        setProperty: (k, v) => props.set(k, String(v)),
        getPropertyValue: (k) => props.get(k) ?? "",
        removeProperty: (k) => props.delete(k),
      },
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => attrs.get(k) ?? null,
    };
  }

  test("updates foreground word tokens (--fg, --muted) when switching presets", () => {
    const el = fakeTarget();
    ThemeEngine.applyTheme(el, { themeId: "cyberpunk", colorMode: "dark" });
    assert.equal(el.props.get("--fg"), "#F8FAFC");
    assert.equal(el.props.get("--fg-secondary"), "#FDE047");
    assert.equal(el.props.get("--muted"), "#94A3B8");

    ThemeEngine.applyTheme(el, { themeId: "sage", colorMode: "dark" });
    assert.equal(el.props.get("--fg"), "#F2F7F4");
    assert.equal(el.props.get("--fg-secondary"), "#D4E4DC");
    assert.equal(el.props.get("--muted"), "#8BA698");
  });

  test("applies atmospheric aura layers from manifest when switching themes", () => {
    const el = fakeTarget();
    ThemeEngine.applyTheme(el, { themeId: "glacier_mist", colorMode: "light" });
    assert.equal(el.props.get("--aura-base"), "#faf8f2");
    assert.equal(el.props.get("--aura-1-blend"), "multiply");
    assert.equal(el.props.get("--aura-1-blur"), "130px");
    assert.equal(el.props.get("--aura-3-bg"), "none");
  });

  test("applies Aurora Beams with 3 layers and grain", () => {
    const el = fakeTarget();
    ThemeEngine.applyTheme(el, { themeId: "aurora", colorMode: "dark" });
    assert.equal(el.props.get("--aura-base"), "#100e0b");
    assert.equal(el.props.get("--aura-1-blend"), "screen");
    assert.equal(el.props.get("--aura-2-blend"), "screen");
    assert.equal(el.props.get("--aura-3-blend"), "multiply");
    assert.equal(el.props.get("--aura-grain-opacity"), "0.05");
  });

  test("remembers separate themes for dark mode vs white (light) mode", () => {
    const el = fakeTarget();

    // 1. User picks Aurora Beams in Dark mode
    let darkTheme = "aurora";
    let lightTheme = "ocean_pearl";
    let currentMode = "dark";

    ThemeEngine.applyTheme(el, { themeId: darkTheme, colorMode: currentMode });
    assert.equal(el.attrs.get("data-theme-preset"), "aurora");
    assert.equal(el.attrs.get("data-color-mode"), "dark");
    assert.equal(el.props.get("--aura-base"), "#100e0b");

    // 2. User switches to White (light) mode -> loads lightTheme
    currentMode = "light";
    ThemeEngine.applyTheme(el, { themeId: lightTheme, colorMode: currentMode });
    assert.equal(el.attrs.get("data-theme-preset"), "ocean_pearl");
    assert.equal(el.attrs.get("data-color-mode"), "light");
    assert.equal(el.props.get("--aura-base"), "#faf8f2");

    // 3. In white mode, user picks Orchid Bloom
    lightTheme = "orchid_bloom";
    ThemeEngine.applyTheme(el, { themeId: lightTheme, colorMode: currentMode });
    assert.equal(el.attrs.get("data-theme-preset"), "orchid_bloom");
    assert.equal(el.props.get("--fg-secondary"), "#9333EA");

    // 4. User switches back to Dark mode -> restores darkTheme (aurora)
    currentMode = "dark";
    ThemeEngine.applyTheme(el, { themeId: darkTheme, colorMode: currentMode });
    assert.equal(el.attrs.get("data-theme-preset"), "aurora");
    assert.equal(el.attrs.get("data-color-mode"), "dark");
    assert.equal(el.props.get("--aura-base"), "#100e0b");

    // 5. User switches back to White mode -> restores lightTheme (orchid_bloom)
    currentMode = "light";
    ThemeEngine.applyTheme(el, { themeId: lightTheme, colorMode: currentMode });
    assert.equal(el.attrs.get("data-theme-preset"), "orchid_bloom");
    assert.equal(el.attrs.get("data-color-mode"), "light");
  });

  test("every theme bg has grain applied in both dark and light modes", () => {
    const el = fakeTarget();
    const testThemes = ["aurora", "glacier_mist", "orchid_bloom", "ocean_pearl", "minimal", "solid", "retro_grid", "cyberpunk"];

    for (const themeId of testThemes) {
      // Dark mode check: grain must be active (opacity: 0.05, blend: overlay)
      ThemeEngine.applyTheme(el, { themeId, colorMode: "dark" });
      assert.equal(el.props.get("--aura-grain-opacity"), "0.05", `${themeId} dark mode missing grain`);
      assert.equal(el.props.get("--aura-grain-blend"), "overlay", `${themeId} dark mode grain blend mismatch`);

      // Light mode check: grain must be active (opacity: 0.03, blend: overlay)
      ThemeEngine.applyTheme(el, { themeId, colorMode: "light" });
      assert.equal(el.props.get("--aura-grain-opacity"), "0.03", `${themeId} light mode missing grain`);
      assert.equal(el.props.get("--aura-grain-blend"), "overlay", `${themeId} light mode grain blend mismatch`);
    }
  });

  test("preserves normal component accent and only updates --theme-accent for sidebar", () => {
    const el = fakeTarget();

    // With default accent:
    ThemeEngine.applyTheme(el, { themeId: "orchid_bloom", colorMode: "dark" });
    // Normal component accent is preserved (#555b66), NOT overwritten by orchid bloom (#C084FC)
    assert.equal(el.props.get("--accent"), "#555b66");
    assert.equal(el.props.get("--on-accent"), "#FFFFFF");
    // Only the sidebar selected section token gets the theme accent
    assert.equal(el.props.get("--theme-accent"), "#C084FC");
    assert.equal(el.props.get("--theme-accent-soft"), "rgba(192, 132, 252, 0.18)");
    // Component surfaces/borders are not overwritten
    assert.equal(el.props.get("--surface"), undefined);
    assert.equal(el.props.get("--border"), undefined);

    // With a user-chosen custom accent:
    ThemeEngine.applyTheme(el, { themeId: "glacier_mist", colorMode: "dark", accent: "#3B82F6" });
    assert.equal(el.props.get("--accent"), "#3b82f6");
    assert.equal(el.props.get("--theme-accent"), "#2DD4BF");
  });
});
