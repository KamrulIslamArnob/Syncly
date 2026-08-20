import { buildContainer } from "../../infrastructure/di/container.js";
import { el } from "../shared/dom.js";
import { deriveAccentShades } from "../shared/colorUtils.js";
import { sanitizeCss } from "../../infrastructure/security/cssSanitizer.js";

import { SettingsSidebarView } from "./views/SettingsSidebarView.js";
import { ToastView } from "./views/ToastView.js";
import { BookmarkDeckView } from "./views/BookmarkDeckView.js";

// NewTabController — composition root for the new-tab page.
//
// The page is a single bookmark-manager workspace (BookmarkDeckView) plus
// a settings sidebar.
export class NewTabController {
  constructor() {
    this.container = null;
    this.state = { settings: null };
    this.views = {};
    this.unsubs = [];
    this.toast = new ToastView();
  }

  async init() {
    document.fonts.ready.then(() => document.body.classList.add("fonts-loaded"));

    try {
      this.container = buildContainer();
    } catch (err) {
      console.error("Failed to build container:", err);
      this.fatal("Failed to start extension architecture", err);
      return;
    }

    const { useCases, events, internals } = this.container;
    this.useCases = useCases;
    this.events = events;
    this.internals = internals;
    this.stateRef = { current: this.state };

    try {
      this.views = {
        settings: new SettingsSidebarView({
          useCases,
          events,
          toast: this.toast,
          stateRef: this.stateRef,
          internals,
          getActiveGroup: () => this.getActiveGroup(),
        }),
        deck: new BookmarkDeckView({
          getTree: () =>
            (typeof chrome !== "undefined" && chrome.bookmarks && typeof chrome.bookmarks.getTree === "function")
              ? chrome.bookmarks.getTree()
              : Promise.resolve([]),
          toast: this.toast,
          storage:
            (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local)
              ? chrome.storage.local
              : null,
          useCases,
          events,
          onOpenSettings: () => this.views.settings.toggle(document.getElementById("btn-settings")),
          getColorMode: () => document.documentElement.getAttribute("data-color-mode") || "dark",
          setColorMode: (mode) => this.setColorMode(mode),
        }),
      };
    } catch (err) {
      console.error("Failed to initialize views:", err);
      this.fatal("Failed to initialize UI components", err);
      return;
    }

    this.subscribe();
    this.bindGlobalKeys();

    try {
      await this.loadState();
      this.render();
      setTimeout(() => this.triggerAutoBackup(), 1500);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      this.fatal("Failed to load dashboard data", err);
    }
  }

  getActiveGroup() {
    return this.views?.deck?.groupButtons?.activeGroup || null;
  }

  async loadState() {
    this.state.settings = await this.useCases.getSettings.execute();
    this.stateRef.current = this.state;
    const activeGroupId = await this.useCases.setActiveGroup.getActive();
    this.applyTheme(this.state.settings, activeGroupId);
  }

  fatal(where, err) {
    console.error(where, err);
    this.toast?.show(`${where}: ${err?.message || err}`, { error: true });
    document.getElementById("fatal-overlay")?.remove();
    const overlay = el("div", { id: "fatal-overlay", className: "fatal-error-overlay" },
      el("h2", { className: "fatal-error-title" }, "HomeScreen could not start"),
      el("pre", { className: "fatal-error-details" }, `${where}\n\n${err?.stack || err?.message || err}`)
    );
    document.body.appendChild(overlay);
  }

  subscribe() {
    this.unsubs.push(this.events.on("settings:changed", () => this.refreshSettings()));
    this.unsubs.push(this.events.on("bookmarkGroup:changed", (groupId) => {
      this.applyTheme(this.state.settings, groupId);
    }));
  }

  async refreshSettings() {
    try {
      this.state.settings = await this.useCases.getSettings.execute();
      this.applyTheme(this.state.settings);
      this.applyCustomCss(this.state.settings.customCss);
    } catch (err) {
      this.toast.show(err.message || "Could not refresh settings", { error: true });
    }
  }

