# Contributing to NothingTab

Thank you for your interest in NothingTab! This document outlines how to contribute.

## How to Contribute

### Report Issues
- Use the [GitHub Issues](https://github.com/KamrulIslamArnob/NothingTab/issues) tracker.
- Search existing issues before opening a new one.
- Include reproduction steps, expected vs. actual behavior, and your environment (OS, Chrome version).

### Submit Pull Requests
1. Fork the repository.
2. Create a branch: `git checkout -b feat/your-feature-name` or `fix/your-bug-name`.
3. Make your changes.
4. Test manually: load the repo as an unpacked extension at `chrome://extensions` and verify.
5. Commit with a clear, descriptive message: `feat: add widget support` or `fix: correct clock formatting`.
6. Push and open a Pull Request.

### Contribution Guidelines

- **Read [PRODUCT_SPEC.md](../PRODUCT_SPEC.md)** before implementing — it covers data models, use cases, and UI behavior.
- **Read [Design.md](design/Design.md)** for design system rules (typography, spacing, color, anti-patterns) — canonical at `docs/design/Design.md` (stub at repo root `Design.md`).
- **Follow Clean Architecture** — Presentation → Application → Domain ← Infrastructure. Never reverse dependencies.
- **No `innerHTML` with user data** — use the `el()` helper from `src/presentation/shared/dom.js`.
- **Respect MV3 CSP** — no inline scripts, no external JS, no `eval`.
- **Storage** — use `chrome.storage.local` for user data. `chrome.storage.sync` is only a cross-device mirror for the `SYNC_KEYS` allowlist (`GoogleSyncService.js`) and `aiQuotaPrefs`.
- **Cross-device sync must merge, not overwrite** — workspaces/collections/tags go through `applyRemoteChanges()`/`reconcile()` (item-level merge + tombstones); never `local.set(remoteValue)` whole keys.
- **Keep CSS tokens and JS theme in sync** — `tokens.css` and `penta-bridge/theme.js` must stay consistent.
- **All user data in `chrome.storage.local`** — sync mirrors only the allowlisted keys above; everything else stays local.
- **Commit after every task** with a clear, imperative commit message.

## Development Setup

```bash
git clone https://github.com/KamrulIslamArnob/NothingTab.git
cd NothingTab
# No build step — load as unpacked extension at chrome://extensions
```

## What's Good for Contributions

- Bug fixes
- New widgets (Todo, Notes, Clipboard, etc.)
- Accessibility improvements
- New icon sets / favicons
- Design polish
- Documentation improvements
- Translations / i18n
- Performance optimizations
- Test coverage

## Code of Conduct

Be respectful, constructive, and welcoming. We're all here to build something great together.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](../LICENSE).

---

<div align="center">

**Happy contributing!** 🎉

</div>