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

/* ── Destination memory (UX redesign: zero-click repeat saves) ───────────────
   The last-used folder/collection is restored on every popup open and the four
   most recent folders render as one-tap chips inside the form. Repeat saves
   into a favorite destination need NO picker trip at all. */
const LAST_FOLDER_KEY = "popupLastFolder";
const RECENT_FOLDERS_KEY = "popupRecentFolders";
const LAST_COLLECTION_KEY = "popupLastCollection";
const MAX_RECENT_FOLDERS = 4;

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

class PopupController {
  constructor() {
    this.themeToggleBtn = document.getElementById("btn-theme-toggle");
    this.quickieBtn = document.getElementById("btn-save-quickie");
    this.shortcutBtn = document.getElementById("btn-save-shortcut");
    this.typeBtnBookmark = document.getElementById("type-btn-bookmark");
    this.typeBtnCollection = document.getElementById("type-btn-collection");
    this.fieldFolder = document.getElementById("field-folder");
    this.fieldCollection = document.getElementById("field-collection");

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

    // Main Form Triggers
    this.workspaceTrigger = document.getElementById("bm-workspace-trigger");
    this.workspaceHidden = document.getElementById("bm-workspace-value");
    this.workspaceSwatch = document.getElementById("bm-workspace-swatch");
    this.workspaceLabel = document.getElementById("bm-workspace-label");

    this.folderTrigger = document.getElementById("bm-collection-trigger");
    this.folderHidden = document.getElementById("bm-collection-value");
    this.folderLabel = document.getElementById("bm-collection-label");
    this.folderQuickRow = document.getElementById("folder-quick-row");

    this.customCollectionTrigger = document.getElementById("bm-custom-collection-trigger");
    this.customCollectionHidden = document.getElementById("bm-custom-collection-value");
    this.customCollectionLabel = document.getElementById("bm-custom-collection-label");

    // Full-Height Subview Elements
    this.mainView = document.getElementById("main-view");
    this.pickerSubview = document.getElementById("picker-subview");
    this.subviewBackBtn = document.getElementById("subview-back-btn");
    this.subviewTitle = document.getElementById("subview-title");
    this.subviewActionBtn = document.getElementById("subview-action-btn");
    this.subviewSearchBar = document.getElementById("subview-search-bar");
    this.subviewSearchInput = document.getElementById("subview-search-input");
    this.subviewSearchClear = document.getElementById("subview-search-clear");
    this.subviewList = document.getElementById("subview-list");

    this.subviewCreator = document.getElementById("subview-inline-creator");
    this.subviewCreatorInput = document.getElementById("subview-creator-input");
    this.subviewCreatorConfirm = document.getElementById("subview-creator-confirm");
    this.subviewCreatorCancel = document.getElementById("subview-creator-cancel");

    this.subviewMode = null; // "folder" | "collection" | "workspace"
    this.destinationType = "bookmark"; // "bookmark" | "collection"
    this.groups = [];
    this.folders = [];
    this.collections = [];
    this.recentFolders = []; // [{ id, title }] — most recent first
    this.activeTags = new Set();
    this.currentColorMode = "dark";
    this.currentAccentColor = "#555B66";

    this._bindEvents();
  }

