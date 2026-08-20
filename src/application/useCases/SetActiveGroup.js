/* ============================================================
   SetActiveGroup — Application use case

   Sets the active bookmark group for filtering.
   Stores the active group ID via the injected storage client
   (ChromeStorageClient), which is hardcoded to chrome.storage.local.
   The application layer never touches chrome.* directly.
   ============================================================ */

const ACTIVE_GROUP_KEY = "activeBookmarkGroup";

export class SetActiveGroup {
  constructor(storage) {
    this.storage = storage;
  }

  async execute(groupId) {
    if (groupId === null || groupId === undefined) {
      await this.storage.remove(ACTIVE_GROUP_KEY);
      return null;
    }

    await this.storage.set(ACTIVE_GROUP_KEY, groupId);
    return groupId;
  }

  async getActive() {
    const result = await this.storage.getOne(ACTIVE_GROUP_KEY);
    return result || null;
  }
}
