# Wallpaper Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-written per-preset background CSS with a parametric engine where a background is `shader + colours + noise + intensity`, rendered by a pure function into CSS custom properties.

**Architecture:** A `ShaderDefinition` exposes a pure `render(colors, noise, intensity, mode) -> AuraSpec`. `ThemeEngine` writes that spec into CSS custom properties on `:root`, and one static CSS block consumes them — replacing roughly 4,000 lines of per-preset CSS. Colour roles missing from the user's selection are derived in OKLCH, implemented from scratch because the project has zero runtime dependencies.

**Tech Stack:** Vanilla ES modules (`"type": "module"`), no runtime dependencies. Tests are `node --test` with `node:test` + `node:assert/strict`. `css-tree` (already a devDependency) parses generated CSS in tests.

**Spec:** `docs/superpowers/specs/2026-09-07-parametric-wallpaper-system-design.md`

## Global Constraints

- **Zero runtime dependencies.** Nothing may be added to `dependencies` in `package.json`. OKLCH conversion is implemented by hand.
- **ES modules only.** `"type": "module"`; all imports carry explicit `.js` / `.mjs` extensions.
- **Test command:** `node --test` (run a single file with `node --test test/<name>.test.mjs`).
- **`render()` must be pure** — no DOM access, no globals, no `Date`/`Math.random`. This is what lets settings previews and the live page share one code path.
- **Colour format is `#RRGGBB`** everywhere in `Wallpaper.colors`. Alpha is applied at render time via `rgba()`, never stored in a colour.
- **Do not touch** `BookmarkDeckView`, `tokens.css`, or any homepage component. The four aura divs and `createGrainOverlay()` stay exactly as they are.
- **`noise` and `intensity` are `0`–`1`**, default `0.5`. At `0.5`, `intensity` is unity (`0.4 + 0.5 * 1.2 = 1.0`).

## Scope

This plan delivers the engine and **one** shader family (Vapor), ending with the app running entirely on the new render path with the old CSS deleted. Two follow-up plans complete the work:

- **Plan 2 — Shader library:** the remaining 10 families (Beams, Mesh, Duotone, Spotlight, Halo, Fog, Sheen, Plaster, Noir, Grid).
- **Plan 3 — Settings, migration & packaging:** `UserSettings`, `LEGACY_PRESET_MAP`, accent derivation from `colors[0]` (spec §5.3), the picker UI, persistence, schema and docs.

**Interim behaviour between this plan and Plan 3:** stored preset ids (`"aurora"`, `"nord"`, …) have no migration map yet, so Task 7 resolves any unknown id to the default Vapor wallpaper. Plan 3 replaces that fallback with the real map. This is expected on the branch and must not be "fixed" by reintroducing preset CSS.

## Prerequisite

The repository is on `main` with a substantial dirty tree. Before Task 1:

```bash
git checkout -b feat/wallpaper-engine
```

Commit only the files each task names — do not `git add -A`, which would sweep unrelated work in progress.

---

### Task 1: OKLCH colour conversion

Colour role derivation needs perceptually-even lightness and hue-preserving chroma changes. `colorUtils.js` today has only sRGB helpers (`hexToRgb`, `rgbToHex`, `getLuminance`, `calculateContrastRatio`, `adjustBrightness`, `deriveAccentShades`). This task adds OKLCH in both directions.

**Files:**
- Modify: `src/presentation/shared/colorUtils.js` (append; change nothing existing)
- Test: `test/color-oklch.test.mjs`

**Interfaces:**
- Consumes: existing `hexToRgb(hex) -> {r,g,b}` and `rgbToHex(r,g,b) -> "#rrggbb"` from the same file (both accept/return 0–255 numbers; `rgbToHex` tolerates floats).
- Produces: `hexToOklch(hex) -> {l, c, h}` where `l` is 0–1, `c` is 0–~0.4, `h` is degrees 0–360; and `oklchToHex({l, c, h}) -> "#RRGGBB"`, gamut-clamped.

- [ ] **Step 1: Write the failing test**

Create `test/color-oklch.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/color-oklch.test.mjs`
Expected: FAIL — `hexToOklch is not a function` (the export does not exist yet).

- [ ] **Step 3: Write the implementation**

Append to `src/presentation/shared/colorUtils.js`:

```js
/* ── OKLCH ─────────────────────────────────────────────────────────────
   Implemented in-repo because the project carries zero runtime deps.
   Matrices are Björn Ottosson's reference Oklab values.
   ------------------------------------------------------------------ */

const srgbToLinear = (u) => (u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4));
const linearToSrgb = (u) => (u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * @param {string} hex - "#RRGGBB"
 * @returns {{l: number, c: number, h: number}} L 0-1, C 0-~0.4, H degrees 0-360
 */
export function hexToOklch(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lr = srgbToLinear(r / 255);
  const lg = srgbToLinear(g / 255);
  const lb = srgbToLinear(b / 255);

  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c: Math.sqrt(A * A + B * B), h };
}

/**
 * @param {{l: number, c: number, h: number}} oklch
 * @returns {string} "#RRGGBB", clamped into sRGB gamut
 */
export function oklchToHex({ l, c, h }) {
  const hr = (h * Math.PI) / 180;
  const A = Math.cos(hr) * c;
  const B = Math.sin(hr) * c;

  const l_ = l + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = l - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = l - 0.0894841775 * A - 1.2914855480 * B;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  const r =  4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const b = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

  const to255 = (u) => Math.round(clamp(linearToSrgb(u), 0, 1) * 255);
  return rgbToHex(to255(r), to255(g), to255(b));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/color-oklch.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Confirm nothing else broke**

Run: `node --test`
Expected: the existing suite passes as before (`test/domain-entities.test.mjs`, `test/theme-system.test.mjs` unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/presentation/shared/colorUtils.js test/color-oklch.test.mjs
git commit -m "feat(color): add OKLCH conversion helpers"
```

---

### Task 2: Colour role derivation

A shader declares 1–3 colour slots but its composition may need all three roles. This resolves user-supplied colours into `{light, ground, tint}`, deriving whatever is missing.

**Files:**
- Create: `src/presentation/shared/theme/deriveWallpaperColors.js`
- Test: `test/wallpaper-colors.test.mjs`

