import { ThemeRegistry } from "../../../domain/services/ThemeRegistry.js";

export class ExportThemeUseCase {
  #themeRepository;

  constructor({ themeRepository }) {
    this.#themeRepository = themeRepository;
  }

  async execute(themeId) {
    if (!themeId || typeof themeId !== "string") {
      throw new Error("Theme ID is required for export");
    }

    let manifest = null;
    const custom = await this.#themeRepository.findById(themeId);
    if (custom) {
      manifest = custom.manifest.toJSON();
    } else {
      const builtin = ThemeRegistry.get(themeId);
      if (builtin) {
        manifest = {
          schemaVersion: "1.0.0",
          id: builtin.id,
          name: builtin.name || builtin.id,
          version: builtin.version || "1.0.0",
          description: builtin.description || "",
          author: builtin.author || "Syncly Team",
          license: builtin.license || "MIT",
          type: "community",
          modes: builtin.modes || {
            dark: { tokens: builtin.dark?.tokens || {}, aura: builtin.dark?.aura || {}, customCss: builtin.dark?.customCss || "" },
            light: { tokens: builtin.light?.tokens || {}, aura: builtin.light?.aura || {}, customCss: builtin.light?.customCss || "" },
          },
        };
      }
    }

    if (!manifest) {
      throw new Error(`Theme '${themeId}' not found`);
    }

    return {
      filename: `syncly-theme-${manifest.id || "export"}.json`,
      jsonString: JSON.stringify(manifest, null, 2),
      manifest,
    };
  }
}
