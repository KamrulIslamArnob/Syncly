import test, { describe, it } from "node:test";
import assert from "node:assert/strict";

import { Bookmark } from "../src/domain/entities/Bookmark.js";
import { Category } from "../src/domain/entities/Category.js";
import { Subfolder } from "../src/domain/entities/Subfolder.js";
import { Task } from "../src/domain/entities/Task.js";
import { WidgetLayout } from "../src/domain/entities/WidgetLayout.js";
import { BookmarkCollection } from "../src/domain/entities/BookmarkCollection.js";
import { BookmarkGroup } from "../src/domain/entities/BookmarkGroup.js";
import { UserSettings } from "../src/domain/entities/UserSettings.js";
import { Id } from "../src/domain/valueObjects/Id.js";
import { Url } from "../src/domain/valueObjects/Url.js";
import { BackgroundConfig } from "../src/domain/valueObjects/BackgroundConfig.js";
import { ClockFormat, TimeFormat } from "../src/domain/valueObjects/TimeFormat.js";
import { WidgetKind, WidgetType } from "../src/domain/valueObjects/WidgetType.js";

// ─── Bookmark ─────────────────────────────────────────────────────
describe("Entity: Bookmark", () => {
  function makeBookmark(overrides = {}) {
    return new Bookmark({
      id: new Id("b1"),
      title: "GitHub",
      url: new Url("https://github.com"),
      categoryId: new Id("c1"),
      order: 0,
      faviconUrl: "",
      ...overrides,
    });
  }

  it("DE-01 construct valid + getters", () => {
    const bm = makeBookmark({ title: "  GitHub  " });
    assert.equal(bm.id.value, "b1");
    assert.equal(bm.title, "GitHub"); // trimmed
    assert.equal(bm.url.href, "https://github.com/");
    assert.equal(bm.categoryId.value, "c1");
    assert.equal(bm.order, 0);
    assert.equal(bm.faviconUrl, "");
    assert.equal(bm.accessCount, 0);
    assert.equal(bm.lastAccessed, null);
  });

  it("DE-02 rejects invalid ctor args", () => {
    assert.throws(() => new Bookmark({ id: "not-Id", title: "t", url: new Url("https://a.b"), categoryId: new Id("c1") }), /Id/);
    assert.throws(() => new Bookmark({ id: new Id("b1"), title: "", url: new Url("https://a.b"), categoryId: new Id("c1") }), /non-empty/);
    assert.throws(() => new Bookmark({ id: new Id("b1"), title: "   ", url: new Url("https://a.b"), categoryId: new Id("c1") }), /non-empty/);
    assert.throws(() => new Bookmark({ id: new Id("b1"), title: "a".repeat(121), url: new Url("https://a.b"), categoryId: new Id("c1") }), /120/);
    assert.throws(() => new Bookmark({ id: new Id("b1"), title: "t", url: "not Url", categoryId: new Id("c1") }), /Url/);
    assert.throws(() => new Bookmark({ id: new Id("b1"), title: "t", url: new Url("https://a.b"), categoryId: "not-Id" }), /Id/);
    assert.throws(() => new Bookmark({ id: new Id("b1"), title: "t", url: new Url("https://a.b"), categoryId: new Id("c1"), order: -1 }), /order/);
    assert.throws(() => new Bookmark({ id: new Id("b1"), title: "t", url: new Url("https://a.b"), categoryId: new Id("c1"), order: 1.5 }), /order/);
  });

  it("DE-03 favicon normalization valid/invalid", () => {
    // valid keep
    assert.equal(makeBookmark({ faviconUrl: "" }).faviconUrl, "");
    assert.equal(makeBookmark({ faviconUrl: "https://cdn.example/icon.ico" }).faviconUrl, "https://cdn.example/icon.ico");
    assert.equal(makeBookmark({ faviconUrl: "/public/favicons/ai.svg" }).faviconUrl, "/public/favicons/ai.svg");
    const data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
    assert.equal(makeBookmark({ faviconUrl: data }).faviconUrl, data);
    // invalid throw in ctor
    assert.throws(() => makeBookmark({ faviconUrl: "javascript:alert(1)" }), /favicon/);
    assert.throws(() => makeBookmark({ faviconUrl: "chrome://favicon/x" }), /favicon/);
    assert.throws(() => makeBookmark({ faviconUrl: "not a url" }), /favicon/);
    assert.throws(() => makeBookmark({ faviconUrl: 42 }), /favicon.*string/);
  });

  it("DE-04 mutators", () => {
    const bm = makeBookmark();
    bm.rename("  GitLab  ");
    assert.equal(bm.title, "GitLab");
    assert.throws(() => bm.rename(""), /non-empty/);
    assert.throws(() => bm.rename("a".repeat(121)), /120/);
    bm.retarget(new Url("https://gitlab.com"));
    assert.equal(bm.url.href, "https://gitlab.com/");
    assert.throws(() => bm.retarget("not Url"), /Url/);
    bm.setFaviconUrl("https://example.com/favicon.ico");
    assert.equal(bm.faviconUrl, "https://example.com/favicon.ico");
    assert.throws(() => bm.setFaviconUrl("javascript:alert(1)"), /favicon/);
    bm.moveTo(new Id("c2"));
    assert.equal(bm.categoryId.value, "c2");
    assert.throws(() => bm.moveTo("c2"), /Id/);
    bm.reorder(5);
    assert.equal(bm.order, 5);
    assert.throws(() => bm.reorder(-1), /order/);
    bm.setSubfolderId("sf-1");
    assert.equal(bm.subfolderId, "sf-1");
    const before = Date.now();
    bm.recordAccess();
    assert.equal(bm.accessCount, 1);
    assert.ok(bm.lastAccessed >= before);
    bm.recordAccess();
    assert.equal(bm.accessCount, 2);
  });

  it("DE-05 fromJSON legacy tolerant", () => {
    const base = { id: "b1", title: "GitHub", url: "https://github.com", categoryId: "c1", order: 0 };
    assert.equal(Bookmark.fromJSON(base).faviconUrl, "");
    assert.equal(Bookmark.fromJSON({ ...base, faviconUrl: "javascript:alert(1)" }).faviconUrl, "");
    assert.equal(Bookmark.fromJSON({ ...base, faviconUrl: 42 }).faviconUrl, "");
    // still requires valid title/url/id
    assert.throws(() => Bookmark.fromJSON({ ...base, title: "" }), /non-empty/);
  });

  it("DE-06 toJSON/fromJSON round-trip", () => {
    const bm = makeBookmark({ title: "Test", faviconUrl: "/public/favicons/code.svg", order: 2, accessCount: 5, lastAccessed: 123456, subfolderId: "sf-1" });
    const json = bm.toJSON();
    assert.equal(json.id, "b1");
    assert.equal(json.title, "Test");
    assert.equal(json.faviconUrl, "/public/favicons/code.svg");
    const restored = Bookmark.fromJSON(json);
    assert.equal(restored.title, "Test");
    assert.equal(restored.faviconUrl, "/public/favicons/code.svg");
    assert.equal(restored.order, 2);
    assert.equal(restored.accessCount, 5);
    assert.equal(restored.subfolderId, "sf-1");
  });
});

