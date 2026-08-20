# Bookmark Folder Create Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `window.prompt`-based "new collection" flow with a real modal that lets the user name a new native bookmark folder and pick where it nests (any existing folder, at any depth, under any of Chrome's three roots) — and rename the sidebar section from "Collections" to "Bookmarks" throughout.

**Architecture:** One new pure helper (`flattenFoldersForPicker` in `TreeView.js`) turns the raw, unpruned `chrome.bookmarks.getTree()` output into per-root, depth-indented folder lists for a `<select>`. One new view class (`NewFolderDialogView`, modeled on the existing `GroupDialogView` overlay/form/focus pattern) renders the modal and calls `chrome.bookmarks.create()` directly — no domain/use-case layer involved, matching how the code being replaced already worked. `BookmarkDeckView` swaps its two "New collection" call sites over to open this dialog instead of `window.prompt`, and its "COLLECTIONS" section is relabeled "BOOKMARKS".

**Tech Stack:** Vanilla ES modules, `chrome.bookmarks` API, existing `el()` DOM helper (`src/presentation/shared/dom.js`), existing `icon()` helper (`src/presentation/shared/icons.js`), `node --test` for pure-logic tests.

## Global Constraints

- MV3 CSP: `script-src 'self'; style-src 'self' 'unsafe-inline'` — no inline scripts, no external JS/CSS/fonts. (See CLAUDE.md.)
- Never use `innerHTML` for content built from any variable data — `dom.js`'s `el()` helper is the required construction path (its own top comment: "NEVER uses innerHTML"). `GroupDialogView.js`'s close button uses a raw `innerHTML` SVG string — that is a pre-existing exception for a **hardcoded, non-variable** literal, not a pattern to extend; the new dialog's close button uses `icon("x")` instead.
- `manifest.json` already grants the `bookmarks` permission (confirmed at [manifest.json:23](../../../manifest.json)) — no manifest change needed.
- No build step, no bundler, no linter. Files run directly as ES modules from source.
- Follow the existing `GroupDialogView.js` overlay/show/hide/Escape-close pattern exactly (see below) — don't invent a different modal mechanism.
- Toast usage: `this.toast?.show(message)` / `this.toast?.show(message, { error: true })`.

---

### Task 1: `flattenFoldersForPicker` pure helper + test

**Files:**
- Modify: `src/presentation/newTab/views/TreeView.js` (add new exported function, after `buildBookmarkTree`, before `filterTree` — i.e. after the line currently reading `return top.map(node).filter(Boolean);` and its closing `}`)
- Test: `test/tree-view.test.mjs` (append new test cases at the end of the file)

**Interfaces:**
- Produces: `flattenFoldersForPicker(roots: unknown) => Array<{ rootId: string, rootTitle: string, options: Array<{ id: string, title: string, depth: number }> }>`
  - `roots` is raw `chrome.bookmarks.getTree()` output (same shape `buildBookmarkTree` accepts — either the single synthetic-root-wrapped array, or an already-unwrapped array of the three named roots).
  - Unlike `buildBookmarkTree`, **nothing is pruned** — folders with zero bookmarks anywhere inside them are still included, because a freshly created empty folder must be pickable as a parent for the next folder.
  - `depth` starts at `1` for a folder directly under a root, `2` for one level deeper, etc.
  - Order: depth-first, preserving each folder's native child order (same traversal order Chrome returns).

- [ ] **Step 1: Write the failing test**

Add to the end of `test/tree-view.test.mjs`:

