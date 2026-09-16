import { BaseReorderUseCase } from "../shared/BaseReorderUseCase.js";

// Reorders tasks by explicit id order. Anything not listed keeps its
// relative order at the end, matching bookmarks/categories behavior.
export class ReorderTasksUseCase extends BaseReorderUseCase {
  constructor({ repo, taskRepo, events } = {}) {
    super(repo || taskRepo, events, "tasks:changed");
  }
}
