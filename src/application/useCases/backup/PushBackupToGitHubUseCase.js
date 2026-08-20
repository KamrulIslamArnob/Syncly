import { filterBackupData } from "../../../infrastructure/services/backupAllowlist.js";

// Use case: push a sanitized backup of extension data to a remote
// GitHub Gist via the GitHubBackupService.
//
// CRITICAL SECURITY: before any data leaves the device, the payload is
// filtered through an explicit allowlist (filterBackupData). Sensitive
// keys — bearer tokens (aiQuotaPAT, githubBackupPAT) and the gist id
// (githubBackupGistId) — are never included in the pushed payload.

export class PushBackupToGitHubUseCase {
  #github;
  #storage;
  #events;

  constructor({ githubBackupService, storage, events }) {
    this.#github = githubBackupService;
    this.#storage = storage;
    this.#events = events;
  }

  /**
   * @param {{ filename: string, description?: string }} args
   * @returns {Promise<{ gistId: string }>}
   */
  async execute({ filename, description }) {
    // 1. Gather all extension data from local storage.
    //    ChromeStorageClient wraps chrome.storage.local but exposes
    //    only per-key accessors, so we read everything in one call —
    //    same pattern as AutoBackupService.
    const raw = await chrome.storage.local.get();

    // 2. SECURITY: strip sensitive keys — keep only the allowlist.
    const safe = filterBackupData(raw);

    // 3. Serialize and push to the remote gist.
    const data = JSON.stringify(safe, null, 2);
    const gistId = await this.#github.pushBackup({
      data,
      filename,
      description,
    });

    // 4. Notify the rest of the app.
    this.#events.emit("backup:pushed", { gistId, timestamp: Date.now() });

    return { gistId };
  }
}
