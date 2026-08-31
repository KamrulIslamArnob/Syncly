// Composition root.
// Builds the dependency graph once and exports a frozen container.
// Presentation controllers consume the container; nothing else wires
// dependencies directly. This is the ONLY place that knows about
// concrete infrastructure classes.

import { ChromeStorageClient } from "../persistence/chromeStorage/ChromeStorageClient.js";
import { ChromeBookmarkRepository } from "../persistence/chromeStorage/ChromeBookmarkRepository.js";
import { ChromeCategoryRepository } from "../persistence/chromeStorage/ChromeCategoryRepository.js";
import { ChromeSettingsRepository } from "../persistence/chromeStorage/ChromeSettingsRepository.js";
import { ChromeTaskRepository } from "../persistence/chromeStorage/ChromeTaskRepository.js";
import { ChromeLayoutRepository } from "../persistence/chromeStorage/ChromeLayoutRepository.js";
import { ChromeSubfolderRepository } from "../persistence/chromeStorage/ChromeSubfolderRepository.js";
import { ChromeBookmarkGroupRepository } from "../repositories/ChromeBookmarkGroupRepository.js";
import { ChromeBookmarkTagRepository } from "../repositories/ChromeBookmarkTagRepository.js";
import { ChromeBookmarkCollectionRepository } from "../repositories/ChromeBookmarkCollectionRepository.js";
import { SystemClock } from "../services/SystemClock.js";
import { UuidGenerator } from "../services/UuidGenerator.js";
import { BasicSanitizer } from "../security/BasicSanitizer.js";
import { AutoBackupService } from "../services/AutoBackupService.js";
import { GitHubBackupService } from "../services/GitHubBackupService.js";
import { GoogleSyncService, SYNC_KEYS, TOMBSTONE_KEY } from "../services/GoogleSyncService.js";

import { EventBus } from "../../application/ports/EventBus.js";

import { EnsureQuickieFolderUseCase } from "../../application/useCases/bookmarks/EnsureQuickieFolderUseCase.js";
import { EnsureShortcutsFolderUseCase } from "../../application/useCases/bookmarks/EnsureShortcutsFolderUseCase.js";
import { EnsureCollectionsFolderUseCase } from "../../application/useCases/bookmarks/EnsureCollectionsFolderUseCase.js";
import { MigrateBookmarkBarToQuickAccessUseCase } from "../../application/useCases/bookmarks/MigrateBookmarkBarToQuickAccessUseCase.js";
import { ListBookmarkCollectionsUseCase } from "../../application/useCases/collections/ListBookmarkCollectionsUseCase.js";
import { CreateBookmarkCollectionUseCase } from "../../application/useCases/collections/CreateBookmarkCollectionUseCase.js";
import { UpdateCollectionMembersUseCase } from "../../application/useCases/collections/UpdateCollectionMembersUseCase.js";
import { DeleteBookmarkCollectionUseCase } from "../../application/useCases/collections/DeleteBookmarkCollectionUseCase.js";
import { RenameBookmarkCollectionUseCase } from "../../application/useCases/collections/RenameBookmarkCollectionUseCase.js";
import { SyncFromGoogleCloudUseCase } from "../../application/useCases/sync/SyncFromGoogleCloudUseCase.js";
import { AdoptNativeWorkspaceFolders } from "../../application/useCases/workspaces/AdoptNativeWorkspaceFolders.js";

import { ListBookmarksUseCase } from "../../application/useCases/bookmarks/ListBookmarksUseCase.js";
import { CreateBookmarkUseCase } from "../../application/useCases/bookmarks/CreateBookmarkUseCase.js";
import { UpdateBookmarkUseCase } from "../../application/useCases/bookmarks/UpdateBookmarkUseCase.js";
import { DeleteBookmarkUseCase } from "../../application/useCases/bookmarks/DeleteBookmarkUseCase.js";

import { ListCategoriesUseCase } from "../../application/useCases/categories/ListCategoriesUseCase.js";
import { CreateCategoryUseCase } from "../../application/useCases/categories/CreateCategoryUseCase.js";
import { RenameCategoryUseCase } from "../../application/useCases/categories/RenameCategoryUseCase.js";
import { DeleteCategoryUseCase } from "../../application/useCases/categories/DeleteCategoryUseCase.js";
import { ReorderCategoriesUseCase } from "../../application/useCases/categories/ReorderCategoriesUseCase.js";
import { ReorderBookmarksUseCase } from "../../application/useCases/bookmarks/ReorderBookmarksUseCase.js";

