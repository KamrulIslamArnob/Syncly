# Quickie / Collections Navigation Restructure — Design Spec

Date: 2026-08-20
Status: Approved, pending implementation plan

Related specs:
- [2026-08-19-bookmark-collections-design.md](2026-08-19-bookmark-collections-design.md) —
  proposed the same "Collections = curated bundle of existing bookmarks,
  decoupled from folders" idea, then got superseded same day.
- [2026-08-20-bookmark-folder-create-dialog-design.md](2026-08-20-bookmark-folder-create-dialog-design.md) —
  the supersession: sidebar's `COLLECTIONS` tree section stays **folder**-based,
  just renamed `BOOKMARKS`, plus a proper new-folder dialog (parent picker)
  replacing `window.prompt`. **Approved, not yet implemented. Explicitly kept
  separate from this spec** (confirmed with user) — implement it as its own
  follow-up, unrelated to the work below.
- This spec does not reverse that decision — it reuses the exact same
  `BOOKMARKS` rename for the folder tree, and introduces the curated-bundle
  concept from 08-19 at a *different* mounting point (the old Favorites nav
  slot) instead of replacing the folder tree. The two specs are compatible.

## Problem

Three concepts are currently conflated in the sidebar:

1. **Capturing** a bookmark while browsing (today: the popup's full form,
   which asks for a Workspace + folder + tags before it will save anything —
   friction on every single save).
2. **Browsing/searching** the full bookmark library (today: "All Bookmarks",
   already close, just grid-default and not metadata-dense).
