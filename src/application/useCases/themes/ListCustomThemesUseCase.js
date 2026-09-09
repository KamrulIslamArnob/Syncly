export class ListCustomThemesUseCase {
  #themeRepository;

  constructor({ themeRepository }) {
    this.#themeRepository = themeRepository;
  }

  async execute() {
    return await this.#themeRepository.findAll();
  }
}