```js
/* ── flattenFoldersForPicker (parent-folder select, empty folders kept) ── */
import { flattenFoldersForPicker } from "../src/presentation/newTab/views/TreeView.js";

const PICKER_TREE = [
  {
    id: "0",
    title: "",
    children: [
      {
        id: "1",
        title: "Bookmarks Bar",
        children: [
          {
            id: "10",
            title: "Marketing",
            children: [
              { id: "11", title: "Empty Sub", children: [] },
              { id: "12", title: "Leaf", url: "https://example.com" },
            ],
          },
          { id: "13", title: "Also Empty", children: [] },
        ],
      },
      { id: "2", title: "Other Bookmarks", children: [] },
      { id: "3", title: "Mobile Bookmarks", children: [] },
    ],
  },
];

test("flattenFoldersForPicker: unwraps synthetic root, one group per named root", () => {
  const groups = flattenFoldersForPicker(PICKER_TREE);
  assert.equal(groups.length, 3);
  assert.deepEqual(
    groups.map((g) => g.rootId),
    ["1", "2", "3"]
  );
  assert.deepEqual(
    groups.map((g) => g.rootTitle),
    ["Bookmarks Bar", "Other Bookmarks", "Mobile Bookmarks"]
  );
});

test("flattenFoldersForPicker: includes empty folders (unlike buildBookmarkTree)", () => {
  const groups = flattenFoldersForPicker(PICKER_TREE);
  const barOptions = groups[0].options;
  assert.deepEqual(
    barOptions.map((o) => o.id),
    ["10", "11", "13"]
  );
});

test("flattenFoldersForPicker: depth increases per nesting level, bookmarks excluded", () => {
  const groups = flattenFoldersForPicker(PICKER_TREE);
  const barOptions = groups[0].options;
  const marketing = barOptions.find((o) => o.id === "10");
  const emptySub = barOptions.find((o) => o.id === "11");
  const alsoEmpty = barOptions.find((o) => o.id === "13");
  assert.equal(marketing.depth, 1);
  assert.equal(emptySub.depth, 2);
  assert.equal(alsoEmpty.depth, 1);
  assert.equal(barOptions.some((o) => o.id === "12"), false); // "Leaf" is a bookmark, not a folder
});

test("flattenFoldersForPicker: empty/garbage input returns []", () => {
  assert.deepEqual(flattenFoldersForPicker([]), []);
  assert.deepEqual(flattenFoldersForPicker(null), []);
  assert.deepEqual(flattenFoldersForPicker(undefined), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `flattenFoldersForPicker is not a function` (or similar import error), since it doesn't exist yet.

- [ ] **Step 3: Implement the function**

In `src/presentation/newTab/views/TreeView.js`, insert immediately after `buildBookmarkTree`'s closing `}` (i.e. right before the `/**` doc comment for `filterTree`):

```js
/**
 * Flatten chrome.bookmarks.getTree() raw output into folder options for a
 * parent-folder picker, grouped by native root. Unlike buildBookmarkTree,
 * NOTHING is pruned — a folder with zero bookmarks anywhere inside it is
 * still listed, because a freshly created empty folder must be pickable as
 * the parent of the next one.
 * @param {unknown} roots - raw chrome.bookmarks.getTree() output
 * @returns {Array<{rootId: string, rootTitle: string, options: Array<{id: string, title: string, depth: number}>}>}
 */
