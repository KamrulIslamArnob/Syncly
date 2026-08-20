import { Id } from "../../../domain/valueObjects/Id.js";

import { BaseDeleteUseCase } from "../shared/BaseDeleteUseCase.js";

export class DeleteBookmarkUseCase extends BaseDeleteUseCase {
  constructor({ bookmarkRepo, events }) {
    super(bookmarkRepo, events, "bookmarks:changed");
  }
}