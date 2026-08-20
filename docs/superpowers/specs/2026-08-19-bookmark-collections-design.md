# Bookmark Collections — Design Spec

Date: 2026-08-19
Status: **SUPERSEDED 2026-08-20** — user reviewed the actual running UI and
reversed the "collection ≠ folder" direction this spec was built on. See
[2026-08-20-bookmark-folder-create-dialog-design.md](2026-08-20-bookmark-folder-create-dialog-design.md)
for what's actually being built instead. Left in place for history, not
implemented.

## Problem

The new-tab sidebar has a "Collections" section, but "creating a collection"
today just calls `chrome.bookmarks.create({ title })` via a raw
`window.prompt("Enter new collection name:")` — it makes a real, empty native
Chrome bookmark folder ([BookmarkDeckView.js:714-727](../../../src/presentation/newTab/views/BookmarkDeckView.js)).
Two problems:

1. The creation UI is an unstyled browser `prompt()` dialog.
2. The underlying concept is wrong. A "collection" is not a folder. The user
   wants to hand-pick existing bookmarks (wherever they physically live) into
   a named, personally curated set, and then subdivide that set with
   self-defined hashtag-style categories (e.g. collection "Design" containing
   categories "Resources", "Gradient tools", "Font").

## Scope

In scope: new-tab sidebar (create/rename/delete a collection), a collection
detail view (member grid + category chip bar), a per-card "add to
collection(s)" picker, a per-card "assign categories" picker (only while
viewing a collection), drag-and-drop onto a collection.

Out of scope (deliberate, deferred): the popup's quick-add flow keeps saving
straight to native `chrome.bookmarks` unchanged — no collection picker there
yet. The popup's own "Workspace"/"Collections" UI already means *native
folders*, a pre-existing naming clash this change does not touch or fix.

## Data model

New domain entity `BookmarkCollection` (`src/domain/entities/BookmarkCollection.js`),
same shape/validation style as `BookmarkGroup`:

```js
{
  id,                 // crypto.randomUUID()
  name,               // 1-50 chars, trimmed, required
  icon,               // from a fixed allowed-icon list (own copy, NOT imported
                       // from IconPickerView.js — that's a presentation-layer
                       // file; domain must not import outward. Same reason
                       // BookmarkGroup.validateIcon() already hardcodes its
                       // own copy of the list instead of importing it.)
  bookmarkIds,         // string[] — native chrome bookmark ids that are members.
                       // Reference only. Never mutates the bookmark or its
                       // folder. A bookmark can belong to many collections.
  categories,          // string[] — hashtag names defined on THIS collection.
                       // 1-30 chars each, case-insensitive unique within the
                       // collection, max 30 categories per collection.
  categoryAssignments, // { [bookmarkId]: string[] } — subset of `categories`
                       // assigned to each member bookmark, scoped to this
                       // collection only. Same hashtag name in a different
                       // collection is an unrelated entry.
  createdAt, updatedAt,
}
```

