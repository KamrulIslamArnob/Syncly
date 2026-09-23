import test from "node:test";
import assert from "node:assert/strict";

import { ResolveWorkspaceStructureUseCase, SYSTEM_FOLDER_TITLES } from "../src/application/useCases/workspaces/ResolveWorkspaceStructureUseCase.js";
import { EnsureWorkspaceStructureUseCase } from "../src/application/useCases/workspaces/EnsureWorkspaceStructureUseCase.js";
import { MigrateWorkspaceStructureV2UseCase } from "../src/application/useCases/workspaces/MigrateWorkspaceStructureV2UseCase.js";
import { CreateBookmarkGroup } from "../src/application/useCases/CreateBookmarkGroup.js";
import { DeleteBookmarkGroup } from "../src/application/useCases/DeleteBookmarkGroup.js";
import { UpdateBookmarkGroup } from "../src/application/useCases/UpdateBookmarkGroup.js";
import { ListBookmarkCollectionsUseCase } from "../src/application/useCases/collections/ListBookmarkCollectionsUseCase.js";
import { CreateBookmarkCollectionUseCase } from "../src/application/useCases/collections/CreateBookmarkCollectionUseCase.js";
import { EnsureShortcutsFolderUseCase } from "../src/application/useCases/bookmarks/EnsureShortcutsFolderUseCase.js";
import { ResolveShortcutsFolderUseCase } from "../src/application/useCases/bookmarks/ResolveShortcutsFolderUseCase.js";
import { BookmarkGroup } from "../src/domain/entities/BookmarkGroup.js";
import { BookmarkCollection } from "../src/domain/entities/BookmarkCollection.js";
import { EventBus } from "../src/application/ports/EventBus.js";

function createMockStorage(initial = {}) {
  const store = { ...initial };
  return {
    async get(keys) {
      if (typeof keys === "string") return { [keys]: store[keys] };
      if (Array.isArray(keys)) {
        const out = {};
        for (const k of keys) out[k] = store[k];
        return out;
      }
      return { ...store };
    },
    async set(items) {
      Object.assign(store, items);
    },
    raw: store,
  };
}

function createMemoryCollectionRepo(items = []) {
  const rows = new Map(items.map((c) => [c.id, c]));
  return {
    async findAll() {
      return [...rows.values()].map((c) => (c instanceof BookmarkCollection ? c : BookmarkCollection.fromJSON(c)));
    },
    async findById(id) {
      const c = rows.get(id);
      return c ? (c instanceof BookmarkCollection ? c : BookmarkCollection.fromJSON(c)) : null;
    },
    async save(entity) {
      rows.set(entity.id, entity);
      return entity;
    },
    async delete(id) {
      rows.delete(id);
    },
  };
}

function createMemoryGroupRepo(items = []) {
  const rows = new Map(items.map((g) => [g.id, g]));
  return {
    async findAll() {
      return [...rows.values()];
    },
    async findById(id) {
      return rows.get(id) || null;
    },
    async save(entity) {
      rows.set(entity.id, entity);
      return entity;
    },
    async delete(id) {
      rows.delete(id);
    },
  };
}

function makeTree(otherChildren) {
  return [{
    id: "0",
    title: "",
    children: [
      { id: "1", title: "Bookmarks bar", children: [] },
      { id: "2", title: "Other bookmarks", children: otherChildren },
    ],
  }];
}

function folder(id, title, children = []) {
  return { id, title, children };
}

