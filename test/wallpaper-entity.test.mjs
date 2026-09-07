import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ShaderRegistry } from "../src/domain/services/ShaderRegistry.js";
import { Wallpaper } from "../src/domain/entities/Wallpaper.js";

const noopRender = () => ({ base: "#000000", layers: [null, null, null], grain: { opacity: 0, mixBlendMode: "overlay" } });

beforeEach(() => {
  ShaderRegistry.clear();
  ShaderRegistry.register({
    id: "two-slot", name: "Two", family: "T", colorSlots: 2,
    defaults: { colors: ["#FFFFFF", "#0B0B0D"], noise: 0.5, intensity: 0.5 }, render: noopRender,
  });
  ShaderRegistry.register({
    id: "three-slot", name: "Three", family: "T", colorSlots: 3,
    defaults: { colors: ["#EEEEEE", "#111111", "#888888"], noise: 0.5, intensity: 0.5 }, render: noopRender,
  });
});

describe("Wallpaper", () => {
  const valid = () => new Wallpaper({ shaderId: "two-slot", colors: ["#FFFFFF", "#0B0B0D"] });

  test("constructs with defaults for noise and intensity", () => {
    const w = valid();
    assert.equal(w.noise, 0.5);
    assert.equal(w.intensity, 0.5);
  });

  test("rejects an unknown shader id", () => {
    assert.throws(() => new Wallpaper({ shaderId: "nope", colors: ["#FFFFFF"] }), /Unknown shaderId/);
  });

  test("rejects a colour count that disagrees with the shader", () => {
    assert.throws(() => new Wallpaper({ shaderId: "two-slot", colors: ["#FFFFFF"] }), /exactly 2/);
  });

  test("rejects malformed hex", () => {
    assert.throws(() => new Wallpaper({ shaderId: "two-slot", colors: ["#FFF", "#0B0B0D"] }), /Invalid colour/);
  });

  test("rejects out-of-range noise and intensity", () => {
    assert.throws(() => new Wallpaper({ shaderId: "two-slot", colors: ["#FFFFFF", "#000000"], noise: 1.5 }), /noise/);
    assert.throws(() => new Wallpaper({ shaderId: "two-slot", colors: ["#FFFFFF", "#000000"], intensity: -1 }), /intensity/);
  });

  test("colors getter returns a copy, not the internal array", () => {
    const w = valid();
    w.colors[0] = "#FF0000";
    assert.equal(w.colors[0], "#FFFFFF");
  });

  test("withColor returns a new instance and leaves the original alone", () => {
    const w = valid();
    const next = w.withColor(0, "#123456");
    assert.equal(next.colors[0], "#123456");
    assert.equal(w.colors[0], "#FFFFFF");
    assert.notEqual(w, next);
  });

  test("withShader grows the colour list from the new shader's defaults", () => {
    const next = valid().withShader("three-slot");
    assert.equal(next.colors.length, 3);
    assert.equal(next.colors[0], "#FFFFFF");
    assert.equal(next.colors[2], "#888888");
  });

  test("withShader drops colours the new shader cannot take", () => {
    const three = new Wallpaper({ shaderId: "three-slot", colors: ["#AAAAAA", "#BBBBBB", "#CCCCCC"] });
    const next = three.withShader("two-slot");
    assert.deepEqual(next.colors, ["#AAAAAA", "#BBBBBB"]);
  });

  test("round-trips through JSON", () => {
    const w = new Wallpaper({ shaderId: "two-slot", colors: ["#FFFFFF", "#0B0B0D"], noise: 0.3, intensity: 0.8 });
    const back = Wallpaper.fromJSON(w.toJSON());
    assert.equal(back.shaderId, w.shaderId);
    assert.deepEqual(back.colors, w.colors);
    assert.equal(back.noise, 0.3);
    assert.equal(back.intensity, 0.8);
  });

  test("toJSON stamps a version", () => {
    assert.equal(valid().toJSON().v, 2);
  });
});
