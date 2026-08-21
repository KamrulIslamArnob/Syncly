/* ============================================================
   crossDeviceSync — Pure merge helpers for chrome.storage.sync

   Chrome's storage.sync delivers whole-key snapshots from other
   devices. A blind overwrite of the local key loses concurrent edits
   made on this device (last-device-wins-all), which is how workspaces
   created on one device used to vanish from the other.

   These helpers implement item-level, conflict-safe merging:

   - Entity lists (bookmarkGroups, bookmarkCollections) are merged by
     `id`; the copy with the newer `updatedAt` wins per item.
   - Tag maps (bookmarkTags: { [bookmarkId]: string[] }) merge by
     unioning tag arrays per bookmark.
   - Deletions propagate via tombstones (id -> deletedAt) so a deleted
     workspace is not resurrected by a stale snapshot from another
     device. An edit newer than its tombstone wins (edit-after-delete).

   Zero dependencies, no chrome.* access — safe to unit-test in node.
   ============================================================ */

/** Keys merged at item level (entities with id + updatedAt, or tag maps). */
export const MERGE_KEYS = Object.freeze(["bookmarkGroups", "bookmarkCollections", "bookmarkTags"]);

/** Local storage / sync storage key holding tombstone records. */
export const TOMBSTONE_KEY = "syncTombstones";

/** Tombstones older than this are pruned (30 days). */
export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** chrome.storage.sync QUOTA_BYTES_PER_ITEM is 8192 — keep a safety margin. */
export const MAX_SYNC_ITEM_BYTES = 8000;

/**
 * Rough byte size of a value as stored by chrome.storage.
 * JSON length approximates UTF-8 bytes for typical ASCII payloads;
 * good enough as a quota heuristic.
 * @param {unknown} value
 * @returns {number}
 */
export function estimateBytes(value) {
  try {
    return JSON.stringify(value ?? null)?.length ?? 0;
  } catch {
    return Infinity; // unserializable → treat as oversized
  }
}

export function isEmptyValue(v) {
  return (
    v === undefined ||
    v === null ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0)
  );
}

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/* ── Tombstones ────────────────────────────────────────────────────────────── */

/**
 * Normalize a tombstones object to { [listKey]: { [id]: deletedAt } }.
 * @param {unknown} raw
 * @returns {Record<string, Record<string, number>>}
 */
export function normalizeTombstones(raw) {
  if (!isPlainObject(raw)) return {};
  const out = {};
  for (const [listKey, ids] of Object.entries(raw)) {
    if (!isPlainObject(ids)) continue;
    const map = {};
    for (const [id, at] of Object.entries(ids)) {
      const t = Number(at);
      if (typeof id === "string" && id.length > 0 && Number.isFinite(t) && t > 0) {
        map[id] = t;
      }
    }
    if (Object.keys(map).length > 0) out[listKey] = map;
  }
  return out;
}

/**
 * Merge two tombstone sets — keep the newest deletedAt per id.
 * @returns {Record<string, Record<string, number>>}
 */
export function mergeTombstones(a, b) {
  const na = normalizeTombstones(a);
  const nb = normalizeTombstones(b);
  const result = {};
  for (const listKey of new Set([...Object.keys(na), ...Object.keys(nb)])) {
    result[listKey] = { ...(na[listKey] || {}) };
    for (const [id, at] of Object.entries(nb[listKey] || {})) {
      result[listKey][id] = Math.max(result[listKey][id] ?? 0, at);
    }
  }
  return result;
}

/**
 * Record deletions into a tombstones object (pure).
 * @param {unknown} existing raw tombstones
 * @param {string} listKey e.g. "bookmarkGroups"
 * @param {string[]} ids deleted ids
 * @param {number} at deletion timestamp
 */
export function recordTombstone(existing, listKey, ids, at = Date.now()) {
  const tombs = normalizeTombstones(existing);
  const map = { ...(tombs[listKey] || {}) };
  for (const id of ids) {
    if (typeof id === "string" && id.length > 0) {
      map[id] = Math.max(map[id] ?? 0, at);
    }
  }
  return { ...tombs, [listKey]: map };
}

/** Drop tombstones older than TTL. */
export function pruneTombstones(raw, now = Date.now()) {
  const tombs = normalizeTombstones(raw);
  const out = {};
  for (const [listKey, ids] of Object.entries(tombs)) {
    const kept = {};
    for (const [id, at] of Object.entries(ids)) {
      if (now - at < TOMBSTONE_TTL_MS) kept[id] = at;
    }
    if (Object.keys(kept).length > 0) out[listKey] = kept;
  }
  return out;
}

/**
 * True when a tombstone should suppress an item (deleted after its last edit).
 */
function isTombstoned(tombsForKey, id, updatedAt) {
  const deletedAt = tombsForKey?.[id];
  if (!deletedAt) return false;
  const editedAt = typeof updatedAt === "number" ? updatedAt : 0;
  return deletedAt >= editedAt;
}

/* ── List merging ──────────────────────────────────────────────────────────── */

