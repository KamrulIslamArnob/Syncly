import test, { describe, it } from "node:test";
import assert from "node:assert/strict";

import { Id } from "../src/domain/valueObjects/Id.js";
import { Url } from "../src/domain/valueObjects/Url.js";
import { BackgroundConfig, BackgroundKind } from "../src/domain/valueObjects/BackgroundConfig.js";
import { ClockFormat, TimeFormat } from "../src/domain/valueObjects/TimeFormat.js";
import { Greeting } from "../src/domain/valueObjects/Greeting.js";
import { WidgetKind, WidgetType } from "../src/domain/valueObjects/WidgetType.js";
import { WorldClockConfig } from "../src/domain/valueObjects/WorldClockConfig.js";

// ─── Id ───────────────────────────────────────────────────────────
describe("ValueObjects: Id", () => {
  it("VO-01 create valid and equals", () => {
    const a = new Id("abc-123");
    const b = new Id("abc-123");
    const c = new Id("other");
    assert.equal(a.value, "abc-123");
    assert.equal(a.equals(b), true);
    assert.equal(a.equals(c), false);
    assert.equal(a.toString(), "abc-123");
  });
  it("VO-02 rejects empty/non-string", () => {
    for (const bad of ["", null, undefined, 123, {}, [], "   " ? "" : ""]) assert.throws(() => new Id(""), /non-empty/);
    assert.throws(() => new Id(null), /non-empty/);
    assert.throws(() => new Id(123), /non-empty/);
    assert.throws(() => new Id(undefined), /non-empty/);
    assert.throws(() => new Id(""), /non-empty/);
  });
  it("VO-03 equals returns false for non-Id", () => {
    const a = new Id("x");
    assert.equal(a.equals("x"), false);
    assert.equal(a.equals({ value: "x" }), false);
    assert.equal(a.equals(null), false);
  });
});

// ─── Url ──────────────────────────────────────────────────────────
describe("ValueObjects: Url", () => {
  it("VO-04 accepts http/https and normalizes", () => {
    const u = new Url("https://example.com/a?b=1");
    assert.ok(u.href.startsWith("https://example.com"));
    assert.equal(u.host, "example.com");
    const u2 = new Url("http://a.b/c");
    assert.equal(u2.host, "a.b");
  });
  it("VO-05 auto-prefixes bare host", () => {
    const u = new Url("example.com");
    assert.equal(u.href, "http://example.com/");
    assert.equal(u.raw, "example.com");
    const u2 = new Url(" github.com/foo ");
    assert.equal(u2.href, "http://github.com/foo");
  });
  it("VO-06 rejects bad schemes and empty", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,<h1>x</h1>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "ftp://host/x",
      "",
      "   ",
    ]) {
      assert.throws(() => new Url(bad), undefined, `bad=${JSON.stringify(bad)}`);
    }
    assert.throws(() => new Url(null), /string/);
    assert.throws(() => new Url(42), /string/);
  });
  it("VO-07 equals normalized", () => {
    const a = new Url("https://example.com");
    const b = new Url("https://example.com/");
    const c = new Url("https://other.com");
    assert.equal(a.equals(b), true);
    assert.equal(a.equals(c), false);
    assert.equal(a.equals({ href: a.href }), false);
    assert.equal(a.toString(), a.href);
  });
  it("trims and handles uppercase scheme via normalized host", () => {
    const u = new Url("  HTTPS://EXAMPLE.COM/Path  ");
    assert.ok(u.href.startsWith("https://"));
  });
});

