import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as csstree from "css-tree";

const tokensCss = readFileSync(new URL("../src/presentation/shared/styles/tokens.css", import.meta.url), "utf8");

function customProperties(selector) {
  const out = {};
  csstree.walk(csstree.parse(tokensCss), {
    visit: "Rule",
    enter(rule) {
      if (csstree.generate(rule.prelude) !== selector) return;
      rule.block.children.forEach((decl) => {
        if (decl.type === "Declaration" && decl.property.startsWith("--")) {
          out[decl.property] = csstree.generate(decl.value).trim();
        }
      });
    },
  });
  return out;
}

const dark = { ...customProperties(":root") };
const light = { ...dark, ...customProperties('html[data-color-mode="light"]') };

function luminance(hex) {
  const channels = hex.replace("#", "").match(/../g).map((h) => parseInt(h, 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

const PALETTE = [0, 1, 2, 3, 4].map((i) => `--folder-pal-${i}`);

describe("theme tokens for the redesign", () => {
  it("keep the most muted grey lighter than muted in light mode", () => {
    assert.ok(
      luminance(light["--muted-2"]) > luminance(light["--muted"]),
      `--muted-2 ${light["--muted-2"]} should read quieter than --muted ${light["--muted"]} on a light ground`,
    );
  });

  it("keep the most muted grey darker than muted in dark mode", () => {
    assert.ok(luminance(dark["--muted-2"]) < luminance(dark["--muted"]));
  });

  it("keep every folder colour readable on a white card in light mode", () => {
    for (const token of PALETTE) {
      assert.match(light[token] || "", /^#[0-9a-fA-F]{6}$/, `${token} is defined for light mode`);
      assert.ok(contrast(light[token], "#FFFFFF") >= 4.5, `${token} ${light[token]} on white`);
    }
  });

  it("keep every folder colour visible on a dark card", () => {
    for (const token of PALETTE) {
      assert.match(dark[token] || "", /^#[0-9a-fA-F]{6}$/, `${token} is defined for dark mode`);
      assert.ok(contrast(dark[token], dark["--surface-2"]) >= 3, `${token} ${dark[token]} on ${dark["--surface-2"]}`);
    }
  });

  it("define the live, resting and cold colours in both themes", () => {
    for (const token of ["--signal-live", "--signal-rest", "--signal-cold"]) {
      assert.match(dark[token] || "", /^#[0-9a-fA-F]{6}$/, `${token} in dark mode`);
      assert.match(light[token] || "", /^#[0-9a-fA-F]{6}$/, `${token} in light mode`);
    }
  });
});
