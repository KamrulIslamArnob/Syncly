import { IdGeneratorPort } from "../../application/ports/ports.js";

export class UuidGenerator extends IdGeneratorPort {
  next() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID
    return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}