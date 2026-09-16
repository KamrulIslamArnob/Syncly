import test, { describe, it } from "node:test";
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
      Object.defineProperty(el, "textContent", {
        get() {
          let text = "";
          const collect = (node) => {
            if (node.nodeType === 3) text += node.textContent;
            for (const c of node.children || []) collect(c);
          };
          collect(this);
          return text;
        },
        set(val) {
          this.children = [];
          if (val) this.appendChild(globalThis.document.createTextNode(val));
        },
        configurable: true,
      });
      Object.defineProperty(el, "checked", {
        get() { return this._checked !== undefined ? this._checked : this.getAttribute("checked") === "true"; },
        set(v) { this._checked = Boolean(v); this.setAttribute("checked", String(Boolean(v))); },
        configurable: true,
      });
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
      el.setAttribute = function(k, v) {
        this.attributes[k] = String(v);
        if (k.startsWith("data-")) {
          const camel = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          this.dataset[camel] = String(v);
        }
      };
      el.getAttribute = function(k) { return this.attributes[k] ?? null; };
      el.removeAttribute = function(k) {
        delete this.attributes[k];
        if (k.startsWith("data-")) {
          const camel = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          delete this.dataset[camel];
        }
      };
      el.appendChild = function(c) { this.children.push(c); c.parentElement = this; return c; };
      el.append = function(...items) { items.forEach(i => { if (typeof i === "string") i = globalThis.document.createTextNode(i); this.appendChild(i); }); };
      el.replaceChildren = function(...items) { this.children = []; this.append(...items); };
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
      el.querySelector = function(sel) {
        const match = (node) => {
          if (!node || typeof node.getAttribute !== "function") return null;
          if (sel.includes("[")) {
            const matchAttr = sel.match(/\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]/);
            if (matchAttr) {
              const [, attr, val] = matchAttr;
              if (val !== undefined) {
                const camel = attr.replace(/^data-/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
                if (node.getAttribute(attr) === val || node.dataset?.[camel] === val) return node;
              } else if (node.getAttribute(attr) !== null) {
                return node;
              }
            }
          }
          if (sel.startsWith(".")) {
            const cls = sel.slice(1);
            const classes = (node.className || "").split(/\s+/);
            if (classes.includes(cls) || node.classList?.contains(cls)) return node;
          }
          if (sel.startsWith("#")) {
            const id = sel.slice(1);
            if (node.id === id) return node;
          }
          if (sel.toUpperCase() === node.tagName) return node;
          for (const c of node.children || []) {
            const f = match(c);
            if (f) return f;
          }
          return null;
        };
        for (const c of this.children || []) {
          const f = match(c);
          if (f) return f;
        }
        return null;
      };
      el.querySelectorAll = function(sel) {
        const subSelectors = sel.split(",").map(s => s.trim());
        const out = [];
        const matchSub = (node, sub) => {
          if (!node || typeof node.getAttribute !== "function") return false;
          if (sub.startsWith(".")) {
            const cls = sub.slice(1);
            const classes = (node.className || "").split(/\s+/);
            if (classes.includes(cls) || node.classList?.contains(cls)) return true;
          } else if (sub.toUpperCase() === node.tagName) {
            return true;
          }
          return false;
        };
        const match = (node) => {
          if (subSelectors.some(sub => matchSub(node, sub))) out.push(node);
          for (const c of node.children || []) match(c);
        };
        for (const c of this.children || []) match(c);
        return out;
      };
      el.closest = function(sel) {
        let cur = this;
        while (cur) {
          if (sel.startsWith(".")) {
            const cls = sel.slice(1);
            const classes = (cur.className || "").split(/\s+/);
            if (classes.includes(cls) || cur.classList?.contains(cls)) return cur;
          }
          cur = cur.parentElement;
        }
        return null;
      };
      return el;
    },
    createElementNS(ns, tag) {
      return this.createElement(tag);
    },
    createTextNode(t) {
      return new globalThis.Text(t);
    },
    addEventListener() {},
    removeEventListener() {},
  };
}

