import { findBookmarkNode } from "../../../domain/services/bookmarkRoots.js";

/** Resolve the selected logical collection in the verified profile-local container. */
export class ResolveCollectionFolder {
  constructor({ resolveWorkspace, library, getTree }) {
    this.resolveWorkspace = resolveWorkspace;
    this.library = library;
    this.getTree = getTree;
  }
  async execute(collection) {
    let parentId;
    if (collection?.workspaceId) {
      const workspace = await this.resolveWorkspace.execute({ workspaceId: collection.workspaceId });
      if (workspace?.found) parentId = workspace.collectionsFolderId;
    } else {
      parentId = await this.library.ensureGlobalFolder("Collections", "collectionsFolderId", { allowCreate: false });
    }
    const parent = parentId ? findBookmarkNode(await this.getTree(), parentId) : null;
    const matches = (parent?.children || []).filter(node => !node.url && !node.unmodifiable && node.title === collection?.name);
    if (matches.length !== 1) throw new Error("This collection is unavailable or its name is ambiguous. Check its folders in Chrome before saving.");
    return matches[0].id;
  }
}
