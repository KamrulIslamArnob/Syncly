# Bookmark onboarding and reversible sidebar sources

Research date: 2026-11-12. Status: research baseline. Reversible sources and new-install owned storage implemented on 2026-11-13; physical existing-library relocation remains a proposal. This document records the research baseline; current implementation details are in docs/CONTEXT.md. Platform details are collected in [Chrome bookmark capabilities](CHROME_BOOKMARK_CAPABILITIES.md).

## Recommendation

Treat the user's choice as three independent concerns:

1. Which native bookmark sources appear in the Syncly new-tab sidebar.
2. Where Syncly creates its own inbox, workspaces, shortcuts, and collections.
3. Whether the user keeps Chrome's native bookmarks bar visible.

The first is a view preference, the second is a storage/ownership boundary, and the third belongs to Chrome. Linking the first to a physical move makes a simple preference unexpectedly difficult to reverse.

Recommended invariant: changing the sidebar source never creates, moves, copies, or deletes bookmarks. A folder move remains an explicit action, separate from changing views.

The hypothesis that most prospective users rely on the bar has not been established by this research. A populated bar is useful context for a suggested starting view, not proof of use or visibility.

## First-run question and copy

Ask: **How would you like to start?**

**Show my Chrome bookmarks**

> See your existing bookmarks and folders in Syncly's sidebar. They stay in their current Chrome locations.

**Start with Syncly workspaces**

> Organize new saves in a Syncly folder. Keep your existing Chrome bookmarks as they are.

Below the choices:

> You can show both or switch later in Settings → Bookmarks.

Use two starting presets, not two incompatible storage implementations. Offer an optional **Show both** control or preview; retain it as a first-class choice in Settings. A preset chooses the prominent folder source; existing collection, shortcut, search, and Quickie features remain available.

Recommend the existing-bookmarks preset when writable bar content exists. Otherwise suggest the workspace preset. Keep the decision explicit and offer Skip for now. Empty or temporarily unavailable bookmark roots must not be treated as consent to create or migrate data.

Do not ask users to understand native root folders, workspace ownership, import formats, and bar visibility before they can open a bookmark. Show a small preview using a few of their folder names, computed locally. Defer advanced moves and storage relocation. This applies progressive disclosure as a design judgment, not as evidence that this particular flow has been user-tested. [NN/G: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/).

## What the user sees after each choice

Existing-bookmarks preset:

- A persistent **Chrome bookmarks** sidebar section shows the real bookmarks-bar hierarchy, including direct links and nested folders.
- Chrome's own bar can remain visible. Edits in either interface affect the same bookmarks.
- Syncly workspaces still supply their own shortcuts and collections. Switching workspace changes those sections, not the global Chrome bookmarks section.

Workspace preset:

- The sidebar emphasizes the active workspace's folders.
- Collections and shortcuts use that workspace's owned folders.
- Existing Chrome bookmarks remain accessible through **All bookmarks** and global search, even when their sidebar section is hidden.

Both:

- The sidebar shows a clearly labeled global Chrome bookmarks section and active-workspace folders.
- A bookmarked node is indexed once by identity even if several views surface it.
- There are no synchronized copies to keep consistent.

All presets retain the global Quickie inbox. The source preference must not silently change the popup's explicit destination or intercept native Chrome star/Ctrl+D saves. A bookmark saved using Chrome remains in the location Chrome chose; Syncly's linked view discovers it there.

