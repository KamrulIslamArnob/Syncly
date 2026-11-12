import { buildContainer } from "../../infrastructure/di/container.js";
import { deriveAccentShades } from "../shared/colorUtils.js";

/** Extract basic keywords from title for suggested hashtags. */
function extractSuggestedTags(title) {
  if (!title) return [];
  const words = title
    .replace(/[^\w\s-]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const stopWords = new Set([
    "the", "and", "for", "with", "this", "that", "from", "how", "what",
    "why", "who", "your", "you", "are", "not", "all", "any", "can",
    "web", "app", "home", "page", "new", "tab", "official", "site",
    "github", "google", "com", "org", "io", "net", "dev",
  ]);
  const tags = new Set();
  for (const w of words) {
    const clean = w.replace(/^-+|-+$/g, "");
    if (clean.length >= 3 && !stopWords.has(clean) && !/^\d+$/.test(clean)) tags.add(clean);
  }
  return Array.from(tags).slice(0, 5);
}

function normalizeUrlStrict(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  try {
    const u = new URL(rawUrl.trim());
    let path = u.pathname.replace(/\/+$/, "") || "/";
    let host = u.hostname.toLowerCase().replace(/^www\./, "");
    return `${u.protocol}//${host}${path}${u.search}`;
  } catch {
    return rawUrl.trim().toLowerCase().replace(/\/+$/, "");
  }
}

function normalizeUrlWithHash(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  try {
    const u = new URL(rawUrl.trim());
    let path = u.pathname.replace(/\/+$/, "") || "/";
    let host = u.hostname.toLowerCase().replace(/^www\./, "");
    return `${u.protocol}//${host}${path}${u.search}${u.hash}`;
  } catch {
    return rawUrl.trim().toLowerCase().replace(/\/+$/, "");
  }
}

export function findExactBookmarkInTree(roots, targetUrl) {
  if (!targetUrl || typeof targetUrl !== "string") return null;
  const targetStrict = normalizeUrlStrict(targetUrl);
  const targetWithHash = normalizeUrlWithHash(targetUrl);
  if (!targetStrict) return null;

  const raw = Array.isArray(roots) ? roots : [];
  let top = raw;
  if (
    raw.length === 1 &&
    raw[0] &&
    typeof raw[0] === "object" &&
    (raw[0].id === "0" || raw[0].title === "" || raw[0].title === "root") &&
    Array.isArray(raw[0].children)
  ) {
    top = raw[0].children;
  }

  let foundMatch = null;

  const walk = (node, path, parentFolderId) => {
    if (!node || foundMatch) return;

    if (typeof node.url === "string" && node.url.length > 0) {
      const nodeStrict = normalizeUrlStrict(node.url);
      const nodeWithHash = normalizeUrlWithHash(node.url);
      if (nodeWithHash === targetWithHash || nodeStrict === targetStrict) {
        const folderTitle = path.length > 0 ? path[path.length - 1] : "Bookmarks bar";
        const fullPath = path.length > 0 ? path.join(" › ") : "Bookmarks bar";
        foundMatch = {
          node,
          folderId: String(node.parentId || parentFolderId || "1"),
          folderTitle,
          fullPath,
        };
        return;
      }
    }

    if (Array.isArray(node.children)) {
      const title = typeof node.title === "string" && node.title.length > 0 ? node.title : "Folder";
      const nextPath = (node.id === "0" || !node.title) ? path : [...path, title];
      const currentFolderId = (node.id !== "0" && node.id) ? String(node.id) : parentFolderId;
      for (const child of node.children) {
        walk(child, nextPath, currentFolderId);
        if (foundMatch) return;
      }
    }
  };

  for (const node of top) {
    walk(node, [], String(node.id || "1"));
    if (foundMatch) break;
  }

  return foundMatch;
}

/** Flatten a chrome.bookmarks tree into folder options with indent depth & breadcrumb path. */
function flattenFolders(roots) {
  const raw = Array.isArray(roots) ? roots : [];
  let top = raw;
  if (
    raw.length === 1 &&
    raw[0] &&
    typeof raw[0] === "object" &&
    (raw[0].id === "0" || raw[0].title === "" || raw[0].title === "root") &&
    Array.isArray(raw[0].children)
  ) {
    top = raw[0].children;
  }

  const isFolderNode = (n) =>
    n && typeof n === "object" && !(typeof n.url === "string" && n.url.length > 0);

  const out = [];
  const walk = (node, depth, path) => {
    if (!isFolderNode(node)) return;
    const title = typeof node.title === "string" && node.title.length > 0 ? node.title : "Folder";
    out.push({
      id: String(node.id ?? title),
      title,
      depth,
      path: [...path],
      fullPath: [...path, title].join(" / "),
    });
    for (const child of Array.isArray(node.children) ? node.children : []) {
      walk(child, depth + 1, [...path, title]);
    }
  };

  for (const node of top) {
    walk(node, 0, []);
  }

  return out;
}

function hostnameOf(urlString) {
  try {
    return new URL(urlString).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const SVG_NS = "http://www.w3.org/2000/svg";

function createSvgIcon(name, size = 13, className = "") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  if (className) svg.setAttribute("class", className);

  if (name === "folder") {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", "M3 7.5h6l2 2.5h10v9.5H3Z");
    svg.appendChild(path);
  } else if (name === "category") {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", "M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z");
    svg.appendChild(path);
  } else if (name === "chevron") {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", "m9 18 6-6-6-6");
    svg.appendChild(path);
  } else if (name === "collection") {
    const p1 = document.createElementNS(SVG_NS, "path");
    p1.setAttribute("d", "m12 2 10 5-10 5L2 7l10-5Z");
    const p2 = document.createElementNS(SVG_NS, "path");
    p2.setAttribute("d", "m2 17 10 5 10-5");
    const p3 = document.createElementNS(SVG_NS, "path");
    p3.setAttribute("d", "m2 12 10 5 10-5");
    svg.append(p1, p2, p3);
  }
  return svg;
}

const LAST_FOLDER_KEY = "popupLastFolder";
const RECENT_FOLDERS_KEY = "popupRecentFolders";
const LAST_CATEGORY_KEY = "popupLastCategory";
const RECENT_CATEGORIES_KEY = "popupRecentCategories";
const LAST_COLLECTION_KEY = "popupLastCollection";
const RECENT_COLLECTIONS_KEY = "popupRecentCollections";
const MAX_RECENT_CHIPS = 4;

async function readLocal(key) {
  try {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return null;
    const data = await chrome.storage.local.get([key]);
    return data?.[key] ?? null;
  } catch {
    return null;
  }
}

async function writeLocal(key, value) {
  try {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return;
    await chrome.storage.local.set({ [key]: value });
  } catch { /* non-fatal */ }
}

export function rankPopupWorkspaces(groups, activeId, usage = {}) {
  return [{ id: "", name: "All bookmarks" }, ...groups].sort((a, b) =>
    Number(b.id === activeId) - Number(a.id === activeId)
    || (Number(usage[b.id]) || 0) - (Number(usage[a.id]) || 0));
}

export class PopupController {
  constructor() {
    this.themeToggleBtn = document.getElementById("btn-theme-toggle");
    this.btnQuickAddQuickie = document.getElementById("btn-quick-add-quickie");
    this.typeBtnBookmark = document.getElementById("type-btn-bookmark");
    this.typeBtnShortcut = document.getElementById("type-btn-shortcut");
    this.typeBtnCollection = document.getElementById("type-btn-collection");
    this.fieldFolder = document.getElementById("field-folder");
    this.fieldCategory = document.getElementById("field-category");
    this.fieldCollection = document.getElementById("field-collection");
    this.fieldWorkspace = document.getElementById("field-workspace");

    this.form = document.getElementById("add-form");
    this.titleInput = document.getElementById("bm-title");
    this.urlInput = document.getElementById("bm-url");
    this.domainEl = document.getElementById("popup-domain");
    this.faviconEl = document.getElementById("popup-favicon");
    this.tagsInput = document.getElementById("bm-tags-input");
    this.tagsList = document.getElementById("bm-tags-list");
    this.errorEl = document.getElementById("bm-error");
    this.submitBtn = document.getElementById("bm-submit");
    this.submitBtnText = document.getElementById("bm-submit-text");

    // Folder Destination & Inline Dropdown (Bookmark Mode)
    this.folderTrigger = document.getElementById("bm-collection-trigger");
    this.folderHidden = document.getElementById("bm-collection-value");
    this.folderLabel = document.getElementById("bm-collection-label");
    this.folderQuickRow = document.getElementById("folder-quick-row");
    this.folderDropdown = document.getElementById("folder-dropdown-panel");
    this.folderSearchInput = document.getElementById("folder-search-input");
    this.folderSearchClear = document.getElementById("folder-search-clear");
    this.folderNewBtn = document.getElementById("folder-new-btn");
    this.folderCreatorBox = document.getElementById("folder-creator-box");
    this.folderCreatorInput = document.getElementById("folder-creator-input");
    this.folderCreatorConfirm = document.getElementById("folder-creator-confirm");
    this.folderCreatorCancel = document.getElementById("folder-creator-cancel");
    this.folderList = document.getElementById("folder-dropdown-list");

    // Category Destination & Inline Dropdown (Shortcut Mode)
    this.categoryTrigger = document.getElementById("bm-category-trigger");
    this.categoryHidden = document.getElementById("bm-category-value");
    this.categoryLabel = document.getElementById("bm-category-label");
    this.categoryQuickRow = document.getElementById("category-quick-row");
    this.categoryDropdown = document.getElementById("category-dropdown-panel");
    this.categorySearchInput = document.getElementById("category-search-input");
    this.categorySearchClear = document.getElementById("category-search-clear");
    this.categoryNewBtn = document.getElementById("category-new-btn");
    this.categoryCreatorBox = document.getElementById("category-creator-box");
    this.categoryCreatorInput = document.getElementById("category-creator-input");
    this.categoryCreatorConfirm = document.getElementById("category-creator-confirm");
    this.categoryCreatorCancel = document.getElementById("category-creator-cancel");
    this.categoryList = document.getElementById("category-dropdown-list");

    // Collection Destination & Inline Dropdown (Collection Mode)
    this.customCollectionTrigger = document.getElementById("bm-custom-collection-trigger");
    this.customCollectionHidden = document.getElementById("bm-custom-collection-value");
    this.customCollectionLabel = document.getElementById("bm-custom-collection-label");
    this.collectionQuickRow = document.getElementById("collection-quick-row");
    this.collectionDropdown = document.getElementById("collection-dropdown-panel");
    this.collectionSearchInput = document.getElementById("collection-search-input");
    this.collectionSearchClear = document.getElementById("collection-search-clear");
    this.collectionNewBtn = document.getElementById("collection-new-btn");
    this.collectionCreatorBox = document.getElementById("collection-creator-box");
    this.collectionCreatorInput = document.getElementById("collection-creator-input");
    this.collectionCreatorConfirm = document.getElementById("collection-creator-confirm");
    this.collectionCreatorCancel = document.getElementById("collection-creator-cancel");
    this.collectionList = document.getElementById("collection-dropdown-list");

    this.workspaceHidden = document.getElementById("bm-workspace-value");
    this.workspaceButtons = document.getElementById("workspace-buttons");
    this.workspaceUsage = {};
    this.workspacesExpanded = false;

    this.destinationType = "bookmark"; // "bookmark" | "shortcut" | "collection"
    this.activeDropdown = null; // "folder" | "category" | "collection" | "workspace" | null
    this.groups = [];
    this.folders = [];
    this.categories = [];
    this.collections = [];
    this.recentFolders = [];
    this.recentCategories = [];
    this.recentCollections = [];
    this.shortcutsFolderId = null;
    this.activeTags = new Set();
    this.currentColorMode = "light";
    this.currentAccentColor = "#3b82f6";
    this.currentFontSize = "default";
    this._saveResetTimer = null;
    this._activeContextMenu = null;

    this.existingBanner = document.getElementById("popup-existing-banner");
    this.existingFolderNameEl = document.getElementById("existing-folder-name");
    this.existingBookmark = null;
    this.existingFolderName = "";

    this.viewExistingFolderBtn = document.getElementById("btn-view-existing-folder");
    this.openSidebarBtn = document.getElementById("btn-open-sidebar");
    this.isSidePanel = window.location.search.includes("sidepanel") || window.location.pathname.includes("sidepanel");
    if (this.isSidePanel) {
      document.documentElement.classList.add("is-sidepanel");
      document.body.classList.add("is-sidepanel");
    }

    this._bindEvents();
  }

  _bindEvents() {
    this.themeToggleBtn?.addEventListener("click", () => this.toggleTheme());
    this.openSidebarBtn?.addEventListener("click", () => this.openSidePanel());

    // Click on "View location" or folder name to jump to bookmarks manager
    this.viewExistingFolderBtn?.addEventListener("click", () => this.openExistingBookmarkLocation());
    this.existingFolderNameEl?.addEventListener("click", () => this.openExistingBookmarkLocation());

    const quickieKey = document.getElementById("quickie-shortcut");
    if (quickieKey) quickieKey.textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "\u2318 S" : "Ctrl+S";
    window.addEventListener("resize", () => this._positionDropdown());
    document.addEventListener("scroll", (event) => {
      if (!event.target.closest?.(".picker-dropdown-panel")) this._positionDropdown();
    }, true);
    document.querySelector(".popup-url-details")?.addEventListener("toggle", (event) => {
      if (event.target.open) {
        this.closeAllDropdowns();
        this.urlInput?.focus({ preventScroll: true });
      }
    });

    // Input listeners to automatically clear saved state when editing
    this.titleInput?.addEventListener("input", () => {
      this._resetSavedState();
      this._updateSubmitButtonLabel();
    });
    this.urlInput?.addEventListener("invalid", () => {
      const details = this.urlInput.closest("details");
      if (details) details.open = true;
    });
    this.urlInput?.addEventListener("input", () => {
      this._resetSavedState();
      this.checkExistingBookmark(this.urlInput.value.trim());
    });

    // Right-click inside popup -> "Open from sidebar" context menu
    document.addEventListener("contextmenu", (e) => this._onContextMenu(e));
    document.addEventListener("click", () => this._closeContextMenu());

    // Destination Switcher
    this.typeBtnBookmark?.addEventListener("click", () => this.setDestinationType("bookmark"));
    this.typeBtnShortcut?.addEventListener("click", () => this.setDestinationType("shortcut"));
    this.typeBtnCollection?.addEventListener("click", () => this.setDestinationType("collection"));

    // Real-time sync with settings and popup preferences
    if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local") {
          if (changes.popupColorMode?.newValue) {
            this.applyTheme(changes.popupColorMode.newValue, this.currentAccentColor);
          }
          if (changes.settings?.newValue) {
            const s = changes.settings.newValue;
            const accent = s.cssVarAccent || "#3b82f6";
            if (s.fontSize) this.currentFontSize = s.fontSize;
            this.applyTheme(this.currentColorMode, accent);
          }
        }
      });
    }

    // Toggle Dropdowns
    this.folderTrigger?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleDropdown("folder");
    });

    this.categoryTrigger?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleDropdown("category");
    });

    this.customCollectionTrigger?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleDropdown("collection");
    });

    // Dropdown Search & Creator - Folder
    this.folderSearchInput?.addEventListener("input", () => this._onFolderSearch());
    this.folderSearchClear?.addEventListener("click", () => {
      if (this.folderSearchInput) {
        this.folderSearchInput.value = "";
        this._onFolderSearch();
        this.folderSearchInput.focus();
      }
    });
    this.folderNewBtn?.addEventListener("click", () => this._toggleFolderCreator());
    this.folderCreatorCancel?.addEventListener("click", () => this._closeFolderCreator());
    this.folderCreatorConfirm?.addEventListener("click", () => this._submitFolderCreator());
    this.folderCreatorInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this._submitFolderCreator();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this._closeFolderCreator();
      }
    });

    // Dropdown Search & Creator - Category (Shortcuts)
    this.categorySearchInput?.addEventListener("input", () => this._onCategorySearch());
    this.categorySearchClear?.addEventListener("click", () => {
      if (this.categorySearchInput) {
        this.categorySearchInput.value = "";
        this._onCategorySearch();
        this.categorySearchInput.focus();
      }
    });
    this.categoryNewBtn?.addEventListener("click", () => this._toggleCategoryCreator());
    this.categoryCreatorCancel?.addEventListener("click", () => this._closeCategoryCreator());
    this.categoryCreatorConfirm?.addEventListener("click", () => this._submitCategoryCreator());
    this.categoryCreatorInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this._submitCategoryCreator();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this._closeCategoryCreator();
      }
    });

    // Dropdown Search & Creator - Collection
    this.collectionSearchInput?.addEventListener("input", () => this._onCollectionSearch());
    this.collectionSearchClear?.addEventListener("click", () => {
      if (this.collectionSearchInput) {
        this.collectionSearchInput.value = "";
        this._onCollectionSearch();
        this.collectionSearchInput.focus();
      }
    });
    this.collectionNewBtn?.addEventListener("click", () => this._toggleCollectionCreator());
    this.collectionCreatorCancel?.addEventListener("click", () => this._closeCollectionCreator());
    this.collectionCreatorConfirm?.addEventListener("click", () => this._submitCollectionCreator());
    this.collectionCreatorInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this._submitCollectionCreator();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this._closeCollectionCreator();
      }
    });

    // Dismiss open dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".picker-trigger-box")) this.closeAllDropdowns();
      const details = document.querySelector(".popup-url-details");
      if (details?.open && !details.contains(e.target)) details.open = false;
    });

    // Tags
    this.tagsInput?.addEventListener("input", () => this._resetSavedState());
    this.tagsInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const val = this.tagsInput.value.replace(/,/g, "").trim();
        if (val) {
          this.addTagChip(val, true);
          this.tagsInput.value = "";
        }
      }
    });

    // Live-sync to active tab
    if (typeof chrome !== "undefined" && chrome.tabs?.onActivated) {
      chrome.tabs.onActivated.addListener(async ({ tabId }) => {
        try {
          const tab = await chrome.tabs.get(tabId);
          this._seedTab(tab);
        } catch { /* non-fatal */ }
      });
      chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (!tab || !tab.active) return;
        if (changeInfo.status === "complete" || changeInfo.url || changeInfo.title) {
          this._seedTab(tab);
        }
      });
    }
    if (typeof chrome !== "undefined" && chrome.windows?.onFocusChanged) {
      chrome.windows.onFocusChanged.addListener(async () => {
        try {
          const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          if (tabs && tabs[0]) this._seedTab(tabs[0]);
        } catch { /* non-fatal */ }
      });
    }

    // Search + keyboard selection work consistently for every destination picker.
    document.addEventListener("keydown", (e) => {
      const panel = e.target.closest(".picker-dropdown-panel");
      if (!panel) return;
      const options = [...panel.querySelectorAll('[role="option"]')];
      const index = options.indexOf(document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const next = index < 0 ? (e.key === "ArrowDown" ? 0 : options.length - 1)
          : (index + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
        options[next]?.focus();
      } else if (e.key === "Enter" && (index >= 0 || e.target.matches(".picker-dropdown-search-input"))) {
        e.preventDefault();
        const trigger = panel.closest(".picker-trigger-box")?.querySelector(".picker-trigger-btn");
        (options[index] || options[0])?.click();
        trigger?.focus();
      }
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.defaultPrevented) return;
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!this.btnQuickAddQuickie?.disabled) this.onQuickAddQuickie();
      } else if (e.key === "Escape") {
        const details = document.querySelector(".popup-url-details");
        if (details?.open) {
          e.preventDefault();
          details.open = false;
          details.querySelector("summary")?.focus();
        } else if (this.hasOpenDropdown()) {
          e.preventDefault();
          this.closeAllDropdowns();
        } else {
          window.close();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (this.form?.requestSubmit) this.form.requestSubmit();
        else this.onSubmit(e);
      }
    });
  }

  setDestinationType(type) {
    this.destinationType = type;
    const isBm = type === "bookmark";
    const isSc = type === "shortcut";
    const isCol = type === "collection";

    this.typeBtnBookmark?.classList.toggle("is-active", isBm);
    this.typeBtnBookmark?.setAttribute("aria-pressed", String(isBm));

    this.typeBtnShortcut?.classList.toggle("is-active", isSc);
    this.typeBtnShortcut?.setAttribute("aria-pressed", String(isSc));

    this.typeBtnCollection?.classList.toggle("is-active", isCol);
    this.typeBtnCollection?.setAttribute("aria-pressed", String(isCol));

    if (this.fieldFolder) this.fieldFolder.style.display = isBm ? "" : "none";
    if (this.fieldWorkspace) this.fieldWorkspace.style.display = "";
    const help = document.getElementById("destination-help");
    if (help) help.textContent = isSc
      ? "Keep a link handy in this workspace’s shortcuts."
      : isCol ? "Save a bookmark into a collection in this workspace."
      : "Choose a folder in your Chrome bookmarks.";
    if (this.fieldCategory) this.fieldCategory.style.display = isSc ? "" : "none";
    if (this.fieldCollection) this.fieldCollection.style.display = isCol ? "" : "none";

    this.closeAllDropdowns();
    this._resetSavedState();
  }

  _updateSubmitButtonLabel() {
    if (!this.submitBtnText) return;
    if (this.destinationType === "shortcut") {
      this.submitBtnText.textContent = "Save shortcut";
    } else if (this.destinationType === "collection") {
      this.submitBtnText.textContent = "Add to collection";
    } else {
      if (this.existingBookmark) {
        const currentFolderId = this.folderHidden?.value;
        const isDifferentFolder = currentFolderId && currentFolderId !== String(this.existingBookmark.parentId);
        const currentTitle = this.titleInput?.value.trim();
        const isDifferentTitle = currentTitle && currentTitle !== this.existingBookmark.title;

        if (isDifferentFolder) {
          this.submitBtnText.textContent = "Move bookmark";
        } else if (isDifferentTitle) {
          this.submitBtnText.textContent = "Update bookmark";
        } else {
          this.submitBtnText.textContent = "Save changes";
        }
      } else {
        this.submitBtnText.textContent = "Save bookmark";
      }
    }
  }

  _resetSavedState() {
    if (this._saveResetTimer) {
      clearTimeout(this._saveResetTimer);
      this._saveResetTimer = null;
    }
    if (this.submitBtn) {
      this.submitBtn.classList.remove("is-saved");
      this.submitBtn.disabled = false;
    }
    this._updateSubmitButtonLabel();
    const status = document.getElementById("save-status");
    if (status) status.textContent = "";
  }

  /* ============================================================
     Inline Dropdown Management
     ============================================================ */
  hasOpenDropdown() {
    return Boolean(this.activeDropdown);
  }

  closeAllDropdowns() {
    this.activeDropdown = null;

    if (this.folderDropdown) this.folderDropdown.hidden = true;
    this.folderTrigger?.classList.remove("is-open");
    this.folderTrigger?.setAttribute("aria-expanded", "false");
    this._closeFolderCreator();

    if (this.categoryDropdown) this.categoryDropdown.hidden = true;
    this.categoryTrigger?.classList.remove("is-open");
    this.categoryTrigger?.setAttribute("aria-expanded", "false");
    this._closeCategoryCreator();

    if (this.collectionDropdown) this.collectionDropdown.hidden = true;
    this.customCollectionTrigger?.classList.remove("is-open");
    this.customCollectionTrigger?.setAttribute("aria-expanded", "false");
    this._closeCollectionCreator();


  }

  _scrollOptionIntoView(option) {
    const list = option.closest(".picker-dropdown-list-wrap");
    if (list) list.scrollTop = option.offsetTop - list.offsetTop;
  }

  _positionDropdown() {
    const pair = { folder: [this.folderTrigger, this.folderDropdown], category: [this.categoryTrigger, this.categoryDropdown], collection: [this.customCollectionTrigger, this.collectionDropdown] }[this.activeDropdown];
    if (!pair) return;
    const [trigger, panel] = pair;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(352, document.documentElement.clientWidth - 32);
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const opensAbove = below < 190 && above > below;
    panel.style.width = `${width}px`;
    panel.style.left = `${Math.max(16, Math.min(rect.right - width, document.documentElement.clientWidth - width - 16))}px`;
    panel.style.top = opensAbove ? "auto" : `${rect.bottom + 6}px`;
    panel.style.bottom = opensAbove ? `${window.innerHeight - rect.top + 6}px` : "auto";
    panel.style.maxHeight = `${Math.max(80, Math.min(300, opensAbove ? above : below))}px`;
  }

  toggleDropdown(type) {
    if (this.activeDropdown === type) {
      this.closeAllDropdowns();
      return;
    }

    this.closeAllDropdowns();
    const details = document.querySelector(".popup-url-details");
    if (details) details.open = false;
    this.activeDropdown = type;

    if (type === "folder" && this.folderDropdown) {
      this.folderDropdown.hidden = false;
      this.folderTrigger?.classList.add("is-open");
      this.folderTrigger?.setAttribute("aria-expanded", "true");
      if (this.folderSearchInput) {
        this.folderSearchInput.value = "";
        this.folderSearchClear.hidden = true;
      }
      this._renderFolderList(this.folders);
      setTimeout(() => {
        const selected = this.folderList?.querySelector(".dropdown-item.is-selected");
        if (selected) this._scrollOptionIntoView(selected);
        this.folderSearchInput?.focus({ preventScroll: true });
      }, 50);
    } else if (type === "category" && this.categoryDropdown) {
      this.categoryDropdown.hidden = false;
      this.categoryTrigger?.classList.add("is-open");
      this.categoryTrigger?.setAttribute("aria-expanded", "true");
      if (this.categorySearchInput) {
        this.categorySearchInput.value = "";
        this.categorySearchClear.hidden = true;
      }
      this._renderCategoryList(this.categories);
      setTimeout(() => {
        const selected = this.categoryList?.querySelector(".dropdown-item.is-selected");
        if (selected) this._scrollOptionIntoView(selected);
        this.categorySearchInput?.focus({ preventScroll: true });
      }, 50);
    } else if (type === "collection" && this.collectionDropdown) {
      this.collectionDropdown.hidden = false;
      this.customCollectionTrigger?.classList.add("is-open");
      this.customCollectionTrigger?.setAttribute("aria-expanded", "true");
      if (this.collectionSearchInput) {
        this.collectionSearchInput.value = "";
        this.collectionSearchClear.hidden = true;
      }
      this._renderCollectionList(this.collections);
      setTimeout(() => {
        const selected = this.collectionList?.querySelector(".dropdown-item.is-selected");
        if (selected) this._scrollOptionIntoView(selected);
        this.collectionSearchInput?.focus({ preventScroll: true });
      }, 50);
    }
    this._positionDropdown();
  }

  /* ── Folder Dropdown Methods (Bookmarks) ───────────────── */
  _onFolderSearch() {
    const q = this.folderSearchInput?.value.trim().toLowerCase() || "";
    if (this.folderSearchClear) this.folderSearchClear.hidden = !q;
    const filtered = this.folders.filter((f) => {
      return !q || (f.title && f.title.toLowerCase().includes(q)) || (f.fullPath && f.fullPath.toLowerCase().includes(q));
    });
    this._renderFolderList(filtered);
  }

  _renderFolderList(folders) {
    if (!this.folderList) return;
    this.folderList.replaceChildren();
    if (!folders || folders.length === 0) {
      const empty = document.createElement("div");
      empty.className = "dropdown-empty-msg";
      empty.textContent = "No matching folders found";
      this.folderList.appendChild(empty);
      return;
    }

    const currentId = this.folderHidden?.value;
    for (const f of folders) {
      const li = document.createElement("li");
      li.className = "dropdown-item";
      li.tabIndex = 0;
      li.setAttribute("role", "option");
      li.dataset.value = f.id;
      if (f.id === currentId) li.classList.add("is-selected");
      li.title = f.fullPath || f.title;

      if (f.depth > 0) {
        const indent = document.createElement("span");
        indent.className = "dropdown-item-indent";
        indent.style.width = `${f.depth * 14}px`;
        li.appendChild(indent);
      }

      const icon = document.createElement("span");
      icon.className = "dropdown-item-icon";
      icon.appendChild(f.depth === 0 ? createSvgIcon("folder", 13) : createSvgIcon("chevron", 11));

      const title = document.createElement("span");
      title.className = "dropdown-item-title";
      title.textContent = f.title;

      li.append(icon, title);

      if (f.path && f.path.length > 0) {
        const hint = document.createElement("span");
        hint.className = "dropdown-item-hint";
        hint.textContent = f.path[f.path.length - 1];
        li.appendChild(hint);
      }

      li.setAttribute("aria-selected", String(li.classList.contains("is-selected")));
      const check = document.createElement("span");
      check.className = "dropdown-item-check";
      check.textContent = "✓";
      li.appendChild(check);

      li.addEventListener("click", () => {
        this.selectFolder(f.id, f.title);
        this.closeAllDropdowns();
      });

      this.folderList.appendChild(li);
    }
  }

  _toggleFolderCreator() {
    if (!this.folderCreatorBox) return;
    const isHidden = this.folderCreatorBox.hidden;
    this.folderCreatorBox.hidden = !isHidden;
    if (isHidden && this.folderCreatorInput) {
      this.folderCreatorInput.value = "";
      setTimeout(() => this.folderCreatorInput.focus(), 40);
    }
  }

  _closeFolderCreator() {
    if (this.folderCreatorBox) {
      this.folderCreatorBox.hidden = true;
      if (this.folderCreatorInput) this.folderCreatorInput.value = "";
    }
  }

  async _submitFolderCreator() {
    const name = this.folderCreatorInput?.value.trim();
    if (!name) return;
    try {
      const created = await chrome.bookmarks.create({ title: name, parentId: "1" });
      await this.populateFolders();
      if (created) this.selectFolder(created.id, created.title);
      this.closeAllDropdowns();
    } catch (err) {
      this.showError(err.message || "Failed to create folder");
    }
  }

  /* ── Category Dropdown Methods (Shortcuts) ─────────────── */
  _onCategorySearch() {
    const q = this.categorySearchInput?.value.trim().toLowerCase() || "";
    if (this.categorySearchClear) this.categorySearchClear.hidden = !q;
    const filtered = this.categories.filter((c) => !q || (c.name && c.name.toLowerCase().includes(q)));
    this._renderCategoryList(filtered);
  }

  _renderCategoryList(categories) {
    if (!this.categoryList) return;
    this.categoryList.replaceChildren();
    if (!categories || categories.length === 0) {
      const empty = document.createElement("div");
      empty.className = "dropdown-empty-msg";
      empty.textContent = "No categories found. Click '+ New' to create one.";
      this.categoryList.appendChild(empty);
      return;
    }

    const currentId = this.categoryHidden?.value;
    for (const c of categories) {
      const li = document.createElement("li");
      li.className = "dropdown-item";
      li.tabIndex = 0;
      li.setAttribute("role", "option");
      li.dataset.value = c.id;
      if (c.id === currentId) li.classList.add("is-selected");

      const icon = document.createElement("span");
      icon.className = "dropdown-item-icon";
      icon.appendChild(createSvgIcon("category", 13));

      const title = document.createElement("span");
      title.className = "dropdown-item-title";
      title.textContent = c.name;

      li.setAttribute("aria-selected", String(li.classList.contains("is-selected")));
      const check = document.createElement("span");
      check.className = "dropdown-item-check";
      check.textContent = "✓";

      li.append(icon, title, check);
      li.addEventListener("click", () => {
        this.selectCategory(c.id, c.name);
        this.closeAllDropdowns();
      });

      this.categoryList.appendChild(li);
    }
  }

  _toggleCategoryCreator() {
    if (!this.categoryCreatorBox) return;
    const isHidden = this.categoryCreatorBox.hidden;
    this.categoryCreatorBox.hidden = !isHidden;
    if (isHidden && this.categoryCreatorInput) {
      this.categoryCreatorInput.value = "";
      setTimeout(() => this.categoryCreatorInput.focus(), 40);
    }
  }

  _closeCategoryCreator() {
    if (this.categoryCreatorBox) {
      this.categoryCreatorBox.hidden = true;
      if (this.categoryCreatorInput) this.categoryCreatorInput.value = "";
    }
  }

  async _submitCategoryCreator() {
    const name = this.categoryCreatorInput?.value.trim();
    if (!name) return;
    try {
      let parentId = this.shortcutsFolderId;
      if (!parentId && this.useCases?.resolveShortcutsFolder) {
        parentId = await this.useCases.resolveShortcutsFolder.execute({
          workspaceId: this.workspaceHidden?.value || null,
          ensure: true,
        }).then((r) => r?.shortcutsFolderId || null);
      } else if (!parentId && this.useCases?.ensureShortcutsFolder) {
        parentId = await this.useCases.ensureShortcutsFolder.execute({
          workspaceId: this.workspaceHidden?.value || null,
        });
      }
      const created = await chrome.bookmarks.create({
        parentId: parentId || "2",
        title: name,
      });
      await this.populateCategories();
      if (created) this.selectCategory(created.id, created.title);
      this.closeAllDropdowns();
    } catch (err) {
      this.showError(err.message || "Failed to create category");
    }
  }

  /* ── Collection Dropdown Methods ────────────────────────── */
  _onCollectionSearch() {
    const q = this.collectionSearchInput?.value.trim().toLowerCase() || "";
    if (this.collectionSearchClear) this.collectionSearchClear.hidden = !q;
    const filtered = this.collections.filter((c) => !q || (c.name && c.name.toLowerCase().includes(q)));
    this._renderCollectionList(filtered);
  }

  _renderCollectionList(collections) {
    if (!this.collectionList) return;
    this.collectionList.replaceChildren();
    if (!collections || collections.length === 0) {
      const empty = document.createElement("div");
      empty.className = "dropdown-empty-msg";
      empty.textContent = "No collections found. Click '+ New' to create one.";
      this.collectionList.appendChild(empty);
      return;
    }

    const currentId = this.customCollectionHidden?.value;
    for (const c of collections) {
      const li = document.createElement("li");
      li.className = "dropdown-item";
      li.tabIndex = 0;
      li.setAttribute("role", "option");
      li.dataset.value = c.id;
      if (c.id === currentId) li.classList.add("is-selected");

      const icon = document.createElement("span");
      icon.className = "dropdown-item-icon";
      icon.appendChild(createSvgIcon("collection", 13));

      const title = document.createElement("span");
      title.className = "dropdown-item-title";
      title.textContent = c.name;

      const count = Array.isArray(c.bookmarkIds) ? c.bookmarkIds.length : 0;
      const hint = document.createElement("span");
      hint.className = "dropdown-item-hint";
      hint.textContent = `${count} item${count === 1 ? "" : "s"}`;

      li.setAttribute("aria-selected", String(li.classList.contains("is-selected")));
      const check = document.createElement("span");
      check.className = "dropdown-item-check";
      check.textContent = "✓";

      li.append(icon, title, hint, check);
      li.addEventListener("click", () => {
        this.selectCustomCollection(c.id, c.name);
        this.closeAllDropdowns();
      });

      this.collectionList.appendChild(li);
    }
  }

  _toggleCollectionCreator() {
    if (!this.collectionCreatorBox) return;
    const isHidden = this.collectionCreatorBox.hidden;
    this.collectionCreatorBox.hidden = !isHidden;
    if (isHidden && this.collectionCreatorInput) {
      this.collectionCreatorInput.value = "";
      setTimeout(() => this.collectionCreatorInput.focus(), 40);
    }
  }

  _closeCollectionCreator() {
    if (this.collectionCreatorBox) {
      this.collectionCreatorBox.hidden = true;
      if (this.collectionCreatorInput) this.collectionCreatorInput.value = "";
    }
  }

  async _submitCollectionCreator() {
    const name = this.collectionCreatorInput?.value.trim();
    if (!name) return;
    try {
      if (this.useCases?.createBookmarkCollection) {
        const created = await this.useCases.createBookmarkCollection.execute({
          name,
          workspaceId: this.workspaceHidden?.value || null,
        });
        await this.populateCollections();
        if (created) this.selectCustomCollection(created.id, created.name);
      }
      this.closeAllDropdowns();
    } catch (err) {
      this.showError(err.message || "Failed to create collection");
    }
  }

  /* ── Workspace quick buttons ─────────────────────────── */
  // Direct workspace selection, with infrequent choices behind More.
  _renderWorkspaceButtons() {
    if (!this.workspaceButtons) return;
    const activeId = this.workspaceHidden?.value || "";
    const choices = rankPopupWorkspaces(this.groups, activeId, this.workspaceUsage);
    const visible = this.workspacesExpanded ? choices : choices.slice(0, 3);
    this.workspaceButtons.replaceChildren();
    for (const group of visible) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-chip";
      button.dataset.workspaceId = group.id;
      button.setAttribute("aria-pressed", String(group.id === activeId));
      button.title = group.name;
      button.textContent = group.name;
      button.addEventListener("click", () => {
        this.selectWorkspace(group.id || null, group.name);
        [...this.workspaceButtons.querySelectorAll("[data-workspace-id]")]
          .find((item) => item.dataset.workspaceId === group.id)?.focus({ preventScroll: true });
      });
      this.workspaceButtons.appendChild(button);
    }
    if (choices.length > 3) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "workspace-more";
      more.textContent = this.workspacesExpanded ? "Less" : "More";
      more.setAttribute("aria-expanded", String(this.workspacesExpanded));
      more.setAttribute("aria-controls", "workspace-buttons");
      more.addEventListener("click", () => {
        this.workspacesExpanded = !this.workspacesExpanded;
        this.closeAllDropdowns();
        this._renderWorkspaceButtons();
        this.workspaceButtons.querySelector(".workspace-more")?.focus({ preventScroll: true });
      });
      this.workspaceButtons.appendChild(more);
    }
  }

  async _rememberWorkspace() {
    const id = this.workspaceHidden?.value;
    if (!id) return;
    this.workspaceUsage[id] = (Number(this.workspaceUsage[id]) || 0) + 1;
    await writeLocal("popupWorkspaceUsage", this.workspaceUsage);
  }

  /* ============================================================
     Initialization & Data Loading
     ============================================================ */
  async init() {
    try {
      this.useCases = buildContainer().useCases;
    } catch (err) {
      this.showError("Failed to start: " + (err?.message || err));
      if (this.submitBtn) this.submitBtn.disabled = true;
      return;
    }

    await this.initTheme();
    if (this.useCases.getBookmarkLibrary && (await this.useCases.getBookmarkLibrary.execute()).needsSetup) {
      this.showError("Open a new tab to choose your bookmark setup first.");
      if (this.submitBtn) this.submitBtn.disabled = true;
      if (this.btnQuickAddQuickie) this.btnQuickAddQuickie.disabled = true;
      return;
    }

    if (this.useCases.ensureQuickieFolder) {
      this.useCases.ensureQuickieFolder.execute({ allowCreate: false }).catch((err) => {
        console.warn("Could not ensure quickie folder:", err);
      });
    }

    // Bootstrap global Shortcuts only when no active workspace; workspace path
    // is ensured later via resolveShortcutsFolder / ensureWorkspaceStructure.
    if (this.useCases.resolveShortcutsFolder && !this.workspaceHidden?.value) {
      this.useCases.resolveShortcutsFolder.execute({ workspaceId: null, ensure: false }).catch((err) => {
        console.warn("Could not ensure shortcuts folder:", err);
      });
    } else if (this.useCases.ensureShortcutsFolder && !this.workspaceHidden?.value) {
      this.useCases.ensureShortcutsFolder.execute({ allowCreate: false }).catch((err) => {
        console.warn("Could not ensure shortcuts folder:", err);
      });
    }

    await Promise.all([
      this.populateWorkspaces(),
      this.populateFolders(),
    ]);

    await this.seedFromActiveTab({ focusTitle: false });
    this.form?.addEventListener("submit", (event) => this.onSubmit(event));
    this.btnQuickAddQuickie?.addEventListener("click", () => this.onQuickAddQuickie());
  }

  async initTheme() {
    try {
      let storedPopupMode = null;
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        const stored = await chrome.storage.local.get(["popupColorMode"]);
        storedPopupMode = stored?.popupColorMode;
      }

      let s = null;
      if (this.useCases?.getSettings) {
        s = await this.useCases.getSettings.execute();
      }

      this.currentAccentColor = s?.cssVarAccent || "#3b82f6";
      let mode = storedPopupMode || s?.colorMode;
      if (mode !== "dark" && mode !== "light") {
        mode = "light";
      }
      this.currentColorMode = mode;
      this.currentFontSize = s?.fontSize || "default";
    } catch {
      this.currentColorMode = "light";
      this.currentAccentColor = "#3b82f6";
      this.currentFontSize = "default";
    }
    this.applyTheme(this.currentColorMode, this.currentAccentColor);
  }

  applyTheme(mode, accentHex) {
    this.currentColorMode = mode;
    this.currentAccentColor = accentHex || "#3b82f6";
    document.documentElement.setAttribute("data-color-mode", mode);
    document.documentElement.setAttribute("data-font-size", this.currentFontSize || "default");
    const fontScales = { small: "0.88", default: "1", large: "1.14", xlarge: "1.28" };
    document.documentElement.style.setProperty("--ui-font-scale", fontScales[this.currentFontSize || "default"] || "1");

    const accentVars = deriveAccentShades(this.currentAccentColor, mode);
    for (const [prop, val] of Object.entries(accentVars)) {
      document.documentElement.style.setProperty(prop, val);
    }
  }

  async toggleTheme() {
    this.currentColorMode = this.currentColorMode === "dark" ? "light" : "dark";
    this.applyTheme(this.currentColorMode, this.currentAccentColor);
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.set({ popupColorMode: this.currentColorMode });
      }
    } catch (err) {
      console.warn("Could not save popupColorMode:", err);
    }
  }

  async populateWorkspaces() {
    try {
      this.groups = await this.useCases.listBookmarkGroups.execute();
      const usage = await readLocal("popupWorkspaceUsage");
      this.workspaceUsage = usage && typeof usage === "object" && !Array.isArray(usage) ? usage : {};
      let activeId = null;
      if (this.useCases?.setActiveGroup?.getActive) {
        activeId = await this.useCases.setActiveGroup.getActive();
      }
      const active = this.groups.find((g) => g.id === activeId) || null;
      await this.selectWorkspace(active ? active.id : null, active ? active.name : "All Bookmarks", active ? active.color : null);
      this._renderWorkspaceButtons();
    } catch { /* non-fatal */ }
  }

  selectWorkspace(id, name, color) {
    if (this.workspaceHidden) this.workspaceHidden.value = id ?? "";
    this._resetSavedState();
    this.filterFoldersByWorkspace(id);
    this.closeAllDropdowns();
    this._renderWorkspaceButtons();
    // Serialize refreshes so rapid switches cannot leave stale destinations.
    this._workspaceRefresh = (this._workspaceRefresh || Promise.resolve()).then(() => Promise.all([
      this.populateCollections(),
      this.populateCategories(),
    ])).then(async () => {
      if (id && this.useCases?.resolveWorkspaceStructure) {
        const local = await this.useCases.resolveWorkspaceStructure.execute({ workspaceId: id });
        if (local?.found) this.selectFolder(local.rootFolderId, local.root.title, { persist: false });
        else if (this.folderHidden) this.folderHidden.value = "";
      }
    });
    return this._workspaceRefresh;
  }

  async populateFolders() {
    try {
      const raw = typeof chrome !== "undefined" && chrome.bookmarks ? await chrome.bookmarks.getTree() : [];
      this.folders = flattenFolders(raw);

      const [storedLast, storedRecents] = await Promise.all([
        readLocal(LAST_FOLDER_KEY),
        readLocal(RECENT_FOLDERS_KEY),
      ]);
      const validIds = new Set(this.folders.map((f) => f.id));
      this.recentFolders = Array.isArray(storedRecents)
        ? storedRecents.filter((f) => f && f.id && validIds.has(String(f.id)))
        : [];

      const last = (storedLast && validIds.has(String(storedLast.id))) ? storedLast : null;
      const bar = this.folders.find((f) => f.id === "1" || /bookmarks bar|favorites bar/i.test(f.title)) || this.folders[0];

      if (this.recentFolders.length === 0 && bar) {
        this.recentFolders = [{ id: bar.id, title: bar.title }];
      }
      if (last) {
        this.selectFolder(last.id, last.title, { persist: false });
      } else if (bar) {
        this.selectFolder(bar.id, bar.title, { persist: false });
      }
      this._renderFolderQuickChips();
      this._renderFolderList(this.folders);
    } catch {
      if (this.folderLabel) this.folderLabel.textContent = "No folders found";
    }
  }

  filterFoldersByWorkspace(groupId) {
    const group = this.groups.find((g) => g.id === groupId);
    if (!group) {
      // No active workspace → leave global folder list as-is
      return;
    }
    const systemTitles = new Set(["collections", "shortcuts", "quickie"]);
    const isSystem = (f) => systemTitles.has(String(f.title || "").trim().toLowerCase());
    const rootId = group.rootFolderId || group.folderIds?.[0] || null;
    let scoped = this.folders.filter((f) => (group.folderIds || []).includes(f.id) && !isSystem(f));
    // Prefer the dedicated workspace root subtree when present
    if (rootId && this.folders.some((f) => f.id === rootId)) {
      scoped = this.folders.filter((f) => !isSystem(f) && (f.id === rootId || String(f.parentId || "") === rootId));
    }
    if (scoped.length) this.selectFolder(scoped[0].id, scoped[0].title, { persist: false });
  }

  selectFolder(id, name, { persist = true } = {}) {
    if (this.folderHidden) this.folderHidden.value = id;
    if (this.folderLabel) this.folderLabel.textContent = name;
    if (persist) this._rememberFolder(id, name);
    this._renderFolderQuickChips();
    this._resetSavedState();
  }

  async _rememberFolder(id, name) {
    if (!id) return;
    const entry = { id: String(id), title: String(name || "Folder") };
    this.recentFolders = [
      entry,
      ...this.recentFolders.filter((f) => f.id !== entry.id),
    ].slice(0, MAX_RECENT_CHIPS);
    await writeLocal(RECENT_FOLDERS_KEY, this.recentFolders);
    await writeLocal(LAST_FOLDER_KEY, entry);
  }

  _renderFolderQuickChips() {
    if (!this.folderQuickRow) return;
    const validIds = new Set(this.folders.map((f) => f.id));
    const visible = this.recentFolders.filter((f) => validIds.has(f.id) && f.id !== this.folderHidden?.value);
    const currentId = this.folderHidden?.value;

    this.folderQuickRow.replaceChildren();
    for (const f of visible.slice(0, MAX_RECENT_CHIPS)) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "picker-quick-chip" + (f.id === currentId ? " is-active" : "");
      chip.title = f.title;
      const icon = createSvgIcon("folder", 12, "picker-chip-icon");
      const label = document.createElement("span");
      label.textContent = f.title;
      chip.append(icon, label);
      chip.addEventListener("click", () => {
        this.selectFolder(f.id, f.title);
        this.closeAllDropdowns();
      });
      this.folderQuickRow.appendChild(chip);
    }
  }

  /* ── Category Data & State (Shortcuts) ─────────────────── */
  async populateCategories() {
    try {
      const raw = typeof chrome !== "undefined" && chrome.bookmarks ? await chrome.bookmarks.getTree() : [];
      let shortcutsFolderId = null;
      const workspaceId = this.workspaceHidden?.value || null;
      if (this.useCases?.ensureShortcutsFolder) {
        shortcutsFolderId = workspaceId
          ? await this.useCases.ensureShortcutsFolder.execute({ tree: raw, workspaceId, allowCreate: false })
          : await this.useCases.ensureShortcutsFolder.execute({ tree: raw, allowCreate: false });
      }
      this.shortcutsFolderId = shortcutsFolderId;

      let cats = [];
      if (shortcutsFolderId) {
        const findFolder = (nodes, id) => {
          for (const n of nodes || []) {
            if (String(n.id) === String(id)) return n;
            if (n.children) {
              const f = findFolder(n.children, id);
              if (f) return f;
            }
          }
          return null;
        };
        const shortcutsNode = findFolder(raw, shortcutsFolderId);
        if (shortcutsNode && Array.isArray(shortcutsNode.children)) {
          for (const child of shortcutsNode.children) {
            if (!child.url) {
              cats.push({ id: String(child.id), name: child.title || "Category" });
            }
          }
        }
      }

      this.categories = cats;

      const [storedLast, storedRecents] = await Promise.all([
        readLocal(LAST_CATEGORY_KEY),
        readLocal(RECENT_CATEGORIES_KEY),
      ]);
      const validIds = new Set(this.categories.map((c) => c.id));
      this.recentCategories = Array.isArray(storedRecents)
        ? storedRecents.filter((c) => c && c.id && validIds.has(String(c.id)))
        : [];

      const last = (storedLast && validIds.has(String(storedLast.id))) ? storedLast : null;
      if (this.recentCategories.length === 0 && this.categories[0]) {
        this.recentCategories = [{ id: this.categories[0].id, name: this.categories[0].name }];
      }

      if (last) {
        this.selectCategory(last.id, last.name, { persist: false });
      } else if (this.categories.length > 0) {
        this.selectCategory(this.categories[0].id, this.categories[0].name, { persist: false });
      } else {
        if (this.categoryHidden) this.categoryHidden.value = "";
        if (this.categoryLabel) this.categoryLabel.textContent = "Select category";
      }

      this._renderCategoryQuickChips();
      this._renderCategoryList(this.categories);
    } catch {
      if (this.categoryLabel) this.categoryLabel.textContent = "Select Category";
    }
  }

  selectCategory(id, name, { persist = true } = {}) {
    if (this.categoryHidden) this.categoryHidden.value = id;
    if (this.categoryLabel) this.categoryLabel.textContent = name;
    if (persist) this._rememberCategory(id, name);
    this._renderCategoryQuickChips();
    this._resetSavedState();
  }

  async _rememberCategory(id, name) {
    if (!id) return;
    const entry = { id: String(id), name: String(name || "Category") };
    this.recentCategories = [
      entry,
      ...this.recentCategories.filter((c) => c.id !== entry.id),
    ].slice(0, MAX_RECENT_CHIPS);
    await writeLocal(RECENT_CATEGORIES_KEY, this.recentCategories);
    await writeLocal(LAST_CATEGORY_KEY, entry);
  }

  _renderCategoryQuickChips() {
    if (!this.categoryQuickRow) return;
    const validIds = new Set(this.categories.map((c) => c.id));
    const visible = this.recentCategories.filter((c) => validIds.has(c.id) && c.id !== this.categoryHidden?.value);
    const currentId = this.categoryHidden?.value;

    this.categoryQuickRow.replaceChildren();
    for (const c of visible.slice(0, MAX_RECENT_CHIPS)) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "picker-quick-chip" + (c.id === currentId ? " is-active" : "");
      chip.title = c.name;
      const icon = createSvgIcon("category", 12, "picker-chip-icon");
      const label = document.createElement("span");
      label.textContent = c.name;
      chip.append(icon, label);
      chip.addEventListener("click", () => {
        this.selectCategory(c.id, c.name);
        this.closeAllDropdowns();
      });
      this.categoryQuickRow.appendChild(chip);
    }
  }

  /* ── Collection Data & State ────────────────────────────── */
  async populateCollections() {
    try {
      if (this.useCases?.listBookmarkCollections) {
        // Prefer workspace-scoped collections when a workspace is active
        const workspaceId = this.workspaceHidden?.value || null;
        this.collections = workspaceId
          ? await this.useCases.listBookmarkCollections.execute({ workspaceId })
          : await this.useCases.listBookmarkCollections.execute();
      } else {
        this.collections = [];
      }

      const [storedLast, storedRecents] = await Promise.all([
        readLocal(LAST_COLLECTION_KEY),
        readLocal(RECENT_COLLECTIONS_KEY),
      ]);
      const validIds = new Set(this.collections.map((c) => c.id));
      this.recentCollections = Array.isArray(storedRecents)
        ? storedRecents.filter((c) => c && c.id && validIds.has(String(c.id)))
        : [];

      const last = (storedLast && validIds.has(String(storedLast.id))) ? storedLast : null;
      if (this.recentCollections.length === 0 && this.collections[0]) {
        this.recentCollections = [{ id: this.collections[0].id, name: this.collections[0].name }];
      }

      if (last) {
        this.selectCustomCollection(last.id, last.name, { persist: false });
      } else if (this.collections.length > 0) {
        this.selectCustomCollection(this.collections[0].id, this.collections[0].name, { persist: false });
      } else {
        if (this.customCollectionHidden) this.customCollectionHidden.value = "";
        if (this.customCollectionLabel) this.customCollectionLabel.textContent = "Select collection";
      }

      this._renderCollectionQuickChips();
      this._renderCollectionList(this.collections);
    } catch {
      if (this.customCollectionLabel) this.customCollectionLabel.textContent = "Create collection";
    }
  }

  async _rememberCollection(id, name) {
    if (!id) return;
    const entry = { id: String(id), name: String(name || "Collection") };
    this.recentCollections = [
      entry,
      ...this.recentCollections.filter((c) => c.id !== entry.id),
    ].slice(0, MAX_RECENT_CHIPS);
    await writeLocal(RECENT_COLLECTIONS_KEY, this.recentCollections);
    await writeLocal(LAST_COLLECTION_KEY, entry);
  }

  selectCustomCollection(id, name, { persist = true } = {}) {
    if (this.customCollectionHidden) this.customCollectionHidden.value = id;
    if (this.customCollectionLabel) this.customCollectionLabel.textContent = name;
    if (persist) this._rememberCollection(id, name);
    this._renderCollectionQuickChips();
    this._resetSavedState();
  }

  _renderCollectionQuickChips() {
    if (!this.collectionQuickRow) return;
    const validIds = new Set(this.collections.map((c) => c.id));
    const visible = this.recentCollections.filter((c) => validIds.has(c.id) && c.id !== this.customCollectionHidden?.value);
    const currentId = this.customCollectionHidden?.value;

    this.collectionQuickRow.replaceChildren();
    for (const c of visible.slice(0, MAX_RECENT_CHIPS)) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "picker-quick-chip" + (c.id === currentId ? " is-active" : "");
      chip.title = c.name;
      const icon = createSvgIcon("collection", 12, "picker-chip-icon");
      const label = document.createElement("span");
      label.textContent = c.name;
      chip.append(icon, label);
      chip.addEventListener("click", () => {
        this.selectCustomCollection(c.id, c.name);
        this.closeAllDropdowns();
      });
      this.collectionQuickRow.appendChild(chip);
    }
  }

  async seedFromActiveTab({ focusTitle = true } = {}) {
    let tab = null;
    try {
      let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => []);
      if (!tabs || tabs.length === 0) {
        tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      }
      tab = tabs && tabs[0] ? tabs[0] : null;
    } catch (err) {
      console.warn("Could not query active tab:", err);
    }
    await this._seedTab(tab, { focusTitle });
  }

  async _seedTab(tab, { focusTitle = false, isLiveSwitch = false } = {}) {
    if (this._saveResetTimer) {
      clearTimeout(this._saveResetTimer);
      this._saveResetTimer = null;
    }

    this.clearError();

    if (this.btnQuickAddQuickie) {
      this.btnQuickAddQuickie.disabled = false;
      this.btnQuickAddQuickie.classList.remove("is-saved");
      const text = this.btnQuickAddQuickie.querySelector(".popup-quickie-btn-text");
      if (text) text.textContent = "Quickie";
    }
    const status = document.getElementById("save-status");
    if (status) status.textContent = "";
    if (this.tagsInput) this.tagsInput.value = "";

    // Reset button state to fresh/ready state on any tab switch
    if (this.submitBtn) {
      this.submitBtn.classList.remove("is-saved");
      this.submitBtn.disabled = false;
    }

    if (tab && tab.url) {
      this.urlInput.value = tab.url;
      this.titleInput.value = tab.title || hostnameOf(tab.url) || "";
      if (this.domainEl) this.domainEl.textContent = hostnameOf(tab.url) || "New Bookmark";
      if (this.faviconEl) {
        if (tab.favIconUrl) {
          this.faviconEl.src = tab.favIconUrl;
          this.faviconEl.hidden = false;
        } else {
          this.faviconEl.hidden = true;
        }
      }
      if (this.tagsList) this.tagsList.replaceChildren();
      this.activeTags.clear();
      const suggested = extractSuggestedTags(tab.title);
      for (const t of suggested) this.addTagChip(t, false);

      // Start with banner guaranteed hidden while querying
      this._setExistingBookmark(null);
      await this.checkExistingBookmark(tab.url);
    } else {
      if (this.domainEl) this.domainEl.textContent = "New Bookmark";
      if (this.faviconEl) this.faviconEl.hidden = true;
      this._setExistingBookmark(null);
    }

    this._updateSubmitButtonLabel();
    if (focusTitle) setTimeout(() => this.titleInput?.focus(), 80);
  }

  async checkExistingBookmark(url) {
    if (!url || typeof chrome === "undefined" || !chrome.bookmarks?.getTree) {
      this._setExistingBookmark(null);
      return;
    }

    try {
      const tree = await chrome.bookmarks.getTree().catch(() => []);
      const match = findExactBookmarkInTree(tree, url);

      if (match) {
        this._setExistingBookmark(match.node, match.fullPath, match.folderTitle, match.folderId);
      } else {
        this._setExistingBookmark(null);
      }
    } catch (err) {
      console.debug("[Popup] checkExistingBookmark error:", err);
      this._setExistingBookmark(null);
    }
  }

  _setExistingBookmark(node, fullPath = "", folderTitle = "", folderId = "") {
    this.existingBookmark = node;
    this.existingFolderName = fullPath || folderTitle;

    if (!node) {
      if (this.existingBanner) {
        this.existingBanner.hidden = true;
        this.existingBanner.classList.remove("is-visible");
        this.existingBanner.style.setProperty("display", "none", "important");
      }
      this._updateSubmitButtonLabel();
      return;
    }

    if (this.existingBanner) {
      this.existingBanner.hidden = false;
      this.existingBanner.classList.add("is-visible");
      this.existingBanner.style.removeProperty("display");
      if (this.existingFolderNameEl) {
        this.existingFolderNameEl.textContent = fullPath || folderTitle || "Bookmarks";
      }
    }

    // Pre-select the existing folder if in bookmark mode
    if (this.destinationType === "bookmark" && (folderId || node.parentId)) {
      const targetId = folderId || node.parentId;
      this.selectFolder(targetId, folderTitle || "Bookmarks", { persist: false });
    }

    this._updateSubmitButtonLabel();
  }

  openExistingBookmarkLocation() {
    if (!this.existingBookmark) return;
    const folderId = this.existingBookmark.parentId || "1";
    try {
      if (typeof chrome !== "undefined" && chrome.tabs?.create) {
        chrome.tabs.create({ url: `chrome://bookmarks/?id=${folderId}` });
        window.close();
      }
    } catch (err) {
      console.warn("Could not open bookmarks manager:", err);
    }
  }

  async openSidePanel() {
    try {
      if (typeof chrome !== "undefined" && chrome.sidePanel?.open && chrome.windows) {
        const currentWin = await chrome.windows.getCurrent();
        if (currentWin?.id) {
          await chrome.sidePanel.open({ windowId: currentWin.id });
          window.close();
        }
      }
    } catch (err) {
      console.warn("[Popup] Failed to open side panel:", err);
    }
  }

  _onContextMenu(e) {
    if (e.target.closest("input, textarea, [contenteditable]")) return;
    e.preventDefault();
    this._closeContextMenu();

    if (this.isSidePanel) return; // Already in sidepanel

    const menu = document.createElement("div");
    menu.className = "popup-context-menu";

    const item = document.createElement("button");
    item.type = "button";
    item.className = "popup-context-item";
    item.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/></svg>
      <span>Open from sidebar</span>
    `;
    item.addEventListener("click", () => {
      this._closeContextMenu();
      this.openSidePanel();
    });

    menu.appendChild(item);
    document.body.appendChild(menu);
    this._activeContextMenu = menu;

    const x = Math.min(window.innerWidth - 170, e.clientX);
    const y = Math.min(window.innerHeight - 50, e.clientY);
    menu.style.left = `${Math.max(8, x)}px`;
    menu.style.top = `${Math.max(8, y)}px`;
  }

  _closeContextMenu() {
    if (this._activeContextMenu) {
      this._activeContextMenu.remove();
      this._activeContextMenu = null;
    }
  }

  addTagChip(tag, isActive = false) {
    const clean = tag.toLowerCase().replace(/^[#\s]+|[#\s]+$/g, "");
    if (!clean) return;

    if (this.activeTags.has(clean)) {
      if (isActive) {
        const existing = [...(this.tagsList?.querySelectorAll("[data-tag]") || [])].find((chip) => chip.dataset.tag === clean);
        if (existing) { existing.classList.add("is-active"); existing.setAttribute("aria-pressed", "true"); }
      }
      return;
    }

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "popup-tag-chip" + (isActive ? " is-active" : "");
    chip.dataset.tag = clean;
    chip.setAttribute("aria-pressed", String(isActive));
    chip.textContent = `#${clean}`;
    chip.addEventListener("click", () => {
      chip.classList.toggle("is-active");
      chip.setAttribute("aria-pressed", String(chip.classList.contains("is-active")));
      this._resetSavedState();
    });
    this.tagsList?.appendChild(chip);
    this.activeTags.add(clean);
  }

  getSelectedTags() {
    const activeChips = this.tagsList?.querySelectorAll(".popup-tag-chip.is-active") || [];
    return Array.from(activeChips).map((c) => c.dataset.tag).filter(Boolean);
  }

  clearError() {
    if (this.errorEl) {
      this.errorEl.textContent = "";
      this.errorEl.classList.remove("is-visible");
    }
  }

  showError(msg) {
    if (this.errorEl) {
      this.errorEl.textContent = msg;
      this.errorEl.classList.add("is-visible");
    }
  }

  async _saveTags(bookmarkId) {
    if (!bookmarkId || !this.useCases?.setBookmarkTags) return;
    const pending = this.tagsInput?.value.trim();
    const tags = [...this.getSelectedTags(), ...(pending ? pending.split(",") : [])];
    if (!tags.length) return;
    try {
      const existing = await this.useCases.listBookmarkTags.execute();
      await this.useCases.setBookmarkTags.execute({ bookmarkId, tags: [...(existing[bookmarkId] || []), ...tags] });
    } catch {
      this.showError("Bookmark saved, but tags could not be saved.");
    }
  }

  async onSubmit(event) {
    if (event) event.preventDefault();
    let refresh;
    do {
      refresh = this._workspaceRefresh;
      if (refresh) await refresh;
    } while (refresh !== this._workspaceRefresh);
    if (this._saving || this.submitBtn?.classList.contains("is-saved")) return;
    this.clearError();
    this.closeAllDropdowns();

    const title = this.titleInput.value.trim();
    const url = this.urlInput.value.trim();

    if (!url) {
      this.showError("URL is required.");
      this.urlInput.focus();
      return;
    }

    if (!title) {
      this.showError("Title is required.");
      this.titleInput.focus();
      return;
    }

    if (this.submitBtn) {
      this.submitBtn.disabled = true;
      if (this.submitBtnText) this.submitBtnText.textContent = "Saving...";
    }

    this._saving = true;
    if (this.btnQuickAddQuickie) this.btnQuickAddQuickie.disabled = true;
    let savedBookmark;
    try {
      if (this.destinationType === "shortcut") {
        let targetCategoryId = this.categoryHidden?.value;
        if (!targetCategoryId) {
          if (this.categories && this.categories.length > 0) {
            targetCategoryId = this.categories[0].id;
          } else {
            let shortcutsFolderId = this.shortcutsFolderId;
            if (!shortcutsFolderId && this.useCases?.resolveShortcutsFolder) {
              shortcutsFolderId = await this.useCases.resolveShortcutsFolder.execute({
                workspaceId: this.workspaceHidden?.value || null,
                ensure: true,
              }).then((r) => r?.shortcutsFolderId || null);
            } else if (!shortcutsFolderId && this.useCases?.ensureShortcutsFolder) {
              shortcutsFolderId = await this.useCases.ensureShortcutsFolder.execute({
                workspaceId: this.workspaceHidden?.value || null,
              });
            }
            if (!shortcutsFolderId) throw new Error("Your shortcut destination is unavailable. Wait for Chrome to finish syncing.");
            const createdCat = await chrome.bookmarks.create({
              parentId: shortcutsFolderId,
              title: "Quick Access",
            });
            targetCategoryId = createdCat.id;
          }
        }

        savedBookmark = await chrome.bookmarks.create({
          parentId: String(targetCategoryId),
          title,
          url,
        });

        const usedCat = this.categories.find((c) => c.id === String(targetCategoryId));
        if (usedCat) await this._rememberCategory(usedCat.id, usedCat.name);
      } else if (this.destinationType === "collection") {
        let collectionId = this.customCollectionHidden?.value;
        if (!collectionId && this.collections && this.collections.length > 0) {
          collectionId = this.collections[0].id;
        }
        if (!collectionId && this.useCases?.createBookmarkCollection) {
          const created = await this.useCases.createBookmarkCollection.execute({
            name: "Favorites",
            workspaceId: this.workspaceHidden?.value || null,
          });
          collectionId = created.id;
          await this.populateCollections();
        }

        const targetColl = Array.isArray(this.collections) ? this.collections.find((c) => c.id === collectionId) : null;
        let parentId = targetColl?.folderId;
        if (this.useCases.resolveCollectionFolder) {
          if (!targetColl) throw new Error("Choose an available collection before saving.");
          parentId = await this.useCases.resolveCollectionFolder.execute(targetColl);
        }
        if (!parentId) {
          const workspaceId = this.workspaceHidden?.value || null;
          if (workspaceId && this.useCases?.ensureWorkspaceStructure) {
            const structure = await this.useCases.ensureWorkspaceStructure.execute(workspaceId).catch(() => null);
            parentId = structure?.collectionsFolderId || null;
          }
          if (!parentId && this.useCases?.ensureCollectionsFolder) {
            parentId = await this.useCases.ensureCollectionsFolder.execute();
          }
        }
        if (!parentId) throw new Error("Your collection destination is unavailable. Wait for Chrome to finish syncing.");

        const createdBm = await chrome.bookmarks.create({ parentId, title, url });
        savedBookmark = createdBm;
        if (collectionId && this.useCases?.updateCollectionMembers && createdBm?.id) {
          await this.useCases.updateCollectionMembers.execute({
            collectionId,
            add: [createdBm.id],
            urls: [url],
          });
        }

        if (collectionId && targetColl) {
          await this._rememberCollection(collectionId, targetColl.name);
        }
      } else {
        // Standard Bookmark Mode
        if (this.workspaceHidden?.value && !this.folderHidden.value) throw new Error("This workspace is unavailable. Wait for Chrome to finish syncing.");
        const parentId = this.folderHidden.value || "1";

        if (this.existingBookmark?.id) {
          // Bookmark already exists: move or update title without duplicating
          if (String(this.existingBookmark.parentId) !== String(parentId)) {
            await chrome.bookmarks.move(this.existingBookmark.id, { parentId: String(parentId) });
            this.existingBookmark.parentId = String(parentId);
          }
          if (this.existingBookmark.title !== title) {
            await chrome.bookmarks.update(this.existingBookmark.id, { title });
            this.existingBookmark.title = title;
          }
          savedBookmark = this.existingBookmark;
          const usedFolder = this.folders.find((f) => f.id === String(parentId));
          if (usedFolder) await this._rememberFolder(usedFolder.id, usedFolder.title);
        } else {
          // New bookmark
          const created = await chrome.bookmarks.create({
            parentId,
            title,
            url,
          });
          if (created) this.existingBookmark = created;
          savedBookmark = this.existingBookmark;
          const usedFolder = this.folders.find((f) => f.id === String(parentId));
          if (usedFolder) await this._rememberFolder(usedFolder.id, usedFolder.title);
        }
      }
      await this._saveTags(savedBookmark?.id);
      await this._rememberWorkspace();
    } catch (err) {
      if (this.submitBtn) {
        this.submitBtn.disabled = false;
        this._updateSubmitButtonLabel();
      }
      this.showError(err?.message || "Failed to save bookmark.");
      return;
    } finally {
      this._saving = false;
      if (this.btnQuickAddQuickie) this.btnQuickAddQuickie.disabled = false;
    }

    const destination = this.destinationType === "shortcut" ? this.categoryLabel?.textContent
      : this.destinationType === "collection" ? this.customCollectionLabel?.textContent : this.folderLabel?.textContent;
    const status = document.getElementById("save-status");
    if (status) status.textContent = `Saved to ${destination || "bookmarks"}.`;
    if (this.submitBtn) this.submitBtn.classList.add("is-saved");
    if (this.submitBtnText) this.submitBtnText.textContent = "Saved";
    if (this.submitBtn) this.submitBtn.disabled = true;

    if (this.isSidePanel) {
      // In Side Panel mode, keep panel open and automatically reset after 1.8 seconds
      if (this._saveResetTimer) clearTimeout(this._saveResetTimer);
      this._saveResetTimer = setTimeout(() => {
        this._resetSavedState();
      }, 1800);
    }
  }

  async onQuickAddQuickie() {
    if (this._saving) return;
    this.clearError();
    this.closeAllDropdowns();

    const title = this.titleInput?.value?.trim() || document.title || "Untitled";
    const url = this.urlInput?.value?.trim() || "";

    if (!url) {
      this.showError("URL is required to save to Quickies.");
      this.urlInput?.focus();
      return;
    }

    const quickBtn = this.btnQuickAddQuickie;
    const quickText = quickBtn?.querySelector(".popup-quickie-btn-text");
    const quickBadge = quickBtn?.querySelector(".popup-quickie-badge");
    this._saving = true;
    if (this.submitBtn) this.submitBtn.disabled = true;
    if (quickBtn) quickBtn.disabled = true;
    if (quickText) quickText.textContent = "Saving...";

    try {
      let quickieFolderId = null;
      if (this.useCases?.ensureQuickieFolder) {
        quickieFolderId = await this.useCases.ensureQuickieFolder.execute();
      }
      if (!quickieFolderId) {
        const other = this.folders?.find((f) => f.id === "2" || /other bookmarks/i.test(f.title));
        quickieFolderId = other?.id || "2";
      }

      const created = await chrome.bookmarks.create({
        parentId: String(quickieFolderId),
        title,
        url,
      });

      await this._saveTags(created?.id);
      this._setExistingBookmark(created, "Quickie", "Quickie", String(quickieFolderId));
      const status = document.getElementById("save-status");
      if (status) status.textContent = "Saved to Quickie. You can organize it now or close this popup.";
      if (quickBtn) {
        quickBtn.classList.add("is-saved");
        if (quickText) quickText.textContent = "Saved";
        if (quickBadge) quickBadge.textContent = "✓ Saved";
      }

      if (this.isSidePanel) {
        setTimeout(() => {
          if (quickBtn) {
            quickBtn.disabled = false;
            quickBtn.classList.remove("is-saved");
            if (quickText) quickText.textContent = "Quickie";
            if (quickBadge) quickBadge.textContent = "1-Click";
          }
        }, 2000);
      }
    } catch (err) {
      if (quickBtn) quickBtn.disabled = false;
      if (quickText) quickText.textContent = "Quickie";
      if (quickBadge) quickBadge.textContent = "1-Click";
      this.showError(err?.message || "Could not save to Quickie");
    } finally {
      this._saving = false;
      if (this.submitBtn) this.submitBtn.disabled = false;
    }
  }
}

if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
  document.addEventListener("DOMContentLoaded", () => {
    const controller = new PopupController();
    controller.init();
  });
}
