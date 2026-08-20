// Shared allowlist of chrome.storage.local keys that are SAFE to include
// in any backup payload (manual export, auto-backup, GitHub gist).
// Sensitive keys (bearer tokens, gist ids) are deliberately excluded so
// they can never leak into a backup file or a remote gist.
//
// This is the single source of truth — import it in every backup path
// instead of re-declaring the list.

export const BACKUP_ALLOWLIST = Object.freeze([
  "bookmarks",
  "categories",
  "settings",
  "tasks",
  "layout",
  "subfolders",
  "bookmarkGroups",
  "bookmarkTags",
  "bookmarkCollections",
  "quickNote",
  "bookmarkUsage",
  "bookmarkLastOpened",
  "activeBookmarkGroup",
  "aiQuotaCache",
  "aiQuotaPrefs",
  "popupColorMode",
]);

// Keys that must NEVER leave the device. Listed explicitly so a future
// audit can grep for them. Even if one of these somehow ends up in the
// allowlist, filterBackupData double-checks against this denylist.
export const SENSITIVE_KEYS = Object.freeze([
  "aiQuotaPAT",
  "githubBackupPAT",
  "githubBackupGistId",
]);

// Coarse type expectations for validating imported payloads.
// "array"  — must be an Array
// "object" — must be a plain object (not null, not array)
// "any"    — any JSON value accepted
const TYPE_EXPECTATIONS = Object.freeze({
  bookmarks: "array",
  categories: "array",
  settings: "object",
  tasks: "array",
  layout: "array",
  subfolders: "array",
  bookmarkGroups: "array",
  bookmarkTags: "object",
  bookmarkCollections: "object",
  quickNote: "any",
  bookmarkUsage: "any",
  bookmarkLastOpened: "any",
  activeBookmarkGroup: "any",
  aiQuotaCache: "any",
  aiQuotaPrefs: "any",
  popupColorMode: "any",
});

const sensitiveSet = new Set(SENSITIVE_KEYS);

/**
 * Returns a NEW object containing only the allowlisted keys present in
 * `data`. Sensitive keys are never copied even if they somehow appear
 * in the allowlist (defense in depth).
 *
 * @param {Object} data — raw chrome.storage.local.get() output
 * @returns {Object} filtered payload safe to serialize for backup
 */
export function filterBackupData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const out = {};
  for (const key of BACKUP_ALLOWLIST) {
    if (sensitiveSet.has(key)) continue;
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      out[key] = data[key];
    }
  }
  return out;
}

/**
 * Validate an imported backup object.
 *
 * Returns `{ ok: true, data }` with a filtered payload containing only
 * allowlisted keys, or `{ ok: false, error }` describing why it was
 * rejected.
 *
 * - Rejects non-objects / arrays.
 * - Drops unknown keys (only allowlisted keys survive).
 * - Type-checks known keys; rejects the ENTIRE import if a known key
 *   has a grossly wrong type (e.g. settings is a string, bookmarks is
 *   a number).
 * - Sensitive keys are dropped silently.
 * - Requires at least one recognized key.
 *
 * @param {*} raw — parsed JSON from the import file
 * @returns {{ ok: true, data: Object } | { ok: false, error: string }}
 */
export function validateImportData(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Backup file must be a JSON object." };
  }

  const filtered = {};
  for (const key of BACKUP_ALLOWLIST) {
    if (sensitiveSet.has(key)) continue;
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;

    const value = raw[key];
    const expected = TYPE_EXPECTATIONS[key];

    if (expected === "array") {
      if (!Array.isArray(value)) {
        return { ok: false, error: `Expected "${key}" to be a list, got ${typeof value}.` };
      }
    } else if (expected === "object") {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return { ok: false, error: `Expected "${key}" to be an object, got ${typeof value}.` };
      }
    }

    filtered[key] = value;
  }

  if (Object.keys(filtered).length === 0) {
    return { ok: false, error: "No recognizable Syncly data found in this file." };
  }

  return { ok: true, data: filtered };
}