// ─── Category ─────────────────────────────────────────────────────
describe("Entity: Category", () => {
  it("DE-07 construct/rename/reorder + validation", () => {
    const c = new Category({ id: new Id("c1"), name: "  Dev  ", order: 1 });
    assert.equal(c.name, "Dev");
    assert.equal(c.order, 1);
    assert.equal(c.id.value, "c1");
    // invalid ctor
    assert.throws(() => new Category({ id: "c1", name: "x" }), /Id/);
    assert.throws(() => new Category({ id: new Id("c1"), name: "" }), /non-empty/);
    assert.throws(() => new Category({ id: new Id("c1"), name: "   " }), /non-empty/);
    assert.throws(() => new Category({ id: new Id("c1"), name: "a".repeat(61) }), /60/);
    assert.throws(() => new Category({ id: new Id("c1"), name: "ok", order: -1 }), /order/);
    assert.throws(() => new Category({ id: new Id("c1"), name: "ok", order: 1.1 }), /order/);
    // rename
    c.rename("  Ops  ");
    assert.equal(c.name, "Ops");
    assert.throws(() => c.rename(""), /non-empty/);
    assert.throws(() => c.rename("a".repeat(61)), /60/);
    // reorder
    c.reorder(3);
    assert.equal(c.order, 3);
    assert.throws(() => c.reorder(-1), /order/);
  });
  it("DE-08 fromJSON missing order → 0", () => {
    const c = Category.fromJSON({ id: "c1", name: "Dev" });
    assert.equal(c.order, 0);
    const c2 = Category.fromJSON({ id: "c1", name: "Dev", order: "bad" });
    assert.equal(c2.order, 0);
  });
  it("toJSON/fromJSON", () => {
    const c = new Category({ id: new Id("c9"), name: "Marketing", order: 2 });
    const json = c.toJSON();
    assert.deepEqual(json, { id: "c9", name: "Marketing", order: 2 });
    const r = Category.fromJSON(json);
    assert.equal(r.name, "Marketing");
  });
});

