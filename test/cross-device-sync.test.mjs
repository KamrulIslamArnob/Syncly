import test from "node:test";
import assert from "node:assert/strict";
import { GoogleSyncService, SYNC_KEYS } from "../src/infrastructure/services/GoogleSyncService.js";
import {
  mergeEntityList,
  mergeTagMap,
  mergeTombstones,
  recordTombstone,
  pruneTombstones,
  computeMerged,
  estimateBytes,
  MAX_SYNC_ITEM_BYTES,
  TOMBSTONE_KEY,
} from "../src/infrastructure/services/crossDeviceSync.js";

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
    const list = Array.isArray(keys) ? [keys].flat() : [];
    for (const k of list) delete this.store[k];
  }
}

const group = (id, name, updatedAt, extra = {}) => ({
  id,
  name: name || id,
  icon: "folder",
  folderIds: [`fid-${id}`],
  createdAt: extra.createdAt ?? updatedAt - 1000,
  updatedAt,
  ...extra.overrides,
});

/* ── Pure merge helpers ──────────────────────────────────────────────────── */

test("mergeEntityList: union by id, newer updatedAt wins per item", () => {
  const local = [group("w0", "Base", 100), group("w1", "Local Edit", 300)];
  const remote = [group("w1", "Remote Stale", 200), group("w2", "From Other Device", 150)];

  const merged = mergeEntityList(local, remote);
  const byId = Object.fromEntries(merged.map((g) => [g.id, g]));

  assert.equal(merged.length, 3);
  assert.equal(byId.w1.name, "Local Edit"); // newer local wins
  assert.ok(byId.w2, "remote-only workspace is added");
  assert.equal(byId.w2.name, "From Other Device");
  // Canonical order: createdAt asc → deterministic across devices
  assert.deepEqual(
    merged.map((g) => g.id),
    ["w0", "w2", "w1"]
  );
});

test("mergeEntityList: keeps local-only items (no clobbering)", () => {
  const local = [group("mine", "Mine Only", 500)];
  const remote = [group("theirs", "Theirs", 400)];
  const merged = mergeEntityList(local, remote);
  assert.deepEqual(
    merged.map((g) => g.id).sort(),
    ["mine", "theirs"]
  );
});

test("mergeEntityList: tombstoned item stays deleted; edit after delete resurrects", () => {
  const tombs = { w1: 400 }; // deleted at t=400
  const local = [group("w1", "Ghost", 300)]; // last edit BEFORE delete → dropped
  assert.equal(mergeEntityList(local, [], tombs).length, 0);

  const editedAfterDelete = [group("w1", "Recreated", 500)]; // edit AFTER delete → wins
  assert.equal(mergeEntityList(editedAfterDelete, [], tombs).length, 1);

  // Remote stale snapshot containing the tombstoned item must not resurrect it
  const remoteStale = [group("w1", "Stale Copy", 350)];
  assert.equal(mergeEntityList([], remoteStale, tombs).length, 0);
});

test("tombstones: record/merge/prune keep newest deletedAt per id", () => {
  let t = recordTombstone(undefined, "bookmarkGroups", ["a"], 100);
  t = recordTombstone(t, "bookmarkGroups", ["a", "b"], 200);
  t = mergeTombstones(t, { bookmarkGroups: { a: 150 } }); // older — ignored
  assert.equal(t.bookmarkGroups.a, 200);
  assert.equal(t.bookmarkGroups.b, 200);

  const pruned = pruneTombstones({ bookmarkGroups: { old: 1, fresh: Date.now() } }, Date.now());
  assert.equal(pruned.bookmarkGroups.old, undefined);
  assert.ok(pruned.bookmarkGroups.fresh > 0);
});

test("mergeTagMap: unions tag arrays and honors tombstones", () => {
  const local = { bm1: ["work"], bm3: ["temp"] };
  const remote = { bm1: ["urgent"], bm2: ["home"] };
  // NOTE: third arg is the PER-KEY tombstone map ({ [bookmarkId]: deletedAt })
  const merged = mergeTagMap(local, remote, { bm3: Date.now() });

  assert.deepEqual(merged.bm1.sort(), ["urgent", "work"]);
  assert.deepEqual(merged.bm2, ["home"]);
  assert.equal(merged.bm3, undefined); // tombstoned
});

test("computeMerged: only handles merge keys; reports whether local changed", () => {
  const res = computeMerged(
    "bookmarkGroups",
    [],
    [group("new", "New", 10)],
    {}
  );
  assert.ok(res.changedLocal);

  assert.equal(computeMerged("settings", { a: 1 }, { a: 2 }, {}), null); // whole-value key → handled elsewhere
});

