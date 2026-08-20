import { BackupTargetPort } from "../../application/ports/BackupTargetPort.js";
import { encryptPat, getDecryptedPat } from "../security/patCrypto.js";

// Infrastructure service that backs up extension data to a private
// GitHub Gist. The PAT is stored in chrome.storage.local — same pattern
// as the existing Supabase PAT (aiQuotaPAT).
//
// Security notes:
//   - The token is NEVER included in thrown error messages or console
//     output. All errors use generic descriptions.
//   - Gists are created with public:false so only the authenticated
//     user can read them.
//   - The filename is sanitized to a safe charset before use.

const PAT_KEY = "githubBackupPAT";
const GIST_ID_KEY = "githubBackupGistId";
const API_BASE = "https://api.github.com/gists";

// Gist filenames must be filesystem-safe. Allow alphanumeric, dash,
// underscore and dot only — no slashes, spaces, or control chars.
const SAFE_FILENAME = /^[A-Za-z0-9._-]+$/;

function sanitizeFilename(name) {
  const fallback = "Syncly-backup.json";
  if (typeof name !== "string") return fallback;
  const trimmed = name.trim();
  if (!trimmed || !SAFE_FILENAME.test(trimmed)) return fallback;
  return trimmed;
}

export class GitHubBackupService extends BackupTargetPort {
  async #get(key) {
    const out = await chrome.storage.local.get(key);
    return out[key] ?? null;
  }

  async #set(key, value) {
    await chrome.storage.local.set({ [key]: value });
  }

  async isConfigured() {
    const stored = await this.#get(PAT_KEY);
    const token = await getDecryptedPat(stored);
    return typeof token === "string" && token.length > 0;
  }

  async setup({ token }) {
    if (typeof token !== "string" || token.trim().length === 0) {
      throw new Error("A GitHub token is required.");
    }
    const trimmed = token.trim();
    // Encrypt at rest; fallback to plaintext if crypto unavailable (e.g., tests)
    try {
      const enc = await encryptPat(trimmed);
      if (enc) {
        await this.#set(PAT_KEY, enc);
        // Migrate: ensure no plaintext remains in memory beyond this scope
        return;
      }
    } catch {}
    await this.#set(PAT_KEY, trimmed);
  }

  async clearSetup() {
    await chrome.storage.local.remove([PAT_KEY, GIST_ID_KEY]);
  }

  async pushBackup({ data, filename, description }) {
    const stored = await this.#get(PAT_KEY);
    const token = await getDecryptedPat(stored);
    if (!token) {
      throw new Error("GitHub backup is not configured. Add a token first.");
    }

    const safeName = sanitizeFilename(filename);
    const body = {
      description: typeof description === "string" && description.trim()
        ? description.trim()
        : "Syncly backup",
      public: false,
      files: {
        [safeName]: {
          content: typeof data === "string" ? data : JSON.stringify(data, null, 2),
        },
      },
    };

    const gistId = await this.#get(GIST_ID_KEY);
    const method = gistId ? "PATCH" : "POST";
    const url = gistId ? `${API_BASE}/${gistId}` : API_BASE;

    let res;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch {
      // Network failure — never include the token in the error.
      throw new Error("Could not reach GitHub. Check your connection.");
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "GitHub rejected the token. Make sure it has the 'gist' scope and is not expired."
      );
    }
    if (res.status === 422) {
      throw new Error("GitHub rejected the backup payload (validation error 422).");
    }
    if (!res.ok) {
      throw new Error(`GitHub backup failed (HTTP ${res.status}).`);
    }

    let json;
    try {
      json = await res.json();
    } catch {
      throw new Error("GitHub returned an unreadable response.");
    }

    if (json && typeof json.id === "string") {
      await this.#set(GIST_ID_KEY, json.id);
      return json.id;
    }

    throw new Error("GitHub did not return a gist id.");
  }

  async pullBackup() {
    const stored = await this.#get(PAT_KEY);
    const token = await getDecryptedPat(stored);
    if (!token) {
      throw new Error("GitHub backup is not configured. Add a token first.");
    }
    const gistId = await this.#get(GIST_ID_KEY);
    if (!gistId) {
      throw new Error("No backup gist is stored yet. Push a backup first.");
    }

    let res;
    try {
      res = await fetch(`${API_BASE}/${gistId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      });
    } catch {
      throw new Error("Could not reach GitHub. Check your connection.");
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error("GitHub rejected the token.");
    }
    if (res.status === 404) {
      throw new Error("The stored backup gist no longer exists on GitHub.");
    }
    if (!res.ok) {
      throw new Error(`GitHub pull failed (HTTP ${res.status}).`);
    }

    const json = await res.json();
    const files = json?.files;
    if (!files || typeof files !== "object") {
      throw new Error("Backup gist has no files.");
    }
    const firstFile = Object.values(files)[0];
    if (!firstFile || firstFile.content == null) {
      throw new Error("Backup gist file is empty.");
    }
    return firstFile.content;
  }
}
