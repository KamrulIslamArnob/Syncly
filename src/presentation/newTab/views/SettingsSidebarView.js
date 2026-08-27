import { el } from "../../shared/dom.js";
import { icon } from "../../shared/icons.js";
import { filterBackupData, validateImportData } from "../../../infrastructure/services/backupAllowlist.js";
import { ConfirmDialogView } from "./ConfirmDialogView.js";
import { deriveAccentShades } from "../../shared/colorUtils.js";
import { sanitizeCss } from "../../../infrastructure/security/cssSanitizer.js";

// SettingsSidebarView — trimmed to what still does something visible in
// the bookmark-manager redesign: Appearance (dark/light), backup/export
// management, and the custom-CSS override. The old dashboard's
// Greeting/Background/Clock/Search/Widgets sections controlled views
// that are no longer mounted (see newTabController.js) — carrying them
// here would just be dead controls that silently do nothing, so they
// were dropped rather than left to confuse users. Their settings fields
// still exist on UserSettings for storage back-compat.
export class SettingsSidebarView {
  constructor({ useCases, events, toast, stateRef, internals, getActiveGroup }) {
    this.useCases = useCases;
    this.events = events;
    this.toast = toast;
    this.stateRef = stateRef;
    this.internals = internals;
    this.getActiveGroup = getActiveGroup;
    this.confirmDialog = new ConfirmDialogView({ toast: this.toast });
    this.draft = null;
    this.root = null;
    this.overlay = null;
    this._escapeListener = null;
    this._tabListener = null;
  }

  ensureDraft() {
    if (this.draft) return this.draft;
    const s = this.stateRef.current.settings || {};
    const activeGroup = this.getActiveGroup?.() || null;
    const wsTheme = (activeGroup?.id && s.workspaceThemes) ? s.workspaceThemes[activeGroup.id] : null;

    const darkPreset = wsTheme?.themePresetDark || wsTheme?.themePreset || s.themePresetDark || s.themePreset || "aurora";
    const lightPreset = wsTheme?.themePresetLight || wsTheme?.themePreset || s.themePresetLight || s.themePreset || "aurora";
    const colorMode = wsTheme?.colorMode ?? s.colorMode ?? "dark";
    const currentPreset = colorMode === "light" ? lightPreset : darkPreset;

    this.draft = {
      name:                s.name ?? "",
      messageText:         s.messageText ?? "Stay focused. Build. Ship. Repeat.",
      clocks:              s.clocks ? s.clocks.map(c => ({ label: c.label || c.city, timeZone: c.timeZone || c.iana })) : [{ label: "London", timeZone: "Europe/London" }],
      themePreset:         currentPreset,
      themePresetDark:     darkPreset,
      themePresetLight:    lightPreset,
      colorMode:           colorMode,
      fontSize:            s.fontSize ?? "default",
      showWebsitePreviews: s.showWebsitePreviews !== false,
      timeFormat24h:        s.timeFormat?.value === "24h" || s.timeFormat === "24h",
      cssVarAccent:        wsTheme?.cssVarAccent ?? s.cssVarAccent ?? "#555B66",
      customCss:           s.customCss ?? "",
      workspaceThemes:     s.workspaceThemes ? { ...s.workspaceThemes } : {},
      moveBookmarksToQuickAccess: !!s.moveBookmarksToQuickAccess,
    };
    return this.draft;
  }

