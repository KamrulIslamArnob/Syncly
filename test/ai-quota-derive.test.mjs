import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deriveEffectiveState,
  deriveSecondsUntilActive,
  deriveSecondsToReset,
  formatSeconds,
  computeUsageRatio,
} from "../src/domain/services/quotaDerivation.js";

function makeProvider(overrides = {}) {
  return {
    isManuallyPaused: false,
    cooldownUntil: null,
    policies: [],
    ...overrides,
  };
}

function makePolicy(overrides = {}) {
  return { used: 0, budget: 100, secondsToReset: null, windowEnd: null, ...overrides };
}

describe("quotaDerivation", () => {
  describe("deriveEffectiveState", () => {
    it("returns active when nothing is wrong", () => {
      assert.equal(deriveEffectiveState(makeProvider()), "active");
    });

    it("returns paused when isManuallyPaused is true", () => {
      assert.equal(deriveEffectiveState(makeProvider({ isManuallyPaused: true })), "paused");
    });

    it("returns cooling when cooldown_until is in the future", () => {
      const future = new Date(Date.now() + 60_000).toISOString();
      assert.equal(deriveEffectiveState(makeProvider({ cooldownUntil: future })), "cooling");
    });

    it("returns active when cooldown_until is in the past", () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      assert.equal(deriveEffectiveState(makeProvider({ cooldownUntil: past })), "active");
    });

    it("returns depleted when a policy has used >= budget", () => {
      const provider = makeProvider({
        policies: [makePolicy({ used: 100, budget: 100 })],
      });
      assert.equal(deriveEffectiveState(provider), "depleted");
    });

    it("does not return depleted when used < budget", () => {
      const provider = makeProvider({
        policies: [makePolicy({ used: 50, budget: 100 })],
      });
      assert.equal(deriveEffectiveState(provider), "active");
    });

    it("prioritizes paused over depleted", () => {
      const provider = makeProvider({
        isManuallyPaused: true,
        policies: [makePolicy({ used: 100, budget: 100 })],
      });
      assert.equal(deriveEffectiveState(provider), "paused");
    });

    it("prioritizes cooling over depleted", () => {
      const future = new Date(Date.now() + 60_000).toISOString();
      const provider = makeProvider({
        cooldownUntil: future,
        policies: [makePolicy({ used: 100, budget: 100 })],
      });
      assert.equal(deriveEffectiveState(provider), "cooling");
    });
  });

  describe("deriveSecondsUntilActive", () => {
    it("returns null when no cooldown", () => {
      assert.equal(deriveSecondsUntilActive(makeProvider()), null);
    });

    it("returns positive number when cooldown is in the future", () => {
      const future = new Date(Date.now() + 5_000).toISOString();
      const secs = deriveSecondsUntilActive(makeProvider({ cooldownUntil: future }));
      assert.ok(secs > 0 && secs <= 10);
    });

    it("returns null when cooldown is in the past", () => {
      const past = new Date(Date.now() - 5_000).toISOString();
      assert.equal(deriveSecondsUntilActive(makeProvider({ cooldownUntil: past })), null);
    });
  });

  describe("deriveSecondsToReset", () => {
    it("uses secondsToReset if present", () => {
      assert.equal(deriveSecondsToReset(makePolicy({ secondsToReset: 3600 })), 3600);
    });

    it("computes from windowEnd if secondsToReset is null", () => {
      const future = new Date(Date.now() + 10_000).toISOString();
      const secs = deriveSecondsToReset(makePolicy({ windowEnd: future }));
      assert.ok(secs > 0 && secs <= 15);
    });

    it("returns null if neither exists", () => {
      assert.equal(deriveSecondsToReset(makePolicy()), null);
    });
  });

  describe("formatSeconds", () => {
    it("formats seconds into human-readable", () => {
      assert.equal(formatSeconds(0), "0m");
      assert.equal(formatSeconds(30), "0m");
      assert.equal(formatSeconds(120), "2m");
      assert.equal(formatSeconds(3661), "1h 1m");
      assert.equal(formatSeconds(90061), "1d 1h 1m");
      assert.equal(formatSeconds(null), null);
    });
  });

  describe("computeUsageRatio", () => {
    it("returns ratio of used / budget", () => {
      assert.equal(computeUsageRatio(makePolicy({ used: 50, budget: 100 })), 0.5);
    });

    it("caps at 1", () => {
      assert.equal(computeUsageRatio(makePolicy({ used: 200, budget: 100 })), 1);
    });

    it("returns 0 for zero budget", () => {
      assert.equal(computeUsageRatio(makePolicy({ budget: 0 })), 0);
    });
  });
});
