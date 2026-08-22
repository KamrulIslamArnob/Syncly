import test from "node:test";
import assert from "node:assert/strict";
import { AdoptNativeWorkspaceFolders } from "../src/application/useCases/workspaces/AdoptNativeWorkspaceFolders.js";
import { EventBus } from "../src/application/ports/EventBus.js";
import {
  WORKSPACE_PREFIX,
  toFolderTitle,
  fromFolderTitle,
  isWorkspaceFolder,
} from "../src/domain/services/workspaceNaming.js";

class MemoryGroupRepo {
  constructor(groups = []) { this.groups = [...groups]; }
  async findAll() { return [...this.groups]; }
  async save(g) {
    const i = this.groups.findIndex((x) => x.id === g.id);
    if (i >= 0) this.groups[i] = g;
    else this.groups.push(g);
    return g;
  }
}

const folder = (id, title, children = []) => ({ id, title, children });
const bookmark = (id, title, url) => ({ id, title, url });

function makeTree(otherChildren) {
  return [{
    id: "0",
    title: "",
    children: [
      folder("1", "Bookmarks bar", [folder("bb1", "Bar folder")]),
      folder("2", "Other bookmarks", otherChildren),
    ],
  }];
}

/* ── Naming helpers ──────────────────────────────────────────────────────── */

test("workspaceNaming: prefix round-trip and idempotency", () => {
  assert.equal(toFolderTitle("Marketing"), "w-Marketing");
  assert.equal(toFolderTitle("w-Agency"), "w-Agency"); // no double prefix
  assert.equal(toFolderTitle("  Trimmed  "), "w-Trimmed");
  assert.equal(fromFolderTitle("w-Marketing"), "Marketing");
  assert.equal(fromFolderTitle("Marketing"), null); // not workspace-prefixed
  assert.equal(fromFolderTitle("w-"), null); // bare prefix → invalid
  assert.equal(fromFolderTitle("w-w-cool"), "w-cool"); // single strip only

  assert.ok(isWorkspaceFolder({ id: "f", title: "w-X", children: [] }));
  assert.ok(!isWorkspaceFolder({ id: "f", title: "X", children: [] }));
  assert.ok(!isWorkspaceFolder({ id: "b", title: "w-notafolder", url: "https://x" }));
});

/* ── Adoption ────────────────────────────────────────────────────────────── */

async function runAdoption(tree, groups = [], { maxGroups } = {}) {
  const repo = new MemoryGroupRepo(groups);
  const events = new EventBus();
  let emitted = 0;
  events.on("bookmarkGroups:changed", () => emitted++);
  const renames = [];

  const useCase = new AdoptNativeWorkspaceFolders({
    groupRepository: repo,
    events,
    getTree: async () => tree,
    updateFolder: async (id, title) => renames.push([id, title]),
    ...(maxGroups ? { maxGroups } : {}),
  });

  const result = await useCase.execute();
  return { result, repo, renames, emitted };
}

test("adoption: claims untracked w-* folders with stripped names and default icon", async () => {
  const tree = makeTree([
    folder("f1", "w-Agency", [bookmark("b1", "Site", "https://x")]),
    folder("f2", "Plain folder"), // ignored — no prefix
    bookmark("b2", "w-notafolder", "https://y"), // ignored — it is a bookmark
  ]);

  const { result, repo, emitted } = await runAdoption(tree);
  assert.deepEqual(result.adopted.sort(), ["Agency"]);
  assert.deepEqual(result.migrated, []);
  assert.equal(emitted, 1);

  const saved = repo.groups.find((g) => g.name === "Agency");
  assert.ok(saved);
  assert.deepEqual(saved.folderIds, ["f1"]);
  assert.equal(saved.icon, "folder");
});

test("adoption: skips tracked (by folderIds or name) and reserved names", async () => {
  const existing = [
    { id: "g1", name: "Agency", icon: "rocket", folderIds: ["f1"], createdAt: 1, updatedAt: 1 },
  ];
  const tree = makeTree([
    folder("f1", "w-Agency"),
    folder("f9", "w-Agency"), // duplicate NAME of tracked workspace → skipped
    folder("f3", "w-Shortcuts"), // reserved Chrome/Syncly name → validation rejects
  ]);

  const { result, emitted } = await runAdoption(tree, existing);
  assert.deepEqual(result.adopted, []);
  assert.ok(result.skipped.some((s) => s.name === "Shortcuts"));
  assert.equal(emitted, 0);
});

test("adoption: respects the max workspaces cap", async () => {
  const existing = [{ id: "g1", name: "One", icon: "folder", folderIds: [], createdAt: 1, updatedAt: 1 }];
  const tree = makeTree([folder("fA", "w-Two"), folder("fB", "w-Three")]);

  const { result, repo } = await runAdoption(tree, existing, { maxGroups: 2 });
  assert.deepEqual(result.adopted, ["Two"]);
  assert.ok(result.skipped.some((s) => s.name === "Three" && /limit/.test(s.reason)));
  assert.equal(repo.groups.length, 2);
});

test("migration: prefixes own plain-titled root folders only; idempotent", async () => {
  const groups = [
    { id: "g1", name: "Legacy", icon: "folder", folderIds: ["f5"], createdAt: 1, updatedAt: 1 },
    { id: "g2", name: "Custom", icon: "folder", folderIds: ["f6"], createdAt: 1, updatedAt: 1 },
  ];
  const tree = makeTree([
    folder("f5", "Legacy"),        // pre-convention folder created by us → renamed
    folder("f6", "My Custom Name"), // manually renamed by user → untouched
  ]);

  const first = await runAdoption(tree, groups);
  assert.deepEqual(first.result.migrated, ["Legacy"]);
  assert.deepEqual(first.renames, [["f5", "w-Legacy"]]);
  assert.equal(first.emitted, 0); // migration alone does not disturb the UI

  // Second run: nothing left to migrate or adopt
  const migratedTree = makeTree([folder("f5", "w-Legacy"), folder("f6", "My Custom Name")]);
  const second = await runAdoption(migratedTree, groups);
  assert.deepEqual(second.result.migrated, []);
  assert.deepEqual(second.renames, []);
  assert.deepEqual(second.result.adopted, []); // w-Legacy already tracked via f5
});

test("adoption + migration combined in one pass", async () => {
  const groups = [{ id: "g1", name: "Old", icon: "folder", folderIds: ["f1"], createdAt: 1, updatedAt: 1 }];
  const tree = makeTree([folder("f1", "Old"), folder("f2", "w-Incoming")]);

  const { result, repo, emitted } = await runAdoption(tree, groups);
  assert.deepEqual(result.migrated, ["Old"]);
  assert.deepEqual(result.adopted, ["Incoming"]);
  assert.equal(emitted, 1); // adoption emits; migration alone never does
  assert.equal(repo.groups.length, 2);
});

test("emits bookmarkGroups:changed exactly once when adoption happens", async () => {
  const tree = makeTree([folder("f1", "w-Solo")]);
  const { emitted } = await runAdoption(tree, [], {});
  assert.equal(emitted, 1);
});

test("getTree failure yields an empty result without throwing", async () => {
  const useCase = new AdoptNativeWorkspaceFolders({
    groupRepository: new MemoryGroupRepo(),
    getTree: async () => { throw new Error("boom"); },
  });
  const res = await useCase.execute();
  assert.deepEqual(res, { adopted: [], migrated: [], skipped: [] });
});

test("prefix constant is stable", () => {
  assert.equal(WORKSPACE_PREFIX, "w-");
});