export function flattenFoldersForPicker(roots) {
  const raw = Array.isArray(roots) ? roots : [];
  let top = raw;
  if (
    raw.length === 1 &&
    raw[0] &&
    typeof raw[0] === "object" &&
    (raw[0].id === "0" || raw[0].title === "") &&
    Array.isArray(raw[0].children)
  ) {
    top = raw[0].children;
  }

  const isFolderNode = (n) =>
    n && typeof n === "object" && !(typeof n.url === "string" && n.url.length > 0);

  const walk = (node, depth, out) => {
    if (!isFolderNode(node)) return;
    const title = typeof node.title === "string" && node.title.length > 0 ? node.title : "Folder";
    out.push({ id: String(node.id ?? title), title, depth });
    for (const child of Array.isArray(node.children) ? node.children : []) {
      walk(child, depth + 1, out);
    }
  };

  return top.filter(isFolderNode).map((root) => {
    const options = [];
    for (const child of Array.isArray(root.children) ? root.children : []) {
      walk(child, 1, options);
    }
    return {
      rootId: String(root.id ?? root.title ?? ""),
      rootTitle: typeof root.title === "string" && root.title.length > 0 ? root.title : "Folder",
      options,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all 4 new tests plus every pre-existing test in `test/tree-view.test.mjs` and the rest of the suite.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/newTab/views/TreeView.js test/tree-view.test.mjs
git commit -m "feat: add flattenFoldersForPicker helper for folder-parent select"
```

---

### Task 2: `NewFolderDialogView` component

**Files:**
- Create: `src/presentation/newTab/views/NewFolderDialogView.js`

**Interfaces:**
- Consumes: `flattenFoldersForPicker` from `../../newTab/views/TreeView.js` wait — same directory, so `./TreeView.js` (Task 1); `el` from `../../shared/dom.js`; `icon` from `../../shared/icons.js`; a `getTree` function `() => Promise<unknown>` and a `toast` object `{ show(message, opts?) }`, both passed into the constructor exactly like `GroupDialogView` already receives them.
- Produces: `class NewFolderDialogView { constructor({ getTree, toast }); open(): Promise<void>; onCreate: (() => void) | null; }` — `open()` fetches a fresh tree, renders, and shows the modal; setting `.onCreate` before calling `open()` registers the post-success callback (Task 4 wires this to `this._load()`).

- [ ] **Step 1: Write the component**

Create `src/presentation/newTab/views/NewFolderDialogView.js`:

```js
/* ============================================================
   NewFolderDialogView — Create-new-bookmark-folder dialog

   Replaces the old window.prompt("Enter new collection name:") flow.
   Lets the user name a new NATIVE chrome.bookmarks folder and pick
   where it nests: any existing folder, at any depth, under any of
   Chrome's three roots (Bookmarks Bar / Other Bookmarks / Mobile
   Bookmarks). Creates it immediately via chrome.bookmarks.create —
   every other surface (popup, chrome://bookmarks, another new tab)
   sees it the moment it's created via the existing
   chrome.bookmarks.onCreated listener in BookmarkDeckView.
   ============================================================ */

import { el } from "../../shared/dom.js";
import { icon } from "../../shared/icons.js";
import { flattenFoldersForPicker } from "./TreeView.js";

export class NewFolderDialogView {
  constructor({ getTree, toast } = {}) {
    this.getTree = typeof getTree === "function" ? getTree : () => chrome.bookmarks.getTree();
    this.toast = toast;

    this.root = null;
    this.overlay = null;
    this.dialog = null;
    this.nameInput = null;
    this.parentSelect = null;
    this.escHandler = null;

    /** Set by the caller (BookmarkDeckView) — called after a successful create. */
    this.onCreate = null;
  }

  /** Fetch a fresh tree, render, and show the dialog. */
  async open() {
    let raw = [];
    try {
      raw = await this.getTree();
    } catch {
      raw = [];
    }
    const groups = flattenFoldersForPicker(raw);
    this.render(groups);
    this.show();
  }

  render(groups) {
    if (this.root) this.root.remove();

    this.overlay = el("div", { className: "overlay" });
    this.dialog = el("div", { className: "dialog folder-dialog" });

    const header = el("div", { className: "folder-dialog-header" });
    const title = el("h2", {}, "New Folder");
    const closeBtn = el(
      "button",
      { type: "button", className: "folder-dialog-close", "aria-label": "Close" },
      icon("x")
    );
    closeBtn.addEventListener("click", () => this.hide());
    header.append(title, closeBtn);
    this.dialog.append(header);

    const form = el("form", { className: "folder-dialog-form" });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleCreate();
    });

    const nameField = el("div", { className: "field" });
    this.nameInput = el("input", {
      type: "text",
      placeholder: "e.g., Reading List",
      required: true,
      autofocus: true,
    });
    nameField.append(el("label", {}, "Folder Name"), this.nameInput);
    form.append(nameField);

    const parentField = el("div", { className: "field" });
    this.parentSelect = el("select", {});
    for (const group of groups) {
      const optgroup = el("optgroup", { label: group.rootTitle });
      optgroup.append(el("option", { value: group.rootId }, "(top level)"));
      for (const opt of group.options) {
        const prefix = "—".repeat(opt.depth) + " ";
        optgroup.append(el("option", { value: opt.id }, prefix + opt.title));
      }
      this.parentSelect.append(optgroup);
    }
    parentField.append(el("label", {}, "Location"), this.parentSelect);
    form.append(parentField);

    const actions = el("div", { className: "dialog-actions" });
    const cancelBtn = el("button", { type: "button", className: "btn" }, "Cancel");
    cancelBtn.addEventListener("click", () => this.hide());
    const createBtn = el("button", { type: "submit", className: "btn btn-primary" }, "Create Folder");
    actions.append(cancelBtn, createBtn);
    form.append(actions);

    this.dialog.append(form);
    this.overlay.append(this.dialog);
    this.root = this.overlay;

    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.hide();
    });

    this.escHandler = (e) => {
      if (e.key === "Escape") this.hide();
    };
    document.addEventListener("keydown", this.escHandler);
  }

  async handleCreate() {
    const title = this.nameInput.value.trim();
    if (!title) {
      this.toast?.show("Please enter a folder name", { error: true });
      return;
    }
    const parentId = this.parentSelect.value;

    try {
      await chrome.bookmarks.create({ title, parentId });
      this.toast?.show(`Folder "${title}" created`);
      if (this.onCreate) this.onCreate();
      this.hide();
    } catch (err) {
      this.toast?.show(err.message || "Could not create folder", { error: true });
    }
  }

  show() {
    document.body.append(this.root);
    this.root.offsetHeight; // reflow, so the is-open transition runs
    this.overlay.classList.add("is-open");
    this.nameInput?.focus();
  }

  hide() {
    if (this.overlay) {
      this.overlay.classList.remove("is-open");
      setTimeout(() => {
        if (this.root) this.root.remove();
      }, 180);
    }
    if (this.escHandler) document.removeEventListener("keydown", this.escHandler);
  }
}
```

- [ ] **Step 2: Manual smoke check (no unit test — DOM-bound view class)**

This class has no pure logic of its own (the pure part, `flattenFoldersForPicker`, is already tested in Task 1) — same convention as `GroupDialogView.js`/`IconPickerView.js`, neither of which has a dedicated test file. Verification happens end-to-end in Task 4's manual check. For now, confirm the file has no syntax errors:

Run: `node --check src/presentation/newTab/views/NewFolderDialogView.js`
Expected: no output (exit code 0).

- [ ] **Step 3: Commit**

```bash
git add src/presentation/newTab/views/NewFolderDialogView.js
git commit -m "feat: add NewFolderDialogView for creating bookmark folders"
```

---

### Task 3: Dialog CSS

**Files:**
- Modify: `src/presentation/newTab/newTab.css`

**Interfaces:**
- Consumes: existing generic tokens `--surface`, `--border-strong`, `--fg`, `--bg`, `--muted`, `--border`, `--radius-sm`, `--font-body`, `--font-mono`, `--dur`, `--ease` (already defined in `src/presentation/shared/styles/tokens.css`, used identically by the neighboring `.group-dialog*` rules).
- Produces: `.folder-dialog`, `.folder-dialog-header`, `.folder-dialog-header h2`, `.folder-dialog-close` (+ `:hover`, `svg`), `.folder-dialog-form` (mirrors `.group-dialog*` exactly, own class family so the two dialogs can diverge independently later); `.field select` (new — no select field exists in the codebase yet, `.field input` is the only styled form control today).

- [ ] **Step 1: Add the CSS**

In `src/presentation/newTab/newTab.css`, immediately after the existing `.group-dialog-form{...}` rule block (the one ending `gap:16px }` right before the `/* ── Group Profile Buttons ─────────────────────────────────── */` comment), insert:

```css
/* ── Folder Create Dialog ──────────────────────────────────── */
.folder-dialog{
  width:min(420px,100%);
  max-height:90vh;
  overflow-y:auto
}
.folder-dialog-header{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:16px
}
.folder-dialog-header h2{
  font-family:var(--font-body);
  font-size:18px;
  font-weight:500;
  letter-spacing:-.02em;
  margin:0
}
.folder-dialog-close{
  background:transparent;
  border:1px solid var(--border);
  color:var(--fg);
  border-radius:4px;
  padding:8px;
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:center;
  transition:border-color var(--dur) var(--ease)
}
.folder-dialog-close:hover{
  border-color:var(--border-strong)
}
.folder-dialog-close svg{
  width:14px;
  height:14px
}
.folder-dialog-form{
  display:flex;
  flex-direction:column;
  gap:16px
}
```

Also, right after the existing `.field input.is-error{...}` rule, insert a matching `select` rule so the new "Location" field looks consistent with the "Folder Name" input:

```css
.field select{height:40px;padding:0 12px;border-radius:var(--radius-sm);border:1px solid var(--border);background:oklch(100% 0 0 / .03);color:var(--fg);font-family:var(--font-body);font-size:14px;outline:none}
.field select:focus{border-color:oklch(100% 0 0 / .28)}
```

- [ ] **Step 2: Verify no CSS parse errors**

There's no CSS linter in this repo. Confirm visually instead, as part of Task 4's manual check (opening the dialog is the real test of whether the CSS is well-formed and applied).

- [ ] **Step 3: Commit**

```bash
git add src/presentation/newTab/newTab.css
git commit -m "style: add folder-create-dialog and select field styles"
```

---

### Task 4: Wire into `BookmarkDeckView` + rename "Collections" → "Bookmarks"

**Files:**
- Modify: `src/presentation/newTab/views/BookmarkDeckView.js`

**Interfaces:**
- Consumes: `NewFolderDialogView` from `./NewFolderDialogView.js` (Task 2) — `new NewFolderDialogView({ getTree, toast })`, `.onCreate = fn`, `.open()`.

- [ ] **Step 1: Import the new view**

At the top of `src/presentation/newTab/views/BookmarkDeckView.js`, after the existing `import { GroupDialogView } from "./GroupDialogView.js";` line, add:

```js
import { NewFolderDialogView } from "./NewFolderDialogView.js";
```

- [ ] **Step 2: Construct it in the constructor**

In the constructor, after this existing block:

```js
    this.groupDialog = new GroupDialogView({ useCases, getTree: this.getTree, toast });
    this.groupDialog.onSave = () => this._load();
    this.groupDialog.onDelete = () => this._load();