function createBookmarkApi(tree, { created = [] } = {}) {
  let nextId = 1000;
  return {
    async getTree() {
      return tree;
    },
    async create({ parentId, title, url }) {
      const node = { id: String(nextId++), title, children: [] };
      if (url) {
        delete node.children;
        node.url = url;
      }
      created.push(node);
      const walk = (nodes) => {
        for (const n of nodes || []) {
          if (String(n.id) === String(parentId)) {
            n.children = n.children || [];
            n.children.push(node);
            return true;
          }
          if (Array.isArray(n.children) && walk(n.children)) return true;
        }
        return false;
      };
      walk(tree);
      return node;
    },
    async move(id, { parentId }) {
      let moved = null;
      const walk = (nodes) => {
        for (let i = 0; i < (nodes || []).length; i++) {
          const n = nodes[i];
          if (String(n.id) === String(id)) {
            moved = n;
            nodes.splice(i, 1);
            break;
          }
          if (Array.isArray(n.children) && walk(n.children)) break;
        }
      };
      walk(tree);
      if (!moved) throw new Error("not found");
      const walkParent = (nodes) => {
        for (const n of nodes || []) {
          if (String(n.id) === String(parentId)) {
            n.children = n.children || [];
            n.children.push(moved);
            return true;
          }
          if (Array.isArray(n.children) && walkParent(n.children)) return true;
        }
        return false;
      };
      if (!walkParent(tree)) throw new Error("parent not found");
      return moved;
    },
  };
}

test("ResolveWorkspaceStructure: returns workspace root + system folders + sidebar children", async () => {
  const group = { id: "ws-1", name: "Work", folderIds: ["w1"], rootFolderId: "w1" };
  const tree = makeTree([
    folder("w1", "w-Work", [
      folder("c1", "Collections", [folder("c1a", "Design")]),
      folder("s1", "Shortcuts", []),
      folder("f1", "Projects", []),
      folder("q1", "Quickie", []),
      folder("w-nested", "w-Other", []),
    ]),
  ]);
  const storage = createMockStorage({
    workspaceSystemFolders: {
      "ws-1": { collectionsFolderId: "c1", shortcutsFolderId: "s1", rootFolderId: "w1" },
    },
  });

  const useCase = new ResolveWorkspaceStructureUseCase({
    groupRepository: createMemoryGroupRepo([group]),
    storage,
  });

  const result = await useCase.execute({ workspaceId: "ws-1", tree });
  assert.equal(result.rootFolderId, "w1");
  assert.equal(result.collectionsFolderId, "c1");
  assert.equal(result.shortcutsFolderId, "s1");
  assert.equal(result.sidebarFolders.length, 1);
  assert.equal(result.sidebarFolders[0].id, "f1");
  assert.equal(result.sidebarFolders[0].title, "Projects");
  assert.ok(result.found);
});

test("ResolveWorkspaceStructure: empty when workspace missing or root absent", async () => {
  const useCase = new ResolveWorkspaceStructureUseCase({
    groupRepository: createMemoryGroupRepo([]),
    storage: createMockStorage(),
  });
  const missing = await useCase.execute({ workspaceId: "nope", tree: makeTree([]) });
  assert.equal(missing.found, false);
  assert.equal(missing.rootFolderId, null);

  const noRoot = await useCase.execute({ workspaceId: undefined, tree: makeTree([]) });
  assert.equal(noRoot.rootFolderId, null);
});

test("EnsureWorkspaceStructure: creates Collections + Shortcuts under w-* root idempotently", async () => {
  const group = new BookmarkGroup({
    id: "ws-1",
    name: "Work",
    icon: "folder",
    folderIds: ["w1"],
    rootFolderId: "w1",
  });
  const tree = makeTree([folder("w1", "w-Work", [])]);
  const created = [];
  const bookmarks = createBookmarkApi(tree, { created });
  const storage = createMockStorage();
  const events = new EventBus();
  const emitted = [];
  events.on("bookmarkGroups:changed", (p) => emitted.push(p));

  const resolve = new ResolveWorkspaceStructureUseCase({
    groupRepository: createMemoryGroupRepo([group]),
    storage,
  });
  const ensure = new EnsureWorkspaceStructureUseCase({
    resolve,
    groupRepository: createMemoryGroupRepo([group]),
    bookmarks,
    storage,
    events,
  });

  const first = await ensure.execute("ws-1", { tree });
  assert.equal(first.rootFolderId, "w1");
  assert.ok(first.collectionsFolderId);
  assert.ok(first.shortcutsFolderId);
  assert.equal(first.created.length, 2);
  assert.equal(emitted.length, 1);

  const second = await ensure.execute("ws-1");
  assert.equal(second.created.length, 0);
  assert.equal(second.repaired, false);
  assert.equal(emitted.length, 1);

  const cache = storage.raw.workspaceSystemFolders["ws-1"];
  assert.equal(cache.rootFolderId, "w1");
  assert.equal(cache.collectionsFolderId, first.collectionsFolderId);
  assert.equal(cache.shortcutsFolderId, first.shortcutsFolderId);

  // Quickie never created inside workspace
  const titles = created.map((n) => n.title);
  assert.ok(!titles.includes("Quickie"));
  assert.ok(titles.includes("Collections"));
  assert.ok(titles.includes("Shortcuts"));
});

