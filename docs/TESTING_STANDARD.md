# Testing Standard — Syncly (Chrome MV3, Vanilla JS, No Build)

> Canonical testing contract for the Syncly extension. All contributors and code-generation agents must follow this standard when adding or modifying tests.

## 1. Scope & Principles

1. **No build, no framework** — tests run with Node's built-in runner (`node --test`), ES modules, `node:assert/strict`. Zero extra test dependencies are added to `package.json`. The only devDependency is `puppeteer-core` for the optional `npm run smoke` (Chrome + shim, not part of unit gate).
2. **Strict Clean Architecture compliance** — tests mirror the layering: `domain/` (pure, no mocks), `application/` (ports mocked), `infrastructure/` (storage mocked), `presentation/helpers` (pure functions only; DOM views via manual `document` shim if needed).
3. **Deterministic & zero-flake** — no real `chrome.*`, `fetch`, `Date.now` randomness, or filesystem I/O in unit tests. Every external dependency is injected via ports/storage stubs. Timers are mocked or frozen (`Date.now` stubbed where needed).
4. **Security-first assertions** — every user-input path must assert sanitizer output and that dangerous schemes (`javascript:`, `data:text/html`, etc.) are rejected or stripped.
5. **Evidence before synthesis** — tests assert observable behaviour (returned value, thrown error, emitted event, persisted JSON), not implementation internals.

## 2. Test Runner & Layout

```
test/
  *.test.mjs              # node:test discovers every *.test.mjs (recursive via node --test)
  fixtures/
    old-backup.json       # legacy backup shape for compat tests
  helpers/
    mockStorage.js        # shared MemoryStorage / EventBus helpers (optional)
```

**Commands**

| Command | What it does | When to use |
|---------|--------------|-------------|
| `npm test` / `node --test` | Runs all `test/*.test.mjs` | CI gate, pre-commit, after any code change |
| `npm run smoke` | Puppeteer + `chrome.storage` shim, real HTTP | Manual smoke only (requires Chrome); not a CI gate |
| `node --test test/<file>.test.mjs` | Single file | Focused debugging |

**File naming**

- `test/<area>-<concern>.test.mjs` (kebab-case). Examples: `domain-value-objects.test.mjs`, `repositories.test.mjs`, `application-use-cases.test.mjs`, `security.test.mjs`.
- One file per architectural concern; group related use cases together if they share stubs.

## 3. Test Pyramid for this Repo

```
           ┌─────────────┐
           │  E2E / Smoke │  Puppeteer + shim (manual, ~5 scenarios: bootstrap, search, tags, collections, group switch)
           ├─────────────┤
           │ Integration  │  UseCase + real repo + MemoryStorage + EventBus (no Chrome) — ~30% of tests
           ├─────────────┤
           │   Domain     │  Entities/VOs/Services pure logic — ~40% of tests
           ├─────────────┤
           │  Helpers/    │  Sanitizers, Tree builders, favicon, color utils — ~30%
           └─────────────┘
Unit tests (domain + helpers) must never import `chrome` or DOM.
```

**Coverage targets (measured by logical branches, not line-count tooling)**

- Domain entities & VOs: **100%** of validation branches (every `throw` path has a test)
- Security ports (`BasicSanitizer`, `cssSanitizer`, `Url` VO): **100%**
- Use cases: **≥90%** — happy path + error path + event emission
- Repositories: **≥85%** — cache, invalidation, corrupted-row resilience
- Presentation helpers (`TreeView`, `BookmarkDeckView` helpers, `OmniSearchIndex`): **≥80%**

## 4. Style & Conventions

```js
import test from "node:test";               // or { describe, it } from "node:test"
import assert from "node:assert/strict";

test("Bookmark entity: rename trims and rejects empty", () => {
  // Arrange
  const bm = new Bookmark({ id: new Id("b1"), title: "GitHub", url: new Url("https://github.com"), categoryId: new Id("c1") });
  // Act & Assert
  assert.throws(() => bm.rename("   "), /non-empty/);
  bm.rename("  GitLab  ");
  assert.equal(bm.title, "GitLab");
});

describe("Url VO", () => { it("rejects javascript:", () => { ... }); });
```

**Rules**