  async save(options = {}) {
    try {
      const activeGroup = this.getActiveGroup?.() || null;
      const s = this.stateRef.current.settings || {};
      let patch = { ...this.draft };

      if (activeGroup?.id) {
        const nextWsThemes = { ...(s.workspaceThemes || {}), ...(this.draft.workspaceThemes || {}) };
        nextWsThemes[activeGroup.id] = {
          themePresetDark: this.draft.themePresetDark,
          themePresetLight: this.draft.themePresetLight,
          themePreset: this.draft.colorMode === "light" ? this.draft.themePresetLight : this.draft.themePresetDark,
          colorMode: this.draft.colorMode,
          cssVarAccent: this.draft.cssVarAccent,
        };
        this.draft.workspaceThemes = nextWsThemes;
        patch.workspaceThemes = nextWsThemes;
      }

      await this.useCases.saveUserSettings.execute(patch);
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.set({ moveBookmarksToQuickAccess: this.draft.moveBookmarksToQuickAccess });
      }
      this.stateRef.current.settings = await this.useCases.getSettings.execute();
      this.events.emit("settings:changed", this.stateRef.current.settings);
      if (options.showToast) this.toast.show("Settings saved ✓");
    } catch (err) {
      this.toast.show(err.message || "Could not save settings", { error: true });
    }
  }

  _createCard({ id, iconName, title, isDanger = false, children = [] }) {
    const card = el("div", { className: `settings-card${isDanger ? " is-danger-card" : ""}` });

    const storageKey = `syncly_settings_collapsed_${id}`;
    let isCollapsed = false;
    try {
      isCollapsed = localStorage.getItem(storageKey) === "true";
    } catch {}
    if (isCollapsed) card.classList.add("is-collapsed");

    const caret = el("span", { className: "settings-card-caret" }, icon("chevronDown"));
    const headerLeft = el("div", { className: "settings-card-header-left" },
      icon(iconName, "settings-card-icon"),
      el("span", {}, title)
    );
    const header = el("div", {
      className: "settings-card-header",
      role: "button",
      tabIndex: 0,
      title: "Click to minimize / expand section",
      "aria-expanded": String(!isCollapsed),
    }, headerLeft, caret);

    header.addEventListener("click", () => {
      const willCollapse = !card.classList.contains("is-collapsed");
      card.classList.toggle("is-collapsed", willCollapse);
      header.setAttribute("aria-expanded", String(!willCollapse));
      try {
        localStorage.setItem(storageKey, String(willCollapse));
      } catch {}
    });

    header.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        header.click();
      }
    });

    const body = el("div", { className: "settings-card-body" }, ...children);
    const collapsible = el("div", { className: "settings-card-collapsible" }, body);

    card.append(header, collapsible);
    return { card, body, header };
  }

  render() {
    if (this.root) return this.root;

    // ── Backdrop Overlay ───────────────────────────────────────
    this.overlay = el("div", { className: "settings-backdrop", "aria-hidden": "true" });
    this.overlay.addEventListener("click", () => this.toggle());

    // ── Sidebar Container (Left slide-in) ──────────────────────
    this.root = el("aside", {
      className: "settings-sidebar",
      role: "dialog",
      "aria-label": "Settings",
    });

    this.rebuild();
    return this.root;
  }

  rebuild() {
    if (!this.root) return;
    this.draft = null;
    this.root.replaceChildren();

    const draft = this.ensureDraft();
    const activeGroup = this.getActiveGroup?.() || null;

    // ── Header ─────────────────────────────────────────────────
    const closeBtn = el("button", {
      type: "button",
      className: "settings-close-btn",
      title: "Close settings (Esc)",
      "aria-label": "Close settings",
    }, icon("x"));
    closeBtn.addEventListener("click", () => this.toggle());

    const header = el("div", { className: "settings-header" },
      el("div", { className: "settings-header-brand" },
        el("img", {
          className: "settings-logo",
          src: "../../../public/icons/logo-transparent-white.svg",
          alt: "Syncly",
          width: "24",
          height: "24"
        }),
        el("div", { className: "settings-header-titles" },
          el("h2", { className: "settings-title" }, "Settings"),
          el("span", { className: "settings-subtitle" }, "Syncly Preferences")
        )
      ),
      closeBtn
    );

    const content = el("div", { className: "settings-content" });

    // ═══════════════════════════════════════════════════════════
    // 1. APPEARANCE CARD
    // ═══════════════════════════════════════════════════════════
    const { card: appearanceCard, body: appearanceBody } = this._createCard({
      id: "appearance",
      iconName: "sparkle",
      title: "Appearance & Theme",
    });

    const scopeBadge = el("div", { className: "settings-theme-scope-badge" },
      icon(activeGroup ? (activeGroup.icon || "folder") : "layers", "scope-badge-icon"),
      el("span", { className: "scope-badge-label" }, activeGroup ? "Theme for workspace: " : "Theme scope: "),
      el("strong", { className: "scope-badge-target" }, activeGroup ? activeGroup.name : "Global Default (All Bookmarks)")
    );

    // Segmented Theme Mode
    const darkBtn = el("button", {
      type: "button",
      className: "settings-theme-pill" + (draft.colorMode === "dark" ? " is-active" : ""),
    }, icon("moon"), el("span", {}, "Dark"));

    const lightBtn = el("button", {
      type: "button",
      className: "settings-theme-pill" + (draft.colorMode === "light" ? " is-active" : ""),
    }, icon("sun"), el("span", {}, "Light"));

    const bgPresetButtons = [];

    const bgPresetHint = el("span", { className: "settings-option-hint" },
      `Canvas style for ${draft.colorMode === "light" ? "Light" : "Dark"} mode`
    );

    const updatePresetCards = () => {
      const activePreset = draft.colorMode === "light" ? draft.themePresetLight : draft.themePresetDark;
      bgPresetButtons.forEach(({ id, card }) => {
        card.classList.toggle("is-active", id === activePreset);
      });
      bgPresetHint.textContent = `Canvas style for ${draft.colorMode === "light" ? "Light" : "Dark"} mode`;
    };

    const switchTheme = (mode) => {
      draft.colorMode = mode;
      const activePreset = mode === "light" ? draft.themePresetLight : draft.themePresetDark;
      draft.themePreset = activePreset;

      if (document.documentElement.getAttribute("data-color-mode") !== mode) {
        document.documentElement.classList.add("no-transitions");
        document.documentElement.setAttribute("data-color-mode", mode);
        document.documentElement.setAttribute("data-theme-preset", activePreset);
        const accentVars = deriveAccentShades(draft.cssVarAccent || "#555B66", mode);
        for (const [prop, val] of Object.entries(accentVars)) {
          document.documentElement.style.setProperty(prop, val);
        }
        void document.documentElement.offsetHeight;
        window.getComputedStyle(document.documentElement).opacity;
        requestAnimationFrame(() => {
          setTimeout(() => document.documentElement.classList.remove("no-transitions"), 50);
        });
      } else {
        document.documentElement.setAttribute("data-theme-preset", activePreset);
      }

      darkBtn.classList.toggle("is-active", mode === "dark");
      lightBtn.classList.toggle("is-active", mode === "light");
      updatePresetCards();
      this.save();
    };

    darkBtn.addEventListener("click", () => switchTheme("dark"));
    lightBtn.addEventListener("click", () => switchTheme("light"));

    const themeSegmented = el("div", { className: "settings-segmented" }, darkBtn, lightBtn);

    // ── Interface Text Size (Font Scale) ──────────────────────
    const FONT_SIZE_PRESETS = [
      { id: "small", label: "Small", hint: "88% Scale" },
      { id: "default", label: "Default", hint: "100% Scale" },
      { id: "large", label: "Large", hint: "114% Scale" },
      { id: "xlarge", label: "Extra Large", hint: "128% Scale" },
    ];

    const currentFontSize = draft.fontSize || "default";
    const fontSizeSegmented = el("div", { className: "settings-font-size-segmented", role: "group", "aria-label": "Interface Text Size" });
    const fontSizeButtons = [];

    const applyFontSizeLive = (sizeId) => {
      draft.fontSize = sizeId;
      document.documentElement.setAttribute("data-font-size", sizeId);
      const fontScales = { small: "0.88", default: "1", large: "1.14", xlarge: "1.28" };
      const scale = fontScales[sizeId] || "1";
      document.documentElement.style.setProperty("--ui-font-scale", scale);
      this.save();
    };

    FONT_SIZE_PRESETS.forEach((preset) => {
      const isSelected = preset.id === currentFontSize;
      const btn = el("button", {
        type: "button",
        className: "settings-font-pill" + (isSelected ? " is-active" : ""),
        title: `${preset.label} (${preset.hint})`,
        "aria-pressed": String(isSelected),
      }, el("span", {}, preset.label));

      btn.addEventListener("click", () => {
        fontSizeButtons.forEach(b => {
          b.classList.remove("is-active");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-pressed", "true");
        applyFontSizeLive(preset.id);
      });

      fontSizeButtons.push(btn);
      fontSizeSegmented.appendChild(btn);
    });

    const fontSizeBlock = el("div", { className: "settings-option-block" },
      el("div", { className: "settings-option-meta" },
        el("span", { className: "settings-option-label" }, "Interface Text Size"),
        el("span", { className: "settings-option-hint" }, "Scale dashboard text, bookmarks, and sidebar")
      ),
      fontSizeSegmented
    );

    // Accent Color Swatches
    const ACCENT_PRESETS = [
      { hex: "#555B66", label: "Dark Grey" },
      { hex: "#D2683F", label: "Terracotta" },
      { hex: "#3B82F6", label: "Nord Blue" },
      { hex: "#10B981", label: "Emerald" },
      { hex: "#8B5CF6", label: "Violet" },
      { hex: "#F59E0B", label: "Amber" },
      { hex: "#EC4899", label: "Rose" },
    ];

    const currentAccent = (draft.cssVarAccent || "#555B66").toUpperCase();
    const isCustomAccent = !ACCENT_PRESETS.some(p => p.hex.toUpperCase() === currentAccent);

    const applyAccentLive = (hex) => {
      draft.cssVarAccent = hex;
      const accentVars = deriveAccentShades(hex, draft.colorMode || "dark");
      for (const [prop, val] of Object.entries(accentVars)) {
        document.documentElement.style.setProperty(prop, val);
      }
      this.save();
    };

    const swatchRow = el("div", { className: "settings-swatch-row" });
    const swatchButtons = [];

    const customColorInput = el("input", {
      type: "color",
      value: draft.cssVarAccent || "#555B66",
      className: "settings-custom-color-input",
    });

    const customSwatch = el("label", {
      className: "settings-swatch-custom" + (isCustomAccent ? " is-active" : ""),
      title: "Custom Accent Color",
    }, customColorInput);

    customColorInput.addEventListener("input", (e) => {
      const hex = e.target.value;
      swatchButtons.forEach(b => b.classList.remove("is-active"));
      customSwatch.classList.add("is-active");
      applyAccentLive(hex);
    });

    ACCENT_PRESETS.forEach((preset) => {
      const isSelected = preset.hex.toUpperCase() === currentAccent;
      const swatch = el("button", {
        type: "button",
        className: "settings-swatch-btn" + (isSelected ? " is-active" : ""),
        title: preset.label,
        style: `background-color: ${preset.hex};`,
      });

      swatch.addEventListener("click", () => {
        swatchButtons.forEach(b => b.classList.remove("is-active"));
        customSwatch.classList.remove("is-active");
        swatch.classList.add("is-active");
        customColorInput.value = preset.hex;
        applyAccentLive(preset.hex);
      });

      swatchButtons.push(swatch);
      swatchRow.appendChild(swatch);
    });
    swatchRow.appendChild(customSwatch);

    const accentBlock = el("div", { className: "settings-option-block" },
      el("div", { className: "settings-option-meta" },
        el("span", { className: "settings-option-label" }, "Accent Color"),
        el("span", { className: "settings-option-hint" }, "Highlights & active states")
      ),
      swatchRow
    );

    // Background Theme Presets
    const BG_THEME_PRESETS = [
      { id: "aurora", label: "Aurora Beams", hint: "Layered atmospheric aura" },
      { id: "retro_grid", label: "Retro Grid", hint: "Matrix blueprint grid pattern" },
      { id: "diamond_storm", label: "Diamond Storm", hint: "Cool diamond lattice aura" },
      { id: "graphite_flow", label: "Graphite Flow", hint: "Soft ambient flux aura" },
      { id: "solid", label: "Minimal Solid", hint: "Clean distraction-free solid" },
    ];

    const currentBgPreset = draft.colorMode === "light" ? draft.themePresetLight : draft.themePresetDark;
    const bgPresetsGrid = el("div", { className: "settings-bg-presets-grid" });

    BG_THEME_PRESETS.forEach((preset) => {
      const isSelected = preset.id === currentBgPreset;
      const card = el("button", {
        type: "button",
        className: "settings-bg-card-btn" + (isSelected ? " is-active" : ""),
        title: preset.label,
      },
        el("span", { className: "settings-bg-card-title" }, preset.label),
        el("span", { className: "settings-bg-card-hint" }, preset.hint)
      );

      card.addEventListener("click", () => {
        if (draft.colorMode === "light") {
          draft.themePresetLight = preset.id;
        } else {
          draft.themePresetDark = preset.id;
        }
        draft.themePreset = preset.id;
        document.documentElement.setAttribute("data-theme-preset", preset.id);
        updatePresetCards();
        this.save();
      });

      bgPresetButtons.push({ id: preset.id, card });
      bgPresetsGrid.appendChild(card);
    });

    const bgPresetBlock = el("div", { className: "settings-option-block" },
      el("div", { className: "settings-option-meta" },
        el("span", { className: "settings-option-label" }, "Background Pattern"),
        bgPresetHint
      ),
      bgPresetsGrid
    );

    // Website Previews Toggle Switch
    const previewCheckbox = el("input", {
      type: "checkbox",
      className: "settings-toggle-input",
      id: "settings-preview-toggle",
      checked: draft.showWebsitePreviews,
    });
    const previewSlider = el("span", { className: "settings-toggle-track" });
    const previewToggle = el("label", { className: "settings-toggle-switch", htmlFor: "settings-preview-toggle" }, previewCheckbox, previewSlider);

    previewCheckbox.addEventListener("change", () => {
      draft.showWebsitePreviews = previewCheckbox.checked;
      this.save();
    });

    const previewRow = el("div", { className: "settings-row-between" },
      el("div", { className: "settings-option-meta" },
        el("span", { className: "settings-option-label" }, "Website Previews"),
        el("span", { className: "settings-option-hint" }, "Show rich screenshot thumbnails in grid cards")
      ),
      previewToggle
    );

    appearanceBody.append(
      scopeBadge,
      themeSegmented,
      fontSizeBlock,
      accentBlock,
      bgPresetBlock,
      previewRow
    );

    // ═══════════════════════════════════════════════════════════
    // 2. FOCUS HERO & GREETING CARD
    // ═══════════════════════════════════════════════════════════
    const { card: focusCard, body: focusBody } = this._createCard({
      id: "focus",
      iconName: "zap",
      title: "Focus Mode & Clock",
    });

    // Name / Greeting text
    const nameInput = el("input", {
      type: "text",
      className: "settings-input",
      value: draft.name || "",
      placeholder: "e.g. Alex (optional)",
      "aria-label": "User Name for Greeting",
    });
    nameInput.addEventListener("input", () => {
      draft.name = nameInput.value;
      this.save();
    });

    const nameBlock = el("div", { className: "settings-option-block" },
      el("div", { className: "settings-option-meta" },
        el("span", { className: "settings-option-label" }, "Greeting Name"),
        el("span", { className: "settings-option-hint" }, "Shown after Good Morning / Afternoon")
      ),
      nameInput
    );

    // Custom Tagline / Subtitle
    const taglineInput = el("input", {
      type: "text",
      className: "settings-input",
      value: draft.messageText || "",
      placeholder: "e.g. FOCUS. BUILD. SHIP.",
      "aria-label": "Custom Tagline Subtitle",
    });
    taglineInput.addEventListener("input", () => {
      draft.messageText = taglineInput.value;
      this.save();
    });

    const taglineBlock = el("div", { className: "settings-option-block" },
      el("div", { className: "settings-option-meta" },
        el("span", { className: "settings-option-label" }, "Tagline Subtitle"),
        el("span", { className: "settings-option-hint" }, "Custom motivational text under the greeting")
      ),
      taglineInput
    );

    // Secondary Clocks Timeline
    const timelineLabel = el("div", { className: "settings-option-meta" },
      el("span", { className: "settings-option-label" }, "Secondary Clock Timeline"),
      el("span", { className: "settings-option-hint" }, "Timeline clock displayed below the main digits")
    );

    const IANA_ZONES = [
      { city: "London",        iana: "Europe/London" },
      { city: "New York",      iana: "America/New_York" },
      { city: "San Francisco", iana: "America/Los_Angeles" },
      { city: "Tokyo",         iana: "Asia/Tokyo" },
      { city: "Singapore",     iana: "Asia/Singapore" },
      { city: "Sydney",        iana: "Australia/Sydney" },
      { city: "Paris",         iana: "Europe/Paris" },
      { city: "Dubai",         iana: "Asia/Dubai" },
      { city: "Dhaka",         iana: "Asia/Dhaka" },
      { city: "UTC",           iana: "UTC" },
    ];

    const timelineSelect = el("select", { className: "settings-select", "aria-label": "Secondary Clock Timeline TimeZone" });
    const currentZone = draft.clocks?.[0]?.timeZone || "Europe/London";

    IANA_ZONES.forEach(z => {
      const opt = el("option", { value: z.iana }, `${z.city} (${z.iana})`);
      if (z.iana === currentZone) opt.selected = true;
      timelineSelect.appendChild(opt);
    });

    timelineSelect.addEventListener("change", () => {
      const chosen = IANA_ZONES.find(z => z.iana === timelineSelect.value) || { city: "London", iana: "Europe/London" };
      draft.clocks = [{ label: chosen.city, timeZone: chosen.iana }];
      this.save();
    });

    const timelineBlock = el("div", { className: "settings-option-block" },
      timelineLabel,
      timelineSelect
    );

    // Clock Format (12h shows AM/PM, 24h hides it)
    const fmt12Btn = el("button", {
      type: "button",
      className: "settings-theme-pill" + (!draft.timeFormat24h ? " is-active" : ""),
    }, "12h · AM/PM");
    const fmt24Btn = el("button", {
      type: "button",
      className: "settings-theme-pill" + (draft.timeFormat24h ? " is-active" : ""),
    }, "24h");

    const switchClockFormat = (h24) => {
      draft.timeFormat24h = h24;
      fmt12Btn.classList.toggle("is-active", !h24);
      fmt24Btn.classList.toggle("is-active", h24);
      this.save();
    };
    fmt12Btn.addEventListener("click", () => switchClockFormat(false));
    fmt24Btn.addEventListener("click", () => switchClockFormat(true));

    const clockFormatBlock = el("div", { className: "settings-option-block" },
      el("div", { className: "settings-option-meta" },
        el("span", { className: "settings-option-label" }, "Clock Format"),
        el("span", { className: "settings-option-hint" }, "AM/PM badge next to the digits")
      ),
      el("div", { className: "settings-segmented" }, fmt12Btn, fmt24Btn)
    );

    focusBody.append(
      nameBlock,
      taglineBlock,
      timelineBlock,
      clockFormatBlock
    );

    // ═══════════════════════════════════════════════════════════
    // 2b. SHORTCUTS & BOOKMARK BAR CARD
    // ═══════════════════════════════════════════════════════════
    const { card: shortcutsCard, body: shortcutsBody } = this._createCard({
      id: "shortcuts",
      iconName: "grid",
      title: "Shortcuts & Bookmarks",
    });

    const moveBookmarksCheckbox = el("input", {
      type: "checkbox",
      className: "settings-toggle-input",
      id: "settings-move-bookmarks-toggle",
      checked: !!draft.moveBookmarksToQuickAccess,
    });
    const moveBookmarksSlider = el("span", { className: "settings-toggle-track" });
    const moveBookmarksToggle = el("label", { className: "settings-toggle-switch", htmlFor: "settings-move-bookmarks-toggle" }, moveBookmarksCheckbox, moveBookmarksSlider);

    moveBookmarksCheckbox.addEventListener("change", async () => {
      draft.moveBookmarksToQuickAccess = moveBookmarksCheckbox.checked;
      await this.save();
      if (draft.moveBookmarksToQuickAccess) {
        try {
          if (this.useCases?.migrateBookmarkBarToQuickAccess) {
            const res = await this.useCases.migrateBookmarkBarToQuickAccess.execute();
            if (res.success && res.count > 0) {
              this.toast.show(`Transferred ${res.count} bookmark bar link(s) to Quick Access ✓`);
            } else if (res.success) {
              this.toast.show("Quick Access category ready ✓");
            }
          }
          this.events.emit("bookmarks:changed");
        } catch (err) {
          this.toast.show(err.message || "Failed to transfer bookmarks", { error: true });
        }
      }
    });

    const moveBookmarksRow = el("div", { className: "settings-row-between" },
      el("div", { className: "settings-option-meta" },
        el("span", { className: "settings-option-label" }, "Move Bookmark Bar links to Quick Access Shortcuts"),
        el("span", { className: "settings-option-hint" }, "Automatically transfer direct bookmark bar links to the default Quick Access shortcut category.")
      ),
      moveBookmarksToggle
    );

    shortcutsBody.append(moveBookmarksRow);

    // ═══════════════════════════════════════════════════════════
    // 3. BACKUP & RESTORE CARD
    // ═══════════════════════════════════════════════════════════
    const { card: backupCard, body: backupBody } = this._createCard({
      id: "backup",
      iconName: "download",
      title: "Backup & Restore",
    });

    const exportBtn = el("button", {
      type: "button",
      className: "settings-btn settings-btn-secondary",
    }, icon("download"), el("span", {}, "Export JSON"));
    exportBtn.addEventListener("click", () => this.exportBackup());

    const importInput = el("input", {
      type: "file",
      accept: ".json,application/json",
      className: "settings-hidden-input",
      id: "settings-import-file",
      style: "display: none;",
    });
    importInput.addEventListener("change", (e) => this.handleFileImport(e));

    const importBtn = el("label", {
      className: "settings-btn settings-btn-secondary",
      htmlFor: "settings-import-file",
    }, icon("upload"), el("span", {}, "Import JSON"));

    const backupBtnRow = el("div", { className: "settings-btn-row" }, exportBtn, importBtn, importInput);

    const backupRow = el("div", { className: "settings-option-block" },
      el("div", { className: "settings-option-meta" },
        el("span", { className: "settings-option-label" }, "Manual Snapshot"),
        el("span", { className: "settings-option-hint" }, "Export or restore all extension configuration")
      ),
      backupBtnRow
    );

    // Auto-Backup Directory Configuration
    const autoBackupService = this.internals?.autoBackupService;
    let autoBackupStatus = el("span", { className: "settings-option-hint" }, "Status: Not configured");
    const autoBackupBtn = el("button", {
      type: "button",
      className: "settings-btn settings-btn-secondary",
    }, icon("folder"), el("span", {}, "Choose Backup File..."));

    const updateAutoBackupStatus = async () => {
      if (!autoBackupService) return;
      const status = await autoBackupService.getStatus();
      if (status.enabled && status.hasPermission) {
        autoBackupStatus.textContent = `Syncing to: ${status.fileName || "Syncly-backup.json"}`;
        autoBackupStatus.style.color = "var(--success)";
      } else if (status.enabled && !status.hasPermission) {
        autoBackupStatus.textContent = "Permission required — click to grant";
        autoBackupStatus.style.color = "var(--warn)";
      } else {
        autoBackupStatus.textContent = "Status: Disabled (Local only)";
        autoBackupStatus.style.color = "var(--muted)";
      }
    };
    updateAutoBackupStatus();

    autoBackupBtn.addEventListener("click", async () => {
      if (!autoBackupService) return;
      try {
        const ok = await autoBackupService.setup();
        if (ok) {
          this.toast.show("Auto-backup location configured ✓");
          updateAutoBackupStatus();
        }
      } catch (err) {
        this.toast.show(err.message || "Could not setup backup file", { error: true });
      }
    });

    const autoBackupRow = el("div", { className: "settings-row-between" },
      el("div", { className: "settings-option-meta" },
        el("span", { className: "settings-option-label" }, "File System Auto-Sync"),
        autoBackupStatus
      ),
      autoBackupBtn
    );

    backupBody.append(backupRow, autoBackupRow);

    // ═══════════════════════════════════════════════════════════
    // 3b. GITHUB GIST SYNC CARD
    // ═══════════════════════════════════════════════════════════
    const githubService = this.internals?.githubBackupService;
    const { card: githubCard, body: githubBody } = this._createCard({
      id: "github",
      iconName: "github",
      title: "GitHub Gist Sync",
    });
    const githubHint = el("span", { className: "settings-option-hint" },
      "Sync and continuously update a backup JSON file in your private GitHub Gist (encrypted PAT at rest)."
    );

    // 1. Personal Access Token
    const patInput = el("input", {
      type: "password",
      className: "settings-input",
      placeholder: "ghp_... or github_pat_... (needs gist scope)",
      autocomplete: "off",
      spellcheck: "false",
    });
    const patStatus = el("span", { className: "settings-option-hint" }, "Checking...");
    const patSaveBtn = el("button", { type: "button", className: "settings-btn settings-btn-primary" }, icon("check"), el("span", {}, "Save Token"));
    const patClearBtn = el("button", { type: "button", className: "settings-btn settings-btn-secondary" }, icon("trash"), el("span", {}, "Clear All"));
    const patRow = el("div", { className: "settings-option-block" },
      el("div", { className: "settings-option-meta" },
        el("span", { className: "settings-option-label" }, "Personal Access Token"),
        patStatus
      ),
      patInput,
      el("div", { className: "settings-btn-row", style: "margin-top:8px;" }, patSaveBtn, patClearBtn)
    );

    // 2. Target Gist ID & Target Filename
    const gistIdInput = el("input", {
      type: "text",
      className: "settings-input",
      placeholder: "Gist ID or URL (e.g. 6c85e263... / optional)",
      autocomplete: "off",
      spellcheck: "false",
    });
    const gistIdStatus = el("span", { className: "settings-option-hint" }, "Checking...");
    const gistLinkBtn = el("button", { type: "button", className: "settings-btn settings-btn-secondary" }, icon("check"), el("span", {}, "Link Gist ID"));
    const gistOpenLink = el("a", {
      className: "settings-btn settings-btn-secondary",
      target: "_blank",
      rel: "noopener noreferrer",
      style: "display: none; text-decoration: none;",
      title: "View Gist on GitHub",
    }, icon("external"), el("span", {}, "View Gist"));

    const filenameInput = el("input", {
      type: "text",
      className: "settings-input",
      placeholder: "Syncly-backup.json",
      value: "Syncly-backup.json",
      autocomplete: "off",
      spellcheck: "false",
    });
    const filenameSaveBtn = el("button", { type: "button", className: "settings-btn settings-btn-secondary" }, icon("check"), el("span", {}, "Save Name"));

    const configRow = el("div", { className: "settings-option-block" },
      el("div", { className: "settings-option-meta" },
        el("span", { className: "settings-option-label" }, "Target Gist ID"),
        gistIdStatus
      ),
      gistIdInput,
      el("div", { className: "settings-btn-row", style: "margin-top:8px;" }, gistLinkBtn, gistOpenLink),
      el("div", { className: "settings-option-meta", style: "margin-top:12px;" },
        el("span", { className: "settings-option-label" }, "Backup File Name"),
        el("span", { className: "settings-option-hint" }, "File continuously updated inside the Gist")
      ),
      filenameInput,
      el("div", { className: "settings-btn-row", style: "margin-top:8px;" }, filenameSaveBtn)
    );

    // 3. Gist Operations
    const gistPushBtn = el("button", { type: "button", className: "settings-btn settings-btn-primary" }, icon("upload"), el("span", {}, "Push / Update Gist"));
    const gistPullBtn = el("button", { type: "button", className: "settings-btn settings-btn-secondary" }, icon("download"), el("span", {}, "Pull from Gist"));
    const gistBtnRow = el("div", { className: "settings-btn-row" }, gistPushBtn, gistPullBtn);
    const gistRow = el("div", { className: "settings-option-block" },
      el("div", { className: "settings-option-meta" },
        el("span", { className: "settings-option-label" }, "Gist Operations"),
        el("span", { className: "settings-option-hint" }, "Push will update the specified file in your linked Gist. Pull merges it.")
      ),
      gistBtnRow
    );
    githubBody.append(githubHint, patRow, configRow, gistRow);

    const refreshGithubStatus = async () => {
      if (!githubService) { patStatus.textContent = "Unavailable"; return; }
      try {
        const ok = await githubService.isConfigured();
        patStatus.textContent = ok ? "Token saved (encrypted) ✓" : "Not configured";
        patStatus.style.color = ok ? "var(--success)" : "var(--muted)";
        gistPushBtn.disabled = !ok;
        gistPullBtn.disabled = !ok;
        patInput.placeholder = ok ? "•••••••• (saved)" : "ghp_... or github_pat_... (needs gist scope)";

        const currentGistId = await githubService.getGistId();
        const currentFilename = await githubService.getFilename();
        if (currentFilename) {
          filenameInput.value = currentFilename;
        }

        if (currentGistId) {
          gistIdStatus.textContent = `Linked: ${currentGistId.slice(0, 8)}… ✓`;
          gistIdStatus.style.color = "var(--success)";
          gistIdInput.value = currentGistId;
          gistOpenLink.href = `https://gist.github.com/${currentGistId}`;
          gistOpenLink.style.display = "inline-flex";
        } else {
          gistIdStatus.textContent = "Auto-creates and links on first push";
          gistIdStatus.style.color = "var(--muted)";
          gistOpenLink.style.display = "none";
        }
      } catch { patStatus.textContent = "Error"; }
    };
    refreshGithubStatus();

    patSaveBtn.addEventListener("click", async () => {
      const token = patInput.value.trim();
      if (!token) { this.toast.show("Enter a token", { error: true }); return; }
      patSaveBtn.disabled = true;
      try {
        await githubService.setup({ token });
        patInput.value = "";
        this.toast.show("GitHub token saved (encrypted) ✓");
        await refreshGithubStatus();
      } catch (err) {
        this.toast.show(err.message || "Could not save token", { error: true });
      } finally { patSaveBtn.disabled = false; }
    });

    patClearBtn.addEventListener("click", async () => {
      this.confirmDialog.open({
        title: "Clear GitHub Sync",
        message: "Remove stored PAT, Gist ID, and settings? Existing Gists on GitHub will remain untouched.",
        confirmLabel: "Clear All",
        isDanger: true,
        onConfirm: async () => {
          await githubService.clearSetup();
          patInput.value = "";
          gistIdInput.value = "";
          filenameInput.value = "Syncly-backup.json";
          this.toast.show("GitHub sync settings cleared");
          await refreshGithubStatus();
        },
      });
    });

    gistLinkBtn.addEventListener("click", async () => {
      const raw = gistIdInput.value.trim();
      gistLinkBtn.disabled = true;
      try {
        const id = await githubService.setGistId(raw);
        if (id) {
          this.toast.show(`Linked to Gist ${id.slice(0, 8)}… ✓`);
        } else {
          this.toast.show("Unlinked Gist ID (will auto-create on next push)");
        }
        await refreshGithubStatus();
      } catch (err) {
        this.toast.show(err.message || "Invalid Gist ID or URL", { error: true });
      } finally {
        gistLinkBtn.disabled = false;
      }
    });

    filenameSaveBtn.addEventListener("click", async () => {
      const raw = filenameInput.value.trim();
      filenameSaveBtn.disabled = true;
      try {
        const saved = await githubService.setFilename(raw);
        filenameInput.value = saved;
        this.toast.show(`Target file set to ${saved} ✓`);
        await refreshGithubStatus();
      } catch (err) {
        this.toast.show(err.message || "Invalid filename", { error: true });
      } finally {
        filenameSaveBtn.disabled = false;
      }
    });

    gistPushBtn.addEventListener("click", async () => {
      gistPushBtn.disabled = true;
      try {
        const targetFilename = filenameInput.value.trim() || undefined;
        const res = await this.useCases.pushBackupToGitHub.execute({
          filename: targetFilename,
          description: "Syncly backup",
        });
        const currentFile = await githubService.getFilename();
        this.toast.show(`Updated ${currentFile} in Gist ${res.gistId.slice(0, 8)}… ✓`);
      } catch (err) {
        this.toast.show(err.message || "Push failed", { error: true });
      } finally { gistPushBtn.disabled = false; await refreshGithubStatus(); }
    });

    gistPullBtn.addEventListener("click", async () => {
      gistPullBtn.disabled = true;
      try {
        const targetFilename = filenameInput.value.trim() || undefined;
        const content = await githubService.pullBackup({ filename: targetFilename });
        const raw = JSON.parse(content);
        const validated = validateImportData(raw);
        if (!validated.ok) throw new Error(validated.error);
        const currentFile = await githubService.getFilename();
        this.confirmDialog.open({
          title: "Apply Gist Backup",
          message: `Pull will merge ${Object.keys(validated.data).length} keys from "${currentFile}" in Gist. Continue?`,
          confirmLabel: "Pull & Merge",
          onConfirm: async () => {
            await chrome.storage.local.set(validated.data);
            this.toast.show("Gist restored! Reloading...");
            setTimeout(() => location.reload(), 800);
          },
        });
      } catch (err) {
        this.toast.show(err.message || "Pull failed", { error: true });
      } finally { gistPullBtn.disabled = false; }
    });

    // ═══════════════════════════════════════════════════════════
    // 3c. GOOGLE CLOUD SYNC CARD (chrome.storage.sync)
    // ═══════════════════════════════════════════════════════════
    const googleService = this.internals?.googleSyncService;
    const { card: googleCard, body: googleBody } = this._createCard({
      id: "google",
      iconName: "cloud",
      title: "Google Cloud Sync",
    });
    const googleHint = el("span", { className: "settings-option-hint" },
      "Uses chrome.storage.sync (same Google account). Mirrors categories, bookmarks, settings, workspaces, collections, tags. Auto-sync on every local save."
    );
    const googleStatus = el("span", { className: "settings-option-hint" }, "Checking...");
    const googlePushBtn = el("button", { type: "button", className: "settings-btn settings-btn-secondary" }, icon("upload"), el("span", {}, "Push Local → Cloud"));
    const googlePullBtn = el("button", { type: "button", className: "settings-btn settings-btn-secondary" }, icon("download"), el("span", {}, "Pull Cloud → Local"));
    const googleSyncBtn = el("button", { type: "button", className: "settings-btn settings-btn-primary" }, icon("refresh"), el("span", {}, "Sync Now"));
    const googleBtnRow = el("div", { className: "settings-btn-row" }, googlePushBtn, googlePullBtn, googleSyncBtn);
    const googleBlock = el("div", { className: "settings-option-block" },
      el("div", { className: "settings-option-meta" },
        el("span", { className: "settings-option-label" }, "Manual Sync"),
        googleStatus
      ),
      googleBtnRow
    );
    googleBody.append(googleHint, googleBlock);

    const refreshGoogleStatus = async () => {
      if (!googleService) { googleStatus.textContent = "Unavailable"; return; }
      const available = googleService.isAvailable();
      googleStatus.textContent = available ? "Sync available (same Google account) ✓" : "Not available - sign in to Chrome";
      googleStatus.style.color = available ? "var(--success)" : "var(--warn)";
      googlePushBtn.disabled = !available;
      googlePullBtn.disabled = !available;
      googleSyncBtn.disabled = !available;
    };
    refreshGoogleStatus();

    googlePushBtn.addEventListener("click", async () => {
      googlePushBtn.disabled = true;
      try {
        const res = await googleService.pushAll();
        if (res.success) this.toast.show(`Pushed ${res.count} keys to cloud ✓`);
        else throw new Error(res.error || res.reason);
      } catch (err) {
        this.toast.show(err.message || "Push failed", { error: true });
      } finally { googlePushBtn.disabled = false; }
    });
    googlePullBtn.addEventListener("click", async () => {
      googlePullBtn.disabled = true;
      try {
        const res = await this.useCases.syncFromGoogleCloud.execute();
        if (res.count > 0) {
          this.toast.show(`Pulled ${res.count} keys from cloud ✓ - reloading`);
          setTimeout(() => location.reload(), 600);
        } else {
          this.toast.show("No new changes in Google Cloud to pull");
        }
      } catch (err) {
        this.toast.show(err.message || "Pull failed", { error: true });
      } finally { googlePullBtn.disabled = false; }
    });
    googleSyncBtn.addEventListener("click", async () => {
      googleSyncBtn.disabled = true;
      try {
        const pushRes = await googleService.pushAll();
        const pullRes = await this.useCases.syncFromGoogleCloud.execute().catch(() => ({ count: 0 }));
        this.toast.show(`Sync done: pushed ${pushRes.count||0}, pulled ${pullRes.count||0} ✓`);
        if (pullRes.count > 0) setTimeout(() => location.reload(), 600);
      } catch (err) {
        this.toast.show(err.message || "Sync failed", { error: true });
      } finally { googleSyncBtn.disabled = false; }
    });

    // ═══════════════════════════════════════════════════════════
    // 4. CUSTOM CSS CARD
    // ═══════════════════════════════════════════════════════════
    const { card: cssCard, body: cssBody } = this._createCard({
      id: "css",
      iconName: "code",
      title: "Custom CSS Override",
    });

    const cssArea = el("textarea", {
      className: "settings-css-editor",
      placeholder: "/* Add custom CSS rules here. Example: */\n:root { --font-body: 'Inter', sans-serif; }",
      "aria-label": "Custom CSS Editor",
      spellcheck: "false",
    });
    cssArea.value = draft.customCss || "";
    let cssDebounce = null;
    cssArea.addEventListener("input", () => {
      const sanitized = sanitizeCss(cssArea.value);
      draft.customCss = sanitized;
      const styleTag = document.getElementById("syncly-custom-css") || document.getElementById("neptab-custom-css");
      if (styleTag) styleTag.textContent = sanitized;
      clearTimeout(cssDebounce);
      cssDebounce = setTimeout(() => this.save(), 500);
    });

    const cssSaveBtn = el("button", {
      type: "button",
      className: "settings-btn settings-btn-primary",
    }, icon("check"), el("span", {}, "Save CSS"));
    cssSaveBtn.addEventListener("click", () => this.save({ showToast: true }));

    const cssClearBtn = el("button", {
      type: "button",
      className: "settings-btn settings-btn-secondary",
    }, icon("trash"), el("span", {}, "Clear"));
    cssClearBtn.addEventListener("click", () => {
      cssArea.value = "";
      draft.customCss = "";
      const styleTag = document.getElementById("syncly-custom-css") || document.getElementById("neptab-custom-css");
      if (styleTag) styleTag.textContent = "";
      this.save({ showToast: true });
    });

    cssArea.addEventListener("paste", () => {
      setTimeout(() => {
        const sanitizedPaste = sanitizeCss(cssArea.value);
        if (sanitizedPaste !== cssArea.value) {
          cssArea.value = sanitizedPaste;
          draft.customCss = sanitizedPaste;
          const styleTag = document.getElementById("syncly-custom-css") || document.getElementById("neptab-custom-css");
          if (styleTag) styleTag.textContent = sanitizedPaste;
        }
      }, 0);
    });

    const cssToolbar = el("div", { className: "settings-btn-row" }, cssSaveBtn, cssClearBtn);

    cssBody.append(
      cssArea,
      cssToolbar
    );

    // ═══════════════════════════════════════════════════════════
    // 5. EXTENSION RELOAD (DEVELOPER MODE)
    // ═══════════════════════════════════════════════════════════
    const { card: updatesCard, body: updatesBody } = this._createCard({
      id: "updates",
      iconName: "refresh",
      title: "Extension Reload",
    });

    const updatesHint = el("span", { className: "settings-option-hint" },
      "Reload the unpacked extension directly from disk after making code changes or running git pull."
    );

    const reloadBtn = el("button", {
      type: "button",
      className: "settings-btn settings-btn-primary",
      title: "Reload extension directly from disk (chrome.runtime.reload)",
    },
      icon("refresh", "settings-btn-icon"),
      el("span", {}, "1-Click Reload Extension")
    );

    const reloadStatus = el("span", { className: "settings-option-hint" }, "Unpacked Dev Mode");

    reloadBtn.addEventListener("click", () => {
      reloadStatus.textContent = "Reloading extension...";
      reloadStatus.style.color = "var(--accent)";
      setTimeout(() => {
        if (typeof chrome !== "undefined" && chrome.runtime?.reload) {
          chrome.runtime.reload();
        } else {
          location.reload();
        }
      }, 150);
    });

    const reloadRow = el("div", { className: "settings-row-between" },
      el("div", { className: "settings-option-meta" },
        el("span", { className: "settings-option-label" }, "Reload from Disk"),
        reloadStatus
      ),
      reloadBtn
    );

    updatesBody.append(updatesHint, reloadRow);

    // ═══════════════════════════════════════════════════════════
    // 6. RESET & DANGER ZONE
    // ═══════════════════════════════════════════════════════════
    const { card: dangerCard, body: dangerBody } = this._createCard({
      id: "danger",
      iconName: "trash",
      title: "Danger Zone",
      isDanger: true,
    });

    const resetBtn = el("button", {
      type: "button",
      className: "settings-btn settings-btn-danger",
    },
      icon("trash", "settings-btn-icon"),
      el("span", {}, "Reset Everything")
    );
    resetBtn.addEventListener("click", () => {
      this.confirmDialog.open({
        title: "Reset All Extension Data",
        message: "Reset all extension settings, tags, and collections? This cannot be undone.",
        confirmLabel: "Reset Everything",
        isDanger: true,
        onConfirm: async () => {
          await chrome.storage.local.clear();
          location.reload();
        },
      });
    });

    const dangerRow = el("div", { className: "settings-row-between" },
      el("div", { className: "settings-option-meta" },
        el("span", { className: "settings-option-label" }, "Reset All Data"),
        el("span", { className: "settings-option-hint" }, "Wipe custom settings & collections")
      ),
      resetBtn
    );

    dangerBody.append(dangerRow);

    // ── Footer ─────────────────────────────────────────────────
    const footer = el("div", { className: "settings-footer" },
      el("span", {}, "Syncly • Privacy Focused • Local Storage Only")
    );

    content.append(
      appearanceCard,
      focusCard,
      shortcutsCard,
      backupCard,
      githubCard,
      googleCard,
      cssCard,
      updatesCard,
      dangerCard,
      footer
    );

    this.root.append(header, content);
    return this.root;
  }

  toggle(toggleBtn = null) {
    if (!this.root) {
      this.render();
    } else if (!this.root.classList.contains("open")) {
      this.rebuild();
    }

    // Ensure backdrop overlay is in DOM
    if (this.overlay && !document.body.contains(this.overlay)) {
      document.body.appendChild(this.overlay);
    }

    const isOpen = this.root.classList.toggle("open");
    if (this.overlay) this.overlay.classList.toggle("open", isOpen);

    if (toggleBtn) toggleBtn.setAttribute("aria-expanded", isOpen);
    const mainContent = document.getElementById("stage");
    if (mainContent) mainContent.setAttribute("aria-hidden", isOpen);

    if (isOpen) {
      const focusable = this.root.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
      if (focusable.length) setTimeout(() => focusable[0].focus(), 150);

      this._escapeListener = (e) => {
        if (e.key === "Escape") {
          this.toggle(toggleBtn);
          if (toggleBtn) toggleBtn.focus();
        }
      };
      document.addEventListener("keydown", this._escapeListener);

      this._tabListener = (e) => {
        if (e.key !== "Tab") return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      };
      this.root.addEventListener("keydown", this._tabListener);
    } else {
      if (this._escapeListener) document.removeEventListener("keydown", this._escapeListener);
      if (this._tabListener) this.root.removeEventListener("keydown", this._tabListener);
      this._escapeListener = null;
      this._tabListener = null;
    }
  }

  async exportBackup() {
    try {
      const allData = await chrome.storage.local.get(null);
      const cleanData = filterBackupData(allData);
      const blob = new Blob([JSON.stringify(cleanData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `syncly-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.toast.show("Backup snapshot exported ✓");
    } catch (err) {
      this.toast.show(err.message || "Export failed", { error: true });
    }
  }

  async handleFileImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const validated = validateImportData(raw);

      if (!validated.ok) {
        throw new Error(validated.error || "Invalid or empty backup file format");
      }

      this.confirmDialog.open({
        title: "Restore Backup Snapshot",
        message: `Restoring will merge ${Object.keys(validated.data).length} keys. Continue?`,
        confirmLabel: "Restore Snapshot",
        onConfirm: async () => {
          await chrome.storage.local.set(validated.data);
          this.toast.show("Snapshot restored! Reloading dashboard...");
          setTimeout(() => location.reload(), 800);
        },
      });
    } catch (err) {
      this.toast.show(err.message || "Could not read backup file", { error: true });
    } finally {
      event.target.value = "";
    }
  }
}