test("estimateBytes: guards against sync per-item quota overflow", () => {
  const small = [{ id: "a" }];
  assert.ok(estimateBytes(small) < MAX_SYNC_ITEM_BYTES);
  const huge = Array.from({ length: 5000 }, (_, i) => ({ id: `x${i}`, pad: "y".repeat(50) }));
  assert.ok(estimateBytes(huge) > MAX_SYNC_ITEM_BYTES);
});

/* ── Service behavior across two simulated devices ───────────────────────── */

function makeDevices() {
  // One shared MemoryStorageArea simulates chrome.storage.sync ("the cloud");
  // each device gets its own local area.
  const cloud = new MemoryStorageArea({});
  const deviceA = new GoogleSyncService({ local: new MemoryStorageArea({}), sync: cloud });
  const deviceB = new GoogleSyncService({ local: new MemoryStorageArea({}), sync: cloud });
  return { cloud, deviceA, deviceB };
}

test("workspace created on device A appears on device B without losing B's local workspaces", async () => {
  const { cloud, deviceA, deviceB } = makeDevices();

  // Both devices previously knew W0
  const w0 = group("w0", "Shared", 100);
  await deviceA["_local"].set({ bookmarkGroups: [w0] });
  await deviceB["_local"].set({ bookmarkGroups: [w0] });
  await cloud.set({ bookmarkGroups: [w0] });

  // Device A creates W1 (repo dual-writes local + sync)
  const w1 = group("w1", "Agency", 500);
  const aUpdated = [group("w0", "Shared", 600), w1]; // W0 also edited on A meanwhile
  await deviceA["_local"].set({ bookmarkGroups: aUpdated });
  await deviceA.pushKey("bookmarkGroups", aUpdated);

  // Meanwhile device B had created its OWN workspace W2 locally (not yet pushed)
  const w2 = group("w2", "B Local Only", 450);
  const bLocal = [group("w0", "Shared", 100), w2];
  await deviceB["_local"].set({ bookmarkGroups: bLocal });

  // Chrome delivers A's change to B → applyRemoteChanges merges
  const changed = await deviceB.applyRemoteChanges({
    bookmarkGroups: { oldValue: [w0], newValue: aUpdated },
  });
  assert.ok(changed.includes("bookmarkGroups"));

  const bIds = (await deviceB["_local"].get("bookmarkGroups")).bookmarkGroups.map((g) => g.id);
  assert.deepEqual(bIds.sort(), ["w0", "w1", "w2"], "B keeps W2 AND gains W1");

  // W0's newer edit from A wins on B
  const bW0 = (await deviceB["_local"].get("bookmarkGroups")).bookmarkGroups.find((g) => g.id === "w0");
  assert.equal(bW0.updatedAt, 600);
});

test("deletion on device A propagates to device B and survives stale snapshots", async () => {
  const { cloud, deviceA, deviceB } = makeDevices();

  const g1 = group("g1", "Keep", 100);
  const g2 = group("g2", "Doomed", 100);
  for (const d of [deviceA, deviceB]) {
    await d["_local"].set({ bookmarkGroups: [g1, g2] });
  }
  await cloud.set({ bookmarkGroups: [g1, g2] });

  // Device A deletes g2 → tombstone + pruned array pushed to sync
  const deletedAt = Date.now();
  await deviceA.recordDeletion("bookmarkGroups", ["g2"], deletedAt);
  await deviceA.pushKey("bookmarkGroups", [g1]);

  // Chrome delivers both changes in one batch to B
  const changed = await deviceB.applyRemoteChanges({
    bookmarkGroups: { oldValue: [g1, g2], newValue: [g1] },
    [TOMBSTONE_KEY]: { oldValue: undefined, newValue: { bookmarkGroups: { g2: deletedAt } } },
  });
  assert.ok(changed.includes("bookmarkGroups"));
  const bIds = (await deviceB["_local"].get("bookmarkGroups")).bookmarkGroups.map((g) => g.id);
  assert.deepEqual(bIds, ["g1"]);

  // Later, another device pushes a STALE snapshot still containing g2 → no resurrection
  await cloud.set({ bookmarkGroups: [g1, g2] });
  await deviceB.applyRemoteChanges({
    bookmarkGroups: { oldValue: [g1], newValue: [g1, g2] },
  });
  const bIds2 = (await deviceB["_local"].get("bookmarkGroups")).bookmarkGroups.map((g) => g.id);
  assert.deepEqual(bIds2, ["g1"]);
});

