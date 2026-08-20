export class ListTasksUseCase {
  #repo;

  constructor(repo) {
    this.#repo = repo;
  }

  async execute() {
    const tasks = await this.#repo.list();
    return [...tasks].sort((a, b) => a.order - b.order);
  }
}