// ─── Subfolder ────────────────────────────────────────────────────
describe("Entity: Subfolder", () => {
  it("DE-09 construct and mutate", () => {
    const s = new Subfolder({ id: new Id("s1"), name: "Frontend", categoryId: new Id("c1"), order: 0 });
    assert.equal(s.name, "Frontend");
    assert.equal(s.categoryId.value, "c1");
    assert.throws(() => new Subfolder({ id: new Id("s1"), name: "", categoryId: new Id("c1") }), /non-empty/);
    assert.throws(() => new Subfolder({ id: "s1", name: "ok", categoryId: new Id("c1") }), /Id/);
    assert.throws(() => new Subfolder({ id: new Id("s1"), name: "ok", categoryId: "c1" }), /Id/);
    assert.throws(() => new Subfolder({ id: new Id("s1"), name: "a".repeat(61), categoryId: new Id("c1") }), /60/);
    s.rename(" Backend ");
    assert.equal(s.name, "Backend");
    assert.throws(() => s.rename(""), /non-empty/);
    s.reorder(4);
    assert.equal(s.order, 4);
    assert.throws(() => s.reorder(-1), /order/);
  });
  it("toJSON/fromJSON", () => {
    const s = new Subfolder({ id: new Id("s1"), name: "A", categoryId: new Id("c1"), order: 1 });
    const j = s.toJSON();
    assert.equal(j.categoryId, "c1");
    const r = Subfolder.fromJSON(j);
    assert.equal(r.name, "A");
    assert.equal(Subfolder.fromJSON({ id: "s1", name: "A", categoryId: "c1" }).order, 0);
  });
});