Showing existing bookmarks can use the native tree directly; physical copying is unnecessary. Native browser-owned root folders cannot be reparented. [Chrome bookmarks API](https://developer.chrome.com/docs/extensions/reference/api/bookmarks).

## Chrome bar visibility: optional manual follow-up

After a user has successfully opened a bookmark, offer:

> Prefer more room? You can hide Chrome's bookmarks bar and keep using these bookmarks in Syncly.

Show platform-specific Ctrl+Shift+B or Command+Shift+B instructions and the Chrome menu alternative. Say **if the bar is visible**, since this shortcut toggles rather than sets a known state. Offer **Keep it as it is** and **Done**. Done only dismisses help; it must not claim that Syncly verified the browser's setting. [Chrome shortcuts](https://support.google.com/chrome/answer/157179?hl=en), [Chrome bookmark help](https://support.google.com/chrome/answer/188842?co=GENIE.Platform%3DDesktop&hl=en).

There is no documented public consumer-extension API for hiding, showing, or reading the native bar's visibility. Registering a shortcut through the extension commands API does not execute Chrome's built-in command. Do not add keyboard simulation, native hosts, debugger permissions, or administrator-policy changes for this onboarding task. [Commands API](https://developer.chrome.com/docs/extensions/reference/api/commands), [settings overrides](https://developer.chrome.com/docs/extensions/reference/manifest/chrome-settings-override).

## One owned storage tree

Proposed layout for newly configured installations, beneath a resolved writable Other bookmarks root:

```text
Other bookmarks
└── Syncly
    ├── Quickie                    one global inbox
    └── Workspaces
        ├── w-Work
        │   ├── Collections
        │   │   └── Design references
        │   ├── Shortcuts
        │   │   └── Quick Access
        │   └── Research           ordinary user folder
        └── w-Personal
            ├── Collections
            └── Shortcuts
```

This is a proposed future layout; current workspaces are siblings under Other bookmarks. The common Syncly root is useful under either view preset: viewing Chrome bookmarks does not require storing every new Syncly object on Chrome's bar.

All bookmarks is a product view, not a writable browser root. Preserve the existing w- convention initially for compatibility; friendly workspace names can omit it in the UI. Native Syncly folders remain accessible in Chrome if the extension is disabled or removed. Do not promise extension uninstall will restore a previous physical layout.

Create the owned structure after a clear onboarding completion or when the user first creates a Syncly item. Do not eagerly create every workspace or empty category during a preview. Existing users should keep working with their current native folders until they explicitly choose a structural upgrade.

## Architectural fit

Keep the current Clean Architecture layers. No new framework or second bookmark database is needed.

- **Domain:** sidebar-source preferences, ownership, and migration-plan invariants. Distinguish borrowed external sources from owned workspace roots. Chrome's bar is never a workspace's owned root.
- **Application:** separate operations for reading a sidebar projection, changing source preferences, ensuring the owned Syncly structure, and previewing/applying/reversing a migration. Ordinary preference changes cannot call migration operations.
- **Ports:** a bookmark-tree gateway and preference/journal repositories. Use cases receive these dependencies rather than reaching into Chrome from the UI.
- **Infrastructure:** Chrome bookmark adapter, root discovery, storage persistence, and native event subscriptions. Resolve special roots through feature detection; do not scatter ID or English-title assumptions across views.
- **Presentation:** onboarding and Settings use the same preference operation. The new-tab sidebar renders its projection; the popup consumes the shared destination resolver without inheriting new-tab visibility filters.
- **Composition root:** wire these operations once in container.js. The service worker needs the same discovery/ownership rules rather than a separate folder-layout algorithm.

Suggested state responsibilities, not a committed schema:

- Local presentation preferences: show Chrome bookmark sources, show workspace folders, onboarding completion/version.
- Local bindings: discovered browser root IDs, Syncly root ID, workspace-to-native-folder bindings; validate against the live tree.
- Existing logical workspace and collection metadata: continue using the current repository/sync paths.
- Local migration journal: original parent/index, planned destination, progress, and conflicts for each actual move.

Native IDs are profile-scoped. A synced native folder ID is not a portable identity for another device. Chrome 134+ exposes root type/account information, while Syncly currently supports Chrome 114; discovery must be feature-detected and handle older versions, multiple roots, and read-only managed content. Details: [capabilities note](CHROME_BOOKMARK_CAPABILITIES.md).

## Switching after a mistaken choice

Settings → Bookmarks → **Show in the sidebar** exposes independent controls for Chrome bookmarks and workspace folders. Keeping both on is valid. All bookmarks and global search remain available regardless of these controls.

Changing these controls updates presentation only and offers Undo for the previous setting. Keep the native bar instructions nearby, clearly separate. Users who kept Chrome's bar visible can start using the Syncly sidebar immediately; users who hid it restore it manually using Chrome's control. These are two separate reversals.

Do not automatically hide the native bar, delete a Syncly folder, move existing links, or clear a workspace when a source is turned off. Making the correction easy follows the user-control/undo principle. [NN/G: User Control and Freedom](https://www.nngroup.com/articles/user-control-and-freedom/).

## Physical moves belong to a separate flow

Offer **Move existing bookmarks…** later, if needed. First preview selected folders/links, exact source and destination, item counts, and the effect on other native bookmark views. Preserve hierarchy and order. An existing native folder can be shown in the sidebar without moving it.

Application workflow: inspect → validate → preview → explicit user action → journaled moves → verify → report. Native bookmark APIs are not an atomic multi-operation transaction. Persist each successful move and make the process resumable and idempotent; revalidate before each step. Use the existing nodes for moves, not copy-then-delete. Track undo conditions before promising reversal.

Undo restores still-valid items to original parents and positions. If another device or user changed an item, do not overwrite it silently. Present restored/skipped/conflicted counts, let the user choose a surviving destination when a parent was deleted, and leave newly added items untouched. A migration may be reversible under these conditions; arbitrary later edits cannot be guaranteed to undo perfectly.

Ownership matters: an external folder merely shown in a workspace must never be deleted by workspace deletion or structural cleanup. Moving a source into a managed container must not silently grant ownership over the user's original library.

## Repository findings that affect implementation

These observations come from the current source, not platform documentation:

1. `BookmarkDeckView.js` already reads the full native tree, builds an unscoped search index, and listens to native changes. Its no-workspace sidebar favors the bookmarks-bar root; active workspaces replace that folder scope. An independent global Chrome section needs a separate projection from active-workspace folders.
2. `MigrateBookmarkBarToQuickAccessUseCase.js` moves only direct URL children into global Shortcuts/Quick Access. Nested folders stay on the bar. It has no reverse operation and reports per-item failures only through logs. Its migrated flag is written even after partial moves and is not itself consulted by execute().
3. `SettingsSidebarView.js` immediately calls that migration when its toggle is enabled. Disabling the toggle does not restore bookmarks. This control should not be reused as a reversible source switch.
4. `AdoptNativeWorkspaceFolders.js` discovers w-* children directly beneath Other bookmarks. A nested Syncly root requires updated discovery and legacy support. Both page startup and service-worker adoption must agree.
5. `GroupDialogView.js` currently creates native workspace folders from presentation code. Its creation-parent resolver, global Quickie/Collections/Shortcuts ensure operations, popup destinations, and workspace adoption all need a common owned-library resolver.
6. `EnsureWorkspaceStructureUseCase.js` and the existing workspace-owned Collections/Shortcuts model are useful foundations; retain their ownership boundary.
7. The new-tab loader can clean up workspace metadata when all referenced native folders are missing. A migration must prevent a transient or unavailable tree from triggering cleanup/adoption/repair races.
8. runtime.onInstalled currently reconciles sync and starts adoption without distinguishing first-install onboarding. Gate setup using install reason and versioned local state; an update or reload must not reset a user's choice.

A structural upgrade should support legacy and nested locations, use validated ownership rather than title alone, move owned workspace subtrees without recreating their contents, preserve tag/collection references, and avoid adopting an unrelated user folder merely named Syncly. Resolve ambiguous or duplicated roots explicitly.

## Research limits and validation before implementation

This is a source/API review and a proposed product design. It is not evidence of bookmark-bar prevalence, onboarding conversion, or user comprehension. No installed-extension migration experiment or user study was run.

Before building, test paper/clickable research concepts with people who use the bar, people who do not, and people who already use folders. Ask them to predict where a save goes, choose a starting mode, change their mind, show both sources, and add a bookmark through Chrome's star. Observe whether they think switching views moves or deletes anything.

Acceptance criteria for a later implementation:

- Switching view presets or correcting onboarding performs zero bookmark writes.
- Both views reference the same native items and do not create duplicates.
- Shortcut/collection ownership still follows the active workspace; Quickie remains global.
- Native-bar help does not claim automatic control or detection.
- Existing libraries survive update, reload, uninstall, source hiding, and cancelled setup.
- Explicit migrations survive interruption and report partial failures and guarded undo.
- Account/local roots, managed bookmarks, multiple devices, renamed folders, duplicate Syncly names, delayed sync, and Chrome 114 compatibility have defined behavior.

Recommended delivery sequence: reversible source preferences first; shared library resolver and new-install owned root second; existing-user relocation and optional bookmark moves only after the journal and recovery behavior are validated.

## Google sync recheck — 2026-11-13

The proposed view switch is compatible with native Google bookmark syncing because it need not write to the bookmark tree. Keep the source preference local by default, so one device can show Chrome bookmarks while another emphasizes workspaces over the same account-backed content.

Correct the storage recommendation above: a writable Other bookmarks root alone does not establish that its children are saved in the Google Account. Where Chrome exposes account/local alternatives, prefer the user-selected account-backed writable root for the Syncly library and inspect the node's `syncing` property when available. Chrome 114 compatibility needs an explicit fallback; do not claim account-backed status without evidence. Existing local-only bookmarks are a separate case, not automatically synced merely because they can be read by Syncly. [Bookmarks API](https://developer.chrome.com/docs/extensions/reference/api/bookmarks).

Google's promise concerns Chrome profiles using the same Google Account with the relevant information saved to that account. Signing into Gmail is not necessarily signing into Chrome. It is not a promise of universal Chrome/Edge/Firefox bookmark sync. Native bookmarks may be available on mobile while the Syncly extension UI still requires a supported desktop extension host. [Sign in to Chrome](https://support.google.com/chrome/answer/185277?co=GENIE.Platform%3DDesktop&hl=en), [Google Account bookmark availability](https://support.google.com/chrome/answer/165139?co=GENIE.Platform%3DDesktop&hl=en), [Extension installation](https://support.google.com/chrome_webstore/answer/2664769?hl=en).

Separate the two transports already used by this repository: native bookmark sync carries the tree; extension storage.sync carries Syncly metadata/settings and has its own enablement, quotas, and delivery timing. Current merge code handles raw bookmarkGroups/bookmarkCollections entities and bookmarkTags keys, which can contain native node IDs. Those IDs are profile-scoped, so cross-device resolution and ownership mapping need validation; generic merge-by-ID is not itself a native-ID translation mechanism. Existing native adoption and URL fields provide partial recovery paths, not proof of complete cross-device equivalence. [Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage), local `GoogleSyncService.js`, `crossDeviceSync.js`, and `AdoptNativeWorkspaceFolders.js`.

An actual move or deletion in an account-backed tree is a shared content change and can propagate to other devices. Do not reparent folders when a local source preference changes, and do not interpret delayed native sync or unresolved local IDs as confirmed deletion. Before shipping structural migration, test two real Chrome profiles/devices with the same account, distinct local node IDs, offline edits, mismatched arrival order of native bookmarks versus extension metadata, and sign-out/sign-in. This research did not run those experiments and does not certify the existing implementation's cross-device safety.
