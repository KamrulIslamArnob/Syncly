// Tiny synchronous event bus used to notify the presentation layer
// after a use case mutates state. Keeping this in the application layer
// (rather than reaching for chrome.storage.onChanged directly) means the
// presentation doesn't bind to infrastructure.
export class EventBus {
  #listeners = new Map();

  on(event, handler) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(handler);
    return () => this.#listeners.get(event)?.delete(handler);
  }

  emit(event, payload) {
    const set = this.#listeners.get(event);
    if (!set) return;
    for (const h of set) {
      try {
        h(payload);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[EventBus] handler for ${event} threw`, err);
      }
    }
  }
}
