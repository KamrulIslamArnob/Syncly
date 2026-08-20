# Test Cases — Syncly (Detailed Matrix)

> Every test case below maps to a runnable `node:test` case. The column **File** is the `test/*.test.mjs` that implements it. Cases still `⬜` are planned; `☑` are implemented in this commit. Exhaustive input tables are in the implementation files.

**Conventions**: TC-ID = `<LAYER>-<SEQ>`, Type = `[Domain|App|Infra|Helper|Security]`, Priority = `[P0 smoke | P1 critical | P2 standard | P3 edge]`.

---

## 1. Value Objects (Domain) — File: `test/domain-value-objects.test.mjs`

| ID | Unit | Case | Inputs | Expected | Type | P |
|----|------|------|--------|----------|------|---|
| VO-01 | `Id` | Create valid | `new Id("abc")` | `value==="abc"`, `equals` true for same value | Domain | P0 |
| VO-02 | `Id` | Reject empty/non-string | `""`, `null`, `123`, `undefined` | `throw / Id must be a non-empty string/` | Domain | P0 |
| VO-03 | `Id` | Equals vs non-Id | `id.equals("abc")` | `false` (not instanceof) | Domain | P2 |
| VO-04 | `Url` | Accept http/https | `https://example.com/a?b=1` | `href` normalized with trailing `/` or preserved query | Domain | P0 |
| VO-05 | `Url` | Auto-prefix bare host | `example.com` → `http://example.com/` | Scheme added, href valid | Domain | P1 |
| VO-06 | `Url` | Reject bad schemes | `javascript:alert(1)`, `data:text/html,...`, `file:///etc`, `ftp://x`, `""` | `throw /http/` | Security | P0 |
| VO-07 | `Url` | Equals | two `new Url("https://a.b")` with/without trailing slash | Normalized equality | Domain | P2 |
| VO-08 | `BackgroundConfig` | `localImage` accepts data URL / `.png/.webp/.gif` | `data:image/png;base64,...` / `bg.png` | `kind===local_image` | Domain | P1 |
| VO-09 | `BackgroundConfig` | `localImage` rejects bad filename | `bg.txt`, `""` | `throw` | Domain | P1 |
| VO-10 | `BackgroundConfig` | `remoteImage` accepts http(s) only | `https://cdn.example/bg.jpg` | `kind===remote_image` | Domain | P1 |
| VO-11 | `BackgroundConfig` | `remoteImage` rejects `javascript:` | `javascript:alert(1)` | `throw` | Security | P0 |
| VO-12 | `BackgroundConfig` | `solidColor`/`gradient` any string | `solidColor("#ff0000")` | Accepted | Domain | P2 |
| VO-13 | `BackgroundConfig` | Reject unknown kind | `new BackgroundConfig("bad", "x")` | `throw /Unsupported/` | Domain | P1 |
| VO-14 | `BackgroundConfig` | `equals` | same vs different kind/value | true / false | Domain | P2 |
| VO-15 | `ClockFormat` | Construct `12h`/`24h` | `new ClockFormat("12h")` | `value` correct | Domain | P1 |
| VO-16 | `ClockFormat` | Reject unknown | `"13h"` | `throw /Unknown/` | Domain | P1 |
| VO-17 | `ClockFormat` | `toggle` flips | `12h↔24h` | Returns new instance | Domain | P2 |
| VO-18 | `ClockFormat` | `equals` | same vs different | true/false | Domain | P2 |
| VO-19 | `Greeting` | `fromHour` <12 → morning, 12-17→afternoon, 18+→evening | `fromHour(9,"Ann")` etc | `partOfDay` correct | Domain | P1 |
| VO-20 | `Greeting` | `render` with name | `new Greeting("morning","Ann").render()` | `"Good Morning, Ann"` | Domain | P1 |
| VO-21 | `Greeting` | `render` empty name | `name="   "` | `"Good Morning"` (no trailing comma) | Domain | P2 |
| VO-22 | `Greeting` | Reject unknown part | `new Greeting("noon","Ann")` | `throw` | Domain | P2 |
| VO-23 | `WidgetKind` | Accept known | `new WidgetKind("clock")` | `value` | Domain | P1 |
| VO-24 | `WidgetKind` | Reject unknown | `"weather"` | `throw` | Domain | P1 |
| VO-25 | `WorldClockConfig` | Construct + toJSON/fromJSON | `{label:"Dhaka", timeZone:"Asia/Dhaka"}` | Round-trip preserves | Domain | P1 |
| VO-26 | `WorldClockConfig` | Reject bad timezone type | non-string | `throw` | Domain | P2 |

