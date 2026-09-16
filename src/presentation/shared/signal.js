// Freshness ("signal") helpers for the bookmark deck.
//
// Pure presentation-layer code: no DOM, no storage. The deck feeds in its
// own open log (`bookmarkUsage` counts, `bookmarkLastOpenedAt` timestamps)
// plus the dates Chrome keeps on native bookmark nodes.
//
// Bands
//   live — opened within the last 7 days
//   rest — opened within 90 days, or saved within 90 days and not opened yet
//   cold — not opened for 90+ days, or never opened and saved 90+ days ago

export const LAST_OPENED_MAP_KEY = "bookmarkLastOpenedAt";
// First time the deck started keeping timestamps. Opens counted before that
// have no date, so they are treated as happening at this moment.
export const SIGNAL_SINCE_KEY = "bookmarkSignalSince";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const LIVE_DAYS = 7;
const COLD_DAYS = 90;

/**
 * @param {{ lastOpenedAt?: number|null, dateAdded?: number|null }} dates
 * @param {number} [now]
 * @returns {"live"|"rest"|"cold"}
 */
export function signalBand({ lastOpenedAt = null, dateAdded = null } = {}, now = Date.now()) {
  if (lastOpenedAt) {
    const age = now - lastOpenedAt;
    if (age <= LIVE_DAYS * DAY) return "live";
    if (age <= COLD_DAYS * DAY) return "rest";
    return "cold";
  }
  if (dateAdded && now - dateAdded <= COLD_DAYS * DAY) return "rest";
  return "cold";
}

/**
 * When a bookmark was last opened, from the best source available: the
 * newer of the deck's own record and Chrome's `dateLastUsed`, else the
 * start of tracking for opens that were counted before timestamps existed.
 */
export function lastOpenedFor(bookmark, { lastOpenedAt = {}, usage = {}, trackedSince = null } = {}) {
  if (!bookmark) return null;
  const latest = Math.max(lastOpenedAt?.[bookmark.id] || 0, bookmark.dateLastUsed || 0);
  if (latest) return latest;
  if (usage?.[bookmark.id] && trackedSince) return trackedSince;
  return null;
}

/** Short relative age: now, 5m, 3h, 2d, 3w, 5mo, 2y. "" when unknown. */
export function relativeAge(ts, now = Date.now()) {
  if (!ts) return "";
  const minutes = Math.floor(Math.max(0, now - ts) / MINUTE);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

/** "33×", or "never" for a link that was never opened. */
export function openCountLabel(count = 0) {
  return count ? `${count}×` : "never";
}

/** Count bands across a pool of bookmarks for the signal strip. */
export function tallySignal(bookmarks, bandOf) {
  const out = { live: 0, rest: 0, cold: 0, total: 0 };
  for (const bookmark of bookmarks || []) {
    if (!bookmark || !bookmark.url) continue;
    out[bandOf(bookmark)] += 1;
    out.total += 1;
  }
  return out;
}

function duplicateKey(url) {
  const raw = String(url).trim();
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, "")}${parsed.search}${parsed.hash}`;
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

/**
 * Links saved more than once. URLs compare with the host's case and a
 * trailing slash ignored; the path keeps its case.
 */
export function findDuplicates(leaves) {
  const byUrl = new Map();
  for (const leaf of leaves || []) {
    if (!leaf || !leaf.url) continue;
    const key = duplicateKey(leaf.url);
    if (!byUrl.has(key)) byUrl.set(key, []);
    byUrl.get(key).push(leaf);
  }

  const groups = [];
  const folders = new Set();
  let extraCopies = 0;
  for (const [url, group] of byUrl) {
    if (group.length < 2) continue;
    groups.push({ url, leaves: group });
    extraCopies += group.length - 1;
    for (const leaf of group) folders.add(leaf.parentId ?? "");
  }
  return { groups, extraCopies, folderCount: folders.size };
}

/*
 * Sibling-distinct folder colours.
 *
 * getFolderColor() in colorHash.js hashes into six slots, one of them a
 * neutral grey, so neighbouring folders collide and some read as having no
 * colour at all. Assigning by position among siblings, with grey dropped,
 * keeps neighbours distinguishable. Each slot is a CSS custom property so
 * light mode can use darker values (see tokens.css).
 */
const FOLDER_PALETTE_SIZE = 5;

export function siblingColor(index = 0) {
  const slot = ((index % FOLDER_PALETTE_SIZE) + FOLDER_PALETTE_SIZE) % FOLDER_PALETTE_SIZE;
  return `var(--folder-pal-${slot})`;
}

/**
 * Folder id -> colour for every folder in a tree, by position among its
 * sibling folders. The deck's synthetic "loose:<rootId>" folders also map
 * their real root id, which is the parentId their bookmarks carry.
 */
export function assignFolderColors(folders) {
  const colors = new Map();
  const walk = (siblings) => {
    let slot = 0;
    for (const node of siblings || []) {
      if (!node || node.type !== "folder") continue;
      const color = siblingColor(slot++);
      const id = String(node.id);
      colors.set(id, color);
      if (id.startsWith("loose:")) colors.set(id.slice("loose:".length), color);
      walk(node.children);
    }
  };
  walk(folders);
  return colors;
}
