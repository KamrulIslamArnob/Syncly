import test from "node:test";
import assert from "node:assert/strict";
import { GoogleSyncService, SYNC_KEYS } from "../src/infrastructure/services/GoogleSyncService.js";
import { SyncFromGoogleCloudUseCase } from "../src/application/useCases/sync/SyncFromGoogleCloudUseCase.js";
import { EventBus } from "../src/application/ports/EventBus.js";

class MemoryStorageArea {
  constructor(initial = {}) {
    this.store = { ...initial };
  }
  async get(keys) {
    if (typeof keys === "string") return { [keys]: this.store[keys] };
    if (Array.isArray(keys)) {
      const out = {};
      for (const k of keys) {
        if (this.store[k] !== undefined) out[k] = this.store[k];
      }
      return out;
    }
    return { ...this.store };
  }
  async set(items) {
    Object.assign(this.store, items);
  }
  async remove(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) delete this.store[k];
  }
}

test("GoogleSyncService: pushes and pulls sync-eligible keys correctly", async () => {
  const local = new MemoryStorageArea({
    categories: [{ id: "cat-1", name: "Work", order: 0 }],
    bookmarks: [{ id: "bm-1", title: "GitHub", url: "https://github.com", categoryId: "cat-1" }],
    settings: { colorMode: "dark" },
  });
  const sync = new MemoryStorageArea({});

  const service = new GoogleSyncService({ local, sync });
  assert.ok(service.isAvailable());

  // Push all local to sync
  const pushRes = await service.pushAll();
  assert.equal(pushRes.success, true);
  assert.equal(pushRes.count, 3);
  assert.deepEqual(sync.store.categories, [{ id: "cat-1", name: "Work", order: 0 }]);
  assert.deepEqual(sync.store.bookmarks, [{ id: "bm-1", title: "GitHub", url: "https://github.com", categoryId: "cat-1" }]);

  // Simulate new device with empty local storage
  const newLocal = new MemoryStorageArea({});
  const newDeviceService = new GoogleSyncService({ local: newLocal, sync });

  // Pull all from sync to local
  const pullRes = await newDeviceService.pullAll();
  assert.equal(pullRes.success, true);
  assert.ok(pullRes.pulledKeys.includes("categories"));
  assert.ok(pullRes.pulledKeys.includes("bookmarks"));
  assert.ok(pullRes.pulledKeys.includes("settings"));
  assert.deepEqual(newLocal.store.categories, [{ id: "cat-1", name: "Work", order: 0 }]);
});

test("SyncFromGoogleCloudUseCase: pulls from cloud and emits changed events", async () => {
  const local = new MemoryStorageArea({});
  const sync = new MemoryStorageArea({
    categories: [{ id: "cat-1", name: "Dev", order: 0 }],
    bookmarks: [{ id: "bm-1", title: "MDN", url: "https://developer.mozilla.org", categoryId: "cat-1" }],
    settings: { colorMode: "light" },
  });

  const service = new GoogleSyncService({ local, sync });
  const events = new EventBus();
  const emitted = [];

  events.on("categories:changed", () => emitted.push("categories"));
  events.on("bookmarks:changed", () => emitted.push("bookmarks"));
  events.on("settings:changed", (val) => emitted.push(`settings:${val?.colorMode}`));

  const useCase = new SyncFromGoogleCloudUseCase({ googleSyncService: service, events });
  const res = await useCase.execute();

  assert.equal(res.success, true);
  assert.equal(res.count, 3);
  assert.ok(emitted.includes("categories"));
  assert.ok(emitted.includes("bookmarks"));
  assert.ok(emitted.includes("settings:light"));
  assert.deepEqual(local.store.categories, [{ id: "cat-1", name: "Dev", order: 0 }]);
});