import { ListSubfoldersUseCase } from "../../application/useCases/subfolders/ListSubfoldersUseCase.js";
import { CreateSubfolderUseCase } from "../../application/useCases/subfolders/CreateSubfolderUseCase.js";
import { UpdateSubfolderUseCase } from "../../application/useCases/subfolders/UpdateSubfolderUseCase.js";
import { DeleteSubfolderUseCase } from "../../application/useCases/subfolders/DeleteSubfolderUseCase.js";

import { GetSettingsUseCase } from "../../application/useCases/settings/GetSettingsUseCase.js";
import { SaveUserSettingsUseCase } from "../../application/useCases/settings/SaveUserSettingsUseCase.js";

import { ListTasksUseCase } from "../../application/useCases/tasks/ListTasksUseCase.js";
import { CreateTaskUseCase } from "../../application/useCases/tasks/CreateTaskUseCase.js";
import { UpdateTaskUseCase } from "../../application/useCases/tasks/UpdateTaskUseCase.js";
import { DeleteTaskUseCase } from "../../application/useCases/tasks/DeleteTaskUseCase.js";

import { GetLayoutUseCase } from "../../application/useCases/layout/GetLayoutUseCase.js";
import { ToggleWidgetVisibilityUseCase } from "../../application/useCases/layout/ToggleWidgetVisibilityUseCase.js";

import { CreateBookmarkGroup } from "../../application/useCases/CreateBookmarkGroup.js";
import { UpdateBookmarkGroup } from "../../application/useCases/UpdateBookmarkGroup.js";
import { DeleteBookmarkGroup } from "../../application/useCases/DeleteBookmarkGroup.js";
import { ListBookmarkGroups } from "../../application/useCases/ListBookmarkGroups.js";
import { ListBookmarkTagsUseCase } from "../../application/useCases/tags/ListBookmarkTagsUseCase.js";
import { SetBookmarkTagsUseCase } from "../../application/useCases/tags/SetBookmarkTagsUseCase.js";
import { SetActiveGroup } from "../../application/useCases/SetActiveGroup.js";

import { PushBackupToGitHubUseCase } from "../../application/useCases/backup/PushBackupToGitHubUseCase.js";