test("reconcile converges two devices bidirectionally and then becomes a no-op", async () => {
  const { deviceA, deviceB } = makeDevices();
  const wa = group("wa", "On A", 100);
  const wb = group("wb", "On B", 110);
  await deviceA["_local"].set({ bookmarkGroups: [wa] });
  await deviceB["_local"].set({ bookmarkGroups: [wb] });

  const r1 = await deviceA.reconcile();
  assert.deepEqual(r1.pushed, ["bookmarkGroups"]); // seed the cloud

  const r2 = await deviceB.reconcile();
  assert.deepEqual(r2.pulled.sort(), ["bookmarkGroups"]);
  const bIds = (await deviceB["_local"].get("bookmarkGroups")).bookmarkGroups.map((g) => g.id);
  assert.deepEqual(bIds.sort(), ["wa", "wb"]);

  const r3 = await deviceA.reconcile();
  assert.deepEqual(r3.pulled, ["bookmarkGroups"]); // picks up B's workspace
  const aIds = (await deviceA["_local"].get("bookmarkGroups")).bookmarkGroups.map((g) => g.id);
  assert.deepEqual(aIds.sort(), ["wa", "wb"]);

  const r4 = await deviceA.reconcile();
  const r5 = await deviceB.reconcile();
  assert.deepEqual(r4.pushed, []);
  assert.deepEqual(r4.pulled, []);
  assert.deepEqual(r5.pushed, []);
  assert.deepEqual(r5.pulled, []); // converged — zero writes (quota friendly)
});

test("pullAll merges instead of clobbering locally-newer edits", async () => {
  const { cloud, deviceB } = makeDevices();
  const w0Remote = group("w0", "Stale Name", 100);
  const w3 = group("w3", "Fresh From A", 700);
  await cloud.set({ bookmarkGroups: [w0Remote, w3] });

  // Locally renamed more recently than the remote snapshot
  const w0Local = group("w0", "Renamed Locally", 800);
  await deviceB["_local"].set({ bookmarkGroups: [w0Local] });

  const res = await deviceB.pullAll();
  assert.ok(res.pulledKeys.includes("bookmarkGroups"));

  const local = (await deviceB["_local"].get("bookmarkGroups")).bookmarkGroups;
  const byId = Object.fromEntries(local.map((g) => [g.id, g]));
  assert.equal(byId.w0.name, "Renamed Locally"); // local edit survived
  assert.equal(byId.w3.name, "Fresh From A"); // new remote item landed
});

test("isOwnEcho ignores reflections of our own sync writes", async () => {
  const { cloud, deviceA } = makeDevices();
  const val = [group("x", "X", 1)];
  await deviceA.pushKey("bookmarkGroups", val);
  assert.ok(deviceA.isOwnEcho("bookmarkGroups", val));
  assert.ok(!deviceA.isOwnEcho("bookmarkGroups", [group("y", "Y", 2)]));

  // And applying our own echo changes nothing locally
  await deviceA["_local"].set({ bookmarkGroups: val });
  const changed = await deviceA.applyRemoteChanges({
    bookmarkGroups: { oldValue: undefined, newValue: val },
  });
  assert.deepEqual(changed, []);
});

test("oversized keys are skipped with a warning instead of failing the whole batch", async () => {
  const { cloud, deviceA } = makeDevices();
  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    const huge = Array.from({ length: 4000 }, (_, i) => ({ id: `g${i}`, name: "x".repeat(40), folderIds: [], createdAt: i, updatedAt: i }));
    assert.ok(estimateBytes(huge) > MAX_SYNC_ITEM_BYTES);
    await deviceA.pushKey("categories", huge); // oversized → skipped

    const small = [{ id: "ok" }];
    await deviceA.pushKey("settings", small); // fits → written
  } finally {
    console.warn = origWarn;
  }
  assert.equal(cloud.store.categories, undefined);
  assert.deepEqual(cloud.store.settings, [{ id: "ok" }]);
  assert.ok(warnings.some((w) => w.includes("Skipping sync write")));
});

test("whole-value keys keep legacy mirror semantics (shortcuts/settings unaffected)", async () => {
  const { cloud, deviceB } = makeDevices();
  await cloud.set({ settings: { colorMode: "dark" } });
  const changed = await deviceB.applyRemoteChanges({
    settings: { oldValue: undefined, newValue: { colorMode: "dark" } },
  });
  assert.ok(changed.includes("settings"));
  assert.deepEqual((await deviceB["_local"].get("settings")).settings, { colorMode: "dark" });

  // Non-sync keys are never touched
  const changed2 = await deviceB.applyRemoteChanges({
    quickNote: { oldValue: undefined, newValue: "hack" },
  });
  assert.deepEqual(changed2, []);
});