## 2. Domain Entities — File: `test/domain-entities.test.mjs`

| ID | Entity | Case | Expected | P |
|----|--------|------|----------|---|
| DE-01 | `Bookmark` | Construct valid + getters | fields correct, order 0, favicon "" | P0 |
| DE-02 | `Bookmark` | Reject empty title, >120 chars, bad Id/Url/categoryId, negative order | `throw` each branch | P0 |
| DE-03 | `Bookmark` | `#normalizeFaviconUrl`: `data:image/png;base64`, `/public/favicons/ai.svg`, `https://`, `""` → keep; `chrome://`, `javascript:`, `not url`, non-string → `throw` / fallback | Valid kept, invalid throws in ctor, `fromJSON` swallows | P0 |
| DE-04 | `Bookmark` | Mutators `rename/retarget/setFaviconUrl/moveTo/reorder/recordAccess/setSubfolderId` | Updates field, validates, `lastAccessed` bumps | P0 |
| DE-05 | `Bookmark` | `fromJSON` legacy tolerant: missing `faviconUrl`→`""`, garbage favicon→`""` (not throw) | `fromJSON` never throws except bad title/url/id | P1 |
| DE-06 | `Bookmark` | `toJSON`/`fromJSON` round-trip | Deep equal after round-trip | P0 |
| DE-07 | `Category` | Construct/rename/reorder + validation (empty, >60, negative order, non-Id) | Throws per branch | P0 |
| DE-08 | `Category` | `fromJSON` with missing order → 0 | Defaults | P2 |
| DE-09 | `Subfolder` | Same as Category plus `categoryId` Id validation | Throws | P0 |
| DE-10 | `Task` | Construct valid with scheduledTime HH:MM, duration 5-1440, dueDate YYYY-MM-DD | Valid; getters | P0 |
| DE-11 | `Task` | Validate title >200, bad HH:MM `25:00`, duration 3 or 1441, bad dueDate `2026-13-01` | Each `throw` | P0 |
| DE-12 | `Task` | Mutators `rename/toggle/setCompleted/reorder/schedule/setDueDate` | Correct + validation | P0 |
| DE-13 | `Task` | `fromJSON` defaults missing fields | `order:0`, `completed:bool`, `scheduledTime:""` | P1 |
| DE-14 | `WidgetLayout` | Construct valid, `moveTo`, `resizeTo`, `setVisible` | Update, validate >=1 integers | P0 |
| DE-15 | `WidgetLayout` | Reject invalid coords / visible type | `throw` | P0 |
| DE-16 | `WidgetLayout` | `defaults()` 4 items with expected ids/types/coords | Length 4, correct types | P1 |
| DE-17 | `BookmarkCollection` | Validate name (empty, >50 trimmed), dedupe bookmarkIds, validateBookmarkIds | Throws / deduped | P0 |
| DE-18 | `BookmarkCollection` | Mutators `rename/addBookmarkIds/removeBookmarkIds/setBookmarkIds` + updatedAt bump | Correct | P0 |
| DE-19 | `BookmarkGroup` | Validate name (empty, >50, reserved like `Quickie`, case-insensitive), icon pattern, folderIds >50 or non-array | Throws | P0 |
| DE-20 | `BookmarkGroup` | Mutators `updateName/updateIcon/updateFolderIds` | UpdatedAt bump | P0 |
| DE-21 | `UserSettings` | Constructor defaults + all setters validation (name >60, blur>20, overlay>1, bad searchEngine/theme/colorMode, weatherUnit) | Throws per branch, defaults correct | P0 |
| DE-22 | `UserSettings` | `customCss` hardening at ctor + `setCustomCss` strips `@import`, `@font-face http`, `url(http)`, `javascript:` etc + caps 20k | Hardened output | Security P0 |
| DE-23 | `UserSettings` | `toJSON`/`fromJSON` round-trip including `workspaceThemes`, `themePresetDark/Light`, `cssVarAccent`, `showWebsitePreviews` | Preserved | P0 |
| DE-24 | `UserSettings` | `colorMode` ↔ `themePreset` sync (dark→Dark preset, light→Light) | Correct getter | P1 |
| DE-25 | `UserSettings` | `fromJSON` resilience with legacy keys, missing background, null clocks | Defaults, no throw | P1 |

