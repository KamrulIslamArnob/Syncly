import assert from "node:assert/strict";
import * as csstree from "css-tree";

const BLEND_MODES = new Set([
  "normal", "multiply", "screen", "overlay", "darken", "lighten",
  "color-dodge", "color-burn", "hard-light", "soft-light",
  "difference", "exclusion", "hue", "saturation", "color", "luminosity",
]);

/**
 * Assert that an AuraSpec is structurally sound and that every background
 * it produces is CSS a browser will actually accept.
 *
 * Validation goes through css-tree's lexer rather than a bare parse: the
 * parser is permissive and will happily swallow a malformed gradient as a
 * Raw node, whereas matchProperty checks the real `background` grammar.
 */
export function assertValidAuraSpec(spec, label = "spec") {
  assert.match(spec.base, /^#[0-9a-fA-F]{6}$/, `${label}: base must be #RRGGBB, got ${spec.base}`);
  assert.equal(spec.layers.length, 3, `${label}: expected exactly 3 layer slots`);

  spec.layers.forEach((ly, i) => {
    if (ly === null) return;
    const at = `${label}: layer ${i + 1}`;
    assert.equal(typeof ly.background, "string", `${at} background must be a string`);

    // Verified against css-tree 3.2.1: accepts radial, linear,
    // repeating-linear and conic gradients, and rejects malformed ones.
    const match = csstree.lexer.matchProperty("background", ly.background);
    assert.equal(
      match.error,
      null,
      `${at} is not valid CSS for 'background': ${match.error && match.error.message}\n  ${ly.background}`,
    );

    assert.ok(BLEND_MODES.has(ly.mixBlendMode), `${at} bad mixBlendMode: ${ly.mixBlendMode}`);
    assert.ok(Number.isFinite(ly.blur) && ly.blur >= 0, `${at} bad blur: ${ly.blur}`);
    assert.ok(ly.opacity >= 0 && ly.opacity <= 1, `${at} bad opacity: ${ly.opacity}`);
    assert.equal(typeof ly.backgroundSize, "string", `${at} backgroundSize must be a string`);
  });

  assert.ok(spec.grain.opacity >= 0 && spec.grain.opacity <= 1, `${label}: bad grain opacity`);
  assert.ok(BLEND_MODES.has(spec.grain.mixBlendMode), `${label}: bad grain blend`);
}