// ─── Task ─────────────────────────────────────────────────────────
describe("Entity: Task", () => {
  it("DE-10 construct valid", () => {
    const t = new Task({ id: new Id("t1"), title: "Ship it", completed: false, order: 0, scheduledTime: "09:30", durationMinutes: 60, dueDate: "2026-08-20" });
    assert.equal(t.title, "Ship it");
    assert.equal(t.scheduledTime, "09:30");
    assert.equal(t.durationMinutes, 60);
    assert.equal(t.dueDate, "2026-08-20");
  });
  it("DE-11 validation", () => {
    assert.throws(() => new Task({ id: new Id("t1"), title: "" }), /non-empty/);
    assert.throws(() => new Task({ id: new Id("t1"), title: "a".repeat(201) }), /200/);
    assert.throws(() => new Task({ id: new Id("t1"), title: "ok", completed: "yes" }), /boolean/);
    assert.throws(() => new Task({ id: new Id("t1"), title: "ok", order: -1 }), /order/);
    assert.throws(() => new Task({ id: new Id("t1"), title: "ok", scheduledTime: "25:00" }), /HH:MM/);
    assert.throws(() => new Task({ id: new Id("t1"), title: "ok", scheduledTime: "9:30" }), /HH:MM/);
    assert.throws(() => new Task({ id: new Id("t1"), title: "ok", durationMinutes: 3 }), /5 and 1440/);
    assert.throws(() => new Task({ id: new Id("t1"), title: "ok", durationMinutes: 1441 }), /5 and 1440/);
    assert.throws(() => new Task({ id: new Id("t1"), title: "ok", dueDate: "2026-13-01" }), /valid date|YYYY-MM-DD/);
    assert.throws(() => new Task({ id: new Id("t1"), title: "ok", dueDate: "not-a-date" }), /YYYY-MM-DD/);
    assert.throws(() => new Task({ id: "t1", title: "ok" }), /Id/);
  });
  it("DE-12 mutators", () => {
    const t = new Task({ id: new Id("t1"), title: "Initial" });
    t.rename("Updated");
    assert.equal(t.title, "Updated");
    assert.throws(() => t.rename(""), /non-empty/);
    t.toggle();
    assert.equal(t.completed, true);
    t.toggle();
    assert.equal(t.completed, false);
    t.setCompleted(true);
    assert.equal(t.completed, true);
    assert.throws(() => t.setCompleted("yes"), /boolean/);
    t.reorder(2);
    assert.equal(t.order, 2);
    assert.throws(() => t.reorder(-1), /order/);
    t.schedule("14:00", 30);
    assert.equal(t.scheduledTime, "14:00");
    assert.equal(t.durationMinutes, 30);
    assert.throws(() => t.schedule("bad", 30), /HH:MM/);
    t.setDueDate("2026-12-01");
    assert.equal(t.dueDate, "2026-12-01");
    assert.throws(() => t.setDueDate("bad"), /YYYY-MM-DD/);
    t.setDueDate("");
    assert.equal(t.dueDate, "");
  });
  it("DE-13 fromJSON defaults", () => {
    const t = Task.fromJSON({ id: "t1", title: "Hello" });
    assert.equal(t.order, 0);
    assert.equal(t.completed, false);
    assert.equal(t.scheduledTime, "");
    assert.equal(t.durationMinutes, null);
    const t2 = Task.fromJSON({ id: "t1", title: "Hi", completed: 1, order: "bad", scheduledTime: 123, durationMinutes: "60", dueDate: 123 });
    assert.equal(t2.completed, true); // !!1
    assert.equal(t2.order, 0);
    assert.equal(t2.scheduledTime, "");
  });
  it("toJSON/fromJSON round-trip", () => {
    const t = new Task({ id: new Id("t9"), title: "X", completed: true, order: 2, scheduledTime: "10:00", durationMinutes: 15, dueDate: "2026-01-01" });
    const j = t.toJSON();
    const r = Task.fromJSON(j);
    assert.equal(r.title, "X");
    assert.equal(r.dueDate, "2026-01-01");
  });
});

