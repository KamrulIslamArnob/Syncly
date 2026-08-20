export class ListCategoriesUseCase {
  #repo;

  constructor(repo) {
    this.#repo = repo;
  }

  async execute() {
    const list = await this.#repo.list();
    return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
}