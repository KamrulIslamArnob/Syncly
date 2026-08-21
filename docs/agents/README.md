# Agent Memory — Canonical Agent Instructions

This folder holds the **canonical** agent instruction files for this repository (moved from repo root 2026-08-21).

| File | Purpose |
|------|---------|
| [`CLAUDE.md`](CLAUDE.md) | Instructions for Claude Code (claude.ai/code) — architecture, commands, data flow |
| [`AGENTS.md`](AGENTS.md) | Instructions for OpenCode — architecture, storage model, conventions |

> **Editing rule:** Edit the files **in this folder**. Former root copies have been removed (strict move).

Tools that previously looked for these files at repo root (Claude Code expects `CLAUDE.md` at root, OpenCode expects `AGENTS.md` at root) should be configured to read `docs/agents/CLAUDE.md` / `docs/agents/AGENTS.md` or recreate a shim/symlink at root if needed.