```

add:

```js

    this.newFolderDialog = new NewFolderDialogView({ getTree: this.getTree, toast });
    this.newFolderDialog.onCreate = () => this._load();
```

- [ ] **Step 3: Rename the sidebar aria-label**

Change:

```js
    this._sidebar = el("aside", { className: "raindrop-sidebar", "aria-label": "Collections Navigation" });
```

to:

```js
    this._sidebar = el("aside", { className: "raindrop-sidebar", "aria-label": "Bookmarks Navigation" });
```

- [ ] **Step 4: Rename the section header, buttons, and swap in the new dialog**

Replace this whole block (currently `_renderSidebar`'s middle section):

```js
    const addColBtn = el("button", {
      type: "button",
      className: "raindrop-add-col-btn",
      title: "Add Collection",
      "aria-label": "Add Collection",
    }, icon("plus"));
    addColBtn.addEventListener("click", () => this._promptCreateCollection());

    const sectionHeader = el("div", { className: "raindrop-section-header" },
      el("span", { className: "raindrop-section-title" }, "COLLECTIONS"),
      addColBtn
    );

    const treeContainer = el("div", { className: "raindrop-tree-container" });
    for (const folder of this._folders) {
      treeContainer.appendChild(this._renderTreeNode(folder, 0));
    }

    const bottomNewBtn = el("button", {
      type: "button",
      className: "raindrop-bottom-new-btn",
      title: "Create new collection",
    },
      icon("plus"),
      el("span", {}, "New collection...")
    );
    bottomNewBtn.addEventListener("click", () => this._promptCreateCollection());