export function buildContainer() {
  // ---- infrastructure singletons ----
  const storage = new ChromeStorageClient();
  const bookmarkRepo = new ChromeBookmarkRepository(storage);
  const categoryRepo = new ChromeCategoryRepository(storage);
  const settingsRepo = new ChromeSettingsRepository(storage);
  const taskRepo = new ChromeTaskRepository(storage);
  const layoutRepo = new ChromeLayoutRepository(storage);
  const subfolderRepo = new ChromeSubfolderRepository(storage);
  const bookmarkGroupRepo = new ChromeBookmarkGroupRepository();
  const bookmarkTagRepo = new ChromeBookmarkTagRepository();
  const bookmarkCollectionRepo = new ChromeBookmarkCollectionRepository();
  const clock = new SystemClock();
  const ids = new UuidGenerator();
  const sanitizer = new BasicSanitizer();
  const events = new EventBus();
  const autoBackupService = new AutoBackupService();
  const githubBackupService = new GitHubBackupService();
  const googleSyncService = new GoogleSyncService();
  const adoptNativeWorkspaceFolders = new AdoptNativeWorkspaceFolders({
    groupRepository: bookmarkGroupRepo,
    events,
    getTree: () =>
      typeof chrome !== "undefined" && chrome.bookmarks?.getTree
        ? chrome.bookmarks.getTree()
        : Promise.resolve([]),
    updateFolder: async (folderId, title) => {
      if (typeof chrome === "undefined" || !chrome.bookmarks?.update) return;
      await chrome.bookmarks.update(folderId, { title });
    },
  });

  // ---- repositories that can be wiped when another tab changes state ----
  storage.onChanged((changes) => {
    if (changes.bookmarks) bookmarkRepo.invalidate();
    if (changes.categories) categoryRepo.invalidate();
    if (changes.settings) settingsRepo.invalidate();
    if (changes.tasks) taskRepo.invalidate();
    if (changes.layout) layoutRepo.invalidate();
    if (changes.subfolders) subfolderRepo.invalidate();
    if (changes.bookmarkGroups) bookmarkGroupRepo.clearCache();
    if (changes.bookmarkTags) bookmarkTagRepo.clearCache();
    if (changes.bookmarkCollections) bookmarkCollectionRepo.clearCache();

    if (changes.bookmarks) events.emit("bookmarks:changed", undefined);
    if (changes.categories) events.emit("categories:changed", undefined);
    if (changes.settings) events.emit("settings:changed", changes.settings.newValue);
    if (changes.tasks) events.emit("tasks:changed", undefined);
    if (changes.layout) events.emit("layout:changed", undefined);
    if (changes.subfolders) events.emit("subfolders:changed", undefined);
    if (changes.bookmarkGroups) events.emit("bookmarkGroups:changed", undefined);
    if (changes.bookmarkCollections) events.emit("bookmarkCollections:changed", undefined);
    if (changes.bookmarkTags) events.emit("bookmarkTags:changed", undefined);
  });

  // Cross-device Google Sync change listener.
  // chrome.storage.onChanged fires here (page context) AND in the service
  // worker (serviceWorker.js) — the SW covers delivery while no Syncly page
  // is open; this one gives open tabs an instant refresh path. Both go
  // through applyRemoteChanges() which MERGES remote data item-level into
  // local storage instead of blindly overwriting (no more clobbering a
  // workspace created locally while a remote snapshot lands).
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      const relevant = {};
      for (const [key, change] of Object.entries(changes)) {
        if (!SYNC_KEYS.includes(key) && key !== TOMBSTONE_KEY) continue;
        if (googleSyncService.isOwnEcho(key, change?.newValue)) continue;
        relevant[key] = change;
      }
      if (Object.keys(relevant).length === 0) return;

      googleSyncService.applyRemoteChanges(relevant).then((changedKeys) => {
        for (const key of changedKeys) {
          // NOTE: changedKeys may include keys affected by newly-arrived
          // tombstones that were NOT part of this batch — always emit.
          if (key === "bookmarks") { bookmarkRepo.invalidate(); events.emit("bookmarks:changed", undefined); }
          if (key === "categories") { categoryRepo.invalidate(); events.emit("categories:changed", undefined); }
          if (key === "settings") { settingsRepo.invalidate(); events.emit("settings:changed", undefined); }
          if (key === "bookmarkGroups") { bookmarkGroupRepo.clearCache(); events.emit("bookmarkGroups:changed", undefined); }
          if (key === "bookmarkCollections") { bookmarkCollectionRepo.clearCache(); events.emit("bookmarkCollections:changed", undefined); }
          if (key === "bookmarkTags") { bookmarkTagRepo.clearCache(); events.emit("bookmarkTags:changed", undefined); }
        }
      }).catch(() => {});
    });
  }

  // Attempt background auto-hydration on cold startup if local is empty
  googleSyncService.autoHydrateIfNeeded().then((hydrated) => {
    if (hydrated) {
      bookmarkRepo.invalidate();
      categoryRepo.invalidate();
      settingsRepo.invalidate();
      bookmarkGroupRepo.clearCache();
      bookmarkCollectionRepo.clearCache();
      bookmarkTagRepo.clearCache();
      events.emit("categories:changed", undefined);
      events.emit("bookmarks:changed", undefined);
      events.emit("settings:changed", undefined);
      events.emit("bookmarkGroups:changed", undefined);
      events.emit("bookmarkCollections:changed", undefined);
      events.emit("bookmarkTags:changed", undefined);
    }
  }).catch(() => {})
  // Native-sync fallback: after hydration settles, migrate existing workspace
  // folders to the "w-" convention and adopt "w-*" folders that arrived from
  // other devices via Chrome's native bookmark sync (quota-proof channel).
  .then(() => adoptNativeWorkspaceFolders.execute()).catch(() => {})
  // Native-sync fallback for collections: adopt native subfolders inside "Collections" folder
  .then(() => ensureCollectionsFolderUseCase.execute()).catch(() => {});

  // PERF-T04: page-side reconcile polling (30s interval + post-write trigger)
  // was removed — the MV3 service worker now owns catch-up convergence via its
  // top-level sync listener (instant), runtime.onStartup, and the 15-minute
  // reconcile alarm. Pages keep only the instant event-driven merge listener
  // above; manual Push/Pull buttons call pushAll()/pullAll() directly.

  const ensureShortcutsFolderUseCase = new EnsureShortcutsFolderUseCase();
  const ensureCollectionsFolderUseCase = new EnsureCollectionsFolderUseCase({ events });

  // ---- use cases ----
  const useCases = Object.freeze({
    ensureQuickieFolder: new EnsureQuickieFolderUseCase(),
    ensureShortcutsFolder: ensureShortcutsFolderUseCase,
    ensureCollectionsFolder: ensureCollectionsFolderUseCase,
    migrateBookmarkBarToQuickAccess: new MigrateBookmarkBarToQuickAccessUseCase({
      ensureShortcutsFolder: ensureShortcutsFolderUseCase,
    }),
    syncFromGoogleCloud: new SyncFromGoogleCloudUseCase({ googleSyncService, events }),

    listBookmarkCollections: new ListBookmarkCollectionsUseCase(bookmarkCollectionRepo),
    createBookmarkCollection: new CreateBookmarkCollectionUseCase({
      repository: bookmarkCollectionRepo,
      ids,
      sanitizer,
      events,
      ensureCollectionsFolder: ensureCollectionsFolderUseCase,
    }),
    updateCollectionMembers: new UpdateCollectionMembersUseCase({
      repository: bookmarkCollectionRepo,
      events,
    }),
    deleteBookmarkCollection: new DeleteBookmarkCollectionUseCase({
      repository: bookmarkCollectionRepo,
      events,
    }),
    renameBookmarkCollection: new RenameBookmarkCollectionUseCase({
      repository: bookmarkCollectionRepo,
      sanitizer,
      events,
    }),

    listBookmarks: new ListBookmarksUseCase(bookmarkRepo),
    createBookmark: new CreateBookmarkUseCase({
      bookmarkRepo,
      categoryRepo,
      ids,
      sanitizer,
      events,
    }),
    updateBookmark: new UpdateBookmarkUseCase({
      bookmarkRepo,
      sanitizer,
      events,
    }),
    deleteBookmark: new DeleteBookmarkUseCase({ bookmarkRepo, events }),
    reorderBookmarks: new ReorderBookmarksUseCase({ repo: bookmarkRepo, events }),

    listCategories: new ListCategoriesUseCase(categoryRepo),
    createCategory: new CreateCategoryUseCase({
      categoryRepo,
      bookmarkRepo,
      ids,
      sanitizer,
      events,
    }),
    renameCategory: new RenameCategoryUseCase({
      categoryRepo,
      sanitizer,
      events,
    }),
    deleteCategory: new DeleteCategoryUseCase({
      categoryRepo,
      bookmarkRepo,
      events,
    }),
    reorderCategories: new ReorderCategoriesUseCase({ repo: categoryRepo, events }),

    listSubfolders: new ListSubfoldersUseCase(subfolderRepo),
    createSubfolder: new CreateSubfolderUseCase({
      subfolderRepo,
      categoryRepo,
      bookmarkRepo,
      ids,
      sanitizer,
      events,
    }),
    updateSubfolder: new UpdateSubfolderUseCase({
      subfolderRepo,
      sanitizer,
      events,
    }),
    deleteSubfolder: new DeleteSubfolderUseCase({
      subfolderRepo,
      bookmarkRepo,
      events,
    }),

    getSettings: new GetSettingsUseCase(settingsRepo),
    saveUserSettings: new SaveUserSettingsUseCase({
      settingsRepo,
      events,
      sanitizer,
    }),

    listTasks: new ListTasksUseCase(taskRepo),
    createTask: new CreateTaskUseCase({ repo: taskRepo, taskRepo, ids, sanitizer, events }),
    updateTask: new UpdateTaskUseCase({ repo: taskRepo, taskRepo, sanitizer, events }),
    deleteTask: new DeleteTaskUseCase({ repo: taskRepo, taskRepo, events }),

    getLayout: new GetLayoutUseCase(layoutRepo),
    toggleWidgetVisibility: new ToggleWidgetVisibilityUseCase({
      layoutRepo,
      events,
    }),

    createBookmarkGroup: new CreateBookmarkGroup(bookmarkGroupRepo),
    updateBookmarkGroup: new UpdateBookmarkGroup(bookmarkGroupRepo),
    deleteBookmarkGroup: new DeleteBookmarkGroup(bookmarkGroupRepo),
    listBookmarkGroups: new ListBookmarkGroups(bookmarkGroupRepo),
    adoptNativeWorkspaceFolders,
    setActiveGroup: new SetActiveGroup(storage),

    listBookmarkTags: new ListBookmarkTagsUseCase({ tagRepo: bookmarkTagRepo }),
    setBookmarkTags: new SetBookmarkTagsUseCase({ tagRepo: bookmarkTagRepo, sanitizer, events }),

    pushBackupToGitHub: new PushBackupToGitHubUseCase({
      githubBackupService,
      storage,
      events,
    }),

  });

  return Object.freeze({
    events,
    useCases,
    // exposed for tests; presentation code never touches these
    internals: {
      storage,
      bookmarkRepo,
      categoryRepo,
      settingsRepo,
      taskRepo,
      layoutRepo,
      subfolderRepo,
      bookmarkGroupRepo,
      bookmarkTagRepo,
      bookmarkCollectionRepo,
      clock,
      ids,
      sanitizer,
      autoBackupService,
      githubBackupService,
      googleSyncService,
    },
  });
}
