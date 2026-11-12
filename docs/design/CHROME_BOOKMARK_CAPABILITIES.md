# Chrome bookmark capabilities for Syncly onboarding

Research checked against official sources on 2026-11-12. No implementation changes were made. Recommendations below are product/architecture judgments, identified separately from platform facts.

## Platform facts

**A live sidebar view does not require moving bookmarks.** `getTree()` and `getSubTree()` expose the existing native hierarchy. Syncly can render those same nodes in its new-tab sidebar. Creating, moving, renaming, and removing ordinary bookmarks/folders is supported with the existing `bookmarks` permission. Browser-owned special root folders cannot themselves be moved, renamed, or removed. Sources: [Chrome bookmarks API](https://developer.chrome.com/docs/extensions/reference/api/bookmarks), [Chromium bookmarks API schema](https://chromium.googlesource.com/chromium/src/+/lkgr/chrome/common/extensions/api/bookmarks.json).

**There is no documented public extension capability for toggling or reading the visibility of Chrome's bookmarks bar.** This conclusion follows from the public API surface: bookmarks methods manage the tree; commands define shortcuts for extension actions; settings overrides cover homepage, search provider, and startup pages. None exposes bar visibility or a general browser-command execution function. Do not promise a backend “hide bar” action or treat a registered extension shortcut as permission to execute Chrome's own shortcut. Sources: [public API catalog](https://developer.chrome.com/docs/extensions/reference/api/), [commands API](https://developer.chrome.com/docs/extensions/reference/api/commands), [settings overrides](https://developer.chrome.com/docs/extensions/reference/manifest/chrome-settings-override).

**The user can control the bar manually.** Google's keyboard documentation lists Ctrl+Shift+B on Windows/Linux and Command+Shift+B on Mac for showing/hiding the bookmarks bar. The bookmark help page also documents Chrome's menu control. Syncly can provide instructions; it should not claim to detect completion or silently synchronize the browser setting. Because a shortcut toggles state, avoid telling someone to press it unconditionally when the bar might already be hidden. Sources: [Chrome keyboard shortcuts](https://support.google.com/chrome/answer/157179?hl=en), [Chrome bookmark help](https://support.google.com/chrome/answer/188842?co=GENIE.Platform%3DDesktop&hl=en).

**Enterprise policy is a different mechanism.** `BookmarkBarEnabled` can enforce visibility. If set, users cannot change it; when unset, users choose. It is an administrator policy, not a normal extension API or an appropriate consumer onboarding action. Source: [Chrome Enterprise policy](https://chromeenterprise.google/policies/bookmark-bar-enabled/).

**Debugger and native messaging are not ordinary bar controls.** The debugger API attaches to targets for instrumentation. Native messaging requires a separately registered native host. Neither supplies a documented bookmarks-bar preference API. Do not add either mechanism to make onboarding imitate OS/browser keyboard input. This is a product recommendation based on their documented scope and setup. Sources: [debugger API](https://developer.chrome.com/docs/extensions/reference/api/debugger), [native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging).

## Roots, identity, managed data, and sync

- Chrome 134+ exposes `folderType` (`bookmarks-bar`, `other`, `mobile`, `managed`) and `syncing`. There may be zero, one, or multiple roots of a type. `syncing` distinguishes account-backed and local-only nodes and may change. Do not select a root only by hardcoded ID or English title.
- `unmodifiable: "managed"` marks administrator/custodian-controlled nodes. These must remain read-only; showing them is distinct from being allowed to reorganize them.
- Node IDs are unique within a Chrome profile and survive restarts. That does not promise identical IDs on another profile/device. Avoid using local IDs as cross-device identities.
- `move(id, destination)` operates on the existing node; `create()` creates another node. Prefer the former for an explicitly requested move, and do not claim copies remain linked. Cross-account root transitions need dedicated compatibility testing before promising identity preservation.

Sources for these schema details: [Chromium bookmarks schema](https://chromium.googlesource.com/chromium/src/+/lkgr/chrome/common/extensions/api/bookmarks.json), [Chrome bookmarks API](https://developer.chrome.com/docs/extensions/reference/api/bookmarks). Chrome's own account behavior governs native bookmark availability across devices: [Google bookmark help](https://support.google.com/chrome/answer/188842?co=GENIE.Platform%3DDesktop&hl=en).

## Recommended architecture and user-visible choices

Separate three independent settings:

1. **What Syncly shows:** Chrome bookmarks, Syncly workspace folders, or both. This is a reversible presentation preference over the native tree.
2. **Where new Syncly items live:** an app-owned `Syncly` folder beneath a writable Other bookmarks root, containing workspace collections/shortcuts. Persist the resolved root identity; repair carefully if it disappears. “All bookmarks” is a UI view, not a writable top-level folder.
3. **Whether Chrome's own bar is visible:** a manual Chrome setting, explained as an optional follow-up. It is neither an onboarding prerequisite nor a state Syncly claims to control.

Suggested first question: **“What would you like in your Syncly sidebar?”** Offer **“My Chrome bookmarks”**, **“A separate Syncly space”**, and **“Both”**. Explain that existing bookmarks stay where they are and that the choice can be changed in Settings. If only two primary cards are desired, offer Chrome bookmarks and Syncly space, with “Also show my Chrome bookmarks” as an independent option.

Changing this choice later should update sidebar visibility only, not run a migration or silently change save destinations. Keep any physical move into the Syncly root as a separate, optional action with a preview and a recovery plan. Restoring a prior physical layout is not equivalent to flipping a view preference after users have edited, deleted, or moved nodes elsewhere.

## Compatibility note for this repository

Syncly declares minimum Chrome 114, so Chrome 134+ root fields require feature detection and an older-version fallback. A modern-root resolver should handle account/local alternatives and managed folders explicitly. The existing `MigrateBookmarkBarToQuickAccessUseCase` moves direct URL children of the bar, not the complete nested tree; it is not a reversible onboarding-mode switch. These local-code observations were provided by the parent architecture audit and must be addressed before any later implementation plan.
