import test from "node:test";
import assert from "node:assert/strict";
import { Bookmark } from "../src/domain/entities/Bookmark.js";
import { Category } from "../src/domain/entities/Category.js";
import { Task } from "../src/domain/entities/Task.js";
import { UserSettings } from "../src/domain/entities/UserSettings.js";
import { WidgetLayout } from "../src/domain/entities/WidgetLayout.js";
import { BaseChromeListRepository } from "../src/infrastructure/persistence/chromeStorage/BaseChromeListRepository.js";

// Shape exported by the ORIGINAL extension (pre-faviconUrl era)
const OLD_BACKUP = {
  settings: {
    name: "Arnob",
    background: { kind: "local_image", value: "bg.png" },
    timeFormat: "24h",
    backgroundBlur: 4,
    backgroundOverlay: 0.35,
    clocks: [{ label: "Dhaka", timeZone: "Asia/Dhaka" }],
    searchEnabled: true,
    searchEngine: "youtube",
  },
  categories: [{ id: "c1", name: "Quick", order: 0 }],
  bookmarks: [
    { id: "b1", title: "GitHub", url: "https://github.com", categoryId: "c1", order: 0, lastAccessed: null, accessCount: 3 },
  ],
  tasks: [{ id: "t1", title: "Ship it", completed: false, order: 0 }],
};

test("old backup: settings round-trip without throwing", () => {
  const s = UserSettings.fromJSON(OLD_BACKUP.settings);
  assert.equal(s.name, "Arnob");
  assert.equal(s.timeFormat.value, "24h");
  assert.equal(s.searchEngine, "youtube");
  assert.equal(s.clocks[0].timeZone, "Asia/Dhaka");
  // round-trip keeps shape
  const again = UserSettings.fromJSON(s.toJSON());
  assert.equal(again.name, "Arnob");
});

test("old backup: bookmarks/categories/tasks round-trip", () => {
  const c = Category.fromJSON(OLD_BACKUP.categories[0]);
  assert.equal(c.name, "Quick");
  const b = Bookmark.fromJSON(OLD_BACKUP.bookmarks[0]);
  assert.equal(b.title, "GitHub");
  assert.equal(b.faviconUrl, "");
  assert.equal(b.accessCount, 3);
  const t = Task.fromJSON(OLD_BACKUP.tasks[0]);
  assert.equal(t.title, "Ship it");
});

test("bookmark with garbage faviconUrl imports as empty string, never throws", () => {
  for (const bad of ["not a url", "chrome://favicon/x", "public/favicons/ai.svg", "javascript:alert(1)", 42, { a: 1 }]) {
    const b = Bookmark.fromJSON({ ...OLD_BACKUP.bookmarks[0], faviconUrl: bad });
    assert.equal(b.faviconUrl, "");
  }
});

test("bookmark with valid faviconUrl keeps it", () => {
  const ok = Bookmark.fromJSON({ ...OLD_BACKUP.bookmarks[0], faviconUrl: "/public/favicons/ai.svg" });
  assert.equal(ok.faviconUrl, "/public/favicons/ai.svg");
  const http = Bookmark.fromJSON({ ...OLD_BACKUP.bookmarks[0], faviconUrl: "https://github.com/favicon.ico" });
  assert.equal(http.faviconUrl, "https://github.com/favicon.ico");
});

test("repo load skips unparseable rows instead of failing the whole list", async () => {
  const validLayoutJson = { id: "widget-clock", type: "clock", x: 1, y: 1, w: 4, h: 2, visible: true };
  const rows = [validLayoutJson, { id: "w-legacy", type: "quicknote", x: 1, y: 1, w: 2, h: 2 }];
  const stub = { getAll: async () => rows, set: async () => {}, onChanged: () => {} };
  const repo = new BaseChromeListRepository(stub, "layout", WidgetLayout.fromJSON);
  const list = await repo.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].type.value, "clock");
});

test("deriveAccentShades: generates correct CSS variables with opacity and shades", async () => {
  const { deriveAccentShades } = await import("../src/presentation/shared/colorUtils.js");
  const darkVars = deriveAccentShades("#555B66", "dark");
  assert.equal(darkVars["--accent"], "#555b66");
  assert.equal(darkVars["--accent-soft"], "rgba(85, 91, 102, 0.16)");
  assert.ok(darkVars["--accent-dark"]);
  assert.ok(darkVars["--accent-primary"]);

  const lightVars = deriveAccentShades("#D2683F", "light");
  assert.equal(lightVars["--accent"], "#d2683f");
  assert.equal(lightVars["--accent-soft"], "rgba(210, 104, 63, 0.12)");
});

test("UserSettings: cssVarAccent defaults to #555B66 and round-trips correctly", () => {
  const settings = new UserSettings();
  assert.equal(settings.cssVarAccent, "#555B66");
  const json = settings.toJSON();
  assert.equal(json.cssVarAccent, "#555B66");
  const restored = UserSettings.fromJSON(json);
  assert.equal(restored.cssVarAccent, "#555B66");
});

test("UserSettings: supports independent dark and light background presets and workspaceThemes", () => {
  const settings = new UserSettings({
    themePresetDark: "retro_grid",
    themePresetLight: "diamond_storm",
    colorMode: "dark",
    workspaceThemes: {
      "ws-1": {
        themePresetDark: "graphite_flow",
        themePresetLight: "aurora",
        colorMode: "light",
        cssVarAccent: "#3B82F6",
      },
    },
  });

  assert.equal(settings.themePresetDark, "retro_grid");
  assert.equal(settings.themePresetLight, "diamond_storm");
  assert.equal(settings.themePreset, "retro_grid");

  settings.setColorMode("light");
  assert.equal(settings.themePreset, "diamond_storm");

  const json = settings.toJSON();
  assert.equal(json.themePresetDark, "retro_grid");
  assert.equal(json.themePresetLight, "diamond_storm");
  assert.equal(json.workspaceThemes["ws-1"].themePresetDark, "graphite_flow");

  const restored = UserSettings.fromJSON(json);
  assert.equal(restored.themePresetDark, "retro_grid");
  assert.equal(restored.themePresetLight, "diamond_storm");
  assert.equal(restored.workspaceThemes["ws-1"].themePresetDark, "graphite_flow");
});