test("EnsureWorkspaceStructure: returns empty when root folder is missing", async () => {
  const group = { id: "ws-1", name: "Work", folderIds: ["gone"], rootFolderId: "gone" };
  const tree = makeTree([folder("w1", "w-Other", [])]);
  const bookmarks = createBookmarkApi(tree);
  const resolve = new ResolveWorkspaceStructureUseCase({
    groupRepository: createMemoryGroupRepo([group]),
    storage: createMockStorage(),
  });
  const ensure = new EnsureWorkspaceStructureUseCase({
    resolve,
    groupRepository: createMemoryGroupRepo([group]),
    bookmarks,
    storage: createMockStorage(),
  });
  const result = await ensure.execute("ws-1", { tree });
  assert.equal(result.rootFolderId, null);
  assert.equal(result.collectionsFolderId, null);
  assert.equal(result.created.length, 0);
});

test("MigrateWorkspaceStructureV2: bootstraps workspaces, moves scoped collections, skips unscoped, leaves Quickie", async () => {
  const group = new BookmarkGroup({
    id: "ws-1",
    name: "Work",
    icon: "folder",
    folderIds: ["w1"],
    rootFolderId: "w1",
  });
  const tree = makeTree([
    folder("q", "Quickie", [folder("qi", "Inbox", [])]),
    folder("globColl", "Collections", [folder("owned", "Scoped", [])]),
    folder("globShort", "Shortcuts", []),
    folder("w1", "w-Work", []),
  ]);
  const bookmarks = createBookmarkApi(tree);
  const storage = createMockStorage();
  const events = new EventBus();
  const emitted = [];
  events.on("bookmarkGroups:changed", (p) => emitted.push(p));
  events.on("bookmarkCollections:changed", (p) => emitted.push(p));

  const collectionRepo = createMemoryCollectionRepo([
    { id: "owned", name: "Scoped", bookmarkIds: [], bookmarkUrls: [], workspaceId: "ws-1", folderId: "owned" },
    { id: "orphan", name: "Orphan", bookmarkIds: [], bookmarkUrls: [], workspaceId: null, folderId: "globColl" },
  ]);

  const groupRepo = createMemoryGroupRepo([group]);
  const resolve = new ResolveWorkspaceStructureUseCase({ groupRepository: groupRepo, storage });
  const ensure = new EnsureWorkspaceStructureUseCase({
    resolve,
    groupRepository: groupRepo,
    bookmarks,
    storage,
    events,
  });
  const migrate = new MigrateWorkspaceStructureV2UseCase({
    groupRepository: groupRepo,
    collectionRepository: collectionRepo,
    ensureWorkspaceStructure: ensure,
    resolve,
    bookmarks,
    storage,
    events,
  });

  const summary = await migrate.execute();
  assert.equal(summary.alreadyMigrated, false);
  assert.equal(summary.workspaces.length, 1);
  assert.equal(summary.collectionsMoved, 1);
  assert.equal(summary.quickieUntouched, true);

  // Quickie still under Other Bookmarks
  const other = tree[0].children.find((n) => n.id === "2");
  const quickie = other.children.find((n) => n.title === "Quickie");
  assert.ok(quickie);
  assert.equal(quickie.parentId, undefined);
  assert.equal(other.children.filter((n) => n.title === "Quickie").length, 1);

  // Scoped collection moved under w-Work/Collections
  const structure = await resolve.execute({ workspaceId: "ws-1", tree });
  const collectionsNode = structure.root.children.find((n) => n.title === "Collections");
  assert.ok(collectionsNode);
  assert.ok(collectionsNode.children.some((n) => n.id === "owned"));

  // Version stamped; second run no-ops
  assert.equal(storage.raw.workspaceStructureVersion, 2);
  const again = await migrate.execute();
  assert.equal(again.alreadyMigrated, true);
  assert.equal(again.collectionsMoved, 0);
  assert.ok(emitted.length >= 2);
});

