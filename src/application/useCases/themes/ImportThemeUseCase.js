import { CustomTheme } from "../../../domain/entities/CustomTheme.js";
import { ThemeManifest } from "../../../domain/entities/ThemeManifest.js";
import { sanitizeCss } from "../../../infrastructure/security/cssSanitizer.js";

export class ImportThemeUseCase {
  #themeRepository;
  #events;
  #sanitizer;
  #idGenerator;

  constructor({ themeRepository, events, sanitizer, idGenerator }) {
    this.#themeRepository = themeRepository;
    this.#events = events;
    this.#sanitizer = sanitizer;
    this.#idGenerator = idGenerator;
  }

  async execute(input) {
    if (!input) throw new Error("No theme data provided to import");

    let parsed = null;
    if (typeof input === "string") {
      if (input.length > 200_000) {
        throw new Error("Theme file exceeds maximum allowed size (200KB)");
      }
      try {
        parsed = JSON.parse(input, (key, value) => {
          if (key === "__proto__" || key === "constructor" || key === "prototype") {
            return undefined; // Drop prototype poison
          }
          return value;
        });
      } catch (err) {
        throw new Error(`Failed to parse theme JSON: ${err.message}`);
      }
    } else if (typeof input === "object") {
      parsed = input;
    } else {
      throw new Error("Invalid input format");
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Theme manifest must be a JSON object");
    }

    // Extract core fields
    const rawName = parsed.name || parsed.manifest?.name || "Imported Theme";
    const name = this.#sanitizer ? this.#sanitizer.text(rawName) : String(rawName).trim();
    if (!name) throw new Error("Theme must have a valid name");

    let id = parsed.id || parsed.manifest?.id;
    if (!id || typeof id !== "string") {
      const generated = this.#idGenerator ? this.#idGenerator.generate() : Math.random().toString(36).slice(2, 10);
      id = `custom_${generated}`;
    } else {
      id = id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
      if (!id.startsWith("custom_") && !id.startsWith("custom-")) {
        id = `custom_${id}`;
      }
    }

    const description = this.#sanitizer ? this.#sanitizer.text(parsed.description || parsed.manifest?.description || "") : String(parsed.description || "");
    const author = this.#sanitizer ? this.#sanitizer.text(parsed.author || parsed.manifest?.author || "Community") : String(parsed.author || "Community");

    // Extract and sanitize modes
    const rawModes = parsed.modes || parsed.manifest?.modes || {
      dark: {
        tokens: parsed.colors?.dark || parsed.dark?.tokens || parsed.dark || {},
        aura: parsed.aura?.dark || parsed.dark?.aura || {},
        customCss: parsed.customCss?.dark || parsed.dark?.customCss || parsed.customCss || "",
      },
      light: {
        tokens: parsed.colors?.light || parsed.light?.tokens || parsed.light || {},
        aura: parsed.aura?.light || parsed.light?.aura || {},
        customCss: parsed.customCss?.light || parsed.light?.customCss || parsed.customCss || "",
      },
    };

    const sanitizedModes = {
      dark: {
        tokens: this.#sanitizeTokens(rawModes.dark?.tokens || {}),
        aura: typeof rawModes.dark?.aura === "object" && rawModes.dark?.aura !== null ? rawModes.dark.aura : { enabled: false },
        customCss: sanitizeCss(rawModes.dark?.customCss || ""),
      },
      light: {
        tokens: this.#sanitizeTokens(rawModes.light?.tokens || {}),
        aura: typeof rawModes.light?.aura === "object" && rawModes.light?.aura !== null ? rawModes.light.aura : { enabled: false },
        customCss: sanitizeCss(rawModes.light?.customCss || ""),
      },
    };

    const manifest = new ThemeManifest({
      id,
      name,
      version: parsed.version || "1.0.0",
      description,
      author,
      license: parsed.license || "MIT",
      type: "custom",
      modes: sanitizedModes,
    });

    const customTheme = new CustomTheme({
      id,
      name,
      description,
      author,
      manifest,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const saved = await this.#themeRepository.save(customTheme);
    if (this.#events?.emit) {
      this.#events.emit("themes:changed", saved);
    }
    return saved;
  }

  #sanitizeTokens(tokens) {
    if (!tokens || typeof tokens !== "object") return {};
    const clean = {};
    for (const [prop, val] of Object.entries(tokens)) {
      if (typeof prop === "string" && prop.startsWith("--") && typeof val === "string") {
        // Drop any quotes or control chars
        const safeVal = val.replace(/[<>"';{}]/g, "").trim();
        if (safeVal) clean[prop] = safeVal;
      }
    }
    return clean;
  }
}
