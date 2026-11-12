import test from "node:test";
import assert from "node:assert/strict";
import { bookmarkRoots, findBookmarkNode } from "../src/domain/services/bookmarkRoots.js";
import { BookmarkLibraryService } from "../src/infrastructure/services/BookmarkLibraryService.js";
import { SetBookmarkSources } from "../src/application/useCases/bookmarks/BookmarkLibrarySettings.js";
import { EnsureQuickieFolderUseCase } from "../src/application/useCases/bookmarks/EnsureQuickieFolderUseCase.js";
import { EnsureShortcutsFolderUseCase } from "../src/application/useCases/bookmarks/EnsureShortcutsFolderUseCase.js";
import { EnsureCollectionsFolderUseCase } from "../src/application/useCases/bookmarks/EnsureCollectionsFolderUseCase.js";
import { AdoptNativeWorkspaceFolders } from "../src/application/useCases/workspaces/AdoptNativeWorkspaceFolders.js";
import { ResolveWorkspaceStructureUseCase } from "../src/application/useCases/workspaces/ResolveWorkspaceStructureUseCase.js";
import { CreateBookmarkCollectionUseCase } from "../src/application/useCases/collections/CreateBookmarkCollectionUseCase.js";
import { GroupDialogView } from "../src/presentation/newTab/views/GroupDialogView.js";

const folder = (id, title, children = [], extra = {}) => ({ id, title, children, ...extra });
function fixture(initial = {}, roots = [folder("1", "Bookmarks bar"), folder("2", "Other bookmarks")]) {
  const data = structuredClone(initial);
  const tree = [folder("0", "", roots)];
  const writes = [];
  let id = 100;
  const storage = { get: async () => structuredClone(data), set: async (v) => Object.assign(data, structuredClone(v)) };
  const bookmarks = {
    getTree: async () => structuredClone(tree),
    create: async (v) => {
      writes.push(v);
      const node = folder(String(id++), v.title);
      findBookmarkNode(tree, v.parentId).children.push(node);
      return node;
    },
  };
  const service = new BookmarkLibraryService({ storage, bookmarks });
  return { data, tree, writes, storage, bookmarks, service };
}

test("root discovery includes account/local bars, excludes managed write targets and supports Chrome 114", () => {
  const tree = [folder("0", "", [
    folder("a", "Localized", [], { folderType: "bookmarks-bar", syncing: true }),
    folder("b", "Localized", [], { folderType: "bookmarks-bar", syncing: false }),
    folder("c", "Managed", [], { folderType: "other", unmodifiable: "managed" }),
    folder("d", "Account", [], { folderType: "other", syncing: true }),
  ])];
  assert.deepEqual(bookmarkRoots(tree, "bookmarks-bar").map(n => n.id), ["a", "b"]);
  assert.deepEqual(bookmarkRoots(tree, "other", { writable: true }).map(n => n.id), ["d"]);
  assert.equal(bookmarkRoots([folder("0", "", [folder("2", "Autres favoris")])], "other")[0].id, "2");
});

test("repeated source changes are local-only and preserve layout/bindings", async () => {
  const f = fixture({ bookmarkLibrary: { version: 1, mode: "chrome", layout: "legacy", completed: true } });
  const useCase = new SetBookmarkSources({ library: f.service });
  for (const mode of ["workspace", "both", "chrome", "both"]) await useCase.execute(mode);
  assert.equal(f.data.bookmarkLibrary.mode, "both");
  assert.equal(f.data.bookmarkLibrary.layout, "legacy");
  assert.deepEqual(f.writes, []);
  await assert.rejects(useCase.execute("bad"));
  await useCase.execute("legacy");
  assert.equal(f.data.bookmarkLibrary.mode, "legacy", "Undo can restore the exact legacy view");
});

