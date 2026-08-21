# Docs — Syncly Documentation Index

> **New locations (2026-08-21 reorg):** Agent memory and security/design docs were moved into foldered canonicals under `docs/` (strict move — former root copies removed). See each subfolder README.

## Top-level

| Document | Canonical | Mirror | Description |
|----------|-----------|--------|-------------|
| Agent instructions (Claude) | [`agents/CLAUDE.md`](agents/CLAUDE.md) | — | Architecture, commands, data flow — READ FIRST for Claude Code |
| Agent instructions (OpenCode) | [`agents/AGENTS.md`](agents/AGENTS.md) | — | Architecture, storage, conventions — READ FIRST for OpenCode |
| Design system | [`design/Design.md`](design/Design.md) | — | Nothing-inspired UI/UX rules, craft, anti-patterns |
| Security policy | [`security/SECURITY.md`](security/SECURITY.md) | [`SECURITY.md`](SECURITY.md) (duplicate for GitHub) | Reporting, supported versions, safeguards |
| Product spec | [`../PRODUCT_SPEC.md`](../PRODUCT_SPEC.md) | — | Exhaustive spec (stale note for new-tab, see `agents/CLAUDE.md`) |
| Architecture | [`architecture.md`](architecture.md) | — | Clean Architecture layers, data flow |
| Development | [`development.md`](development.md) | — | Setup, loading, testing, debugging |
| Permissions | [`permissions.md`](permissions.md) | — | `manifest.json` permissions + CSP |
| Launch checklist | [`launch-checklist.md`](launch-checklist.md) | — | Store publication steps |
| Contributing | [`CONTRIBUTING.md`](CONTRIBUTING.md) | — | How to contribute (also root `CONTRIBUTING.md`) |
| Testing standard | [`TESTING_STANDARD.md`](TESTING_STANDARD.md) | — | `node:test` contract |
| Test cases | [`TEST_CASES.md`](TEST_CASES.md) | — | Detailed matrix |
| AI Quota tracker | [`AI-Quota-Tracker-Extension-Build-Task.md`](AI-Quota-Tracker-Extension-Build-Task.md) | — | Supabase quota spec (not yet wired) |
| Project summary | [`PROJECT_SUMMARY.md`](PROJECT_SUMMARY.md) | — | One-file codebase overview |

## Folder structure

```
docs/
├── agents/           # Canonical agent memory (CLAUDE.md, AGENTS.md)
│   ├── CLAUDE.md
│   ├── AGENTS.md
│   └── README.md
├── design/           # Nothing design system
│   ├── Design.md
│   └── README.md
├── security/         # Canonical security policy
│   ├── SECURITY.md
│   └── README.md
├── SECURITY.md       # Duplicate for GitHub detection (sync of security/SECURITY.md)
├── architecture.md
├── development.md
├── permissions.md
├── launch-checklist.md
├── CONTRIBUTING.md
├── TESTING_STANDARD.md
├── TEST_CASES.md
├── AI-Quota-Tracker-Extension-Build-Task.md
├── PROJECT_SUMMARY.md
├── superpowers/      # Historical design specs & plans (pre-reorg, refs to CLAUDE.md at root are historical)
└── competitor-profiles/
```

## Editing rules

- **Agent memory / design / security:** Edit the canonical under `docs/agents/`, `docs/design/`, `docs/security/` — for security, `docs/SECURITY.md` is auto-mirrored from `docs/security/SECURITY.md` for GitHub.
- **Other docs:** Edit in place; cross-link using relative paths (e.g., from `docs/architecture.md` to `../PRODUCT_SPEC.md` or `agents/CLAUDE.md`).

## Historical notes

Files under `docs/superpowers/` are point-in-time specs/plans that still mention `CLAUDE.md` at repo root — those mentions are historical and intentionally not rewritten, since the files are archival. For current architecture, read `docs/agents/CLAUDE.md`.
