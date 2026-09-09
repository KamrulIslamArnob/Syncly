# Syncly Theme Template

Official starter template for building, testing, and publishing standalone themes for **Syncly New Tab**.

---

## 🚀 Quick Start

1. **Clone or use this template**:
   ```bash
   git clone https://github.com/KamrulIslamArnob/syncly-theme-starter.git my-syncly-theme
   cd my-syncly-theme
   ```

2. **Customize `theme.json`**:
   Edit metadata (`id`, `name`, `author`, `description`) and design tokens for both `dark` and `light` modes.

3. **Validate & Audit Accessibility**:
   ```bash
   npm run validate
   ```

4. **Test in Syncly**:
   - Open Syncly New Tab Settings -> **Appearance**.
   - Click **Open Theme Studio** or **Import Theme**.
   - Select your `theme.json` file to preview and test it live.

---

## 🎨 Theme Structure

```json
{
  "$schema": "https://syncly.app/schemas/theme-manifest.schema.json",
  "id": "my-theme-id",
  "name": "My Theme Name",
  "version": "1.0.0",
  "description": "Clean, atmospheric theme for focus",
  "author": "Your Name <you@example.com>",
  "license": "MIT",
  "modes": {
    "dark": {
      "tokens": {
        "--bg": "#090A0F",
        "--surface": "#10131A",
        "--surface-2": "#161B26",
        "--fg": "#00F0FF",
        "--accent": "#00F0FF"
      },
      "aura": {
        "enabled": true,
        "grain": { "enabled": true, "opacity": 0.2 }
      },
      "customCss": ""
    },
    "light": {
      "tokens": {
        "--bg": "#FFFFFF",
        "--surface": "#F4F4F5",
        "--surface-2": "#E4E4E7",
        "--fg": "#09090B",
        "--accent": "#18181B"
      },
      "aura": { "enabled": false }
    }
  }
}
```

---

## 🛡️ Security & Publishing Rules

- **No Remote Stylesheets**: `@import` is strictly prohibited.
- **No External Assets**: Remote `http:` / `https:` image URLs in CSS are blocked for privacy and CSP compliance. Use CSS gradients, data URLs, or embedded SVG.
- **Accessible Contrast**: Ensure primary text achieves at least **4.5:1 (WCAG AA)** against its underlying surface.
- **Dual Mode**: Every theme MUST provide both `dark` and `light` definitions.

---

## 📦 Publishing to npm & GitHub

Tag your repository with `syncly-theme` on GitHub and publish to npm:

```bash
npm publish --access public
```
