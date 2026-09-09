# Parametric Wallpaper System

**Date:** 2026-09-07
**Status:** Approved design, pending implementation plan
**Replaces:** the preset-based theme background system (`ThemeRegistry` presets, per-preset CSS blocks, `aura` manifest blocks)

---

## 1. Problem

Backgrounds are currently defined twice per preset: once as a hand-written CSS block in
`newTab.css` (`html[data-theme-preset="x"][data-color-mode="dark|light"]`), and once as an
`aura` object in a JS manifest that is only actually consumed for `type: "custom"` themes.
Adding a background means editing five places — the CSS, a manifest file,
`ThemeRegistry.VALID_BUILTIN_IDS`, `ThemeRegistry.getUIPresets()`, and `PRESET_METADATA` in
`SettingsSidebarView` — and `newTab.css` is already 9,643 lines.

The model is also non-composable. A user cannot take a background they like and recolour it;
they can only pick one of eleven fixed results. Every new look costs a developer roughly
100 lines of CSS.

## 2. Goal

A background becomes a small set of parameters a user chooses directly:

```
Wallpaper = shader + 1-3 colours + noise + intensity
```

32 shaders, each a pure function from those parameters to the layer stack the app already
renders. Users compose their own wallpaper; the eleven named presets survive as starting
points rather than dead ends.

## 3. Non-goals

- **Animation.** Layers are static in v1. Motion on a page opened dozens of times a day is a
  battery decision to make deliberately and separately.
- **WebGL / GLSL rendering.** Considered and rejected: a GPU context spin-up per new tab is
  too expensive for this surface, and it would orphan the CSS-based theme format.
- **Full token theming.** Wallpaper colours drive the wallpaper and the accent. Surfaces,
  text and borders stay on the neutral token set so the UI is legible under any wallpaper.
- **Changing any homepage component.** Layout, sidebar, cards and header are untouched.

---

## 4. Domain model

### 4.1 `Wallpaper` — `src/domain/entities/Wallpaper.js`

Immutable value object.

| Field | Type | Constraint |
|---|---|---|
| `shaderId` | string | must be registered in `ShaderRegistry` |
| `colors` | string[] | length exactly equals the shader's `colorSlots`; each `#RRGGBB` |
| `noise` | number | 0-1 inclusive |
| `intensity` | number | 0-1 inclusive |

Construction throws on violation. Provides `withShader(id)`, `withColor(index, hex)`,
`withNoise(n)`, `withIntensity(n)`, each returning a new instance. `toJSON()` emits
`{v: 2, shaderId, colors, noise, intensity}`.

Changing `shaderId` re-fits `colors` to the new shader's slot count: extra colours are
dropped, missing ones are derived per section 5.2.

### 4.2 `AuraSpec` — the render output

Plain object, deliberately the exact shape the existing aura CSS consumes:

```js
{
  base: "#0B0B0D",
  layers: [                       // always length 3; unused slots are null
    { background, mixBlendMode, blur, opacity, backgroundSize },
    null,
    null
  ],
  grain: { opacity, mixBlendMode }
}
```

`blur` is a number in CSS pixels (not a filter string) so the renderer can apply the
responsive scale in section 6.2.

### 4.3 `ShaderDefinition`

```js
{
  id: "vapor-bloom",
  name: "Vapor Bloom",
  family: "Vapor",
  colorSlots: 2,
  defaults: { colors: ["#FFFFFF", "#0B0B0D"], noise: 0.5, intensity: 0.5 },
  render(colors, noise, intensity, mode) // -> AuraSpec
}
```

`render` is **pure** — no DOM, no globals, no time. This is what makes the settings preview
and the live page share one code path, and what makes the shaders unit-testable.

### 4.4 `ShaderRegistry` — `src/domain/services/ShaderRegistry.js`

`register(def)`, `get(id)`, `all()`, `isValid(id)`, `byFamily(key)`, `DEFAULT_SHADER_ID`.
Takes over the preset-registry role from `ThemeRegistry`.

---

## 5. Colour model