test("CreateBookmarkGroup: stores rootFolderId and bootstraps structure when injected", async () => {
  const groupRepo = createMemoryGroupRepo();
  let ensureCalls = 0;
  const useCase = new CreateBookmarkGroup(groupRepo, {
    ensureWorkspaceStructure: {
      async execute(id) {
        ensureCalls += 1;
        assert.equal(typeof id, "string");
        return { rootFolderId: "root-9", created: ["Collections", "Shortcuts"] };
      },
    },
  });

  const saved = await useCase.execute({
    name: "Personal",
    icon: "rocket",
    folderIds: ["root-9"],
    rootFolderId: "root-9",
  });
  assert.equal(saved.rootFolderId, "root-9");
  assert.deepEqual(saved.folderIds, ["root-9"]);
  assert.equal(ensureCalls, 1);

  const groups = await groupRepo.findAll();
  assert.equal(groups.length, 1);
  assert.equal(groups[0].rootFolderId, "root-9");
});

test("BookmarkGroup: rootFolderId round-trip + reserved root child detection", () => {
  const g = new BookmarkGroup({
    id: "g1",
    name: "Work",
    icon: "folder",
    folderIds: ["w1", "extra"],
    rootFolderId: "w1",
  });
  assert.equal(g.rootFolderId, "w1");
  assert.equal(BookmarkGroup.isReservedRootChild("Collections"), true);
  assert.equal(BookmarkGroup.isReservedRootChild("shortcuts"), true);
  assert.equal(BookmarkGroup.isReservedRootChild("Projects"), false);

  const restored = BookmarkGroup.fromJSON(g.toJSON());
  assert.equal(restored.rootFolderId, "w1");
  assert.deepEqual(restored.folderIds, ["w1", "extra"]);

  g.updateRootFolderId("w2");
  assert.equal(g.rootFolderId, "w2");
  assert.ok(g.folderIds.includes("w2"));
});

test("UpdateBookmarkGroup: accepts rootFolderId", async () => {
  const existing = new BookmarkGroup({
    id: "g1",
    name: "Work",
    icon: "folder",
    folderIds: ["old"],
    rootFolderId: "old",
  });
  const repo = createMemoryGroupRepo([existing]);
  const useCase = new UpdateBookmarkGroup(repo);
  const updated = await useCase.execute({ id: "g1", rootFolderId: "new-root", folderIds: ["new-root"] });
  assert.equal(updated.rootFolderId, "new-root");
  assert.deepEqual(updated.folderIds, ["new-root"]);
});

test("DeleteBookmarkGroup: clears workspaceSystemFolders cache entry", async () => {
  const group = new BookmarkGroup({
    id: "ws-1",
    name: "Work",
    icon: "folder",
    folderIds: ["w1"],
    rootFolderId: "w1",
  });
  const repo = createMemoryGroupRepo([group]);
  const storage = createMockStorage({
    workspaceSystemFolders: {
      "ws-1": { rootFolderId: "w1", collectionsFolderId: "c", shortcutsFolderId: "s" },
      "ws-2": { rootFolderId: "w2", collectionsFolderId: "c2", shortcutsFolderId: "s2" },
    },
  });
  const useCase = new DeleteBookmarkGroup(repo, { storage });
  await useCase.execute("ws-1");
  assert.equal(storage.raw.workspaceSystemFolders["ws-1"], undefined);
  assert.ok(storage.raw.workspaceSystemFolders["ws-2"]);
});

