import { SanitizerPort } from "../../application/ports/SanitizerPort.js";
import { Url } from "../../domain/valueObjects/Url.js";

// Defense-in-depth sanitizer. Even though the presentation layer
// uses textContent and rel="noopener noreferrer" on <a> elements,
// we still strip dangerous patterns before persistence so an XSS
// payload can never reach another context (options page, future
// remote sync, etc.).

const STRIP_REGEX = /[\u0000-\u001F\u007F<>]/g;

export class BasicSanitizer extends SanitizerPort {
  text(input) {
    if (typeof input !== "string") return "";
    return input.replace(STRIP_REGEX, "").trim();
  }

  url(input) {
    if (typeof input !== "string") return "";
    // Re-validate through the domain value object to discard
    // javascript:, data:, and other dangerous schemes.
    try {
      const u = new Url(input);
      const proto = new URL(u.href).protocol;
      if (!/^https?:$/.test(proto)) return "";
      return u.href;
    } catch {
      return "";
    }
  }
}