test("workspace resolution binds synced metadata to local nodes under the chosen library only", async () => {
  const f = fixture({}, [folder("2", "Other", [folder("foreign", "w-Work"), folder("owned", "Syncly", [
    folder("spaces", "Workspaces", [folder("local-work", "w-Work", [folder("local-shortcuts", "Shortcuts")])]),
  ])])]);
  const resolver = new ResolveWorkspaceStructureUseCase({
    groupRepository: { findById: async () => ({ id: "logical-work", name: "Work", rootFolderId: "foreign" }) },
    bookmarks: f.bookmarks, storage: f.storage, resolveParent: async () => "spaces",
  });
  const result = await resolver.execute({ workspaceId: "logical-work" });
  assert.equal(result.rootFolderId, "local-work");
  assert.equal(result.shortcutsFolderId, "local-shortcuts");
  assert.equal(f.writes.length, 0);
});

test("existing installations resolve their legacy parent without moving or creating anything", async () => {
  const f = fixture();
  const result = await f.service.resolve({ ensure: true });
  assert.equal(result.parentId, "2");
  assert.equal(result.workspacesParentId, "2");
  assert.deepEqual(f.writes, []);
});

test("fresh setup creates a single managed library under the explicitly selected account root", async () => {
  const f = fixture({ synclySetupPending: true }, [
    folder("local", "Other", [], { folderType: "other", syncing: false }),
    folder("account", "Other", [], { folderType: "other", syncing: true }),
  ]);
  await f.service.completeSetup({ mode: "both", parentId: "account" });
  const first = await f.service.resolve({ ensure: true });
  const again = await f.service.resolve({ ensure: true });
  assert.equal(first.parentId, again.parentId);
  assert.equal(f.writes.length, 2);
  assert.equal(f.writes[0].parentId, "account");
  assert.deepEqual(f.writes.map(n => n.title), ["Syncly", "Workspaces"]);
  assert.equal(f.data.synclySetupPending, false);
  assert.equal(f.data.bookmarkLibrary.layout, "managed");
});

test("multiple writable roots need an explicit choice, not a guessed account", async () => {
  const f = fixture({ synclySetupPending: true }, [
    folder("a", "Other", [], { folderType: "other", syncing: true }),
    folder("b", "Other", [], { folderType: "other", syncing: false }),
  ]);
  await assert.rejects(f.service.completeSetup({ mode: "chrome" }), /Choose/);
  assert.equal(f.writes.length, 0);
});

test("an existing multi-root installation can choose its legacy location without migration", async () => {
  const f = fixture({}, [folder("a", "Other", [], { folderType: "other", syncing: true }), folder("b", "Other", [], { folderType: "other", syncing: false })]);
  await f.service.completeSetup({ mode: "both", parentId: "a", reconnect: true });
  assert.equal((await f.service.resolve()).parentId, "a");
  assert.equal(f.data.bookmarkLibrary.layout, "legacy");
  assert.equal(f.writes.length, 0);
});

test("workspace rename uses the verified local root rather than a synced native ID", async () => {
  const renamed = [];
  globalThis.chrome = { bookmarks: { update: async (id, data) => renamed.push([id, data]) } };
  const dialog = Object.assign(Object.create(GroupDialogView.prototype), {
    isEditMode: true, editGroup: { id: "work", name: "Work", rootFolderId: "foreign" },
    nameInput: { value: "Studio" }, iconPicker: { getSelected: () => "folder" },
    useCases: {
      resolveWorkspaceStructure: { execute: async () => ({ found: true, root: { id: "local-work", title: "w-Work" } }) },
      updateBookmarkGroup: { execute: async () => {} },
    }, hide() {},
  });
  await dialog.handleSave();
  assert.deepEqual(renamed, [["local-work", { title: "w-Studio" }]]);
});

test("an unrelated folder named Syncly is not silently adopted", async () => {
  const f = fixture({ synclySetupPending: true }, [folder("2", "Other", [folder("user", "Syncly", [folder("u", "Personal")])])]);
  await assert.rejects(f.service.completeSetup({ mode: "workspace", parentId: "2" }), /already exists/);
  assert.equal(f.writes.length, 0);
});

test("pending first-run setup and unresolved managed libraries do not create fallback folders", async () => {
  const pending = fixture({ synclySetupPending: true });
  assert.equal(await pending.service.resolve({ ensure: true }), null);
  assert.equal(pending.writes.length, 0);
  const missing = fixture({ bookmarkLibrary: { version: 1, mode: "both", layout: "managed", completed: true, rootId: "missing", nativeParentId: "2" } });
  await assert.rejects(missing.service.resolve({ ensure: true }), /unavailable/);
  assert.equal(missing.writes.length, 0);
});