**Interfaces:**
- Consumes: `hexToOklch`, `oklchToHex` from Task 1.
- Produces:
  - `resolveRoles(colors: string[], colorSlots: number, mode: "dark"|"light") -> {light: string, ground: string, tint: string}`
  - `deriveGround(lightHex: string, mode: "dark"|"light") -> string`
  - `deriveTint(lightHex: string) -> string`

- [ ] **Step 1: Write the failing test**

Create `test/wallpaper-colors.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wallpaper-colors.test.mjs`
Expected: FAIL — cannot find module `deriveWallpaperColors.js`.

- [ ] **Step 3: Write the implementation**

Create `src/presentation/shared/theme/deriveWallpaperColors.js`:

```js
import { hexToOklch, oklchToHex } from "../colorUtils.js";

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * Ground is the canvas the light falls on: pushed to the far end of the
 * lightness range for the mode, with chroma pulled well down so a vivid
 * light colour does not produce a vivid backdrop. Hue is preserved.
 */
export function deriveGround(lightHex, mode) {
  const { l, c, h } = hexToOklch(lightHex);
  return mode === "light"
    ? oklchToHex({ l: clamp(l, 0.94, 0.97), c: c * 0.15, h })
    : oklchToHex({ l: clamp(l, 0.08, 0.14), c: c * 0.25, h });
}

/** Tint is a secondary illuminant: same lightness and chroma, hue rotated 30 degrees. */
export function deriveTint(lightHex) {
  const { l, c, h } = hexToOklch(lightHex);
  return oklchToHex({ l, c, h: (h + 30) % 360 });
}

/**
 * Resolve however many colours the user supplied into all three roles.
 * Slots are positional: [light, ground, tint].
 *
 * @param {string[]} colors
 * @param {number} colorSlots - how many of `colors` this shader declares
 * @param {"dark"|"light"} mode
 * @returns {{light: string, ground: string, tint: string}}
 */
export function resolveRoles(colors, colorSlots, mode) {
  const given = colors.slice(0, colorSlots);
  const light = given[0];
  return {
    light,
    ground: given[1] ?? deriveGround(light, mode),
    tint: given[2] ?? deriveTint(light),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/wallpaper-colors.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/shared/theme/deriveWallpaperColors.js test/wallpaper-colors.test.mjs
git commit -m "feat(theme): derive wallpaper colour roles in OKLCH"
```

---

### Task 3: ShaderRegistry

The registry of shader definitions. It replaces the preset-registry role `ThemeRegistry` plays today. It holds definitions only — no colours, no user state.

**Files:**
- Create: `src/domain/services/ShaderRegistry.js`
- Test: `test/shader-registry.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ShaderRegistry.register(def) -> string` (returns the id; throws on an invalid definition)
  - `ShaderRegistry.get(id) -> ShaderDefinition|null` (falls back to the default shader, then `null` if the registry is empty)
  - `ShaderRegistry.isValid(id) -> boolean` (strict — no fallback)
  - `ShaderRegistry.all() -> ShaderDefinition[]`
  - `ShaderRegistry.byFamily(family) -> ShaderDefinition[]`
  - `ShaderRegistry.clear() -> void` (test isolation only)
  - `ShaderRegistry.DEFAULT_SHADER_ID -> "vapor-bloom"`

A `ShaderDefinition` is `{id, name, family, colorSlots, defaults: {colors, noise, intensity}, render}`.

- [ ] **Step 1: Write the failing test**

Create `test/shader-registry.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/shader-registry.test.mjs`
Expected: FAIL — cannot find module `ShaderRegistry.js`.

- [ ] **Step 3: Write the implementation**

Create `src/domain/services/ShaderRegistry.js`:

```js
/**
 * ShaderRegistry — Domain Service
 * --------------------------------------------------------------------
 * Authoritative registry of wallpaper shader definitions. Holds
 * definitions only: no user colours, no persisted state.
 *
 * A ShaderDefinition is:
 *   { id, name, family, colorSlots, defaults: {colors, noise, intensity}, render }
 * where render(colors, noise, intensity, mode) -> AuraSpec and MUST be pure.
 */
export class ShaderRegistry {
  static #shaders = new Map();

  static get DEFAULT_SHADER_ID() {
    return "vapor-bloom";
  }

  static register(def) {
    if (!def || typeof def !== "object") {
      throw new Error("Shader definition must be an object");
    }
    const id = String(def.id || "").trim();
    if (!id) throw new Error("Shader definition must have a non-empty 'id'");
    if (!def.name) throw new Error(`Shader ${id} must have a 'name'`);
    if (!def.family) throw new Error(`Shader ${id} must have a 'family'`);
    if (!Number.isInteger(def.colorSlots) || def.colorSlots < 1 || def.colorSlots > 3) {
      throw new Error(`Shader ${id} has invalid colorSlots (must be an integer 1-3)`);
    }
    if (!def.defaults || !Array.isArray(def.defaults.colors)) {
      throw new Error(`Shader ${id} must have defaults.colors`);
    }
    if (def.defaults.colors.length !== def.colorSlots) {
      throw new Error(`Shader ${id} defaults.colors must hold exactly ${def.colorSlots} colours`);
    }
    if (typeof def.render !== "function") {
      throw new Error(`Shader ${id} must have a render function`);
    }
    this.#shaders.set(id, Object.freeze({ ...def, id }));
    return id;
  }

  static isValid(id) {
    return typeof id === "string" && this.#shaders.has(id.trim());
  }

  static get(id) {
    if (typeof id === "string" && this.#shaders.has(id.trim())) {
      return this.#shaders.get(id.trim());
    }
    return this.#shaders.get(this.DEFAULT_SHADER_ID) || null;
  }

  static all() {
    return Array.from(this.#shaders.values());
  }

  static byFamily(family) {
    return this.all().filter((s) => s.family === family);
  }

  /** Test isolation only. */
  static clear() {
    this.#shaders.clear();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/shader-registry.test.mjs`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/services/ShaderRegistry.js test/shader-registry.test.mjs
