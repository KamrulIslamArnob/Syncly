import { el } from "../../shared/dom.js";
import { icon } from "../../shared/icons.js";
import { initial, websiteFaviconUrl, websitePreviewUrl } from "../../shared/favicon.js";
import { buildBookmarkTree, isSafeUrl, countLeaves } from "./TreeView.js";
import { GroupProfileButtonsView } from "./GroupProfileButtonsView.js";
import { GroupDialogView } from "./GroupDialogView.js";
import { NewFolderDialogView } from "./NewFolderDialogView.js";
import { CollectionDialogView } from "./CollectionDialogView.js";
import { ConfirmDialogView } from "./ConfirmDialogView.js";
import { BookmarkTagsDialogView } from "./BookmarkTagsDialogView.js";
import { BookmarkPickerModalView } from "./BookmarkPickerModalView.js";
import { CategoryDialogView } from "./CategoryDialogView.js";
import { ShortcutDialogView } from "./ShortcutDialogView.js";
import { ProfileDialogView } from "./ProfileDialogView.js";
import { CombinedClockView } from "./CombinedClockView.js";
import { GreetingView } from "./GreetingView.js";
import { getThumbGradient, getFolderColor } from "../../shared/colorHash.js";
import { OmniSearchIndex } from "../../../domain/services/OmniSearchIndex.js";

/* ============================================================
   BookmarkDeckView — the entire new-tab page.

   Two-pane workspace over the user's REAL chrome.bookmarks (not the
   app's old curated-shortcuts domain model): a sidebar (workspace
   switcher + smart filters + collections/bookmarks tree) and a main pane
   (search/tag bar + responsive card grid). Replaces the old widget
   dashboard entirely — see CLAUDE.md for what got dropped.
   ============================================================ */

const USAGE_KEY = "bookmarkUsage";
const LAST_KEY = "bookmarkLastOpened";
const FOLDER_COLORS_KEY = "bookmarkFolderColors";
const FREQ_MAX = 12;

const PALETTE_COLORS = [
  "#D2683F",
  "#E64A19",
  "#EF4444",
  "#EC4899",
  "#D946EF",
  "#8B5CF6",
  "#6366F1",
  "#3B82F6",
  "#06B6D4",
  "#10B981",
  "#7E9B76",
  "#84CC16",
  "#EAB308",
  "#F59E0B",
  "#E0A33E",
  "#A8A29E",
  "#8A919C",
  "#E8EAEE",
];

// In-memory cache for screenshot preview statuses with bounded FIFO eviction to prevent memory leak
const MAX_CACHE_SIZE = 150;
const previewSuccessCache = new Set();
const previewFailedCache = new Set();

function addBoundedCache(set, item) {
  if (set.size >= MAX_CACHE_SIZE) {
    const first = set.values().next().value;
    if (first !== undefined) set.delete(first);
  }
  set.add(item);
}

class PreviewQueue {
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  add(coverEl, previewUrl) {
    if (!previewUrl || previewFailedCache.has(previewUrl)) return;
    this.queue.push({ coverEl, previewUrl });
    this.next();
  }

  next() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item || !item.coverEl.isConnected) continue;
      this.running++;
      this.load(item);
    }
  }

  load({ coverEl, previewUrl }) {
    if (!coverEl.isConnected) {
      this.running--;
      this.next();
      return;
    }

    const previewImg = el("img", {
      className: "raindrop-card-preview",
      src: previewUrl,
      alt: "",
      decoding: "async",
    });

    const done = () => {
      this.running--;
      this.next();
    };

    if (previewSuccessCache.has(previewUrl)) {
      previewImg.classList.add("is-loaded");
      coverEl.appendChild(previewImg);
      done();
    } else {
      previewImg.addEventListener("load", () => {
        addBoundedCache(previewSuccessCache, previewUrl);
        previewImg.classList.add("is-loaded");
        done();
      });
      previewImg.addEventListener("error", () => {
        addBoundedCache(previewFailedCache, previewUrl);
        previewImg.remove();
        done();
      });
      coverEl.appendChild(previewImg);
    }
  }

  clear() {
    this.queue = [];
    this.running = 0;
  }
}

const previewQueue = new PreviewQueue(2);

// Re-exported for callers/tests that imported these from this module
// before the color-hash helpers moved to shared/colorHash.js.
export { getThumbGradient, getFolderColor };

/** Extract clean hostname without www from a URL string */
export function cleanDomain(url) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

/** Flatten every bookmark leaf into {id,title,url,parentId,path}. `path`
 *  is the chain of ancestor folder titles (nearest last), used for the
 *  card breadcrumb chip. */
export function flattenLeaves(nodes, out = [], path = []) {
  for (const n of nodes) {
    if (n.type === "bookmark") {
      if (n.url) out.push({ id: n.id, title: n.title, url: n.url, parentId: n.parentId ?? null, path });
    } else {
      flattenLeaves(n.children, out, [...path, n.title]);
    }
  }
  return out;
}

/**
 * Board folders = the folders directly under the named roots
 * ("Bookmarks Bar", …), plus a per-root block for loose bookmarks
 * sitting directly in a root.
 */
export function collectFolders(roots) {
  const folders = [];
  for (const root of roots) {
    const loose = [];
    for (const child of root.children) {
      if (child.type === "folder") folders.push(child);
      else loose.push(child);
    }
    if (loose.length) {
      folders.push({ id: `loose:${root.id}`, title: root.title, type: "folder", children: loose, count: loose.length });
    }
  }
  return folders;
}

/** Rank a pool of leaves by usage count (descending), top `max`. */
export function rankByUsage(pool, usage, max = FREQ_MAX) {
  return [...pool]
    .sort((a, b) => (usage[b.id] || 0) - (usage[a.id] || 0))
    .slice(0, max);
}

/** Resolve collection member bookmark leaves against the full leaf map. */
export function resolveCollectionLeaves(bookmarkIds, leafIndex) {
  if (!Array.isArray(bookmarkIds) || !leafIndex) return [];
  return bookmarkIds.map((id) => leafIndex.get(id)).filter(Boolean);
}

