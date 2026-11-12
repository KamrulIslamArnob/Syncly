# Popup capture UX

## Intent

Preserve folder bookmarks, shortcuts, collections, workspace ownership, title/URL editing, tags, recent destinations, inline creation, themes, and the side panel. Reduce competing visual emphasis around saving.

The supplied screenshots guide the form hierarchy and quiet appearance. The multi-tab screenshot is a visual reference; batch saving and closing tabs were not added because they are outside the existing popup functionality.

## Concepts and decisions

- **Quickie**: global inbox for capturing a page without organizing it. The header Quickie button requires one click after opening the popup.
- **Folder**: a native Chrome bookmark location. An existing bookmark is moved or renamed rather than copied by this mode.
- **Shortcut**: a bookmark in a category beneath the selected workspace’s Shortcuts folder.
- **Collection**: a workspace-owned group with native folder storage and collection membership. Existing collection-save semantics remain intact.
- **Workspace**: context for collections and shortcuts, placed before destination selection so its effect is visible.
- **Tags**: optional retrieval aids. Suggestions are unselected until chosen; typed tags are included even without pressing Enter first.

Title and domain establish what is being saved. An Edit URL chip beside the domain opens an editor over the form. Destination types use a restrained underline and a short explanation. Search, recent alternatives, and inline creation remain available. Repeated chips for the selected destination are omitted.

Quickie confirmation stays open, allowing a subsequent folder move. This adds an explicit close compared with the previous auto-close behavior but enables immediate organization. There is no save-speed timing claim.

## References inspected on Mobbin

- [Cosmos collection picker](https://mobbin.com/screens/1667fd71-428b-4f1b-b6ef-06ad086b56cd): searchable destinations and creation in the same selection surface.
- [Fabric link dialog](https://mobbin.com/screens/3aeb1dcf-a3ea-4eae-96ae-8c68dadb15f8): structure only, from another product category; a focused capture dialog, optional metadata, and keyboard hints.

These are design references, not evidence that Syncly’s redesigned flow is faster.

## Validation

Automated save tests cover duplicate-submit guarding, tag persistence, moving existing bookmarks, shortcut destinations, collection membership, native-save failures, and partial tag failures. Browser checks use mocked Chrome APIs with the real popup controller and application container, avoiding personal bookmarks.

Browser checks cover Quickie then move, folder search with arrow/Enter selection, focus restoration, inline folder/category/collection creation, independent popup theme, and a 320px side panel with large font and an open picker. The panel scrolls to retain access to controls.

This is functional and heuristic validation, not a user study or an installed-extension end-to-end test. A next user study should compare unassisted destination accuracy, capture completion time, and accidental duplicate saves on the old and new flows.

## Workspace and overlay refinement

The active new-tab workspace is selected on popup load. Three quick buttons prioritize the active workspace and workspaces with the most successful popup saves. More/Less expands the remaining choices, including All bookmarks. Usage counts are local UI preferences in `popupWorkspaceUsage`; they are not synchronized or included in backups.

Selecting a workspace refreshes its shortcut categories and collections. Refreshes are serialized, and saving waits for the latest choice. The Quickie inbox remains global.

Destination pickers use fixed overlays anchored to the trigger, opening above when space below is limited. Lists scroll inside the overlay. Opening search, creating a destination, or editing the URL does not push the rest of the form. Mode switches retain the same popup width and scrollbar gutter.

The header places the Quickie button next to the logo with a platform-specific Ctrl+S or Command+S hint. This shortcut works while the popup or side panel has keyboard focus. Ctrl/Command+Enter still saves to the selected destination.

Additional browser checks confirm unchanged element coordinates when each picker and URL editor opens, identical mode widths, active-workspace defaults, usage ordering, More/Less, workspace-specific destination refresh, rapid switching, and Quickie keyboard capture.