3. **Intentionally grouping** existing bookmarks into a named set (today:
   nothing — "Favorites" is a usage-count ranking, not a real grouping
   feature; the sidebar's "Collections" label actually means *native folder*).

The user wants these pulled apart into three explicit, separately-named
concepts — **capture now, organize later, group intentionally** — with the
terminology and data model to match.

## Concepts

- **Quickie** — a temporary inbox. One click from the popup captures the
  current page with zero decisions (no folder, no tags, no collection). Sits
  there until the user chooses to move it out.
- **All Bookmarks** — the complete, searchable library. Unchanged in spirit,
  gets denser by default.
- **Collections** — an intentional, named bundle of hand-picked *existing*
  bookmarks (e.g. "AI Research", "Job Hunting"). A bookmark can belong to
  several Collections at once; membership is a reference, not a move.

Non-goals: Quickie is not a permanent home, Collections are not a type of
bookmark, saving is never gated on an organizational decision.

## Data model

### Quickie — no new entity

A real native Chrome folder, not a side-table flag — so "move it out later"
is a plain `chrome.bookmarks.move` (already built for card drag-and-drop) and
the folder is visible in Chrome's own bookmark manager too.

New `EnsureQuickieFolderUseCase` (`src/application/useCases/bookmarks/`):
- `execute()` → returns the Quickie folder's native id.
- Reads `quickieFolderId` from `chrome.storage.local`. If unset, or the id no
  longer exists in a live `chrome.bookmarks.getTree()` call (user deleted it
  via Chrome's own manager), creates a new folder titled `"Quickie"` under
  the `"Other Bookmarks"` root (native id `"2"`) and persists the new id.
- Registered in `container.js`, shared by both `newTabController.js` (called
  once at init, before mounting the deck) and `popupController.js` (called
  on popup open, so the Quickie button always has a live target).

### One-time migration

Same use case also runs a guarded migration: if `chrome.storage.local` key
`quickieMigrated` is not `true`, move every bookmark currently sitting loose
at root (the same set `BookmarkDeckView` computes today as `_looseLeaves`)
into the newly-ensured Quickie folder via `chrome.bookmarks.move`, then set
the flag. Runs exactly once, ever, even for a user with zero loose bookmarks
(the folder still gets created eagerly).

### Collections — new side-table entity

Same pattern as `ChromeBookmarkTagRepository`/`ChromeBookmarkGroupRepository`:

```
ChromeBookmarkCollectionRepository — src/infrastructure/repositories/
storage key "bookmarkCollections"
{ [collectionId]: { id, name, bookmarkIds: string[], createdAt } }
```

Use cases (`src/application/useCases/collections/`):
1. `ListBookmarkCollectionsUseCase` — `execute()` → all collections.
2. `CreateBookmarkCollectionUseCase` — `{ name, bookmarkIds }` → validates
   name (1-50 chars, trimmed, required), dedupes `bookmarkIds`, generates id,
   persists, emits.
3. `UpdateCollectionMembersUseCase` — `{ collectionId, add?: string[],
   remove?: string[] }` → single use case for both "add bookmark(s) to
   collection" and "remove bookmark from collection" (ponytail: one mutator,
   not two near-identical use cases).
4. `DeleteBookmarkCollectionUseCase` — `{ collectionId }`.

Every mutating use case sanitizes the name via the sanitizer port, persists,
and emits `bookmarkCollections:changed` on the `EventBus` — the standard
data-change flow. Wire repo + all 4 use cases into `container.js`, including
a `chrome.storage.onChanged` cache-invalidation entry for
`bookmarkCollections`. Add `bookmarkCollections: "object"` to
`backupAllowlist.js`.

A Collection never mutates the underlying bookmark or its real folder —
membership is `bookmarkIds` references only, resolved at render time against
the **full unscoped tree** (`flattenLeaves(collectFolders(this._roots))`),
not the active-workspace-scoped `_leaves` — a Collection is a deliberate
cross-cutting bundle and should show fully regardless of which workspace
filter happens to be active. Stale ids (bookmark since deleted) are filtered
out at render (`map` + `filter(Boolean)`), not actively pruned from storage
— pruned lazily next time the collection's membership is edited.

## Sidebar restructure

```
[Workspace switcher]                          ← unchanged, untouched
[Quick nav]  All Bookmarks · Quickie · Collections
[Quickbar]   top-4 folder shortcuts            ← unchanged (just shipped)
BOOKMARKS    native folder tree                ← same tree, renamed label
                                                   (matches the already-
                                                   approved 08-20 rename)
```

- **All Bookmarks** — unchanged.
- **Unsorted → Quickie** — icon stays `inbox`. Pool is no longer "every loose
  root bookmark" — it's the fixed Quickie folder's contents, same code path
  as any folder view (just a fixed target instead of a picked one).
- **Favorites → Collections** — icon `layers`. Clicking it does not show a
  bookmark pool directly; it shows a **Collections index** (see below).

### `_activeSelection.type` changes

Drop `"unsorted"`, `"favorites"`. Add:
- `"quickie"` — folder-backed, fixed id, same rendering path as `"folder"`.
- `"collections"` — renders the Collections index grid, not a bookmark pool.
- `"collection"` — a single collection's resolved bookmark pool, `id` =
  collectionId.

## All Bookmarks — density

`_viewMode` default flips from `"grid"` to `"list"` (one-line change,
`this._viewMode = "list"` in the constructor). Cards already carry the
folder-path breadcrumb and tag pills in their DOM regardless of view mode —
confirm during implementation that list/compact CSS doesn't hide either
(likely already fine, `_renderCard`'s DOM structure is view-mode agnostic;
only the CSS re-flows).

## Multi-select → Create Collection

New "Select" toggle button in the header (next to the existing view switch).
While active:
- Every card shows a checkbox overlay; clicking a card toggles membership in
  `this._selectedIds` (a `Set`) instead of opening the URL.
- Dragging is disabled on cards while select mode is active (avoids a
  conflicting gesture — deliberate v1 cut, not a bug).
- A bulk action bar appears (fixed position, same treatment as the existing
  `.resume-backup-btn`): `"N selected · Add to Collection ▾ · Cancel"`.
- "Add to Collection" opens a small dropdown: pick an existing collection, or
  `"New Collection..."` (a `window.prompt` for the name — consistent with
  the existing `_promptCreateCollection`-style native-folder creation, not a
  new dialog component). Confirms via `createBookmarkCollection` or
  `updateCollectionMembers`, then clears selection, exits select mode, toasts.

## Collections index + detail view

`_activeSelection.type === "collections"` renders a grid of lightweight
collection cards (name, member count, a small favicon cluster preview — no
new component needed, reuse the `.raindrop-quick-tile` treatment). Clicking
one sets `_activeSelection = { type: "collection", id, title }`.

`_activeSelection.type === "collection"` resolves its pool via a new small
pure helper (exported, testable, same convention as `rankByUsage`):

```js
export function resolveCollectionLeaves(bookmarkIds, leafIndex) {
  return bookmarkIds.map((id) => leafIndex.get(id)).filter(Boolean);
}
```

`leafIndex` is a `Map<id, leaf>` built once per `_load()` from the full
unscoped leaf list. While viewing a collection, every card gets a "remove
from collection" button (same prompt-button visual pattern as the existing
tag-edit button) calling `updateCollectionMembers({ collectionId, remove:
[bookmark.id] })`.

