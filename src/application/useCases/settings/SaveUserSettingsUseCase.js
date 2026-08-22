import { BackgroundConfig, BackgroundKind } from "../../../domain/valueObjects/BackgroundConfig.js";
import { ClockFormat, TimeFormat } from "../../../domain/valueObjects/TimeFormat.js";
import { sanitizeCss } from "../../../infrastructure/security/cssSanitizer.js";

/**
 * Unified usecase to save all settings fields at once.
 * Only updates fields that are explicitly passed (not undefined).
 * All user-supplied strings are sanitized before persistence.
 */
export class SaveUserSettingsUseCase {
  #settingsRepo;
  #events;
  #sanitizer;

  constructor({ settingsRepo, events, sanitizer }) {
    this.#settingsRepo = settingsRepo;
    this.#events = events;
    this.#sanitizer = sanitizer;
  }

  async execute(patch) {
    const settings = await this.#settingsRepo.load();

    // Fields whose values are free-text strings sanitized via the sanitizer port.
    const TEXT_FIELDS = new Set(["name", "messageText", "weatherLocation"]);

    const simpleFields = [
      "name", "backgroundBlur", "backgroundOverlay", "backgroundTintColor", "buttonRoundness",
      "bgGrayscale", "bgHueRotate", "bgPixelation", "bgVignette", "bgFilmGrain",
      "clocks", "searchEnabled", "searchEngine", "searchOpenNewTab",
      "weatherEnabled", "weatherLocation", "weatherUnit",
      "todoEnabled", "shortcutsEnabled", "quickNoteEnabled",
      "customCss", "greetingEnabled", "messageText", "clockEnabled", "showSeconds", "showDate",
      "cssVarBg", "cssVarText", "cssVarBorder", "cssVarAccent", "showWebsitePreviews", "avatarUrl",
      "workspaceThemes", "moveBookmarksToQuickAccess"
    ];

    for (const field of simpleFields) {
      if (patch[field] !== undefined) {
        let value = patch[field];
        if (TEXT_FIELDS.has(field) && typeof value === "string") {
          value = this.#sanitizer.text(value);
        } else if (field === "customCss") {
          value = this.#hardenCss(value);
        }
        const setterName = `set${field.charAt(0).toUpperCase()}${field.slice(1)}`;
        settings[setterName](value);
      }
    }

    // Color mode and theme presets: process colorMode first so preset setters target the proper state
    if (patch.colorMode !== undefined) {
      settings.setColorMode(patch.colorMode);
    }
    if (patch.themePresetDark !== undefined) {
      settings.setThemePresetDark(patch.themePresetDark);
    }
    if (patch.themePresetLight !== undefined) {
      settings.setThemePresetLight(patch.themePresetLight);
    }
    if (patch.themePreset !== undefined && patch.themePresetDark === undefined && patch.themePresetLight === undefined) {
      settings.setThemePreset(patch.themePreset);
    }

    if (patch.backgroundKind !== undefined && patch.backgroundValue !== undefined) {
      let next;
      switch (patch.backgroundKind) {
        case "local_image": next = BackgroundConfig.localImage(patch.backgroundValue); break;
        case "remote_image": next = BackgroundConfig.remoteImage(patch.backgroundValue); break;
        case "gradient": next = BackgroundConfig.gradient(patch.backgroundValue); break;
        case "solid_color": default: next = BackgroundConfig.solidColor(patch.backgroundValue); break;
      }
      settings.setBackground(next);
    }

    if (patch.timeFormat24h !== undefined) {
      settings.setTimeFormat(new ClockFormat(patch.timeFormat24h ? TimeFormat.H24 : TimeFormat.H12));
    }

    await this.#settingsRepo.save(settings);
    this.#events.emit("settings:changed", settings);
    return settings;
  }

  #hardenCss(css) {
    return sanitizeCss(css);
  }
}