## 3. Security — File: `test/security.test.mjs`

| ID | Module | Case | Expected | P |
|----|--------|------|----------|---|
| SEC-01 | `BasicSanitizer.text` | Strips `[\x00-\x1F\x7F<>]` + trim, non-string → `""` | Stripped | P0 |
| SEC-02 | `BasicSanitizer.url` | Re-validates via `Url`, strips `javascript:`, `data:`, returns `href` or `""` | Safe | P0 |
| SEC-03 | `sanitizeCss` | Strips `@import *;`, `@font-face {..http..}`, `url(http…)`, `javascript:`, `expression(`, `-moz-binding`, `behavior`, caps 20k | Output missing vectors | P0 |
| SEC-04 | `sanitizeCss` | Non-string → `""`, benign css preserved | Pass | P2 |
| SEC-05 | `patCrypto` (if available) | `encryptPat`/`decryptPat` round-trip (mock indexedDB) or degrades gracefully in Node | Round-trip or `null` without IndexedDB | P2 |

## 4. Repositories — File: `test/repositories.test.mjs`

| ID | Repo | Case | Expected | P |
|----|------|------|----------|---|
| REPO-01 | `BaseChromeListRepository` | `list` caching & `invalidate` | Second list uses cache; after invalidate reloads | P0 |
| REPO-02 | `BaseChromeListRepository` | Corrupted row skip | One valid + one legacy bad → list length 1, warn not throw | P0 |
| REPO-03 | `BaseChromeListRepository` | `save` upsert, `saveAll`, `setAll`, `delete`, `findById`/`findByIdRaw` | Persisted JSON correct, found/null | P0 |
| REPO-04 | `ChromeBookmarkCollectionRepository` | `save/list/findById/delete`, dedupe, workspaceId null vs string | Correct | P0 |
| REPO-05 | `ChromeBookmarkTagRepository` | `setTags/getTags/listAll`, sanitized? | Correct | P1 |
| REPO-06 | `ChromeBookmarkGroupRepository` | `save/findById/list/delete`, reserved handling | Correct | P1 |
| REPO-07 | `ChromeStorageClient` (if mocked) | `getAll/getOne/set/remove/onChanged` shape | Delegates to stub | P2 |

## 5. Application Use Cases — File: `test/application-use-cases.test.mjs` (split as needed)

