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
const FILENAME_KEY = "githubBackupFilename";
const API_BASE = "https://api.github.com/gists";

// Gist filenames must be filesystem-safe. Allow alphanumeric, dash,
// underscore and dot only — no slashes, spaces, or control chars.
const SAFE_FILENAME = /^[A-Za-z0-9._-]+$/;

export function sanitizeFilename(name) {
  const fallback = "Syncly-backup.json";
  if (typeof name !== "string") return fallback;
  const trimmed = name.trim();
  if (!trimmed || !SAFE_FILENAME.test(trimmed)) return fallback;
  return trimmed;
}

export function extractGistId(input) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  // If it's a URL like https://gist.github.com/username/6c85e2634d075ec9f7831f5dfaa84c17
  const urlMatch = trimmed.match(/gist\.github\.com(?:\/[^/]+)?\/([a-f0-9]+)/i);
  if (urlMatch) return urlMatch[1];
  // Raw hexadecimal gist hash (e.g. 20 or 32 chars)
  const hexMatch = trimmed.match(/^[a-f0-9]{16,64}$/i);
  if (hexMatch) return trimmed;
  // Generic alphanumeric identifier
  if (/^[a-z0-9_-]+$/i.test(trimmed)) return trimmed;
  return null;
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
    await chrome.storage.local.remove([PAT_KEY, GIST_ID_KEY, FILENAME_KEY]);
  }

  async getGistId() {
    return await this.#get(GIST_ID_KEY);
  }

  async setGistId(rawGistId) {
    if (!rawGistId || (typeof rawGistId === "string" && !rawGistId.trim())) {
      await chrome.storage.local.remove(GIST_ID_KEY);
      return null;
    }
    const id = extractGistId(rawGistId);
    if (!id) {
      throw new Error("Invalid Gist ID or URL format.");
    }
    await this.#set(GIST_ID_KEY, id);
    return id;
  }

  async getFilename() {
    const stored = await this.#get(FILENAME_KEY);
    return sanitizeFilename(stored);
  }

  async setFilename(name) {
    const safe = sanitizeFilename(name);
    await this.#set(FILENAME_KEY, safe);
    return safe;
  }

  async pushBackup({ data, filename, description, gistId } = {}) {
    const stored = await this.#get(PAT_KEY);
    const token = await getDecryptedPat(stored);
    if (!token) {
      throw new Error("GitHub backup is not configured. Add a token first.");
    }

    const configuredFilename = filename || (await this.getFilename());
    const safeName = sanitizeFilename(configuredFilename);
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

    const targetGistId = gistId ? (extractGistId(gistId) || gistId) : (await this.#get(GIST_ID_KEY));
    const method = targetGistId ? "PATCH" : "POST";
    const url = targetGistId ? `${API_BASE}/${targetGistId}` : API_BASE;

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
    if (res.status === 404 && targetGistId) {
      throw new Error(`Target Gist (${targetGistId}) was not found on GitHub. Check the Gist ID or clear it.`);
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

  async pullBackup({ filename, gistId } = {}) {
    const stored = await this.#get(PAT_KEY);
    const token = await getDecryptedPat(stored);
    if (!token) {
      throw new Error("GitHub backup is not configured. Add a token first.");
    }
    const targetGistId = gistId ? (extractGistId(gistId) || gistId) : (await this.#get(GIST_ID_KEY));
    if (!targetGistId) {
      throw new Error("No backup gist is linked yet. Enter a Gist ID or push a backup first.");
    }

    let res;
    try {
      res = await fetch(`${API_BASE}/${targetGistId}`, {
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
      throw new Error(`The stored backup gist (${targetGistId}) was not found on GitHub.`);
    }
    if (!res.ok) {
      throw new Error(`GitHub pull failed (HTTP ${res.status}).`);
    }

    const json = await res.json();
    const files = json?.files;
    if (!files || typeof files !== "object") {
      throw new Error("Backup gist has no files.");
    }

    const configuredFilename = filename || (await this.getFilename());
    const safeName = sanitizeFilename(configuredFilename);

    if (files[safeName] && files[safeName].content != null) {
      return files[safeName].content;
    }

    const firstFile = Object.values(files)[0];
    if (!firstFile || firstFile.content == null) {
      throw new Error("Backup gist file is empty.");
    }
    return firstFile.content;
  }
}