### 5.1 Roles

Colour slots are positional and always map to these roles in order:

1. `light` — the illuminant; what was white in the monochrome gradient board
2. `ground` — the canvas the light falls on
3. `tint` — an optional secondary illuminant

A shader declaring `colorSlots: 2` takes `light` and `ground` from the user and derives
`tint` if its composition needs one.

### 5.2 Derivation

Missing roles are derived in OKLCH from `light`, preserving hue so results stay harmonious.
`colorUtils.js` already performs comparable work for accent shades and is extended rather
than replaced.

| Derived | Dark mode | Light mode |
|---|---|---|
| `ground` from `light` | L clamped to 0.08-0.14, C x 0.25, H preserved | L clamped to 0.94-0.97, C x 0.15, H preserved |
| `tint` from `light` | H + 30 degrees, L and C preserved | H + 30 degrees, L and C preserved |

### 5.3 Accent

`--accent` and its shades derive from `colors[0]` through the existing
`deriveAccentShades(base, mode)`. If the derived accent fails WCAG AA (4.5:1) against
`--surface-2`, lightness is stepped toward the nearest passing value before use. Surfaces,
text and borders are never touched by wallpaper colours.

### 5.4 `noise` and `intensity`

Both are 0-1 with a default of 0.5, calibrated so that 0.5 reproduces the gradient board's
tuning.

- `noise` maps to grain overlay opacity: `dark = noise * 0.6`, `light = noise * 0.35`.
  At the 0.5 default this yields 0.30 dark and 0.175 light, closely matching the current Aurora
  preset's 0.30 / 0.18.
- `intensity` scales the alpha of light-emitting layers and the depth of vignette layers by
  `0.4 + intensity * 1.2`, so 0.5 is unity and the range runs from 0.4x at the minimum to
  1.6x at the maximum.

---

## 6. Rendering

### 6.1 Flow

1. `ThemeEngine.applyTheme()` resolves a `Wallpaper` from settings (section 8).
2. `ShaderRegistry.get(shaderId).render(colors, noise, intensity, mode)` returns an `AuraSpec`.
3. `ThemeEngine` writes the spec into CSS custom properties on `document.documentElement`.
4. One static CSS block consumes those properties.

### 6.2 Custom property contract

```
--aura-base
--aura-1-bg     --aura-1-blend  --aura-1-blur  --aura-1-opacity  --aura-1-size
--aura-2-bg     --aura-2-blend  --aura-2-blur  --aura-2-opacity  --aura-2-size
--aura-3-bg     --aura-3-blend  --aura-3-blur  --aura-3-opacity  --aura-3-size
--aura-grain-opacity            --aura-grain-blend
--aura-blur-scale
```

A null layer is written as `--aura-N-bg: none` and `--aura-N-opacity: 0`.
`--aura-N-blur` always carries a `px` unit (`0px` when there is no blur), and `--aura-N-size` is `auto` when the layer declares no `backgroundSize`.

The consuming CSS, replacing every `html[data-theme-preset="..."]` block:

```css
html { --aura-blur-scale: 1; }
@media (max-width: 768px) { html { --aura-blur-scale: 0.7; } }

html, body { background-color: var(--aura-base); }

.focus-aura-1 {
  background: var(--aura-1-bg);
  mix-blend-mode: var(--aura-1-blend);
  filter: blur(calc(var(--aura-1-blur) * var(--aura-blur-scale)));
  opacity: var(--aura-1-opacity);
  background-size: var(--aura-1-size);
}
/* .focus-aura-2 and .focus-aura-3 are identical against their own properties */

.focus-aura-grain {
  opacity: var(--aura-grain-opacity);
  mix-blend-mode: var(--aura-grain-blend);
}
```

This removes approximately 4,000 lines of per-preset CSS in favour of about 30, and collapses
the per-preset mobile blur media queries into the single `--aura-blur-scale` rule above.

### 6.3 Explicitly unchanged

