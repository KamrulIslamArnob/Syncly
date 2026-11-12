import { bookmarkRoots, findBookmarkNode } from "../../domain/services/bookmarkRoots.js";

const MODES = new Set(["chrome", "workspace", "both"]);
export const BOOKMARK_LIBRARY_KEY = "bookmarkLibrary";
const queues = new Map();
async function withLibraryLock(name, work) {
  if (globalThis.navigator?.locks) return navigator.locks.request(`syncly:${name}`, work);
  const pending = (queues.get(name) || Promise.resolve()).catch(() => {}).then(work);
  queues.set(name, pending);
  try { return await pending; } finally { if (queues.get(name) === pending) queues.delete(name); }
}

/** Local preferences and native bindings; deliberately bypass storage.sync. */
export class BookmarkLibraryService {
  constructor({ storage, bookmarks } = {}) {
    this.storage = storage || globalThis.chrome?.storage?.local;
    this.bookmarks = bookmarks || globalThis.chrome?.bookmarks;
    this._pending = null;
  }

  async getSettings() {
    const data = await this.storage?.get([BOOKMARK_LIBRARY_KEY, "synclySetupPending"]) || {};
    return { version: 1, mode: "legacy", layout: "legacy", completed: !data.synclySetupPending,
      ...(data[BOOKMARK_LIBRARY_KEY] || {}), needsSetup: !!data.synclySetupPending };
  }

  async setSources(mode) {
    if (!MODES.has(mode) && mode !== "legacy") throw new Error("Choose Chrome bookmarks, workspace folders, or both.");
    const settings = await this.getSettings();
    const { needsSetup, ...saved } = settings;
    await this.storage.set({ [BOOKMARK_LIBRARY_KEY]: { ...saved, mode } });
    return { ...settings, mode };
  }

  async inspect() {
    const tree = await this.bookmarks.getTree();
    return { tree, roots: bookmarkRoots(tree, "other", { writable: true }),
      bars: bookmarkRoots(tree, "bookmarks-bar"), settings: await this.getSettings() };
  }

  async completeSetup({ mode, parentId, libraryId, skip = false, reconnect = false }) {
    if (!MODES.has(mode)) throw new Error("Choose a bookmark view.");
    if (skip) {
      return withLibraryLock("setup", async () => {
        const current = await this.getSettings();
        if (current.completed && !current.needsSetup) return current;
        const { needsSetup, ...saved } = current;
        await this.storage.set({ [BOOKMARK_LIBRARY_KEY]: { ...saved, mode, completed: false, creationDeferred: true }, synclySetupPending: false });
        return this.getSettings();
      });
    }
    // One writer per context; completion state is rechecked inside the queue.
    if (this._pending) return this._pending;
    this._pending = withLibraryLock("setup", () => this._complete({ mode, parentId, libraryId, reconnect })).finally(() => { this._pending = null; });
    return this._pending;
  }

