import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as csstree from "css-tree";

import { ThemeRegistry } from "../src/domain/services/ThemeRegistry.js";
import { ThemeManifest } from "../src/domain/entities/ThemeManifest.js";
import { CustomTheme } from "../src/domain/entities/CustomTheme.js";
import { UserSettings } from "../src/domain/entities/UserSettings.js";
import { getLuminance, calculateContrastRatio, deriveAccentShades } from "../src/presentation/shared/colorUtils.js";
import { SaveCustomThemeUseCase } from "../src/application/useCases/themes/SaveCustomThemeUseCase.js";
import { ListCustomThemesUseCase } from "../src/application/useCases/themes/ListCustomThemesUseCase.js";
import { DeleteCustomThemeUseCase } from "../src/application/useCases/themes/DeleteCustomThemeUseCase.js";
import { ImportThemeUseCase } from "../src/application/useCases/themes/ImportThemeUseCase.js";
import { ExportThemeUseCase } from "../src/application/useCases/themes/ExportThemeUseCase.js";
import { BUILTIN_MANIFESTS } from "../src/presentation/shared/theme/manifests/index.js";

// In-memory mock storage for testing repository and use cases
class MockStorage {
  #store = new Map();
  async get(key) { return this.#store.get(key) ?? null; }
  async set(key, val) { this.#store.set(key, val); }
}

class MockThemeRepo {
  #themes = new Map();
  async findAll() { return Array.from(this.#themes.values()); }
  async findById(id) { return this.#themes.get(id) || null; }
  async save(theme) { this.#themes.set(theme.id, theme); ThemeRegistry.register(theme.manifest); return theme; }
  async delete(id) { this.#themes.delete(id); ThemeRegistry.unregister(id); }
  async exists(id) { return this.#themes.has(id); }
}

describe("Theme System: Phase 1 (Token Schema & Dynamic ThemeRegistry)", () => {
  beforeEach(() => {
    ThemeRegistry.clearCustomThemes();
  });

  test("ThemeRegistry: contains all 11 built-in presets for 100% backward compatibility", () => {
    assert.equal(ThemeRegistry.VALID_BUILTIN_IDS.length, 11);
    const expected = [
      "aurora", "retro_grid", "diamond_storm", "graphite_flow",
      "sky_deep_sea", "rose_gold", "solid", "minimal",
      "nord", "cyberpunk", "sage"
    ];
    for (const id of expected) {
      assert.ok(ThemeRegistry.isValid(id), `Expected ${id} to be valid`);
      assert.ok(ThemeRegistry.has(id), `Expected ${id} to be registered`);
    }
  });

  test("ThemeRegistry: registers and unregisters custom themes dynamically", () => {
    const customId = "custom_test_amber";
    assert.equal(ThemeRegistry.has(customId), false);

    ThemeRegistry.register({
      id: customId,
      name: "Test Amber",
      type: "custom",
      modes: {
        dark: { tokens: { "--bg": "#101010", "--surface": "#181818", "--fg": "#F0B90B", "--accent": "#F0B90B" } },
        light: { tokens: { "--bg": "#FFFFFF", "--surface": "#F5F5F5", "--fg": "#101010", "--accent": "#D97706" } },
      },
    });

    assert.ok(ThemeRegistry.has(customId));
    assert.ok(ThemeRegistry.isValid(customId));

    const retrieved = ThemeRegistry.get(customId);
    assert.equal(retrieved.name, "Test Amber");

    ThemeRegistry.unregister(customId);
    assert.equal(ThemeRegistry.has(customId), false);
  });

  test("ThemeRegistry: getUIPresets returns built-in presets and custom themes", () => {
    ThemeRegistry.register({
      id: "custom_solana",
      name: "Solana Neon",
      type: "custom",
      modes: {
        dark: { tokens: { "--bg": "#000", "--surface": "#111", "--fg": "#14F195", "--accent": "#9945FF" } },
        light: { tokens: { "--bg": "#FFF", "--surface": "#F5F5F5", "--fg": "#000", "--accent": "#9945FF" } },
      },
    });

    const presets = ThemeRegistry.getUIPresets();
    assert.ok(presets.length >= 12);
    const customEntry = presets.find(p => p.id === "custom_solana");
    assert.ok(customEntry);
    assert.equal(customEntry.isCustom, true);
  });

  test("UserSettings: accepts built-in presets and registered custom theme IDs", () => {
    const s = new UserSettings({ themePreset: "nord", colorMode: "dark" });
    assert.equal(s.themePreset, "nord");

    s.setThemePreset("cyberpunk");
    assert.equal(s.themePreset, "cyberpunk");

    // Invalid theme throws
    assert.throws(() => new UserSettings({ themePreset: "totally_invalid_theme_xyz" }), /Invalid/);
  });

  test("ColorUtils: getLuminance and calculateContrastRatio meet WCAG specifications", () => {
    // Pure Black on Pure White is 21:1
    const maxContrast = calculateContrastRatio("#000000", "#FFFFFF");
    assert.equal(maxContrast, 21);

    // Identical colors have 1:1 contrast
    const minContrast = calculateContrastRatio("#181A1E", "#181A1E");
    assert.equal(minContrast, 1);

    // deriveAccentShades computes accessible text on accent
    const brightYellowAccent = deriveAccentShades("#F59E0B", "dark");
    assert.equal(brightYellowAccent["--on-accent"], "#121316"); // Dark text for bright background

    const deepBlueAccent = deriveAccentShades("#1D4ED8", "dark");
    assert.equal(deepBlueAccent["--on-accent"], "#FFFFFF"); // White text for deep background
  });
});

describe("Theme System: Phase 2 (Built-in Themes as Plugins & ThemeManifest)", () => {
  test("ThemeManifest: all 11 built-in manifests are valid instances and registered", () => {
    assert.equal(BUILTIN_MANIFESTS.length, 11);
    for (const m of BUILTIN_MANIFESTS) {
      assert.ok(m.id);
      assert.ok(m.name);
      assert.ok(m.modes.dark);
      assert.ok(m.modes.light);
      assert.ok(m.modes.dark.tokens["--bg"]);
      assert.ok(m.modes.dark.tokens["--fg"]);
      assert.ok(m.modes.dark.tokens["--accent"]);
    }
  });

  test("ThemeManifest: serialization round-trip via toJSON and fromJSON", () => {
    const manifest = new ThemeManifest({
      id: "custom_emerald_flow",
      name: "Emerald Flow",
      description: "Organic emerald gradient",
      author: "Designer",
      license: "MIT",
      type: "custom",
      modes: {
        dark: {
          tokens: { "--bg": "#0B1510", "--surface": "#122018", "--fg": "#52B788", "--accent": "#52B788" },
          aura: { enabled: true, grain: { enabled: true, opacity: 0.15 } },
          customCss: ".card { border-radius: 12px; }",
        },
        light: {
          tokens: { "--bg": "#F4F8F5", "--surface": "#FFFFFF", "--fg": "#1B4332", "--accent": "#2D6A4F" },
          aura: { enabled: false },
          customCss: "",
        },
      },
    });

    const json = manifest.toJSON();
    const restored = ThemeManifest.fromJSON(json);

    assert.equal(restored.id, "custom_emerald_flow");
    assert.equal(restored.name, "Emerald Flow");
    assert.equal(restored.getTokens("dark")["--bg"], "#0B1510");
    assert.equal(restored.getTokens("light")["--bg"], "#F4F8F5");
    assert.equal(restored.getCustomCss("dark"), ".card { border-radius: 12px; }");
  });
});

describe("Theme System: Phase 3 (Import/Export & Theme Studio Use Cases)", () => {
  let themeRepo;
  let events;
  let saveUseCase;
  let listUseCase;
  let deleteUseCase;
  let importUseCase;
  let exportUseCase;

  beforeEach(() => {
    themeRepo = new MockThemeRepo();
    events = {
      emitted: [],
      emit(evt, payload) { this.emitted.push({ evt, payload }); },
    };
    saveUseCase = new SaveCustomThemeUseCase({ themeRepository: themeRepo, events });
    listUseCase = new ListCustomThemesUseCase({ themeRepository: themeRepo });
    deleteUseCase = new DeleteCustomThemeUseCase({ themeRepository: themeRepo, events });
    importUseCase = new ImportThemeUseCase({ themeRepository: themeRepo, events });
    exportUseCase = new ExportThemeUseCase({ themeRepository: themeRepo });
  });

  test("SaveCustomThemeUseCase: saves theme, registers manifest, and emits event", async () => {
    const saved = await saveUseCase.execute({
      name: "Neon Sunset",
      description: "Orange and purple gradient",
      author: "Tester",
      manifest: {
        id: "custom_neon_sunset",
        name: "Neon Sunset",
        modes: {
          dark: { tokens: { "--bg": "#120818", "--surface": "#1E0D28", "--fg": "#FF7AC6", "--accent": "#FF7AC6" } },
          light: { tokens: { "--bg": "#FFF5FA", "--surface": "#FFFFFF", "--fg": "#9D174D", "--accent": "#DB2777" } },
        },
      },
    });

    assert.ok(saved instanceof CustomTheme);
    assert.equal(saved.name, "Neon Sunset");
    assert.ok(events.emitted.some(e => e.evt === "themes:changed"));

    const list = await listUseCase.execute();
    assert.equal(list.length, 1);
    assert.equal(list[0].id, saved.id);
  });

  test("DeleteCustomThemeUseCase: deletes theme and unregisters from ThemeRegistry", async () => {
    await saveUseCase.execute({
      id: "custom_temp_theme",
      name: "Temporary Theme",
      manifest: {
        id: "custom_temp_theme",
        name: "Temporary Theme",
        modes: {
          dark: { tokens: { "--bg": "#000", "--surface": "#111", "--fg": "#FFF", "--accent": "#FFF" } },
          light: { tokens: { "--bg": "#FFF", "--surface": "#EEE", "--fg": "#000", "--accent": "#000" } },
        },
      },
    });

    assert.ok(ThemeRegistry.has("custom_temp_theme"));
    await deleteUseCase.execute("custom_temp_theme");
    assert.equal(ThemeRegistry.has("custom_temp_theme"), false);
  });

  test("ImportThemeUseCase: parses JSON string, sanitizes CSS, and guards against prototype pollution", async () => {
    const maliciousJson = JSON.stringify({
      __proto__: { isAdmin: true },
      id: "custom_imported_synth",
      name: "Synthwave 84",
      description: "Retro 80s aesthetic",
      modes: {
        dark: {
          tokens: { "--bg": "#1A102F", "--surface": "#24173D", "--fg": "#FF71CE", "--accent": "#01CDFE" },
          customCss: "@import url('https://evil.com/leak.css'); .card { color: red; }",
        },
        light: {
          tokens: { "--bg": "#FBF5FF", "--surface": "#FFFFFF", "--fg": "#24173D", "--accent": "#01CDFE" },
          customCss: "",
        },
      },
    });

    const imported = await importUseCase.execute(maliciousJson);
    assert.equal(imported.name, "Synthwave 84");
    // Prototype pollution was blocked
    assert.equal(Object.prototype.isAdmin, undefined);
    // Dangerous @import was stripped
    assert.ok(!imported.manifest.getCustomCss("dark").includes("@import"));
    assert.ok(imported.manifest.getCustomCss("dark").includes(".card"));
  });

  test("ExportThemeUseCase: produces valid schema-compliant export JSON", async () => {
    const exported = await exportUseCase.execute("aurora");
    assert.ok(exported.filename.includes("syncly-theme"));
    assert.ok(exported.jsonString);

    const parsed = JSON.parse(exported.jsonString);
    assert.equal(parsed.id, "aurora");
    assert.ok(parsed.modes.dark);
    assert.ok(parsed.modes.light);
  });
});

// SKIPPED — asserts the per-preset CSS architecture removed by the parametric
// wallpaper engine (see docs/superpowers/plans/2026-09-07-wallpaper-engine.md,
// Task 8). Every `[data-theme-preset="..."]` aura block is gone; layers are now
// driven by custom properties written by ThemeEngine.applyWallpaper().
//
// The underlying bug these tests guard — aura divs falling back to
// `position: static` and painting raw feTurbulence noise into the flex layout —
// is now structurally impossible: the positioning rule is unconditional and the
// custom properties have defaults on `html`, so no per-preset block is required
// for correct layout. That guard is asserted directly in
// test/wallpaper-css.test.mjs ("the aura positioning safety rule survives").
//
// This whole file is rewritten against the new model in Plan 3
// (settings, migration and packaging). Left skipped rather than deleted so the
// original regression rationale stays on the record until then.
describe.skip("Theme System: newTab.css aura coverage (regression for sidebar-noise bug)", () => {
  // Root cause: `.focus-aura-layer` / `.focus-aura-grain` only get their
  // `position: absolute; inset: 0` base styling from a per-theme CSS block
  // scoped to `[data-theme-preset="<id>"]` in newTab.css — there is no
  // theme-agnostic fallback. If a builtin theme id is registered without a
  // matching block, the aura/grain overlay divs stay `position: static` and
  // become live flex items inside `.raindrop-dashboard` (display: flex),
  // rendering the raw feTurbulence noise SVG in normal document flow right
  // before the sidebar — i.e. a "sidebar full of noise". This test parses
  // the real stylesheet so a future theme can't reintroduce the same gap.
  const cssPath = fileURLToPath(new URL("../src/presentation/newTab/newTab.css", import.meta.url));
  const cssText = readFileSync(cssPath, "utf8");
  const ast = csstree.parse(cssText, { positions: false });

  // .focus-aura-layer / .focus-aura-grain get their base out-of-flow
  // positioning from an unconditional, theme-agnostic rule (the
  // defense-in-depth fix), so a theme is no longer required to redeclare
  // position/display itself. What every theme MUST still do — either by
  // styling .focus-aura-1 directly, or by explicitly opting out via a
  // .focus-aura-layer rule (e.g. `display: none`) — is make a deliberate
  // choice for the layer, rather than being silently absent from the
  // stylesheet entirely (the actual bug this test guards against).
  const selectorsByClass = { layer: [], grain: [] };
  csstree.walk(ast, (node) => {
    if (node.type !== "Rule") return;
    const selectorText = csstree.generate(node.prelude);
    if (selectorText.includes(".focus-aura-1") || selectorText.includes(".focus-aura-layer")) {
      selectorsByClass.layer.push(selectorText);
    }
    if (selectorText.includes(".focus-aura-grain")) selectorsByClass.grain.push(selectorText);
  });

  function hasRuleFor(className, themeId) {
    const needle = `[data-theme-preset="${themeId}"]`;
    return selectorsByClass[className].some((sel) => sel.includes(needle));
  }

  for (const themeId of ThemeRegistry.VALID_BUILTIN_IDS) {
    test(`newTab.css: "${themeId}" has a deliberate .focus-aura-1/.focus-aura-layer rule scoped to its data-theme-preset`, () => {
      assert.ok(
        hasRuleFor("layer", themeId),
        `Expected newTab.css to style or explicitly opt out of .focus-aura-1/.focus-aura-layer for [data-theme-preset="${themeId}"] ` +
        `(otherwise the theme renders with no aura backdrop at all)`
      );
    });

    test(`newTab.css: "${themeId}" has a .focus-aura-grain rule scoped to its data-theme-preset`, () => {
      assert.ok(
        hasRuleFor("grain", themeId),
        `Expected newTab.css to style .focus-aura-grain for [data-theme-preset="${themeId}"] ` +
        `(otherwise the grain overlay loses position:absolute and renders as visible static noise)`
      );
    });
  }
});
