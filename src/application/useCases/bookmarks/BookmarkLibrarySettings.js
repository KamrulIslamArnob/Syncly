export class GetBookmarkLibrary {
  constructor({ library }) { this.library = library; }
  execute() { return this.library.getSettings(); }
  inspect() { return this.library.inspect(); }
  resolve(options) { return this.library.resolve(options); }
}

export class SetBookmarkSources {
  constructor({ library, events }) { this.library = library; this.events = events; }
  async execute(mode) {
    const saved = await this.library.setSources(mode);
    this.events?.emit("bookmarkSources:changed", saved);
    return saved;
  }
}

export class CompleteBookmarkSetup {
  constructor({ library, events, afterSetup }) { this.library = library; this.events = events; this.afterSetup = afterSetup; }
  async execute(options) {
    const saved = await this.library.completeSetup(options);
    await this.afterSetup?.();
    this.events?.emit("bookmarkSources:changed", saved);
    return saved;
  }
}
