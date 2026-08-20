// Application-layer port for a remote backup target (e.g. GitHub Gist).
// Implemented by the infrastructure layer (GitHubBackupService).
// The application layer depends on this interface, never on a concrete
// service or on chrome.* / fetch directly.

export class BackupTargetPort {
  /** @returns {Promise<boolean>} whether a credential has been stored. */
  async isConfigured() {
    throw new Error("not implemented");
  }

  /** Persist the credential (PAT). @param {{ token: string }} */
  async setup({ token }) {
    throw new Error("not implemented");
  }

  /** Remove the stored credential and any cached remote id. */
  async clearSetup() {
    throw new Error("not implemented");
  }

  /**
   * Push a backup payload to the remote target. Creates a new remote
   * resource on first run and updates it afterwards.
   * @param {{ data: string, filename: string, description?: string }} args
   * @returns {Promise<string>} the remote resource id (e.g. gist id)
   */
  async pushBackup({ data, filename, description }) {
    throw new Error("not implemented");
  }

  /**
   * Pull the most recently pushed backup payload as a raw string.
   * @returns {Promise<string>}
   */
  async pullBackup() {
    throw new Error("not implemented");
  }
}
