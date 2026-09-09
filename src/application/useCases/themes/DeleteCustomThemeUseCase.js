export class DeleteCustomThemeUseCase {
  #themeRepository;
  #events;

  constructor({ themeRepository, events }) {
    this.#themeRepository = themeRepository;
    this.#events = events;
  }

  async execute(id) {
    if (!id || typeof id !== "string") {
      throw new Error("Invalid theme id");
    }
    await this.#themeRepository.delete(id);
    if (this.#events?.emit) {
      this.#events.emit("themes:changed", { deletedId: id });
    }
  }
}