// ─── BackgroundConfig ─────────────────────────────────────────────
describe("ValueObjects: BackgroundConfig", () => {
  it("VO-08 localImage accepts data URL and image filenames", () => {
    const d = BackgroundConfig.localImage("data:image/png;base64,abcd");
    assert.equal(d.kind, BackgroundKind.LOCAL_IMAGE);
    const f = BackgroundConfig.localImage("bg.png");
    assert.equal(f.value, "bg.png");
    assert.equal(BackgroundConfig.localImage("photo.WEBP").kind, BackgroundKind.LOCAL_IMAGE);
    assert.equal(BackgroundConfig.localImage("x.gif").kind, BackgroundKind.LOCAL_IMAGE);
    assert.equal(BackgroundConfig.localImage("foo.jpeg").kind, BackgroundKind.LOCAL_IMAGE);
    assert.equal(BackgroundConfig.localImage("foo.jpg").kind, BackgroundKind.LOCAL_IMAGE);
  });
  it("VO-09 localImage rejects bad filename", () => {
    assert.throws(() => BackgroundConfig.localImage("bg.txt"), /Local image/);
    assert.throws(() => BackgroundConfig.localImage(""), /Local image|non-empty/);
    assert.throws(() => BackgroundConfig.localImage("document.pdf"), /Local image/);
  });
  it("VO-10 remoteImage accepts http(s)", () => {
    const r = BackgroundConfig.remoteImage("https://cdn.example/bg.jpg");
    assert.equal(r.kind, BackgroundKind.REMOTE_IMAGE);
    const r2 = BackgroundConfig.remoteImage("http://a.b/c.png");
    assert.equal(r2.kind, BackgroundKind.REMOTE_IMAGE);
  });
  it("VO-11 remoteImage rejects javascript:", () => {
    assert.throws(() => BackgroundConfig.remoteImage("javascript:alert(1)"), /http/);
    assert.throws(() => BackgroundConfig.remoteImage("data:text/html,hi"), /http/);
    assert.throws(() => BackgroundConfig.remoteImage("ftp://x/y"), /http/);
  });
  it("VO-12 solidColor and gradient any string", () => {
    const s = BackgroundConfig.solidColor("#ff0000");
    assert.equal(s.kind, BackgroundKind.SOLID_COLOR);
    assert.equal(s.value, "#ff0000");
    const g = BackgroundConfig.gradient("linear-gradient(red, blue)");
    assert.equal(g.kind, BackgroundKind.GRADIENT);
  });
  it("VO-13 rejects unknown kind", () => {
    assert.throws(() => new BackgroundConfig("bad", "x"), /Unsupported/);
    assert.throws(() => new BackgroundConfig("", "x"), /Unsupported/);
    assert.throws(() => new BackgroundConfig(null, "x"), /Unsupported/);
  });
  it("VO-13b rejects empty value", () => {
    assert.throws(() => new BackgroundConfig(BackgroundKind.SOLID_COLOR, ""), /non-empty/);
    assert.throws(() => new BackgroundConfig(BackgroundKind.SOLID_COLOR, 123), /non-empty/);
  });
  it("VO-14 equals", () => {
    const a = BackgroundConfig.solidColor("#000");
    const b = BackgroundConfig.solidColor("#000");
    const c = BackgroundConfig.solidColor("#fff");
    const d = BackgroundConfig.gradient("#000");
    assert.equal(a.equals(b), true);
    assert.equal(a.equals(c), false);
    assert.equal(a.equals(d), false);
    assert.equal(a.equals({ kind: "#000", value: "#000" }), false);
  });
});

// ─── ClockFormat / TimeFormat ──────────────────────────────────────
describe("ValueObjects: ClockFormat", () => {
  it("VO-15 construct 12h/24h", () => {
    assert.equal(new ClockFormat(TimeFormat.H12).value, "12h");
    assert.equal(new ClockFormat(TimeFormat.H24).value, "24h");
    assert.equal(new ClockFormat("12h").value, "12h");
  });
  it("VO-16 rejects unknown", () => {
    assert.throws(() => new ClockFormat("13h"), /Unknown/);
    assert.throws(() => new ClockFormat(""), /Unknown/);
    assert.throws(() => new ClockFormat(null), /Unknown/);
    assert.throws(() => new ClockFormat(undefined), /Unknown/);
  });
  it("VO-17 toggle flips", () => {
    const a = new ClockFormat(TimeFormat.H12);
    assert.equal(a.toggle().value, TimeFormat.H24);
    assert.equal(a.toggle().toggle().value, TimeFormat.H12);
    assert.equal(new ClockFormat(TimeFormat.H24).toggle().value, TimeFormat.H12);
  });
  it("VO-17b default", () => {
    assert.equal(ClockFormat.default().value, TimeFormat.H24);
  });
  it("VO-18 equals", () => {
    assert.equal(new ClockFormat("12h").equals(new ClockFormat("12h")), true);
    assert.equal(new ClockFormat("12h").equals(new ClockFormat("24h")), false);
    assert.equal(new ClockFormat("12h").equals({ value: "12h" }), false);
  });
});

