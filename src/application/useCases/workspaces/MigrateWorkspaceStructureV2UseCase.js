/* ============================================================
   MigrateWorkspaceStructureV2UseCase — legacy → workspace-owned system folders

   Pre-v2 layout:
     Other Bookmarks
     ├── Quickie
     ├── Collections     (global)
     ├── Shortcuts       (global)
     └── w-Work / w-Personal …

   Target v2:
     Other Bookmarks
     ├── Quickie                    (unchanged, global)
     └── w-Work
         ├── Collections
         └── Shortcuts

   Rules:
   - Idempotent / restart-safe (workspaceStructureVersion: 2).
   - Never guess ownership of global Shortcuts content.
   - Never move Quickie.
   - Moves collection native folders using collection.workspaceId when valid.
   ============================================================ */

const VERSION_KEY = "workspaceStructureVersion";
const TARGET_VERSION = 2;

export class MigrateWorkspaceStructureV2UseCase {
  #groupRepository;
  #collectionRepository;
  #ensureWorkspaceStructure;
  #resolve;
  #bookmarks;
  #storage;
  #events;

  constructor({
    groupRepository,
    collectionRepository = null,
    ensureWorkspaceStructure,
    resolve,
    bookmarks = null,
    storage = null,
    events = null,
  } = {}) {
    this.#groupRepository = groupRepository;
    this.#collectionRepository = collectionRepository;
    this.#ensureWorkspaceStructure = ensureWorkspaceStructure;
    this.#resolve = resolve;
    this.#bookmarks = bookmarks || (typeof chrome !== "undefined" && chrome.bookmarks ? chrome.bookmarks : null);
    this.#storage = storage || (typeof chrome !== "undefined" && chrome.storage ? chrome.storage.local : null);
    this.#events = events;
  }

  /**
   * @returns {Promise<{
   *   version: number,
   *   alreadyMigrated: boolean,
   *   workspaces: Array<{workspaceId, created}>,
   *   collectionsMoved: number,
   *   collectionsSkipped: number,
   *   quickieUntouched: boolean
   * }>}
   */
  async execute({ force = false } = {}) {
    const summary = {
      version: TARGET_VERSION,
      alreadyMigrated: false,
      workspaces: [],
      collectionsMoved: 0,
      collectionsSkipped: 0,
      quickieUntouched: true,
    };

    if (!this.#bookmarks || !this.#groupRepository) return summary;

    if (!force) {
      const current = await this.#readVersion();
      if (current >= TARGET_VERSION) {
        summary.alreadyMigrated = true;
        return summary;
      }
    }

    let tree;
    try {
      tree = await this.#bookmarks.getTree();
    } catch {
      return summary;
    }

    const groups = await this.#groupRepository.findAll().catch(() => []);

    // Step 1–2: ensure structure under every workspace root
    for (const group of groups) {
      try {
        const res = await this.#ensureWorkspaceStructure.execute(group.id, { tree });
        summary.workspaces.push({ workspaceId: group.id, created: res.created || [] });
        // refresh tree after creates
        tree = await this.#bookmarks.getTree().catch(() => tree);
      } catch (err) {
        console.warn("MigrateWorkspaceStructureV2: ensure failed for", group.id, err);
      }
    }

    // Step 3: move collection folders into correct workspace Collections parent
    if (this.#collectionRepository?.findAll) {
      const collections = await this.#collectionRepository.findAll().catch(() => []);
      for (const coll of collections) {
        const wsId = coll.workspaceId;
        if (!wsId || !coll.folderId) {
          summary.collectionsSkipped += 1;
          continue;
        }
        const structure = await this.#resolve.execute({ workspaceId: wsId, tree }).catch(() => null);
        if (!structure?.collectionsFolderId) {
          summary.collectionsSkipped += 1;
          continue;
        }
        try {
          const node = this._findNodeById(tree, coll.folderId);
          if (!node) {
            summary.collectionsSkipped += 1;
            continue;
          }
          // Already under correct parent?
          if (String(node.parentId || "") === String(structure.collectionsFolderId)) continue;
          await this.#bookmarks.move(coll.folderId, { parentId: structure.collectionsFolderId });
          summary.collectionsMoved += 1;
          tree = await this.#bookmarks.getTree().catch(() => tree);
        } catch (err) {
          console.warn("MigrateWorkspaceStructureV2: move collection failed", coll.id, err);
          summary.collectionsSkipped += 1;
        }
      }
    }

    // Step 4: global Shortcuts — DO NOT GUESS ownership; leave intact.
    // Step 5: Quickie untouched (never targeted by this migration).

    await this.#writeVersion(TARGET_VERSION);
    if (this.#events) {
      this.#events.emit("bookmarkGroups:changed", { migration: "workspace-structure-v2" });
      this.#events.emit("bookmarkCollections:changed", { migration: "workspace-structure-v2" });
    }
    return summary;
  }

  async #readVersion() {
    if (!this.#storage?.get) return 0;
    try {
      const data = await this.#storage.get([VERSION_KEY]);
      return Number(data?.[VERSION_KEY]) || 0;
    } catch {
      return 0;
    }
  }

  async #writeVersion(v) {
    if (!this.#storage?.set) return;
    try {
      await this.#storage.set({ [VERSION_KEY]: v });
    } catch {
      /* ignore */
    }
  }

  _findNodeById(tree, id) {
    if (!Array.isArray(tree) || !id) return null;
    const target = String(id);
    const walk = (nodes) => {
      for (const n of nodes || []) {
        if (String(n.id) === target) return n;
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
