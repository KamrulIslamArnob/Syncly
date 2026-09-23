/* ============================================================
   EnsureWorkspaceStructureUseCase — bootstrap/repair system folders

   For a given workspace, ensures the native tree contains:

     w-{name}
     ├── Collections
     └── Shortcuts

   Idempotent: repeated execute(workspaceId) never duplicates
   system folders. Repairs missing Collections/Shortcuts if the
   user deleted them. Never creates Quickie inside a workspace.

   Cache (chrome.storage.local.workspaceSystemFolders) is a
   convenience only — live tree is the source of truth.
   ============================================================ */

import { SYSTEM_FOLDER_TITLES } from "./ResolveWorkspaceStructureUseCase.js";

export class EnsureWorkspaceStructureUseCase {
  #resolve;
  #groupRepository;
  #bookmarks;
  #storage;
  #events;

  /**
   * @param {object} deps
   * @param {ResolveWorkspaceStructureUseCase} deps.resolve
   * @param {object} deps.groupRepository
   * @param {object} [deps.bookmarks]
   * @param {object} [deps.storage]
   * @param {object} [deps.events]
   */
  constructor({ resolve, groupRepository, bookmarks = null, storage = null, events = null } = {}) {
    this.#resolve = resolve;
    this.#groupRepository = groupRepository;
    this.#bookmarks = bookmarks || (typeof chrome !== "undefined" && chrome.bookmarks ? chrome.bookmarks : null);
    this.#storage = storage || (typeof chrome !== "undefined" && chrome.storage ? chrome.storage.local : null);
    this.#events = events;
  }

  /**
   * @param {string|object} workspaceIdOrParams
   * @param {object} [options]
   * @param {Array} [options.tree]
   * @returns {Promise<{
   *   workspaceId: string,
   *   rootFolderId: string|null,
   *   collectionsFolderId: string|null,
   *   shortcutsFolderId: string|null,
   *   created: string[],
   *   repaired: boolean
   * }>}
   */
  async execute(workspaceIdOrParams, options = {}) {
    const workspaceId =
      typeof workspaceIdOrParams === "string"
        ? workspaceIdOrParams
        : workspaceIdOrParams?.workspaceId;

    const created = [];
    const empty = {
      workspaceId: workspaceId || null,
      rootFolderId: null,
      collectionsFolderId: null,
      shortcutsFolderId: null,
      created,
      repaired: false,
    };

    if (!workspaceId || !this.#bookmarks) return empty;

    let tree = options.tree || null;
    if (!tree) {
      try {
        tree = await this.#bookmarks.getTree();
      } catch {
        return empty;
      }
    }

    let structure = await this.#resolve.execute({ workspaceId, tree });
    if (!structure.rootFolderId || !structure.root) {
      // Cannot bootstrap without a workspace root folder present in the live tree
      return { ...empty, rootFolderId: null };
    }

    const rootId = structure.rootFolderId;

    if (!structure.collectionsFolderId) {
      const node = await this.#ensureChild(rootId, SYSTEM_FOLDER_TITLES.collections, tree);
      if (node) {
        structure = { ...structure, collectionsFolderId: String(node.id) };
        created.push(SYSTEM_FOLDER_TITLES.collections);
      }
    }

    if (!structure.shortcutsFolderId) {
      // Re-fetch children after possible create so we don't fight siblings
      let freshTree = tree;
      if (created.length > 0 && this.#bookmarks.getTree) {
        try {
          freshTree = await this.#bookmarks.getTree();
          structure = await this.#resolve.execute({ workspaceId, tree: freshTree });
        } catch {
          /* keep previous structure */
        }
      }
      if (!structure.shortcutsFolderId) {
        const node = await this.#ensureChild(rootId, SYSTEM_FOLDER_TITLES.shortcuts, freshTree);
        if (node) {
          structure = { ...structure, shortcutsFolderId: String(node.id) };
          created.push(SYSTEM_FOLDER_TITLES.shortcuts);
        }
      }
    }

    const result = {
      workspaceId,
      rootFolderId: structure.rootFolderId,
      collectionsFolderId: structure.collectionsFolderId,
      shortcutsFolderId: structure.shortcutsFolderId,
      created,
      repaired: created.length > 0,
    };

    await this.#writeCache(workspaceId, {
      collectionsFolderId: result.collectionsFolderId,
      shortcutsFolderId: result.shortcutsFolderId,
      rootFolderId: result.rootFolderId,
    });

    // Keep group.rootFolderId / folderIds in sync when missing
    if (structure.group && !structure.group.rootFolderId) {
      try {
        if (this.#groupRepository?.save && typeof structure.group.updateRootFolderId === "function") {
          structure.group.updateRootFolderId(result.rootFolderId);
          await this.#groupRepository.save(structure.group);
        }
      } catch {
        /* non-fatal */
      }
    }

    if (created.length > 0 && this.#events) {
      this.#events.emit("bookmarkGroups:changed", { workspaceId, created });
    }

    return result;
  }

  async #ensureChild(parentId, title, tree) {
    // Look under parent in provided tree first
    const parentNode = tree ? this._findNodeById(tree, parentId) : null;
    if (parentNode && Array.isArray(parentNode.children)) {
      const existing = parentNode.children.find(
        (n) => !n.url && String(n.title || "").trim().toLowerCase() === title.toLowerCase()
      );
      if (existing) return existing;
    }

    try {
      const created = await this.#bookmarks.create({ parentId, title });
      return created;
    } catch (err) {
      console.warn(`EnsureWorkspaceStructure: could not create "${title}":`, err);
      return null;
    }
  }

  async #writeCache(workspaceId, entry) {
    if (!this.#storage?.get || !this.#storage?.set) return;
    try {
      const data = await this.#storage.get(["workspaceSystemFolders"]);
      const map = { ...(data?.workspaceSystemFolders && typeof data.workspaceSystemFolders === "object" ? data.workspaceSystemFolders : {}) };
      map[workspaceId] = entry;
      await this.#storage.set({ workspaceSystemFolders: map });
    } catch {
      /* cache is best-effort */
    }
  }

  _findNodeById(tree, id) {
    if (!Array.isArray(tree) || !id) return null;
    const target = String(id);
    const walk = (nodes) => {
      for (const n of nodes || []) {
        if (String(n.id) === target && !n.url) return n;
        if (Array.isArray(n.children)) {
          const found = walk(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    const roots =
      tree.length === 1 && (tree[0]?.id === "0" || tree[0]?.title === "") && tree[0]?.children
        ? tree[0].children
        : tree;
    return walk(roots);
  }
}