- The four aura divs created in `BookmarkDeckView` (`.focus-aura-1/2/3`, `.focus-aura-grain`)
- `createGrainOverlay()` and its `feTurbulence` filter
- The defense-in-depth positioning rule for `.focus-aura-layer` / `.focus-aura-grain`
- The sidebar's solid fill, `z-index: 10` and `isolation: isolate`
- Every design token in `tokens.css`

---

## 7. Shader library

32 shaders across 11 families. Each is a module under
`src/presentation/shared/theme/shaders/`, registered through an index.

| Family | Shaders | Colour slots |
|---|---|---|
| Vapor | `vapor-bloom`, `vapor-twin`, `vapor-band` | 2, 2, 2 |
| Beams | `beam-drift`, `beam-rake`, `beam-vertical`, `beam-cross` | 3, 2, 2, 2 |
| Mesh | `mesh-triad`, `mesh-diagonal`, `mesh-cluster` | 3, 2, 2 |
| Duotone | `duotone-split`, `duotone-diagonal`, `duotone-ramp`, `duotone-side` | 2, 2, 2, 2 |
| Spotlight | `spot-center`, `spot-high`, `spot-low`, `spot-raking` | 2, 2, 2, 2 |
| Halo | `halo-sweep`, `halo-ring`, `halo-quarter` | 2, 2, 2 |
| Fog | `fog-layers`, `fog-bank` | 2, 2 |
| Sheen | `sheen-brushed`, `sheen-satin`, `sheen-foil` | 2, 2, 3 |
| Plaster | `plaster-matte`, `plaster-seam` | 2, 2 |
| Noir | `noir-whisper`, `noir-edge` | 1, 1 |
| Grid | `grid-blueprint`, `grid-perspective` | 2, 2 |

The compositions come from `docs/design/gradient-board/gradients.mjs`, with the hardcoded
values promoted to parameters. The Grid family exists specifically so the `retro_grid` preset
survives migration.

---

## 8. Settings and migration

### 8.1 `UserSettings` changes

Removed: `themePreset`, `themePresetDark`, `themePresetLight`.
Added: `wallpaper` (a `Wallpaper`), and optional `wallpaperLight` — when present it is used
in light mode, when absent the single `wallpaper` adapts across both modes.

Unchanged: `colorMode`, `customCss`, `workspaceThemes`, and every non-theme field.
`workspaceThemes` entries carry a `wallpaper` in place of their preset ids.

### 8.2 Legacy migration

`LEGACY_PRESET_MAP` maps all eleven shipped preset ids to `Wallpaper` configs:

| Legacy preset | Shader |
|---|---|
| `aurora` | `beam-drift` |
| `retro_grid` | `grid-blueprint` |
| `diamond_storm` | `beam-cross` |
| `graphite_flow` | `vapor-twin` |
| `sky_deep_sea` | `mesh-diagonal` |
| `rose_gold` | `vapor-band` |
| `solid` | `noir-whisper` at `intensity: 0` |
| `minimal` | `plaster-matte` |
| `nord` | `mesh-triad` |
| `cyberpunk` | `halo-sweep` |
| `sage` | `fog-layers` |

Each entry carries colours lifted from that preset's existing manifest so a migrated user
keeps their palette. The map is applied wherever a string preset id is encountered instead of
a `wallpaper` object: `UserSettings` construction, backup import, and `workspaceThemes`
entries.

**Accepted trade:** `retro_grid` and `diamond_storm` are the two most bespoke presets. Their
migrations are close reproductions, not pixel-identical. Every other preset reproduces
faithfully.

### 8.3 Settings UI

The eleven-card picker in `SettingsSidebarView` is replaced by:

1. A shader grid of 32 live previews grouped by family
2. Colour swatches — exactly as many as the selected shader declares
3. A noise slider
4. An intensity slider
5. A "Start from" row exposing the eleven legacy configs as one-tap presets

Previews call the same `render()` the live page uses, against a small element, so a preview
cannot drift from the result. `PRESET_METADATA` is replaced by data read from
`ShaderRegistry`.

---

## 9. Import, export and packaging

Export drops from a CSS manifest to the `Wallpaper` JSON:

