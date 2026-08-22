/* ============================================================
   workspaceNaming — Pure helpers for the native-sync fallback

   Workspaces live in TWO channels:
   1. chrome.bookmarks — the dedicated root folder under Other
      Bookmarks, titled with the "w-" prefix. This rides Chrome's
      NATIVE bookmark sync (bulletproof, no quota) so every device
      can discover workspaces by scanning for prefixed folders.
   2. chrome.storage.sync — full metadata (icon, multi-folder
      links) via GoogleSyncService, when quota allows.

   Zero dependencies, no chrome.* access.
   ============================================================ */

/** Prefix marking a Chrome folder as a Syncly workspace root. */
export const WORKSPACE_PREFIX = "w-";

/**
 * Native folder title for a workspace name.
 * Idempotent: names already carrying the prefix are not double-prefixed.
 * @param {string} name
 * @returns {string}
 */
export function toFolderTitle(name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return WORKSPACE_PREFIX;
  if (trimmed.startsWith(WORKSPACE_PREFIX)) return trimmed;
  return WORKSPACE_PREFIX + trimmed;
}

/**
 * Workspace name from a native folder title.
 * @param {string} title
 * @returns {string|null} stripped name, or null when not workspace-prefixed
 */
export function fromFolderTitle(title) {
  const t = String(title ?? "").trim();
  if (!t.startsWith(WORKSPACE_PREFIX)) return null;
  const name = t.slice(WORKSPACE_PREFIX.length).trim();
  return name.length > 0 ? name : null;
}

/**
 * True when a chrome.bookmarks node is a dedicated workspace root folder.
 * @param {{url?: string, title?: string}} node
 * @returns {boolean}
 */
export function isWorkspaceFolder(node) {
  return Boolean(node && typeof node === "object" && !node.url && fromFolderTitle(node.title) !== null);
}
