# Changelog

All notable changes to **Syncly** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- GitHub Actions CI workflow for automated test runs on pull requests and branch pushes.
- Automated Release packaging workflow for version tags (`v*`).
- GitHub issue templates for bug reporting and feature requests.
- Pull request template with comprehensive verification checklist.
- Architecture and permissions documentation in `docs/`.

---

## [0.2.0] - 2026-08-20

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