```json
{ "v": 2, "shaderId": "beam-drift", "colors": ["#F5F5F5", "#0B0B0D", "#727272"],
  "noise": 0.5, "intensity": 0.5 }
```

- `ExportThemeUseCase` emits that object; `ImportThemeUseCase` validates it against
  `ShaderRegistry` and the `Wallpaper` invariants, rejecting unknown shader ids.
- `ChromeThemeRepository` persists `Wallpaper` records rather than manifests.
- `backupAllowlist` is updated for the new field names.
- `docs/schemas/theme-manifest.schema.json` is rewritten as a wallpaper-config schema.
- `docs/THEME_DEVELOPMENT.md` and `packages/syncly-theme-template` are rewritten around the
  config format. Both shrink substantially: a theme author now ships a parameter set, and
  authoring a *new shader* becomes a code contribution rather than a theme.

`customCss` is retained unchanged as the escape hatch for anything the parametric model
cannot express.

---

## 10. Testing

- **Shaders:** every registered shader renders a valid `AuraSpec` in both modes at parameter
  extremes (noise and intensity at 0 and 1), with every `background` string
  parenthesis-balanced and every `mixBlendMode` drawn from the allowed set.
- **Purity:** `render()` called twice with identical arguments returns deep-equal output.
- **`Wallpaper`:** rejects unknown shader ids, wrong colour counts, malformed hex, and
  out-of-range noise or intensity.
- **Colour derivation:** derived `ground` and `tint` stay in gamut and preserve hue; derived
  accents clear WCAG AA against `--surface-2` via the existing `calculateContrastRatio`.
- **Migration:** all eleven legacy preset ids resolve to a valid `Wallpaper`; a stored
  settings object using the old field names loads without error.
- **Round-trip:** export then import returns an equal `Wallpaper`.

`test/theme-system.test.mjs` is rewritten against the new model.

---

## 11. Files

**New**

```
src/domain/entities/Wallpaper.js
src/domain/services/ShaderRegistry.js
src/presentation/shared/theme/shaders/*.js        (32 shaders + index)
src/presentation/shared/theme/deriveWallpaperColors.js
```

**Rewritten**

```
src/domain/entities/ThemeManifest.js -> WallpaperPreset
src/domain/entities/CustomTheme.js
src/domain/services/ThemeRegistry.js              (shrinks to legacy map + seed configs)
src/presentation/shared/theme/ThemeEngine.js
src/presentation/shared/theme/manifests/*         (deleted; replaced by seed configs)
src/application/useCases/themes/*
src/infrastructure/persistence/chromeStorage/ChromeThemeRepository.js
src/infrastructure/services/backupAllowlist.js
src/domain/entities/UserSettings.js
src/presentation/newTab/views/SettingsSidebarView.js
src/presentation/newTab/newTab.css                (remove preset blocks, add var block)
docs/THEME_DEVELOPMENT.md
docs/schemas/theme-manifest.schema.json
packages/syncly-theme-template/*
test/theme-system.test.mjs
```

`ThemeManifest.js`, `CustomTheme.js`, `ThemeRegistry.js`,
`src/application/useCases/themes/` and `src/presentation/shared/theme/` are all currently
uncommitted work, so rewriting them carries no migration cost for theme authors.

**Untouched:** `BookmarkDeckView`, `tokens.css`, and every homepage component.

---

## 12. Suggested phasing

The work is cohesive but large. A natural order for the implementation plan:

1. **Domain core** — `Wallpaper`, `AuraSpec`, `ShaderRegistry`, colour derivation, with tests.
2. **Render path** — `ThemeEngine` custom-property output, the CSS var block, deletion of the
   per-preset CSS. At the end of this phase the app runs on shaders with a hardcoded default.
3. **Shader library** — the 32 shaders, ported family by family from `gradients.mjs`.
4. **Settings and migration** — `UserSettings`, `LEGACY_PRESET_MAP`, the new picker UI.
5. **Persistence and packaging** — repository, use cases, backup allowlist, schema, docs,
   template package.
