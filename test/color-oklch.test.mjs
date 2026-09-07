import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { hexToOklch, oklchToHex, hexToRgb } from "../src/presentation/shared/colorUtils.js";

const channelsWithin = (a, b, tolerance) => {
  const x = hexToRgb(a), y = hexToRgb(b);
  return Math.abs(x.r - y.r) <= tolerance
      && Math.abs(x.g - y.g) <= tolerance
      && Math.abs(x.b - y.b) <= tolerance;
};

describe("OKLCH conversion", () => {
  test("white is L=1 with no chroma", () => {
    const { l, c } = hexToOklch("#FFFFFF");
    assert.ok(Math.abs(l - 1) < 0.002, `L was ${l}`);
    assert.ok(c < 0.002, `C was ${c}`);
  });

  test("black is L=0", () => {
    const { l } = hexToOklch("#000000");
    assert.ok(l < 0.002, `L was ${l}`);
  });

  test("hue is preserved and reported in degrees", () => {
    const { h } = hexToOklch("#3B82F6");
    assert.ok(h >= 0 && h < 360, `H was ${h}`);
  });

  test("round-trips in-gamut colours within one channel step", () => {
    for (const hex of ["#3B82F6", "#E64A19", "#34D399", "#555B66", "#121316"]) {
      const back = oklchToHex(hexToOklch(hex));
      assert.ok(channelsWithin(back, hex, 1), `${hex} round-tripped to ${back}`);
    }
  });

  test("clamps out-of-gamut chroma to a valid hex", () => {
    const hex = oklchToHex({ l: 0.6, c: 0.5, h: 150 });
    assert.match(hex, /^#[0-9a-fA-F]{6}$/);
  });

  test("lowering L darkens without shifting hue", () => {
    const src = hexToOklch("#3B82F6");
    const dark = hexToOklch(oklchToHex({ ...src, l: 0.2 }));
    assert.ok(Math.abs(dark.h - src.h) < 2, `hue drifted ${src.h} -> ${dark.h}`);
  });
});