describe("Direct Folder Bookmarks & Add Folder Button", () => {
  it("directLeaves extracts only direct bookmarks from folder, ignoring subfolder bookmarks", async () => {
    const { directLeaves } = await import("../src/presentation/newTab/views/BookmarkDeckView.js");
    assert.equal(typeof directLeaves, "function", "directLeaves must be exported");

    const sampleFolder = {
      id: "f_buy",
      title: "Buy",
      type: "folder",
      children: [
        {
          id: "bm_loose",
          title: "Direct Wishlist",
          url: "https://example.com/wishlist",
          type: "bookmark",
          parentId: "f_buy",
        },
        {
          id: "sub_electronics",
          title: "Electronics",
          type: "folder",
          parentId: "f_buy",
          children: [
            {
              id: "bm_nested_1",
              title: "Amazon Phone",
              url: "https://amazon.com/phone",
              type: "bookmark",
              parentId: "sub_electronics",
            },
            {
              id: "bm_nested_2",
              title: "BestBuy TV",
              url: "https://bestbuy.com/tv",
              type: "bookmark",
              parentId: "sub_electronics",
            },
          ],
        },
      ],
    };

    const leaves = directLeaves(sampleFolder);
    assert.equal(leaves.length, 1, "Should only return the 1 direct bookmark");
    assert.equal(leaves[0].id, "bm_loose");
    assert.equal(leaves[0].title, "Direct Wishlist");
    assert.deepEqual(leaves[0].path, ["Buy"]);
  });

  it("BookmarkDeckView renders Add Folder button in header when viewing a folder", async () => {
    const { BookmarkDeckView } = await import("../src/presentation/newTab/views/BookmarkDeckView.js");
    
    let openedParentId = null;
    const view = new BookmarkDeckView();
    view._header = document.createElement("header");
    view._activeSelection = {
      type: "folder",
      id: "f_buy",
      title: "Buy",
      folder: {
        id: "f_buy",
        title: "Buy",
        children: [],
      },
    };
    view.newFolderDialog = {
      open(parentId) {
        openedParentId = parentId;
      }
    };

    view._renderHeader();

    const addFolderBtn = view._header.querySelector(".raindrop-add-folder-btn");
    assert.ok(addFolderBtn, "Header should contain .raindrop-add-folder-btn in rightCluster");
    assert.ok(addFolderBtn.textContent.includes("Add Folder"), "Button should have 'Add Folder' text");

    // Click should invoke dialog with active folder ID
    addFolderBtn.dispatchEvent({ type: "click" });
    assert.equal(openedParentId, "f_buy", "Dialog should open with folder ID 'f_buy' as parentId");
  });

  it("BookmarkDeckView does not render Add Folder button when viewing a collection", async () => {
    const { BookmarkDeckView } = await import("../src/presentation/newTab/views/BookmarkDeckView.js");

    const view = new BookmarkDeckView();
    view._header = document.createElement("header");
    view._activeSelection = {
      type: "collection",
      id: "c_1",
      title: "Articles",
    };

    view._renderHeader();

    const addFolderBtn = view._header.querySelector(".raindrop-add-folder-btn");
    assert.equal(addFolderBtn, null, "Add Folder button should not appear in custom collections");
  });

  it("BookmarkDeckView._getActivePool returns every nested bookmark when viewing a folder", async () => {
    const { BookmarkDeckView } = await import("../src/presentation/newTab/views/BookmarkDeckView.js");

    const view = new BookmarkDeckView();
    view._activeSelection = {
      type: "folder",
      id: "f_buy",
      title: "Buy",
      folder: {
        id: "f_buy",
        title: "Buy",
        children: [
          {
            id: "bm_1",
            title: "Direct Bookmark 1",
            url: "https://example.com/1",
            type: "bookmark",
            parentId: "f_buy",
          },
          {
            id: "sub_1",
            title: "Electronics",
            type: "folder",
            parentId: "f_buy",
            children: [
              {
                id: "bm_sub_1",
                title: "Sub Bookmark",
                url: "https://sub.example.com",
                type: "bookmark",
                parentId: "sub_1",
              },
            ],
          },
        ],
      },
    };

    const pool = view._getActivePool();
    assert.deepEqual(pool.map((b) => b.id), ["bm_1", "bm_sub_1"], "Pool should contain the direct and the sub-folder bookmark");
  });

  it("FolderTreeSelectorView expands ancestor branches when a child folder is selected", async () => {
    const { FolderTreeSelectorView } = await import("../src/presentation/newTab/views/FolderTreeSelectorView.js");

    const mockTree = [
      {
        id: "1",
        title: "Bookmarks Bar",
        children: [
          {
            id: "sub_nested",
            title: "Nested Folder",
            children: [],
          },
        ],
      },
    ];

    const selector = new FolderTreeSelectorView({
      getTree: async () => mockTree,
      mode: "single",
    });

    selector.setSelectedFolderIds(["sub_nested"]);
    selector.render();
    await selector.loadTree();

    const selectedNode = selector.treeContainer.querySelector('.folder-tree-node[data-folder-id="sub_nested"]');
    assert.ok(selectedNode, "Selected node should exist in DOM");

    const radio = selectedNode.querySelector("input");
    assert.ok(radio.checked, "Radio for selected node should be checked");

    const parentChildrenWrap = selector.treeContainer.querySelector(".folder-tree-children");
    assert.equal(parentChildrenWrap.style.display, "flex", "Parent container should be expanded to display: flex");
  });
});

