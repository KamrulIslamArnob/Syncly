# Tree tab — hierarchical bookmark view

Date: 2026-07-19

## Amendment (2026-07-19, after review)

The flat-masonry approach below was built, then reverted on user feedback:
ten sibling folders became ten disconnected blocks and read as messy. Final
design is a **nested hierarchical tree** instead:

- `buildBookmarkTree()` keeps Chrome's real hierarchy (folders within folders);
  folders with no bookmark at any depth are pruned.
- Rendered with native `<details>/<summary>` — folders expand/collapse with zero
  custom JS, accessible by default. Expanded by default so everything is visible
  under its folder; state persisted per-folder (persistence suspended during
  search auto-expand). Indentation via nested `.tfolder-kids`.
- Bookmarks are `.tlink` rows (favicon + title), native `<a href>` (same-tab
  click, Ctrl/middle → new tab).
- Font: clean system stack (`Inter, system-ui, "Segoe UI", …`) — Inter is not
  bundled and MV3 CSP blocks Google Fonts, so this falls back to Segoe UI/
  system-ui; classic and readable. The stylish `Doto`/`Space Mono` display fonts
  are no longer used in the tree.
- `.bg-wash` corner/center radial gradients removed (read as veneer/shadow behind
  corner text) → flat OLED-black canvas.

Everything below this line describes the superseded flat-grid design, kept for
history.

---

Date: 2026-07-19
Surface: `src/presentation/newTab/views/TreeView.js` (+ `.tree` CSS in `newTab.css`)

## Problem

The tree tab is meant to be a full-screen, compact "total view" of the user's
real Chrome bookmarks so they can scan, click, and exit fast. Instead it renders
**only top-level folders** as blocks and, inside each, **only direct bookmark
children** as chips (`TreeView.js` `_renderBlock`: `children.filter(c => c.type === "bookmark")`).

Chrome's structure is `root → Bookmarks Bar / Other Bookmarks / Mobile → nested
folders → bookmarks`. Most bookmarks live in nested folders inside the Bookmarks
Bar, so the current view shows 2–3 giant blocks of loose bookmarks and silently
drops everything organised in folders. The recursive header count then disagrees
with what's on screen. It is not a tree — it is one flat level that hides most of
the collection.

## Decisions (locked with user)

- **Flatten**: walk the whole tree; every folder with ≥1 direct bookmark becomes
  its own block. Folders containing only subfolders are skipped (no empty blocks).
- **Order**: Chrome's own order, depth-first (Bookmarks Bar subtree, then Other,
  then Mobile).
- **Labels**: block title is the breadcrumb path, e.g. `Bookmarks Bar / Dev / React`.
  Top-level root → just its own name.
- **Layout**: blocks flow into a full-screen multi-column (masonry) grid, reusing
  existing `.block / .block-head / .chips / .chip` styles and the existing density
  variants (cozy/compact/dense) for the "compact total view".
- **Click**: chip is a native `<a href="url">`. Plain click → same tab (fast exit);
  Ctrl/⌘/middle-click → new tab (native, free). Removes the current
  `preventDefault + window.open`.
- **Unchanged**: search filter, Esc-to-exit, per-block collapse + persistence,
  loading skeleton, favicon loading, `isSafeUrl` gating of unsafe URLs.

## Model

`flattenBookmarks(roots)` → flat array of blocks:

```
{ id: string, path: string, bookmarks: [ { id, title, url|null } ] }
```

- `path` built from ancestor folder titles joined with " / ".
- `url` is `isSafeUrl(node.url)` (null → rendered as blocked, non-navigable chip).
- Blocks with zero bookmarks are omitted.

`filterBlocks(blocks, query)`:
- empty query → all blocks.
- else keep bookmarks whose title/url contains query; keep a block if it has any
  matching bookmark OR its path contains the query (then show all its bookmarks).

Both are pure and unit-checkable with no DOM.

## Rendering

- `_renderBody` iterates flat blocks, renders one `.block` each via `_renderBlock`.
- `.block-head`: `.idx` (sequential 01, 02…), `.name` = path, `.n` = bookmark
  count, collapse button (unchanged).
- `_renderChip`: `<a href=url>` when safe, else `href="#"` + blocked title; no JS
  click handler for navigation.
- Header count (`#tree-link-count`) = total bookmarks across shown blocks; now
  matches on-screen count.

## CSS

`.tree` switches from `flex-direction:column` to CSS multi-column
(`column-width` + `column-gap`) so blocks flow into responsive columns; `.block`
gets `break-inside:avoid`. `.tree.noresult` disables columns so the empty state
can center. Everything else reused.

## Out of scope (skipped, per user)

Expandable nested-hierarchy view; per-root column layout; size/alphabetical
ordering. Add later only if the flat grid proves too long.