test("skipped setup defers folder creation until an explicit save action", async () => {
  const f = fixture({ synclySetupPending: true });
  await f.service.completeSetup({ mode: "chrome", skip: true });
  assert.equal(await f.service.ensureGlobalFolder("Quickie", "quickieFolderId", { allowCreate: false }), null);
  assert.equal(f.writes.length, 0);
  assert.ok(await f.service.ensureGlobalFolder("Quickie", "quickieFolderId", { allowCreate: true }));
  assert.equal(f.writes.length, 1);
});

test("a stale setup tab cannot discard a completed managed library by skipping", async () => {
  const f = fixture({ synclySetupPending: true });
  await f.service.completeSetup({ mode: "both", parentId: "2" });
  const root = f.data.bookmarkLibrary.rootId;
  const second = new BookmarkLibraryService({ storage: f.storage, bookmarks: f.bookmarks });
  await second.completeSetup({ mode: "chrome", skip: true });
  assert.equal(f.data.bookmarkLibrary.rootId, root);
  assert.equal(f.data.bookmarkLibrary.layout, "managed");
});

test("different concurrent global ensures never create duplicate Workspaces containers", async () => {
  const f = fixture({ bookmarkLibrary: { layout: "managed", rootId: "owned", completed: true } }, [folder("2", "Other", [folder("owned", "Syncly")])]);
  await Promise.all([f.service.ensureGlobalFolder("Quickie", "quickieFolderId"), f.service.ensureGlobalFolder("Shortcuts", "shortcutsFolderId"), f.service.ensureGlobalFolder("Collections", "collectionsFolderId")]);
  assert.equal(f.writes.filter(n => n.title === "Workspaces").length, 0, "global folder discovery does not repair workspace containers");
  await Promise.all([f.service.resolve({ ensure: true }), f.service.resolve({ ensure: true })]);
  assert.equal(f.writes.filter(n => n.title === "Workspaces").length, 1);
});

test("creating a collection in an unavailable workspace fails without writing elsewhere", async () => {
  const f = fixture();
  const useCase = new CreateBookmarkCollectionUseCase({ bookmarks: f.bookmarks,
    repository: { save: async v => v }, ensureWorkspaceStructure: { execute: async () => ({}) } });
  await assert.rejects(useCase.execute({ name: "Research", workspaceId: "missing" }), /unavailable/);
  assert.equal(f.writes.length, 0);
});

test("global collection discovery never rebinds a same-named workspace collection", async () => {
  const f = fixture({ bookmarkCollections: { scoped: { id: "scoped", name: "Design", workspaceId: "work", folderId: "workspace-design", bookmarkIds: [] } } }, [
    folder("2", "Other", [folder("global", "Collections", [folder("global-design", "Design")])]),
  ]);
  const useCase = new EnsureCollectionsFolderUseCase({ storage: f.storage, bookmarks: f.bookmarks });
  await useCase._migrateStoredCollections("global", f.tree);
  assert.equal(f.data.bookmarkCollections.scoped.folderId, "workspace-design");
});

test("a remote native ID collision cannot select a different local workspace", async () => {
  const f = fixture({}, [folder("2", "Other", [folder("17", "w-Personal"), folder("25", "w-Work")])]);
  const resolver = new ResolveWorkspaceStructureUseCase({
    groupRepository: { findById: async () => ({ id: "work", name: "Work", rootFolderId: "17" }) },
    bookmarks: f.bookmarks, storage: f.storage, resolveParent: async () => "2",
  });
  assert.equal((await resolver.execute({ workspaceId: "work" })).rootFolderId, "25");
});

test("an unavailable workspace never exposes stale cached child destinations", async () => {
  const f = fixture({ workspaceSystemFolders: { work: { shortcutsFolderId: "foreign", collectionsFolderId: "foreign" } } }, [folder("2", "Other", [folder("foreign", "Unrelated")])]);
  const resolver = new ResolveWorkspaceStructureUseCase({
    groupRepository: { findById: async () => ({ id: "work", name: "Work", rootFolderId: "missing" }) },
    bookmarks: f.bookmarks, storage: f.storage, resolveParent: async () => "2",
  });
  const result = await resolver.execute({ workspaceId: "work" });
  assert.equal(result.found, false);
  assert.equal(result.shortcutsFolderId, null);
  assert.equal(result.collectionsFolderId, null);
});