  getCurrentThemeConfig(settings = this.state.settings, activeGroupId = undefined) {
    const s = settings || {};
    const effectiveGroupId = (activeGroupId !== undefined) ? activeGroupId : (this.getActiveGroup()?.id || null);
    if (effectiveGroupId && s.workspaceThemes && s.workspaceThemes[effectiveGroupId]) {
      const wsTheme = s.workspaceThemes[effectiveGroupId];
      const mode = wsTheme.colorMode || s.colorMode || "dark";
      const preset = (mode === "light")
        ? (wsTheme.themePresetLight || wsTheme.themePreset || s.themePresetLight || s.themePreset || "aurora")
        : (wsTheme.themePresetDark || wsTheme.themePreset || s.themePresetDark || s.themePreset || "aurora");
      return {
        colorMode: mode,
        themePreset: preset,
        themePresetDark: wsTheme.themePresetDark || wsTheme.themePreset || s.themePresetDark || s.themePreset || "aurora",
        themePresetLight: wsTheme.themePresetLight || wsTheme.themePreset || s.themePresetLight || s.themePreset || "aurora",
        cssVarAccent: wsTheme.cssVarAccent || s.cssVarAccent || "#555B66",
        isWorkspace: true,
        workspaceId: effectiveGroupId,
      };
    }
    const mode = s.colorMode || "dark";
    const preset = (mode === "light")
      ? (s.themePresetLight || s.themePreset || "aurora")
      : (s.themePresetDark || s.themePreset || "aurora");
    return {
      colorMode: mode,
      themePreset: preset,
      themePresetDark: s.themePresetDark || s.themePreset || "aurora",
      themePresetLight: s.themePresetLight || s.themePreset || "aurora",
      cssVarAccent: s.cssVarAccent || "#555B66",
      isWorkspace: false,
      workspaceId: null,
    };
  }

  async setColorMode(mode) {
    const activeGroup = this.getActiveGroup();
    const s = this.state.settings;

    // Instant switch: disable all CSS transitions during attribute change to avoid laggy border→block stagger
    const doInstant = (fn) => {
      document.documentElement.classList.add("no-transitions");
      fn();
      // Force reflow so browser applies new colors before re-enabling transitions
      void document.documentElement.offsetHeight;
      window.getComputedStyle(document.documentElement).opacity;
      requestAnimationFrame(() => {
        setTimeout(() => document.documentElement.classList.remove("no-transitions"), 50);
      });
    };

    try {
      if (activeGroup?.id) {
        const currentThemes = s?.workspaceThemes || {};
        const wsCurrent = currentThemes[activeGroup.id] || {};
        const darkPreset = wsCurrent.themePresetDark || wsCurrent.themePreset || s?.themePresetDark || s?.themePreset || "aurora";
        const lightPreset = wsCurrent.themePresetLight || wsCurrent.themePreset || s?.themePresetLight || s?.themePreset || "aurora";
        const activePreset = mode === "light" ? lightPreset : darkPreset;
        const wsAccent = wsCurrent.cssVarAccent || s?.cssVarAccent || "#555B66";
        const nextThemes = {
          ...currentThemes,
          [activeGroup.id]: {
            ...wsCurrent,
            themePresetDark: darkPreset,
            themePresetLight: lightPreset,
            themePreset: activePreset,
            cssVarAccent: wsAccent,
            colorMode: mode,
          },
        };
        doInstant(() => {
          document.documentElement.setAttribute("data-color-mode", mode);
          document.documentElement.setAttribute("data-theme-preset", activePreset);
          const accentVars = deriveAccentShades(wsAccent, mode);
          for (const [prop, val] of Object.entries(accentVars)) {
            document.documentElement.style.setProperty(prop, val);
          }
        });
        await this.useCases.saveUserSettings.execute({ workspaceThemes: nextThemes });
      } else {
        const darkPreset = s?.themePresetDark || s?.themePreset || "aurora";
        const lightPreset = s?.themePresetLight || s?.themePreset || "aurora";
        const activePreset = mode === "light" ? lightPreset : darkPreset;
        const accent = s?.cssVarAccent || "#555B66";
        doInstant(() => {
          document.documentElement.setAttribute("data-color-mode", mode);
          document.documentElement.setAttribute("data-theme-preset", activePreset);
          const accentVars = deriveAccentShades(accent, mode);
          for (const [prop, val] of Object.entries(accentVars)) {
            document.documentElement.style.setProperty(prop, val);
          }
        });
        await this.useCases.saveUserSettings.execute({
          colorMode: mode,
          themePresetDark: darkPreset,
          themePresetLight: lightPreset,
          themePreset: activePreset,
        });
      }
    } catch (err) {
      this.toast.show(err.message || "Could not save theme", { error: true });
    }
  }

