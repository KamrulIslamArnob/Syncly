# Changelog

All notable changes to **Syncly** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- GitHub issue templates for bug reporting and feature requests.
- Pull request template with comprehensive verification checklist.
- Architecture and permissions documentation in `docs/`.
- Canonical full-app context memory: `docs/CONTEXT.md`.

### Changed
- README test badge, permission table, and commands updated to match the live suite and `manifest.json`.
- `PRODUCT_SPEC.md` and `docs/PROJECT_SUMMARY.md` marked historical; agents directed to `docs/CONTEXT.md`.

### Notes
- GitHub Actions CI / release workflows are **planned, not yet present** (no files under `.github/workflows/`). Prior draft notes that claimed they shipped were incorrect.

---

## [1.0.0] - 2026-08-27

### Added
- **Two-Pane Workspace Layout**: Introduced modern two-pane bookmark deck dashboard with collapsible sidebar.
- **Native Bookmarks Synchronization**: Real-time integration with `chrome.bookmarks` tree with automatic folder discovery.
- **Workspaces & Profiles**: Contextual scoping for Work, Personal, Development, and Design bookmarks.
- **Themed Collections**: Bundle bookmarks across different native folders into custom virtual collections.
- **Universal Category Shortcuts**: Top-level circular category strips for quick access to frequent web apps.
- **Instant OmniSearch Index**: Sub-millisecond fuzzy search with `#tag` indexing and `Ctrl+K` / `Cmd+K` shortcut support.
- **Automated Local Backups**: File System Access API and IndexedDB-backed dirty-checked JSON file backups.
- **Adaptive Color Themes**: Clean Nothing-inspired Light and Dark color modes with customizable accent color shades.
- **Security & Sanitization Layer**: Integrated `BasicSanitizer`, CSS sanitization, and URL protocol verification.

### Fixed
- **Sidebar Shadow Bleed**: Eliminated dark drop-shadow leak from closed off-screen settings drawer.
- **Light Theme Borders**: Fixed light mode sidebar border inconsistencies.

### Removed
- **Dead Code Cleanup**: Pruned legacy widget dashboard views, unused prototype bridge files, and orphaned use cases to reduce memory footprint.
