import { Id } from "../../../domain/valueObjects/Id.js";

import { BaseDeleteUseCase } from "../shared/BaseDeleteUseCase.js";

export class DeleteTaskUseCase extends BaseDeleteUseCase {
  constructor({ repo, events }) {
    super(repo, events, "tasks:changed");
  }
}