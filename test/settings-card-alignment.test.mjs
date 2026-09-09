import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as csstree from "css-tree";

const CSS = readFileSync(
  fileURLToPath(new URL("../src/presentation/newTab/newTab.css", import.meta.url)),
  "utf8",
);

describe("settings card vertical middle-alignment CSS", () => {
  test(".settings-card-collapsible has overflow: hidden to prevent uncollapsed padding leakage", () => {
    // Must contain overflow: hidden on .settings-card-collapsible
    const ast = csstree.parse(CSS);
    let foundOverflowHidden = false;

    csstree.walk(ast, {
      visit: "Rule",
      enter(node) {
        const selector = csstree.generate(node.prelude);
        if (selector === ".settings-card-collapsible") {
          csstree.walk(node.block, {
            visit: "Declaration",
            enter(decl) {
              if (decl.property === "overflow" && csstree.generate(decl.value).trim() === "hidden") {
                foundOverflowHidden = true;
              }
            },
          });
        }
      },
    });

    assert.ok(foundOverflowHidden, "expected .settings-card-collapsible to have 'overflow: hidden'");
  });

  test(".settings-card.is-collapsed .settings-card-body has padding-top: 0", () => {
    const ast = csstree.parse(CSS);
    let foundPaddingZero = false;

    csstree.walk(ast, {
      visit: "Rule",
      enter(node) {
        const selector = csstree.generate(node.prelude);
        if (selector === ".settings-card.is-collapsed .settings-card-body") {
          csstree.walk(node.block, {
            visit: "Declaration",
            enter(decl) {
              if (decl.property === "padding-top" && csstree.generate(decl.value).trim() === "0") {
                foundPaddingZero = true;
              }
            },
          });
        }
      },
    });

    assert.ok(foundPaddingZero, "expected .settings-card.is-collapsed .settings-card-body to have 'padding-top: 0'");
  });

  test(".settings-card.is-collapsed .settings-card-header has min-height: 48px to fill card height", () => {
    const ast = csstree.parse(CSS);
    let foundMinHeight48 = false;

    csstree.walk(ast, {
      visit: "Rule",
      enter(node) {
        const selector = csstree.generate(node.prelude);
        if (selector === ".settings-card.is-collapsed .settings-card-header") {
          csstree.walk(node.block, {
            visit: "Declaration",
            enter(decl) {
              if (decl.property === "min-height" && csstree.generate(decl.value).trim() === "48px") {
                foundMinHeight48 = true;
              }
            },
          });
        }
      },
    });

    assert.ok(foundMinHeight48, "expected .settings-card.is-collapsed .settings-card-header to have 'min-height: 48px'");
  });

  test("the stylesheet still parses cleanly with css-tree", () => {
    const errors = [];
    csstree.parse(CSS, { onParseError: (e) => errors.push(e.message) });
    assert.deepEqual(errors, [], `css-tree reported parse errors: ${errors.slice(0, 3).join("; ")}`);
  });
});
