# AGENTS.md

## Primary source

`CLAUDE.md` at repo root is the canonical instruction file. Read it first — this file adds OpenCode-specific guidance and things an agent would likely miss.

## Quick reference

- **Project**: Syncly — Chrome MV3 new-tab replacement extension. Vanilla JS (ES modules), no build system, no npm runtime.
- **Load**: `chrome://extensions` → Developer mode → Load unpacked → repo root. Reload extension after manifest/service-worker changes. Refresh new-tab page after other changes.
- **Test**: `node --test` — runs `test/backup-compat.test.mjs` and `test/tree-view.test.mjs` (Node built-in `node:test` runner).
- **Smoke test** (requires Chrome + Puppeteer): `npm run smoke` (uses `puppeteer-core` from `devDependencies`; serves repo over HTTP, injects `chrome.storage` shim, asserts UI behavior).
- **No linter, typecheck, or CI** — verify manually.

## Architecture (top facts)

- Strict Clean Architecture: `presentation → application → domain ← infrastructure`.
- **`src/infrastructure/di/container.js`** is the single composition root — wire all new use cases, repos, and services here. Returns frozen `{ events, useCases, internals }`.
- Data-change flow: use case → repo persist → EventBus emit → controller subscribe → re-render.
- `chrome.storage.onChanged` wired in container for cross-tab sync.
- ~35 use cases total. Domain entities use private `#` fields with invariant-enforcing mutators + `toJSON()`/`fromJSON()`.

## Storage model

- All data in `chrome.storage.local` (never sync). Keys: `bookmarks`, `categories`, `settings`, `tasks`, `layout`, `aiQuotaCache`, `aiQuotaPrefs` (sync for AI quota prefs), `quickNote`.
- AI Quota source-of-truth: Supabase Postgres via raw `fetch` to PostgREST (`supabase/schema.sql`). Bearer PAT stored in `chrome.storage.local`. Provider API keys never leave the backend.
- AutoBackupService uses File System Access API + IndexedDB (`neptab-backup-db`) to persist a chosen JSON backup file.

## Conventions that differ from defaults

- All DOM built via `el()` helper (`src/presentation/shared/dom.js`) — never `innerHTML` for data.
- All user input sanitized through `BasicSanitizer` at use-case layer.
- Design tokens in **two places** that must stay in sync: CSS (`src/presentation/shared/styles/tokens.css`) and JS (`src/presentation/shared/penta-bridge/theme.js`).
- Always read `PRODUCT_SPEC.md` before reverse-engineering behavior from source.

## Referenced docs

- `PRODUCT_SPEC.md` — exhaustive product + engineering spec (data model, all use cases, UI behavior). Read before implementing features.
- `Design.md` — Nothing design system rules (typography, spacing, anti-patterns, color).
- `CLAUDE.md` — full architecture, composition root, data flow, reference docs.

## Things to avoid

- Importing or extending scratch files: `src/ui_kits-app-index.html` (leftover dev artifact).
- Adding `innerHTML` with user data — use `el()` + `textContent`.
- Breaking MV3 CSP: no inline scripts, no external JS, no `eval`.
- Touching `chrome.storage.sync` for user data — only `aiQuotaPrefs` goes there. Everything else is `local`.