- Use `assert.equal / deepEqual / throws / doesNotThrow / ok` only. No custom assert wrappers.
- Test name format: `"<Unit>: <behaviour> — <expectation>"` — searchable via `grep`.
- Prefer `test()` for flat suites; use `describe/it` only when grouping 3+ related cases.
- One assertion theme per `test()` (may have 3–5 related asserts, but all about the same behaviour).
- Never `innerHTML` in tests; construct DOM via `el()` helper or minimal shim if a view is under test.
- Mock `Date.now` by saving/restoring `const orig = Date.now; Date.now = () => 1700000000000; ... Date.now = orig;`.

## 5. Mocking & Test Doubles

**MemoryStorage (canonical stub)**

```js
function createMemoryStorage(initial = {}) {
  const store = { ...initial };
  return {
    async get(key) {
      if (typeof key === "string") return { [key]: store[key] };
      if (Array.isArray(key)) { const out = {}; for (const k of key) out[k] = store[k]; return out; }
      return { ...store };
    },
    async set(items) { Object.assign(store, items); },
    async remove(k) { const ks = Array.isArray(k) ? k : [k]; for (const x of ks) delete store[x]; },
    raw: store,
  };
}
class MemoryStorageArea { /* same as above for sync/local split */ }
```

**Chrome bookmarks mock (for EnsureQuickieFolderUseCase, deck helpers)**

```js
const bookmarksMock = {
  getTree: async () => fakeTree,
  create: async ({ parentId, title }) => ({ id: "q-1", parentId, title }),
  move: async (id, { parentId }) => moved.push({ id, parentId }),
};
```

**EventBus spy**

```js
const events = new EventBus(); const emitted = [];
events.on("bookmarks:changed", (p) => emitted.push(p));
```

**IdGenerator & Sanitizer stubs**

```js
const ids = { next: () => `id-${seq++}`, generate: () => `id-${seq++}` }; // Chrome: UuidGenerator uses crypto.randomUUID()
const sanitizer = new BasicSanitizer();
```

**Do NOT**

- Import real `ChromeStorageClient` in unit tests (it requires `global.chrome`). Use the `createMemoryStorage` shape and inject into repos that accept `{ storage }` or `new BaseChromeListRepository(stub, key, fromJSON)`.
- Call `fetch` or `indexedDB` in unit tests. Stub them.

## 6. What Must Be Tested (Checklist)

### 6.1 Domain

- **Entities** (`Bookmark`, `Category`, `Subfolder`, `Task`, `WidgetLayout`, `BookmarkGroup`, `BookmarkCollection`, `UserSettings`): constructor validation, each mutator (`rename`, `moveTo`, `reorder`, `toggle`, `schedule`, `addBookmarkIds`, etc.) — happy + throw paths, `toJSON`/`fromJSON` round-trip, legacy compat (e.g., missing `faviconUrl` defaults to `""`, unknown `WidgetKind` skips row).
- **Value Objects** (`Id`, `Url`, `BackgroundConfig`, `ClockFormat`, `WorldClockConfig`, `Greeting`, `WidgetKind`, `BackgroundKind`): immutability, equality, normalization (e.g., `Url` auto-prefixes `example.com` → `http://example.com/`), edge rejections.

### 6.2 Security

- `BasicSanitizer.text/url` strips control chars/`<>`, re-validates via `Url`.
- `sanitizeCss` strips `@import`, `@font-face` with `http`, `url(http…)`, `javascript:`, `expression(`, `-moz-binding`, `behavior` and caps at 20,000 chars.
- `Url` rejects `javascript:`, `data:`, `vbscript:`, `file:`, `ftp:`.

### 6.3 Repositories

- `BaseChromeListRepository`: `list` caches, `invalidate` drops cache, `save`/`saveAll`/`setAll`/`delete` flush via `toJSON`, `findById`/`findByIdRaw`, corrupted rows are warned & skipped (not thrown).
- `ChromeBookmarkCollectionRepository`, `ChromeBookmarkTagRepository`, `ChromeBookmarkGroupRepository`: string-keyed storage, dedupe, workspaceId handling.

### 6.4 Use Cases

Every use case: **sanitize → validate → mutate → persist → emit**. Assert each step:

