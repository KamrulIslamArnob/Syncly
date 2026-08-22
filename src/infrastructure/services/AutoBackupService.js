import { filterBackupData, BACKUP_ALLOWLIST } from "./backupAllowlist.js";

const LAST_HASH_KEY = "ntab:lastBackupHash";

// Simple hash function for detecting changes in backup data
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

export class AutoBackupService {
  constructor() {
    this.dbName = 'neptab-backup-db';
    this.storeName = 'handles';
    try { this._lastHash = localStorage.getItem(LAST_HASH_KEY) || null; } catch { this._lastHash = null; }
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveHandle(handle) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.put(handle, 'backup-file');

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getHandle() {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.get('backup-file');

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async setupWithSavePicker() {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'Syncly-backup.json',
        types: [{ description: 'JSON File', accept: { 'application/json': ['.json'] } }]
      });
      await this.saveHandle(handle);
      return true;
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Failed to setup auto backup:', e);
        throw e;
      }
      return false;
    }
  }

  // Alias for Settings UI
  async setup() {
    return this.setupWithSavePicker();
  }

  async getStatus() {
    try {
      const handle = await this.getHandle();
      if (!handle) return { enabled: false, hasPermission: false, fileName: null };
      let hasPermission = false;
      try {
        const perm = await handle.queryPermission({ mode: "readwrite" });
        hasPermission = perm === "granted";
      } catch { hasPermission = false; }
      return {
        enabled: true,
        hasPermission,
        fileName: handle.name || "Syncly-backup.json",
      };
    } catch {
      return { enabled: false, hasPermission: false, fileName: null };
    }
  }

  async checkPermission() {
    const handle = await this.getHandle();
    if (!handle) return false;
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    return perm === 'granted';
  }

  async requestPermission() {
    const handle = await this.getHandle();
    if (!handle) return false;
    try {
      const perm = await handle.requestPermission({ mode: 'readwrite' });
      return perm === 'granted';
    } catch (e) {
      console.error('Failed to request permission:', e);
      return false;
    }
  }

  async performBackup() {
    try {
      const handle = await this.getHandle();
      if (!handle) return false;

      const perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        // Return a special flag so the UI can show the resume button
        return 'requires_permission';
      }

      // SECURITY: strip sensitive keys (PATs, gist id) before writing
      // the backup file — never let credentials reach disk.
      // PERF-T05: read only the allowlisted keys instead of the entire DB.
      const raw = await chrome.storage.local.get(BACKUP_ALLOWLIST);
      const data = filterBackupData(raw);
      const content = JSON.stringify(data);

      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (e) {
      console.error('AutoBackupService: Backup failed', e);
      return false;
    }
  }

  /**
   * Like performBackup(), but only writes the file when the stored data has
   * actually changed since the last write (hash diff). Called on a 1-minute
   * loop from the new-tab page — no change means no disk write.
   * @returns {Promise<true|'unchanged'|'requires_permission'|false>}
   */
  async performBackupIfChanged() {
    try {
      const handle = await this.getHandle();
      if (!handle) return false;

      const perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') return 'requires_permission';

      // SECURITY: strip sensitive keys (PATs, gist id) before hashing
      // and writing — never let credentials reach disk.
      // PERF-T05: read only the allowlisted keys instead of the entire DB;
      // compact JSON (no pretty-print) cuts stringify + hash cost further.
      const raw = await chrome.storage.local.get(BACKUP_ALLOWLIST);
      const data = filterBackupData(raw);
      const content = JSON.stringify(data);
      const hash = hashString(content);
      if (hash === this._lastHash) return 'unchanged';

      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();

      this._lastHash = hash;
      try { localStorage.setItem(LAST_HASH_KEY, hash); } catch { /* ignore */ }
      return true;
    } catch (e) {
      console.error('AutoBackupService: Backup failed', e);
      return false;
    }
  }
}
