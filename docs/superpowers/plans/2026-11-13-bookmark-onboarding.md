# Reversible Bookmark Onboarding Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. The user has authorized implementation in this session.

**Goal:** Add reversible new-tab bookmark-source choices and an owned Syncly library for new setups without moving existing bookmarks.

**Architecture:** Keep source preferences in local storage and project the native tree into sidebar sections. A shared location resolver supports legacy layouts and new account-aware Syncly roots. Setup and preference changes are separate operations; no existing-library relocation is performed.

**Tech Stack:** Vanilla ES modules, Chrome MV3, Node test runner.

**Spec:** `docs/design/BOOKMARK_ONBOARDING_RESEARCH.md`

## Global constraints

- Chrome 114 minimum; feature-detect modern account/root fields.
- No new runtime dependencies or permissions.
- Sidebar source switching performs zero native bookmark writes.
- Preserve native bookmarks, existing workspace ownership, global Quickie, and explicit popup save destinations.
- Never simulate Chrome shortcuts or claim to control its bookmarks bar.
- No automatic reparenting of existing users' bookmarks.

## Review focus

- Native IDs arriving out of order across profiles must not trigger workspace deletion.
- Managed roots are read-only; multiple roots require a deliberate choice.
- Missing/ambiguous Syncly roots must not silently claim unrelated content.
- Installs, updates, reloads, and skipped setup must preserve existing layouts.
- All bookmarks/search must remain accessible when sidebar sections are hidden.

## Task 1: Preferences and root discovery

Files: domain bookmark-tree helpers, application preference use cases, infrastructure local settings adapter; `test/bookmark-library.test.mjs`.

- [x] Write and run failing tests for modern/legacy/account/local/managed roots and local-only preference changes.
- [x] Implement root discovery and settings use cases; prove that changing sources invokes no bookmark gateway writes.

## Task 2: Shared owned-library resolver

Files: infrastructure library-location service, existing ensure/adoption use cases, group-dialog parent resolver, container and service worker.

- [x] Add failing tests for legacy preservation, new managed roots, idempotence, ambiguous roots and delayed trees.
- [x] Implement one resolver for global Quickie/Collections/Shortcuts and workspace creation/adoption; preserve legacy folders in place.
- [x] Remove automatic deletion of unresolved workspace metadata; keep missing roots pending reconciliation.

## Task 3: Reversible sidebar and onboarding

Files: new shared setup/preferences view and CSS, new-tab controller/deck/settings, install lifecycle.

- [x] Test sidebar projections, global all-bookmark access, setup gating, and read-only preference switching.
- [x] Add first-install choices, optional Both, Skip, account-aware storage labels, and manual bar help.
- [x] Reuse the same source controls in Settings; replace the misleading migration toggle with these reversible choices.
- [x] Keep collection/shortcut filters tied to active workspace and leave popup destination selection independent.

## Task 4: Verification and review

- [x] Run targeted tests and full suite; check mocked browser interactions at desktop and narrow sizes.
- [x] Review whole branch with a fresh reviewer, fix substantive findings, update canonical context.
- [x] Commit verified implementation on the feature branch; report changes and actual validation limits.

## Execution ledger

- Baseline: 501 tests pass. Popup and research committed/pushed to origin/main as `2bda3b3` before creating `feat/reversible-bookmark-onboarding`.
- Ruling: implement safe source switching and new-install storage now; do not run physical relocation on existing libraries. That is a separate user-visible migration requiring real multi-device validation.
- Ruling: source preferences and native-folder bindings stay local; no claim that raw Chrome IDs are portable across devices.

- Verification: 530 tests passed, including stale setup tabs, concurrent structure creation, scoped global collection reconciliation, profile-ID collisions, and fail-closed destinations. Browser checks covered first install, Skip, account/local selection, first legacy source switch, Undo, All bookmarks, workspace creation, and popup destinations.
- Fresh review: eight substantive findings identified; regression tests and implementation fixes address each. Bounded verification found one stale child-cache residual; it was fixed with a failing/passing regression.
- Ruling: passive new-tab and popup loading resolve existing destinations without creating empty system folders. Explicit save/create actions may ensure their required folders.
- Ruling: existing-library relocation and real Google-account cross-device certification remain deferred; no arbitrary live user bookmarks were modified during verification.
