# Syncly Theme Developer Guide & Architecture Manual

Comprehensive guide for creating, packaging, testing, and distributing custom themes for **Syncly New Tab**.

---

## 1. Theme Architecture Overview

Syncly uses a headless token-driven theme architecture. Themes are defined as declarative JSON manifests conforming to JSON Schema Draft 2020-12 (`docs/schemas/theme-manifest.schema.json`).

### Clean Architecture Layers:

- **Domain Layer (`ThemeManifest`, `CustomTheme`, `ThemeRegistry`)**:
  Manages theme validation, immutability invariants, registration, and backward-compatible preset fallbacks.
- **Application Layer (`SaveCustomThemeUseCase`, `ImportThemeUseCase`, `ExportThemeUseCase`)**:
  Orchestrates theme persistence, security validation, JSON serialization, and cross-tab event broadcasting.
- **Infrastructure Layer (`ChromeThemeRepository`, `cssSanitizer`, `backupAllowlist`)**:
  Persists custom themes in `chrome.storage.local`, strips dangerous CSS injection patterns, and includes themes in user backups.
- **Presentation Layer (`ThemeEngine`, `ThemeStudioModalView`)**:
  Dynamically applies CSS custom properties, calculates real-time WCAG 2.1 contrast ratios, and renders live sandbox previews.

---

## 2. Design Token System

Every theme declares CSS variables for both **Dark** and **Light** modes across standard functional roles:

### Surface & Canvas Tokens

| CSS Variable | Description | Recommended Dark | Recommended Light |
|---|---|---|---|
| `--bg` | Main canvas background | `#100E0B` | `#FAF8F2` |
| `--surface` | Sidebar and primary surface | `#181A1E` | `#FCFCFD` |
| `--surface-2` | Cards, modals, dialogs | `#1E2025` | `#FFFFFF` |
| `--surface-active` | Hovered or active surface | `#2C3038` | `#F2F4F7` |

### Typography Tokens

| CSS Variable | Description | Recommended Dark | Recommended Light |
|---|---|---|---|
| `--fg` | Primary body text | `#E8EAEE` | `#16181D` |
| `--fg-secondary` | Headings & highlighted text | `#F2F4F7` | `#2A2E35` |
| `--muted` | Secondary labels, icon fills | `#8A919C` | `#555B66` |
| `--muted-2` | Monospace tags & subtitles | `#6B7280` | `#4B5563` |

### Border Tokens

| CSS Variable | Description | Recommended Dark | Recommended Light |
|---|---|---|---|
| `--border` | Hairline divider | `#24272D` | `#E6E8EC` |
| `--border-strong` | Active / focus boundary | `#343841` | `#CFD4DC` |

### Accent Tokens

| CSS Variable | Description | Recommended Dark | Recommended Light |
|---|---|---|---|
| `--accent` | Base highlight color | `#555B66` | `#3B82F6` |
| `--accent-primary` | CTA button background | `#6A7280` | `#2563EB` |
| `--accent-dark` | Deep accent for border/active | `#3F444E` | `#1D4ED8` |
| `--accent-soft` | Translucent tag/badge fill | `rgba(85,91,102,0.16)` | `rgba(59,130,246,0.12)` |
| `--on-accent` | Text color over accent CTA | `#FFFFFF` | `#FFFFFF` |

---

## 3. Atmospheric Lighting & Aura Shaders

Themes can optionally configure multi-layer atmospheric gradients and film grain overlays:

```json
{
  "aura": {
    "enabled": true,
    "layer1": {
      "background": "radial-gradient(55.8% 55.49% at 50% 100%, rgba(34, 50, 129, 0.76) 0%, rgba(25, 48, 47, 0) 100%)",
      "mixBlendMode": "screen"
    },
    "layer2": {
      "background": "repeating-linear-gradient(100deg, #262626 0%, #262626 3%, rgba(26, 102, 255, 0.7) 5%, transparent 10%)",
      "mixBlendMode": "screen",
      "filter": "blur(108px)",
      "opacity": 0.79,
      "backgroundSize": "300% 200%"
    },
    "grain": {
      "enabled": true,
      "opacity": 0.20,
      "mixBlendMode": "overlay"
    }
  }
}
```

---

## 4. Theme Validation & Testing

Run the automated validator to check schema compliance and WCAG contrast:

```bash
cd packages/syncly-theme-template
npm test
```

The validator verifies:
1. `id`, `name`, and `version` format.
2. Token presence and color hex/rgba format.
3. WCAG 2.1 AA (4.5:1) and AAA (7.0:1) contrast ratios.
4. Security restrictions (no `@import`, no remote HTTP URLs, character limits).

---

## 5. Publishing to the Community

1. Tag your GitHub repository with `syncly-theme`.
2. Publish to npm under `syncly-theme-[your-theme-name]`.
3. Submit your theme JSON to the Syncly Community Store catalog.
