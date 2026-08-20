// Application-layer port for input sanitization.
// The application trusts that any user-supplied string has been passed
// through this port before being persisted or rendered. The infrastructure
// layer provides a concrete implementation (DOMPurify-based, or a small
// handwritten one for very small surfaces).
export class SanitizerPort {
  /**
   * @param {string} input
   * @returns {string} a value safe to assign to textContent
   */
  text(input) {
    throw new Error("not implemented");
  }

  /**
   * @param {string} input
   * @returns {string} a value safe to use as a URL in <a href>
   */
  url(input) {
    throw new Error("not implemented");
  }
}