// ─── WidgetLayout ─────────────────────────────────────────────────
describe("Entity: WidgetLayout", () => {
  it("DE-14 construct / move / resize / visible", () => {
    const wl = new WidgetLayout({ id: new Id("w1"), type: new WidgetKind(WidgetType.CLOCK), x: 1, y: 1, w: 4, h: 2, visible: true });
    assert.equal(wl.x, 1);
    wl.moveTo(2, 3);
    assert.equal(wl.x, 2);
    assert.equal(wl.y, 3);
    assert.throws(() => wl.moveTo(0, 1), /Invalid/);
    assert.throws(() => wl.moveTo(1.5, 1), /Invalid/);
    wl.resizeTo(6, 3);
    assert.equal(wl.w, 6);
    assert.throws(() => wl.resizeTo(0, 1), /Invalid/);
    wl.setVisible(false);
    assert.equal(wl.visible, false);
    assert.throws(() => wl.setVisible("yes"), /boolean/);
  });
  it("DE-15 reject invalid coords/visible", () => {
    assert.throws(() => new WidgetLayout({ id: new Id("w1"), type: new WidgetKind(WidgetType.CLOCK), x: 0, y: 1, w: 1, h: 1 }), />= 1/);
    assert.throws(() => new WidgetLayout({ id: "w1", type: new WidgetKind(WidgetType.CLOCK), x: 1, y: 1, w: 1, h: 1 }), /Id/);
    assert.throws(() => new WidgetLayout({ id: new Id("w1"), type: "clock", x: 1, y: 1, w: 1, h: 1 }), /WidgetKind/);
    assert.throws(() => new WidgetLayout({ id: new Id("w1"), type: new WidgetKind(WidgetType.CLOCK), x: 1.5, y: 1, w: 1, h: 1 }), /integers/);
    assert.throws(() => new WidgetLayout({ id: new Id("w1"), type: new WidgetKind(WidgetType.CLOCK), x: 1, y: 1, w: 1, h: 1, visible: "yes" }), /boolean/);
  });
  it("DE-16 defaults", () => {
    const defs = WidgetLayout.defaults();
    assert.equal(defs.length, 4);
    const types = defs.map(d => d.type.value);
    assert.ok(types.includes("greeting"));
    assert.ok(types.includes("clock"));
    assert.ok(types.includes("bookmarks"));
    assert.ok(types.includes("todo"));
    for (const w of defs) assert.equal(w.visible, true);
  });
  it("toJSON/fromJSON", () => {
    const wl = new WidgetLayout({ id: new Id("w-custom"), type: new WidgetKind(WidgetType.CLOCK), x: 2, y: 2, w: 3, h: 3, visible: false });
    const json = wl.toJSON();
    assert.equal(json.id, "w-custom");
    assert.equal(json.type, "clock");
    assert.equal(json.visible, false);
    const restored = WidgetLayout.fromJSON(json);
    assert.equal(restored.id.value, "w-custom");
  });
  it("WidgetLayout fromJSON defaults visible", () => {
    const wl = WidgetLayout.fromJSON({ id: "w1", type: "clock", x: 1, y: 1, w: 2, h: 2 });
    assert.equal(wl.visible, true);
    const wl2 = WidgetLayout.fromJSON({ id: "w1", type: "clock", x: 1, y: 1, w: 2, h: 2, visible: false });
    assert.equal(wl2.visible, false);
  });
});

// ─── BookmarkCollection ───────────────────────────────────────────
describe("Entity: BookmarkCollection", () => {
  it("DE-17 validate name dedupe", () => {
    const c = new BookmarkCollection({ id: "c1", name: "  AI  ", bookmarkIds: ["b1", "b2", "b1", " ", "", 123] });
    assert.equal(c.name, "AI");
    assert.deepEqual(c.bookmarkIds, ["b1", "b2"]);
    assert.throws(() => new BookmarkCollection({ id: "c1", name: "   " }), /non-empty/);
    assert.throws(() => new BookmarkCollection({ id: "c1", name: "a".repeat(51) }), /50/);
    assert.throws(() => new BookmarkCollection({ id: "", name: "ok" }), /non-empty/);
    assert.throws(() => BookmarkCollection.fromJSON(null), /Invalid/);
  });
  it("DE-18 mutators bump updatedAt", async () => {
    const c = new BookmarkCollection({ id: "c1", name: "First", bookmarkIds: ["b1"] });
    const before = c.updatedAt;
    await new Promise(r => setTimeout(r, 2));
    c.rename("Second");
    assert.equal(c.name, "Second");
    assert.ok(c.updatedAt >= before);
    assert.throws(() => c.rename(""), /non-empty/);
    c.addBookmarkIds(["b2", "b1"]);
    assert.deepEqual(c.bookmarkIds, ["b1", "b2"]);
    c.addBookmarkIds([]); // no-op, still bumps? actually early return
    c.removeBookmarkIds(["b1"]);
    assert.deepEqual(c.bookmarkIds, ["b2"]);
    c.setBookmarkIds(["x", "x", "y"]);
    assert.deepEqual(c.bookmarkIds, ["x", "y"]);
  });
  it("workspaceId handling", () => {
    const c = new BookmarkCollection({ id: "c1", name: "Work", workspaceId: "ws-1" });
    assert.equal(c.workspaceId, "ws-1");
    assert.equal(new BookmarkCollection({ id: "c1", name: "Work", workspaceId: "   " }).workspaceId, null);
    const j = c.toJSON();
    assert.equal(j.workspaceId, "ws-1");
    assert.equal(BookmarkCollection.fromJSON(j).workspaceId, "ws-1");
  });
});

