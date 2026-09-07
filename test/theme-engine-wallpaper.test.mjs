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