test("legacy workspaces discovered on a fresh profile keep their existing layout", async () => {
  const f = fixture({ synclySetupPending: true }, [folder("2", "Other", [folder("w", "w-Work")])]);
  await f.service.completeSetup({ mode: "both", parentId: "2" });
  assert.equal(f.data.bookmarkLibrary.layout, "legacy");
  assert.equal(f.writes.length, 0);
});

test("another profile explicitly reuses a synced library with its local node IDs", async () => {
  const f = fixture({ synclySetupPending: true }, [folder("account-b", "Other", [
    folder("root-b", "Syncly", [folder("spaces-b", "Workspaces", [folder("work-b", "w-Work")])]),
  ], { folderType: "other", syncing: true })]);
  await f.service.completeSetup({ mode: "both", parentId: "account-b", libraryId: "root-b" });
  assert.equal(f.data.bookmarkLibrary.rootId, "root-b");
  assert.equal((await f.service.resolve()).workspacesParentId, "spaces-b");
  assert.equal(f.writes.length, 0);
});

test("interrupted setup resumes using its recorded owned folder", async () => {
  const f = fixture({ synclySetupPending: true, bookmarkLibrary: {
    version: 1, mode: "both", layout: "managed", completed: false, rootId: "owned", nativeParentId: "2",
  } }, [folder("2", "Other", [folder("owned", "Syncly")])]);
  await f.service.completeSetup({ mode: "both", parentId: "2" });
  assert.equal(f.data.bookmarkLibrary.rootId, "owned");
  assert.deepEqual(f.writes.map(n => n.title), ["Workspaces"]);
});

test("global system folders are scoped to the owned library, not similarly named workspace folders", async () => {
  const f = fixture({ bookmarkLibrary: { version: 1, mode: "both", layout: "managed", completed: true, rootId: "owned", workspacesParentId: "spaces" } }, [
    folder("2", "Other", [folder("foreign", "Quickie"), folder("owned", "Syncly", [folder("spaces", "Workspaces")])]),
  ]);
  const id = await f.service.ensureGlobalFolder("Quickie", "quickieFolderId");
  assert.notEqual(id, "foreign");
  assert.equal(f.writes[0].parentId, "owned");
  assert.equal(await f.service.ensureGlobalFolder("Quickie", "quickieFolderId"), id);
  assert.equal(f.writes.length, 1);
});

test("all global destination use cases share the configured Syncly parent", async () => {
  const f = fixture({ bookmarkLibrary: { version: 1, mode: "both", layout: "managed", completed: true, rootId: "owned", workspacesParentId: "spaces" } }, [
    folder("2", "Other", [folder("owned", "Syncly", [folder("spaces", "Workspaces")])]),
  ]);
  for (const UseCase of [EnsureQuickieFolderUseCase, EnsureShortcutsFolderUseCase, EnsureCollectionsFolderUseCase]) {
    await new UseCase({ storage: f.storage, bookmarks: f.bookmarks, library: f.service }).execute();
  }
  assert.deepEqual(f.writes.map(n => n.parentId), ["owned", "owned", "owned"]);
});

test("workspace adoption discovers configured nested roots without modifying a sibling library", async () => {
  const f = fixture({ bookmarkLibrary: { version: 1, mode: "both", layout: "managed", completed: true, rootId: "owned", workspacesParentId: "spaces" } }, [
    folder("2", "Other", [folder("ignored", "w-Unrelated"), folder("owned", "Syncly", [folder("spaces", "Workspaces", [folder("work", "w-Work")])])]),
  ]);
  const saved = [];
  const adopt = new AdoptNativeWorkspaceFolders({
    groupRepository: { findAll: async () => [], save: async row => saved.push(row) },
    getTree: f.bookmarks.getTree, resolveParent: async () => (await f.service.resolve()).workspacesParentId,
  });
  await adopt.execute();
  assert.deepEqual(saved.map(g => g.name), ["Work"]);
});