Entity methods: `addBookmark(id)` / `removeBookmark(id)` (idempotent),
`addCategory(name)` / `removeCategory(name)` (removing strips the name from
every bookmark's `categoryAssignments` too), `setBookmarkCategories(bookmarkId, categories)`
(validates each name, auto-registers any new ones via `addCategory`, and
auto-calls `addBookmark` — checking a category box on a card is sufficient to
join the collection, no separate "add" step needed).

### Infrastructure

`ChromeBookmarkCollectionRepository` (`src/infrastructure/repositories/`),
storage key `bookmarkCollections`, identical CRUD shape to
`ChromeBookmarkGroupRepository` (`load/save/delete/findAll/findById/clearCache`,
array of `toJSON()`'d entities in `chrome.storage.local`).

Add `bookmarkCollections: "array"` to `backupAllowlist.js` so it's included in
both backup mechanisms.

### Use cases (`src/application/useCases/collections/`, one class per use case)

1. `CreateBookmarkCollection` — `{ name, icon }`
2. `UpdateBookmarkCollection` — `{ id, name, icon }` (rename/re-icon)
3. `DeleteBookmarkCollection` — `{ id }`
4. `ListBookmarkCollections` — `()`
5. `AddBookmarkToCollection` — `{ collectionId, bookmarkId }`
6. `RemoveBookmarkFromCollection` — `{ collectionId, bookmarkId }`
7. `SetBookmarkCategories` — `{ collectionId, bookmarkId, categories }` (full
   replace for that bookmark within that collection)
8. `AddCategoryToCollection` — `{ collectionId, name }` (explicit, 0-member
   category creation from the chip-bar `+`)
9. `DeleteCategoryFromCollection` — `{ collectionId, name }`

Every mutating use case sanitizes via the sanitizer port, persists, and emits
`bookmarkCollections:changed` on the `EventBus` — the standard data-change
flow (see CLAUDE.md). Wire all 9 + the repo into `container.js` next to the
existing `bookmarkGroups`/`bookmarkTags` block, including a
`chrome.storage.onChanged` cache-invalidation + re-emit entry.

## Sidebar / navigation

Sidebar order becomes:

```
[Smart filters]   All Bookmarks / Unsorted / Favorites        ← unchanged
[Collections]     + New Collection, then user's collections    ← NEW meaning
[Folders]         native chrome.bookmarks tree                 ← same tree,
                                                                    renamed label
```

**Workspace switcher un-mounts from the new tab.** `GroupProfileButtonsView`
and `GroupDialogView` stop being constructed/rendered by `BookmarkDeckView`
(constructor no longer builds `this.groupButtons`/`this.groupDialog`;
`renderInto`/`_load` drop the `_workspaceSlot` element and the
`activeGroup`-scoping branch — `this._folders` becomes unconditionally
`collectFolders(this._roots)`). Per the repo's established convention (see
CLAUDE.md "What changed"), the files themselves are **not deleted** — just no
longer wired into `newTabController.js`. `BookmarkGroup`, its 4 use cases,
`ChromeBookmarkGroupRepository`, and their `container.js` wiring are left
completely untouched, because **`popupController.js`'s own "Workspace"
dropdown depends on `listBookmarkGroups`/`setActiveGroup` and keeps working
unchanged** — confirmed by reading `popupController.js`; this is not
incidental, it's the reason nothing in that stack gets deleted.

New `CollectionsSidebarView.js` (new file, composition pattern mirrors
`GroupProfileButtonsView`): renders the Collections section — "+ New
Collection" opens `CollectionDialogView.js` (new file, modeled on
`GroupDialogView.js` with the folder-selector step removed — just a name
input + the existing `IconPickerView`, reused as-is). Each collection row:
icon + name + member count, click sets
`this._activeSelection = { type: "collection", id, title, collection }`
(extends the existing `_activeSelection.type` union), a drop target (mirrors
`_bindFolderDropTarget` but calls `AddBookmarkToCollection` instead of
`chrome.bookmarks.move` — adds a reference, does not relocate the bookmark).
Row delete uses a plain `confirm()` — deleting a collection never touches the
underlying bookmarks, so it doesn't warrant the typed-name confirmation
`GroupDialogView` uses for its higher-stakes folder-scoped delete.

## Collection detail view

When `_activeSelection.type === "collection"`, the content pool is every leaf
whose id is in `collection.bookmarkIds` (filtered from the existing full leaf
list — works regardless of which folder a member bookmark physically lives
in, matching "I add a bookmark wherever I want and it still shows up").

Header gets a **category chip bar**, in the same slot/style as today's tag
bar: `#all` chip + one chip per `collection.categories`, plus a trailing `+`
chip. Clicking `+` turns it into an inline text input (Enter commits via
`AddCategoryToCollection`, Escape cancels) — no `window.prompt` anywhere in
this feature, including collection creation/rename (handled by
`CollectionDialogView`'s proper form) and category creation (this inline
chip-input).

Two new popovers, implemented once as a generic, reusable
`ChipPickerPopoverView.js` (checkbox list of togglable string chips + its own
inline "+ new" input), instantiated twice:

1. **Every card, every view** — new icon beside the existing tag-edit icon:
   "Add to collection(s)". Checklist of all collections; toggling a box calls
   `AddBookmarkToCollection`/`RemoveBookmarkFromCollection`.
2. **Every card, only while a collection is active** — "Categories".
   Checklist of `collection.categories`; toggling calls `SetBookmarkCategories`
   with the updated full set for that bookmark in that collection.

Drag-and-drop: the existing `_drag` state (already used for card-to-card
reorder and card-to-folder move) extends to sidebar collection rows using the
same drop-target wiring pattern as `_bindFolderDropTarget`, calling
`AddBookmarkToCollection` instead of `chrome.bookmarks.move`.

## Non-goals / explicitly deferred

- Popup quick-add collection picker (natural fast-follow, not blocking).
- Fixing the popup's own pre-existing "Collections" = folders naming clash.
- Cross-collection bookmark ordering/drag-reorder within a collection (out of
  scope; the existing same-folder reorder-by-index logic doesn't apply since
  collection membership has no native index).
- A cap on the number of collections (unlike the 10-group cap on
  `BookmarkGroup`) — arrays are cheap and there's no stated need for a limit.

## Testing

`test/bookmark-collections.test.mjs` (pure Node, `node --test`, following the
existing mock pattern other repo tests use for `chrome.storage.local`):
entity validation (name/icon/category limits, dedupe), repository CRUD
round-trip, and the auto-registration/auto-membership behavior of
`setBookmarkCategories`.

## Docs

Update CLAUDE.md: note the workspace switcher's un-mounting (add it to the
existing "What changed" style list) and document the new Collections feature
in the architecture section (entity, repo, events, storage key).