git commit -m "feat(theme): add ShaderRegistry domain service"
```

---

### Task 4: Wallpaper entity

The immutable value object a user's background selection reduces to.

**Files:**
- Create: `src/domain/entities/Wallpaper.js`
- Test: `test/wallpaper-entity.test.mjs`

**Interfaces:**
- Consumes: `ShaderRegistry` from Task 3 (entity imports service; the service imports nothing, so there is no cycle).
- Produces:
  - `new Wallpaper({shaderId, colors, noise = 0.5, intensity = 0.5})` — throws on invalid input
  - Getters: `.shaderId`, `.colors` (a copy), `.noise`, `.intensity`
  - `.withShader(id)`, `.withColor(index, hex)`, `.withNoise(n)`, `.withIntensity(n)` — each returns a new `Wallpaper`
  - `.toJSON() -> {v: 2, shaderId, colors, noise, intensity}`
  - `Wallpaper.fromJSON(obj) -> Wallpaper`

**Note — deliberate deviation from spec §4.1.** The spec says a shader change derives missing colours "per section 5.2". Role derivation is mode-dependent and a `Wallpaper` has no mode, so `withShader` instead fills missing slots from the **incoming shader's `defaults.colors`**. Deterministic, mode-free, and the render path still derives roles per mode on every draw.

- [ ] **Step 1: Write the failing test**

Create `test/wallpaper-entity.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wallpaper-entity.test.mjs`
Expected: FAIL — cannot find module `Wallpaper.js`.

- [ ] **Step 3: Write the implementation**

Create `src/domain/entities/Wallpaper.js`:

```js
import { ShaderRegistry } from "../services/ShaderRegistry.js";

const HEX = /^#[0-9a-fA-F]{6}$/;

function assertUnit(value, field) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 1) {
    throw new Error(`Invalid ${field}: must be a number between 0 and 1`);
  }
}

/**
 * Wallpaper — Domain Entity (immutable value object)
 * --------------------------------------------------------------------
 * A background reduced to the parameters a user actually chooses.
 * Rendering lives in the shader; this type only guards the invariants.
 */
export class Wallpaper {
  #shaderId;
  #colors;
  #noise;
  #intensity;

  constructor({ shaderId, colors, noise = 0.5, intensity = 0.5 } = {}) {
    if (!ShaderRegistry.isValid(shaderId)) {
      throw new Error(`Unknown shaderId: ${shaderId}`);
    }
    const def = ShaderRegistry.get(shaderId);
    if (!Array.isArray(colors) || colors.length !== def.colorSlots) {
      throw new Error(`Shader ${shaderId} requires exactly ${def.colorSlots} colour(s)`);
    }
    for (const c of colors) {
      if (typeof c !== "string" || !HEX.test(c)) {
        throw new Error(`Invalid colour: ${c} (expected #RRGGBB)`);
      }
    }
    assertUnit(noise, "noise");
    assertUnit(intensity, "intensity");

    this.#shaderId = shaderId;
    this.#colors = [...colors];
    this.#noise = noise;
    this.#intensity = intensity;
    Object.freeze(this);
  }