```

with:

```js
    const addColBtn = el("button", {
      type: "button",
      className: "raindrop-add-col-btn",
      title: "Add Bookmark Folder",
      "aria-label": "Add Bookmark Folder",
    }, icon("plus"));
    addColBtn.addEventListener("click", () => this._openNewFolderDialog());

    const sectionHeader = el("div", { className: "raindrop-section-header" },
      el("span", { className: "raindrop-section-title" }, "BOOKMARKS"),
      addColBtn
    );

    const treeContainer = el("div", { className: "raindrop-tree-container" });
    for (const folder of this._folders) {
      treeContainer.appendChild(this._renderTreeNode(folder, 0));
    }

    const bottomNewBtn = el("button", {
      type: "button",
      className: "raindrop-bottom-new-btn",
      title: "Create new folder",
    },
      icon("plus"),
      el("span", {}, "New folder...")
    );
    bottomNewBtn.addEventListener("click", () => this._openNewFolderDialog());
```

- [ ] **Step 5: Replace `_promptCreateCollection` with `_openNewFolderDialog`**

Replace:

```js
  async _promptCreateCollection() {
    const name = window.prompt("Enter new collection name:");
    if (!name || !name.trim()) return;
    const cleanName = name.trim();
    if (typeof chrome !== "undefined" && chrome.bookmarks?.create) {
      try {
        await chrome.bookmarks.create({ title: cleanName });
        this.toast?.show(`Collection "${cleanName}" created!`);
        await this._load();
      } catch (err) {
        this.toast?.show(err.message || "Could not create collection", { error: true });
      }
    }
  }
