import { Id } from "../../../domain/valueObjects/Id.js";

import { BaseDeleteUseCase } from "../shared/BaseDeleteUseCase.js";

export class DeleteTaskUseCase extends BaseDeleteUseCase {
  constructor({ repo, taskRepo, events } = {}) {
    super(repo || taskRepo, events, "tasks:changed");
  }
}