Each collection index card gets a simple rename/delete affordance — reuse
the existing `window.prompt`/`window.confirm` pattern for v1, consistent
with the rest of this feature's low-ceremony interactions (no new dialog
component).

## Popup redesign

- Primary action: a large **"⚡ Save to Quickie"** button at the top. Click →
  `EnsureQuickieFolderUseCase.execute()` → `chrome.bookmarks.create({
  parentId: quickieFolderId, title, url })` → close the popup immediately.
  No form, no wait, no tag prompt at capture time — tags/organizing happen
  later, inside Quickie.
- Below it, a collapsed disclosure — **"Save to a specific folder instead ▾"**
  — reveals the existing full form (Workspace select, folder picker, tags)
  for the power-user path who already knows where something belongs. Mostly
  unchanged from the current `popupController.js`, just gated behind the
  toggle and no longer the default/only path.
- The existing folder-picker select (currently mislabeled "Collection" in
  the popup) gets relabeled **"Folder"** — it picks a native folder, which
  under the new vocabulary is not the same thing as a Collection. Adding
  straight to a Collection from the popup is a deliberate v1 cut (do it
  later via drag-out-of-Quickie or the multi-select → Create Collection flow
  instead); the popup's advanced form does not gain a Collection picker.

## Error handling / edge cases

- Quickie folder deleted via Chrome's own bookmark manager mid-session — the
  existing `chrome.bookmarks.onRemoved` listener (already wired, debounced)
  triggers `_load()`, which re-runs `EnsureQuickieFolderUseCase` and
  re-creates it if the stored id 404s, persisting the new id.
- Collection referencing a deleted bookmark — filtered out at render
  (`resolveCollectionLeaves`), left in storage until the collection is next
  edited (harmless stale reference, avoids a write on every unrelated
  deletion elsewhere in the tree).
- Migration is idempotent (`quickieMigrated` flag) and runs at most once.

## Testing

- `resolveCollectionLeaves` — new pure function, unit-tested in
  `test/deck-view.test.mjs` alongside `rankByUsage`/`collectFolders`
  (empty bundle, stale id filtered, order preserved).
- Manual click-through (per repo convention — no Chrome-dependent
  integration harness): popup "Save to Quickie" round-trip into the real
  folder; drag a card out of Quickie into a Bookmarks folder; multi-select →
  Create Collection → collection shows the right members; migration runs
  exactly once (verify the flag, re-load and confirm no duplicate move).

## Docs

Update `CLAUDE.md`: document the Quickie folder + migration, the Collections
entity (repo, use cases, storage key, event), and the sidebar terminology
change, in the same style as the existing "What changed" section.