  applyTheme(settings, activeGroupId = undefined) {
    const config = this.getCurrentThemeConfig(settings, activeGroupId);
    if (document.documentElement.getAttribute("data-color-mode") !== config.colorMode) {
      document.documentElement.setAttribute("data-color-mode", config.colorMode);
    }

    if (document.documentElement.getAttribute("data-theme-preset") !== config.themePreset) {
      document.documentElement.setAttribute("data-theme-preset", config.themePreset);
    }

    const accentVars = deriveAccentShades(config.cssVarAccent, config.colorMode);
    for (const [prop, val] of Object.entries(accentVars)) {
      document.documentElement.style.setProperty(prop, val);
    }
  }

  applyCustomCss(css) {
    let styleTag = document.getElementById("neptab-custom-css");
    if (!styleTag) {
      styleTag = el("style", { id: "neptab-custom-css" });
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = sanitizeCss(css || "");
  }

  async triggerAutoBackup() {
    const backupService = this.internals.autoBackupService;
    this._backupService = backupService;
    const run = async () => {
      try {
        const result = await backupService.performBackupIfChanged();
        if (result === 'requires_permission') this.showResumeBackupButton(backupService);
      } catch (err) {
        console.error("Auto backup error:", err);
      }
    };
    await run();
    // 1-minute dirty-checked backup: only writes when storage changed.
    if (this._backupTimer) clearInterval(this._backupTimer);
    this._backupTimer = setInterval(run, 60000);
  }

  showResumeBackupButton(backupService) {
    if (document.getElementById("resume-backup-btn")) return;
    const btn = el("button", { id: "resume-backup-btn", className: "resume-backup-btn" }, "Resume Auto Backup");
    btn.addEventListener("click", async () => {
      const granted = await backupService.requestPermission();
      if (granted) {
        btn.remove();
        await backupService.performBackup();
        this.toast?.show("Auto backup resumed!", { durationMs: 3000 });
      } else {
        this.toast?.show("Failed to resume auto backup.", { error: true });
      }
    });
    document.body.appendChild(btn);
  }

  render() {
    const { settings } = this.state;
    if (!settings) {
      console.warn("Settings not loaded, skipping render");
      return;
    }

    this.applyTheme(settings);
    this.applyCustomCss(settings.customCss);

    const stage = document.getElementById("stage");
    if (!stage) {
      console.error("Stage element not found!");
      return;
    }

    this.views.deck.renderInto(stage);

    // Mount settings sidebar once
    let settingsSidebar = this.views.settings?.root;
    if (!settingsSidebar) {
      settingsSidebar = this.views.settings.render();
    }
    if (!document.body.contains(settingsSidebar)) {
      const existingSidebar = document.querySelector(".settings-sidebar");
      if (existingSidebar) existingSidebar.remove();
      document.body.appendChild(settingsSidebar);
    }
  }

  bindGlobalKeys() {
    if (this._keysBound) return;
    this._keysBound = true;
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        this.views.deck?.focusSearch();
      }
    });
  }

  destroy() {
    this.unsubs.forEach(unsubscribe => {
      try { unsubscribe(); } catch (err) { console.warn("Unsubscribe failed", err); }
    });
    this.unsubs = [];
    if (this._backupTimer) clearInterval(this._backupTimer);
    this.views.deck?.destroy?.();
  }
}

const controller = new NewTabController();
controller.init();
window.__newTab = controller;
