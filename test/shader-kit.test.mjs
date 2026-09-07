import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { rgba, scaleAlpha, layer, grainFor, defineShader } from "../src/presentation/shared/theme/shaders/kit.js";
import { assertValidAuraSpec } from "./helpers/auraSpec.mjs";

describe("shader kit", () => {
  test("rgba expands a hex with alpha", () => {
    assert.equal(rgba("#FF8000", 0.5), "rgba(255, 128, 0, 0.5)");
  });

  test("scaleAlpha is unity at intensity 0.5", () => {
    assert.ok(Math.abs(scaleAlpha(0.4, 0.5) - 0.4) < 1e-9);
  });

  test("scaleAlpha spans 0.4x to 1.6x and clamps at 1", () => {
    assert.ok(Math.abs(scaleAlpha(0.5, 0) - 0.2) < 1e-9);
    assert.ok(Math.abs(scaleAlpha(0.5, 1) - 0.8) < 1e-9);
    assert.equal(scaleAlpha(0.9, 1), 1);
  });

  test("grainFor maps noise per mode", () => {
    assert.ok(Math.abs(grainFor(0.5, "dark").opacity - 0.3) < 1e-9);
    assert.ok(Math.abs(grainFor(0.5, "light").opacity - 0.175) < 1e-9);
    assert.equal(grainFor(0.5, "dark").mixBlendMode, "overlay");
  });

  test("layer fills defaults", () => {
    const l = layer({ background: "red" });
    assert.equal(l.mixBlendMode, "normal");
    assert.equal(l.blur, 0);
    assert.equal(l.opacity, 1);
    assert.equal(l.backgroundSize, "auto");
  });

  test("defineShader pads layers to exactly three", () => {
    const def = defineShader({
      id: "x", name: "X", family: "F", colorSlots: 1,
      defaults: { colors: ["#FFFFFF"], noise: 0.5, intensity: 0.5 },
      build: ({ ground }) => ({ base: ground, layers: [layer({ background: "red" })] }),
    });
    const spec = def.render(["#FFFFFF"], 0.5, 0.5, "dark");
    assert.equal(spec.layers.length, 3);
    assert.equal(spec.layers[1], null);
    assert.equal(spec.layers[2], null);
    assertValidAuraSpec(spec, "x");
  });

  test("render is pure — same inputs give deep-equal output", () => {
    const def = defineShader({
      id: "y", name: "Y", family: "F", colorSlots: 1,
      defaults: { colors: ["#FFFFFF"], noise: 0.5, intensity: 0.5 },
      build: ({ light, ground }) => ({
        base: ground,
        layers: [layer({ background: `radial-gradient(circle, ${rgba(light, 0.4)} 0%, ${rgba(light, 0)} 100%)`, blend: "screen", blur: 40 })],
      }),
    });
    const a = def.render(["#FFFFFF"], 0.5, 0.5, "dark");
    const b = def.render(["#FFFFFF"], 0.5, 0.5, "dark");
    assert.deepEqual(a, b);
    assertValidAuraSpec(a, "y");
  });

  test("the validator rejects a malformed gradient", () => {
    const bad = {
      base: "#000000",
      layers: [layer({ background: "radial-gradient(60% at , rgba(0,0,0,0.5))" }), null, null],
      grain: { opacity: 0.3, mixBlendMode: "overlay" },
    };
    assert.throws(() => assertValidAuraSpec(bad, "bad"), /not valid CSS/);
  });
});