```

with:

```js
  _openNewFolderDialog() {
    this.newFolderDialog.open();
  }
```

- [ ] **Step 6: Fix the stale "collections tree" phrase in this file's own header comment**

The module doc comment at the top of the file (lines 9-17) describes the sidebar as having a "collections tree" — stale now that the section is labeled "Bookmarks". Change:

```js
   Two-pane workspace over the user's REAL chrome.bookmarks (not the
   app's old curated-shortcuts domain model): a sidebar (workspace
   switcher + smart filters + collections tree) and a main pane
```

to:

```js
   Two-pane workspace over the user's REAL chrome.bookmarks (not the
   app's old curated-shortcuts domain model): a sidebar (workspace
   switcher + smart filters + native bookmarks/folder tree) and a main pane
```

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS — same suite as Task 1's Step 4, confirming this refactor didn't break `deck-view.test.mjs`'s existing coverage of `flattenLeaves`/`collectFolders`/`rankByUsage` (those functions are untouched, but this catches any accidental syntax/import break in the file).

- [ ] **Step 8: Commit**

```bash
git add src/presentation/newTab/views/BookmarkDeckView.js
git commit -m "feat: replace prompt-based collection creation with folder dialog, rename Collections to Bookmarks"
```

---

### Task 5: Update stale "collections tree" wording in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (repo root)

- [ ] **Step 1: Fix the phrase**

In the `## Project` section's opening paragraph, change:

```
The new tab is a two-pane **bookmark manager** over the user's real Chrome bookmarks: sidebar (workspace switcher + smart filters + collections tree) and a searchable card grid.
```

to:

```
The new tab is a two-pane **bookmark manager** over the user's real Chrome bookmarks: sidebar (workspace switcher + smart filters + native bookmarks/folder tree) and a searchable card grid.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: fix stale 'collections tree' wording after Bookmarks section rename"
```

---

### Task 6: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Load the unpacked extension**

Open `chrome://extensions`, enable Developer mode, "Load unpacked" on the repo root (or if already loaded, click the reload icon on the extension card — this change touches a `views/*.js` file and `newTab.css` only, no `manifest.json`/service-worker change, so a plain new-tab refresh is enough after the first load).

- [ ] **Step 2: Verify the rename**

Open a new tab. Confirm the sidebar section that used to read "COLLECTIONS" now reads "BOOKMARKS", and the `+` button's tooltip reads "Add Bookmark Folder".

- [ ] **Step 3: Create a top-level folder via the dialog**

Click "+ New folder..." at the bottom of the sidebar (or the `+` in the section header). Confirm a real modal appears (not a browser `prompt()`), with a "Folder Name" input and a "Location" dropdown showing `<optgroup>`s for Bookmarks Bar / Other Bookmarks / Mobile Bookmarks. Type a name (e.g. `Test Folder A`), leave Location on "Bookmarks Bar → (top level)", click "Create Folder". Confirm: the modal closes, a success toast appears, and `Test Folder A` appears immediately in the sidebar's Bookmarks section.

- [ ] **Step 4: Create a nested folder**

Open the dialog again. Set Location to the nested option for the folder just created (`— Test Folder A` under the Bookmarks Bar optgroup). Name it `Test Folder B`, create it. Confirm it appears nested under `Test Folder A` in the sidebar tree (expand the parent's caret to see it).

- [ ] **Step 5: Verify live cross-surface reflection**

With the new tab still open, open `chrome://bookmarks` in another tab. Confirm both `Test Folder A` and `Test Folder B` (nested inside it) are present. Rename `Test Folder A` from `chrome://bookmarks`. Switch back to the new-tab page without reloading it — confirm the sidebar label updates on its own (via the existing `chrome.bookmarks.onChanged` listener in `_bindBookmarkEvents`).

- [ ] **Step 6: Clean up test folders**

Delete `Test Folder A` (and its nested `Test Folder B`) via `chrome://bookmarks`, confirming the new tab's sidebar drops them live too.

- [ ] **Step 7: Final full test run**

Run: `npm test`
Expected: PASS, full suite green.
