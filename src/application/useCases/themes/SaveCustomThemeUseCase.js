import { CustomTheme } from "../../../domain/entities/CustomTheme.js";
import { ThemeManifest } from "../../../domain/entities/ThemeManifest.js";

export class SaveCustomThemeUseCase {
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

  async execute(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Theme data must be an object");
    }

    const name = this.#sanitizer ? this.#sanitizer.text(data.name || "") : String(data.name || "").trim();
    if (!name) {
      throw new Error("Theme name cannot be empty");
    }

    let id = data.id ? String(data.id).trim() : "";
    if (!id) {
      const generated = this.#idGenerator ? this.#idGenerator.generate() : Math.random().toString(36).slice(2, 10);
      id = `custom_${generated}`;
    }

    const description = this.#sanitizer ? this.#sanitizer.text(data.description || "") : String(data.description || "").trim();
    const author = this.#sanitizer ? this.#sanitizer.text(data.author || "User") : String(data.author || "User").trim();

    let manifest = data.manifest;
    if (!(manifest instanceof ThemeManifest)) {
      manifest = ThemeManifest.fromJSON({
        ...(typeof manifest === "object" ? manifest : {}),
        id,
        name,
        description,
        author,
        type: "custom",
      });
    }

    const customTheme = new CustomTheme({
      id,
      name,
      description,
      author,
      manifest,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const saved = await this.#themeRepository.save(customTheme);
    if (this.#events?.emit) {
      this.#events.emit("themes:changed", saved);
    }
    return saved;
  }
}
