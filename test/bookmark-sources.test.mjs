import test from "node:test";
import assert from "node:assert/strict";
import { projectBookmarkSources } from "../src/domain/services/bookmarkSources.js";

test("source modes change sidebar sections without changing shared native nodes", () => {
  const bar = [{ id: "bar-folder", title: "Reading", children: [] }];
  const workspace = [{ id: "work-folder", title: "Research", children: [] }];
  const snapshot = JSON.stringify({ bar, workspace });
  for (const [mode, expected] of [["chrome", ["chrome"]], ["workspace", ["workspace"]], ["both", ["chrome", "workspace"]]]) {
    const sections = projectBookmarkSources({ mode, chromeFolders: bar, workspaceFolders: workspace, workspaceName: "Work" });
    assert.deepEqual(sections.map(s => s.id), expected);
    if (mode !== "workspace") assert.equal(sections[0].folders[0], bar[0]);
  }
  assert.equal(snapshot, JSON.stringify({ bar, workspace }));
});

test("legacy installations retain their current scope until they choose a source", () => {
  const folders = [{ id: "a" }];
  assert.deepEqual(projectBookmarkSources({ mode: "legacy", workspaceFolders: folders }), [
    { id: "workspace", title: "Bookmarks", folders },
  ]);
});

test("empty sources remain visible with a section label", () => {
  assert.equal(projectBookmarkSources({ mode: "both", chromeFolders: [], workspaceFolders: [] }).length, 2);
});
