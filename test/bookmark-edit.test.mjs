import test, { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Setup minimal DOM shim for Node environment
if (typeof globalThis.Node === "undefined") {
  globalThis.Node = class Node {};
  globalThis.Element = class Element extends globalThis.Node {};
  globalThis.Text = class Text extends globalThis.Node {
    constructor(t) { super(); this.nodeType = 3; this.textContent = String(t); }
  };
  globalThis.DocumentFragment = class DocumentFragment extends globalThis.Node {};
}

if (typeof document === "undefined") {
  globalThis.document = {
    createElement(tag) {
      const el = new globalThis.Element();
      el.tagName = tag.toUpperCase();
      const style = {};
      style.setProperty = function(k, v) {
        style[k] = v;
        const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        style[camel] = v;
      };
      el.style = style;
      el.dataset = {};
      el.attributes = {};
      el.children = [];
      el.childNodes = el.children;
      el.textContent = "";
      el.className = "";
      el.classList = {
        _classes: new Set(),
        add(...cls) { cls.forEach(c => this._classes.add(c)); el.className = [...this._classes].join(" "); },
        remove(...cls) { cls.forEach(c => this._classes.delete(c)); el.className = [...this._classes].join(" "); },
        contains(c) { return this._classes.has(c); },
        toggle(c, force) {
          if (force !== undefined) {
            if (force) this.add(c); else this.remove(c);
            return force;
          }
          if (this.contains(c)) { this.remove(c); return false; }
          this.add(c); return true;
        }
      };
      Object.defineProperty(el, "firstChild", { get() { return this.children[0] || null; }, configurable: true });
      el.setAttribute = function(k, v) { this.attributes[k] = String(v); };
      el.getAttribute = function(k) { return this.attributes[k] ?? null; };
      el.removeAttribute = function(k) { delete this.attributes[k]; };
      el.appendChild = function(c) { this.children.push(c); c.parentElement = this; return c; };
      el.append = function(...items) { items.forEach(i => { if (typeof i === "string") i = globalThis.document.createTextNode(i); this.appendChild(i); }); };
      el.addEventListener = function(type, fn) { this._listeners = this._listeners || {}; (this._listeners[type] = this._listeners[type] || []).push(fn); };
      el.removeEventListener = function(type, fn) {
        if (!this._listeners?.[type]) return;
        this._listeners[type] = this._listeners[type].filter(l => l !== fn);
      };
      el.dispatchEvent = function(e) {
        const arr = this._listeners?.[e.type] || [];
        for (const fn of arr) fn(e);
        return true;
      };
      el.removeChild = function(c) {
        const idx = this.children.indexOf(c);
        if (idx >= 0) {
          this.children.splice(idx, 1);
          c.parentElement = null;
        }
        return c;
      };
      el.replaceChildren = function(...kids) {
        this.children.length = 0;
        for (const k of kids) this.appendChild(k);
      };
      el.remove = function() {
        if (this.parentElement) {
          this.parentElement.removeChild(this);
        }
      };
      el.querySelector = function(selector) {
        // Simple class or tag matcher
        const match = (node) => {
          if (selector.startsWith(".")) {
            const cls = selector.slice(1);
            if (node.classList?.contains(cls) || node.className?.includes(cls)) return node;
          }
          if (node.tagName === selector.toUpperCase()) return node;
          for (const child of node.children || []) {
            const found = match(child);
            if (found) return found;
          }
          return null;
        };
        return match(this);
      };
      el.querySelectorAll = function(selector) {
        const results = [];
        const match = (node) => {
          if (selector.startsWith(".")) {
            const cls = selector.slice(1);
            if (node.classList?.contains(cls) || node.className?.includes(cls)) results.push(node);
          } else if (node.tagName === selector.toUpperCase()) {
            results.push(node);
          }
          for (const child of node.children || []) {
            match(child);
          }
        };
        for (const child of this.children || []) match(child);
        return results;
      };
      el.focus = function() {};
      el.select = function() {};
      return el;
    },
    createTextNode(t) { return new globalThis.Text(t); },
    createElementNS(ns, tag) { return this.createElement(tag); },
    body: {
      children: [],
      appendChild(c) { this.children.push(c); c.parentElement = this; return c; },
      append(...items) { items.forEach(i => this.appendChild(i)); },
      removeChild(c) { const idx = this.children.indexOf(c); if (idx >= 0) this.children.splice(idx, 1); return c; },
    },
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.window = {
    addEventListener() {},
    removeEventListener() {},
    innerWidth: 1200,
    innerHeight: 800,
    open() {},
    requestAnimationFrame(cb) { cb(); },
  };
  globalThis.requestAnimationFrame = globalThis.window.requestAnimationFrame;
}

import { BookmarkEditDialogView } from "../src/presentation/newTab/views/BookmarkEditDialogView.js";

describe("BookmarkEditDialogView", () => {
  const RAW_TREE = [{
    id: "0", title: "", children: [
      { id: "1", title: "Bookmarks Bar", children: [
        { id: "10", title: "Development", children: [
          { id: "100", title: "GitHub", url: "https://github.com/" }
        ]},
        { id: "20", title: "Design", children: [] }
      ]}
    ]
  }];

  it("initializes with default options and creates FolderTreeSelectorView", () => {
    const dialog = new BookmarkEditDialogView({
      getTree: async () => RAW_TREE,
    });
    assert.ok(dialog.folderSelector);
    assert.equal(dialog.bookmark, null);
  });

  it("opens for a bookmark, pre-populating title, URL, and parent folder", async () => {
    const dialog = new BookmarkEditDialogView({
      getTree: async () => RAW_TREE,
    });

    const targetBookmark = {
      id: "100",
      title: "GitHub Repo",
      url: "https://github.com/facebook/react",
      parentId: "10",
      path: ["Bookmarks Bar", "Development"],
    };

    await dialog.open(targetBookmark);

    assert.equal(dialog.nameInput.value, "GitHub Repo");
    assert.equal(dialog.urlInput.value, "https://github.com/facebook/react");
    assert.equal(dialog.folderSelector.getSelectedFolderId(), "10");
  });

  it("handles submission, calls chrome.bookmarks.update and moves folder when parentId changed", async () => {
    let updateCalled = null;
    let moveCalled = null;
    let toastMessage = null;
    let successCalled = false;

    globalThis.chrome = {
      bookmarks: {
        update: async (id, changes) => {
          updateCalled = { id, changes };
          return { id, ...changes };
        },
        move: async (id, destination) => {
          moveCalled = { id, destination };
          return { id, ...destination };
        },
      }
    };

    const dialog = new BookmarkEditDialogView({
      getTree: async () => RAW_TREE,
      toast: {
        show: (msg) => { toastMessage = msg; },
      }
    });

    const targetBookmark = {
      id: "100",
      title: "GitHub",
      url: "https://github.com",
      parentId: "10",
    };

    await dialog.open(targetBookmark, {
      onSuccess: () => { successCalled = true; }
    });

    // Simulate user modifying title and URL and changing folder to Design ("20")
    dialog.nameInput.value = "GitHub Dashboard";
    dialog.urlInput.value = "https://github.com/dashboard";
    dialog.folderSelector.selectedFolderIds = new Set(["20"]);

    await dialog.handleSubmit();

    assert.deepEqual(updateCalled, {
      id: "100",
      changes: {
        title: "GitHub Dashboard",
        url: "https://github.com/dashboard",
      }
    });

    assert.deepEqual(moveCalled, {
      id: "100",
      destination: { parentId: "20" }
    });

    assert.equal(toastMessage, 'Updated "GitHub Dashboard"');
    assert.equal(successCalled, true);
  });

  it("does not call chrome.bookmarks.move if folder parentId was not changed", async () => {
    let updateCalled = null;
    let moveCalled = null;

    globalThis.chrome = {
      bookmarks: {
        update: async (id, changes) => {
          updateCalled = { id, changes };
          return { id, ...changes };
        },
        move: async (id, destination) => {
          moveCalled = { id, destination };
          return { id, ...destination };
        },
      }
    };

    const dialog = new BookmarkEditDialogView({
      getTree: async () => RAW_TREE,
      toast: { show: () => {} },
    });

    const targetBookmark = {
      id: "100",
      title: "GitHub",
      url: "https://github.com",
      parentId: "10",
    };

    await dialog.open(targetBookmark);
    dialog.nameInput.value = "GitHub Main";
    dialog.urlInput.value = "https://github.com";
    // folder remains "10"

    await dialog.handleSubmit();

    assert.ok(updateCalled);
    assert.equal(updateCalled.changes.title, "GitHub Main");
    assert.equal(moveCalled, null); // No move needed
  });

  it("rejects unsafe URLs (e.g. javascript:) and shows error toast", async () => {
    let updateCalled = false;
    let errorToast = null;

    globalThis.chrome = {
      bookmarks: {
        update: async () => { updateCalled = true; },
      }
    };

    const dialog = new BookmarkEditDialogView({
      getTree: async () => RAW_TREE,
      toast: {
        show: (msg, opts) => {
          if (opts?.error) errorToast = msg;
        }
      }
    });

    await dialog.open({ id: "100", title: "Test", url: "https://example.com", parentId: "1" });
    dialog.urlInput.value = "javascript:alert(1)";

    await dialog.handleSubmit();

    assert.equal(updateCalled, false);
    assert.ok(errorToast?.includes("Invalid URL"));
  });

  it("hides dialog on cancel and cleans up", async () => {
    const dialog = new BookmarkEditDialogView({
      getTree: async () => RAW_TREE,
    });

    await dialog.open({ id: "100", title: "Test", url: "https://example.com", parentId: "1" });
    assert.ok(dialog.root);

    dialog.hide();
    assert.equal(dialog.escHandler, null);
  });
});
