import { BackgroundConfig, BackgroundKind } from "../valueObjects/BackgroundConfig.js";
import { ClockFormat, TimeFormat } from "../valueObjects/TimeFormat.js";
import { WorldClockConfig } from "../valueObjects/WorldClockConfig.js";

// Domain entity: UserSettings
// The user's stable preferences. Bookmarks, categories, tasks, and
// widget layouts live in their own repositories to keep concerns small.
export class UserSettings {
  #name;
  #background;
  #timeFormat;
  #backgroundBlur;
  #backgroundOverlay;
  #bgGrayscale;
  #bgHueRotate;
  #bgPixelation;
  #bgVignette;
  #bgFilmGrain;
  #backgroundTintColor;
  #buttonRoundness;
  #clocks;
  #searchEnabled;
  #searchEngine;
  #searchOpenNewTab;
  #themePreset;
  #themePresetDark;
  #themePresetLight;
  #colorMode;
  #weatherEnabled;
  #weatherLocation;
  #weatherUnit;
  #focusText;
  #focusCompleted;
  #focusDate;
  #todoEnabled;
  #shortcutsEnabled;
  #quickNoteEnabled;
  #customCss;
  // New UI control fields
  #greetingEnabled;   // boolean
  #messageText;       // string
  #clockEnabled;      // boolean
  #showSeconds;       // boolean
  #showDate;          // boolean
  #cssVarBg;          // hex
  #cssVarText;        // hex
  #cssVarBorder;      // hex
  #cssVarAccent;      // hex
  #showWebsitePreviews; // boolean
  #avatarUrl;         // string
  #workspaceThemes;   // object: { [workspaceId]: { themePresetDark, themePresetLight, themePreset, colorMode, cssVarAccent } }
  #moveBookmarksToQuickAccess; // boolean

