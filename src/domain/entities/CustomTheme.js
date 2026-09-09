import { ThemeManifest } from "./ThemeManifest.js";

/**
 * CustomTheme — Domain Entity
 * --------------------------------------------------------------------
 * Represents a user-created or imported custom theme with validated token mappings,
 * metadata, and custom styling rules.
 */
export class CustomTheme {
  #id;
  #name;
  #description;
  #author;
  #manifest;
  #createdAt;
  #updatedAt;

  constructor({
    id,
    name,
    description = "",
    author = "User",
    manifest,
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString(),
  } = {}) {
    if (!id || typeof id !== "string") {
      throw new Error("CustomTheme requires a valid non-empty 'id'");
    }
    if (!name || typeof name !== "string") {
      throw new Error("CustomTheme requires a valid non-empty 'name'");
    }

    this.#id = id.trim();
    this.#name = name.trim();
    this.#description = String(description || "").trim();
    this.#author = String(author || "User").trim();

    if (manifest instanceof ThemeManifest) {
      this.#manifest = manifest;
    } else if (manifest && typeof manifest === "object") {
      this.#manifest = ThemeManifest.fromJSON({ ...manifest, id: this.#id, name: this.#name });
    } else {
      throw new Error("CustomTheme requires a valid ThemeManifest instance or object");
    }

    this.#createdAt = String(createdAt || new Date().toISOString());
    this.#updatedAt = String(updatedAt || new Date().toISOString());
  }

  get id() { return this.#id; }
  get name() { return this.#name; }
  get description() { return this.#description; }
  get author() { return this.#author; }
  get manifest() { return this.#manifest; }
  get createdAt() { return this.#createdAt; }
  get updatedAt() { return this.#updatedAt; }

  setName(name) {
    if (!name || typeof name !== "string") throw new Error("Invalid name");
    this.#name = name.trim();
    this.#updatedAt = new Date().toISOString();
  }

  setDescription(desc) {
    this.#description = String(desc || "").trim();
    this.#updatedAt = new Date().toISOString();
  }

  setManifest(manifest) {
    if (manifest instanceof ThemeManifest) {
      this.#manifest = manifest;
    } else if (manifest && typeof manifest === "object") {
      this.#manifest = ThemeManifest.fromJSON({ ...manifest, id: this.#id, name: this.#name });
    } else {
      throw new Error("Invalid manifest");
    }
    this.#updatedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      schemaVersion: 1,
      id: this.#id,
      name: this.#name,
      description: this.#description,
      author: this.#author,
      manifest: this.#manifest.toJSON(),
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
    };
  }

  static fromJSON(json) {
    if (!json || typeof json !== "object") {
      throw new Error("Invalid CustomTheme JSON");
    }
    return new CustomTheme({
      id: json.id,
      name: json.name,
      description: json.description,
      author: json.author,
      manifest: json.manifest || json,
      createdAt: json.createdAt,
      updatedAt: json.updatedAt,
    });
  }
}
