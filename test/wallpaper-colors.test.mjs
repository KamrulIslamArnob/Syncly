import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resolveRoles, deriveGround, deriveTint } from "../src/presentation/shared/theme/deriveWallpaperColors.js";
import { hexToOklch } from "../src/presentation/shared/colorUtils.js";

describe("wallpaper colour roles", () => {
  test("uses supplied colours when all slots are given", () => {
    const roles = resolveRoles(["#FFFFFF", "#0B0B0D", "#727272"], 3, "dark");
    assert.equal(roles.light, "#FFFFFF");
    assert.equal(roles.ground, "#0B0B0D");
    assert.equal(roles.tint, "#727272");
  });

  test("derives ground when only one slot is given", () => {
    const roles = resolveRoles(["#FFFFFF"], 1, "dark");
    assert.equal(roles.light, "#FFFFFF");
    assert.match(roles.ground, /^#[0-9a-fA-F]{6}$/);
    assert.notEqual(roles.ground.toLowerCase(), "#ffffff");
  });

  test("derived dark ground is dark and light ground is light", () => {
    assert.ok(hexToOklch(deriveGround("#3B82F6", "dark")).l <= 0.15);
    assert.ok(hexToOklch(deriveGround("#3B82F6", "light")).l >= 0.93);
  });

  test("derived ground preserves hue", () => {
    const src = hexToOklch("#3B82F6");
    const ground = hexToOklch(deriveGround("#3B82F6", "dark"));
    assert.ok(Math.abs(ground.h - src.h) < 3, `hue drifted ${src.h} -> ${ground.h}`);
  });

  test("derived tint rotates hue by 30 degrees", () => {
    const src = hexToOklch("#3B82F6");
    const tint = hexToOklch(deriveTint("#3B82F6"));
    const delta = (tint.h - src.h + 360) % 360;
    assert.ok(Math.abs(delta - 30) < 3, `rotation was ${delta}`);
  });

  test("ignores colours beyond the declared slot count", () => {
    const roles = resolveRoles(["#FFFFFF", "#0B0B0D", "#FF0000"], 2, "dark");
    assert.equal(roles.ground, "#0B0B0D");
    assert.notEqual(roles.tint, "#FF0000");
  });
});
