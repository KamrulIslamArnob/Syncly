import test from "node:test";
import assert from "node:assert/strict";
import { GitHubBackupService, extractGistId, sanitizeFilename } from "../src/infrastructure/services/GitHubBackupService.js";
import { PushBackupToGitHubUseCase } from "../src/application/useCases/backup/PushBackupToGitHubUseCase.js";

// Mock chrome storage
function createMockChromeStorage() {
  const store = {};
  return {
    storage: {
      local: {
        get: async (key) => {
          if (!key) return { ...store };
          if (Array.isArray(key)) {
            const res = {};
            for (const k of key) res[k] = store[k];
            return res;
          }
          if (typeof key === "string") return { [key]: store[key] };
          return {};
        },
        set: async (obj) => {
          Object.assign(store, obj);
        },
        remove: async (keys) => {
          const arr = Array.isArray(keys) ? keys : [keys];
          for (const k of arr) delete store[k];
        },
        _store: store,
      },
    },
  };
}

test("extractGistId: extracts IDs from URLs and hashes correctly", () => {
  assert.equal(extractGistId("6c85e2634d075ec9f7831f5dfaa84c17"), "6c85e2634d075ec9f7831f5dfaa84c17");
  assert.equal(
    extractGistId("https://gist.github.com/username/6c85e2634d075ec9f7831f5dfaa84c17"),
    "6c85e2634d075ec9f7831f5dfaa84c17"
  );
  assert.equal(
    extractGistId("https://gist.github.com/6c85e2634d075ec9f7831f5dfaa84c17"),
    "6c85e2634d075ec9f7831f5dfaa84c17"
  );
  assert.equal(extractGistId(""), null);
  assert.equal(extractGistId("   "), null);
  assert.equal(extractGistId(null), null);
});

test("sanitizeFilename: ensures safe filenames with fallback", () => {
  assert.equal(sanitizeFilename("Syncly-backup.json"), "Syncly-backup.json");
  assert.equal(sanitizeFilename("my_custom_backup.json"), "my_custom_backup.json");
  assert.equal(sanitizeFilename(""), "Syncly-backup.json");
  assert.equal(sanitizeFilename("bad/filename.json"), "Syncly-backup.json");
});

test("GitHubBackupService: saves, links, and clears Gist ID and target filename", async () => {
  globalThis.chrome = createMockChromeStorage();
  const service = new GitHubBackupService();

  assert.equal(await service.getGistId(), null);
  assert.equal(await service.getFilename(), "Syncly-backup.json");

  // Link Gist via URL
  const id = await service.setGistId("https://gist.github.com/user/6c85e2634d075ec9f7831f5dfaa84c17");
  assert.equal(id, "6c85e2634d075ec9f7831f5dfaa84c17");
  assert.equal(await service.getGistId(), "6c85e2634d075ec9f7831f5dfaa84c17");

  // Set target filename
  const filename = await service.setFilename("work-backup.json");
  assert.equal(filename, "work-backup.json");
  assert.equal(await service.getFilename(), "work-backup.json");

  // Clear Gist ID
  await service.setGistId("");
  assert.equal(await service.getGistId(), null);
});

test("GitHubBackupService: pushBackup updates existing Gist with PATCH when Gist ID is linked", async () => {
  globalThis.chrome = createMockChromeStorage();
  const service = new GitHubBackupService();
  await service.setup({ token: "ghp_test_token_123" });
  await service.setGistId("gist_12345");
  await service.setFilename("custom-backup.json");

  let fetchCalled = false;
  let requestMethod = "";
  let requestUrl = "";
  let requestBody = null;

  globalThis.fetch = async (url, options) => {
    fetchCalled = true;
    requestMethod = options.method;
    requestUrl = url;
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "gist_12345" }),
    };
  };

  const returnedGistId = await service.pushBackup({
    data: { bookmarks: [] },
  });

  assert.ok(fetchCalled);
  assert.equal(returnedGistId, "gist_12345");
  assert.equal(requestMethod, "PATCH");
  assert.equal(requestUrl, "https://api.github.com/gists/gist_12345");
  assert.ok(requestBody.files["custom-backup.json"]);
  assert.equal(typeof requestBody.files["custom-backup.json"].content, "string");
});

test("GitHubBackupService: pullBackup reads specified target file from Gist", async () => {
  globalThis.chrome = createMockChromeStorage();
  const service = new GitHubBackupService();
  await service.setup({ token: "ghp_test_token_123" });
  await service.setGistId("gist_12345");
  await service.setFilename("my-bookmarks.json");

  globalThis.fetch = async (url) => {
    assert.equal(url, "https://api.github.com/gists/gist_12345");
    return {
      ok: true,
      status: 200,
      json: async () => ({
        id: "gist_12345",
        files: {
          "other-file.txt": { content: "ignore" },
          "my-bookmarks.json": { content: JSON.stringify({ bookmarks: [{ id: "b1", title: "Test" }] }) },
        },
      }),
    };
  };

  const content = await service.pullBackup();
  const parsed = JSON.parse(content);
  assert.equal(parsed.bookmarks[0].title, "Test");
});

test("PushBackupToGitHubUseCase: executes and emits event with target Gist ID", async () => {
  globalThis.chrome = createMockChromeStorage();
  globalThis.chrome.storage.local.set({ bookmarks: [{ id: "b1", title: "Example" }] });

  const service = new GitHubBackupService();
  await service.setup({ token: "ghp_test_token" });
  await service.setGistId("gist_abc");

  globalThis.fetch = async (url, options) => {
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "gist_abc" }),
    };
  };

  const emitted = [];
  const events = {
    emit: (event, payload) => emitted.push({ event, payload }),
  };

  const useCase = new PushBackupToGitHubUseCase({
    githubBackupService: service,
    storage: globalThis.chrome.storage.local,
    events,
  });

  const res = await useCase.execute();
  assert.equal(res.gistId, "gist_abc");
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].event, "backup:pushed");
  assert.equal(emitted[0].payload.gistId, "gist_abc");
});
