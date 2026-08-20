/* ============================================================
   TreeView — bookmark tree pure helpers and data transformers
   for Chrome bookmarks (chrome.bookmarks.getTree).
   ============================================================ */

/* ── Pure helpers (unit-testable, no DOM) ─────────────────── */

/**
 * Return a normalized http(s) URL, or null if the input is not a
 * safe navigable URL. Blocks javascript:, data:, vbscript:, file:,
 * and any other scheme. Relative strings are NOT auto-prefixed.
 * @param {unknown} url
 * @returns {string|null}
 */
export function isSafeUrl(url) {
  if (typeof url !== "string" || url.length === 0) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  return /^https?:$/i.test(parsed.protocol) ? parsed.href : null;
}

/**
 * Build a nested, typed tree from chrome.bookmarks.getTree() output,
 * preserving Chrome's own hierarchy and ordering. The synthetic root
 * node (id "0", empty title) is unwrapped so its named roots
 * ("Bookmarks Bar", "Other Bookmarks", …) become the top level.
 * Folders that contain no bookmark at any depth are pruned so the
 * tree stays clean. Unsafe bookmark URLs become url:null (rendered
 * as blocked, non-navigable links).
 *
 * Node shape:
 *   { id, title, type: "folder"|"bookmark", url, children, count }
 * where `count` is the number of bookmark descendants (folders) or 1
 * (bookmarks).
 * @param {unknown} roots
 * @returns {Array<object>}
 */
export function buildBookmarkTree(roots, { pruneEmpty = true } = {}) {
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

  const node = (n) => {
    if (!n || typeof n !== "object") return null;
    const isBookmark = typeof n.url === "string" && n.url.length > 0;
    if (isBookmark) {
      const title =
        typeof n.title === "string" && n.title.length > 0 ? n.title : n.url;
      return {
        id: String(n.id ?? title),
        title,
        type: "bookmark",
        url: isSafeUrl(n.url),
        children: [],
        count: 1,
      };
    }
    const title =
      typeof n.title === "string" && n.title.length > 0 ? n.title : "Folder";
    const children = Array.isArray(n.children)
      ? n.children.map(node).filter(Boolean)
      : [];
    const count = children.reduce((s, c) => s + c.count, 0);
    if (pruneEmpty && count === 0) return null; // prune empty folders when requested
    return {
      id: String(n.id ?? title),
      title,
      type: "folder",
      url: null,
      children,
      count,
    };
  };

  return top.map(node).filter(Boolean);
}

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

/**
 * Filter a nested tree for a case-insensitive query. Bookmarks are
 * kept when title/url matches. A folder is kept when its own title
 * matches (with all descendants) or it has any matching descendant
 * (ancestor chain preserved). Empty query returns the tree as-is.
 * @param {Array<object>} nodes
 * @param {string} query
 * @returns {Array<object>}
 */
export function filterTree(nodes, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return nodes;
  const out = [];
  for (const n of nodes) {
    if (n.type === "bookmark") {
      if (
        (n.title || "").toLowerCase().includes(q) ||
        (n.url || "").toLowerCase().includes(q)
      ) {
        out.push(n);
      }
    } else if ((n.title || "").toLowerCase().includes(q)) {
      out.push(n); // folder name matches → keep whole subtree
    } else {
      const kids = filterTree(n.children, q);
      if (kids.length > 0) {
        out.push({ ...n, children: kids, count: countLeaves(kids) });
      }
    }
  }
  return out;
}

/** Count bookmark leaves in a nested node list. */
export function countLeaves(nodes) {
  let c = 0;
  for (const n of nodes) {
    if (n.type === "bookmark") c += 1;
    else c += countLeaves(n.children);
  }
  return c;
}

/* ── Tree style (kept for test compatibility) ───────────── */

export const DEFAULT_TREE_STYLE = "organic";
export const TREE_STYLES = ["organic", "editor"];

export function isValidTreeStyle(s) {
  return TREE_STYLES.includes(s);
}

export function normalizeTreeStyle(s) {
  return isValidTreeStyle(s) ? s : DEFAULT_TREE_STYLE;
}

export function cycleTreeStyle(s) {
  return normalizeTreeStyle(s) === "editor" ? "organic" : "editor";
}

export function readTreeStyle(store) {
  try {
    const v =
      store && typeof store.getItem === "function"
        ? store.getItem("ntab:treeStyle")
        : null;
    return normalizeTreeStyle(v || undefined);
  } catch {
    return DEFAULT_TREE_STYLE;
  }
}

