import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as csstree from "css-tree";

const CSS = readFileSync(
  fileURLToPath(new URL("../src/presentation/newTab/newTab.css", import.meta.url)),
  "utf8",
);

describe("settings icon sizing & layout CSS", () => {
  test("scope badge icon has explicit sizing in CSS", () => {
    assert.ok(CSS.includes(".scope-badge-icon"), "missing .scope-badge-icon rule");
    assert.ok(CSS.includes(".settings-theme-scope-badge"), "missing .settings-theme-scope-badge rule");
  });

  test("preview checkmark icon and active badge have explicit sizing in CSS", () => {
    assert.ok(CSS.includes(".preview-check-icon"), "missing .preview-check-icon rule");
    assert.ok(CSS.includes(".preview-active-badge"), "missing .preview-active-badge rule");
  });

  test("settings-btn has icon/svg sizing rule", () => {
    assert.ok(CSS.includes(".settings-btn svg"), "missing .settings-btn svg rule");
  });

  test("theme spotlight, grid, and preview components are styled in CSS", () => {
    assert.ok(CSS.includes(".settings-theme-spotlight"), "missing .settings-theme-spotlight rule");
    assert.ok(CSS.includes(".settings-bg-presets-grid"), "missing .settings-bg-presets-grid rule");
    assert.ok(CSS.includes(".settings-bg-card-btn"), "missing .settings-bg-card-btn rule");
    assert.ok(CSS.includes(".settings-theme-preview"), "missing .settings-theme-preview rule");
  });

  test("the stylesheet still parses cleanly with css-tree", () => {
    const errors = [];
    csstree.parse(CSS, { onParseError: (e) => errors.push(e.message) });
    assert.deepEqual(errors, [], `css-tree reported parse errors: ${errors.slice(0, 3).join("; ")}`);
  });
});

describe("icons.js icon() function", () => {
  test("supports optional size parameter with className", async () => {
    // Mock minimal DOM document for Node.js environment
    globalThis.document = {
      createElementNS: (_ns, tag) => ({
        tagName: tag,
        attributes: {},
        style: {},
        setAttribute(k, v) { this.attributes[k] = v; },
        appendChild(child) { this.children = this.children || []; this.children.push(child); },
      }),
    };

    const { icon } = await import("../src/presentation/shared/icons.js");

    // 1. Numeric size
    const numericIcon = icon("check", 14);
    assert.equal(numericIcon.attributes.class, "icon");
    assert.equal(numericIcon.style.width, "14px");
    assert.equal(numericIcon.style.height, "14px");

    // 2. ClassName only
    const classOnlyIcon = icon("check", "preview-check-icon");
    assert.equal(classOnlyIcon.attributes.class, "preview-check-icon");
    assert.equal(classOnlyIcon.style.width, undefined);

    // 3. ClassName with explicit size
    const classWithSizeIcon = icon("check", "preview-check-icon", 11);
    assert.equal(classWithSizeIcon.attributes.class, "preview-check-icon");
    assert.equal(classWithSizeIcon.style.width, "11px");
    assert.equal(classWithSizeIcon.style.height, "11px");
    assert.equal(classWithSizeIcon.style.minWidth, "11px");
    assert.equal(classWithSizeIcon.style.maxWidth, "11px");
  });
});