/** Find a folder node anywhere in the tree by native id. */
function findFolderById(nodes, id) {
  for (const n of nodes) {
    if (n.type === "folder" && n.id === id) return n;
    if (n.children) {
      const found = findFolderById(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

function createGrainOverlay() {
  const wrap = el("div", {
    className: "focus-aura-grain",
    "aria-hidden": "true",
  });
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("aria-hidden", "true");

  const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
  filter.setAttribute("id", "grain");

  const feTurbulence = document.createElementNS("http://www.w3.org/2000/svg", "feTurbulence");
  feTurbulence.setAttribute("type", "fractalNoise");
  feTurbulence.setAttribute("baseFrequency", "0.7");
  feTurbulence.setAttribute("numOctaves", "4");
  feTurbulence.setAttribute("stitchTiles", "stitch");

  const feColorMatrix = document.createElementNS("http://www.w3.org/2000/svg", "feColorMatrix");
  feColorMatrix.setAttribute("type", "matrix");
  feColorMatrix.setAttribute("values", "0.181 0.608 0.061 0 0.075 0.181 0.608 0.061 0 0.075 0.181 0.608 0.061 0 0.075 0 0 0 1 0");

  filter.append(feTurbulence, feColorMatrix);

  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("width", "100%");
  rect.setAttribute("height", "100%");
  rect.setAttribute("filter", "url(#grain)");

  svg.append(filter, rect);
  wrap.appendChild(svg);
  return wrap;
}

export class BookmarkDeckView {
  constructor({ getTree, toast, storage, useCases, events, onOpenSettings, getColorMode, setColorMode } = {}) {
    this.getTree = typeof getTree === "function" ? getTree : () => Promise.resolve([]);
    this.toast = toast;
    this.storage = storage || null;
    this.useCases = useCases || null;
    this.events = events || null;
    this.onOpenSettings = typeof onOpenSettings === "function" ? onOpenSettings : null;
    this.getColorMode = typeof getColorMode === "function" ? getColorMode : () => "dark";
    this.setColorMode = typeof setColorMode === "function" ? setColorMode : () => {};

    this._roots = [];
    this._folders = [];
    this._leaves = [];
    this._unscopedLeaves = [];
    this._leafIndex = new Map();
    this._quickieFolderId = null;
    this._shortcutsFolderId = null;
    this._quickieLeaves = [];
    this._collections = [];
    this._collectionsExpanded = false;
    this._folderColors = {};
    this._activeColorPopover = null;
    this._tags = {};
    this._usage = {};
    this._query = "";
    this._viewMode = "compact"; // "compact" | "list" | "grid" (defaults to compact density)
    this._settings = null;
    this._previewObserver = null;
    this._activeSelection = { type: "all" }; // { type: "all" | "quickie" | "collections" | "collection" | "folder", id, title }
    this._activeTag = null;
    this._expandedFolders = new Set();
    this._drag = null; // { id, parentId } of the bookmark card currently being dragged
    this._selectMode = false;
    this._selectedIds = new Set();
    this._escHandler = null;
    this._keyHandler = null;
    this._docClickHandler = null;
    this._bookmarkEventNames = [];
    this._bookmarkEventHandler = null;
    this._unsubEvents = [];

    this.groupButtons = new GroupProfileButtonsView({
      useCases,
      events,
      toast,
      onCollapse: () => this.toggleSidebar(),
    });
    this.groupButtons.setOnGroupSelect(() => this._load());
    this.groupButtons.setOnGroupCreate((group) => {
      if (group) this.groupDialog.openForEdit(group);
      else this.groupDialog.openForCreate();
    });

    this.profileDialog = new ProfileDialogView({ useCases, toast: this.toast, events: this.events });

    this.groupDialog = new GroupDialogView({ useCases, getTree: this.getTree, toast });
    this.groupDialog.onSave = () => this._load();
    this.groupDialog.onDelete = () => this._load();

    this.newFolderDialog = new NewFolderDialogView({ getTree: this.getTree, toast: this.toast });
    this.newFolderDialog.onCreate = () => this._load();

    this.collectionDialog = new CollectionDialogView({ useCases, toast: this.toast });
    this.confirmDialog = new ConfirmDialogView({ toast: this.toast });
    this.tagsDialog = new BookmarkTagsDialogView({ useCases, toast: this.toast });
    this.bookmarkPicker = new BookmarkPickerModalView({ useCases, toast: this.toast });
    this.categoryDialog = new CategoryDialogView({ useCases, toast: this.toast });
    this.shortcutDialog = new ShortcutDialogView({ useCases, toast: this.toast });

    this._categories = [];
    this._shortcuts = [];
    this._activeCategoryId = null;
    this._activeContextMenu = null;
    this._searchIndex = new OmniSearchIndex();

    this._greetingView = new GreetingView({
      useCases,
      clock: { now: () => new Date() },
    });

    this._clockView = new CombinedClockView({
      clock: { now: () => new Date() },
    });

    let storedLayoutStyle = "standard"; // "standard" | "focus" (clock + centered search + shortcuts + bottom bookmarks)
    try {
      const val = localStorage.getItem("neptab_home_layout_style");
      if (val) storedLayoutStyle = val;
    } catch {}
    this._layoutStyle = storedLayoutStyle;

    if (this._layoutStyle === "standard") {
      this._sidebarCollapsed = false;
      this._allBookmarksCollapsed = false;
    } else {
      let storedSidebar = true;
      try {
        const val = localStorage.getItem("neptab_sidebar_collapsed");
        if (val !== null) storedSidebar = val === "true";
      } catch {}
      this._sidebarCollapsed = storedSidebar;

      let storedAllBookmarks = true;
      try {
        const val = localStorage.getItem("neptab_all_bookmarks_collapsed");
        if (val !== null) storedAllBookmarks = val === "true";
      } catch {}
      this._allBookmarksCollapsed = storedAllBookmarks;
    }

    if (this.events) {
      this._unsubEvents.push(
        this.events.on("categories:changed", () => this._load()),
        this.events.on("bookmarks:changed", () => this._load()),
        this.events.on("bookmarkCollections:changed", () => this._load()),
        this.events.on("bookmarkTags:changed", () => this._load()),
        this.events.on("settings:changed", (newSettings) => {
          const oldSettings = this._settings;
          if (newSettings) {
            this._settings = newSettings;
          }

          if (this._sidebarFooter) {
            const mode = this.getColorMode();
            const darkBtn = this._sidebarFooter.querySelector(".raindrop-sidebar-theme-btn[data-theme='dark']");
            const lightBtn = this._sidebarFooter.querySelector(".raindrop-sidebar-theme-btn[data-theme='light']");
            if (darkBtn) darkBtn.classList.toggle("is-active", mode === "dark");
            if (lightBtn) lightBtn.classList.toggle("is-active", mode === "light");
          }

          if (this._header) {
            const mode = this.getColorMode();
            const isDark = mode === "dark";
            const themeBtn = this._header.querySelector(".raindrop-theme-toggle-btn");
            if (themeBtn) {
              themeBtn.title = isDark ? "Switch to Light mode" : "Switch to Dark mode";
              themeBtn.setAttribute("aria-label", themeBtn.title);
              themeBtn.replaceChildren(icon(isDark ? "sun" : "moon", "theme-btn-icon"));
            }
          }

          const nameChanged = oldSettings && newSettings && (oldSettings.name !== newSettings.name || oldSettings.messageText !== newSettings.messageText);
          const previewsChanged = oldSettings && newSettings && (oldSettings.showWebsitePreviews !== newSettings.showWebsitePreviews);

          if (nameChanged || previewsChanged) {
            this._renderContent();
          }
        })
      );
    }
  }

  toggleSidebar(forceState = null) {
    this._sidebarCollapsed = forceState !== null ? forceState : !this._sidebarCollapsed;
    try { localStorage.setItem("neptab_sidebar_collapsed", String(this._sidebarCollapsed)); } catch {}
    if (this.root) {
      this.root.classList.toggle("is-sidebar-collapsed", this._sidebarCollapsed);
    }
    this._renderHeader();
  }

  renderInto(stage) {
    this.stage = stage;
    this.root = el("div", {
      className: "raindrop-dashboard" + (this._sidebarCollapsed ? " is-sidebar-collapsed" : "") + (this._layoutStyle === "focus" ? " is-focus-mode" : ""),
      role: "region",
      "aria-label": "Bookmark Dashboard",
    });

    this._sidebar = el("aside", { className: "raindrop-sidebar", "aria-label": "Collections Navigation" });
    this._workspaceSlot = el("div", { className: "raindrop-workspace-slot" });
    this._sidebarBody = el("div", { className: "raindrop-sidebar-body" });
    this._sidebarTags = el("div", { className: "raindrop-sidebar-tags" });
    this._sidebarFooter = el("div", { className: "raindrop-sidebar-footer" });
    this._sidebar.append(this._workspaceSlot, this._sidebarBody, this._sidebarTags, this._sidebarFooter);

    this._main = el("main", { className: "raindrop-main" });
    this._header = el("header", { className: "raindrop-header" });
    this._content = el("div", { className: "raindrop-content" });
    this._main.append(this._header, this._content);

    this._auraLayer1 = el("div", { className: "focus-aura-layer focus-aura-1", "aria-hidden": "true" });
    this._auraLayer2 = el("div", { className: "focus-aura-layer focus-aura-2", "aria-hidden": "true" });
    this._auraLayer3 = el("div", { className: "focus-aura-layer focus-aura-3", "aria-hidden": "true" });
    this._auraGrain = createGrainOverlay();

    this.root.append(this._auraLayer1, this._auraLayer2, this._auraLayer3, this._auraGrain, this._sidebar, this._main);
    stage.replaceChildren(this.root);

    this._bindKeys();
    this._bindBookmarkEvents();
    this._load();
  }

  async _load() {
    const [raw, quickieId, shortcutsFolderId, collections, , usage, tags, settings, folderColors] = await Promise.all([
      this.getTree().catch(() => []),
      this.useCases?.ensureQuickieFolder ? this.useCases.ensureQuickieFolder.execute().catch(() => null) : Promise.resolve(null),
      this.useCases?.ensureShortcutsFolder ? this.useCases.ensureShortcutsFolder.execute().catch(() => null) : Promise.resolve(null),
      this.useCases?.listBookmarkCollections ? this.useCases.listBookmarkCollections.execute().catch(() => []) : Promise.resolve([]),
      this.groupButtons.loadState().catch(() => null),
      this.storage ? this.storage.get([USAGE_KEY, LAST_KEY]).then((d) => d?.[USAGE_KEY] || {}).catch(() => ({})) : Promise.resolve({}),
      this.useCases?.listBookmarkTags ? this.useCases.listBookmarkTags.execute().catch(() => ({})) : Promise.resolve({}),
      this.useCases?.getSettings ? this.useCases.getSettings.execute().catch(() => null) : Promise.resolve(null),
      this.storage ? this.storage.get(FOLDER_COLORS_KEY).then((d) => d?.[FOLDER_COLORS_KEY] || {}).catch(() => ({})) : Promise.resolve({}),
    ]);

    this._shortcutsFolderId = shortcutsFolderId || this._shortcutsFolderId;

    // Sync CategoryDialog/ShortcutDialog to native folder
    if (this.categoryDialog) this.categoryDialog.setShortcutsFolderId?.(this._shortcutsFolderId);
    if (this.shortcutDialog) this.shortcutDialog.setShortcutsFolderId?.(this._shortcutsFolderId);

    this._quickieFolderId = quickieId;
    this._collections = collections || [];
    this._usage = usage || {};
    this._tags = tags || {};
    this._settings = settings || null;
    this._folderColors = folderColors || {};

    this._roots = buildBookmarkTree(raw || [], { pruneEmpty: false });

    // Derive categories & shortcuts from native Shortcuts folder (All Bookmarks → Shortcuts)
    let _cats = [];
    let _shortcuts = [];
    if (this._shortcutsFolderId) {
      const shortcutsNode = findFolderById(this._roots, this._shortcutsFolderId);
      if (shortcutsNode && Array.isArray(shortcutsNode.children)) {
        for (let i = 0; i < shortcutsNode.children.length; i++) {
          const child = shortcutsNode.children[i];
          if (child.type === "folder") {
            _cats.push({ id: { value: child.id }, name: child.title, order: i, nativeId: child.id });
            for (const leaf of child.children || []) {
              if (leaf.type === "bookmark" && leaf.url) {
                _shortcuts.push({
                  id: { value: leaf.id },
                  title: leaf.title,
                  url: { href: leaf.url, raw: leaf.url },
                  categoryId: { value: child.id },
                  order: 0,
                  faviconUrl: "",
                });
              }
            }
          }
        }
      }
    }
    if (_cats.length === 0 && this._shortcutsFolderId && typeof chrome !== "undefined" && chrome.bookmarks) {
      try {
        const gen = await chrome.bookmarks.create({ parentId: this._shortcutsFolderId, title: "General" });
        _cats = [{ id: { value: gen.id }, name: gen.title, order: 0, nativeId: gen.id }];
        // Rebuild roots to include new folder for immediate render
        this._roots = buildBookmarkTree(await this.getTree().catch(() => []), { pruneEmpty: false });
      } catch {}
    }
    this._categories = _cats;
    this._shortcuts = _shortcuts;
    if (!this._activeCategoryId || !this._categories.some((c) => (c.id?.value || c.id) === this._activeCategoryId)) {
      this._activeCategoryId = this._categories[0] ? (this._categories[0].id?.value || this._categories[0].id) : null;
    }

    const bookmarkBarRoot = this._roots.find((r) => r.id === "1" || /bookmarks bar|favorites bar/i.test(r.title)) || this._roots[0];
    const defaultRoots = bookmarkBarRoot ? [bookmarkBarRoot] : this._roots;
    
    // Index leaves across the ENTIRE bookmark library so collections/searches can resolve any bookmark
    this._unscopedLeaves = flattenLeaves(collectFolders(this._roots));
    this._leafIndex = new Map(this._unscopedLeaves.map((l) => [l.id, l]));

    if (!this._quickieFolderId) {
      const qFolder = this._roots.flatMap((r) => r.children || []).find((c) => c.type === "folder" && c.title === "Quickie");
      if (qFolder) this._quickieFolderId = qFolder.id;
    }

    const quickieFolder = this._quickieFolderId ? findFolderById(this._roots, this._quickieFolderId) : null;
    this._quickieLeaves = quickieFolder ? flattenLeaves(quickieFolder.children || []) : [];

    // Auto-cleanup orphan workspaces whose native folder was manually deleted via chrome://bookmarks
    // If all folderIds of a workspace are gone, the workspace info is gone — delete the workspace.
    try {
      const allGroups = this.groupButtons.groups ? [...this.groupButtons.groups] : [];
      let needReload = false;
      for (const g of allGroups) {
        if (!g.folderIds || g.folderIds.length === 0) continue;
        const missing = g.folderIds.filter((id) => !findFolderById(this._roots, id));
        if (missing.length === 0) continue;
        if (missing.length === g.folderIds.length) {
          await this.useCases.deleteBookmarkGroup.execute(g.id).catch(() => {});
          needReload = true;
        } else {
          const remaining = g.folderIds.filter((id) => findFolderById(this._roots, id));
          try { await this.useCases.updateBookmarkGroup.execute({ id: g.id, folderIds: remaining }); } catch {}
          needReload = true;
        }
      }
      if (needReload) {
        await this.groupButtons.loadState().catch(() => {});
        // If active was deleted, clear active
        const stillExists = this.groupButtons.groups.some((g) => g.id === this.groupButtons.activeGroupId);
        if (!stillExists && this.groupButtons.activeGroupId) {
          await this.useCases.setActiveGroup.execute(null).catch(() => {});
          await this.groupButtons.loadState().catch(() => {});
        }
      }
    } catch {}

    if (this._workspaceSlot) {
      const switcherEl = await this.groupButtons.render();
      this._workspaceSlot.replaceChildren(switcherEl);
    }
    const activeGroup = this.groupButtons.activeGroup;

    if (activeGroup && Array.isArray(activeGroup.folderIds) && activeGroup.folderIds.length > 0) {
      // Find each assigned folder or root workspace folder — skip central Quickie (never workspace-scoped)
      const groupFolders = [];
      for (const id of activeGroup.folderIds) {
        if (id === this._quickieFolderId) continue;
        const found = findFolderById(this._roots, id);
        if (found) {
          if (found.title === "Quickie") continue;
          // If this is a dedicated workspace root folder, show its subfolders and loose bookmarks
          if (Array.isArray(found.children) && found.children.length > 0) {
            const loose = [];
            for (const child of found.children) {
              if (child.type === "folder") {
                if (child.title === "Quickie" || child.id === this._quickieFolderId) continue;
                groupFolders.push(child);
              } else loose.push(child);
            }
            if (loose.length) {
              groupFolders.unshift({
                id: `loose:${found.id}`,
                title: found.title || activeGroup.name,
                type: "folder",
                children: loose,
                count: loose.length,
              });
            }
          } else {
            groupFolders.push(found);
          }
        }
      }
      this._folders = groupFolders;
    } else {
      this._folders = collectFolders(defaultRoots);
      // Exclude central Quickie from All Bookmarks folder tree (pinned as quick access instead)
      this._folders = this._folders.filter((f) => f.title !== "Quickie" && f.id !== this._quickieFolderId);
    }
    // Final dedupe: ensure no Quickie folder sneaks into tree via duplicate names
    this._folders = this._folders.filter((f) => f.title !== "Quickie" && f.id !== this._quickieFolderId);
    this._leaves = flattenLeaves(this._folders);

    const visibleCollections = this._getVisibleCollections();
    if (this._activeSelection.type === "collection" && !visibleCollections.some((c) => c.id === this._activeSelection.id)) {
      this._activeSelection = { type: "all" };
    }

    this._searchIndex.index({
      shortcuts: this._shortcuts,
      categories: this._categories,
      bookmarks: this._unscopedLeaves,
      tags: this._tags,
    });

    this._renderSidebar();
    this._renderHeader();
    this._renderContent();
  }

  _getVisibleCollections() {
    const activeGroup = this.groupButtons?.activeGroup;
    if (!activeGroup) return this._collections || [];
    return (this._collections || []).filter((c) => c.workspaceId === activeGroup.id);
  }

  _getFolderColor(node) {
    if (this._folderColors && node?.id && this._folderColors[node.id]) {
      return this._folderColors[node.id];
    }
    return getFolderColor((node?.title || "") + (node?.id || ""));
  }

  async _saveFolderColor(folderId, color) {
    if (!folderId) return;
    if (color) {
      this._folderColors[folderId] = color;
    } else {
      delete this._folderColors[folderId];
    }
    if (this.storage) {
      try {
        await this.storage.set({ [FOLDER_COLORS_KEY]: this._folderColors });
      } catch (err) {
        console.warn("Failed to save folder color:", err);
      }
    }
  }

  _bindBookmarkEvents() {
    if (typeof chrome === "undefined" || !chrome.bookmarks || this._bookmarkEventHandler) return;

    this._bookmarkEventHandler = () => {
      this._load();
    };

    this._bookmarkEventNames = [
      "onCreated",
      "onRemoved",
      "onChanged",
      "onMoved",
      "onChildrenReordered",
      "onImportEnded",
    ];

    for (const evt of this._bookmarkEventNames) {
      if (chrome.bookmarks[evt] && typeof chrome.bookmarks[evt].addListener === "function") {
        chrome.bookmarks[evt].addListener(this._bookmarkEventHandler);
      }
    }
  }

  _unbindBookmarkEvents() {
    if (!this._bookmarkEventHandler || typeof chrome === "undefined" || !chrome.bookmarks) return;
    for (const evt of this._bookmarkEventNames) {
      if (chrome.bookmarks[evt] && typeof chrome.bookmarks[evt].removeListener === "function") {
        chrome.bookmarks[evt].removeListener(this._bookmarkEventHandler);
      }
    }
    this._bookmarkEventHandler = null;
  }

  _openColorPicker(anchorEl, folder) {
    if (this._activeColorPopover) {
      this._activeColorPopover.remove();
      this._activeColorPopover = null;
    }

    const popover = el("div", { className: "raindrop-color-popover" });
    const current = this._getFolderColor(folder);

    for (const color of PALETTE_COLORS) {
      const dot = el("button", {
        type: "button",
        className: "raindrop-color-dot" + (current === color ? " is-active" : ""),
        style: `background: ${color};`,
        title: color,
        "aria-label": `Set color ${color}`,
      });
      dot.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this._saveFolderColor(folder.id, color);
        popover.remove();
        this._activeColorPopover = null;
        this._renderSidebar();
        this._renderContent();
      });
      popover.appendChild(dot);
    }

    const resetBtn = el("button", {
      type: "button",
      className: "raindrop-color-reset",
      title: "Reset to default color",
    }, "Auto");
    resetBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await this._saveFolderColor(folder.id, null);
      popover.remove();
      this._activeColorPopover = null;
      this._renderSidebar();
      this._renderContent();
    });
    popover.appendChild(resetBtn);

    document.body.appendChild(popover);
    this._activeColorPopover = popover;

    const rect = anchorEl.getBoundingClientRect();
    popover.style.left = `${Math.min(window.innerWidth - 200, rect.left)}px`;
    popover.style.top = `${rect.bottom + 4}px`;

    const closeHandler = (e) => {
      if (!popover.contains(e.target) && e.target !== anchorEl) {
        popover.remove();
        this._activeColorPopover = null;
        document.removeEventListener("pointerdown", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("pointerdown", closeHandler), 0);
  }

  async _loadUsage() {
    if (!this.storage) { this._usage = {}; return; }
    try {
      const data = await this.storage.get([USAGE_KEY, LAST_KEY]);
      this._usage = data?.[USAGE_KEY] || {};
    } catch {
      this._usage = {};
    }
  }

  async _loadTags() {
    if (!this.useCases?.listBookmarkTags) { this._tags = {}; return; }
    try {
      this._tags = await this.useCases.listBookmarkTags.execute();
    } catch {
      this._tags = {};
    }
  }

  async _recordOpen(bookmark) {
    this._usage[bookmark.id] = (this._usage[bookmark.id] || 0) + 1;
    if (this.storage) {
      try { await this.storage.set({ [USAGE_KEY]: this._usage, [LAST_KEY]: { title: bookmark.title, ts: Date.now() } }); } catch {}
    }
  }

  _open(bookmark, newTab) {
    if (!bookmark || !bookmark.url) return;
    this._recordOpen(bookmark);
    if (newTab) window.open(bookmark.url, "_blank", "noopener");
    else window.location.assign(bookmark.url);
  }

  /* ── Bookmark tag editing (modal dialog) ── */
  _editTags(bookmark) {
    if (!this.useCases?.setBookmarkTags || !bookmark) return;
    const current = this._tags[bookmark.id] || [];
    this.tagsDialog.open(bookmark, {
      currentTags: current,
      onSuccess: () => this._load(),
    });
  }

  /** Wire an element (tree row, quickbar tile) as a drop target that
   *  moves the currently-dragged card into native folder `folderId`.
   *  Cross-collection move only — reorder-in-place is handled by the
   *  cards themselves in _renderCard. */
  _bindFolderDropTarget(node, folderId) {
    node.addEventListener("dragover", (e) => {
      if (!this._drag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      node.classList.add("is-drop-target");
    });
    node.addEventListener("dragleave", () => node.classList.remove("is-drop-target"));
    node.addEventListener("drop", async (e) => {
      e.preventDefault();
      node.classList.remove("is-drop-target");
      const drag = this._drag;
      if (!drag) return;
      try {
        await chrome.bookmarks.move(drag.id, { parentId: folderId });
        this.toast?.show("Bookmark moved");
      } catch (err) {
        this.toast?.show(err.message || "Could not move bookmark", { error: true });
      }
    });
  }

  _bindCollectionDropTarget(node, collectionId) {
    node.addEventListener("dragover", (e) => {
      if (!this._drag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      node.classList.add("is-drop-target");
    });
    node.addEventListener("dragleave", () => node.classList.remove("is-drop-target"));
    node.addEventListener("drop", async (e) => {
      e.preventDefault();
      node.classList.remove("is-drop-target");
      const drag = this._drag;
      if (!drag) return;
      try {
        await this.useCases.updateCollectionMembers.execute({
          collectionId,
          add: [drag.id],
        });
        this.toast?.show("Added bookmark to collection");
        await this._load();
      } catch (err) {
        this.toast?.show(err.message || "Could not add to collection", { error: true });
      }
    });
  }

  _getActiveCollection() {
    if (this._activeSelection.type === "collection") {
      return this._collections.find((c) => c.id === this._activeSelection.id) || null;
    }
    return null;
  }

  _openBookmarkPicker(target = null) {
    let finalTarget = target || this._getActiveCollection();
    if (!finalTarget) {
      if (this._activeSelection.type === "folder" && this._activeSelection.folder) {
        finalTarget = {
          id: this._activeSelection.id.startsWith("loose:") ? this._activeSelection.id.replace("loose:", "") : this._activeSelection.id,
          title: this._activeSelection.title,
          isFolder: true,
        };
      } else {
        const activeGroup = this.groupButtons.activeGroup;
        if (activeGroup && activeGroup.folderIds?.[0]) {
          finalTarget = {
            id: activeGroup.folderIds[0],
            title: activeGroup.name,
            isFolder: true,
          };
        }
      }
    }
    if (!finalTarget) return;
    this.bookmarkPicker.open(finalTarget, this._unscopedLeaves, {
      onSuccess: () => this._load(),
    });
  }

  /* ── 1. Left Sidebar Rendering ───────────────────────────── */
  _renderSidebar() {
    this._sidebarBody.replaceChildren();

    const activeGroup = this.groupButtons.activeGroup;
    const isGlobalMode = !activeGroup;

    const quickSection = el("div", { className: "raindrop-quick-access" });
    const allLabel = isGlobalMode ? "Home" : `${activeGroup.name}`;
    const allItem = this._renderQuickItem("all", isGlobalMode ? icon("home") : icon(activeGroup.icon || "folder"), allLabel, this._leaves.length);
    quickSection.append(allItem);

    // Quickie is always available across all workspaces
    const quickieItem = this._renderQuickItem("quickie", icon("inbox"), "Quickie", this._quickieLeaves.length);
    if (this._quickieFolderId) {
      this._bindFolderDropTarget(quickieItem, this._quickieFolderId);
    }

    // Collections: in global mode shows all collections, in workspace mode shows workspace-specific collections
    const visibleCollections = this._getVisibleCollections();
    const collectionsItem = this._renderQuickItem("collections", icon("layers"), "Collections", visibleCollections.length);
    collectionsItem.addEventListener("dblclick", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._collectionsExpanded = !this._collectionsExpanded;
      this._renderSidebar();
    });
    quickSection.append(quickieItem, collectionsItem);

    const isCollectionsOpen = (this._activeSelection.type === "collections" || this._activeSelection.type === "collection") && this._collectionsExpanded;
    if (visibleCollections.length > 0 && isCollectionsOpen) {
      const collSubWrap = el("div", { className: "raindrop-coll-sub-list" });
      for (const coll of visibleCollections) {
        const isCollActive = this._activeSelection.type === "collection" && this._activeSelection.id === coll.id;
        const leaves = resolveCollectionLeaves(coll.bookmarkIds, this._leafIndex);
        const collRow = el("button", {
          type: "button",
          className: "raindrop-nav-row raindrop-coll-sub-row" + (isCollActive ? " is-active" : ""),
          title: `${coll.name} (${leaves.length})`,
        },
          el("span", { className: "raindrop-coll-sub-bullet" }, "•"),
          el("span", { className: "raindrop-nav-label" }, coll.name),
          el("span", { className: "raindrop-nav-count" }, String(leaves.length))
        );
        collRow.addEventListener("click", () => {
          this._collectionsExpanded = true;
          this._activeSelection = { type: "collection", id: coll.id, title: coll.name };
          this._activeTag = null;
          this._renderSidebar();
          this._renderHeader();
          this._renderContent();
        });
        this._bindCollectionDropTarget(collRow, coll.id);
        collSubWrap.appendChild(collRow);
      }
      quickSection.appendChild(collSubWrap);
    }

    const addFolderBtn = el("button", {
      type: "button",
      className: "raindrop-add-col-btn",
      title: isGlobalMode ? "Add Folder" : `Add Folder to ${activeGroup.name}`,
      "aria-label": isGlobalMode ? "Add Folder" : `Add Folder to ${activeGroup.name}`,
    }, icon("plus"));
    addFolderBtn.addEventListener("click", () => this._promptCreateFolder());

    const sectionTitleText = isGlobalMode ? "BOOKMARKS" : `${activeGroup.name} / FOLDERS`;
    const sectionHeader = el("div", { className: "raindrop-section-header" },
      el("span", { className: "raindrop-section-title" }, sectionTitleText),
      addFolderBtn
    );

    const treeContainer = el("div", { className: "raindrop-tree-container" });
    if (this._folders.length > 0) {
      for (const folder of this._folders) {
        treeContainer.appendChild(this._renderTreeNode(folder, 0));
      }
    }

    this._sidebarBody.append(quickSection, sectionHeader, treeContainer);
    this._renderSidebarTags();
    this._renderSidebarFooter();
  }

  _renderSidebarTags() {
    if (!this._sidebarTags) return;
    this._sidebarTags.replaceChildren();

    const counts = new Map();
    const targetLeaves = this._activeSelection.type === "quickie"
      ? this._quickieLeaves
      : (this._unscopedLeaves.length > 0 ? this._unscopedLeaves : this._leaves);

    for (const leaf of targetLeaves) {
      for (const tag of this._tags[leaf.id] || []) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }

    const tagEntries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (tagEntries.length === 0) {
      this._sidebarTags.style.display = "none";
      return;
    }
    this._sidebarTags.style.display = "";

    const tagList = el("div", { className: "sidebar-tags-list" });

    // #all chip
    const allChip = el("button", {
      type: "button",
      className: "sidebar-tag-chip" + (this._activeTag ? "" : " is-active"),
      title: "Show all tags",
    },
      el("span", { className: "sidebar-tag-hash" }, "#"),
      el("span", { className: "sidebar-tag-name" }, "all")
    );
    allChip.addEventListener("click", () => {
      this._activeTag = null;
      this._renderSidebarTags();
      this._renderContent();
    });
    tagList.appendChild(allChip);

    for (const [tag, count] of tagEntries) {
      const isSelected = this._activeTag === tag;
      const chip = el("button", {
        type: "button",
        className: "sidebar-tag-chip" + (isSelected ? " is-active" : ""),
        title: `${count} bookmark${count === 1 ? "" : "s"} with #${tag}`,
      },
        el("span", { className: "sidebar-tag-hash" }, "#"),
        el("span", { className: "sidebar-tag-name" }, tag)
      );
      chip.addEventListener("click", () => {
        this._activeTag = isSelected ? null : tag;
        this._renderSidebarTags();
        this._renderContent();
      });
      tagList.appendChild(chip);
    }

    this._sidebarTags.appendChild(tagList);
  }

  _renderSidebarFooter() {
    if (!this._sidebarFooter) return;
    this._sidebarFooter.replaceChildren();

    const settingsBtn = el("button", {
      type: "button",
      className: "raindrop-sidebar-settings-btn",
      title: "Settings",
      "aria-label": "Settings",
    }, icon("settings"), el("span", { className: "raindrop-sidebar-settings-label" }, "Settings"));
    settingsBtn.addEventListener("click", () => this.onOpenSettings?.());

    const mode = this.getColorMode();
    const darkBtn = el("button", {
      type: "button",
      className: "raindrop-sidebar-theme-btn" + (mode === "dark" ? " is-active" : ""),
      title: "Dark mode",
      "data-theme": "dark",
      "aria-label": "Dark mode",
    }, icon("moon"));

    const lightBtn = el("button", {
      type: "button",
      className: "raindrop-sidebar-theme-btn" + (mode === "light" ? " is-active" : ""),
      title: "Light mode",
      "data-theme": "light",
      "aria-label": "Light mode",
    }, icon("sun"));

    darkBtn.addEventListener("click", () => {
      darkBtn.classList.add("is-active");
      lightBtn.classList.remove("is-active");
      this.setColorMode("dark");
    });
    lightBtn.addEventListener("click", () => {
      lightBtn.classList.add("is-active");
      darkBtn.classList.remove("is-active");
      this.setColorMode("light");
    });

    const themeToggle = el("div", { className: "raindrop-sidebar-theme-toggle" }, darkBtn, lightBtn);

    const collapseBtn = el("button", {
      type: "button",
      className: "raindrop-sidebar-footer-collapse-btn",
      title: "Collapse sidebar ([)",
      "aria-label": "Collapse sidebar",
    }, icon("sidebarClose"));
    collapseBtn.addEventListener("click", () => this.toggleSidebar(true));

    const rightGroup = el("div", { className: "raindrop-sidebar-footer-right" }, themeToggle, collapseBtn);

    this._sidebarFooter.append(settingsBtn, rightGroup);
  }

  _renderQuickItem(type, iconEl, label, count) {
    const isActive = this._activeSelection.type === type;
    const isParentActive = type === "collections" && this._activeSelection.type === "collection";
    let className = "raindrop-nav-row";
    if (isActive) className += " is-active";
    else if (isParentActive) className += " is-parent-active";

    const item = el("button", {
      type: "button",
      className,
      "aria-selected": isActive ? "true" : "false",
      title: `${label} (${count})`,
    },
      el("span", { className: "raindrop-nav-icon" }, iconEl),
      el("span", { className: "raindrop-nav-label" }, label),
      el("span", { className: "raindrop-nav-count" }, String(count))
    );

    item.addEventListener("click", () => {
      if (type === "collections") {
        this._collectionsExpanded = true;
      } else {
        this._collectionsExpanded = false;
      }
      this._activeSelection = { type, title: label };
      this._activeTag = null;
      this._renderSidebar();
      this._renderHeader();
      this._renderContent();
    });

    return item;
  }

  _renderTreeNode(node, depth) {
    const isFolder = node.type === "folder" || (node.children && node.children.length > 0);
    if (!isFolder) return el("div");

    const count = countLeaves(node.children || []);
    const subfolders = (node.children || []).filter((c) => c.type === "folder");
    const hasChildren = subfolders.length > 0;
    const isExpanded = this._expandedFolders.has(node.id);
    const isActive = this._activeSelection.type === "folder" && this._activeSelection.id === node.id;
    const slashColor = this._getFolderColor(node);

    const slashBtn = el("button", {
      type: "button",
      className: "raindrop-tree-slash",
      style: `color:${slashColor};`,
      title: `Change color for "${node.title}"`,
      "aria-label": `Change color for ${node.title}`,
    }, "/");

    slashBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      this._openColorPicker(slashBtn, node);
    });

    const row = el("button", {
      type: "button",
      className: "raindrop-nav-row raindrop-tree-row" + (isActive ? " is-active" : ""),
      style: `padding-left: ${9 + depth * 14}px;`,
      title: `${node.title} (${count})`,
    },
      slashBtn,
      el("span", { className: "raindrop-nav-label" }, node.title),
      el("span", { className: "raindrop-nav-count" }, String(count))
    );

    row.addEventListener("click", () => {
      if (isActive) {
        if (hasChildren) {
          if (this._expandedFolders.has(node.id)) {
            this._expandedFolders.delete(node.id);
          } else {
            this._expandedFolders.add(node.id);
          }
          this._renderSidebar();
        }
      } else {
        this._collectionsExpanded = false;
        this._activeSelection = { type: "folder", id: node.id, title: node.title, folder: node };
        this._activeTag = null;
        this._renderSidebar();
        this._renderHeader();
        this._renderContent();
      }
    });

    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._showFolderContextMenu(e, node);
    });
    this._bindFolderDropTarget(row, node.id);

    const wrap = el("div", { className: "raindrop-tree-branch" }, row);

    if (hasChildren && isExpanded) {
      const childWrap = el("div", { className: "raindrop-tree-children" });
      for (const sub of subfolders) childWrap.appendChild(this._renderTreeNode(sub, depth + 1));
      wrap.appendChild(childWrap);
    }

    return wrap;
  }

  /* ── 2. Top Header: title/stats, search, tag bar, select mode, view + theme switchers ── */
  _tagCounts() {
    const counts = new Map();
    const targetLeaves = this._activeSelection.type === "quickie"
      ? this._quickieLeaves
      : this._leaves;

    for (const leaf of targetLeaves) {
      for (const tag of this._tags[leaf.id] || []) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }

  _renderHeader() {
    this._header.replaceChildren();

    const activeGroup = this.groupButtons.activeGroup;
    const isHomeSelection = this._activeSelection.type === "all" && !activeGroup;
    let title = activeGroup ? activeGroup.name : "Home";
    let headerIcon = activeGroup ? icon(activeGroup.icon || "folder") : icon("home");
    // count not needed per user request — removed from header

    if (this._activeSelection.type === "quickie") {
      title = "Quickie";
      headerIcon = icon("inbox");
    } else if (this._activeSelection.type === "collections") {
      title = "Collections";
      headerIcon = icon("layers");
    } else if (this._activeSelection.type === "collection") {
      title = this._activeSelection.title;
      headerIcon = icon("layers");
    } else if (this._activeSelection.type === "folder") {
      title = this._activeSelection.title;
      headerIcon = icon("folder");
    } else if (isHomeSelection) {
      title = "/ Home";
      headerIcon = null;
    }

    const isFolder = this._activeSelection.type === "folder" && this._activeSelection.id && !this._activeSelection.id.startsWith("loose:");
    const isCollection = this._activeSelection.type === "collection" && this._activeSelection.id;

    const isHomeTitle = isHomeSelection && title === "/ Home";
    const titleEl = el("h2", {
      className: "raindrop-header-title" + (isFolder || isCollection ? " is-editable" : "") + (isHomeTitle ? " is-home" : ""),
      title: (isFolder || isCollection) ? "Click to rename" : "",
      style: isHomeTitle ? "font-size:14px; font-weight:700; letter-spacing:0.02em;" : "",
    }, title);

    if (isFolder || isCollection) {
      titleEl.addEventListener("click", () => {
        this._startHeaderInlineRename(titleEl, this._activeSelection);
      });
    }

    const sidebarToggleBtn = el("button", {
      type: "button",
      className: "raindrop-sidebar-toggle-btn" + (this._sidebarCollapsed ? " is-visible" : ""),
      title: this._sidebarCollapsed ? "Expand sidebar ([)" : "Toggle sidebar ([)",
      "aria-label": "Toggle sidebar",
    }, icon(this._sidebarCollapsed ? "sidebarOpen" : "sidebar"));
    sidebarToggleBtn.addEventListener("click", () => this.toggleSidebar());

    const metaLeftChildren = [sidebarToggleBtn];
    if (headerIcon) metaLeftChildren.push(el("span", { className: "raindrop-header-icon" }, headerIcon));
    metaLeftChildren.push(titleEl);
    const metaLeft = el("div", { className: "raindrop-header-left" }, ...metaLeftChildren);

    this._searchInput = el("input", {
      type: "search",
      className: "raindrop-search-input",
      placeholder: "Search anything",
      value: this._query,
      "aria-label": "Search bookmarks",
      autocomplete: "off",
    });
    this._searchInput.addEventListener("input", () => {
      const prevQuery = this._query;
      this._query = this._searchInput.value.trim().toLowerCase();

      // If in focus home mode and query was cleared, transition back to minimal header & center hero
      if (isFocus && this._activeSelection.type === "all" && !this._query && prevQuery) {
        this._renderHeader();
        this._renderContent();
        const heroInput = this._content.querySelector(".home-focus-search-input");
        if (heroInput) {
          heroInput.focus();
        }
      } else {
        this._renderContent();
      }
    });
    this._searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const q = this._searchInput.value.trim();
        if (q) window.location.assign(`https://www.google.com/search?q=${encodeURIComponent(q)}`);
      }
    });

    const isMac = typeof navigator !== "undefined" && (navigator.platform?.includes("Mac") || navigator.userAgent?.includes("Mac"));
    const kbd = el("span", { className: "raindrop-search-kbd" }, isMac ? "⌘K" : "Ctrl K");
    const searchWrap = el("div", { className: "raindrop-search-bar" }, icon("search", "raindrop-search-icon"), this._searchInput, kbd);

    // Select mode toggle button
    const selectBtn = el("button", {
      type: "button",
      className: "raindrop-select-btn" + (this._selectMode ? " is-active" : ""),
      title: this._selectMode ? "Exit selection mode" : "Select bookmarks",
      "aria-pressed": this._selectMode ? "true" : "false",
    },
      icon("check"),
      el("span", { className: "raindrop-select-btn-label" }, "Select")
    );
    selectBtn.addEventListener("click", () => {
      this._selectMode = !this._selectMode;
      if (!this._selectMode) this._selectedIds.clear();
      this._renderHeader();
      this._renderContent();
    });

    const viewSwitch = el("div", { className: "raindrop-view-switch" });
    const views = [
      { id: "compact", name: "grip", label: "Compact" },
      { id: "list", name: "sliders", label: "List" },
      { id: "grid", name: "grid", label: "Grid" },
    ];
    for (const v of views) {
      const btn = el("button", {
        type: "button",
        className: "raindrop-view-btn" + (this._viewMode === v.id ? " is-active" : ""),
        title: `${v.label} view`,
      }, icon(v.name));
      btn.addEventListener("click", () => { this._viewMode = v.id; this._renderHeader(); this._renderContent(); });
      viewSwitch.appendChild(btn);
    }

    const isFocus = this._layoutStyle === "focus";
    const zapIcon = icon("zap", "focus-btn-icon");
    const labelSpan = el("span", { className: "raindrop-layout-mode-label" }, "Focus");

    const layoutModeBtn = el("button", {
      type: "button",
      className: "raindrop-layout-mode-btn" + (isFocus ? " is-active" : ""),
      title: isFocus ? "Switch to Standard View" : "Switch to Focus Mode (Clock, Search & Shortcuts)",
      "aria-label": "Toggle Focus Layout Mode",
    }, zapIcon, labelSpan);

    layoutModeBtn.addEventListener("click", () => {
      this._layoutStyle = this._layoutStyle === "focus" ? "standard" : "focus";
      try { localStorage.setItem("neptab_home_layout_style", this._layoutStyle); } catch {}
      if (this.root) {
        this.root.classList.toggle("is-focus-mode", this._layoutStyle === "focus");
      }
      if (this._layoutStyle === "focus") {
        this._sidebarCollapsed = true;
        this._allBookmarksCollapsed = true;
      } else {
        // When switching to standard (non-focus) mode, always expand sidebar and all bookmarks
        this._sidebarCollapsed = false;
        this._allBookmarksCollapsed = false;
      }
      try {
        localStorage.setItem("neptab_sidebar_collapsed", String(this._sidebarCollapsed));
        localStorage.setItem("neptab_all_bookmarks_collapsed", String(this._allBookmarksCollapsed));
      } catch {}
      if (this.root) {
        this.root.classList.toggle("is-sidebar-collapsed", this._sidebarCollapsed);
      }
      this._renderSidebar();
      this._renderHeader();
      this._renderContent();
    });

    const mode = this.getColorMode();
    const isDark = mode === "dark";
    const themeBtn = el("button", {
      type: "button",
      className: "raindrop-theme-toggle-btn",
      title: isDark ? "Switch to Light mode" : "Switch to Dark mode",
      "aria-label": isDark ? "Switch to Light mode" : "Switch to Dark mode",
    }, icon(isDark ? "sun" : "moon", "theme-btn-icon"));

    themeBtn.addEventListener("click", () => {
      const nextMode = this.getColorMode() === "dark" ? "light" : "dark";
      this.setColorMode(nextMode);
      const nextIsDark = nextMode === "dark";
      themeBtn.title = nextIsDark ? "Switch to Light mode" : "Switch to Dark mode";
      themeBtn.setAttribute("aria-label", themeBtn.title);
      themeBtn.replaceChildren(icon(nextIsDark ? "sun" : "moon", "theme-btn-icon"));
    });

    const focusThemeGroup = el("div", { className: "raindrop-focus-theme-group" },
      layoutModeBtn,
      el("div", { className: "raindrop-btn-divider", "aria-hidden": "true" }),
      themeBtn
    );

    const makePanelBtn = () => {
      const b = el("button", {
        type: "button",
        className: "raindrop-panel-trigger-btn",
        title: "To-Do",
        "aria-label": "Open To-Do",
      }, icon("checkSquare"));
      b.addEventListener("click", () => this._openRightPanel());
      return b;
    };

    if (isFocus && this._activeSelection.type === "all" && !this._query) {
      const focusLeft = el("div", { className: "raindrop-header-left focus-header-left" },
        sidebarToggleBtn
      );
      const focusRight = el("div", { className: "raindrop-header-right focus-header-right" },
        focusThemeGroup,
        makePanelBtn()
      );
      this._header.append(focusLeft, el("div", { className: "raindrop-header-spacer" }), focusRight);
      return;
    }

    const rightCluster = el("div", { className: "raindrop-header-right" });
    if (this._activeSelection.type === "collection" || this._activeSelection.type === "folder" || activeGroup) {
      const addBmBtn = el("button", {
        type: "button",
        className: "raindrop-add-bm-btn",
        title: "Add bookmarks from library or create a new bookmark",
      }, icon("plus"), el("span", {}, "Add Bookmarks"));
      addBmBtn.addEventListener("click", () => this._openBookmarkPicker());
      rightCluster.appendChild(addBmBtn);
    }
    rightCluster.append(
      focusThemeGroup,
      selectBtn,
      viewSwitch,
      makePanelBtn()
    );

    this._header.append(metaLeft, searchWrap, rightCluster);
  }

  _startHeaderInlineRename(titleEl, selection) {
    const currentTitle = selection.title || titleEl.textContent;
    const input = el("input", {
      type: "text",
      className: "raindrop-header-title-input",
      value: currentTitle,
      "aria-label": "Rename",
    });

    titleEl.replaceWith(input);
    input.focus();
    input.select();

    let committed = false;
    const commit = async () => {
      if (committed) return;
      committed = true;
      const newTitle = input.value.trim();
      if (!newTitle || newTitle === currentTitle) {
        input.replaceWith(titleEl);
        return;
      }

      try {
        if (selection.type === "folder") {
          if (typeof chrome !== "undefined" && chrome.bookmarks) {
            await chrome.bookmarks.update(selection.id, { title: newTitle });
          }
          selection.title = newTitle;
          if (selection.folder) selection.folder.title = newTitle;
          this.toast?.show(`Folder renamed to "${newTitle}"`);
        } else if (selection.type === "collection") {
          if (this.useCases?.renameBookmarkCollection) {
            await this.useCases.renameBookmarkCollection.execute({ id: selection.id, name: newTitle });
          }
          selection.title = newTitle;
          this.toast?.show(`Collection renamed to "${newTitle}"`);
        }
        await this._load();
      } catch (err) {
        this.toast?.show(err.message || "Failed to rename", { error: true });
        input.replaceWith(titleEl);
      }
    };

    const cancel = () => {
      if (committed) return;
      committed = true;
      input.replaceWith(titleEl);
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    });
  }

  /* ── 3. Main Content Area ─────────────────────────────────── */
  _getActivePool() {
    let pool = [];
    if (this._activeSelection.type === "all") pool = this._leaves;
    else if (this._activeSelection.type === "quickie") pool = this._quickieLeaves;
    else if (this._activeSelection.type === "collection") {
      const coll = this._collections.find((c) => c.id === this._activeSelection.id);
      pool = coll ? resolveCollectionLeaves(coll.bookmarkIds, this._leafIndex) : [];
    } else if (this._activeSelection.type === "folder") {
      pool = flattenLeaves(this._activeSelection.folder?.children || []);
    }

    if (this._activeTag) {
      pool = pool.filter((b) => (this._tags[b.id] || []).includes(this._activeTag));
    }
    if (this._query) {
      const q = this._query;
      pool = pool.filter((b) => b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q));
    }
    return pool;
  }

  _renderShortcutCategoryBar() {
    if (!this._categories || this._categories.length === 0) return null;

    const bar = el("div", { className: "shortcut-category-bar", role: "tablist", "aria-label": "Shortcut categories" });
    
    for (const cat of this._categories) {
      const catId = cat.id?.value || cat.id;
      const isActive = catId === this._activeCategoryId;
      const btn = el("button", {
        type: "button",
        className: "shortcut-category-btn" + (isActive ? " is-active" : ""),
        role: "tab",
        "aria-selected": isActive ? "true" : "false",
        title: `Drag to reorder — ${cat.name}`,
        draggable: "true",
      }, cat.name);

      btn.addEventListener("click", () => {
        if (btn.classList.contains("is-dragging")) return;
        this._activeCategoryId = catId;
        this._renderContent();
      });

      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this._showCategoryContextMenu(e, cat);
      });

      // Drag to reorder categories (native Shortcuts folder order)
      btn.addEventListener("dragstart", (e) => {
        this._dragCategoryId = catId;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", catId);
        setTimeout(() => btn.classList.add("is-dragging"), 0);
      });
      btn.addEventListener("dragend", () => {
        btn.classList.remove("is-dragging");
        this._dragCategoryId = null;
        bar.querySelectorAll(".is-drag-over").forEach((el) => el.classList.remove("is-drag-over"));
      });
      btn.addEventListener("dragover", (e) => {
        const isCatDrag = this._dragCategoryId && this._dragCategoryId !== catId;
        const isShortcutDrag = this._dragShortcutId && this._dragShortcutCatId !== catId;
        if (!isCatDrag && !isShortcutDrag) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        btn.classList.add("is-drag-over");
      });
      btn.addEventListener("dragleave", () => btn.classList.remove("is-drag-over"));
      btn.addEventListener("drop", async (e) => {
        e.preventDefault();
        btn.classList.remove("is-drag-over");
        // Shortcut dropped on category → move to that category
        if (this._dragShortcutId && this._dragShortcutCatId !== catId) {
          const draggedId = this._dragShortcutId;
          try {
            if (typeof chrome !== "undefined" && chrome.bookmarks?.move) {
              await chrome.bookmarks.move(draggedId, { parentId: catId });
            }
            this._activeCategoryId = catId;
            await this._load();
            this.toast?.show("Shortcut moved");
          } catch (err) {
            this.toast?.show(err.message || "Failed to move", { error: true });
          }
          return;
        }
        // Category reorder
        const draggedId = this._dragCategoryId;
        if (!draggedId || draggedId === catId) return;
        const fromIdx = this._categories.findIndex((c) => (c.id?.value || c.id) === draggedId);
        const toIdx = this._categories.findIndex((c) => (c.id?.value || c.id) === catId);
        if (fromIdx < 0 || toIdx < 0) return;
        try {
          if (typeof chrome !== "undefined" && chrome.bookmarks?.move) {
            await chrome.bookmarks.move(draggedId, { index: toIdx });
          }
          await this._load();
          this.toast?.show("Category reordered");
        } catch (err) {
          this.toast?.show(err.message || "Failed to reorder", { error: true });
        }
      });

      bar.appendChild(btn);
    }

    const addBtn = el("button", {
      type: "button",
      className: "shortcut-category-add-btn",
      title: "Add new category",
      "aria-label": "Add new category",
    }, icon("plus"));

    addBtn.addEventListener("click", () => {
      this.categoryDialog.openForCreate({
        onSuccess: () => this._load(),
      });
    });

    bar.appendChild(addBtn);
    return bar;
  }

  _renderShortcutTile(item, { showCategory = false } = {}) {
    const rawUrl = item.url?.href || item.url || "";
    const title = item.title || "";
    const initialLetter = initial(title || rawUrl);

    const imgEl = el("img", {
      className: "shortcut-circular-img",
      alt: "",
      loading: "lazy",
    });

    const fallbackEl = el("span", {
      className: "shortcut-circular-initial",
    }, initialLetter);

    const safe = isSafeUrl(rawUrl);
    if (safe) {
      Promise.resolve(item.faviconUrl || websiteFaviconUrl(safe, 64)).then((src) => {
        if (src) {
          imgEl.src = src;
        } else {
          imgEl.style.display = "none";
          fallbackEl.style.display = "flex";
        }
      }).catch(() => {
        imgEl.style.display = "none";
        fallbackEl.style.display = "flex";
      });
    } else {
      imgEl.style.display = "none";
      fallbackEl.style.display = "flex";
    }

    imgEl.addEventListener("error", () => {
      // Privacy: no S2 fallback (would leak hostname to Google)
      imgEl.style.display = "none";
      fallbackEl.style.display = "flex";
    });

    imgEl.addEventListener("load", () => {
      imgEl.style.display = "block";
      fallbackEl.style.display = "none";
    });

    const disc = el("div", { className: "shortcut-circular-disc" }, imgEl, fallbackEl);
    const label = el("span", { className: "shortcut-circular-label", title }, title);

    const catName = showCategory ? this._searchIndex?.getCategoryName(item) : "";
    const catTag = catName ? el("span", { className: "shortcut-category-tag", title: `Category: ${catName}` }, catName) : null;

    const tileChildren = [disc, label];
    if (catTag) tileChildren.push(catTag);

    const shortcutId = item.id?.value || item.id;
    const itemCatId = item.categoryId?.value || item.categoryId;
    const tile = el("button", {
      type: "button",
      className: "shortcut-circular-item",
      title: `${title}\n${rawUrl}${catName ? `\nCategory: ${catName}` : ""} — drag to reorder`,
      draggable: "true",
    }, ...tileChildren);

    // Single-click immediate URL opening (ignore if dragging)
    tile.addEventListener("click", () => {
      if (tile.classList.contains("is-dragging")) return;
      if (rawUrl) {
        window.location.assign(rawUrl);
      }
    });

    tile.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this._showShortcutContextMenu(e, item);
    });

    // Drag to reorder shortcuts by serial (within same category)
    tile.addEventListener("dragstart", (e) => {
      this._dragShortcutId = shortcutId;
      this._dragShortcutCatId = itemCatId;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", shortcutId);
      setTimeout(() => tile.classList.add("is-dragging"), 0);
    });
    tile.addEventListener("dragend", () => {
      tile.classList.remove("is-dragging");
      this._dragShortcutId = null;
      this._dragShortcutCatId = null;
      document.querySelectorAll(".shortcut-circular-item.is-drag-over").forEach((el) => el.classList.remove("is-drag-over"));
    });
    tile.addEventListener("dragover", (e) => {
      if (!this._dragShortcutId || this._dragShortcutId === shortcutId) return;
      if (this._dragShortcutCatId !== itemCatId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      tile.classList.add("is-drag-over");
    });
    tile.addEventListener("dragleave", () => tile.classList.remove("is-drag-over"));
    tile.addEventListener("drop", async (e) => {
      e.preventDefault();
      tile.classList.remove("is-drag-over");
      const draggedId = this._dragShortcutId;
      if (!draggedId || draggedId === shortcutId) return;
      if (this._dragShortcutCatId !== itemCatId) return;
      const list = (this._shortcuts || []).filter((s) => (s.categoryId?.value || s.categoryId) === itemCatId);
      const fromIdx = list.findIndex((s) => (s.id?.value || s.id) === draggedId);
      const toIdx = list.findIndex((s) => (s.id?.value || s.id) === shortcutId);
      if (fromIdx < 0 || toIdx < 0) return;
      try {
        if (typeof chrome !== "undefined" && chrome.bookmarks?.move) {
          await chrome.bookmarks.move(draggedId, { index: toIdx });
        }
        await this._load();
        this.toast?.show("Shortcut reordered");
      } catch (err) {
        this.toast?.show(err.message || "Failed to reorder", { error: true });
      }
    });

    return tile;
  }

  _renderShortcutGrid() {
    const grid = el("div", { className: "shortcut-circular-grid", "aria-label": "Website shortcuts" });
    
    const currentShortcuts = (this._shortcuts || []).filter((s) => {
      const catId = s.categoryId?.value || s.categoryId;
      return catId === this._activeCategoryId;
    });

    for (const item of currentShortcuts) {
      grid.appendChild(this._renderShortcutTile(item, { showCategory: false }));
    }

    // + Add shortcut button (clean icon + name)
    const addDisc = el("div", { className: "shortcut-circular-disc shortcut-circular-add-disc" }, icon("plus"));
    const addLabel = el("span", { className: "shortcut-circular-label" }, "Add");
    const addTile = el("button", {
      type: "button",
      className: "shortcut-circular-item shortcut-circular-add-item",
      title: "Add direct URL shortcut to this category",
    }, addDisc, addLabel);

    addTile.addEventListener("click", () => {
      this.shortcutDialog.openForCreate({
        categoryId: this._activeCategoryId,
        categories: this._categories,
        onSuccess: () => this._load(),
      });
    });

    grid.appendChild(addTile);
    return grid;
  }

  _showCategoryContextMenu(e, category) {
    this._closeContextMenu();

    const menu = el("div", { className: "raindrop-context-menu" });
    const renameBtn = el("button", { type: "button", className: "raindrop-context-item" },
      icon("edit"),
      el("span", {}, "Rename Category")
    );
    renameBtn.addEventListener("click", () => {
      this._closeContextMenu();
      this.categoryDialog.openForRename(category, { onSuccess: () => this._load() });
    });
    menu.appendChild(renameBtn);

    if (this._categories.length > 1) {
      const deleteBtn = el("button", { type: "button", className: "raindrop-context-item is-danger" },
        icon("trash"),
        el("span", {}, "Delete Category")
      );
      deleteBtn.addEventListener("click", () => {
        this._closeContextMenu();
        this.confirmDialog.open({
          title: `Delete Category "${category.name}"?`,
          message: "Shortcuts in this category will also be removed. This cannot be undone.",
          confirmLabel: "Delete Category",
          isDanger: true,
          onConfirm: async () => {
            try {
              const catId = category.id?.value || category.id || category.nativeId;
              if (this._shortcutsFolderId && typeof chrome !== "undefined" && chrome.bookmarks) {
                await chrome.bookmarks.removeTree(catId);
              } else {
                await this.useCases.deleteCategory.execute({ id: catId });
              }
              this.toast?.show(`Deleted category "${category.name}"`);
              await this._load();
            } catch (err) {
              this.toast?.show(err.message || "Failed to delete category", { error: true });
            }
          },
        });
      });
      menu.appendChild(deleteBtn);
    }

    document.body.appendChild(menu);
    this._activeContextMenu = menu;

    const x = Math.min(window.innerWidth - 180, e.clientX);
    const y = Math.min(window.innerHeight - 120, e.clientY);
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  }

  _showShortcutContextMenu(e, shortcut) {
    this._closeContextMenu();

    const rawUrl = shortcut.url?.href || shortcut.url || "";
    const menu = el("div", { className: "raindrop-context-menu" });

    const openNewTabBtn = el("button", { type: "button", className: "raindrop-context-item" },
      icon("external"),
      el("span", {}, "Open in New Tab")
    );
    openNewTabBtn.addEventListener("click", () => {
      this._closeContextMenu();
      if (rawUrl) window.open(rawUrl, "_blank", "noopener");
    });
    menu.appendChild(openNewTabBtn);

    const editBtn = el("button", { type: "button", className: "raindrop-context-item" },
      icon("edit"),
      el("span", {}, "Edit Shortcut")
    );
    editBtn.addEventListener("click", () => {
      this._closeContextMenu();
      this.shortcutDialog.openForEdit(shortcut, {
        categories: this._categories,
        onSuccess: () => this._load(),
      });
    });
    menu.appendChild(editBtn);

    const deleteBtn = el("button", { type: "button", className: "raindrop-context-item is-danger" },
      icon("trash"),
      el("span", {}, "Delete Shortcut")
    );
    deleteBtn.addEventListener("click", () => {
      this._closeContextMenu();
      this.confirmDialog.open({
        title: `Delete Shortcut "${shortcut.title}"?`,
        message: "Are you sure you want to remove this shortcut?",
        confirmLabel: "Delete Shortcut",
        isDanger: true,
        onConfirm: async () => {
          try {
            const id = shortcut.id?.value || shortcut.id;
            if (this._shortcutsFolderId && typeof chrome !== "undefined" && chrome.bookmarks) {
              await chrome.bookmarks.remove(id);
            } else {
              await this.useCases.deleteBookmark.execute({ id });
            }
            this.toast?.show(`Deleted shortcut "${shortcut.title}"`);
            await this._load();
          } catch (err) {
            this.toast?.show(err.message || "Failed to delete shortcut", { error: true });
          }
        },
      });
    });
    menu.appendChild(deleteBtn);

    document.body.appendChild(menu);
    this._activeContextMenu = menu;

    const x = Math.min(window.innerWidth - 180, e.clientX);
    const y = Math.min(window.innerHeight - 150, e.clientY);
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  }

  _showFolderContextMenu(e, node) {
    this._closeContextMenu();

    const leaves = flattenLeaves(node.children || []);
    const count = leaves.length;
    const isLoose = String(node.id).startsWith("loose:");
    const realFolderId = isLoose ? String(node.id).replace("loose:", "") : node.id;

    const menu = el("div", { className: "raindrop-context-menu" });

    // 1. Open All in New Window
    const openWindowBtn = el("button", { type: "button", className: "raindrop-context-item" },
      icon("external"),
      el("span", {}, `Open all (${count}) in new window`)
    );
    if (count === 0) {
      openWindowBtn.disabled = true;
      openWindowBtn.style.opacity = "0.5";
      openWindowBtn.style.cursor = "not-allowed";
    }
    openWindowBtn.addEventListener("click", () => {
      this._closeContextMenu();
      if (count === 0) return;
      const urls = leaves.map(b => b.url).filter(isSafeUrl);
      if (urls.length === 0) return;

      if (typeof chrome !== "undefined" && chrome.windows && typeof chrome.windows.create === "function") {
        chrome.windows.create({ url: urls });
      } else {
        window.open(urls[0], "_blank");
        for (let i = 1; i < urls.length; i++) {
          window.open(urls[i], "_blank");
        }
      }
      this.toast?.show(`Opened ${urls.length} bookmark${urls.length === 1 ? "" : "s"} in new window`);
    });
    menu.appendChild(openWindowBtn);

    // 2. Open All in New Tabs
    const openTabsBtn = el("button", { type: "button", className: "raindrop-context-item" },
      icon("layers"),
      el("span", {}, `Open all (${count}) in new tabs`)
    );
    if (count === 0) {
      openTabsBtn.disabled = true;
      openTabsBtn.style.opacity = "0.5";
      openTabsBtn.style.cursor = "not-allowed";
    }
    openTabsBtn.addEventListener("click", () => {
      this._closeContextMenu();
      if (count === 0) return;
      const urls = leaves.map(b => b.url).filter(isSafeUrl);
      for (const u of urls) {
        if (typeof chrome !== "undefined" && chrome.tabs && typeof chrome.tabs.create === "function") {
          chrome.tabs.create({ url: u });
        } else {
          window.open(u, "_blank", "noopener");
        }
      }
      this.toast?.show(`Opened ${urls.length} bookmark${urls.length === 1 ? "" : "s"}`);
    });
    menu.appendChild(openTabsBtn);

    // 3. Rename Folder (or Edit Name)
    if (!isLoose) {
      const renameBtn = el("button", { type: "button", className: "raindrop-context-item" },
        icon("edit"),
        el("span", {}, "Rename Folder")
      );
      renameBtn.addEventListener("click", () => {
        this._closeContextMenu();
        const currentName = node.title || "";
        const newName = window.prompt("Rename folder:", currentName);
        if (newName && newName.trim() && newName.trim() !== currentName) {
          const trimmed = newName.trim();
          if (typeof chrome !== "undefined" && chrome.bookmarks && typeof chrome.bookmarks.update === "function") {
            chrome.bookmarks.update(realFolderId, { title: trimmed })
              .then(() => {
                this.toast?.show(`Renamed folder to "${trimmed}"`);
                this._load();
              })
              .catch((err) => {
                this.toast?.show(err.message || "Failed to rename folder", { error: true });
              });
          }
        }
      });
      menu.appendChild(renameBtn);
    }

    // 4. Add Tag to Folder Bookmarks
    const addTagBtn = el("button", { type: "button", className: "raindrop-context-item" },
      icon("tag"),
      el("span", {}, "Add Tag to Folder...")
    );
    if (count === 0) {
      addTagBtn.disabled = true;
      addTagBtn.style.opacity = "0.5";
      addTagBtn.style.cursor = "not-allowed";
    }
    addTagBtn.addEventListener("click", () => {
      this._closeContextMenu();
      if (count === 0) return;
      const tagPrompt = window.prompt(`Add tag to all ${count} bookmark${count === 1 ? "" : "s"} in "${node.title}":`);
      if (tagPrompt && tagPrompt.trim()) {
        const rawTag = tagPrompt.replace(/#/g, "").trim().toLowerCase();
        if (rawTag && this.useCases?.setBookmarkTags) {
          Promise.all(
            leaves.map((leaf) => {
              const cur = this._tags[leaf.id] || [];
              if (!cur.includes(rawTag)) {
                return this.useCases.setBookmarkTags.execute({
                  bookmarkId: leaf.id,
                  tags: [...cur, rawTag],
                });
              }
              return Promise.resolve();
            })
          ).then(() => {
            this.toast?.show(`Added #${rawTag} to ${count} bookmark${count === 1 ? "" : "s"}`);
            this._load();
          }).catch((err) => {
            this.toast?.show(err.message || "Failed to add tag", { error: true });
          });
        }
      }
    });
    menu.appendChild(addTagBtn);

    // 5. Delete Folder
    if (!isLoose) {
      const deleteBtn = el("button", { type: "button", className: "raindrop-context-item is-danger" },
        icon("trash"),
        el("span", {}, "Delete Folder")
      );
      deleteBtn.addEventListener("click", () => {
        this._closeContextMenu();
        this.confirmDialog.open({
          title: `Delete Folder "${node.title}"?`,
          message: `This will permanently delete "${node.title}" and its ${count} bookmark${count === 1 ? "" : "s"}. This cannot be undone.`,
          confirmLabel: "Delete Folder",
          isDanger: true,
          onConfirm: async () => {
            try {
              if (typeof chrome !== "undefined" && chrome.bookmarks && typeof chrome.bookmarks.removeTree === "function") {
                await chrome.bookmarks.removeTree(realFolderId);
              }
              this.toast?.show(`Deleted folder "${node.title}"`);
              if (this._activeSelection.type === "folder" && this._activeSelection.id === node.id) {
                this._activeSelection = { type: "all", title: "Home" };
              }
              await this._load();
            } catch (err) {
              this.toast?.show(err.message || "Failed to delete folder", { error: true });
            }
          },
        });
      });
      menu.appendChild(deleteBtn);
    }

    document.body.appendChild(menu);
    this._activeContextMenu = menu;

    const x = Math.min(window.innerWidth - 220, e.clientX);
    const y = Math.min(window.innerHeight - 240, e.clientY);
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  }

  _closeContextMenu() {
    if (this._activeContextMenu) {
      this._activeContextMenu.remove();
      this._activeContextMenu = null;
    }
  }

  _dueForPreset(preset) {
    const d = new Date();
    const toISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    if (preset === "today") return toISO(d);
    if (preset === "tomorrow") { d.setDate(d.getDate() + 1); return toISO(d); }
    if (preset === "in3days") { d.setDate(d.getDate() + 3); return toISO(d); }
    if (preset === "thisWeek") {
      const day = d.getDay();
      const untilSun = (7 - day) % 7;
      d.setDate(d.getDate() + untilSun);
      return toISO(d);
    }
    return "";
  }

  _labelForDue(dueDate) {
    if (!dueDate) return "";
    const today = this._dueForPreset("today");
    const tomorrow = this._dueForPreset("tomorrow");
    const in3 = this._dueForPreset("in3days");
    const thisWeek = this._dueForPreset("thisWeek");
    if (dueDate === today) return "Today";
    if (dueDate === tomorrow) return "Tomorrow";
    if (dueDate === in3) return "In 3 days";
    if (dueDate === thisWeek) return "This week";
    try {
      const dt = new Date(dueDate + "T00:00:00");
      return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch { return dueDate; }
  }

  async _renderRightPanelList() {
    if (!this._rightPanelList) return;
    this._rightPanelList.replaceChildren(el("div", { className: "todo-panel-loading" }, "Loading..."));
    try {
      const tasks = this.useCases?.listTasks ? await this.useCases.listTasks.execute() : [];
      const sorted = [...tasks].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        return (a.order ?? 0) - (b.order ?? 0);
      });
      this._rightPanelList.replaceChildren();
      if (sorted.length === 0) {
        this._rightPanelList.append(el("div", { className: "todo-panel-empty" }, "No tasks yet. Add one above."));
        this._updateRightPanelCount(0);
        return;
      }
      this._updateRightPanelCount(sorted.filter(t => !t.completed).length);
      for (const t of sorted) {
        const row = el("div", { className: `todo-panel-item${t.completed ? " is-done" : ""}` });
        const check = el("button", {
          type: "button",
          className: `todo-panel-check${t.completed ? " is-done" : ""}`,
          "aria-label": t.completed ? "Mark undone" : "Mark done",
          title: t.completed ? "Mark undone" : "Mark done",
        }, icon(t.completed ? "check" : "circle"));
        check.addEventListener("click", async () => {
          try { await this.useCases.updateTask.execute({ id: t.id.value, completed: !t.completed }); await this._renderRightPanelList(); } catch (e) { this.toast?.show(e.message || "Could not update", { error: true }); }
        });
        const titleEl = el("span", { className: "todo-panel-title" }, t.title);
        const duePill = t.dueDate ? el("span", { className: "todo-panel-due" }, this._labelForDue(t.dueDate)) : null;
        const delBtn = el("button", { type: "button", className: "todo-panel-delete", title: "Delete", "aria-label": "Delete" }, icon("trash"));
        delBtn.addEventListener("click", async () => {
          try { await this.useCases.deleteTask.execute(t.id.value); await this._renderRightPanelList(); } catch (e) { this.toast?.show(e.message || "Could not delete", { error: true }); }
        });
        row.append(check, titleEl);
        if (duePill) row.append(duePill);
        row.append(delBtn);
        this._rightPanelList.append(row);
      }
    } catch {
      this._rightPanelList.replaceChildren(el("div", { className: "todo-panel-empty" }, "Failed to load tasks"));
    }
  }

  _updateRightPanelCount(n) {
    if (this._rightPanelCount) this._rightPanelCount.textContent = n ? `${n} left` : "";
  }

  _ensureRightPanel() {
    if (this._rightPanel) return;
    this._rightPanelBackdrop = el("div", { className: "raindrop-right-panel-backdrop" });
    this._rightPanel = el("div", { className: "raindrop-right-panel", role: "dialog", "aria-label": "To-Do" });
    const header = el("div", { className: "raindrop-right-panel-header" },
      el("div", { className: "raindrop-right-panel-header-left" },
        el("h3", { className: "raindrop-right-panel-title" }, "To-Do"),
        this._rightPanelCount = el("span", { className: "raindrop-right-panel-count" }, "")
      ),
      el("button", { type: "button", className: "raindrop-right-panel-close", "aria-label": "Close" }, icon("x"))
    );
    header.querySelector(".raindrop-right-panel-close").addEventListener("click", () => this._closeRightPanel());
    this._rightPanelBackdrop.addEventListener("click", () => this._closeRightPanel());

    const body = el("div", { className: "raindrop-right-panel-body todo-panel" });

    // Input row
    const inputWrap = el("div", { className: "todo-panel-input-wrap" });
    this._rightPanelInput = el("input", {
      type: "text",
      className: "todo-panel-input",
      placeholder: "What needs to be done?",
      maxLength: 200,
      autocomplete: "off",
    });
    const chips = el("div", { className: "todo-panel-chips" });
    const presets = [
      { id: "today", label: "Today" },
      { id: "tomorrow", label: "Tomorrow" },
      { id: "in3days", label: "In 3 days" },
      { id: "thisWeek", label: "This week" },
    ];
    for (const p of presets) {
      const btn = el("button", { type: "button", className: "todo-panel-chip", "data-preset": p.id }, p.label);
      btn.addEventListener("click", async () => {
        const title = this._rightPanelInput.value.trim();
        if (!title) { this.toast?.show("Type a task first", { error: true }); this._rightPanelInput.focus(); return; }
        const dueDate = this._dueForPreset(p.id);
        try {
          await this.useCases.createTask.execute({ title, dueDate });
          this._rightPanelInput.value = "";
          this._rightPanelInput.focus();
          await this._renderRightPanelList();
        } catch (e) { this.toast?.show(e.message || "Could not add", { error: true }); }
      });
      chips.append(btn);
    }
    // Enter defaults to Today
    this._rightPanelInput.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        const title = this._rightPanelInput.value.trim();
        if (!title) return;
        const dueDate = this._dueForPreset("today");
        try {
          await this.useCases.createTask.execute({ title, dueDate });
          this._rightPanelInput.value = "";
          await this._renderRightPanelList();
        } catch (err) { this.toast?.show(err.message || "Could not add", { error: true }); }
      }
    });

    inputWrap.append(this._rightPanelInput, chips);
    this._rightPanelList = el("div", { className: "todo-panel-list" });

    body.append(inputWrap, this._rightPanelList);
    this._rightPanel.append(header, body);
    document.body.append(this._rightPanelBackdrop, this._rightPanel);
    this._rightPanelEsc = (e) => { if (e.key === "Escape") this._closeRightPanel(); };

    // live updates
    if (!this._rightPanelTasksUnsub && this.events?.on) {
      this._rightPanelTasksUnsub = this.events.on("tasks:changed", () => this._renderRightPanelList());
    }
  }

  _openRightPanel() {
    this._ensureRightPanel();
    this._rightPanel.classList.add("is-open");
    this._rightPanelBackdrop.classList.add("is-open");
    document.addEventListener("keydown", this._rightPanelEsc);
    this._renderRightPanelList();
    setTimeout(() => this._rightPanelInput?.focus(), 60);
  }

  _closeRightPanel() {
    if (!this._rightPanel) return;
    this._rightPanel.classList.remove("is-open");
    this._rightPanelBackdrop.classList.remove("is-open");
    document.removeEventListener("keydown", this._rightPanelEsc);
  }

  _renderContent() {
    this._closeContextMenu();
    this._content.replaceChildren();

    // 1. Omni-Search Active Mode (Matches Shortcuts AND Bookmarks with O(1) indexed lookup)
    if (this._query) {
      const isHomeSelection = this._activeSelection.type === "all";
      const isCollection = this._activeSelection.type === "collection";
      let scopedBookmarkIds = null;

      if (!isHomeSelection) {
        if (this._activeSelection.type === "folder") {
          const folderLeaves = flattenLeaves(this._activeSelection.folder?.children || []);
          scopedBookmarkIds = new Set(folderLeaves.map((b) => b.id));
        } else if (this._activeSelection.type === "collection") {
          const coll = this._collections.find((c) => c.id === this._activeSelection.id);
          scopedBookmarkIds = new Set(coll ? coll.bookmarkIds : []);
        } else if (this._activeSelection.type === "quickie") {
          scopedBookmarkIds = new Set(this._quickieLeaves.map((b) => b.id));
        }
      }

      const { shortcuts: matchingShortcuts, bookmarks: matchingBookmarks } = this._searchIndex.search(this._query, {
        activeTag: this._activeTag,
        scopedBookmarkIds,
      });

      const totalMatches = matchingShortcuts.length + matchingBookmarks.length;

      if (totalMatches === 0) {
        const emptyState = el("div", { className: "raindrop-empty-state" },
          el("div", { className: "raindrop-empty-icon" }, icon("search")),
          el("h3", { className: "raindrop-empty-title" }, "No matches found"),
          el("p", { className: "raindrop-empty-desc" }, `No shortcuts or bookmarks matched "${this._query}"`)
        );

        const googleBtn = el("button", {
          type: "button",
          className: "btn btn-primary",
        }, `Search Google for "${this._query}"`);
        googleBtn.addEventListener("click", () => {
          window.location.assign(`https://www.google.com/search?q=${encodeURIComponent(this._query)}`);
        });

        const actionsWrap = el("div", { className: "raindrop-empty-actions" }, googleBtn);
        emptyState.appendChild(actionsWrap);
        this._content.appendChild(emptyState);
        return;
      }

      // 1. Render Matching Shortcuts (if any)
      if (matchingShortcuts.length > 0) {
        const shortcutsHeader = el("div", { className: "omni-search-section-header" },
          el("div", { className: "omni-section-left" },
            el("span", { className: "omni-section-icon" }, icon("zap")),
            el("h3", { className: "omni-section-title" }, "Shortcuts"),
            el("span", { className: "omni-section-count" }, `${matchingShortcuts.length}`)
          )
        );
        this._content.appendChild(shortcutsHeader);

        const shortcutsGrid = el("div", { className: "omni-shortcuts-grid", "aria-label": "Matching Shortcuts" });
        for (const item of matchingShortcuts) {
          shortcutsGrid.appendChild(this._renderShortcutTile(item, { showCategory: true }));
        }
        this._content.appendChild(shortcutsGrid);
      }

      // 2. Render Matching Bookmarks (if any)
      if (matchingBookmarks.length > 0) {
        if (matchingShortcuts.length > 0) {
          const bookmarksHeader = el("div", { className: "omni-search-section-header" },
            el("div", { className: "omni-section-left" },
              el("span", { className: "omni-section-icon" }, icon("bookmark")),
              el("h3", { className: "omni-section-title" }, "Bookmarks"),
              el("span", { className: "omni-section-count" }, `${matchingBookmarks.length}`)
            )
          );
          this._content.appendChild(bookmarksHeader);
        }

        if (this._previewObserver) {
          this._previewObserver.disconnect();
          this._previewObserver = null;
        }
        previewQueue.clear();

        const isGridView = this._viewMode === "grid";
        const previewsEnabled = this._settings ? this._settings.showWebsitePreviews !== false : true;

        if (isGridView && previewsEnabled && typeof IntersectionObserver !== "undefined") {
          this._previewObserver = new IntersectionObserver((entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                const coverEl = entry.target;
                this._previewObserver?.unobserve(coverEl);
                const previewUrl = coverEl.dataset.previewUrl;
                if (previewUrl) {
                  previewQueue.add(coverEl, previewUrl);
                }
              }
            }
          }, {
            root: this._content,
            rootMargin: "150px 0px",
          });
        }

        const grid = el("div", { className: `raindrop-layout raindrop-${this._viewMode}` });
        const fragment = document.createDocumentFragment();
        for (const b of matchingBookmarks) {
          fragment.appendChild(this._renderCard(b, { inCollection: isCollection }));
        }
        grid.appendChild(fragment);
        this._content.appendChild(grid);

        if (this._previewObserver) {
          const pendingCovers = grid.querySelectorAll(".raindrop-card-cover.is-pending-preview");
          for (const cover of pendingCovers) {
            this._previewObserver.observe(cover);
          }
        }
      }

      if (this._selectMode && this._selectedIds.size > 0) {
        this._content.appendChild(this._renderBulkActionBar());
      }
      return;
    }

    // 2. Collections Index View
    if (this._activeSelection.type === "collections") {
      this._renderCollectionsIndex();
      return;
    }

    // 3. Bookmark Pool Views (All, Quickie, Collection, Folder)
    const pool = this._getActivePool();
    const isCollection = this._activeSelection.type === "collection";
    const isFolderSelection = this._activeSelection.type === "folder";
    const isHomeSelection = this._activeSelection.type === "all";

    // Direct subfolders for the current view
    const currentSubfolders = isFolderSelection
      ? (this._activeSelection.folder?.children || []).filter((c) => c.type === "folder")
      : [];

    // Universal Top Category Selector (Layer 1) and Quick Click Shortcut Grid (Layer 2)
    // Rendered on Home view when not searching or tag filtering.
    if (isHomeSelection && !this._query && !this._activeTag) {
      // In Focus Mode, render Greeting + Clock widget + Centered search bar at the top
      if (this._layoutStyle === "focus") {
        const focusHero = el("div", { className: "home-focus-hero" });

        // 1. Greeting (Good Morning / Afternoon / Evening with red dot)
        if (this._greetingView) {
          const greetingEl = this._greetingView.render(this._settings || {});
          if (greetingEl) focusHero.appendChild(greetingEl);
        }

        // 2. Nothing-style Digital Clock
        const clockEl = this._clockView?.render(this._settings);
        if (clockEl) {
          focusHero.appendChild(clockEl);
        }

        // 3. Large Centered Search bar
        const isMac = typeof navigator !== "undefined" && (navigator.platform?.includes("Mac") || navigator.userAgent?.includes("Mac"));
        const focusSearchInput = el("input", {
          type: "search",
          className: "search-input home-focus-search-input",
          placeholder: "Filter bookmarks · Enter for Google",
          value: this._query,
          autocomplete: "off",
        });
        focusSearchInput.addEventListener("input", () => {
          this._query = focusSearchInput.value.trim().toLowerCase();
          this._renderHeader();
          this._renderContent();
          const syncAndFocus = () => {
            if (this._searchInput && this._query) {
              this._searchInput.focus();
              const len = this._searchInput.value.length;
              this._searchInput.setSelectionRange(len, len);
            }
          };
          requestAnimationFrame(syncAndFocus);
          setTimeout(syncAndFocus, 10);
          setTimeout(syncAndFocus, 35);
        });
        focusSearchInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const q = focusSearchInput.value.trim();
            if (q) {
              const url = (/^[a-z][a-z0-9+.-]*:\/\//i.test(q) || (!q.includes(" ") && q.includes(".")))
                ? (q.startsWith("http") ? q : `https://${q}`)
                : `https://www.google.com/search?q=${encodeURIComponent(q)}`;
              window.location.assign(url);
            }
          }
        });
        const searchIcon = icon("search");
        const kbdBadge = el("span", { className: "search-kbd" }, isMac ? "⌘K" : "Ctrl K");
        const focusSearchWrap = el("div", { className: "search-wrap home-focus-search-wrap" }, searchIcon, focusSearchInput, kbdBadge);
        focusHero.appendChild(focusSearchWrap);

        this._content.appendChild(focusHero);
      }

      const shortcutsContainer = el("div", { className: "home-shortcuts-container" });
      const categoryBar = this._renderShortcutCategoryBar();
      const shortcutGrid = this._renderShortcutGrid();
      if (categoryBar) shortcutsContainer.appendChild(categoryBar);
      if (shortcutGrid) shortcutsContainer.appendChild(shortcutGrid);
      if (categoryBar || shortcutGrid) this._content.appendChild(shortcutsContainer);

      const activeGroup = this.groupButtons.activeGroup;
      const sectionTitle = activeGroup ? `${activeGroup.name} / All Bookmarks` : "All Bookmarks";

      const caret = el("span", {
        className: "bookmarks-section-caret" + (!this._allBookmarksCollapsed ? " is-open" : ""),
      }, icon("chevronRight"));

      const titleEl = el("h3", { className: "bookmarks-section-title" }, sectionTitle);
      const countEl = el("span", { className: "bookmarks-section-count" }, `${pool.length} bookmarks`);

      let settingsBtn = null;
      if (this._layoutStyle === "focus" && this.onOpenSettings) {
        settingsBtn = el("button", {
          type: "button",
          className: "raindrop-settings-btn focus-bottom-settings-btn",
          title: "Settings (,)",
          "aria-label": "Open Settings",
        }, icon("settings"));
        settingsBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.onOpenSettings?.();
        });
      }

      const sectionHeader = el("div", {
        className: "bookmarks-section-header" + (this._allBookmarksCollapsed ? " is-collapsed" : ""),
        role: "button",
        tabIndex: 0,
        title: this._allBookmarksCollapsed ? "Click to expand bookmarks" : "Click to collapse bookmarks",
      },
        el("div", { className: "bookmarks-section-left" }, caret, titleEl, countEl),
        settingsBtn
      );

      sectionHeader.addEventListener("click", () => {
        this._allBookmarksCollapsed = !this._allBookmarksCollapsed;
        try { localStorage.setItem("neptab_all_bookmarks_collapsed", String(this._allBookmarksCollapsed)); } catch {}
        this._renderContent();
      });
      this._content.appendChild(sectionHeader);
    }

    if (pool.length === 0 && currentSubfolders.length === 0) {
      const activeGroup = this.groupButtons.activeGroup;
      let emptyTitle = activeGroup ? `Workspace "${activeGroup.name}" is empty` : "This folder is empty";
      let emptyDesc = activeGroup ? "Create your first folder or add bookmarks to organize your work." : "Save links to this folder in Chrome to organize them here.";

      if (this._query || this._activeTag) {
        emptyTitle = "No matching bookmarks";
        emptyDesc = this._query ? `No bookmarks matched "${this._query}"` : "No bookmarks have this tag.";
      } else if (this._activeSelection.type === "quickie") {
        emptyTitle = "Quickie inbox is empty";
        emptyDesc = "Use '⚡ Save to Quickie' in the extension popup to capture pages instantly.";
      } else if (isCollection) {
        emptyTitle = "This collection is empty";
        emptyDesc = "Add bookmarks from your library or add a new link directly.";
      } else if (this._activeSelection.type === "folder") {
        emptyTitle = `Folder "${this._activeSelection.title}" is empty`;
        emptyDesc = "Add subfolders or move bookmarks here.";
      }

      const emptyIconName = this._activeSelection.type === "quickie"
        ? "inbox"
        : (isCollection ? "layers" : (activeGroup ? (activeGroup.icon || "folder") : "folder"));

      const emptyState = el("div", { className: "raindrop-empty-state" },
        el("div", { className: "raindrop-empty-icon" }, icon(emptyIconName)),
        el("h3", { className: "raindrop-empty-title" }, emptyTitle),
        el("p", { className: "raindrop-empty-desc" }, emptyDesc)
      );

      if ((activeGroup || this._activeSelection.type === "folder") && !isCollection && !this._query && !this._activeTag) {
        const addBmBtn = el("button", {
          type: "button",
          className: "btn btn-primary",
        }, "+ Add Bookmarks");
        addBmBtn.addEventListener("click", () => this._openBookmarkPicker());

        const addFolderBtn = el("button", {
          type: "button",
          className: "btn",
        }, "+ Add Folder");
        addFolderBtn.addEventListener("click", () => this._promptCreateFolder());

        const actionsWrap = el("div", { className: "raindrop-empty-actions" }, addBmBtn, addFolderBtn);
        emptyState.appendChild(actionsWrap);
      } else if (isCollection && !this._query && !this._activeTag) {
        const addFromLibBtn = el("button", {
          type: "button",
          className: "btn btn-primary",
        }, "+ Add from Library");
        addFromLibBtn.addEventListener("click", () => this._openBookmarkPicker());

        const addNewLinkBtn = el("button", {
          type: "button",
          className: "btn",
        }, "+ New Bookmark");
        addNewLinkBtn.addEventListener("click", () => {
          const coll = this._getActiveCollection();
          if (coll) {
            this.bookmarkPicker.open(coll, this._unscopedLeaves, {
              onSuccess: () => this._load(),
            });
            const newTabBtn = this.bookmarkPicker.dialog?.querySelector(".picker-tab:last-child");
            if (newTabBtn) newTabBtn.click();
          }
        });

        const actionsWrap = el("div", { className: "raindrop-empty-actions" }, addFromLibBtn, addNewLinkBtn);
        emptyState.appendChild(actionsWrap);
      }

      this._content.appendChild(emptyState);
      return;
    }

    if (this._previewObserver) {
      this._previewObserver.disconnect();
      this._previewObserver = null;
    }
    previewQueue.clear();

    const isGridView = this._viewMode === "grid";
    const previewsEnabled = this._settings ? this._settings.showWebsitePreviews !== false : true;

    if (isGridView && previewsEnabled && typeof IntersectionObserver !== "undefined") {
      this._previewObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const coverEl = entry.target;
            this._previewObserver?.unobserve(coverEl);
            const previewUrl = coverEl.dataset.previewUrl;
            if (previewUrl) {
              previewQueue.add(coverEl, previewUrl);
            }
          }
        }
      }, {
        root: this._content,
        rootMargin: "150px 0px",
      });
    }

    // Subfolder grid when inside a folder that has child folders
    if (currentSubfolders.length > 0) {
      const subfolderGrid = el("div", { className: "raindrop-quickbar", "aria-label": "Subfolders" });
      for (const sub of currentSubfolders) {
        const color = this._getFolderColor(sub);
        const count = countLeaves(sub.children || []);
        const tile = el("button", {
          type: "button",
          className: "raindrop-quick-tile",
          title: `${sub.title} (${count})`,
        },
          el("span", { className: "raindrop-quick-tile-icon", style: `background:${color}2E;color:${color};` }, icon("folder")),
          el("span", { className: "raindrop-quick-tile-label" }, sub.title),
          el("span", { className: "raindrop-quick-tile-count" }, String(count))
        );
        tile.addEventListener("click", () => {
          this._activeSelection = { type: "folder", id: sub.id, title: sub.title, folder: sub };
          this._activeTag = null;
          this._expandedFolders.add(sub.id);
          this._renderSidebar();
          this._renderHeader();
          this._renderContent();
        });
        this._bindFolderDropTarget(tile, sub.id);
        subfolderGrid.appendChild(tile);
      }
      this._content.appendChild(subfolderGrid);
    }

    const shouldShowGrid = !(isHomeSelection && !this._query && !this._activeTag && this._allBookmarksCollapsed);

    if (pool.length > 0 && shouldShowGrid) {
      const grid = el("div", { className: `raindrop-layout raindrop-${this._viewMode}` });
      const fragment = document.createDocumentFragment();
      for (const b of pool) {
        fragment.appendChild(this._renderCard(b, { inCollection: isCollection }));
      }
      grid.appendChild(fragment);
      this._content.appendChild(grid);

      // Observe pending covers only after the entire grid is mounted in the document
      if (this._previewObserver) {
        const pendingCovers = grid.querySelectorAll(".raindrop-card-cover.is-pending-preview");
        for (const cover of pendingCovers) {
          this._previewObserver.observe(cover);
        }
      }
    }

    // Floating Bulk Action Bar (when in select mode and at least 1 bookmark selected)
    if (this._selectMode && this._selectedIds.size > 0) {
      this._content.appendChild(this._renderBulkActionBar());
    }
  }

  /* ── 4. Collections Index Rendering ──────────────────────── */
  _renderCollectionsIndex() {
    const wrap = el("div", { className: "raindrop-collections-view" });
    const visibleCollections = this._getVisibleCollections();
    const activeGroup = this.groupButtons?.activeGroup;
    const headingText = activeGroup ? `${activeGroup.name} Collections` : "Your Collections";

    const topBar = el("div", { className: "raindrop-collections-topbar" },
      el("div", { className: "raindrop-collections-title-wrap" },
        el("h3", { className: "raindrop-collections-section-heading" }, headingText),
        el("span", { className: "raindrop-collections-count-badge" }, `${visibleCollections.length}`)
      ),
      el("button", {
        type: "button",
        className: "raindrop-new-coll-btn",
      }, icon("plus"), el("span", {}, "New Collection"))
    );
    topBar.querySelector(".raindrop-new-coll-btn").addEventListener("click", () => this._promptCreateBookmarkCollection());
    wrap.appendChild(topBar);

    if (visibleCollections.length === 0) {
      const emptyDesc = activeGroup
        ? `Create collections inside ${activeGroup.name} to bundle related bookmarks across folders.`
        : "Create collections to bundle related bookmarks across folders without moving them.";
      const emptyState = el("div", { className: "raindrop-empty-state" },
        el("div", { className: "raindrop-empty-icon" }, icon("layers")),
        el("h3", { className: "raindrop-empty-title" }, "No collections yet"),
        el("p", { className: "raindrop-empty-desc" }, emptyDesc)
      );
      wrap.appendChild(emptyState);
      this._content.appendChild(wrap);
      return;
    }

    const grid = el("div", { className: "raindrop-collections-grid" });
    for (const coll of visibleCollections) {
      const leaves = resolveCollectionLeaves(coll.bookmarkIds, this._leafIndex);
      const count = leaves.length;

      const previewFavs = el("div", { className: "raindrop-collection-preview" });
      const sampleLeaves = leaves.slice(0, 4);
      if (sampleLeaves.length > 0) {
        for (const leaf of sampleLeaves) {
          previewFavs.appendChild(this._favicon(leaf, "raindrop-collection-fav-dot"));
        }
      } else {
        previewFavs.appendChild(el("span", { className: "raindrop-collection-empty-icon" }, icon("layers")));
      }

      const addBtn = el("button", {
        type: "button",
        className: "raindrop-coll-action-btn",
        title: "Add Bookmarks",
        "aria-label": `Add bookmarks to ${coll.name}`,
      }, icon("plus"));
      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._openBookmarkPicker(coll);
      });

      const renameBtn = el("button", {
        type: "button",
        className: "raindrop-coll-action-btn",
        title: "Rename",
        "aria-label": `Rename collection ${coll.name}`,
      }, icon("edit"));
      renameBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._promptRenameCollection(coll);
      });

      const deleteBtn = el("button", {
        type: "button",
        className: "raindrop-coll-action-btn raindrop-coll-delete",
        title: "Delete",
        "aria-label": `Delete collection ${coll.name}`,
      }, icon("trash"));
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._promptDeleteCollection(coll);
      });

      const actions = el("div", { className: "raindrop-coll-actions" }, addBtn, renameBtn, deleteBtn);

      const card = el("div", {
        className: "raindrop-collection-card",
        role: "button",
        tabIndex: 0,
        title: `${coll.name} (${count} bookmarks)`,
      },
        previewFavs,
        el("div", { className: "raindrop-coll-info" },
          el("div", { className: "raindrop-coll-name", title: coll.name }, coll.name),
          el("div", { className: "raindrop-coll-count" }, `${count} bookmark${count === 1 ? "" : "s"}`)
        ),
        actions
      );

      card.addEventListener("click", () => {
        this._collectionsExpanded = true;
        this._activeSelection = { type: "collection", id: coll.id, title: coll.name };
        this._activeTag = null;
        this._renderSidebar();
        this._renderHeader();
        this._renderContent();
      });
      this._bindCollectionDropTarget(card, coll.id);

      grid.appendChild(card);
    }

    wrap.appendChild(grid);
    this._content.appendChild(wrap);
  }

  /* ── 5. Bulk Action Bar ──────────────────────────────────── */
  _renderBulkActionBar() {
    const count = this._selectedIds.size;
    const countText = el("span", { className: "raindrop-bulk-count" }, `${count} selected`);

    const addDropdownBtn = el("button", {
      type: "button",
      className: "raindrop-bulk-btn raindrop-bulk-primary",
    }, el("span", {}, "Add to Collection"), icon("chevronDown"));

    const cancelBtn = el("button", {
      type: "button",
      className: "raindrop-bulk-btn raindrop-bulk-cancel",
    }, "Cancel");

    cancelBtn.addEventListener("click", () => {
      this._selectedIds.clear();
      this._selectMode = false;
      this._renderHeader();
      this._renderContent();
    });

    const menu = el("ul", { className: "raindrop-bulk-menu" });
    const visibleCollections = this._getVisibleCollections();
    for (const coll of visibleCollections) {
      const item = el("li", { className: "raindrop-bulk-menu-item" }, coll.name);
      item.addEventListener("click", async (e) => {
        e.stopPropagation();
        const selected = Array.from(this._selectedIds);
        try {
          await this.useCases.updateCollectionMembers.execute({
            collectionId: coll.id,
            add: selected,
          });
          this.toast?.show(`Added ${selected.length} bookmark${selected.length === 1 ? "" : "s"} to ${coll.name}`);
          this._selectedIds.clear();
          this._selectMode = false;
          await this._load();
        } catch (err) {
          this.toast?.show(err.message || "Could not add to collection", { error: true });
        }
      });
      menu.appendChild(item);
    }

    const newItem = el("li", { className: "raindrop-bulk-menu-item is-new" }, "+ New Collection...");
    newItem.addEventListener("click", (e) => {
      e.stopPropagation();
      const selected = Array.from(this._selectedIds);
      const activeGroup = this.groupButtons?.activeGroup;
      this.collectionDialog.openForCreate({
        initialBookmarkIds: selected,
        workspaceId: activeGroup ? activeGroup.id : null,
        onSuccess: async () => {
          this._selectedIds.clear();
          this._selectMode = false;
          await this._load();
        },
      });
    });
    menu.appendChild(newItem);

    const dropdownWrap = el("div", { className: "raindrop-bulk-dropdown" }, addDropdownBtn, menu);

    addDropdownBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdownWrap.classList.toggle("is-open");
    });

    const deleteBtn = el("button", {
      type: "button",
      className: "raindrop-bulk-btn raindrop-bulk-danger",
    }, icon("trash"), el("span", {}, "Delete"));

    deleteBtn.addEventListener("click", async () => {
      const selected = Array.from(this._selectedIds);
      if (!selected.length) return;
      try {
        for (const id of selected) {
          if (typeof chrome !== "undefined" && chrome.bookmarks && typeof chrome.bookmarks.remove === "function") {
            try { await chrome.bookmarks.remove(id); } catch (_) {}
          }
          if (this.useCases?.deleteBookmark) {
            try { await this.useCases.deleteBookmark.execute({ id }); } catch (_) {}
          }
        }
        this.toast?.show(`Deleted ${selected.length} bookmark${selected.length === 1 ? "" : "s"}`);
        this._selectedIds.clear();
        this._selectMode = false;
        await this._load();
      } catch (err) {
        this.toast?.show(err.message || "Could not delete bookmarks", { error: true });
      }
    });

    const bar = el("div", { className: "raindrop-bulk-bar" },
      countText,
      dropdownWrap,
      deleteBtn,
      cancelBtn
    );

    return bar;
  }

  /* ── 6. Card Rendering ───────────────────────────────────── */
  _renderCard(bookmark, { inCollection = false } = {}) {
    const domain = cleanDomain(bookmark.url);
    const cover = getThumbGradient(domain || bookmark.title);
    const glyph = (domain ? domain.charAt(0) : initial(bookmark.title)).toUpperCase();
    const isGridView = this._viewMode === "grid";
    const previewsEnabled = this._settings ? this._settings.showWebsitePreviews !== false : true;
    const previewUrl = isGridView && previewsEnabled ? websitePreviewUrl(bookmark.url) : null;
    const tags = this._tags[bookmark.id] || [];
    const breadcrumb = bookmark.path && bookmark.path.length ? bookmark.path.join(" / ") : "";
    const isSelected = this._selectedIds.has(bookmark.id);

    const cardClasses = ["raindrop-card"];
    if (this._selectMode) cardClasses.push("is-selectable");
    if (isSelected) cardClasses.push("is-selected");

    const card = el("div", {
      className: cardClasses.join(" "),
      role: this._selectMode ? "checkbox" : "link",
      "aria-checked": this._selectMode ? (isSelected ? "true" : "false") : undefined,
      tabIndex: 0,
      title: bookmark.title,
      draggable: !this._selectMode ? "true" : "false",
    });

    // Checkbox overlay for select mode
    if (this._selectMode) {
      const checkbox = el("span", { className: "raindrop-card-checkbox" + (isSelected ? " is-checked" : "") },
        isSelected ? icon("check") : null
      );
      card.appendChild(checkbox);
    }

    const coverEl = el("div", { className: "raindrop-card-cover", style: `background:${cover};` },
      el("span", { className: "raindrop-card-glyph" }, glyph)
    );

    if (previewUrl && !previewFailedCache.has(previewUrl)) {
      coverEl.dataset.previewUrl = previewUrl;
      coverEl.classList.add("is-pending-preview");
    }

    const body = el("div", { className: "raindrop-card-body" });

    const heading = el("div", { className: "raindrop-card-heading" },
      this._favicon(bookmark, "raindrop-card-fav"),
      el("span", { className: "raindrop-card-title", title: bookmark.title }, bookmark.title)
    );

    const pathEl = breadcrumb
      ? el("div", { className: "raindrop-card-path", title: breadcrumb }, icon("folder", "raindrop-card-path-icon"), breadcrumb)
      : el("div", { className: "raindrop-card-path is-empty" });

    const urlEl = el("div", { className: "raindrop-card-url", title: bookmark.url }, domain || bookmark.url);

    body.append(heading, pathEl, urlEl);

    if (tags.length) {
      const tagRow = el("div", { className: "raindrop-card-tags" });
      for (const tag of tags) tagRow.appendChild(el("span", { className: "raindrop-card-tag" }, `#${tag}`));
      body.append(tagRow);
    }

    // Card action buttons container
    const actionsWrap = el("div", { className: "raindrop-card-actions" });

    // Tag edit button
    const editTagsBtn = el("button", {
      type: "button",
      className: "raindrop-card-action-btn is-tag",
      title: "Edit tags",
      "aria-label": `Edit tags for ${bookmark.title}`,
    }, icon("tag"));
    editTagsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._editTags(bookmark);
    });
    actionsWrap.appendChild(editTagsBtn);

    // Remove from collection button (if viewed inside a Collection)
    if (inCollection && !this._selectMode) {
      const removeCollBtn = el("button", {
        type: "button",
        className: "raindrop-card-action-btn is-remove",
        title: "Remove from collection",
        "aria-label": `Remove ${bookmark.title} from collection`,
      }, icon("x"));
      removeCollBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          await this.useCases.updateCollectionMembers.execute({
            collectionId: this._activeSelection.id,
            remove: [bookmark.id],
          });
          this.toast?.show("Removed from collection");
          await this._load();
        } catch (err) {
          this.toast?.show(err.message || "Could not remove bookmark", { error: true });
        }
      });
      actionsWrap.appendChild(removeCollBtn);
    }

    // Delete bookmark button (permanent delete)
    if (!this._selectMode) {
      const deleteBtn = el("button", {
        type: "button",
        className: "raindrop-card-action-btn is-delete",
        title: "Delete bookmark",
        "aria-label": `Delete ${bookmark.title}`,
      }, icon("trash"));
      deleteBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          if (typeof chrome !== "undefined" && chrome.bookmarks && typeof chrome.bookmarks.remove === "function") {
            await chrome.bookmarks.remove(bookmark.id);
          }
          if (this.useCases?.deleteBookmark) {
            try { await this.useCases.deleteBookmark.execute({ id: bookmark.id }); } catch (_) {}
          }
          this.toast?.show(`Deleted "${bookmark.title || 'bookmark'}"`);
          await this._load();
        } catch (err) {
          this.toast?.show(err.message || "Could not delete bookmark", { error: true });
        }
      });
      actionsWrap.appendChild(deleteBtn);
    }

    body.append(actionsWrap);

    card.append(coverEl, body);

    card.addEventListener("click", (e) => {
      e.preventDefault();
      if (this._selectMode) {
        if (this._selectedIds.has(bookmark.id)) {
          this._selectedIds.delete(bookmark.id);
        } else {
          this._selectedIds.add(bookmark.id);
        }
        this._renderContent();
        return;
      }
      this._open(bookmark, e.metaKey || e.ctrlKey || e.shiftKey);
    });

    card.addEventListener("auxclick", (e) => {
      if (e.button === 1 && !this._selectMode) {
        e.preventDefault();
        this._open(bookmark, true);
      }
    });

    if (!this._selectMode) {
      card.addEventListener("dragstart", (e) => {
        this._drag = { id: bookmark.id, parentId: bookmark.parentId };
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", bookmark.id);
        card.classList.add("is-dragging");
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("is-dragging");
        this._drag = null;
      });
      card.addEventListener("dragover", (e) => {
        if (!this._drag || this._drag.id === bookmark.id) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        card.classList.add("is-drop-target");
      });
      card.addEventListener("dragleave", () => card.classList.remove("is-drop-target"));
      card.addEventListener("drop", (e) => {
        e.preventDefault();
        card.classList.remove("is-drop-target");
        this._handleDropOnCard(bookmark);
      });
    }

    return card;
  }

  async _handleDropOnCard(target) {
    const drag = this._drag;
    if (!drag || drag.id === target.id) return;
    try {
      const canReorder =
        this._activeSelection.type === "folder" &&
        !this._query && !this._activeTag &&
        drag.parentId === target.parentId;
      if (canReorder) {
        const pool = this._getActivePool();
        const index = pool.findIndex((b) => b.id === target.id);
        await chrome.bookmarks.move(drag.id, { index });
      } else {
        await chrome.bookmarks.move(drag.id, { parentId: target.parentId });
      }
      this.toast?.show("Bookmark moved");
    } catch (err) {
      this.toast?.show(err.message || "Could not move bookmark", { error: true });
    }
  }

  _favicon(bookmark, className) {
    const wrap = el("span", { className, "aria-hidden": "true" }, initial(bookmark.title));
    const safe = isSafeUrl(bookmark.url);
    if (safe) {
      Promise.resolve(websiteFaviconUrl(safe)).then((src) => {
        if (!src || !wrap.isConnected) return;
        const img = el("img", { src, alt: "", loading: "lazy" });
        img.addEventListener("error", () => {
          console.warn(`[Favicon] Failed to load favicon for "${bookmark.title}" (${bookmark.url}) from ${src}`);
          if (wrap.isConnected) wrap.textContent = initial(bookmark.title);
        });
        wrap.replaceChildren(img);
      });
    }
    return wrap;
  }

  /* ── 7. Modals for Collections & Folders ────────────────── */
  _promptCreateBookmarkCollection() {
    const activeGroup = this.groupButtons?.activeGroup;
    this.collectionDialog.openForCreate({
      workspaceId: activeGroup ? activeGroup.id : null,
      onSuccess: () => this._load(),
    });
  }

  _promptRenameCollection(coll) {
    this.collectionDialog.openForRename(coll, {
      onSuccess: () => this._load(),
    });
  }

  _promptDeleteCollection(coll) {
    this.confirmDialog.open({
      title: "Delete Collection",
      message: `Are you sure you want to delete collection "${coll.name}"? Bookmarks inside will not be deleted.`,
      confirmLabel: "Delete Collection",
      isDanger: true,
      onConfirm: async () => {
        try {
          await this.useCases.deleteBookmarkCollection.execute({ collectionId: coll.id });
          this.toast?.show(`Collection "${coll.name}" deleted`);
          if (this._activeSelection.type === "collection" && this._activeSelection.id === coll.id) {
            this._activeSelection = { type: "collections", title: "Collections" };
          }
          await this._load();
        } catch (err) {
          this.toast?.show(err.message || "Could not delete collection", { error: true });
        }
      },
    });
  }

  _promptCreateFolder() {
    let parentId = "1";
    let scopeRootId = null;
    const activeGroup = this.groupButtons.activeGroup;
    if (activeGroup && activeGroup.folderIds?.[0]) {
      scopeRootId = activeGroup.folderIds[0];
      parentId = scopeRootId;
    }

    if (this._activeSelection.type === "folder" && this._activeSelection.id) {
      // If a loose folder synthetic ID was active, extract real parent ID
      parentId = this._activeSelection.id.startsWith("loose:")
        ? this._activeSelection.id.replace("loose:", "")
        : this._activeSelection.id;
    }

    this.newFolderDialog.open(parentId, scopeRootId);
  }

  _bindKeys() {
    if (this._escHandler) return;
    this._escHandler = (e) => {
      if (e.key === "Escape") {
        if (this._activeContextMenu) {
          this._closeContextMenu();
          return;
        }
        if (this._activeColorPopover) {
          this._activeColorPopover.remove();
          this._activeColorPopover = null;
          return;
        }
        if (this._selectMode) {
          this._selectMode = false;
          this._selectedIds.clear();
          this._renderHeader();
          this._renderContent();
          return;
        }
        if (this._query) {
          this._query = "";
          if (this._searchInput) this._searchInput.value = "";
          this._renderHeader();
          this._renderContent();
          if (this._layoutStyle === "focus" && this._activeSelection.type === "all") {
            const heroInput = this._content.querySelector(".home-focus-search-input");
            heroInput?.focus();
          }
          return;
        }
      }
    };
    document.addEventListener("keydown", this._escHandler);

    this._keyHandler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        this.focusSearch();
      } else if ((e.key === "[" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b")) && !["INPUT", "TEXTAREA"].includes(e.target.tagName)) {
        e.preventDefault();
        this.toggleSidebar();
      }
    };
    document.addEventListener("keydown", this._keyHandler);

    this._docClickHandler = (e) => {
      if (this._activeContextMenu && !this._activeContextMenu.contains(e.target)) {
        this._closeContextMenu();
      }
      if (this._activeColorPopover && !this._activeColorPopover.contains(e.target)) {
        this._activeColorPopover.remove();
        this._activeColorPopover = null;
      }
      const openDropdowns = document.querySelectorAll(".raindrop-bulk-dropdown.is-open");
      openDropdowns.forEach((dd) => {
        if (!dd.contains(e.target)) dd.classList.remove("is-open");
      });
    };
    document.addEventListener("click", this._docClickHandler);
  }

  /** Re-render on live changes to the user's actual Chrome bookmarks
   *  (another tab, the popup, the browser's own bookmark manager). */
  _bindBookmarkEvents() {
    if (typeof chrome === "undefined" || !chrome.bookmarks || this._bookmarkEventHandler) return;
    let pending = null;
    this._bookmarkEventHandler = () => {
      clearTimeout(pending);
      pending = setTimeout(() => this._load(), 150);
    };
    this._bookmarkEventNames = ["onCreated", "onRemoved", "onChanged", "onMoved", "onChildrenReordered", "onImportEnded"];
    for (const name of this._bookmarkEventNames) {
      chrome.bookmarks[name]?.addListener(this._bookmarkEventHandler);
    }
  }

  focusSearch() {
    if (this._layoutStyle === "focus" && this._activeSelection.type === "all" && !this._query) {
      const heroInput = this._content.querySelector(".home-focus-search-input");
      if (heroInput) {
        heroInput.focus();
        heroInput.select();
        return;
      }
    }
    this._searchInput?.focus();
    this._searchInput?.select();
  }

  destroy() {
    this._closeContextMenu();
    if (this._activeColorPopover) { this._activeColorPopover.remove(); this._activeColorPopover = null; }
    if (this._escHandler) { document.removeEventListener("keydown", this._escHandler); this._escHandler = null; }
    if (this._keyHandler) { document.removeEventListener("keydown", this._keyHandler); this._keyHandler = null; }
    if (this._docClickHandler) { document.removeEventListener("click", this._docClickHandler); this._docClickHandler = null; }
    if (this._bookmarkEventHandler && typeof chrome !== "undefined" && chrome.bookmarks) {
      for (const name of this._bookmarkEventNames) chrome.bookmarks[name]?.removeListener(this._bookmarkEventHandler);
      this._bookmarkEventHandler = null;
    }
    this._unsubEvents.forEach((unsub) => {
      try { unsub(); } catch {}
    });
    this._unsubEvents = [];
    this._clockView?.destroy?.();
    this.groupButtons?.destroy?.();
    this.root = null;
  }
}