test("ListBookmarkCollectionsUseCase: workspace filter + optional unscoped include", async () => {
  const repo = createMemoryCollectionRepo([
    { id: "c1", name: "A", bookmarkIds: [], bookmarkUrls: [], workspaceId: "ws-1", folderId: "c1" },
    { id: "c2", name: "B", bookmarkIds: [], bookmarkUrls: [], workspaceId: "ws-2", folderId: "c2" },
    { id: "c3", name: "C", bookmarkIds: [], bookmarkUrls: [], workspaceId: null, folderId: "c3" },
  ]);
  const useCase = new ListBookmarkCollectionsUseCase(repo);

  const all = await useCase.execute();
  assert.equal(all.length, 3);

  const scoped = await useCase.execute({ workspaceId: "ws-1" });
  assert.deepEqual(scoped.map((c) => c.id), ["c1"]);

  const withUnscoped = await useCase.execute({ workspaceId: "ws-1", includeUnscoped: true });
  assert.deepEqual(withUnscoped.map((c) => c.id).sort(), ["c1", "c3"]);
});

test("CreateBookmarkCollectionUseCase: native folder under workspace Collections when workspaceId set", async () => {
  const events = new EventBus();
  const sanitizer = { text: (s) => s.trim() };
  const repo = createMemoryCollectionRepo();
  const tree = makeTree([folder("w1", "w-Work", [])]);
  const createdFolders = [];
  const bookmarks = createBookmarkApi(tree, { created: createdFolders });
  const storage = createMockStorage();
  const group = { id: "ws-1", name: "Work", folderIds: ["w1"], rootFolderId: "w1" };
  const groupRepo = createMemoryGroupRepo([group]);
  const resolve = new ResolveWorkspaceStructureUseCase({ groupRepository: groupRepo, storage });
  const ensure = new EnsureWorkspaceStructureUseCase({
    resolve,
    groupRepository: groupRepo,
    bookmarks,
    storage,
    events,
  });

  const useCase = new CreateBookmarkCollectionUseCase({
    repository: repo,
    ids: { generate: () => "gen-1" },
    sanitizer,
    events,
    bookmarks,
    ensureWorkspaceStructure: ensure,
    resolveWorkspaceStructure: resolve,
  });

  const created = await useCase.execute({ name: "Research", workspaceId: "ws-1" });
  assert.equal(created.workspaceId, "ws-1");
  assert.ok(created.folderId);

  const structure = await resolve.execute({ workspaceId: "ws-1", tree });
  assert.equal(structure.collectionsFolderId, createdFolders.find((n) => n.title === "Collections")?.id || structure.collectionsFolderId);
  const collFolder = createdFolders.find((n) => n.title === "Research");
  assert.ok(collFolder);

  const listed = await new ListBookmarkCollectionsUseCase(repo).execute({ workspaceId: "ws-1" });
  assert.deepEqual(listed.map((c) => c.id), [created.id]);
});

test("EnsureShortcutsFolderUseCase: workspaceId path uses workspace structure; omit uses global", async () => {
  const tree = makeTree([folder("w1", "w-Work", [])]);
  const createdFolders = [];
  const bookmarks = createBookmarkApi(tree, { created: createdFolders });
  const storage = createMockStorage();
  const group = { id: "ws-1", name: "Work", folderIds: ["w1"], rootFolderId: "w1" };
  const groupRepo = createMemoryGroupRepo([group]);
  const events = new EventBus();
  const resolve = new ResolveWorkspaceStructureUseCase({ groupRepository: groupRepo, storage });
  const ensureStructure = new EnsureWorkspaceStructureUseCase({
    resolve,
    groupRepository: groupRepo,
    bookmarks,
    storage,
    events,
  });

  const useCase = new EnsureShortcutsFolderUseCase({
    storage,
    bookmarks,
    resolveWorkspaceStructure: resolve,
    ensureWorkspaceStructure: ensureStructure,
  });

  const wsId = await useCase.execute({ tree, workspaceId: "ws-1" });
  assert.ok(wsId);
  const structure = await resolve.execute({ workspaceId: "ws-1", tree });
  assert.equal(wsId, structure.shortcutsFolderId);

  // Global path still works (legacy migration / All Bookmarks)
  const globalId = await useCase.execute({ tree });
  assert.ok(globalId);
  assert.notEqual(globalId, wsId);
});

