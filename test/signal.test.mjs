import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  signalBand,
  lastOpenedFor,
  relativeAge,
  openCountLabel,
  tallySignal,
  findDuplicates,
  siblingColor,
  assignFolderColors,
} from "../src/presentation/shared/signal.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 8, 13, 12, 0, 0);

describe("signalBand", () => {
  const cases = [
    ["opened 2 days ago", { lastOpenedAt: NOW - 2 * DAY }, "live"],
    ["opened exactly 7 days ago", { lastOpenedAt: NOW - 7 * DAY }, "live"],
    ["opened just over 7 days ago", { lastOpenedAt: NOW - 7 * DAY - 1 }, "rest"],
    ["opened exactly 90 days ago", { lastOpenedAt: NOW - 90 * DAY }, "rest"],
    ["opened just over 90 days ago", { lastOpenedAt: NOW - 90 * DAY - 1 }, "cold"],
    ["opened in the future (clock skew)", { lastOpenedAt: NOW + HOUR }, "live"],
    ["opened 3 days ago but saved long before", { lastOpenedAt: NOW - 3 * DAY, dateAdded: NOW - 200 * DAY }, "live"],
    ["never opened, saved 10 days ago", { dateAdded: NOW - 10 * DAY }, "rest"],
    ["never opened, saved 120 days ago", { dateAdded: NOW - 120 * DAY }, "cold"],
    ["never opened, save date unknown", {}, "cold"],
  ];
  for (const [name, input, want] of cases) {
    it(`${name} is ${want}`, () => {
      assert.equal(signalBand(input, NOW), want);
    });
  }
});

describe("lastOpenedFor", () => {
  const trackedSince = NOW - 20 * DAY;

  it("uses the newer of the deck's own record and Chrome's dateLastUsed", () => {
    const lastOpenedAt = { a: NOW - 5 * DAY };
    assert.equal(lastOpenedFor({ id: "a", dateLastUsed: NOW - 2 * DAY }, { lastOpenedAt }), NOW - 2 * DAY);
    assert.equal(lastOpenedFor({ id: "a", dateLastUsed: NOW - 9 * DAY }, { lastOpenedAt }), NOW - 5 * DAY);
  });

  it("falls back to Chrome's dateLastUsed when the deck never recorded an open", () => {
    assert.equal(lastOpenedFor({ id: "b", dateLastUsed: NOW - 3 * DAY }, { lastOpenedAt: {} }), NOW - 3 * DAY);
  });

  it("dates opens counted before timestamps existed to when tracking began", () => {
    assert.equal(lastOpenedFor({ id: "c" }, { lastOpenedAt: {}, usage: { c: 12 }, trackedSince }), trackedSince);
  });

  it("returns null when nothing says the link was ever opened", () => {
    assert.equal(lastOpenedFor({ id: "d" }, { lastOpenedAt: {}, usage: {}, trackedSince }), null);
    assert.equal(lastOpenedFor({ id: "e" }, { lastOpenedAt: {}, usage: { e: 3 } }), null);
  });
});

describe("relativeAge", () => {
  const cases = [
    ["unknown", null, ""],
    ["30 seconds ago", NOW - 30_000, "now"],
    ["5 minutes in the future", NOW + 5 * MINUTE, "now"],
    ["5 minutes ago", NOW - 5 * MINUTE, "5m"],
    ["3 hours ago", NOW - 3 * HOUR, "3h"],
    ["2 days ago", NOW - 2 * DAY, "2d"],
    ["13 days ago", NOW - 13 * DAY, "1w"],
    ["45 days ago", NOW - 45 * DAY, "1mo"],
    ["200 days ago", NOW - 200 * DAY, "6mo"],
    ["400 days ago", NOW - 400 * DAY, "1y"],
  ];
  for (const [name, ts, want] of cases) {
    it(`${name} reads "${want}"`, () => {
      assert.equal(relativeAge(ts, NOW), want);
    });
  }
});

describe("openCountLabel", () => {
  it("says never for a link that was never opened", () => {
    assert.equal(openCountLabel(0), "never");
  });

  it("shows the open count with a multiplication sign", () => {
    assert.equal(openCountLabel(33), "33×");
  });
});

describe("tallySignal", () => {
  it("counts each band and skips entries without a URL", () => {
    const bands = { a: "live", b: "cold", c: "rest", d: "cold", e: "live" };
    const leaves = [
      { id: "a", url: "https://a.test/" },
      { id: "b", url: "https://b.test/" },
      { id: "c", url: "https://c.test/" },
      { id: "d", url: "https://d.test/" },
      { id: "e" },
    ];
    assert.deepEqual(tallySignal(leaves, (leaf) => bands[leaf.id]), { live: 1, rest: 1, cold: 2, total: 4 });
  });
});

describe("findDuplicates", () => {
  const leaves = [
    { id: "1", url: "https://Example.com/shoes/", parentId: "f1" },
    { id: "2", url: "https://example.com/shoes", parentId: "f2" },
    { id: "3", url: "https://example.com/shoes", parentId: "f2" },
    { id: "4", url: "https://example.com/Shoes", parentId: "f3" },
    { id: "5", url: "https://news.test/a", parentId: "f1" },
    { id: "6", url: "https://news.test/a", parentId: "f4" },
    { id: "7", url: "https://solo.test/", parentId: "f5" },
    { id: "8", parentId: "f5" },
  ];

  it("groups links saved more than once, ignoring host case and a trailing slash", () => {
    const { groups } = findDuplicates(leaves);
    assert.deepEqual(groups.map((g) => g.leaves.map((l) => l.id)), [["1", "2", "3"], ["5", "6"]]);
  });

  it("counts the redundant copies and the folders holding them", () => {
    const { extraCopies, folderCount } = findDuplicates(leaves);
    assert.equal(extraCopies, 3);
    assert.equal(folderCount, 3);
  });

  it("reports nothing for a library without repeats", () => {
    assert.deepEqual(findDuplicates([{ id: "x", url: "https://x.test/", parentId: "f" }]), { groups: [], extraCopies: 0, folderCount: 0 });
  });
});

describe("folder colours", () => {
  it("gives neighbouring folders different colours and wraps after five", () => {
    assert.notEqual(siblingColor(0), siblingColor(1));
    assert.equal(siblingColor(5), siblingColor(0));
    assert.equal(siblingColor(7), siblingColor(2));
  });

  it("assigns colours by position among sibling folders at every level", () => {
    const folders = [
      { id: "10", type: "folder", title: "Code", children: [] },
      {
        id: "20", type: "folder", title: "Buy", children: [
          { id: "21", type: "bookmark", url: "https://x.test/" },
          { id: "22", type: "folder", title: "watch", children: [] },
          { id: "23", type: "folder", title: "shoes", children: [] },
        ],
      },
      { id: "loose:1", type: "folder", title: "Bookmarks Bar", children: [] },
    ];
    const colors = assignFolderColors(folders);
    assert.equal(colors.get("10"), "var(--folder-pal-0)");
    assert.equal(colors.get("20"), "var(--folder-pal-1)");
    assert.equal(colors.get("22"), "var(--folder-pal-0)", "bookmarks do not take a colour slot");
    assert.equal(colors.get("23"), "var(--folder-pal-1)");
    assert.equal(colors.get("loose:1"), "var(--folder-pal-2)");
    assert.equal(colors.get("1"), "var(--folder-pal-2)", "loose links resolve through their real parent id");
    assert.equal(colors.has("21"), false);
  });
});
