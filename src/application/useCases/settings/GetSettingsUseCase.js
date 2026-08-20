export class GetSettingsUseCase {
  #settingsRepo;

  constructor(settingsRepo) {
    this.#settingsRepo = settingsRepo;
  }

  async execute() {
    return this.#settingsRepo.load();
  }
}