test("SYSTEM_FOLDER_TITLES are reserved titles", () => {
  assert.equal(SYSTEM_FOLDER_TITLES.collections, "Collections");
  assert.equal(SYSTEM_FOLDER_TITLES.shortcuts, "Shortcuts");
  assert.equal(SYSTEM_FOLDER_TITLES.quickie, "Quickie");
  for (const title of Object.values(SYSTEM_FOLDER_TITLES)) {
    assert.ok(BookmarkGroup.RESERVED_ROOT_CHILDREN.includes(title) || title === "Quickie");
  }
});

test("ResolveShortcutsFolderUseCase: workspace vs global destinations (never w-null)", async () => {
  const tree = makeTree([folder("w1", "w-Work", [])]);
  const created = [];
  const bookmarks = createBookmarkApi(tree, { created });
  const storage = createMockStorage();
  const group = { id: "ws-1", name: "Work", folderIds: ["w1"], rootFolderId: "w1" };
  const groupRepo = createMemoryGroupRepo([group]);
  const events = new EventBus();
  const resolve = new ResolveWorkspaceStructureUseCase({ groupRepository: groupRepo, storage });
  const ensureStructure = new EnsureWorkspaceStructureUseCase({
    resolve,
    groupRepository: groupRepo,
    bookmarks,
    storage,
    events,
  });
  const ensureShortcuts = new EnsureShortcutsFolderUseCase({
    storage,
    bookmarks,
    resolveWorkspaceStructure: resolve,
    ensureWorkspaceStructure: ensureStructure,
  });
  const resolver = new ResolveShortcutsFolderUseCase({
    ensureShortcutsFolder: ensureShortcuts,
    ensureWorkspaceStructure: ensureStructure,
    resolveWorkspaceStructure: resolve,
  });

  // Workspace path
  const ws = await resolver.execute({ workspaceId: "ws-1", tree });
  assert.equal(ws.mode, "workspace");
  assert.ok(ws.shortcutsFolderId);
  assert.ok(!String(ws.path).includes("w-null"));
  const structure = await resolve.execute({ workspaceId: "ws-1", tree });
  assert.equal(ws.shortcutsFolderId, structure.shortcutsFolderId);

  // Global path (null / undefined / empty string) → Other Bookmarks/Shortcuts
  for (const nullish of [null, undefined, "", 0]) {
    const g = await resolver.execute({ workspaceId: nullish, tree });
    assert.equal(g.mode, "global");
    assert.equal(g.workspaceId, null);
    assert.ok(g.shortcutsFolderId);
    assert.equal(g.path, "Other Bookmarks/Shortcuts");
    assert.notEqual(g.shortcutsFolderId, ws.shortcutsFolderId);
  }

  // ensure=false still returns ids (resolve-only for workspace)
  const resolveOnly = await resolver.execute({ workspaceId: "ws-1", tree, ensure: false });
  assert.equal(resolveOnly.mode, "workspace");
  assert.equal(resolveOnly.shortcutsFolderId, structure.shortcutsFolderId);

  // Idempotent: second ensure never creates a duplicate Shortcuts under w-Work
  const again = await resolver.execute({ workspaceId: "ws-1", tree });
  assert.equal(again.shortcutsFolderId, ws.shortcutsFolderId);
  const workRoot = tree[0].children.find((n) => n.id === "2").children.find((n) => n.id === "w1");
  const shortCount = workRoot.children.filter((n) => n.title === "Shortcuts").length;
  assert.equal(shortCount, 1);
});

