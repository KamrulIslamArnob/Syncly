import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as csstree from "css-tree";

const CSS = readFileSync(
  fileURLToPath(new URL("../src/presentation/newTab/newTab.css", import.meta.url)),
  "utf8",
);

describe("wallpaper CSS", () => {
  test("no per-preset aura selectors remain", () => {
    assert.equal(/\[data-theme-preset=/.test(CSS), false, "found a leftover data-theme-preset selector");
  });

  test("no preview-backdrop preset selectors remain", () => {
    assert.equal(/\[data-preview-preset=/.test(CSS), false, "found a leftover data-preview-preset selector");
  });

  test("aura layers are driven by custom properties", () => {
    for (const n of [1, 2, 3]) {
      assert.ok(CSS.includes(`var(--aura-${n}-bg)`), `layer ${n} does not consume --aura-${n}-bg`);
      assert.ok(CSS.includes(`var(--aura-${n}-blend)`), `layer ${n} does not consume --aura-${n}-blend`);
    }
    assert.ok(CSS.includes("var(--aura-grain-opacity)"));
  });

  test("blur is scaled by --aura-blur-scale", () => {
    assert.ok(CSS.includes("--aura-blur-scale"), "missing the responsive blur scale");
    assert.match(CSS, /blur\(calc\(var\(--aura-1-blur\)\s*\*\s*var\(--aura-blur-scale\)\)\)/);
  });

  test("the stylesheet still parses", () => {
    const errors = [];
    csstree.parse(CSS, { onParseError: (e) => errors.push(e.message) });
    assert.deepEqual(errors, [], `css-tree reported parse errors: ${errors.slice(0, 3).join("; ")}`);
  });

  test("the aura positioning safety rule survives", () => {
    assert.ok(CSS.includes(".focus-aura-layer"), "the defense-in-depth positioning rule was removed");
  });
});
