import test from "node:test";
import assert from "node:assert/strict";
import { ResolveCollectionFolder } from "../src/application/useCases/collections/ResolveCollectionFolder.js";

test("a synced collection folder ID cannot redirect a save outside its workspace", async () => {
  const useCase = new ResolveCollectionFolder({
    resolveWorkspace: { execute: async () => ({ found: true, collectionsFolderId: "collections" }) },
    getTree: async () => [{ id: "collections", children: [{ id: "local", title: "Design", children: [] }] }, { id: "remote-id", title: "Unrelated", children: [] }],
  });
  assert.equal(await useCase.execute({ workspaceId: "work", folderId: "remote-id", name: "Design" }), "local");
});

test("ambiguous collection names require resolution rather than guessing a folder", async () => {
  const useCase = new ResolveCollectionFolder({
    resolveWorkspace: { execute: async () => ({ found: true, collectionsFolderId: "collections" }) },
    getTree: async () => [{ id: "collections", children: [{ id: "a", title: "Design" }, { id: "b", title: "Design" }] }],
  });
  await assert.rejects(useCase.execute({ workspaceId: "work", name: "Design" }), /unavailable|ambiguous/);
});