/**
 * Merge two arrays of entities by id — newer updatedAt wins per item.
 *
 * The result is sorted canonically (createdAt asc, then id) so two devices
 * computing the same union arrive at BYTE-IDENTICAL arrays regardless of
 * whose local order they started from. Without this, devices converge in
 * content but oscillate in order forever, burning the sync write quota.
 *
 * Items tombstoned after their last edit are dropped.
 *
 * @template T {{ id: string, updatedAt?: number, createdAt?: number }}
 * @param {T[]|undefined} localArr
 * @param {T[]|undefined} remoteArr
 * @param {Record<string, number>|undefined} tombsForKey tombstones for this list key
 * @returns {T[]}
 */
export function mergeEntityList(localArr, remoteArr, tombsForKey) {
  const local = Array.isArray(localArr) ? localArr.filter((it) => it && typeof it.id === "string") : [];
  const remote = Array.isArray(remoteArr) ? remoteArr.filter((it) => it && typeof it.id === "string") : [];

  const remoteById = new Map(remote.map((it) => [it.id, it]));
  const seen = new Set();
  const merged = [];

  for (const item of local) {
    seen.add(item.id);
    if (isTombstoned(tombsForKey, item.id, item.updatedAt)) continue;
    const theirs = remoteById.get(item.id);
    if (!theirs) {
      merged.push(item);
      continue;
    }
    if (isTombstoned(tombsForKey, theirs.id, theirs.updatedAt)) continue;
    merged.push(pickNewer(item, theirs));
  }

  for (const item of remote) {
    if (seen.has(item.id)) continue;
    if (isTombstoned(tombsForKey, item.id, item.updatedAt)) continue;
    merged.push(item);
  }

  return merged.sort(
    (a, b) => (a.createdAt || 0) - (b.createdAt || 0) || String(a.id).localeCompare(String(b.id))
  );
}

function pickNewer(a, b) {
  const au = typeof a.updatedAt === "number" ? a.updatedAt : 0;
  const bu = typeof b.updatedAt === "number" ? b.updatedAt : 0;
  if (bu > au) return b;
  if (au > bu) return a;
  // Equal timestamps with diverging content (clock-skew edge): pick
  // deterministically by content so both devices converge.
  try {
    return JSON.stringify(b) < JSON.stringify(a) ? b : a;
  } catch {
    return b;
  }
}

/**
 * Merge tag maps ({ [bookmarkId]: string[] }) by unioning tag arrays.
 * Entries whose tags were tombstoned are dropped. Output keys are sorted
 * canonically so both devices serialize byte-identical maps (no write
 * oscillation from insertion-order differences).
 *
 * @param {Record<string, string[]>|undefined} localMap
 * @param {Record<string, string[]>|undefined} remoteMap
 * @param {Record<string, number>|undefined} tombsForKey
 * @returns {Record<string, string[]>}
 */
export function mergeTagMap(localMap, remoteMap, tombsForKey) {
  const local = isPlainObject(localMap) ? localMap : {};
  const remote = isPlainObject(remoteMap) ? remoteMap : {};
  const out = {};

  for (const [bookmarkId, tags] of Object.entries(local)) {
    if (isTombstoned(tombsForKey, bookmarkId, undefined)) continue;
    out[bookmarkId] = Array.isArray(tags) ? dedupe(tags) : [];
  }
  for (const [bookmarkId, tags] of Object.entries(remote)) {
    if (isTombstoned(tombsForKey, bookmarkId, undefined)) continue;
    out[bookmarkId] = dedupe([...(out[bookmarkId] || []), ...(Array.isArray(tags) ? tags : [])]);
  }
  for (const [bookmarkId, tags] of Object.entries(out)) {
    if (tags.length === 0) delete out[bookmarkId];
  }

  const sorted = {};
  for (const k of Object.keys(out).sort()) sorted[k] = out[k];
  return sorted;
}

function dedupe(arr) {
  return [...new Set(arr.map(String))];
}

/**
 * Compute the merged value for one sync-eligible key.
 * Intended for MERGE_KEYS only — whole-value keys (categories, bookmarks,
 * settings) keep their legacy take-remote / fill-the-empty-side semantics,
 * which GoogleSyncService applies inline.
 *
 * @param {string} key
 * @param {unknown} localVal current local value
 * @param {unknown} remoteVal incoming value from chrome.storage.sync
 * @param {Record<string, Record<string, number>>} tombstones full tombstones object
 * @returns {{ value: unknown, changedLocal: boolean } | null} null when nothing to do
 */
export function computeMerged(key, localVal, remoteVal, tombstones) {
  if (!MERGE_KEYS.includes(key)) return null;
  if (remoteVal === undefined || remoteVal === null) return null;

  const tombsForKey = tombstones?.[key];
  let merged;
  if (key === "bookmarkTags") {
    merged = mergeTagMap(localVal, remoteVal, tombsForKey);
  } else {
    merged = mergeEntityList(localVal, remoteVal, tombsForKey);
  }
  const changedLocal = JSON.stringify(merged) !== JSON.stringify(localVal);
  return { value: merged, changedLocal };
}
