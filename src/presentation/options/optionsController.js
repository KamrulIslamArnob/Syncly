import { buildContainer } from "../../infrastructure/di/container.js";
import { BackgroundKind } from "../../domain/valueObjects/BackgroundConfig.js";
import { el } from "../shared/dom.js";
import { initial, websiteFaviconUrl, defaultFavicon } from "../shared/favicon.js";
import { BackgroundView } from "../newTab/views/BackgroundView.js";
import {
  WORLD_CLOCK_PRESETS,
  CUSTOM_TIMEZONE_VALUE,
} from "../../domain/valueObjects/WorldClockPresets.js";

/**
 * Options page controller. Wires each form/section to the
 * corresponding use case. Subscribes to `*:changed` events so the
 * page stays in sync if another tab updates storage.
 */
class OptionsController {
  constructor() {
    this.toastEl = document.getElementById("toast");
    this.container = null;
    this.useCases = null;
    this.events = null;
    this.unsubs = [];
    this.state = { settings: null, categories: [], bookmarks: [], layout: [] };
    this.draft = null;
    this.backgroundView = null;
  }

  async init() {
    try {
      this.container = buildContainer();
      this.useCases = this.container.useCases;
      this.events = this.container.events;
    } catch (err) {
      this.show("Failed to start: " + (err?.message || err), { error: true });
      return;
    }

    const [settings, categories, bookmarks, layout] = await Promise.all([
      this.useCases.getSettings.execute(),
      this.useCases.listCategories.execute(),
      this.useCases.listBookmarks.execute(),
      this.useCases.getLayout.execute(),
    ]);
    this.state.settings = settings;
    this.state.categories = categories;
    this.state.bookmarks = bookmarks;
    this.state.layout = layout;

    this.backgroundView = new BackgroundView({
      settings: null,
      sanitizer: this.container.internals.sanitizer,
    });

    this.initDraft();

    this.wireIdentity();
    this.wireBackground();
    this.wireAppearance();
    this.wireWidgets();
    this.wireClocks();
    this.wireCategories();
    this.wireBookmarks();
    this.wireSaveButton();
    this.subscribe();
    this.renderAll();
  }

  initDraft() {
    const s = this.state.settings;
    this.draft = {
      name: s.userName || s.name || "",
      timeFormat24h:
        s.timeFormat?.value === "24h" || s.timeFormat?.h24 === true,
      backgroundBlur: s.backgroundBlur,
      backgroundOverlay: s.backgroundOverlay,
      backgroundTintColor: s.backgroundTintColor || "#000000",
      buttonRoundness: s.buttonRoundness,
      backgroundKind: s.background.kind,
      backgroundValue: s.background.value,
      themePreset: s.themePreset || "minimal",
      searchEnabled: s.searchEnabled !== false,
      searchEngine: s.searchEngine || "google",
      weatherEnabled: !!s.weatherEnabled,
      weatherLocation: s.weatherLocation || "",
      weatherUnit: s.weatherUnit || "c",
      clocks: (s.clocks || []).map((c) => ({
        label: c.label,
        timeZone: c.timeZone,
      })),
    };
  }

  applyLivePreview() {
    if (!this.draft) return;
    const tempSettings = {
      background: {
        kind: this.draft.backgroundKind,
        value: this.draft.backgroundValue,
      },
      backgroundBlur: this.draft.backgroundBlur,
      backgroundOverlay: this.draft.backgroundOverlay,
      backgroundTintColor: this.draft.backgroundTintColor,
      buttonRoundness: this.draft.buttonRoundness,
      themePreset: this.draft.themePreset,
    };
    if (this.backgroundView) {
      this.backgroundView.update(tempSettings);
    }
  }

  // ----- subscriptions -----
  subscribe() {
    this.unsubs.push(
      this.events.on("settings:changed", async () => {
        this.state.settings = await this.useCases.getSettings.execute();
        this.initDraft();
        this.renderIdentity();
        this.renderBackground();
        this.renderAppearance();
        this.renderClocks();
        this.applyLivePreview();
      }),
    );
    this.unsubs.push(
      this.events.on("categories:changed", async () => {
        this.state.categories = await this.useCases.listCategories.execute();
        this.renderCategories();
        this.renderBookmarks();
      }),
    );
    this.unsubs.push(
      this.events.on("bookmarks:changed", async () => {
        this.state.bookmarks = await this.useCases.listBookmarks.execute();
        this.renderBookmarks();
      }),
    );
    this.unsubs.push(
      this.events.on("layout:changed", async () => {
        this.state.layout = await this.useCases.getLayout.execute();
        this.renderWidgets();
      }),
    );
  }