// ─── BookmarkGroup ────────────────────────────────────────────────
describe("Entity: BookmarkGroup", () => {
  it("DE-19 validate name reserved/icon/folderIds", () => {
    assert.equal(BookmarkGroup.validateName("My Team"), "My Team");
    assert.throws(() => BookmarkGroup.validateName(""), /non-empty/);
    assert.throws(() => BookmarkGroup.validateName("a".repeat(51)), /50/);
    for (const r of BookmarkGroup.RESERVED_NAMES) {
      assert.throws(() => BookmarkGroup.validateName(r), /reserved/);
      assert.throws(() => BookmarkGroup.validateName(r.toLowerCase()), /reserved/);
    }
    assert.equal(BookmarkGroup.validateIcon("folder"), "folder");
    assert.equal(BookmarkGroup.validateIcon("briefcase"), "briefcase");
    assert.throws(() => BookmarkGroup.validateIcon(""), /non-empty/);
    assert.throws(() => BookmarkGroup.validateIcon("bad icon!"), /Invalid icon/);
    assert.throws(() => BookmarkGroup.validateFolderIds("not array"), /array/);
    assert.throws(() => BookmarkGroup.validateFolderIds(new Array(51).fill("x")), /50/);
    assert.deepEqual(BookmarkGroup.validateFolderIds(["a", "", null, "b"]), ["a", "b"]);
  });
  it("DE-20 mutators", async () => {
    const g = new BookmarkGroup({ id: "g1", name: "Team A", icon: "folder", folderIds: ["1"] });
    const before = g.updatedAt;
    await new Promise(r => setTimeout(r, 2));
    g.updateName("Team B");
    assert.equal(g.name, "Team B");
    assert.ok(g.updatedAt >= before);
    g.updateIcon("code");
    assert.equal(g.icon, "code");
    g.updateFolderIds(["2", "3"]);
    assert.deepEqual(g.folderIds, ["2", "3"]);
    assert.throws(() => g.updateName("Quickie"), /reserved/);
  });
  it("fromJSON icon fallback", () => {
    const g = BookmarkGroup.fromJSON({ id: "g1", name: "Valid", icon: "bad icon!", folderIds: ["1"] });
    assert.equal(g.icon, "folder");
    assert.throws(() => BookmarkGroup.fromJSON(null), /Invalid/);
  });
});