  _bindEvents() {
    this.themeToggleBtn?.addEventListener("click", () => this.toggleTheme());
    this.quickieBtn?.addEventListener("click", () => this.onSaveToQuickie());
    this.shortcutBtn?.addEventListener("click", () => this.onSaveToShortcuts());

    this.typeBtnBookmark?.addEventListener("click", () => this.setDestinationType("bookmark"));
    this.typeBtnCollection?.addEventListener("click", () => this.setDestinationType("collection"));

    // Real-time sync with settings and popup preferences in background/tabs
    if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local") {
          if (changes.popupColorMode?.newValue) {
            this.applyTheme(changes.popupColorMode.newValue, this.currentAccentColor);
          }
          if (changes.settings?.newValue) {
            const s = changes.settings.newValue;
            const accent = s.cssVarAccent || "#555B66";
            this.applyTheme(this.currentColorMode, accent);
          }
        }
      });
    }

    // Open Full-Height Subviews
    this.folderTrigger?.addEventListener("click", (e) => {
      e.preventDefault();
      this.openPickerSubview("folder");
    });
    this.customCollectionTrigger?.addEventListener("click", (e) => {
      e.preventDefault();
      this.openPickerSubview("collection");
    });
    this.workspaceTrigger?.addEventListener("click", (e) => {
      e.preventDefault();
      this.openPickerSubview("workspace");
    });

    // Subview Navigation
    this.subviewBackBtn?.addEventListener("click", () => this.closePickerSubview());
    this.subviewSearchInput?.addEventListener("input", () => this._onSubviewSearch());
    this.subviewSearchClear?.addEventListener("click", () => {
      if (this.subviewSearchInput) {
        this.subviewSearchInput.value = "";
        this._onSubviewSearch();
        this.subviewSearchInput.focus();
      }
    });

    // Subview Creator
    this.subviewActionBtn?.addEventListener("click", () => this._openSubviewCreator());
    this.subviewCreatorCancel?.addEventListener("click", () => this._closeSubviewCreator());
    this.subviewCreatorConfirm?.addEventListener("click", () => this._submitSubviewCreator());
    this.subviewCreatorInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this._submitSubviewCreator();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this._closeSubviewCreator();
      }
    });

    // Tags
    this.tagsInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const val = this.tagsInput.value.replace(/,/g, "").trim();
        if (val) { this.addTagChip(val, true); this.tagsInput.value = ""; }
      }
    });

    // Live-sync to the active browser tab. Harmless in classic popup mode
    // (the view closes on blur) and essential in side-panel mode, which
    // stays open while the user switches tabs.
    if (typeof chrome !== "undefined" && chrome.tabs?.onActivated) {
      chrome.tabs.onActivated.addListener(async ({ tabId }) => {
        try {
          const tab = await chrome.tabs.get(tabId);
          this._seedTab(tab);
        } catch { /* tab gone before get() resolved */ }
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
        } catch { /* no focused window (Chrome lost focus) */ }
      });
    }

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.pickerSubview && !this.pickerSubview.hidden) {
          e.preventDefault();
          this.closePickerSubview();
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
    if (type === "bookmark") {
      this.typeBtnBookmark?.classList.add("is-active");
      this.typeBtnBookmark?.setAttribute("aria-selected", "true");
      this.typeBtnCollection?.classList.remove("is-active");
      this.typeBtnCollection?.setAttribute("aria-selected", "false");
      if (this.fieldFolder) this.fieldFolder.style.display = "";
      if (this.fieldCollection) this.fieldCollection.style.display = "none";
      if (this.submitBtnText) this.submitBtnText.textContent = "Save Bookmark";
    } else {
      this.typeBtnCollection?.classList.add("is-active");
      this.typeBtnCollection?.setAttribute("aria-selected", "true");
      this.typeBtnBookmark?.classList.remove("is-active");
      this.typeBtnBookmark?.setAttribute("aria-selected", "false");
      if (this.fieldFolder) this.fieldFolder.style.display = "none";
      if (this.fieldCollection) this.fieldCollection.style.display = "";
      if (this.submitBtnText) this.submitBtnText.textContent = "Add to Collection";
    }
  }

  /* ============================================================
     Full-Height Subview Lifecycle
     ============================================================ */
  openPickerSubview(mode) {
    this.subviewMode = mode;
    if (this.pickerSubview) this.pickerSubview.hidden = false;
    this._closeSubviewCreator();

    if (this.subviewSearchInput) {
      this.subviewSearchInput.value = "";
      this.subviewSearchClear.hidden = true;
    }

    if (mode === "folder") {
      if (this.subviewTitle) this.subviewTitle.textContent = "Select Folder";
      if (this.subviewActionBtn) {
        this.subviewActionBtn.textContent = "+ New Folder";
        this.subviewActionBtn.style.display = "";
      }
      if (this.subviewSearchInput) this.subviewSearchInput.placeholder = "Search folders...";
      if (this.subviewSearchBar) this.subviewSearchBar.style.display = "";
      this._renderSubviewFolders(this.folders);
    } else if (mode === "collection") {
      if (this.subviewTitle) this.subviewTitle.textContent = "Select Collection";
      if (this.subviewActionBtn) {
        this.subviewActionBtn.textContent = "+ New Collection";
        this.subviewActionBtn.style.display = "";
      }
      if (this.subviewSearchInput) this.subviewSearchInput.placeholder = "Search collections...";
      if (this.subviewSearchBar) this.subviewSearchBar.style.display = "";
      this._renderSubviewCollections(this.collections);
    } else if (mode === "workspace") {
      if (this.subviewTitle) this.subviewTitle.textContent = "Select Workspace";
      if (this.subviewActionBtn) this.subviewActionBtn.style.display = "none";
      if (this.subviewSearchInput) this.subviewSearchInput.placeholder = "Search workspaces...";
      if (this.subviewSearchBar) {
        this.subviewSearchBar.style.display = (this.groups && this.groups.length > 4) ? "" : "none";
      }
      this._renderSubviewWorkspaces(this.groups);
    }

    // Scroll to selected element or focus search
    setTimeout(() => {
      const selected = this.subviewList?.querySelector(".subview-item.is-selected");
      if (selected) {
        selected.scrollIntoView({ block: "nearest" });
      }
      if (this.subviewSearchInput && (!this.subviewSearchBar || this.subviewSearchBar.style.display !== "none")) {
        this.subviewSearchInput.focus();
      }
    }, 60);
  }

  closePickerSubview() {
    if (this.pickerSubview) this.pickerSubview.hidden = true;
    this.subviewMode = null;
    this._closeSubviewCreator();
  }

  _onSubviewSearch() {
    const q = this.subviewSearchInput?.value.trim().toLowerCase() || "";
    if (this.subviewSearchClear) this.subviewSearchClear.hidden = !q;

    if (this.subviewMode === "folder") {
      const filtered = this.folders.filter((f) => {
        return !q || (f.title && f.title.toLowerCase().includes(q)) || (f.fullPath && f.fullPath.toLowerCase().includes(q));
      });
      this._renderSubviewFolders(filtered);
    } else if (this.subviewMode === "collection") {
      const filtered = this.collections.filter((c) => !q || (c.name && c.name.toLowerCase().includes(q)));
      this._renderSubviewCollections(filtered);
    } else if (this.subviewMode === "workspace") {
      const filtered = this.groups.filter((g) => !q || (g.name && g.name.toLowerCase().includes(q)));
      this._renderSubviewWorkspaces(filtered);
    }
  }

  _renderSubviewFolders(folders) {
    this.subviewList.replaceChildren();
    if (!folders || folders.length === 0) {
      const empty = document.createElement("div");
      empty.className = "subview-empty-msg";
      empty.textContent = "No matching folders found";
      this.subviewList.appendChild(empty);
      return;
    }

    const currentId = this.folderHidden?.value;
    for (const f of folders) {
      const li = document.createElement("li");
      li.className = "subview-item";
      li.dataset.value = f.id;
      if (f.id === currentId) li.classList.add("is-selected");
      li.title = f.fullPath || f.title;

      if (f.depth > 0) {
        const indent = document.createElement("span");
        indent.className = "subview-item-indent";
        indent.style.width = `${f.depth * 14}px`;
        li.appendChild(indent);
      }

      const icon = document.createElement("span");
      icon.className = "subview-item-icon";
      icon.textContent = f.depth === 0 ? "📁" : "↳";

      const title = document.createElement("span");
      title.className = "subview-item-title";
      title.textContent = f.title;

      li.append(icon, title);

      if (f.path && f.path.length > 0) {
        const hint = document.createElement("span");
        hint.className = "subview-item-hint";
        hint.textContent = f.path[f.path.length - 1];
        li.appendChild(hint);
      }

      const check = document.createElement("span");
      check.className = "subview-item-check";
      check.textContent = "✓";
      li.appendChild(check);

      li.addEventListener("click", () => {
        this.selectFolder(f.id, f.title);
        this.closePickerSubview();
      });

      this.subviewList.appendChild(li);
    }
  }

  _renderSubviewCollections(collections) {
    this.subviewList.replaceChildren();
    if (!collections || collections.length === 0) {
      const empty = document.createElement("div");
      empty.className = "subview-empty-msg";
      empty.textContent = "No collections found. Click '+ New Collection' to create one.";
      this.subviewList.appendChild(empty);
      return;
    }

    const currentId = this.customCollectionHidden?.value;
    for (const c of collections) {
      const li = document.createElement("li");
      li.className = "subview-item";
      li.dataset.value = c.id;
      if (c.id === currentId) li.classList.add("is-selected");

      const icon = document.createElement("span");
      icon.className = "subview-item-icon";
      icon.textContent = "🗂️";

      const title = document.createElement("span");
      title.className = "subview-item-title";
      title.textContent = c.name;

      const count = Array.isArray(c.bookmarkIds) ? c.bookmarkIds.length : 0;
      const hint = document.createElement("span");
      hint.className = "subview-item-hint";
      hint.textContent = `${count} item${count === 1 ? "" : "s"}`;

      const check = document.createElement("span");
      check.className = "subview-item-check";
      check.textContent = "✓";

      li.append(icon, title, hint, check);
      li.addEventListener("click", () => {
        this.selectCustomCollection(c.id, c.name);
        this.closePickerSubview();
      });

      this.subviewList.appendChild(li);
    }
  }

  _renderSubviewWorkspaces(groups) {
    this.subviewList.replaceChildren();
    const currentId = this.workspaceHidden?.value ?? "";

    // All Bookmarks
    const allLi = document.createElement("li");
    allLi.className = "subview-item";
    if (!currentId) allLi.classList.add("is-selected");

    const allSwatch = document.createElement("span");
    allSwatch.className = "custom-select-swatch";

    const allTitle = document.createElement("span");
    allTitle.className = "subview-item-title";
    allTitle.textContent = "All Bookmarks";

    const allCheck = document.createElement("span");
    allCheck.className = "subview-item-check";
    allCheck.textContent = "✓";

    allLi.append(allSwatch, allTitle, allCheck);
    allLi.addEventListener("click", () => {
      this.selectWorkspace(null, "All Bookmarks", null);
      this.closePickerSubview();
    });
    this.subviewList.appendChild(allLi);

    for (const g of groups) {
      const li = document.createElement("li");
      li.className = "subview-item";
      li.dataset.value = g.id;
      if (g.id === currentId) li.classList.add("is-selected");

      const swatch = document.createElement("span");
      swatch.className = "custom-select-swatch";
      if (g.color) swatch.style.background = g.color;

      const title = document.createElement("span");
      title.className = "subview-item-title";
      title.textContent = g.name;

      const check = document.createElement("span");
      check.className = "subview-item-check";
      check.textContent = "✓";

      li.append(swatch, title, check);
      li.addEventListener("click", () => {
        this.selectWorkspace(g.id, g.name, g.color);
        this.closePickerSubview();
      });

      this.subviewList.appendChild(li);
    }
  }

  _openSubviewCreator() {
    if (!this.subviewCreator) return;
    this.subviewCreator.hidden = false;
    if (this.subviewCreatorInput) {
      this.subviewCreatorInput.value = "";
      this.subviewCreatorInput.placeholder = this.subviewMode === "folder" ? "New folder name..." : "New collection name...";
      setTimeout(() => this.subviewCreatorInput.focus(), 50);
    }
  }

  _closeSubviewCreator() {
    if (this.subviewCreator) {
      this.subviewCreator.hidden = true;
      if (this.subviewCreatorInput) this.subviewCreatorInput.value = "";
    }
  }

  async _submitSubviewCreator() {
    const name = this.subviewCreatorInput?.value.trim();
    if (!name) return;

    if (this.subviewMode === "folder") {
      try {
        const created = await chrome.bookmarks.create({ title: name, parentId: "1" });
        await this.populateFolders();
        if (created) this.selectFolder(created.id, created.title);
        this.closePickerSubview();
      } catch (err) {
        this.showError(err.message || "Failed to create folder");
      }
    } else if (this.subviewMode === "collection") {
      try {
        if (this.useCases?.createBookmarkCollection) {
          const created = await this.useCases.createBookmarkCollection.execute({ name });
          await this.populateCollections();
          if (created) this.selectCustomCollection(created.id, created.name);
        }
        this.closePickerSubview();
      } catch (err) {
        this.showError(err.message || "Failed to create collection");
      }
    }
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
      if (this.quickieBtn) this.quickieBtn.disabled = true;
      if (this.shortcutBtn) this.shortcutBtn.disabled = true;
      return;
    }

    await this.initTheme();

    if (this.useCases.ensureQuickieFolder) {
      this.useCases.ensureQuickieFolder.execute().catch((err) => {
        console.warn("Could not ensure quickie folder on popup open:", err);
      });
    }

    if (this.useCases.ensureShortcutsFolder) {
      this.useCases.ensureShortcutsFolder.execute().catch((err) => {
        console.warn("Could not ensure shortcuts folder on popup open:", err);
      });
    }

    await Promise.all([
      this.populateWorkspaces(),
      this.populateFolders(),
      this.populateCollections(),
    ]);

    await this.seedFromActiveTab();
    this.form?.addEventListener("submit", (event) => this.onSubmit(event));
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

      this.currentAccentColor = s?.cssVarAccent || "#555B66";
      this.currentColorMode = storedPopupMode || s?.colorMode || "dark";
    } catch {
      this.currentColorMode = "dark";
      this.currentAccentColor = "#555B66";
    }
    this.applyTheme(this.currentColorMode, this.currentAccentColor);
  }

  applyTheme(mode, accentHex) {
    this.currentColorMode = mode;
    this.currentAccentColor = accentHex || "#555B66";
    document.documentElement.setAttribute("data-color-mode", mode);
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
      console.warn("Could not save popupColorMode preference:", err);
    }
  }

  async onSaveToQuickie() {
    this.clearError();
    const url = this.urlInput.value.trim();
    const title = this.titleInput.value.trim() || hostnameOf(url) || "Bookmark";

    if (!url) {
      this.showError("URL is required.");
      return;
    }

    if (this.quickieBtn) {
      this.quickieBtn.disabled = true;
      this.quickieBtn.querySelector(".popup-quickie-title")?.replaceChildren("Saving...");
    }

    try {
      let quickieFolderId = null;
      if (this.useCases?.ensureQuickieFolder) {
        quickieFolderId = await this.useCases.ensureQuickieFolder.execute();
      }
      await chrome.bookmarks.create({
        parentId: quickieFolderId || "2",
        title,
        url,
      });
    } catch (err) {
      if (this.quickieBtn) {
        this.quickieBtn.disabled = false;
        const titleEl = this.quickieBtn.querySelector(".popup-quickie-title");
        if (titleEl) titleEl.textContent = "Quick Save";
      }
      this.showError(err?.message || "Could not save to Quickie.");
      return;
    }

    if (this.quickieBtn) {
      const titleEl = this.quickieBtn.querySelector(".popup-quickie-title");
      if (titleEl) titleEl.textContent = "Saved!";
    }
    setTimeout(() => window.close(), 350);
  }

  /** One-click save into the Shortcuts grid (reserved native folder). */
  async onSaveToShortcuts() {
    this.clearError();
    const url = this.urlInput.value.trim();
    const title = this.titleInput.value.trim() || hostnameOf(url) || "Shortcut";

    if (!url) {
      this.showError("URL is required.");
      return;
    }

    if (this.shortcutBtn) {
      this.shortcutBtn.disabled = true;
      const titleEl = this.shortcutBtn.querySelector(".popup-quickie-title");
      if (titleEl) titleEl.textContent = "Saving...";
    }

    try {
      let shortcutsFolderId = null;
      if (this.useCases?.ensureShortcutsFolder) {
        shortcutsFolderId = await this.useCases.ensureShortcutsFolder.execute();
      }
      await chrome.bookmarks.create({
        parentId: shortcutsFolderId || "2",
        title,
        url,
      });
    } catch (err) {
      if (this.shortcutBtn) {
        this.shortcutBtn.disabled = false;
        const titleEl = this.shortcutBtn.querySelector(".popup-quickie-title");
        if (titleEl) titleEl.textContent = "Quick Shortcut";
      }
      this.showError(err?.message || "Could not save shortcut.");
      return;
    }

    if (this.shortcutBtn) {
      const titleEl = this.shortcutBtn.querySelector(".popup-quickie-title");
      if (titleEl) titleEl.textContent = "Saved!";
    }
    setTimeout(() => window.close(), 350);
  }

  async populateWorkspaces() {
    try {
      this.groups = await this.useCases.listBookmarkGroups.execute();
      let activeId = null;
      if (this.useCases?.setActiveGroup?.getActive) {
        activeId = await this.useCases.setActiveGroup.getActive();
      }

      const active = this.groups.find((g) => g.id === activeId) || null;
      this.selectWorkspace(active ? active.id : null, active ? active.name : "All Bookmarks", active ? active.color : null);
    } catch {
      // Workspaces are a convenience filter — failure shouldn't block saving.
    }
  }

  selectWorkspace(id, name, color) {
    if (this.workspaceHidden) this.workspaceHidden.value = id ?? "";
    if (this.workspaceLabel) this.workspaceLabel.textContent = name;
    if (this.workspaceSwatch) {
      if (color) {
        this.workspaceSwatch.style.background = color;
        this.workspaceSwatch.style.display = "inline-block";
      } else {
        this.workspaceSwatch.style.background = "var(--accent-gradient)";
      }
    }
    this.filterFoldersByWorkspace(id);
  }

  async populateFolders() {
    try {
      const raw = typeof chrome !== "undefined" && chrome.bookmarks ? await chrome.bookmarks.getTree() : [];
      this.folders = flattenFolders(raw);

      // Restore memory: last-used folder wins; recents validated against the
      // live tree so deleted folders never render.
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
      // First-run seed so the quick-chip row isn't empty before the first save.
      if (this.recentFolders.length === 0 && bar) {
        this.recentFolders = [{ id: bar.id, title: bar.title }];
      }
      if (last) {
        this.selectFolder(last.id, last.title, { persist: false });
      } else if (bar) {
        this.selectFolder(bar.id, bar.title, { persist: false });
      }
      this._renderFolderQuickChips();
    } catch {
      if (this.folderLabel) this.folderLabel.textContent = "No folders found";
    }
  }

  filterFoldersByWorkspace(groupId) {
    const group = this.groups.find((g) => g.id === groupId);
    if (!group) return;
    const scoped = this.folders.filter((f) => group.folderIds.includes(f.id));
    // Workspace auto-scoping is not a user destination choice — don't
    // overwrite the remembered last-used folder with it.
    if (scoped.length) this.selectFolder(scoped[0].id, scoped[0].title, { persist: false });
  }

  selectFolder(id, name, { persist = true } = {}) {
    if (this.folderHidden) this.folderHidden.value = id;
    if (this.folderLabel) this.folderLabel.textContent = name;
    if (persist) this._rememberFolder(id, name);
    this._renderFolderQuickChips();
  }

  /** Push a folder to the front of recents, persist it as last-used, refresh chips. */
  async _rememberFolder(id, name) {
    if (!id) return;
    const entry = { id: String(id), title: String(name || "Folder") };
    this.recentFolders = [
      entry,
      ...this.recentFolders.filter((f) => f.id !== entry.id),
    ].slice(0, MAX_RECENT_FOLDERS);
    await writeLocal(RECENT_FOLDERS_KEY, this.recentFolders);
    await writeLocal(LAST_FOLDER_KEY, entry);
  }

  /** Render one-tap recent-destination chips under the Folder field. */
  _renderFolderQuickChips() {
    if (!this.folderQuickRow) return;
    const validIds = new Set(this.folders.map((f) => f.id));
    // Recents that no longer exist in the live tree are dropped from view
    // (they self-heal out of storage on the next _rememberFolder).
    const visible = this.recentFolders.filter((f) => validIds.has(f.id));
    const currentId = this.folderHidden?.value;

    this.folderQuickRow.replaceChildren();
    for (const f of visible.slice(0, MAX_RECENT_FOLDERS)) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "picker-quick-chip" + (f.id === currentId ? " is-active" : "");
      chip.title = f.title;
      chip.textContent = `📁 ${f.title}`;
      chip.addEventListener("click", () => {
        this.selectFolder(f.id, f.title);
      });
      this.folderQuickRow.appendChild(chip);
    }
  }

  async populateCollections() {
    try {
      if (this.useCases?.listBookmarkCollections) {
        this.collections = await this.useCases.listBookmarkCollections.execute();
      } else {
        this.collections = [];
      }
      // Restore the last-used collection instead of always the first one.
      const stored = await readLocal(LAST_COLLECTION_KEY);
      const last = stored && this.collections.find((c) => c.id === stored.id);
      if (last) {
        this.selectCustomCollection(last.id, last.name);
      } else if (this.collections.length > 0) {
        this.selectCustomCollection(this.collections[0].id, this.collections[0].name);
      } else if (this.customCollectionLabel) {
        this.customCollectionLabel.textContent = "Select Collection";
      }
    } catch {
      if (this.customCollectionLabel) this.customCollectionLabel.textContent = "Create collection";
    }
  }

  async _rememberCollection(id, name) {
    if (!id) return;
    await writeLocal(LAST_COLLECTION_KEY, { id: String(id), name: String(name || "Collection") });
  }

  selectCustomCollection(id, name) {
    if (this.customCollectionHidden) this.customCollectionHidden.value = id;
    if (this.customCollectionLabel) this.customCollectionLabel.textContent = name;
    this._rememberCollection(id, name);
  }

  async seedFromActiveTab({ focusTitle = true } = {}) {
    let tab = null;
    try {
      // Side panels persist across tab switches and are per-window, so
      // lastFocusedWindow is the reliable query; currentWindow is the
      // fallback for classic anchored popups.
      let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => []);
      if (!tabs || tabs.length === 0) {
        tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      }
      tab = tabs && tabs[0] ? tabs[0] : null;
    } catch (err) {
      console.warn("Could not query active tab:", err);
    }
    this._seedTab(tab, { focusTitle });
  }

  /** Fill the form from a tab. Reused by initial open AND live tab-switch sync. */
  _seedTab(tab, { focusTitle = false } = {}) {
    if (tab && tab.url) {
      this.urlInput.value = tab.url;
      this.titleInput.value = tab.title || hostnameOf(tab.url) || "";
      if (this.domainEl) this.domainEl.textContent = hostnameOf(tab.url);
      if (this.faviconEl) {
        if (tab.favIconUrl) {
          this.faviconEl.src = tab.favIconUrl;
          this.faviconEl.hidden = false;
        } else {
          // Stale favicon from the previously seeded tab must not linger.
          this.faviconEl.hidden = true;
        }
      }
      // Suggested tags belong to the page — clear chips from any prior seed.
      if (this.tagsList) this.tagsList.replaceChildren();
      this.activeTags.clear();
      const suggested = extractSuggestedTags(tab.title);
      for (const t of suggested) this.addTagChip(t, false);
    } else {
      if (this.domainEl) this.domainEl.textContent = "New Bookmark";
      if (this.faviconEl) this.faviconEl.hidden = true;
    }

    // Focus only when the view is first opened; auto-focusing on every
    // tab switch would yank keyboard focus away from the web page.
    if (focusTitle) setTimeout(() => this.titleInput?.focus(), 80);
  }

  addTagChip(tag, isActive = false) {
    const clean = tag.toLowerCase().replace(/^[#\s]+|[#\s]+$/g, "");
    if (!clean) return;

    if (this.activeTags.has(clean)) {
      if (isActive) {
        const existing = this.tagsList?.querySelector(`[data-tag="${clean}"]`);
        if (existing) existing.classList.add("is-active");
      }
      return;
    }

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "popup-tag-chip" + (isActive ? " is-active" : "");
    chip.dataset.tag = clean;
    chip.textContent = `#${clean}`;
    chip.addEventListener("click", () => {
      chip.classList.toggle("is-active");
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

  async onSubmit(event) {
    if (event) event.preventDefault();
    this.clearError();

    const title = this.titleInput.value.trim();
    const url = this.urlInput.value.trim();
    const tags = this.getSelectedTags();

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

    try {
      if (this.destinationType === "collection") {
        const collectionId = this.customCollectionHidden.value;
        let parentId = "2";
        if (this.useCases?.ensureCollectionsFolder) {
          parentId = (await this.useCases.ensureCollectionsFolder.execute()) || "2";
        } else {
          const otherFolder = this.folders.find((f) => f.id === "2" || /other bookmarks/i.test(f.title));
          parentId = otherFolder?.id || "2";
        }
        const created = await chrome.bookmarks.create({ parentId, title, url });
        if (collectionId && this.useCases?.updateCollectionMembers && created?.id) {
          await this.useCases.updateCollectionMembers.execute({
            collectionId,
            add: [created.id],
            urls: [url],
          });
        }
      } else {
        const parentId = this.folderHidden.value || "1";
        await chrome.bookmarks.create({
          parentId,
          title,
          url,
        });
        // Keep destination memory truthful with what was actually saved.
        const usedFolder = this.folders.find((f) => f.id === String(parentId));
        if (usedFolder) await this._rememberFolder(usedFolder.id, usedFolder.title);
      }
    } catch (err) {
      if (this.submitBtn) {
        this.submitBtn.disabled = false;
        if (this.submitBtnText) {
          this.submitBtnText.textContent = this.destinationType === "collection" ? "Add to Collection" : "Save Bookmark";
        }
      }
      this.showError(err?.message || "Failed to save bookmark.");
      return;
    }

    if (this.submitBtnText) this.submitBtnText.textContent = "Saved!";
    setTimeout(() => window.close(), 350);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const controller = new PopupController();
  controller.init();
});
