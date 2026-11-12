/** A read-only projection. Borrowed browser folders never become owned workspace roots. */
export function projectBookmarkSources({ mode = "legacy", chromeFolders = [], workspaceFolders = [], workspaceName } = {}) {
  const workspace = { id: "workspace", title: workspaceName ? `${workspaceName} / Folders` : "Workspace folders", folders: workspaceFolders };
  if (mode === "legacy") return [{ ...workspace, title: workspaceName ? workspace.title : "Bookmarks" }];
  const chrome = { id: "chrome", title: "Chrome bookmarks", folders: chromeFolders };
  if (mode === "chrome") return [chrome];
  if (mode === "workspace") return [workspace];
  return [chrome, workspace];
}
