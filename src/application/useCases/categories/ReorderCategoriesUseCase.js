import { Id } from "../../../domain/valueObjects/Id.js";

import { BaseReorderUseCase } from "../shared/BaseReorderUseCase.js";

// Accepts the new ordered list of category ids. The use case re-numbers
// the `order` field on every category so that subsequent reads come back
// in the requested order. Anything not in `orderedIds` keeps its
// existing order, pushed to the end.
export class ReorderCategoriesUseCase extends BaseReorderUseCase {
  constructor({ repo, events }) {
    super(repo, events, "categories:changed");
  }
}
