import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as csstree from "css-tree";

const CSS = readFileSync(new URL("../src/presentation/newTab/redesign.css", import.meta.url), "utf8");

describe("redesign.css", () => {
  // A syntax error makes the browser drop the rest of the rule block silently.
  it("parses without errors", () => {
    const errors = [];
    csstree.parse(CSS, { onParseError: (e) => errors.push(e.message) });
    assert.deepEqual(errors, [], `css-tree reported parse errors: ${errors.slice(0, 3).join("; ")}`);
  });
});
