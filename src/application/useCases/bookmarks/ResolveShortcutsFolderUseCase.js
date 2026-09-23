/* ============================================================
   ResolveShortcutsFolderUseCase — central destination resolver

   Single source of truth for WHERE shortcuts live:

     activeWorkspaceId exists  →  w-{workspace}/Shortcuts
     activeWorkspaceId null    →  Other Bookmarks/Shortcuts

   Never invents w-null / w-default / w-global.
   Never migrates or deletes the global Shortcuts folder.
   Native Chrome bookmark tree remains authoritative; any
   workspaceSystemFolders entry is a cache only.

   Views must not re-implement this branching — call execute().
   ============================================================ */

export class ResolveShortcutsFolderUseCase {
  #ensureShortcutsFolder;
  #ensureWorkspaceStructure;
  #resolveWorkspaceStructure;

  /**
   * @param {object} deps
   * @param {{ execute(opts): Promise<string|null> }} deps.ensureShortcutsFolder
   *   global ensure (Other Bookmarks/Shortcuts) + workspace-aware when workspaceId passed.
   * @param {{ execute(workspaceId, opts?): Promise<object> }} [deps.ensureWorkspaceStructure]
   * @param {{ execute({ workspaceId, tree? }): Promise<object> }} [deps.resolveWorkspaceStructure]
   */
  constructor({
    ensureShortcutsFolder,
    ensureWorkspaceStructure = null,
    resolveWorkspaceStructure = null,
  } = {}) {
    this.#ensureShortcutsFolder = ensureShortcutsFolder;
    this.#ensureWorkspaceStructure = ensureWorkspaceStructure;
    this.#resolveWorkspaceStructure = resolveWorkspaceStructure;
  }

  /**
   * @param {object|string|null} [params]
   * @param {string|null} [params.workspaceId] active workspace id or null/undefined
   * @param {Array} [params.tree] pre-fetched getTree()
   * @param {boolean} [params.ensure=false] create missing folder when true
   * @returns {Promise<{
   *   workspaceId: string|null,
   *   mode: "workspace"|"global",
   *   shortcutsFolderId: string|null,
   *   path: string
   * }>}
   */
  async execute(params = {}) {
    const opts = params == null ? {} : (typeof params === "string" ? { workspaceId: params } : params);
    const workspaceId = opts.workspaceId || null;
    const tree = opts.tree || undefined;
    const ensure = opts.ensure !== false;

    if (workspaceId) {
      const mode = "workspace";
      const path = `w-*/Shortcuts`;
      if (!ensure && this.#resolveWorkspaceStructure) {
        const structure = await this.#resolveWorkspaceStructure
          .execute({ workspaceId, tree })
          .catch(() => null);
        return {
          workspaceId,
          mode,
          shortcutsFolderId: structure?.shortcutsFolderId || null,
          path,
        };
      }
      if (this.#ensureWorkspaceStructure) {
        try {
          const structure = await this.#ensureWorkspaceStructure.execute(workspaceId, {
            tree: tree || undefined,
          });
          if (structure?.shortcutsFolderId) {
            return {
              workspaceId,
              mode,
              shortcutsFolderId: structure.shortcutsFolderId,
              path,
            };
          }
        } catch {
          /* fall through */
        }
      }
      if (this.#ensureShortcutsFolder) {
        const id = await this.#ensureShortcutsFolder
          .execute({ tree, workspaceId })
          .catch(() => null);
        return { workspaceId, mode, shortcutsFolderId: id || null, path };
      }
      return { workspaceId, mode, shortcutsFolderId: null, path };
    }

    // Global / no-workspace path — never a fake workspace
    const mode = "global";
    const path = "Other Bookmarks/Shortcuts";
    if (!ensure && this.#ensureShortcutsFolder) {
      // Prefer ensure without create when ensure=false is not supported by global path;
      // global ensure is idempotent and only creates when missing.
      const id = await this.#ensureShortcutsFolder
        .execute({ tree })
        .catch(() => null);
      return { workspaceId: null, mode, shortcutsFolderId: id || null, path };
    }
    const id = this.#ensureShortcutsFolder
      ? await this.#ensureShortcutsFolder.execute({ tree }).catch(() => null)
      : null;
    return { workspaceId: null, mode, shortcutsFolderId: id || null, path };
  }

  /** Convenience: just the id. */
  async resolveId(workspaceId = null, { tree } = {}) {
    const result = await this.execute({ workspaceId, tree, ensure: true });
    return result.shortcutsFolderId;
  }
}