  async _complete({ mode, parentId, libraryId, reconnect }) {
    const { tree, roots, settings } = await this.inspect();
    if (!reconnect && !settings.needsSetup && settings.completed) return this.setSources(mode);
    const parent = parentId ? roots.find(n => n.id === parentId) : roots.length === 1 ? roots[0] : null;
    if (!parent) throw new Error("Choose a writable Chrome bookmark location.");
    const reuse = findBookmarkNode(tree, libraryId || (!settings.completed && settings.rootId));
    if (reuse && parent.children?.some(n => n.id === reuse.id) && !reuse.url && !reuse.unmodifiable) {
      let spaces = reuse.children?.find(n => !n.url && n.title === "Workspaces");
      if (!spaces && reuse.id !== settings.rootId) throw new Error("Choose a Syncly library containing Workspaces.");
      if (!spaces) spaces = await this.bookmarks.create({ parentId: reuse.id, title: "Workspaces" });
      await this.storage.set({ [BOOKMARK_LIBRARY_KEY]: { version: 1, mode, layout: "managed", completed: true,
        nativeParentId: parent.id, rootId: reuse.id, workspacesParentId: spaces.id }, synclySetupPending: false });
      return this.getSettings();
    }
    if (libraryId) throw new Error("The selected Syncly folder is unavailable. Reload setup and choose again.");
    if (reconnect && settings.completed) {
      if (settings.layout === "managed") throw new Error("Choose your existing Syncly folder. If it is not listed yet, wait for Chrome to finish syncing.");
      const { needsSetup, ...saved } = settings;
      await this.storage.set({ [BOOKMARK_LIBRARY_KEY]: { ...saved, mode, nativeParentId: parent.id }, synclySetupPending: false });
      return this.getSettings();
    }
    const oldData = await this.storage.get(["bookmarkGroups", "quickieFolderId", "shortcutsFolderId", "collectionsFolderId"]);
    const legacy = roots.some(n => n.children?.some(c => /^w-/.test(c.title || "")))
      || oldData.bookmarkGroups?.length || ["quickieFolderId", "shortcutsFolderId", "collectionsFolderId"].some(k => !!findBookmarkNode(tree, oldData[k]));
    let saved = { version: 1, mode, layout: legacy ? "legacy" : "managed", completed: true, nativeParentId: parent.id };
    if (!legacy) {
      // Never claim ownership of an arbitrary user folder by name alone.
      if (parent.children?.some(n => !n.url && n.title === "Syncly")) {
        throw new Error("A Syncly folder already exists. Use Skip for now to keep it unchanged.");
      }
      const root = await this.bookmarks.create({ parentId: parent.id, title: "Syncly" });
      saved = { ...saved, rootId: root.id };
      // Persist ownership immediately so an interrupted setup can be recovered.
      await this.storage.set({ [BOOKMARK_LIBRARY_KEY]: { ...saved, completed: false } });
      const workspaces = await this.bookmarks.create({ parentId: root.id, title: "Workspaces" });
      saved.workspacesParentId = workspaces.id;
    }
    await this.storage.set({ [BOOKMARK_LIBRARY_KEY]: saved, synclySetupPending: false });
    return this.getSettings();
  }

  async ensureGlobalFolder(title, key, { allowCreate = true } = {}) {
    return withLibraryLock(`folder:${key}`, async () => {
      const location = await this.resolve();
      if (!location) return null;
      const tree = await this.bookmarks.getTree();
      const parent = findBookmarkNode(tree, location.parentId);
      if (!parent || parent.unmodifiable) throw new Error("Your bookmark location is unavailable.");
      const data = await this.storage.get([key]);
      let node = parent.children?.find(n => n.id === data[key] && !n.url)
        || parent.children?.find(n => !n.url && n.title === title && !n.unmodifiable);
      if (!node) {
        if (!allowCreate) return null;
        node = await this.bookmarks.create({ parentId: parent.id, title });
      }
      await this.storage.set({ [key]: node.id });
      return node.id;
    });
  }

  async resolve({ ensure = false, tree: providedTree } = {}) {
    const settings = await this.getSettings();
    if (settings.needsSetup) return null;
    const tree = providedTree || await this.bookmarks.getTree();
    if (settings.layout !== "managed") {
      const roots = bookmarkRoots(tree, "other", { writable: true });
      const parent = settings.nativeParentId ? roots.find(n => n.id === settings.nativeParentId)
        : roots.length === 1 ? roots[0] : null;
      if (!parent) throw new Error("Your Chrome bookmark location is unavailable. Choose a location in Bookmarks settings.");
      return { parentId: parent.id, workspacesParentId: parent.id, layout: "legacy", syncing: parent.syncing };
    }
    const root = findBookmarkNode(tree, settings.rootId);
    if (!root || root.url || root.unmodifiable) throw new Error("Your Syncly folder is unavailable. It may still be syncing; existing bookmarks have been left unchanged.");
    let workspaces = root.children?.find(n => n.id === settings.workspacesParentId)
      || root.children?.find(n => !n.url && n.title === "Workspaces");
    if (!workspaces && ensure) {
      if (settings.workspacesParentId) throw new Error("Your workspace folders are unavailable. Wait for Chrome to finish syncing before creating another workspace.");
      workspaces = await withLibraryLock("structure", async () => {
        const fresh = findBookmarkNode(await this.bookmarks.getTree(), root.id);
        if (!fresh) throw new Error("Your Syncly folder is unavailable.");
        const node = fresh.children?.find(n => !n.url && n.title === "Workspaces")
          || await this.bookmarks.create({ parentId: root.id, title: "Workspaces" });
        const { needsSetup, ...saved } = await this.getSettings();
        await this.storage.set({ [BOOKMARK_LIBRARY_KEY]: { ...saved, workspacesParentId: node.id } });
        return node;
      });
    }
    return { parentId: root.id, workspacesParentId: workspaces?.id || null, rootId: root.id, layout: "managed", syncing: root.syncing };
  }
}