// ─── Greeting ───────────────────────────────────────────────────────
describe("ValueObjects: Greeting", () => {
  it("VO-19 fromHour part mapping", () => {
    assert.equal(Greeting.fromHour(0, "").partOfDay, "morning");
    assert.equal(Greeting.fromHour(8, "").partOfDay, "morning");
    assert.equal(Greeting.fromHour(11, "").partOfDay, "morning");
    assert.equal(Greeting.fromHour(12, "").partOfDay, "afternoon");
    assert.equal(Greeting.fromHour(17, "").partOfDay, "afternoon");
    assert.equal(Greeting.fromHour(18, "").partOfDay, "evening");
    assert.equal(Greeting.fromHour(23, "").partOfDay, "evening");
  });
  it("VO-20 render with name", () => {
    assert.equal(new Greeting("morning", "Ann").render(), "Good Morning, Ann");
    assert.equal(new Greeting("afternoon", "Bob").render(), "Good Afternoon, Bob");
    assert.equal(new Greeting("evening", "Carol").render(), "Good Evening, Carol");
    assert.equal(Greeting.fromHour(9, "Ann").render(), "Good Morning, Ann");
  });
  it("VO-21 render empty name trims", () => {
    assert.equal(new Greeting("morning", "   ").render(), "Good Morning");
    assert.equal(new Greeting("morning", "").render(), "Good Morning");
    assert.equal(new Greeting("morning", "  Ann  ").render(), "Good Morning, Ann");
  });
  it("VO-22 rejects unknown part", () => {
    assert.throws(() => new Greeting("noon", "Ann"), /Unknown/);
    assert.throws(() => new Greeting("", "Ann"), /Unknown/);
    assert.throws(() => new Greeting(null, "Ann"), /Unknown/);
    assert.throws(() => new Greeting("morning", 123), /Name must be/);
  });
  it("getters preserve values", () => {
    const g = new Greeting("afternoon", "Test");
    assert.equal(g.partOfDay, "afternoon");
    assert.equal(g.name, "Test");
  });
});

// ─── WidgetKind ─────────────────────────────────────────────────────
describe("ValueObjects: WidgetKind", () => {
  it("VO-23 accepts known", () => {
    for (const v of Object.values(WidgetType)) {
      assert.equal(new WidgetKind(v).value, v);
    }
  });
  it("VO-24 rejects unknown", () => {
    assert.throws(() => new WidgetKind("weather"), /Unknown/);
    assert.throws(() => new WidgetKind(""), /Unknown/);
    assert.throws(() => new WidgetKind(null), /Unknown/);
    assert.throws(() => new WidgetKind(undefined), /Unknown/);
    assert.throws(() => new WidgetKind("BOOKMARKS"), /Unknown/);
  });
  it("equals", () => {
    assert.equal(new WidgetKind("clock").equals(new WidgetKind("clock")), true);
    assert.equal(new WidgetKind("clock").equals(new WidgetKind("todo")), false);
    assert.equal(new WidgetKind("clock").equals({ value: "clock" }), false);
  });
});

// ─── WorldClockConfig ───────────────────────────────────────────────
describe("ValueObjects: WorldClockConfig", () => {
  it("VO-25 construct + toJSON/fromJSON", () => {
    const c = new WorldClockConfig("Dhaka", "Asia/Dhaka");
    assert.equal(c.label, "Dhaka");
    assert.equal(c.timeZone, "Asia/Dhaka");
    const json = c.toJSON();
    assert.deepEqual(json, { label: "Dhaka", timeZone: "Asia/Dhaka" });
    const restored = WorldClockConfig.fromJSON(json);
    assert.equal(restored.label, "Dhaka");
    assert.equal(restored.timeZone, "Asia/Dhaka");
  });
  it("VO-25b trims label/zone", () => {
    const c = new WorldClockConfig("  Dhaka  ", "  Asia/Dhaka  ");
    assert.equal(c.label, "Dhaka");
    assert.equal(c.timeZone, "Asia/Dhaka");
  });
  it("VO-26 rejects bad label/timezone type", () => {
    assert.throws(() => new WorldClockConfig("", "Asia/Dhaka"), /non-empty/);
    assert.throws(() => new WorldClockConfig("   ", ""), /non-empty/);
    assert.throws(() => new WorldClockConfig("Dhaka", 123), /string/);
    assert.throws(() => new WorldClockConfig(null, ""), /string/);
  });
  it("VO-25c fromJSON defaults for missing/ null", () => {
    const def = WorldClockConfig.fromJSON(null);
    assert.equal(def.label, "Local");
    assert.equal(def.timeZone, "");
    const def2 = WorldClockConfig.fromJSON({});
    assert.equal(def2.label, "Local");
  });
  it("empty timeZone allowed for local", () => {
    const c = new WorldClockConfig("Local", "");
    assert.equal(c.timeZone, "");
  });
});