test("Isolation: Work vs Personal system folders never share ids; global Shortcuts untouched", async () => {
  const tree = makeTree([
    folder("globShort", "Shortcuts", [folder("gc", "General", [])]),
    folder("q", "Quickie", []),
    folder("w1", "w-Work", []),
    folder("w2", "w-Personal", []),
  ]);
  const created = [];
  const bookmarks = createBookmarkApi(tree, { created });
  const storage = createMockStorage();
  const work = { id: "ws-1", name: "Work", folderIds: ["w1"], rootFolderId: "w1" };
  const personal = { id: "ws-2", name: "Personal", folderIds: ["w2"], rootFolderId: "w2" };
  const groupRepo = createMemoryGroupRepo([work, personal]);
  const events = new EventBus();
  const resolve = new ResolveWorkspaceStructureUseCase({ groupRepository: groupRepo, storage });
  const ensure = new EnsureWorkspaceStructureUseCase({
    resolve,
    groupRepository: groupRepo,
    bookmarks,
    storage,
    events,
  });
  const ensureShortcuts = new EnsureShortcutsFolderUseCase({
    storage,
    bookmarks,
    resolveWorkspaceStructure: resolve,
    ensureWorkspaceStructure: ensure,
  });
  const resolver = new ResolveShortcutsFolderUseCase({
    ensureShortcutsFolder: ensureShortcuts,
    ensureWorkspaceStructure: ensure,
    resolveWorkspaceStructure: resolve,
  });

  const s1 = await resolver.execute({ workspaceId: "ws-1", tree });
  const s2 = await resolver.execute({ workspaceId: "ws-2", tree });
  assert.notEqual(s1.shortcutsFolderId, s2.shortcutsFolderId);

  const st1 = await resolve.execute({ workspaceId: "ws-1", tree });
  const st2 = await resolve.execute({ workspaceId: "ws-2", tree });
  assert.ok(st1.collectionsFolderId && st2.collectionsFolderId);
  assert.notEqual(st1.collectionsFolderId, st2.collectionsFolderId);
  assert.notEqual(st1.shortcutsFolderId, st2.shortcutsFolderId);
  assert.notEqual(st1.rootFolderId, st2.rootFolderId);

  // Global Shortcuts never migrated/deleted
  const other = tree[0].children.find((n) => n.id === "2");
  const globalShort = other.children.find((n) => n.id === "globShort");
  assert.ok(globalShort);
  assert.equal(globalShort.title, "Shortcuts");
  const global = await resolver.execute({ workspaceId: null, tree });
  assert.equal(global.shortcutsFolderId, "globShort");

  // Quickie still global only
  assert.ok(other.children.some((n) => n.id === "q" && n.title === "Quickie"));
  const workRoot = other.children.find((n) => n.id === "w1");
  const personalRoot = other.children.find((n) => n.id === "w2");
  assert.ok(!workRoot.children.some((n) => n.title === "Quickie"));
  assert.ok(!personalRoot.children.some((n) => n.title === "Quickie"));
});

test("Native structure is authoritative: stale workspaceSystemFolders cache is repaired", async () => {
  const group = { id: "ws-1", name: "Work", folderIds: ["w1"], rootFolderId: "w1" };
  const tree = makeTree([
    folder("w1", "w-Work", [
      folder("realC", "Collections", []),
      folder("realS", "Shortcuts", []),
    ]),
  ]);
  const storage = createMockStorage({
    workspaceSystemFolders: {
      "ws-1": {
        rootFolderId: "w1",
        collectionsFolderId: "stale-c",
        shortcutsFolderId: "stale-s",
      },
    },
  });
  const bookmarks = createBookmarkApi(tree);
  const events = new EventBus();
  const groupRepo = createMemoryGroupRepo([group]);
  const resolve = new ResolveWorkspaceStructureUseCase({ groupRepository: groupRepo, storage });
  const ensure = new EnsureWorkspaceStructureUseCase({
    resolve,
    groupRepository: groupRepo,
    bookmarks,
    storage,
    events,
  });

  const resolved = await resolve.execute({ workspaceId: "ws-1", tree });
  assert.equal(resolved.collectionsFolderId, "realC");
  assert.equal(resolved.shortcutsFolderId, "realS");

  const ensured = await ensure.execute("ws-1", { tree });
  assert.equal(ensured.collectionsFolderId, "realC");
  assert.equal(ensured.shortcutsFolderId, "realS");
  assert.equal(ensured.created.length, 0);

  // Cache refreshed to native ids
  assert.equal(storage.raw.workspaceSystemFolders["ws-1"].collectionsFolderId, "realC");
  assert.equal(storage.raw.workspaceSystemFolders["ws-1"].shortcutsFolderId, "realS");
});