| ID | Use Case | Happy | Validation/Fail | Event | P |
|----|----------|-------|-----------------|-------|---|
| UC-01 | `CreateBookmark` | Creates with next order in category, emits `bookmarks:changed` | Throws if category not found, sanitizes title/url | P0 | P0 |
| UC-02 | `UpdateBookmark` | Partial update title/url/categoryId/faviconUrl/recordAccess | Throws on bad Id, re-validates | P0 |
| UC-03 | `DeleteBookmark` (`BaseDelete`) | Deletes + emits | No throw if missing? | P1 |
| UC-04 | `ReorderBookmarks` | OrderedIds → sequential order, unlisted pushed end | Invalid ids ignored | P0 |
| UC-05 | `CreateCategory` | Trims name, order next, emits `categories:changed` | Throws empty/>60 | P0 |
| UC-06 | `RenameCategory` | Renames correctly | Throws invalid name | P1 |
| UC-07 | `DeleteCategory` | Cascades delete bookmarks → emits `bookmarks:changed` + `categories:changed` | — | P0 |
| UC-08 | `ReorderCategories` | Sequential order | — | P1 |
| UC-09 | `CreateTask` | Next order, not completed | Throws empty/>200 | P0 |
| UC-10 | `UpdateTask` | `schedule`, `setDueDate`, `toggle` etc | Throws bad HH:MM, duration, dueDate | P0 |
| UC-11 | `CreateSubfolder` | Requires category exists, emits | Throws if missing category | P0 |
| UC-12 | `UpdateSubfolder` | Rename validation | — | P1 |
| UC-13 | `DeleteSubfolder` | Delete + emit | Cascades? | P1 |
| UC-14 | `SaveUserSettings` | Patch semantics (only defined fields), rebuilds BackgroundConfig from kind/value, hardens customCss, emits `settings:changed` | Throws bad enum/range, strips evil CSS | P0 |
| UC-15 | `GetSettings` | Loads defaults if empty | — | P2 |
| UC-16 | `GetLayout` | Returns stored or `defaults()` on first launch | — | P1 |
| UC-17 | `ToggleWidgetVisibility` | `setVisible` + emits `layout:changed` | Throws missing widget | P1 |
| UC-18 | `CreateBookmarkCollection` | Dedupe ids, workspaceId, emits `bookmarkCollections:changed` | Throws empty/>50 name | P0 |
| UC-19 | `UpdateCollectionMembers` | Add/remove → deduped | Filters non-string | P0 |
| UC-20 | `DeleteBookmarkCollection` | Delete + emit | — | P1 |
| UC-21 | `RenameBookmarkCollection` | Sanitized + trim | Throws reserved? (>50) | P1 |
| UC-22 | `ListBookmarkTags` / `SetBookmarkTags` | Set tags via sanitizer, emits `bookmarkTags:changed` | Dedupes? Filters empty | P0 |
| UC-23 | `CreateBookmarkGroup` | Validate name (reserved), icon, folderIds>50 → throw | Happy create | P0 |
| UC-24 | `UpdateBookmarkGroup` | Update fields, bump updatedAt | Throws bad name/icon | P1 |
| UC-25 | `DeleteBookmarkGroup` / `ListBookmarkGroups` / `SetActiveGroup` | Delete/list/setActive persist to storage key `activeBookmarkGroup` | — | P1 |
| UC-26 | `EnsureQuickieFolder` | Create folder if missing, migrate loose bookmarks once, idempotent second call no-op | Handles existing folder, respects `quickieMigrated` | P0 |
| UC-27 | `SyncFromGoogleCloud` | Pulls `SYNC_KEYS`, emits per-domain events | — | P1 |
| UC-28 | `PushBackupToGitHub` | Push payload, handle PAT missing | — | P2 |

## 6. EventBus & Services — File: `test/event-bus-services.test.mjs`

| ID | Module | Case | Expected | P |
|----|--------|------|----------|---|
| EV-01 | `EventBus` | `on` + `emit` fan-out to 2 handlers | Both called | P0 |
| EV-02 | `EventBus` | `on` returns unsubscribe | After `off()` handler not called | P0 |
| EV-03 | `EventBus` | Handler throw isolation | Second handler still called, error logged not thrown | P0 |
| EV-04 | `EventBus` | `emit` with no listeners | No throw | P2 |
| SV-01 | `SystemClock` | `now()` ≈ `Date` | Within 50ms | P1 |
| SV-02 | `UuidGenerator` | `next()` produces UUID v4 shape, fallback when `crypto.randomUUID` missing | Regex + non-throw | P1 |
| SV-03 | `GoogleSyncService` | `isAvailable` true/false based on chrome.storage.sync, `pushAll`/`pullAll` with MemoryStorageArea | Correct keys & success | P1 |
| SV-04 | `AutoBackupService` | `performBackup` with File System API absent → IndexedDB fallback or `requires_permission` | Graceful | P2 |
| SV-05 | `quotaDerivation` | (already in `ai-quota-derive.test.mjs`) — 13 cases | — | — |