  constructor({
    name = "",
    avatarUrl = "",
    background = BackgroundConfig.solidColor("#000000"),
    timeFormat = new ClockFormat(TimeFormat.H24),
    backgroundBlur = 0,
    backgroundOverlay = 0.35,
    bgGrayscale = 0,
    bgHueRotate = 0,
    bgPixelation = 0,
    bgVignette = false,
    bgFilmGrain = false,
    backgroundTintColor = "#000000",
    buttonRoundness = 8,
    clocks = null,
    searchEnabled = true,
    searchEngine = "google",
    searchOpenNewTab = false,
    themePreset = "aurora",
    themePresetDark = null,
    themePresetLight = null,
    colorMode = "dark",
    weatherEnabled = false,
    weatherLocation = "",
    weatherUnit = "c",
    focusText = "",
    focusCompleted = false,
    focusDate = "",
    todoEnabled = true,
    shortcutsEnabled = true,
    quickNoteEnabled = true,
    customCss = "",
    greetingEnabled = true,
    messageText = "FOCUS. BUILD. SHIP.",
    clockEnabled = true,
    showSeconds = false,
    showDate = true,
    cssVarBg = "#000000",
    cssVarText = "#ffffff",
    cssVarBorder = "#333333",
    cssVarAccent = "#555B66",
    showWebsitePreviews = true,
    workspaceThemes = {},
    moveBookmarksToQuickAccess = false,
  } = {}) {
    if (typeof name !== "string") throw new Error("name must be a string");
    if (name.length > 60) throw new Error("name must be <= 60 chars");
    if (!(background instanceof BackgroundConfig)) {
      throw new Error("background must be a BackgroundConfig");
    }
    if (!(timeFormat instanceof ClockFormat)) {
      throw new Error("timeFormat must be a ClockFormat");
    }
    if (typeof backgroundBlur !== "number" || backgroundBlur < 0 || backgroundBlur > 20) {
      throw new Error("backgroundBlur must be between 0 and 20");
    }
    if (typeof backgroundOverlay !== "number" || backgroundOverlay < 0 || backgroundOverlay > 1) {
      throw new Error("backgroundOverlay must be between 0 and 1");
    }
    if (typeof bgGrayscale !== "number" || bgGrayscale < 0 || bgGrayscale > 1) {
      throw new Error("bgGrayscale must be between 0 and 1");
    }
    if (typeof bgHueRotate !== "number" || bgHueRotate < 0 || bgHueRotate > 360) {
      throw new Error("bgHueRotate must be between 0 and 360");
    }
    if (typeof bgPixelation !== "number" || bgPixelation < 0 || bgPixelation > 50) {
      throw new Error("bgPixelation must be between 0 and 50");
    }
    if (typeof searchEnabled !== "boolean") {
      throw new Error("searchEnabled must be a boolean");
    }
    const engines = ["google", "duckduckgo", "bing", "yahoo", "youtube"];
    if (!engines.includes(searchEngine)) {
      throw new Error("Invalid searchEngine");
    }
    const themes = ["aurora", "retro_grid", "diamond_storm", "graphite_flow", "solid", "minimal", "nord", "cyberpunk", "sage"];
    if (themePreset && !themes.includes(themePreset)) {
      throw new Error("Invalid themePreset");
    }
    if (themePresetDark && !themes.includes(themePresetDark)) {
      throw new Error("Invalid themePresetDark");
    }
    if (themePresetLight && !themes.includes(themePresetLight)) {
      throw new Error("Invalid themePresetLight");
    }
    const colorModes = ["dark", "light"];
    if (!colorModes.includes(colorMode)) {
      throw new Error("Invalid colorMode");
    }
    if (typeof weatherEnabled !== "boolean") {
      throw new Error("weatherEnabled must be a boolean");
    }
    if (typeof weatherLocation !== "string") {
      throw new Error("weatherLocation must be a string");
    }
    if (weatherUnit !== "c" && weatherUnit !== "f") {
      throw new Error("weatherUnit must be c or f");
    }
    if (typeof focusText !== "string") {
      throw new Error("focusText must be a string");
    }
    if (typeof focusCompleted !== "boolean") {
      throw new Error("focusCompleted must be a boolean");
    }
    if (typeof focusDate !== "string") {
      throw new Error("focusDate must be a string");
    }

    this.#name = name;
    this.#background = background;
    this.#timeFormat = timeFormat;
    this.#backgroundBlur = backgroundBlur;
    this.#backgroundOverlay = backgroundOverlay;
    this.#bgGrayscale = typeof bgGrayscale === "number" ? bgGrayscale : 0;
    this.#bgHueRotate = typeof bgHueRotate === "number" ? bgHueRotate : 0;
    this.#bgPixelation = typeof bgPixelation === "number" ? bgPixelation : 0;
    this.#bgVignette = typeof bgVignette === "boolean" ? bgVignette : false;
    this.#bgFilmGrain = typeof bgFilmGrain === "boolean" ? bgFilmGrain : false;
    this.#backgroundTintColor = backgroundTintColor;
    this.#buttonRoundness = buttonRoundness;
    this.#searchEnabled = searchEnabled;
    this.#searchEngine = searchEngine;
    this.#searchOpenNewTab = typeof searchOpenNewTab === "boolean" ? searchOpenNewTab : false;
    this.#themePresetDark = themePresetDark && themes.includes(themePresetDark) ? themePresetDark : (themePreset && themes.includes(themePreset) ? themePreset : "aurora");
    this.#themePresetLight = themePresetLight && themes.includes(themePresetLight) ? themePresetLight : (themePreset && themes.includes(themePreset) ? themePreset : "aurora");
    this.#themePreset = colorMode === "light" ? this.#themePresetLight : this.#themePresetDark;
    this.#colorMode = colorMode;
    this.#weatherEnabled = weatherEnabled;
    this.#weatherLocation = weatherLocation;
    this.#weatherUnit = weatherUnit;
    this.#focusText = focusText;
    this.#focusCompleted = focusCompleted;
    this.#focusDate = focusDate;
    this.#todoEnabled = typeof todoEnabled === "boolean" ? todoEnabled : true;
    this.#shortcutsEnabled = typeof shortcutsEnabled === "boolean" ? shortcutsEnabled : true;
    this.#quickNoteEnabled = typeof quickNoteEnabled === "boolean" ? quickNoteEnabled : true;
    let _css = typeof customCss === "string" ? customCss : "";
    // Harden at construction so backup import cannot bypass use-case
    _css = _css.replace(/@import\s+(?:url\s*\([^)]*\)|[^;{}]*)\s*;?/gi, "");
    _css = _css.replace(/@font-face\s*\{[^}]*https?:[^}]*\}/gi, "");
    _css = _css.replace(/url\s*\(\s*(['"]?)\s*(https?:\/\/|\/\/|data:text\/html)[^)]*\1?\s*\)/gi, "url()");
    _css = _css.replace(/javascript\s*:/gi, "");
    _css = _css.replace(/expression\s*\([^)]*\)/gi, "");
    _css = _css.replace(/-moz-binding\s*:[^;{}]*;?/gi, "");
    _css = _css.replace(/\bbehavior\s*:[^;{}]*;?/gi, "");
    if (_css.length > 20000) _css = _css.slice(0, 20000);
    this.#customCss = _css;
    this.#greetingEnabled = typeof greetingEnabled === "boolean" ? greetingEnabled : true;
    this.#messageText = typeof messageText === "string" ? messageText : "";
    this.#clockEnabled = typeof clockEnabled === "boolean" ? clockEnabled : true;
    this.#showSeconds = typeof showSeconds === "boolean" ? showSeconds : false;
    this.#showDate = typeof showDate === "boolean" ? showDate : true;
    this.#cssVarBg = typeof cssVarBg === "string" ? cssVarBg : "#000000";
    this.#cssVarText = typeof cssVarText === "string" ? cssVarText : "#ffffff";
    this.#cssVarBorder = typeof cssVarBorder === "string" ? cssVarBorder : "#333333";
    this.#cssVarAccent = typeof cssVarAccent === "string" ? cssVarAccent : "#555B66";
    this.#showWebsitePreviews = typeof showWebsitePreviews === "boolean" ? showWebsitePreviews : true;
    this.#avatarUrl = typeof avatarUrl === "string" ? avatarUrl : "";
    this.#workspaceThemes = (typeof workspaceThemes === "object" && workspaceThemes !== null && !Array.isArray(workspaceThemes)) ? { ...workspaceThemes } : {};
    this.#moveBookmarksToQuickAccess = typeof moveBookmarksToQuickAccess === "boolean" ? moveBookmarksToQuickAccess : false;

    if (clocks === null) {
      this.#clocks = [
        new WorldClockConfig("San Francisco", "America/Los_Angeles"),
        new WorldClockConfig("London", "Europe/London"),
        new WorldClockConfig("Dhaka", "Asia/Dhaka"),
        new WorldClockConfig("Tokyo", "Asia/Tokyo"),
      ];
    } else {
      this.#clocks = clocks.map(c => c instanceof WorldClockConfig ? c : WorldClockConfig.fromJSON(c));
    }
  }

  get name() { return this.#name; }
  get avatarUrl() { return this.#avatarUrl; }
  get background() { return this.#background; }
  get timeFormat() { return this.#timeFormat; }
  get backgroundBlur() { return this.#backgroundBlur; }
  get backgroundOverlay() { return this.#backgroundOverlay; }
  get bgGrayscale() { return this.#bgGrayscale; }
  get bgHueRotate() { return this.#bgHueRotate; }
  get bgPixelation() { return this.#bgPixelation; }
  get bgVignette() { return this.#bgVignette; }
  get bgFilmGrain() { return this.#bgFilmGrain; }
  get backgroundTintColor() { return this.#backgroundTintColor; }
  get buttonRoundness() { return this.#buttonRoundness; }
  get clocks() { return this.#clocks; }
  get searchEnabled() { return this.#searchEnabled; }
  get searchEngine() { return this.#searchEngine; }
  get searchOpenNewTab() { return this.#searchOpenNewTab; }
  get themePreset() { return this.#colorMode === "light" ? this.#themePresetLight : this.#themePresetDark; }
  get themePresetDark() { return this.#themePresetDark; }
  get themePresetLight() { return this.#themePresetLight; }
  get colorMode() { return this.#colorMode; }
  get weatherEnabled() { return this.#weatherEnabled; }
  get weatherLocation() { return this.#weatherLocation; }
  get weatherUnit() { return this.#weatherUnit; }
  get focusText() { return this.#focusText; }
  get focusCompleted() { return this.#focusCompleted; }
  get focusDate() { return this.#focusDate; }
  get todoEnabled() { return this.#todoEnabled; }
  get shortcutsEnabled() { return this.#shortcutsEnabled; }
  get quickNoteEnabled() { return this.#quickNoteEnabled; }
  get customCss() { return this.#customCss; }
  get greetingEnabled() { return this.#greetingEnabled; }
  get messageText() { return this.#messageText; }
  get clockEnabled() { return this.#clockEnabled; }
  get showSeconds() { return this.#showSeconds; }
  get showDate() { return this.#showDate; }
  get cssVarBg() { return this.#cssVarBg; }
  get cssVarText() { return this.#cssVarText; }
  get cssVarBorder() { return this.#cssVarBorder; }
  get cssVarAccent() { return this.#cssVarAccent; }
  get showWebsitePreviews() { return this.#showWebsitePreviews; }
  get workspaceThemes() { return { ...this.#workspaceThemes }; }
  get moveBookmarksToQuickAccess() { return this.#moveBookmarksToQuickAccess; }

  setName(newName) {
    if (typeof newName !== "string") throw new Error("name must be a string");
    if (newName.length > 60) throw new Error("name must be <= 60 chars");
    this.#name = newName;
  }

  setAvatarUrl(newAvatarUrl) {
    if (typeof newAvatarUrl !== "string") throw new Error("avatarUrl must be a string");
    this.#avatarUrl = newAvatarUrl;
  }

  setBackground(newBackground) {
    if (!(newBackground instanceof BackgroundConfig)) {
      throw new Error("background must be a BackgroundConfig");
    }
    this.#background = newBackground;
  }

  setTimeFormat(format) {
    if (!(format instanceof ClockFormat)) {
      throw new Error("timeFormat must be a ClockFormat");
    }
    this.#timeFormat = format;
  }

  setBackgroundBlur(value) {
    if (typeof value !== "number" || value < 0 || value > 20) {
      throw new Error("backgroundBlur must be between 0 and 20");
    }
    this.#backgroundBlur = value;
  }

  setBgGrayscale(value) { this.#bgGrayscale = Math.max(0, Math.min(100, Number(value) || 0)); }
  setBgHueRotate(value) { this.#bgHueRotate = Math.max(0, Math.min(360, Number(value) || 0)); }
  setBgPixelation(value) { this.#bgPixelation = Math.max(0, Math.min(100, Number(value) || 0)); }
  setBgVignette(value) { this.#bgVignette = !!value; }
  setBgFilmGrain(value) { this.#bgFilmGrain = !!value; }

  setBackgroundOverlay(value) {
    if (typeof value !== "number" || value < 0 || value > 1) {
      throw new Error("backgroundOverlay must be between 0 and 1");
    }
    this.#backgroundOverlay = value;
  }

  setBackgroundTintColor(value) {
    if (typeof value !== "string") {
      throw new Error("backgroundTintColor must be a string");
    }
    this.#backgroundTintColor = value;
  }

  setButtonRoundness(value) {
    if (typeof value !== "number" || value < 0 || value > 24) {
      throw new Error("buttonRoundness must be between 0 and 24");
    }
    this.#buttonRoundness = value;
  }

  setClocks(newClocks) {
    if (!Array.isArray(newClocks)) throw new Error("clocks must be an array");
    this.#clocks = newClocks.map(c => c instanceof WorldClockConfig ? c : WorldClockConfig.fromJSON(c));
  }

  setSearchEnabled(value) {
    if (typeof value !== "boolean") throw new Error("searchEnabled must be a boolean");
    this.#searchEnabled = value;
  }

  setSearchEngine(value) {
    const engines = ["google", "duckduckgo", "bing", "yahoo", "youtube"];
    if (!engines.includes(value)) throw new Error("Invalid searchEngine");
    this.#searchEngine = value;
  }

  setSearchOpenNewTab(value) {
    if (typeof value !== "boolean") throw new Error("searchOpenNewTab must be a boolean");
    this.#searchOpenNewTab = value;
  }

  setThemePreset(value) {
    const themes = ["aurora", "retro_grid", "diamond_storm", "graphite_flow", "solid", "minimal", "nord", "cyberpunk", "sage"];
    if (!themes.includes(value)) throw new Error("Invalid themePreset");
    this.#themePreset = value;
    if (this.#colorMode === "light") {
      this.#themePresetLight = value;
    } else {
      this.#themePresetDark = value;
    }
  }

  setThemePresetDark(value) {
    const themes = ["aurora", "retro_grid", "diamond_storm", "graphite_flow", "solid", "minimal", "nord", "cyberpunk", "sage"];
    if (!themes.includes(value)) throw new Error("Invalid themePresetDark");
    this.#themePresetDark = value;
    if (this.#colorMode === "dark") this.#themePreset = value;
  }

  setThemePresetLight(value) {
    const themes = ["aurora", "retro_grid", "diamond_storm", "graphite_flow", "solid", "minimal", "nord", "cyberpunk", "sage"];
    if (!themes.includes(value)) throw new Error("Invalid themePresetLight");
    this.#themePresetLight = value;
    if (this.#colorMode === "light") this.#themePreset = value;
  }

  setColorMode(value) {
    const colorModes = ["dark", "light"];
    if (!colorModes.includes(value)) throw new Error("Invalid colorMode");
    this.#colorMode = value;
    this.#themePreset = value === "light" ? this.#themePresetLight : this.#themePresetDark;
  }

  setWeatherEnabled(value) {
    if (typeof value !== "boolean") throw new Error("weatherEnabled must be a boolean");
    this.#weatherEnabled = value;
  }

  setWeatherLocation(value) {
    if (typeof value !== "string") throw new Error("weatherLocation must be a string");
    this.#weatherLocation = value;
  }

  setWeatherUnit(value) {
    if (value !== "c" && value !== "f") throw new Error("weatherUnit must be c or f");
    this.#weatherUnit = value;
  }

  setFocus(text, completed, date) {
    if (typeof text !== "string") throw new Error("focusText must be a string");
    if (typeof completed !== "boolean") throw new Error("focusCompleted must be a boolean");
    if (typeof date !== "string") throw new Error("focusDate must be a string");
    this.#focusText = text;
    this.#focusCompleted = completed;
    this.#focusDate = date;
  }

  setTodoEnabled(value) {
    if (typeof value !== "boolean") throw new Error("todoEnabled must be a boolean");
    this.#todoEnabled = value;
  }

  setShortcutsEnabled(value) {
    if (typeof value !== "boolean") throw new Error("shortcutsEnabled must be a boolean");
    this.#shortcutsEnabled = value;
  }

  setQuickNoteEnabled(value) {
    if (typeof value !== "boolean") throw new Error("quickNoteEnabled must be a boolean");
    this.#quickNoteEnabled = value;
  }

  setCustomCss(value) {
    if (typeof value !== "string") throw new Error("customCss must be a string");
    // Defense-in-depth: sanitize even if caller bypasses use-case (e.g., backup import)
    let sanitized = value;
    // Inline lightweight sanitize to avoid circular import; mirrors cssSanitizer
    sanitized = sanitized.replace(/@import\s+(?:url\s*\([^)]*\)|[^;{}]*)\s*;?/gi, "");
    sanitized = sanitized.replace(/@font-face\s*\{[^}]*https?:[^}]*\}/gi, "");
    sanitized = sanitized.replace(/url\s*\(\s*(['"]?)\s*(https?:\/\/|\/\/|data:text\/html)[^)]*\1?\s*\)/gi, "url()");
    sanitized = sanitized.replace(/javascript\s*:/gi, "");
    sanitized = sanitized.replace(/expression\s*\([^)]*\)/gi, "");
    sanitized = sanitized.replace(/-moz-binding\s*:[^;{}]*;?/gi, "");
    sanitized = sanitized.replace(/\bbehavior\s*:[^;{}]*;?/gi, "");
    if (sanitized.length > 20000) sanitized = sanitized.slice(0, 20000);
    this.#customCss = sanitized;
  }

  setGreetingEnabled(value) { this.#greetingEnabled = !!value; }
  setMessageText(value) { this.#messageText = String(value ?? ""); }
  setClockEnabled(value) { this.#clockEnabled = !!value; }
  setShowSeconds(value) { this.#showSeconds = !!value; }
  setShowDate(value) { this.#showDate = !!value; }
  setCssVarBg(value) { this.#cssVarBg = String(value ?? "#000000"); }
  setCssVarText(value) { this.#cssVarText = String(value ?? "#ffffff"); }
  setCssVarBorder(value) { this.#cssVarBorder = String(value ?? "#333333"); }
  setCssVarAccent(value) { this.#cssVarAccent = String(value ?? "#555B66"); }
  setShowWebsitePreviews(value) { this.#showWebsitePreviews = typeof value === "boolean" ? value : true; }
  setWorkspaceThemes(value) {
    this.#workspaceThemes = (typeof value === "object" && value !== null && !Array.isArray(value)) ? { ...value } : {};
  }
  setWorkspaceTheme(workspaceId, themeObj) {
    if (typeof workspaceId === "string" && workspaceId.trim()) {
      this.#workspaceThemes[workspaceId] = { ...(this.#workspaceThemes[workspaceId] || {}), ...themeObj };
    }
  }
  setMoveBookmarksToQuickAccess(value) {
    if (typeof value !== "boolean") throw new Error("moveBookmarksToQuickAccess must be a boolean");
    this.#moveBookmarksToQuickAccess = value;
  }

  toJSON() {
    return {
      name: this.#name,
      background: { kind: this.#background.kind, value: this.#background.value },
      timeFormat: this.#timeFormat.value,
      backgroundBlur: this.#backgroundBlur,
      backgroundOverlay: this.#backgroundOverlay,
      bgGrayscale: this.#bgGrayscale,
      bgHueRotate: this.#bgHueRotate,
      bgPixelation: this.#bgPixelation,
      bgVignette: this.#bgVignette,
      bgFilmGrain: this.#bgFilmGrain,
      backgroundTintColor: this.#backgroundTintColor,
      buttonRoundness: this.#buttonRoundness,
      clocks: this.#clocks.map(c => c.toJSON()),
      searchEnabled: this.#searchEnabled,
      searchEngine: this.#searchEngine,
      searchOpenNewTab: this.#searchOpenNewTab,
      themePreset: this.themePreset,
      themePresetDark: this.#themePresetDark,
      themePresetLight: this.#themePresetLight,
      colorMode: this.#colorMode,
      weatherEnabled: this.#weatherEnabled,
      weatherLocation: this.#weatherLocation,
      weatherUnit: this.#weatherUnit,
      focusText: this.#focusText,
      focusCompleted: this.#focusCompleted,
      focusDate: this.#focusDate,
      todoEnabled: this.#todoEnabled,
      shortcutsEnabled: this.#shortcutsEnabled,
      quickNoteEnabled: this.#quickNoteEnabled,
      customCss: this.#customCss,
      greetingEnabled: this.#greetingEnabled,
      messageText: this.#messageText,
      clockEnabled: this.#clockEnabled,
      showSeconds: this.#showSeconds,
      showDate: this.#showDate,
      cssVarBg: this.#cssVarBg,
      cssVarText: this.#cssVarText,
      cssVarBorder: this.#cssVarBorder,
      cssVarAccent: this.#cssVarAccent,
      showWebsitePreviews: this.#showWebsitePreviews,
      avatarUrl: this.#avatarUrl,
      workspaceThemes: this.#workspaceThemes,
      moveBookmarksToQuickAccess: this.#moveBookmarksToQuickAccess,
    };
  }

  static fromJSON(json) {
    const safe = json ?? {};
    const bg = safe.background ?? {
      kind: BackgroundKind.SOLID_COLOR,
      value: "#000000",
    };
    
    let loadedClocks = null;
    if (Array.isArray(safe.clocks) && safe.clocks.length > 0) {
      loadedClocks = safe.clocks.map(c => WorldClockConfig.fromJSON(c));
    }

    const themes = ["aurora", "retro_grid", "diamond_storm", "graphite_flow", "solid", "minimal", "nord", "cyberpunk", "sage"];
    const themePreset = safe.themePreset && themes.includes(safe.themePreset) ? safe.themePreset : "aurora";
    const themePresetDark = safe.themePresetDark && themes.includes(safe.themePresetDark) ? safe.themePresetDark : themePreset;
    const themePresetLight = safe.themePresetLight && themes.includes(safe.themePresetLight) ? safe.themePresetLight : themePreset;

    return new UserSettings({
      name: safe.name ?? "",
      avatarUrl: safe.avatarUrl ?? "",
      background: new BackgroundConfig(bg.kind, bg.value),
      timeFormat: new ClockFormat(safe.timeFormat ?? TimeFormat.H24),
      backgroundBlur: typeof safe.backgroundBlur === "number" ? safe.backgroundBlur : 0,
      backgroundOverlay: typeof safe.backgroundOverlay === "number" ? safe.backgroundOverlay : 0.35,
      bgGrayscale: typeof safe.bgGrayscale === "number" ? safe.bgGrayscale : 0,
      bgHueRotate: typeof safe.bgHueRotate === "number" ? safe.bgHueRotate : 0,
      bgPixelation: typeof safe.bgPixelation === "number" ? safe.bgPixelation : 0,
      bgVignette: !!safe.bgVignette,
      bgFilmGrain: !!safe.bgFilmGrain,
      backgroundTintColor: safe.backgroundTintColor ?? "#000000",
      buttonRoundness: typeof safe.buttonRoundness === "number" ? safe.buttonRoundness : 8,
      clocks: loadedClocks,
      searchEnabled: safe.searchEnabled !== false,
      searchEngine: safe.searchEngine ?? "google",
      searchOpenNewTab: safe.searchOpenNewTab === true,
      themePreset,
      themePresetDark,
      themePresetLight,
      colorMode: safe.colorMode === "light" ? "light" : "dark",
      weatherEnabled: !!safe.weatherEnabled,
      weatherLocation: safe.weatherLocation ?? "",
      weatherUnit: safe.weatherUnit ?? "c",
      focusText: safe.focusText ?? "",
      focusCompleted: !!safe.focusCompleted,
      focusDate: safe.focusDate ?? "",
      todoEnabled: safe.todoEnabled !== false,
      shortcutsEnabled: safe.shortcutsEnabled !== false,
      quickNoteEnabled: safe.quickNoteEnabled !== false,
      customCss: safe.customCss ?? "",
      greetingEnabled: safe.greetingEnabled !== false,
      messageText: safe.messageText ?? "",
      clockEnabled: safe.clockEnabled !== false,
      showSeconds: !!safe.showSeconds,
      showDate: safe.showDate !== false,
      cssVarBg: safe.cssVarBg ?? "#000000",
      cssVarText: safe.cssVarText ?? "#ffffff",
      cssVarBorder: safe.cssVarBorder ?? "#333333",
      cssVarAccent: safe.cssVarAccent ?? "#555B66",
      showWebsitePreviews: safe.showWebsitePreviews !== false,
      workspaceThemes: safe.workspaceThemes ?? {},
      moveBookmarksToQuickAccess: !!safe.moveBookmarksToQuickAccess,
    });
  }
}