  // ----- identity -----
  wireIdentity() {
    const input = document.getElementById("opt-name");
    input.addEventListener("input", () => {
      this.draft.name = input.value;
    });
  }
  renderIdentity() {
    document.getElementById("opt-name").value = this.draft.name || "";
  }

  // ----- background -----
  wireBackground() {
    const select = document.getElementById("opt-bg-kind");
    const valInput = document.getElementById("opt-bg-value");
    const valGroup = document.getElementById("opt-bg-value-group");
    const fileGroup = document.getElementById("opt-bg-file-group");
    const fileInput = document.getElementById("opt-bg-file");
    const previewArea = document.getElementById("opt-bg-file-preview-area");
    const previewThumb = document.getElementById("opt-bg-file-preview");
    const clearBtn = document.getElementById("opt-bg-file-clear");

    const syncSubInputs = () => {
      const kind = select.value;
      fileGroup.style.display = kind === "uploaded" ? "block" : "none";
      valGroup.style.display =
        kind === "url" || kind === "solid" || kind === "gradient"
          ? "block"
          : "none";

      if (kind === "default") {
        // No bundled wallpaper ships with the extension — the default is the
        // OLED black canvas.
        this.draft.backgroundKind = "solid_color";
        this.draft.backgroundValue = "#000000";
      } else if (kind === "uploaded") {
        const storedData =
          this.state.settings.background.kind === "local_image" &&
          this.state.settings.background.value.startsWith("data:")
            ? this.state.settings.background.value
            : "";
        if (storedData) {
          this.draft.backgroundKind = "local_image";
          this.draft.backgroundValue = storedData;
          previewThumb.src = storedData;
          previewArea.style.display = "flex";
        } else {
          this.draft.backgroundKind = "solid_color";
          this.draft.backgroundValue = "#000000";
          previewArea.style.display = "none";
        }
      } else if (kind === "url") {
        this.draft.backgroundKind = "remote_image";
        this.draft.backgroundValue = valInput.value || "https://";
      } else if (kind === "solid") {
        this.draft.backgroundKind = "solid_color";
        this.draft.backgroundValue = valInput.value || "#1f2937";
      } else if (kind === "gradient") {
        this.draft.backgroundKind = "gradient";
        this.draft.backgroundValue =
          valInput.value || "linear-gradient(to right, #000, #fff)";
      }
      this.applyLivePreview();
    };

    select.addEventListener("change", syncSubInputs);

    valInput.addEventListener("input", () => {
      const kind = select.value;
      if (kind === "url") this.draft.backgroundKind = "remote_image";
      else if (kind === "solid") this.draft.backgroundKind = "solid_color";
      else if (kind === "gradient") this.draft.backgroundKind = "gradient";
      this.draft.backgroundValue = valInput.value.trim();
      this.applyLivePreview();
    });

    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result;
        this.draft.backgroundKind = "local_image";
        this.draft.backgroundValue = base64;
        previewThumb.src = base64;
        previewArea.style.display = "flex";
        this.applyLivePreview();
      };
      reader.readAsDataURL(file);
    });

    clearBtn.addEventListener("click", () => {
      this.draft.backgroundKind = "solid_color";
      this.draft.backgroundValue = "#000000";
      fileInput.value = "";
      previewThumb.src = "";
      previewArea.style.display = "none";
      this.applyLivePreview();
    });
  }

  renderBackground() {
    const select = document.getElementById("opt-bg-kind");
    const valInput = document.getElementById("opt-bg-value");
    const valGroup = document.getElementById("opt-bg-value-group");
    const fileGroup = document.getElementById("opt-bg-file-group");
    const previewArea = document.getElementById("opt-bg-file-preview-area");
    const previewThumb = document.getElementById("opt-bg-file-preview");

    let source = "default";
    const bgKind = this.draft.backgroundKind;
    const bgVal = this.draft.backgroundValue;

    if (bgKind === "local_image") {
      source = bgVal.startsWith("data:") ? "uploaded" : "default";
    } else if (bgKind === "remote_image") {
      source = "url";
    } else if (bgKind === "solid_color") {
      source = "solid";
    } else if (bgKind === "gradient") {
      source = "gradient";
    }

    select.value = source;
    fileGroup.style.display = source === "uploaded" ? "block" : "none";
    valGroup.style.display =
      source === "url" || source === "solid" || source === "gradient"
        ? "block"
        : "none";

    if (source === "url" || source === "solid" || source === "gradient") {
      valInput.value = bgVal;
    } else {
      valInput.value = "";
    }

    if (source === "uploaded" && bgVal.startsWith("data:")) {
      previewThumb.src = bgVal;
      previewArea.style.display = "flex";
    } else {
      previewArea.style.display = "none";
    }
  }

  // ----- appearance -----
  wireAppearance() {
    const blur = document.getElementById("opt-blur");
    const blurOut = document.getElementById("opt-blur-out");
    blur.addEventListener("input", () => {
      blurOut.textContent = blur.value;
      this.draft.backgroundBlur = Number(blur.value);
      this.applyLivePreview();
    });

    const overlay = document.getElementById("opt-overlay");
    const overlayOut = document.getElementById("opt-overlay-out");
    overlay.addEventListener("input", () => {
      overlayOut.textContent = overlay.value;
      this.draft.backgroundOverlay = Number(overlay.value) / 100;
      this.applyLivePreview();
    });

    const tintPicker = document.getElementById("opt-tint-color");
    tintPicker.addEventListener("input", () => {
      this.draft.backgroundTintColor = tintPicker.value;
      this.applyLivePreview();
    });

    const roundness = document.getElementById("opt-roundness");
    const roundnessOut = document.getElementById("opt-roundness-out");
    roundness.addEventListener("input", () => {
      roundnessOut.textContent = roundness.value;
      this.draft.buttonRoundness = Number(roundness.value);
      this.applyLivePreview();
    });

    const themePreset = document.getElementById("opt-theme-preset");
    themePreset.addEventListener("change", () => {
      this.draft.themePreset = themePreset.value;
      this.applyLivePreview();
    });

    const h24 = document.getElementById("opt-h24");
    h24.addEventListener("change", () => {
      this.draft.timeFormat24h = h24.checked;
    });

    const searchEnabled = document.getElementById("opt-search-enabled");
    const searchEngine = document.getElementById("opt-search-engine");
    const searchEngineGroup = document.getElementById(
      "opt-search-engine-group",
    );

    const syncSearchGroup = () => {
      searchEngineGroup.style.display = searchEnabled.checked
        ? "block"
        : "none";
    };
    searchEnabled.addEventListener("change", () => {
      this.draft.searchEnabled = searchEnabled.checked;
      syncSearchGroup();
    });
    searchEngine.addEventListener("change", () => {
      this.draft.searchEngine = searchEngine.value;
    });

    const weatherEnabled = document.getElementById("opt-weather-enabled");
    const weatherLocation = document.getElementById("opt-weather-location");
    const weatherUnit = document.getElementById("opt-weather-unit");
    const weatherGroup = document.getElementById("opt-weather-details-group");

    const syncWeatherGroup = () => {
      weatherGroup.style.display = weatherEnabled.checked ? "block" : "none";
    };
    weatherEnabled.addEventListener("change", () => {
      this.draft.weatherEnabled = weatherEnabled.checked;
      syncWeatherGroup();
    });
    weatherLocation.addEventListener("input", () => {
      this.draft.weatherLocation = weatherLocation.value.trim();
    });
    weatherUnit.addEventListener("change", () => {
      this.draft.weatherUnit = weatherUnit.value;
    });

    // Initial triggers
    syncSearchGroup();
    syncWeatherGroup();
  }

  renderAppearance() {
    const d = this.draft;
    const blur = document.getElementById("opt-blur");
    blur.value = d.backgroundBlur;
    document.getElementById("opt-blur-out").textContent = d.backgroundBlur;

    const overlay = document.getElementById("opt-overlay");
    overlay.value = Math.round(d.backgroundOverlay * 100);
    document.getElementById("opt-overlay-out").textContent = Math.round(
      d.backgroundOverlay * 100,
    );

    const tintPicker = document.getElementById("opt-tint-color");
    tintPicker.value = d.backgroundTintColor;

    const roundness = document.getElementById("opt-roundness");
    if (roundness) {
      roundness.value = d.buttonRoundness ?? 8;
      document.getElementById("opt-roundness-out").textContent =
        d.buttonRoundness ?? 8;
    }

    document.getElementById("opt-theme-preset").value = d.themePreset;
    document.getElementById("opt-h24").checked = d.timeFormat24h === true;

    const searchEnabled = document.getElementById("opt-search-enabled");
    searchEnabled.checked = d.searchEnabled;
    document.getElementById("opt-search-engine").value = d.searchEngine;
    document.getElementById("opt-search-engine-group").style.display =
      d.searchEnabled ? "block" : "none";

    const weatherEnabled = document.getElementById("opt-weather-enabled");
    weatherEnabled.checked = d.weatherEnabled;
    document.getElementById("opt-weather-location").value = d.weatherLocation;
    document.getElementById("opt-weather-unit").value = d.weatherUnit;
    document.getElementById("opt-weather-details-group").style.display =
      d.weatherEnabled ? "block" : "none";
  }

  wireSaveButton() {
    const saveBtn = document.getElementById("opt-save");
    saveBtn.addEventListener("click", async () => {
      try {
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";
        await this.useCases.saveUserSettings.execute({
          name: this.draft.name,
          backgroundKind: this.draft.backgroundKind,
          backgroundValue: this.draft.backgroundValue,
          timeFormat24h: this.draft.timeFormat24h,
          backgroundBlur: this.draft.backgroundBlur,
          backgroundOverlay: this.draft.backgroundOverlay,
          backgroundTintColor: this.draft.backgroundTintColor,
          buttonRoundness: this.draft.buttonRoundness,
          themePreset: this.draft.themePreset,
          searchEnabled: this.draft.searchEnabled,
          searchEngine: this.draft.searchEngine,
          weatherEnabled: this.draft.weatherEnabled,
          weatherLocation: this.draft.weatherLocation,
          weatherUnit: this.draft.weatherUnit,
          clocks: this.draft.clocks,
        });
        this.show("Settings saved!");
        const updated = await this.useCases.getSettings.execute();
        this.state.settings = updated;
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Settings";
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Settings";
        this.show(err.message || "Failed to save settings", { error: true });
      }
    });
  }

  // ----- widgets -----
  wireWidgets() {
    // Event delegation on the list
    document.getElementById("opt-widgets").addEventListener("change", (e) => {
      if (e.target.matches('input[type="checkbox"]')) {
        const id = e.target.dataset.id;
        try {
          this.useCases.toggleWidgetVisibility.execute({ id });
        } catch (err) {
          this.show(err.message, { error: true });
        }
      }
    });
  }
  renderWidgets() {
    const ul = document.getElementById("opt-widgets");
    ul.replaceChildren();
    for (const w of this.state.layout) {
      const li = el(
        "li",
        {},
        el("span", { className: "name" }, this.titleFor(w.type)),
        el(
          "label",
          { className: "row" },
          el("span", {}, "Visible"),
          el("input", {
            type: "checkbox",
            checked: w.visible,
            dataset: { id: w.id.value },
          }),
        ),
      );
      ul.appendChild(li);
    }
  }

  // ----- categories -----
  wireCategories() {
    document
      .getElementById("opt-cat-form")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = document.getElementById("opt-cat-name");
        const name = input.value.trim();
        if (!name) return;
        try {
          await this.useCases.createCategory.execute({ name });
          input.value = "";
        } catch (err) {
          this.show(err.message, { error: true });
        }
      });

    document.getElementById("opt-cats").addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = btn.closest("li").dataset.id;
      const action = btn.dataset.action;
      if (action === "rename") {
        const cat = this.state.categories.find((c) => c.id.value === id);
        const next = window.prompt("Rename category", cat.name);
        if (next == null) return;
        try {
          await this.useCases.renameCategory.execute({ id, name: next });
        } catch (err) {
          this.show(err.message, { error: true });
        }
      }
      if (action === "delete") {
        const cat = this.state.categories.find((c) => c.id.value === id);
        if (
          !window.confirm(
            `Delete "${cat.name}"? Move or delete its bookmarks first.`,
          )
        )
          return;
        try {
          await this.useCases.deleteCategory.execute({ id });
        } catch (err) {
          this.show(err.message, { error: true });
        }
      }
    });
  }
  renderCategories() {
    const ul = document.getElementById("opt-cats");
    const sorted = [...this.state.categories].sort((a, b) => a.order - b.order);
    ul.replaceChildren(
      ...sorted.map((c) =>
        el(
          "li",
          { dataset: { id: c.id.value } },
          el("span", { className: "name" }, c.name),
          el(
            "button",
            { type: "button", dataset: { action: "rename" } },
            "Rename",
          ),
          el(
            "button",
            {
              type: "button",
              className: "danger",
              dataset: { action: "delete" },
            },
            "Delete",
          ),
        ),
      ),
    );

    // Also refresh the bookmark category select.
    const sel = document.getElementById("opt-bm-cat");
    const prev = sel.value;
    sel.replaceChildren(
      ...sorted.map((c) => el("option", { value: c.id.value }, c.name)),
    );
    if (prev && sorted.some((c) => c.id.value === prev)) sel.value = prev;
  }

  // ----- bookmarks -----
  wireBookmarks() {
    document
      .getElementById("opt-bm-form")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const title = document.getElementById("opt-bm-title").value.trim();
        const url = document.getElementById("opt-bm-url").value.trim();
        const categoryId = document.getElementById("opt-bm-cat").value;
        if (!title || !url || !categoryId) return;
        try {
          await this.useCases.createBookmark.execute({
            title,
            url,
            categoryId,
          });
          document.getElementById("opt-bm-title").value = "";
          document.getElementById("opt-bm-url").value = "";
        } catch (err) {
          this.show(err.message, { error: true });
        }
      });

    document.getElementById("opt-bms").addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const li = btn.closest("li");
      const id = li.dataset.id;
      if (btn.dataset.action === "delete") {
        const bm = this.state.bookmarks.find((b) => b.id.value === id);
        if (!window.confirm(`Delete "${bm.title}"?`)) return;
        try {
          await this.useCases.deleteBookmark.execute({ id });
        } catch (err) {
          this.show(err.message, { error: true });
        }
      }
    });

    document.getElementById("opt-bms").addEventListener("change", async (e) => {
      if (e.target.matches("select[data-id]")) {
        const id = e.target.dataset.id;
        try {
          await this.useCases.updateBookmark.execute({
            id,
            categoryId: e.target.value,
          });
        } catch (err) {
          this.show(err.message, { error: true });
        }
      }
    });
  }
  renderBookmarks() {
    const ul = document.getElementById("opt-bms");
    const sorted = [...this.state.bookmarks].sort((a, b) => a.order - b.order);
    const catOpts = (currentId) =>
      this.state.categories
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((c) =>
          el(
            "option",
            { value: c.id.value, selected: c.id.equals(currentId) },
            c.name,
          ),
        );
    ul.replaceChildren(
      ...sorted.map((b) => {
        const fav = el(
          "div",
          {
            className: "favicon",
            style: {
              width: "20px",
              height: "20px",
              display: "grid",
              placeItems: "center",
              background: "var(--surface-2)",
              borderRadius: "var(--radius-sm)",
              fontWeight: "600",
              fontSize: "10px",
            },
          },
          initial(b.title),
        );
        Promise.resolve(
          b.faviconUrl || websiteFaviconUrl(b.url.href ?? b.url),
        ).then((src) => {
          if (!src || !fav.isConnected) return;
          const img = el("img", {
            className: "favicon",
            src,
            alt: "",
            loading: "lazy",
            style: {
              width: "20px",
              height: "20px",
              borderRadius: "var(--radius-sm)",
            },
          });
          img.onerror = () => {
            if (img.isConnected) {
              img.replaceWith(fav);
            }
          };
          fav.replaceWith(img);
        });
        return el(
          "li",
          { dataset: { id: b.id.value } },
          fav,
          el("span", { className: "name" }, b.title),
          el("span", { className: "url" }, b.url),
          el(
            "select",
            { dataset: { id: b.id.value } },
            ...catOpts(b.categoryId),
          ),
          el(
            "button",
            {
              type: "button",
              className: "danger",
              dataset: { action: "delete" },
            },
            "Delete",
          ),
        );
      }),
    );
  }

  // ----- misc -----
  renderAll() {
    this.renderIdentity();
    this.renderBackground();
    this.renderAppearance();
    this.renderWidgets();
    this.renderClocks();
    this.renderCategories();
    this.renderBookmarks();
    this.applyLivePreview();
  }

  titleFor(type) {
    const val = typeof type === "object" ? type.value : type;
    switch (val) {
      case "greeting":
        return "Greeting";
      case "clock":
        return "Clock";
      case "bookmarks":
        return "Bookmarks";
      case "todo":
        return "Tasks";
      default:
        return String(val);
    }
  }

  show(message, opts = {}) {
    if (!this.toastEl) return;
    this.toastEl.textContent = message;
    this.toastEl.classList.toggle("is-error", !!opts.error);
    this.toastEl.classList.add("is-visible");
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toastEl.classList.remove("is-visible");
    }, opts.durationMs ?? 2200);
  }

  populateClockTzSelect() {
    const select = document.getElementById("opt-clock-tz-select");
    if (!select) return;
    const options = [];

    // Local time (empty timeZone) — preserves the previous "leave blank for
    // local system time" capability.
    options.push(el("option", { value: "", selected: true }, "Local time"));

    for (const preset of WORLD_CLOCK_PRESETS) {
      options.push(
        el(
          "option",
          {
            value: preset.iana,
            dataset: { city: preset.city, country: preset.country },
          },
          `${preset.city} (${preset.country})`,
        ),
      );
    }

    // Escape hatch for advanced users.
    options.push(el("option", { value: CUSTOM_TIMEZONE_VALUE }, "Custom…"));

    select.replaceChildren(...options);
  }

  wireClocks() {
    this.populateClockTzSelect();

    const select = document.getElementById("opt-clock-tz-select");
    const customInput = document.getElementById("opt-clock-tz-custom");
    const labelInput = document.getElementById("opt-clock-label");

    const syncCustomVisibility = () => {
      const isCustom = select && select.value === CUSTOM_TIMEZONE_VALUE;
      if (customInput) customInput.hidden = !isCustom;
      if (isCustom && customInput) customInput.focus();
    };

    if (select) {
      select.addEventListener("change", () => {
        syncCustomVisibility();
        // Autofill the label with the chosen city name when a preset is
        // selected. Read the city from the option's dataset so duplicate
        // IANA zones (e.g. San Francisco & Los Angeles) still map to the
        // correct city.
        const selected = select.selectedOptions[0];
        const city = selected && selected.dataset && selected.dataset.city;
        if (city && labelInput) {
          labelInput.value = city;
        }
      });
    }

    const form = document.getElementById("opt-clock-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const label = labelInput ? labelInput.value.trim() : "";
      if (!label) return;

      let timeZone;
      if (select && select.value === CUSTOM_TIMEZONE_VALUE) {
        timeZone = customInput ? customInput.value.trim() : "";
      } else {
        timeZone = select ? select.value.trim() : "";
      }

      this.draft.clocks.push({ label, timeZone });

      if (labelInput) labelInput.value = "";
      if (customInput) {
        customInput.value = "";
        customInput.hidden = true;
      }
      if (select) select.value = "";
      this.renderClocks();
    });

    document.getElementById("opt-clocks").addEventListener("click", (e) => {
      const btn = e.target.closest("button.danger");
      if (!btn) return;
      const index = Number(btn.dataset.index);
      if (isNaN(index)) return;
      this.draft.clocks.splice(index, 1);
      this.renderClocks();
    });
  }

  renderClocks() {
    const ul = document.getElementById("opt-clocks");
    ul.replaceChildren();

    this.draft.clocks.forEach((c, index) => {
      const delBtn = el(
        "button",
        {
          type: "button",
          className: "danger",
          dataset: { index: String(index) },
        },
        "Delete",
      );

      // Backward-compatible display: any stored {label, timeZone} renders
      // correctly. If the timeZone matches a preset, show the friendly
      // "City (Country)" name; otherwise show the raw IANA zone (or
      // "Local Time" when empty). This handles clocks created before the
      // preset picker existed as well as custom IANA entries.
      const tz = (c && c.timeZone) || "";
      let tzDisplay;
      if (!tz) {
        tzDisplay = "Local Time";
      } else {
        const preset = WORLD_CLOCK_PRESETS.find((p) => p.iana === tz);
        tzDisplay = preset ? `${preset.city} (${preset.country})` : tz;
      }

      const li = el(
        "li",
        {},
        el("span", { className: "name" }, c.label),
        el(
          "span",
          {
            className: "url",
            style: {
              color: "var(--muted)",
              fontSize: "10px",
              paddingLeft: "12px",
              flexGrow: 1,
            },
          },
          tzDisplay,
        ),
        delBtn,
      );
      ul.appendChild(li);
    });
  }
}

new OptionsController().init();