- Sanitization (BasicSanitizer called; dangerous input stripped).
- Validation (throws on missing category, empty name, bad enum).
- Persistence (repo content after `execute`).
- Event emission (`events.emit` called with correct `"<domain>:changed"`).
- Ordering (e.g., `ReorderBookmarksUseCase` sequential `order`, unlisted items pushed to end).

Covered use cases: `CreateBookmark`, `UpdateBookmark`, `DeleteBookmark`, `ReorderBookmarks`, `ListBookmarks`, `CreateCategory`, `RenameCategory`, `DeleteCategory` (cascade), `ReorderCategories`, `ListCategories`, `CreateTask`, `UpdateTask`, `DeleteTask`, `ListTasks`, `CreateSubfolder`, `UpdateSubfolder`, `DeleteSubfolder`, `ListSubfolders`, `SaveUserSettings` (patch semantics, BackgroundConfig rebuild, css hardening), `GetSettings`, `GetLayout` (defaults), `ToggleWidgetVisibility`, `List/Create/UpdateMembers/Delete/Rename` collections, `List/Set` tags, `Create/Update/Delete/List/SetActive` groups, `EnsureQuickieFolder` (idempotent + migration).

### 6.5 Services & Infrastructure

- `EventBus`: `on` returns unsubscribe, `emit` fan-out, handler throw isolation.
- `SystemClock.now()` returns `Date` near now.
- `UuidGenerator.next()` returns `crypto.randomUUID()` shape (or fallback).
- `GoogleSyncService`, `AutoBackupService`, `GitHubBackupService`: push/pull, availability, `isAvailable()` branches (covered via memory area stubs).
- `quotaDerivation` pure functions (already covered).

### 6.6 Presentation Helpers

- `TreeView`: `isSafeUrl`, `buildBookmarkTree`, `filterTree`, `countLeaves`, `flattenFoldersForPicker`, `DEFAULT_TREE_STYLE` constants, style cycling.
- `BookmarkDeckView` helpers: `flattenLeaves`, `collectFolders`, `rankByUsage`, `resolveCollectionLeaves`, `cleanDomain`, `websitePreviewUrl` (must return `null` to block `url` leakage).
- `OmniSearchIndex` / `extractTokens`: tokenization, prefix matching, scoped + tag-filtered search.
- `colorHash` / `colorUtils` / `favicon`: hash determinism, gradient correctness, fallback paths.
- `dom.el`: props mapping, `dataset`, `style` kebab, `on*` listeners (no `innerHTML`).

## 7. Assertions & Negative Cases (Mandatory)

Every entity/use-case file must contain:

- At least one `assert.throws` for each validation branch.
- Null/undefined/empty-string handling (functions must not throw unexpectedly; they must degrade to safe defaults).
- Trim/dedupe verification (e.g., `BookmarkCollection` `"  A "` → `"A"`, dedupes `["b1","b1"]`).
- Stale-id resilience (`resolveCollectionLeaves` filters missing leaf ids).
- Idempotence where specified (`EnsureQuickieFolder` second call is no-op).

## 8. CI Gate & Regression Policy

- `npm test` must exit `0` with `0 failed` on every PR. Any failing test blocks merge.
- Adding a new entity field requires: (a) constructor/validator, (b) `toJSON`/`fromJSON`, (c) at least 2 tests — valid + round-trip.
- Adding a new use case requires: register in `src/infrastructure/di/container.js` + 3 tests — happy, validation-fail, event-emitted.
- `supabase/schema.sql` changes require updating `quotaDerivation` tests if policy shape changes.
- Do not edit `test/*.test.mjs` to make them pass by weakening asserts; fix the source.

## 9. Examples

See `test/tree-view.test.mjs` (pure helper), `test/collections.test.mjs` (entity + repo + use-case), `test/backup-compat.test.mjs` (legacy JSON resilience), `test/omni-search-index.test.mjs` (indexed search). New tests must follow the same density and naming.

## 10. Out of Scope (Explicit Non-Goals)

- Visual regression (CSS token) testing — covered by `docs/design/Design.md` review (shim at `Design.md`).
- Real `chrome.bookmarks.getTree()` with thousands of nodes — perf benchmarking is manual (`scripts/tree-integration.mjs`).
- E2E with real Chrome — only `npm run smoke` (manual, not CI).