  get shaderId() { return this.#shaderId; }
  get colors() { return [...this.#colors]; }
  get noise() { return this.#noise; }
  get intensity() { return this.#intensity; }

  #clone(over) {
    return new Wallpaper({
      shaderId: this.#shaderId,
      colors: this.#colors,
      noise: this.#noise,
      intensity: this.#intensity,
      ...over,
    });
  }

  /**
   * Switch shader, re-fitting the colour list to the new slot count.
   * Missing slots come from the incoming shader's defaults (see the note
   * in the plan: role derivation is mode-dependent, and this type has no mode).
   */
  withShader(nextId) {
    const def = ShaderRegistry.get(nextId);
    if (!ShaderRegistry.isValid(nextId)) throw new Error(`Unknown shaderId: ${nextId}`);
    const colors = [];
    for (let i = 0; i < def.colorSlots; i++) {
      colors.push(this.#colors[i] ?? def.defaults.colors[i]);
    }
    return this.#clone({ shaderId: nextId, colors });
  }

  withColor(index, hex) {
    const colors = [...this.#colors];
    if (index < 0 || index >= colors.length) {
      throw new Error(`Colour index ${index} out of range`);
    }
    colors[index] = hex;
    return this.#clone({ colors });
  }

  withNoise(noise) { return this.#clone({ noise }); }
  withIntensity(intensity) { return this.#clone({ intensity }); }

  toJSON() {
    return {
      v: 2,
      shaderId: this.#shaderId,
      colors: [...this.#colors],
      noise: this.#noise,
      intensity: this.#intensity,
    };
  }

  static fromJSON(obj) {
    return new Wallpaper(obj);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/wallpaper-entity.test.mjs`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/entities/Wallpaper.js test/wallpaper-entity.test.mjs
git commit -m "feat(theme): add Wallpaper value object"
```

---

### Task 5: Shader authoring kit and AuraSpec test helper

The kit keeps 32 shaders DRY: each becomes ~12 lines of composition instead of repeating alpha maths and layer plumbing. The test helper validates any `AuraSpec` by actually parsing its CSS with `css-tree`.

**Files:**
- Create: `src/presentation/shared/theme/shaders/kit.js`
- Create: `test/helpers/auraSpec.mjs`
- Test: `test/shader-kit.test.mjs`

**Interfaces:**
- Consumes: `hexToRgb` (colorUtils), `resolveRoles` (Task 2).
- Produces:
  - `rgba(hex, alpha) -> "rgba(r, g, b, a)"`
  - `scaleAlpha(alpha, intensity) -> number` — applies `0.4 + intensity * 1.2`, clamped to 0–1
  - `layer({background, blend?, blur?, opacity?, size?}) -> AuraLayer` (`{background, mixBlendMode, blur, opacity, backgroundSize}`)
  - `grainFor(noise, mode) -> {opacity, mixBlendMode}`
  - `defineShader({id, name, family, colorSlots, defaults, build}) -> ShaderDefinition`
    where `build(roles, {noise, intensity, mode}) -> {base, layers: (AuraLayer|null)[]}`
  - From the helper: `assertValidAuraSpec(spec, label)`

- [ ] **Step 1: Write the failing test**

Create `test/shader-kit.test.mjs`:

```js
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { rgba, scaleAlpha, layer, grainFor, defineShader } from "../src/presentation/shared/theme/shaders/kit.js";
import { assertValidAuraSpec } from "./helpers/auraSpec.mjs";

describe("shader kit", () => {
  test("rgba expands a hex with alpha", () => {
    assert.equal(rgba("#FF8000", 0.5), "rgba(255, 128, 0, 0.5)");
  });

  test("scaleAlpha is unity at intensity 0.5", () => {
    assert.ok(Math.abs(scaleAlpha(0.4, 0.5) - 0.4) < 1e-9);
  });

  test("scaleAlpha spans 0.4x to 1.6x and clamps at 1", () => {
    assert.ok(Math.abs(scaleAlpha(0.5, 0) - 0.2) < 1e-9);
    assert.ok(Math.abs(scaleAlpha(0.5, 1) - 0.8) < 1e-9);
    assert.equal(scaleAlpha(0.9, 1), 1);
  });

  test("grainFor maps noise per mode", () => {
    assert.ok(Math.abs(grainFor(0.5, "dark").opacity - 0.3) < 1e-9);
    assert.ok(Math.abs(grainFor(0.5, "light").opacity - 0.175) < 1e-9);
    assert.equal(grainFor(0.5, "dark").mixBlendMode, "overlay");
  });

  test("layer fills defaults", () => {
    const l = layer({ background: "red" });
    assert.equal(l.mixBlendMode, "normal");
    assert.equal(l.blur, 0);
    assert.equal(l.opacity, 1);
    assert.equal(l.backgroundSize, "auto");
  });

  test("defineShader pads layers to exactly three", () => {
    const def = defineShader({
      id: "x", name: "X", family: "F", colorSlots: 1,
      defaults: { colors: ["#FFFFFF"], noise: 0.5, intensity: 0.5 },
      build: ({ ground }) => ({ base: ground, layers: [layer({ background: "red" })] }),
    });
    const spec = def.render(["#FFFFFF"], 0.5, 0.5, "dark");
    assert.equal(spec.layers.length, 3);
    assert.equal(spec.layers[1], null);
    assert.equal(spec.layers[2], null);
    assertValidAuraSpec(spec, "x");
  });

  test("render is pure — same inputs give deep-equal output", () => {
    const def = defineShader({
      id: "y", name: "Y", family: "F", colorSlots: 1,
      defaults: { colors: ["#FFFFFF"], noise: 0.5, intensity: 0.5 },
      build: ({ light, ground }) => ({
        base: ground,
        layers: [layer({ background: `radial-gradient(circle, ${rgba(light, 0.4)} 0%, ${rgba(light, 0)} 100%)`, blend: "screen", blur: 40 })],
      }),
    });
    const a = def.render(["#FFFFFF"], 0.5, 0.5, "dark");
    const b = def.render(["#FFFFFF"], 0.5, 0.5, "dark");
    assert.deepEqual(a, b);
    assertValidAuraSpec(a, "y");
  });
});
```

- [ ] **Step 2: Write the test helper**

Create `test/helpers/auraSpec.mjs`:

```js
import assert from "node:assert/strict";
import * as csstree from "css-tree";

const BLEND_MODES = new Set([
  "normal", "multiply", "screen", "overlay", "darken", "lighten",
  "color-dodge", "color-burn", "hard-light", "soft-light",
  "difference", "exclusion", "hue", "saturation", "color", "luminosity",
]);

/**
 * Assert that an AuraSpec is structurally sound and that every background
 * it produces is CSS the browser will actually accept. Parsing with
 * css-tree catches malformed gradients that eyeballing would miss.
 */
export function assertValidAuraSpec(spec, label = "spec") {
  assert.match(spec.base, /^#[0-9a-fA-F]{6}$/, `${label}: base must be #RRGGBB, got ${spec.base}`);
  assert.equal(spec.layers.length, 3, `${label}: expected exactly 3 layer slots`);

  spec.layers.forEach((ly, i) => {
    if (ly === null) return;
    const at = `${label}: layer ${i + 1}`;
    assert.equal(typeof ly.background, "string", `${at} background must be a string`);

    // Validate against the real CSS grammar rather than mere tokenisation.
    // Verified against css-tree 3.2.1: this accepts radial, linear,
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/shader-kit.test.mjs`
Expected: FAIL — cannot find module `kit.js`.

- [ ] **Step 4: Write the implementation**

Create `src/presentation/shared/theme/shaders/kit.js`:

```js
import { hexToRgb } from "../../colorUtils.js";
import { resolveRoles } from "../deriveWallpaperColors.js";

const clamp01 = (n) => Math.min(1, Math.max(0, n));
/** Trim float noise so generated CSS stays readable and render() output is stable. */
const round3 = (n) => Math.round(n * 1000) / 1000;

/** Expand a hex plus an alpha into a CSS rgba() string. */
export function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${round3(clamp01(alpha))})`;
}

/**
 * Scale a layer's authored alpha by user intensity.
 * 0 -> 0.4x, 0.5 -> 1.0x (unity), 1 -> 1.6x.
 */
export function scaleAlpha(alpha, intensity) {
  return clamp01(alpha * (0.4 + intensity * 1.2));
}

/** Build one aura layer, filling the defaults the CSS contract expects. */
export function layer({ background, blend = "normal", blur = 0, opacity = 1, size = "auto" }) {
  return {
    background,
    mixBlendMode: blend,
    blur,
    opacity: round3(clamp01(opacity)),
    backgroundSize: size,
  };
}

/** Map the noise parameter onto the grain overlay's opacity for a mode. */
export function grainFor(noise, mode) {
  return {
    opacity: round3(clamp01(noise * (mode === "light" ? 0.35 : 0.6))),
    mixBlendMode: "overlay",
  };
}

/**
 * Wrap a composition function into a ShaderDefinition.
 * `build` receives resolved colour roles and the render parameters, and
 * returns { base, layers }. Layers are padded to exactly three slots and
 * the grain overlay is attached here so no shader repeats that plumbing.
 *
 * The resulting render() is pure: it touches no DOM, globals, time or randomness.
 */
export function defineShader({ id, name, family, colorSlots, defaults, build }) {
  return {
    id,
    name,
    family,
    colorSlots,
    defaults,
    render(colors, noise, intensity, mode) {
      const roles = resolveRoles(colors, colorSlots, mode);
      const { base, layers } = build(roles, { noise, intensity, mode });
      return {
        base,
        layers: [layers[0] ?? null, layers[1] ?? null, layers[2] ?? null],
        grain: grainFor(noise, mode),
      };
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/shader-kit.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/shared/theme/shaders/kit.js test/helpers/auraSpec.mjs test/shader-kit.test.mjs
git commit -m "feat(theme): add shader authoring kit and AuraSpec validator"
```

---

### Task 6: Vapor family

The first three real shaders, ported from `docs/design/gradient-board/gradients.mjs` entries 1–3 with their literal colours replaced by roles and their literal alphas routed through `scaleAlpha`.

**Files:**
- Create: `src/presentation/shared/theme/shaders/vapor.js`
- Create: `src/presentation/shared/theme/shaders/index.js`
- Test: `test/shaders-vapor.test.mjs`

**Interfaces:**
- Consumes: `defineShader`, `layer`, `rgba`, `scaleAlpha` from Task 5; `ShaderRegistry` from Task 3.
- Produces: `vaporBloom`, `vaporTwin`, `vaporBand` shader definitions, plus `registerAllShaders()` from `index.js`, which registers every shader and returns the count.

- [ ] **Step 1: Write the failing test**

Create `test/shaders-vapor.test.mjs`:

```js
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ShaderRegistry } from "../src/domain/services/ShaderRegistry.js";
import { registerAllShaders } from "../src/presentation/shared/theme/shaders/index.js";
import { assertValidAuraSpec } from "./helpers/auraSpec.mjs";

const MODES = ["dark", "light"];
const EXTREMES = [
  { noise: 0, intensity: 0 },
  { noise: 0.5, intensity: 0.5 },
  { noise: 1, intensity: 1 },
];

beforeEach(() => {
  ShaderRegistry.clear();
  registerAllShaders();
});

describe("Vapor family", () => {
  test("registers three shaders", () => {
    assert.equal(ShaderRegistry.byFamily("Vapor").length, 3);
  });

  test("the default shader id resolves", () => {
    assert.equal(ShaderRegistry.isValid(ShaderRegistry.DEFAULT_SHADER_ID), true);
  });

  test("every shader renders valid CSS in both modes at parameter extremes", () => {
    for (const def of ShaderRegistry.byFamily("Vapor")) {
      for (const mode of MODES) {
        for (const { noise, intensity } of EXTREMES) {
          const spec = def.render(def.defaults.colors, noise, intensity, mode);
          assertValidAuraSpec(spec, `${def.id} ${mode} n=${noise} i=${intensity}`);
        }
      }
    }
  });

  test("render is pure for every shader", () => {
    for (const def of ShaderRegistry.byFamily("Vapor")) {
      const a = def.render(def.defaults.colors, 0.5, 0.5, "dark");
      const b = def.render(def.defaults.colors, 0.5, 0.5, "dark");
      assert.deepEqual(a, b, `${def.id} is not pure`);
    }
  });

  test("a user colour actually reaches the output", () => {
    const def = ShaderRegistry.get("vapor-bloom");
    const spec = def.render(["#FF0000", "#0B0B0D"], 0.5, 0.5, "dark");
    const joined = spec.layers.filter(Boolean).map((l) => l.background).join(" ");
    assert.match(joined, /255, 0, 0/, "the light colour should appear in a layer");
  });

  test("intensity 0 produces weaker layers than intensity 1", () => {
    const def = ShaderRegistry.get("vapor-bloom");
    const alphaSum = (i) => {
      const spec = def.render(def.defaults.colors, 0.5, i, "dark");
      return spec.layers.filter(Boolean)
        .flatMap((l) => [...l.background.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g)].map((m) => Number(m[1])))
        .reduce((a, b) => a + b, 0);
    };
    assert.ok(alphaSum(0) < alphaSum(1), "intensity should scale layer alpha");
  });

  test("noise 0 yields no grain and noise 1 yields the mode maximum", () => {
    const def = ShaderRegistry.get("vapor-bloom");
    assert.equal(def.render(def.defaults.colors, 0, 0.5, "dark").grain.opacity, 0);
    assert.equal(def.render(def.defaults.colors, 1, 0.5, "dark").grain.opacity, 0.6);
    assert.equal(def.render(def.defaults.colors, 1, 0.5, "light").grain.opacity, 0.35);
  });

  test("base colour comes from the ground role", () => {
    const spec = ShaderRegistry.get("vapor-bloom").render(["#FFFFFF", "#0B0B0D"], 0.5, 0.5, "dark");
    assert.equal(spec.base.toLowerCase(), "#0b0b0d");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/shaders-vapor.test.mjs`
Expected: FAIL — cannot find module `shaders/index.js`.

- [ ] **Step 3: Write the shaders**

Create `src/presentation/shared/theme/shaders/vapor.js`:

```js
import { defineShader, layer, rgba, scaleAlpha } from "./kit.js";

/**
 * Vapor — soft radial blooms, heavy blur, low contrast.
 * Ported from docs/design/gradient-board/gradients.mjs entries 1-3,
 * with literal colours replaced by roles and literal alphas scaled by intensity.
 */

export const vaporBloom = defineShader({
  id: "vapor-bloom",
  name: "Vapor Bloom",
  family: "Vapor",
  colorSlots: 2,
  defaults: { colors: ["#FFFFFF", "#0B0B0D"], noise: 0.5, intensity: 0.5 },
  build: ({ light, ground }, { intensity, mode }) => ({
    base: ground,
    layers: [
      layer({
        background: `radial-gradient(60% 55% at 50% 108%, ${rgba(light, scaleAlpha(0.42, intensity))} 0%, ${rgba(light, 0)} 100%)`,
        blend: "screen",
        blur: 60,
      }),
      layer({
        background: `radial-gradient(40% 30% at 50% 100%, ${rgba(light, scaleAlpha(0.28, intensity))} 0%, ${rgba(light, 0)} 100%)`,
        blend: "screen",
        blur: 30,
      }),
      mode === "dark"
        ? layer({
            background: `radial-gradient(120% 90% at 50% 0%, rgba(0, 0, 0, ${scaleAlpha(0.65, intensity)}) 0%, rgba(0, 0, 0, 0) 60%)`,
            blend: "multiply",
          })
        : layer({
            background: `radial-gradient(120% 85% at 50% 0%, ${rgba(ground, scaleAlpha(0.2, intensity))} 0%, ${rgba(ground, 0)} 62%)`,
            blend: "multiply",
            blur: 30,
          }),
    ],
  }),
});

export const vaporTwin = defineShader({
  id: "vapor-twin",
  name: "Vapor Twin",
  family: "Vapor",
  colorSlots: 2,
  defaults: { colors: ["#FFFFFF", "#0C0D10"], noise: 0.5, intensity: 0.5 },
  build: ({ light, ground }, { intensity, mode }) => ({
    base: ground,
    layers: [
      layer({
        background: `radial-gradient(45% 45% at 18% 12%, ${rgba(light, scaleAlpha(0.3, intensity))} 0%, ${rgba(light, 0)} 100%)`,
        blend: "screen",
        blur: 70,
      }),
      layer({
        background: `radial-gradient(50% 50% at 84% 88%, ${rgba(light, scaleAlpha(0.34, intensity))} 0%, ${rgba(light, 0)} 100%)`,
        blend: "screen",
        blur: 80,
      }),
      mode === "dark"
        ? layer({
            background: `radial-gradient(90% 90% at 50% 50%, rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, ${scaleAlpha(0.5, intensity)}) 100%)`,
            blend: "multiply",
          })
        : null,
    ],
  }),
});

export const vaporBand = defineShader({
  id: "vapor-band",
  name: "Vapor Band",
  family: "Vapor",
  colorSlots: 2,
  defaults: { colors: ["#FFFFFF", "#0A0A0C"], noise: 0.5, intensity: 0.5 },
  build: ({ light, ground }, { intensity }) => ({
    base: ground,
    layers: [
      layer({
        background: `linear-gradient(180deg, ${rgba(light, 0)} 20%, ${rgba(light, scaleAlpha(0.3, intensity))} 50%, ${rgba(light, 0)} 80%)`,
        blend: "screen",
        blur: 90,
      }),
      layer({
        background: `radial-gradient(80% 40% at 50% 50%, ${rgba(light, scaleAlpha(0.18, intensity))} 0%, ${rgba(light, 0)} 100%)`,
        blend: "screen",
        blur: 40,
      }),
      null,
    ],
  }),
});

export const VAPOR_SHADERS = [vaporBloom, vaporTwin, vaporBand];
```

- [ ] **Step 4: Write the registration index**

Create `src/presentation/shared/theme/shaders/index.js`:

```js
import { ShaderRegistry } from "../../../../domain/services/ShaderRegistry.js";
import { VAPOR_SHADERS } from "./vapor.js";

/**
 * Every shader definition in the library.
 * Plan 2 extends this list with the remaining ten families.
 */
export const ALL_SHADERS = [
  ...VAPOR_SHADERS,
];

/**
 * Register every shader with the ShaderRegistry.
 * Idempotent: registering the same id twice replaces the definition.
 * @returns {number} how many shaders were registered
 */
export function registerAllShaders() {
  for (const def of ALL_SHADERS) {
    ShaderRegistry.register(def);
  }
  return ALL_SHADERS.length;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/shaders-vapor.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/shared/theme/shaders/vapor.js src/presentation/shared/theme/shaders/index.js test/shaders-vapor.test.mjs
git commit -m "feat(theme): add Vapor shader family"
```

---

### Task 7: ThemeEngine renders wallpapers to custom properties

Wire the engine: resolve a wallpaper, render it, and write the result onto the root element as CSS custom properties.

**Files:**
- Modify: `src/presentation/shared/theme/ThemeEngine.js`
- Test: `test/theme-engine-wallpaper.test.mjs`

**Interfaces:**
- Consumes: `ShaderRegistry` (Task 3), `Wallpaper` (Task 4), `registerAllShaders` (Task 6).
- Produces:
  - `ThemeEngine.applyWallpaper(targetEl, wallpaper, mode) -> void`
  - `ThemeEngine.defaultWallpaper() -> Wallpaper` — the fallback used until Plan 3 lands the legacy migration map.

Property names written (all on `targetEl.style`): `--aura-base`; for `N` in 1–3, `--aura-N-bg`, `--aura-N-blend`, `--aura-N-blur`, `--aura-N-opacity`, `--aura-N-size`; plus `--aura-grain-opacity` and `--aura-grain-blend`.

- [ ] **Step 1: Write the failing test**

Create `test/theme-engine-wallpaper.test.mjs`:

```js
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ShaderRegistry } from "../src/domain/services/ShaderRegistry.js";
import { Wallpaper } from "../src/domain/entities/Wallpaper.js";
import { registerAllShaders } from "../src/presentation/shared/theme/shaders/index.js";
import { ThemeEngine } from "../src/presentation/shared/theme/ThemeEngine.js";

/** Minimal stand-in for an element's style object. */
function fakeEl() {
  const props = new Map();
  return {
    props,
    style: {
      setProperty: (k, v) => props.set(k, String(v)),
      getPropertyValue: (k) => props.get(k) ?? "",
    },
  };
}

beforeEach(() => {
  ShaderRegistry.clear();
  registerAllShaders();
});

describe("ThemeEngine.applyWallpaper", () => {
  const wp = () => new Wallpaper({ shaderId: "vapor-bloom", colors: ["#FFFFFF", "#0B0B0D"] });

  test("writes the base colour", () => {
    const el = fakeEl();
    ThemeEngine.applyWallpaper(el, wp(), "dark");
    assert.equal(el.props.get("--aura-base").toLowerCase(), "#0b0b0d");
  });

  test("writes all five properties for each of the three layers", () => {
    const el = fakeEl();
    ThemeEngine.applyWallpaper(el, wp(), "dark");
    for (const n of [1, 2, 3]) {
      for (const suffix of ["bg", "blend", "blur", "opacity", "size"]) {
        assert.ok(el.props.has(`--aura-${n}-${suffix}`), `missing --aura-${n}-${suffix}`);
      }
    }
  });

  test("blur always carries a px unit", () => {
    const el = fakeEl();
    ThemeEngine.applyWallpaper(el, wp(), "dark");
    for (const n of [1, 2, 3]) {
      assert.match(el.props.get(`--aura-${n}-blur`), /^\d+(\.\d+)?px$/, `layer ${n} blur lacks px`);
    }
  });

  test("a null layer is written as none / 0 / 0px / auto", () => {
    const el = fakeEl();
    ThemeEngine.applyWallpaper(el, new Wallpaper({ shaderId: "vapor-band", colors: ["#FFFFFF", "#0A0A0C"] }), "dark");
    assert.equal(el.props.get("--aura-3-bg"), "none");
    assert.equal(el.props.get("--aura-3-opacity"), "0");
    assert.equal(el.props.get("--aura-3-blur"), "0px");
    assert.equal(el.props.get("--aura-3-size"), "auto");
    assert.equal(el.props.get("--aura-3-blend"), "normal");
  });

  test("writes grain properties", () => {
    const el = fakeEl();
    ThemeEngine.applyWallpaper(el, wp(), "dark");
    assert.equal(el.props.get("--aura-grain-opacity"), "0.3");
    assert.equal(el.props.get("--aura-grain-blend"), "overlay");
  });

  test("dark and light modes produce different output", () => {
    const d = fakeEl(), l = fakeEl();
    ThemeEngine.applyWallpaper(d, wp(), "dark");
    ThemeEngine.applyWallpaper(l, wp(), "light");
    assert.notEqual(d.props.get("--aura-grain-opacity"), l.props.get("--aura-grain-opacity"));
  });

  test("defaultWallpaper is valid and uses the registry default shader", () => {
    const w = ThemeEngine.defaultWallpaper();
    assert.equal(w.shaderId, ShaderRegistry.DEFAULT_SHADER_ID);
    assert.equal(w.colors.length, ShaderRegistry.get(w.shaderId).colorSlots);
  });

  test("tolerates a null element without throwing", () => {
    assert.doesNotThrow(() => ThemeEngine.applyWallpaper(null, wp(), "dark"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/theme-engine-wallpaper.test.mjs`
Expected: FAIL — `ThemeEngine.applyWallpaper is not a function`.

- [ ] **Step 3: Add the imports**

At the top of `src/presentation/shared/theme/ThemeEngine.js`, add alongside the existing imports:

```js
import { ShaderRegistry } from "../../../domain/services/ShaderRegistry.js";
import { Wallpaper } from "../../../domain/entities/Wallpaper.js";
import { registerAllShaders } from "./shaders/index.js";

registerAllShaders();
```

- [ ] **Step 4: Add the methods**

Add these as static members of the `ThemeEngine` class:

```js
  /**
   * The wallpaper used when settings carry no usable selection.
   * Plan 3 replaces the caller-side fallback with LEGACY_PRESET_MAP.
   */
  static defaultWallpaper() {
    const def = ShaderRegistry.get(ShaderRegistry.DEFAULT_SHADER_ID);
    return new Wallpaper({
      shaderId: def.id,
      colors: def.defaults.colors,
      noise: def.defaults.noise,
      intensity: def.defaults.intensity,
    });
  }

  /**
   * Render a wallpaper and write it onto the element as CSS custom properties.
   * The consuming CSS lives in newTab.css; nothing here touches class names
   * or the aura DOM.
   */
  static applyWallpaper(targetEl, wallpaper, mode = "dark") {
    if (!targetEl || !targetEl.style) return;

    const def = ShaderRegistry.get(wallpaper.shaderId);
    if (!def) return;

    const spec = def.render(wallpaper.colors, wallpaper.noise, wallpaper.intensity, mode);
    const s = targetEl.style;

    s.setProperty("--aura-base", spec.base);

    spec.layers.forEach((ly, i) => {
      const n = i + 1;
      if (!ly) {
        s.setProperty(`--aura-${n}-bg`, "none");
        s.setProperty(`--aura-${n}-blend`, "normal");
        s.setProperty(`--aura-${n}-blur`, "0px");
        s.setProperty(`--aura-${n}-opacity`, "0");
        s.setProperty(`--aura-${n}-size`, "auto");
        return;
      }
      s.setProperty(`--aura-${n}-bg`, ly.background);
      s.setProperty(`--aura-${n}-blend`, ly.mixBlendMode);
      s.setProperty(`--aura-${n}-blur`, `${ly.blur}px`);
      s.setProperty(`--aura-${n}-opacity`, String(ly.opacity));
      s.setProperty(`--aura-${n}-size`, ly.backgroundSize);
    });

    s.setProperty("--aura-grain-opacity", String(spec.grain.opacity));
    s.setProperty("--aura-grain-blend", spec.grain.mixBlendMode);
  }
```

- [ ] **Step 5: Call it from applyTheme**

Inside `ThemeEngine.applyTheme`, immediately after the `data-theme-preset` attribute is set (step 1 of that method), add:

```js
    // Wallpaper. Until Plan 3 lands LEGACY_PRESET_MAP, any stored preset id
    // resolves to the default wallpaper rather than its old CSS block.
    this.applyWallpaper(targetEl, this.defaultWallpaper(), mode);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test test/theme-engine-wallpaper.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/shared/theme/ThemeEngine.js test/theme-engine-wallpaper.test.mjs
git commit -m "feat(theme): render wallpapers into CSS custom properties"
```

---

### Task 8: Collapse the per-preset CSS

Delete both hand-maintained preset regions and replace them with one variable-driven block.

`newTab.css` currently defines each preset **three** times: the live aura blocks (region A), a separate `PREVIEW BACKDROPS` region for settings swatches whose gradient values already differ from the real ones (region B), and the JS manifests. Regions A and B both go.

**Files:**
- Modify: `src/presentation/newTab/newTab.css`
  - Delete region A: from `/* 1. Aurora Beams (Default Preset) */` (~line 5366) through the line before the `PREVIEW BACKDROPS` section header (~line 6276)
  - Delete region B: the `PREVIEW BACKDROPS` header through the end of its block 11 (~lines 6277–6485)
  - Insert the new block where region A began
- Test: `test/wallpaper-css.test.mjs`

**Interfaces:**
- Consumes: the custom property names written in Task 7.
- Produces: no JS interface — this task is verified by parsing the stylesheet.

- [ ] **Step 1: Write the failing test**

Create `test/wallpaper-css.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wallpaper-css.test.mjs`
Expected: FAIL — `found a leftover data-theme-preset selector`.

- [ ] **Step 3: Delete region B (preview backdrops)**

Open `src/presentation/newTab/newTab.css`, find the section header:

```
/* ═══════════════════════════════════════════════════════════════
   PREVIEW BACKDROPS (Authentic Presets in Dark & Light)
   ═══════════════════════════════════════════════════════════════ */
```

Delete from that header through the end of its final numbered block (`/* 11. Sage Botanical */` and the rules that follow it), stopping before the next unrelated rule. Verify with:

```bash
grep -c "data-preview-preset" src/presentation/newTab/newTab.css
```

Expected: `0`.

- [ ] **Step 4: Delete region A and insert the new block**

Delete from `/* 1. Aurora Beams (Default Preset) */` through the last per-preset rule that precedes where region B used to start. **Keep** the `Universal Background Presets` section header, the two `Base Colors` rules, and the `.focus-aura-layer, .focus-aura-grain` defense-in-depth rule that sit above it.

Replace the deleted region A with:

```css
/* ── Wallpaper: parametric aura driven by ThemeEngine ──────────────────
   Every layer's paint comes from custom properties written by
   ThemeEngine.applyWallpaper(). Adding a background is a shader
   definition, never a CSS block.
   -------------------------------------------------------------------- */

html {
  --aura-base: #121316;
  --aura-1-bg: none;    --aura-1-blend: normal; --aura-1-blur: 0px; --aura-1-opacity: 0; --aura-1-size: auto;
  --aura-2-bg: none;    --aura-2-blend: normal; --aura-2-blur: 0px; --aura-2-opacity: 0; --aura-2-size: auto;
  --aura-3-bg: none;    --aura-3-blend: normal; --aura-3-blur: 0px; --aura-3-opacity: 0; --aura-3-size: auto;
  --aura-grain-opacity: 0;
  --aura-grain-blend: overlay;
  --aura-blur-scale: 1;
}

@media (max-width: 768px) {
  html { --aura-blur-scale: 0.7; }
}

html,
html body {
  background-color: var(--aura-base);
}

.focus-aura-1 {
  background: var(--aura-1-bg);
  background-size: var(--aura-1-size);
  mix-blend-mode: var(--aura-1-blend);
  filter: blur(calc(var(--aura-1-blur) * var(--aura-blur-scale)));
  opacity: var(--aura-1-opacity);
  z-index: 0;
}

.focus-aura-2 {
  background: var(--aura-2-bg);
  background-size: var(--aura-2-size);
  mix-blend-mode: var(--aura-2-blend);
  filter: blur(calc(var(--aura-2-blur) * var(--aura-blur-scale)));
  opacity: var(--aura-2-opacity);
  z-index: 0;
}

.focus-aura-3 {
  background: var(--aura-3-bg);
  background-size: var(--aura-3-size);
  mix-blend-mode: var(--aura-3-blend);
  filter: blur(calc(var(--aura-3-blur) * var(--aura-blur-scale)));
  opacity: var(--aura-3-opacity);
  z-index: 0;
}

.focus-aura-grain {
  opacity: var(--aura-grain-opacity);
  mix-blend-mode: var(--aura-grain-blend);
  z-index: 0;
}
```

- [ ] **Step 5: Remove the now-dead base-colour rules**

The two `Base Colors` rules above the inserted block hardcode
`background-color: #100e0b` / `#faf8f2` per colour mode. They now fight
`--aura-base`. Delete both rules:

```css
html[data-color-mode="dark"],
html[data-color-mode="dark"] body { background-color: #100e0b; }
html[data-color-mode="light"],
html[data-color-mode="light"] body { background-color: #faf8f2; }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test test/wallpaper-css.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 7: Confirm the size reduction**

```bash
wc -l src/presentation/newTab/newTab.css
```

Expected: roughly 8,300 lines, down from 9,643 — about 1,300 removed across both regions.

- [ ] **Step 8: Run the whole suite**

Run: `node --test`

Expected: the new suites pass. `test/theme-system.test.mjs` may now fail where it asserts on preset CSS or manifests — that file is rewritten in Plan 3. If it fails, note which assertions and leave it; do not reintroduce preset CSS to satisfy it.

- [ ] **Step 9: Commit**

```bash
git add src/presentation/newTab/newTab.css test/wallpaper-css.test.mjs
git commit -m "refactor(theme): drive aura layers from custom properties"
```

---

## Verification

After Task 8, load the extension's new tab page and confirm:

1. The background renders the Vapor Bloom wallpaper (a soft white bloom rising from the bottom edge over near-black) with visible film grain.
2. Toggling dark/light changes the background — light mode is a pale ground with the bloom reading as a soft highlight.
3. The sidebar stays solid and fully opaque; no aura bleeds through it.
4. Narrowing the window below 768px softens the blur rather than removing it.
5. No console errors.

## Follow-up plans

- **Plan 2 — Shader library:** Beams, Mesh, Duotone, Spotlight, Halo, Fog, Sheen, Plaster, Noir, Grid. Each family is one task following Task 6 exactly: port from `gradients.mjs`, add the family to `ALL_SHADERS`, reuse the Task 6 test shape.
- **Plan 3 — Settings, migration & packaging:** `UserSettings` wallpaper fields, `LEGACY_PRESET_MAP` replacing the Task 7 fallback, accent derivation from `colors[0]` with the WCAG AA correction described in spec §5.3, the picker UI with live previews (which now render through the same `render()`, closing the drift that region B had), `ChromeThemeRepository`, the theme use cases, `backupAllowlist`, the JSON schema, `THEME_DEVELOPMENT.md`, and the template package.
