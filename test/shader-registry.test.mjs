import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ShaderRegistry } from "../src/domain/services/ShaderRegistry.js";

const stub = (over = {}) => ({
  id: "test-shader",
  name: "Test Shader",
  family: "Test",
  colorSlots: 2,
  defaults: { colors: ["#FFFFFF", "#000000"], noise: 0.5, intensity: 0.5 },
  render: () => ({ base: "#000000", layers: [null, null, null], grain: { opacity: 0, mixBlendMode: "overlay" } }),
  ...over,
});

describe("ShaderRegistry", () => {
  beforeEach(() => ShaderRegistry.clear());

  test("registers and retrieves a shader", () => {
    ShaderRegistry.register(stub());
    assert.equal(ShaderRegistry.get("test-shader").name, "Test Shader");
  });

  test("isValid is strict and does not fall back", () => {
    ShaderRegistry.register(stub());
    assert.equal(ShaderRegistry.isValid("test-shader"), true);
    assert.equal(ShaderRegistry.isValid("nope"), false);
    assert.equal(ShaderRegistry.isValid(null), false);
  });

  test("get falls back to the default shader for an unknown id", () => {
    ShaderRegistry.register(stub({ id: ShaderRegistry.DEFAULT_SHADER_ID }));
    assert.equal(ShaderRegistry.get("nope").id, ShaderRegistry.DEFAULT_SHADER_ID);
  });

  test("get returns null when the registry is empty", () => {
    assert.equal(ShaderRegistry.get("anything"), null);
  });

  test("byFamily groups shaders", () => {
    ShaderRegistry.register(stub({ id: "a", family: "Vapor" }));
    ShaderRegistry.register(stub({ id: "b", family: "Vapor" }));
    ShaderRegistry.register(stub({ id: "c", family: "Beams" }));
    assert.equal(ShaderRegistry.byFamily("Vapor").length, 2);
  });

  test("rejects definitions with a bad colorSlots count", () => {
    assert.throws(() => ShaderRegistry.register(stub({ colorSlots: 0 })), /colorSlots/);
    assert.throws(() => ShaderRegistry.register(stub({ colorSlots: 4 })), /colorSlots/);
  });

  test("rejects a defaults.colors length that disagrees with colorSlots", () => {
    assert.throws(
      () => ShaderRegistry.register(stub({ colorSlots: 3, defaults: { colors: ["#FFFFFF"], noise: 0.5, intensity: 0.5 } })),
      /defaults\.colors/,
    );
  });

  test("rejects a definition without a render function", () => {
    assert.throws(() => ShaderRegistry.register(stub({ render: undefined })), /render/);
  });

  test("registered definitions are frozen", () => {
    ShaderRegistry.register(stub());
    assert.equal(Object.isFrozen(ShaderRegistry.get("test-shader")), true);
  });
});
