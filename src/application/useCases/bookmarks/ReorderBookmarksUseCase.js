import { Id } from "../../../domain/valueObjects/Id.js";

import { BaseReorderUseCase } from "../shared/BaseReorderUseCase.js";

// Accepts the new ordered list of bookmark ids. The use case re-numbers
// the `order` field on every bookmark so that subsequent reads come back
// in the requested order. Anything not in `orderedIds` keeps its
// existing order, pushed to the end.
export class ReorderBookmarksUseCase extends BaseReorderUseCase {
  constructor({ repo, events }) {
    super(repo, events, "bookmarks:changed");
  }
}
