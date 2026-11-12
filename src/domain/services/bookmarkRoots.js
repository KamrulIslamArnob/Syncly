/** Root metadata is optional before Chrome 134. Never depend on English titles. */
export function unwrapBookmarkRoots(tree) {
  if (!Array.isArray(tree)) return [];
  return tree.length === 1 && (tree[0].id === "0" || !tree[0].title)
    ? tree[0].children || [] : tree;
}

export function bookmarkRoots(tree, type, { writable = false } = {}) {
  const legacyId = { "bookmarks-bar": "1", other: "2", mobile: "3" }[type];
  return unwrapBookmarkRoots(tree).filter(node =>
    (node.folderType === type || (!node.folderType && node.id === legacyId))
    && (!writable || !node.unmodifiable));
}

export function findBookmarkNode(tree, id) {
  for (const node of tree || []) {
    if (String(node.id) === String(id)) return node;
    const found = findBookmarkNode(node.children, id);
    if (found) return found;
  }
  return null;
}