## 7. Presentation Helpers — File: `test/presentation-helpers.test.mjs` + existing `tree-view`/`deck-view`

| ID | Helper | Case | Expected | P |
|----|--------|------|----------|---|
| H-01 | `isSafeUrl` | http(s) pass, `javascript:`, `data:`, `file:`, `ftp:` → `null` | Security | P0 |
| H-02 | `buildBookmarkTree` | Unwraps synthetic root, types, counts, prunes empty, sanitizes unsafe URLs | Correct nodes | P0 |
| H-03 | `filterTree` | Empty query no-op ref, ancestor retention, folder self-match keeps subtree, no match → `[]` | Correct | P0 |
| H-04 | `countLeaves`/`flattenLeaves` | Accumulates leaves | Count | P1 |
| H-05 | `collectFolders` | Top folders + loose synthetic block | Correct ids | P1 |
| H-06 | `flattenFoldersForPicker` | Includes empty folders, depth calc, bookmarks excluded, groups per root | Correct | P0 |
| H-07 | `rankByUsage` | Desc sort & cap | Sorted | P1 |
| H-08 | `resolveCollectionLeaves` | Preserves order, filters stale | Correct | P0 |
| H-09 | `cleanDomain` | Strips `www.`, invalid → `""` | Correct | P1 |
| H-10 | `websitePreviewUrl` | Always `null` (privacy) for http(s), null/invalid/private → `null` | `null` | P0 |
| H-11 | `faviconUrl`/`websiteFaviconUrl` | Generates Google s2 or `""` for bad input | Correct | P1 |
| H-12 | `TreeStyle` utils | `DEFAULT_TREE_STYLE organic`, `isValid`, `normalize`, `cycle`, `readTreeStyle` with corrupt/missing store → `organic` | Correct | P1 |
| H-13 | `getThumbGradient`/`getFolderColor` | Deterministic per string, returns CSS | Consistent | P1 |
| H-14 | `deriveAccentShades` | Dark/light vars, opacity correct | Vars | P1 |
| H-15 | `extractTokens`/`OmniSearchIndex` | Tokenization, prefix, category/path/tag/scoped/multi-token/no-match, `getCategoryName` | Correct | P0 |
| H-16 | `dom.el` | Maps `className`, `dataset`, `style` (kebab + grid), `on*` events, `textContent` escaping, `clear`/`setChildren` | DOM correct | P1 |

## 8. Integration / Smoke (Manual)

| ID | Scenario | Steps | Expected | P |
|----|----------|-------|----------|---|
| SM-01 | Bootstrap | `npm test` + `node --test` exit 0, 0 failures | Gate passes | P0 |
| SM-02 | Chrome shim smoke | `npm run smoke` with puppeteer-core, inject new tab, assert `#stage` renders, search filters | Live render | P1 |

---

## Implementation Status (this commit)

- `test/domain-value-objects.test.mjs` — 26 cases (VO-01..VO-26)
- `test/domain-entities.test.mjs` — 25 cases (DE-01..DE-25)
- `test/security.test.mjs` — 5 cases + cssSanitizer matrix
- `test/repositories.test.mjs` — 7 cases
- `test/application-use-cases.test.mjs` — 28 cases (UC-01..UC-28)
- `test/event-bus-services.test.mjs` — 8 cases
- `test/presentation-helpers.test.mjs` — 16 cases (H-01..H-16 plus dom.el)
- Existing: `tree-view` (22 cases), `backup-compat` (8), `collections` (3), `deck-view` (7), `ai-quota-derive` (13), `omni-search-index` (11), `google-sync` (2), `shortcuts-deck` (2) — retained.

**Total after this commit:** >150 test blocks, >45 use-case/event/security edge assertions.
