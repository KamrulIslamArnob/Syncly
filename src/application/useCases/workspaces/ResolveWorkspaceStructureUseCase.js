/* ============================================================
   ResolveWorkspaceStructureUseCase — shared workspace context

   Resolves the native ownership boundary for one workspace:

     w-{name}
     ├── Collections   (system, workspace-owned)
     ├── Shortcuts     (system, workspace-owned)
     └── …sidebar folders (workspace-owned)

   Quickie is NEVER part of this structure (global only).
   Read-only: does not create missing system folders —
   use EnsureWorkspaceStructureUseCase for bootstrap/repair.
   ============================================================ */

import { toFolderTitle, fromFolderTitle, isWorkspaceFolder } from "../../../domain/services/workspaceNaming.js";

export const SYSTEM_FOLDER_TITLES = Object.freeze({
  collections: "Collections",
  shortcuts: "Shortcuts",
  quickie: "Quickie",
});

export class ResolveWorkspaceStructureUseCase {
  #groupRepository;
  #bookmarks;
  #storage;

  /**
   * @param {object} deps
   * @param {{ findAll(): Promise<Array>, findById(id): Promise<object|null> }} deps.groupRepository
   * @param {object} [deps.bookmarks] chrome.bookmarks (or mock)
   * @param {object} [deps.storage] chrome.storage.local (or mock) for cache read
   */
  constructor({ groupRepository, bookmarks = null, storage = null } = {}) {
    this.#groupRepository = groupRepository;
    this.#bookmarks = bookmarks || (typeof chrome !== "undefined" && chrome.bookmarks ? chrome.bookmarks : null);
    this.#storage = storage || (typeof chrome !== "undefined" && chrome.storage ? chrome.storage.local : null);
  }

  /**
   * @param {object} params
   * @param {string} params.workspaceId
   * @param {Array} [params.tree] pre-fetched getTree() output
   * @param {object|null} [params.group] pre-resolved BookmarkGroup
   * @returns {Promise<{
   *   workspaceId: string|null,
   *   rootFolderId: string|null,
   *   collectionsFolderId: string|null,
   *   shortcutsFolderId: string|null,
   *   sidebarFolders: Array<{id: string, title: string, node?: object}>,
   *   root: object|null,
   *   group: object|null,
   *   found: boolean
   * }>}
   */
  async execute({ workspaceId, tree: providedTree = null, group: providedGroup = null } = {}) {
    const empty = {
      workspaceId: workspaceId || null,
      rootFolderId: null,
      collectionsFolderId: null,
      shortcutsFolderId: null,
      sidebarFolders: [],
      root: null,
      group: null,
      found: false,
    };

    if (!workspaceId) return empty;

    let group = providedGroup;
    if (!group && this.#groupRepository?.findById) {
      group = await this.#groupRepository.findById(workspaceId).catch(() => null);
    }
    if (!group && this.#groupRepository?.findAll) {
      const all = await this.#groupRepository.findAll().catch(() => []);
      group = all.find((g) => g.id === workspaceId) || null;
    }
    if (!group) return { ...empty, workspaceId };

    let tree = providedTree;
    if (!tree && this.#bookmarks?.getTree) {
      try {
        tree = await this.#bookmarks.getTree();
      } catch {
        tree = null;
      }
    }

    const cache = await this.#readCache(workspaceId);
    let rootId = group.rootFolderId || (Array.isArray(group.folderIds) ? group.folderIds[0] : null);
    let rootNode = rootId && tree ? this._findNodeById(tree, rootId) : null;

    // Repair root id if stale: find by w-{name} under Other Bookmarks
    if (!rootNode && tree) {
      const wanted = toFolderTitle(group.name).toLowerCase();
      rootNode = this._findWorkspaceRootByTitle(tree, wanted) || this._findWorkspaceRootByTitle(tree, group.name);
      if (rootNode) rootId = String(rootNode.id);
    }

    if (!rootNode) {
      return {
        ...empty,
        workspaceId,
        group,
        rootFolderId: rootId || null,
        collectionsFolderId: cache?.collectionsFolderId || null,
        shortcutsFolderId: cache?.shortcutsFolderId || null,
        found: false,
      };
    }

    const children = Array.isArray(rootNode.children) ? rootNode.children : [];
    const isFolder = (n) => Boolean(n && !n.url && (n.children !== undefined || n.type === "folder" || !n.url));
    const titleEq = (n, t) => String(n?.title || "").trim().toLowerCase() === t.toLowerCase();

    let collectionsNode = children.find((n) => isFolder(n) && titleEq(n, SYSTEM_FOLDER_TITLES.collections)) || null;
    let shortcutsNode = children.find((n) => isFolder(n) && titleEq(n, SYSTEM_FOLDER_TITLES.shortcuts)) || null;

    // Fall back to cache if present in tree by id but not matched by title (edge)
    if (!collectionsNode && cache?.collectionsFolderId) {
      collectionsNode = children.find((n) => String(n.id) === String(cache.collectionsFolderId)) || null;
    }
    if (!shortcutsNode && cache?.shortcutsFolderId) {
      shortcutsNode = children.find((n) => String(n.id) === String(cache.shortcutsFolderId)) || null;
    }

    const systemIds = new Set(
      [collectionsNode, shortcutsNode]
        .filter(Boolean)
        .map((n) => String(n.id))
    );

    const sidebarFolders = children
      .filter((n) => isFolder(n))
      .filter((n) => !systemIds.has(String(n.id)))
      .filter((n) => !titleEq(n, SYSTEM_FOLDER_TITLES.quickie))
      .filter((n) => !isWorkspaceFolder(n)) // nested w-* should not appear as sidebar
      .map((n) => ({ id: String(n.id), title: String(n.title || ""), node: n }));

    return {
      workspaceId,
      rootFolderId: String(rootNode.id),
      collectionsFolderId: collectionsNode ? String(collectionsNode.id) : null,
      shortcutsFolderId: shortcutsNode ? String(shortcutsNode.id) : null,
      sidebarFolders,
      root: rootNode,
      group,
      found: true,
    };
  }