// ─── UserSettings ─────────────────────────────────────────────────
describe("Entity: UserSettings DE-21..DE-25", () => {
  it("DE-21 constructor defaults and validation", () => {
    const s = new UserSettings();
    assert.equal(s.name, "");
    assert.equal(s.colorMode, "dark");
    assert.equal(s.searchEngine, "google");
    assert.equal(s.todoEnabled, true);
    // invalid name >60
    assert.throws(() => new UserSettings({ name: "a".repeat(61) }), /60/);
    assert.throws(() => new UserSettings({ backgroundBlur: 21 }), /0 and 20/);
    assert.throws(() => new UserSettings({ backgroundOverlay: 2 }), /0 and 1/);
    assert.throws(() => new UserSettings({ searchEngine: "bad" }), /Invalid/);
    const themes = ["aurora", "retro_grid", "diamond_storm", "graphite_flow", "solid", "minimal", "nord", "cyberpunk", "sage"];
    assert.throws(() => new UserSettings({ themePreset: "bad" }), /Invalid/);
    assert.throws(() => new UserSettings({ colorMode: "bad" }), /Invalid/);
    assert.throws(() => new UserSettings({ weatherUnit: "k" }), /c or f/);
    // background type check
    assert.throws(() => new UserSettings({ background: "not BG" }), /BackgroundConfig/);
  });
  it("DE-22 customCss hardening", () => {
    const evil = `@import url("https://evil.com/x.css"); body { color: red; } @font-face { font-family: x; src: url(https://evil.com/font.woff); } div { background: url(https://evil.com/bg.png); } a { javascript:alert(1) } .x { expression(alert(1)) } .y { -moz-binding: url('x'); } .z { behavior: url(x.htc); }`;
    const s = new UserSettings({ customCss: evil });
    assert.equal(s.customCss.includes("@import"), false);
    assert.equal(s.customCss.includes("https://evil.com"), false);
    assert.equal(s.customCss.includes("javascript:"), false);
    assert.equal(s.customCss.includes("expression"), false);
    assert.equal(s.customCss.includes("-moz-binding"), false);
    assert.equal(s.customCss.includes("behavior"), false);
    // caps 20k
    const big = "a".repeat(25000);
    assert.equal(new UserSettings({ customCss: big }).customCss.length, 20000);
    // setter also hardens
    const s2 = new UserSettings();
    s2.setCustomCss(evil);
    assert.equal(s2.customCss.includes("@import"), false);
  });
  it("DE-23 toJSON/fromJSON round-trip", () => {
    const s = new UserSettings({
      name: "Arnob",
      avatarUrl: "https://cdn.example/avatar.png",
      backgroundBlur: 5,
      backgroundOverlay: 0.5,
      searchEngine: "duckduckgo",
      themePresetDark: "retro_grid",
      themePresetLight: "diamond_storm",
      colorMode: "dark",
      fontSize: "large",
      workspaceThemes: { "ws-1": { themePresetDark: "graphite_flow", themePresetLight: "aurora", colorMode: "light", cssVarAccent: "#3B82F6" } },
      cssVarAccent: "#FF0000",
      showWebsitePreviews: false,
    });
    const json = s.toJSON();
    assert.equal(json.name, "Arnob");
    assert.equal(json.fontSize, "large");
    assert.equal(json.cssVarAccent, "#FF0000");
    assert.equal(json.showWebsitePreviews, false);
    assert.equal(json.workspaceThemes["ws-1"].themePresetDark, "graphite_flow");
    const restored = UserSettings.fromJSON(json);
    assert.equal(restored.name, "Arnob");
    assert.equal(restored.fontSize, "large");
    assert.equal(restored.cssVarAccent, "#FF0000");
    assert.equal(restored.workspaceThemes["ws-1"].themePresetDark, "graphite_flow");
  });
  it("DE-24 colorMode ↔ themePreset sync", () => {
    const s = new UserSettings({ themePresetDark: "retro_grid", themePresetLight: "diamond_storm", colorMode: "dark" });
    assert.equal(s.themePreset, "retro_grid");
    s.setColorMode("light");
    assert.equal(s.themePreset, "diamond_storm");
    s.setColorMode("dark");
    assert.equal(s.themePreset, "retro_grid");
    s.setThemePresetDark("solid");
    assert.equal(s.themePresetDark, "solid");
    s.setThemePresetLight("minimal");
    assert.equal(s.themePresetLight, "minimal");
  });
  it("DE-25 fromJSON resilience", () => {
    const s = UserSettings.fromJSON(null);
    assert.equal(s.name, "");
    assert.equal(s.fontSize, "default");
    const s2 = UserSettings.fromJSON({ background: null, clocks: null, themePreset: "bad", themePresetDark: "bad", fontSize: "invalid" });
    assert.equal(s2.themePreset, "aurora"); // fallback
    assert.equal(s2.fontSize, "default"); // fallback
    assert.equal(s2.background.kind, "solid_color");
    assert.equal(Array.isArray(s2.clocks) && s2.clocks.length, 4);
  });
  it("setters validation", () => {
    const s = new UserSettings();
    s.setName("New Name");
    assert.equal(s.name, "New Name");
    assert.throws(() => s.setName("a".repeat(61)), /60/);
    s.setBackgroundBlur(10);
    assert.equal(s.backgroundBlur, 10);
    assert.throws(() => s.setBackgroundBlur(25), /0 and 20/);
    s.setBackgroundOverlay(0.7);
    assert.equal(s.backgroundOverlay, 0.7);
    s.setSearchEngine("bing");
    assert.equal(s.searchEngine, "bing");
    assert.throws(() => s.setSearchEngine("bad"), /Invalid/);
    s.setFontSize("xlarge");
    assert.equal(s.fontSize, "xlarge");
    assert.throws(() => s.setFontSize("gigantic"), /Invalid/);
    s.setThemePreset("nord");
    s.setColorMode("light");
    assert.equal(s.colorMode, "light");
    s.setShowWebsitePreviews(false);
    assert.equal(s.showWebsitePreviews, false);
  });
});
