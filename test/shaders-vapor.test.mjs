import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ShaderRegistry } from "../src/domain/services/ShaderRegistry.js";
import { registerAllShaders } from "../src/presentation/shared/theme/shaders/index.js";
import { assertValidAuraSpec } from "./helpers/auraSpec.mjs";

const MODES = ["dark", "light"];
const EXTREMES = [
  { noise: 0, intensity: 0 },
  { noise: 0.5, intensity: 0.5 },
  { noise: 1, intensity: 1 },
];

beforeEach(() => {
  ShaderRegistry.clear();
  registerAllShaders();
});

describe("Vapor family", () => {
  test("registers three shaders", () => {
    assert.equal(ShaderRegistry.byFamily("Vapor").length, 3);
  });

  test("the default shader id resolves", () => {
    assert.equal(ShaderRegistry.isValid(ShaderRegistry.DEFAULT_SHADER_ID), true);
  });

  test("every shader renders valid CSS in both modes at parameter extremes", () => {
    for (const def of ShaderRegistry.byFamily("Vapor")) {
      for (const mode of MODES) {
        for (const { noise, intensity } of EXTREMES) {
          const spec = def.render(def.defaults.colors, noise, intensity, mode);
          assertValidAuraSpec(spec, `${def.id} ${mode} n=${noise} i=${intensity}`);
        }
      }
    }
  });

  test("every shader survives a single-colour derivation path", () => {
    for (const def of ShaderRegistry.byFamily("Vapor")) {
      const spec = def.render([def.defaults.colors[0]], 0.5, 0.5, "dark");
      assertValidAuraSpec(spec, `${def.id} derived`);
    }
  });

  test("render is pure for every shader", () => {
    for (const def of ShaderRegistry.byFamily("Vapor")) {
      const a = def.render(def.defaults.colors, 0.5, 0.5, "dark");
      const b = def.render(def.defaults.colors, 0.5, 0.5, "dark");
      assert.deepEqual(a, b, `${def.id} is not pure`);
    }
  });

  test("a user colour actually reaches the output", () => {
    const def = ShaderRegistry.get("vapor-bloom");
    const spec = def.render(["#FF0000", "#0B0B0D"], 0.5, 0.5, "dark");
    const joined = spec.layers.filter(Boolean).map((l) => l.background).join(" ");
    assert.match(joined, /255, 0, 0/, "the light colour should appear in a layer");
  });

  test("intensity 0 produces weaker layers than intensity 1", () => {
    const def = ShaderRegistry.get("vapor-bloom");
    const alphaSum = (i) => {
      const spec = def.render(def.defaults.colors, 0.5, i, "dark");
      return spec.layers.filter(Boolean)
        .flatMap((l) => [...l.background.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g)].map((m) => Number(m[1])))
        .reduce((a, b) => a + b, 0);
    };
    assert.ok(alphaSum(0) < alphaSum(1), "intensity should scale layer alpha");
  });

  test("noise 0 yields no grain and noise 1 yields the mode maximum", () => {
    const def = ShaderRegistry.get("vapor-bloom");
    assert.equal(def.render(def.defaults.colors, 0, 0.5, "dark").grain.opacity, 0);
    assert.equal(def.render(def.defaults.colors, 1, 0.5, "dark").grain.opacity, 0.6);
    assert.equal(def.render(def.defaults.colors, 1, 0.5, "light").grain.opacity, 0.35);
  });

  test("base colour comes from the ground role", () => {
    const spec = ShaderRegistry.get("vapor-bloom").render(["#FFFFFF", "#0B0B0D"], 0.5, 0.5, "dark");
    assert.equal(spec.base.toLowerCase(), "#0b0b0d");
  });
});