  async #readCache(workspaceId) {
    if (!this.#storage?.get) return null;
    try {
      const data = await this.#storage.get(["workspaceSystemFolders"]);
      const map = data?.workspaceSystemFolders;
      if (map && typeof map === "object") return map[workspaceId] || null;
    } catch {
      /* ignore */
    }
    return null;
  }

  _unwrapRoots(tree) {
    return Array.isArray(tree) &&
      tree.length === 1 &&
      (tree[0]?.id === "0" || tree[0]?.title === "") &&
      Array.isArray(tree[0]?.children)
      ? tree[0].children
      : tree;
  }

  _findNodeById(tree, id) {
    if (!Array.isArray(tree) || !id) return null;
    const target = String(id);
    const walk = (nodes) => {
      if (!Array.isArray(nodes)) return null;
      for (const n of nodes) {
        if (String(n.id) === target && !n.url) return n;
        if (Array.isArray(n.children)) {
          const found = walk(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    return walk(this._unwrapRoots(tree));
  }

  _findWorkspaceRootByTitle(tree, titleWanted) {
    if (!Array.isArray(tree) || !titleWanted) return null;
    const wanted = String(titleWanted).trim().toLowerCase();
    const roots = this._unwrapRoots(tree);
    for (const r of roots) {
      if (r.id === "2" || /other bookmarks|all bookmarks/i.test(r.title || "")) {
        for (const child of Array.isArray(r.children) ? r.children : []) {
          if (child.url) continue;
          const t = String(child.title || "").trim().toLowerCase();
          if (t === wanted || t === toFolderTitle(titleWanted).toLowerCase() || fromFolderTitle(child.title)?.toLowerCase() === String(titleWanted).replace(/^w-/i, "").toLowerCase()) {
            return child;
          }
        }
      }
    }
    // deeper search fallback
    const walk = (nodes) => {
      for (const n of nodes || []) {
        if (!n.url && isWorkspaceFolder(n)) {
          const stripped = fromFolderTitle(n.title);
          if (stripped && (stripped.toLowerCase() === wanted.replace(/^w-/i, "") || String(n.title).toLowerCase() === wanted)) {
            return n;
          }
        }
        if (Array.isArray(n.children)) {
          const found = walk(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    return walk(roots);
  }
}
