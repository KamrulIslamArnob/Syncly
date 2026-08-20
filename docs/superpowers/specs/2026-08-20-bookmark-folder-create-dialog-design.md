# Bookmark Folder Create Dialog — Design Spec

Date: 2026-08-20
Status: Approved, pending implementation plan
Supersedes: [2026-08-19-bookmark-collections-design.md](2026-08-19-bookmark-collections-design.md)
(that spec redefined "collection" as a curated multi-bookmark set with
hashtag categories, decoupled from folders — after seeing the actual running
UI, the user reversed that: the sidebar section stays folder-based, just
renamed and with a real creation UI instead of `window.prompt`).

## Problem

The sidebar's folder-list section works correctly today — each row already
is a real root-level (or nested, once expanded) native Chrome bookmark
folder via `collectFolders()` ([BookmarkDeckView.js:46-59](../../../src/presentation/newTab/views/BookmarkDeckView.js)).
Two things are wrong:

1. It's labeled "COLLECTIONS", which is confusing.
2. Creating a new one goes through `window.prompt("Enter new collection name:")`
   ([BookmarkDeckView.js:714-727](../../../src/presentation/newTab/views/BookmarkDeckView.js)) — an
   unstyled browser dialog, and it always creates at the default location
   (no way to place it under an existing folder) with no picker.

## Changes

### 1. Rename, cascaded

`COLLECTIONS` section label → `BOOKMARKS`. Cascade the same rename through
every user-visible string tied to it, so nothing is left saying "collection":

- `addColBtn` title/aria-label: "Add Collection" → "Add Bookmark Folder"
- `bottomNewBtn` text: "New collection..." → "New folder..."
- `_sidebar` aria-label: "Collections Navigation" → "Bookmarks Navigation"
- `_promptCreateCollection()` → renamed `_openNewFolderDialog()`

No behavior change, no data model change — text only.

### 2. Folder-per-root listing

Already correct (`collectFolders()` already does exactly this: each root's
direct child folders, plus a synthetic "loose bookmarks" bucket per root for
items sitting directly in a root with no subfolder). No code change.

### 3-4. New folder dialog (replaces `window.prompt`)

New file `src/presentation/newTab/views/NewFolderDialogView.js`, modeled on
`GroupDialogView.js`'s overlay + form + focus-trap pattern (self-contained
modal, no new dependency). Fields:

- **Name** — required text input, trimmed, non-empty (existing constraint,
  just moved off `prompt()`).
- **Parent** — a single `<select>`, grouped with `<optgroup>` per native root
  (Bookmarks Bar / Other Bookmarks / Mobile Bookmarks). Each optgroup's first
  option is "(top level)"; every existing folder under that root is listed
  beneath it, indented by depth (`—` repeated per level) so a folder at any
  nesting depth can be picked as the parent, not just direct root children.
  Defaults to Bookmarks Bar → "(top level)".

Opened from both existing call sites (`addColBtn`, `bottomNewBtn`) via
`_openNewFolderDialog()`, replacing the two `_promptCreateCollection()` calls.

### 5. Instant creation

On submit: resolve the selected option to a real `parentId` (the root's own
id — Chrome's fixed ids `"1"` Bookmarks Bar / `"2"` Other Bookmarks / `"3"`
Mobile Bookmarks — when "(top level)" is chosen, otherwise the picked
folder's id) and call `chrome.bookmarks.create({ title, parentId })`. On
success: close dialog, `toast.show(...)`, `this._load()` to re-render the
tree with the new folder visible immediately.

### 6. Live reflection

No new work required. `manifest.json` already grants the `bookmarks`
permission (used by the popup and this same file today), and
`BookmarkDeckView._bindBookmarkEvents()` already subscribes to
`chrome.bookmarks.onCreated/onRemoved/onChanged/onMoved/onChildrenReordered/onImportEnded`
(debounced) — any other surface (popup, `chrome://bookmarks`, another new
tab) already sees the new folder the moment it's created, and vice versa.

## Testing

Manual: load unpacked, open new tab, create a folder at top level and as a
nested subfolder from the dialog, confirm it appears in the sidebar
immediately and in `chrome://bookmarks` without a reload.

No new pure-logic surface worth a `node --test` unit (the only new logic is
resolving a `<select>` value to a `parentId`, trivial and DOM-coupled) —
consistent with the codebase's existing convention of not unit-testing
DOM-bound view classes (`GroupDialogView`, `IconPickerView`, etc. have no
dedicated test files either).
