// Minimal DOM for view tests under node:test.
//
// Covers the slice of the browser DOM the new-tab views touch: element
// trees, className/classList, inline style (including custom properties),
// dataset, bubbling events, cloneNode, and simple CSS selectors (tag, #id,
// .class, [attr], [attr="value"], descendant and child combinators).
// Call installMiniDom() before importing view modules.

const HTML_NS = "http://www.w3.org/1999/xhtml";

const toKebab = (s) => String(s).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
const toCamel = (s) => String(s).replace(/-([a-z])/g, (_, c) => c.toUpperCase());

export class MiniEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = init.bubbles ?? true;
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
    this._stopped = false;
    Object.assign(this, init.detail ? { detail: init.detail } : {});
    for (const key of ["key", "metaKey", "ctrlKey", "shiftKey", "button", "clientX", "clientY", "relatedTarget"]) {
      if (key in init) this[key] = init[key];
    }
  }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this._stopped = true; }
}

function splitTopLevel(text, separator) {
  const out = [];
  let buf = "";
  let depth = 0;
  let quote = null;
  for (const ch of text) {
    if (quote) { buf += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === "[" || ch === "(") depth++;
    if (ch === "]" || ch === ")") depth--;
    if (depth === 0 && ch === separator) { out.push(buf); buf = ""; continue; }
    buf += ch;
  }
  out.push(buf);
  return out.map((s) => s.trim()).filter(Boolean);
}

function parseCompound(src) {
  const out = { tag: null, id: null, classes: [], attrs: [] };
  const re = /(^\*|^[a-zA-Z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[\s*([\w:-]+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+)))?\s*\]/g;
  let consumed = 0;
  let m;
  while ((m = re.exec(src))) {
    if (m.index !== consumed) break;
    consumed = re.lastIndex;
    if (m[1]) out.tag = m[1].toLowerCase();
    else if (m[2]) out.id = m[2];
    else if (m[3]) out.classes.push(m[3]);
    else out.attrs.push({ name: m[4], value: m[5] ?? m[6] ?? m[7] ?? null });
  }
  if (consumed !== src.length) throw new Error(`mini-dom: unsupported selector "${src}"`);
  return out;
}

function parseComplex(group) {
  const parts = [];
  let buf = "";
  let depth = 0;
  let quote = null;
  let combinator = null;
  const flush = () => {
    if (!buf.trim()) return false;
    parts.push({ compound: parseCompound(buf.trim()), combinator });
    combinator = null;
    buf = "";
    return true;
  };
  for (const ch of group) {
    if (quote) { buf += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === "[") depth++;
    if (ch === "]") depth--;
    if (depth === 0 && (ch === " " || ch === ">")) {
      if (flush()) combinator = " ";
      if (ch === ">") combinator = ">";
      continue;
    }
    buf += ch;
  }
  flush();
  return parts;
}

const selectorCache = new Map();
function parseSelector(selector) {
  if (!selectorCache.has(selector)) {
    selectorCache.set(selector, splitTopLevel(selector, ",").map(parseComplex));
  }
  return selectorCache.get(selector);
}

function matchesCompound(el, c) {
  if (!el || el.nodeType !== 1) return false;
  if (c.tag && c.tag !== "*" && el.localName.toLowerCase() !== c.tag) return false;
  if (c.id && el.getAttribute("id") !== c.id) return false;
  if (c.classes.length) {
    const list = el.className.split(/\s+/);
    if (!c.classes.every((k) => list.includes(k))) return false;
  }
  for (const a of c.attrs) {
    const v = el.getAttribute(a.name);
    if (v === null) return false;
    if (a.value !== null && v !== a.value) return false;
  }
  return true;
}

function matchesParts(el, parts, i) {
  if (!matchesCompound(el, parts[i].compound)) return false;
  if (i === 0) return true;
  if (parts[i].combinator === ">") return el.parentElement ? matchesParts(el.parentElement, parts, i - 1) : false;
  for (let anc = el.parentElement; anc; anc = anc.parentElement) {
    if (matchesParts(anc, parts, i - 1)) return true;
  }
  return false;
}

function matches(el, selector) {
  return parseSelector(selector).some((parts) => matchesParts(el, parts, parts.length - 1));
}

function createClassList(el) {
  const read = () => el.className.split(/\s+/).filter(Boolean);
  const write = (list) => { el.className = list.join(" "); };
  const api = {
    add: (...names) => { const list = read(); for (const n of names) if (!list.includes(n)) list.push(n); write(list); },
    remove: (...names) => write(read().filter((c) => !names.includes(c))),
    contains: (name) => read().includes(name),
    toggle: (name, force) => {
      const has = read().includes(name);
      const want = force === undefined ? !has : Boolean(force);
      if (want && !has) api.add(name);
      if (!want && has) api.remove(name);
      return want;
    },
    get length() { return read().length; },
    [Symbol.iterator]: function* iterate() { yield* read(); },
  };
  return api;
}

function createStyle() {
  const props = new Map();
  const target = {
    setProperty(name, value) { props.set(String(name), String(value)); },
    getPropertyValue(name) { return props.get(String(name)) ?? ""; },
    removeProperty(name) { const v = props.get(String(name)) ?? ""; props.delete(String(name)); return v; },
    get cssText() { return [...props].map(([k, v]) => `${k}: ${v};`).join(" "); },
    set cssText(text) {
      props.clear();
      for (const decl of String(text).split(";")) {
        const i = decl.indexOf(":");
        if (i > 0) props.set(decl.slice(0, i).trim(), decl.slice(i + 1).trim());
      }
    },
  };
  return new Proxy(target, {
    get(t, key) {
      if (key in t) return t[key];
      if (typeof key !== "string") return undefined;
      return props.get(toKebab(key)) ?? "";
    },
    set(t, key, value) {
      if (key === "cssText") { t.cssText = value; return true; }
      props.set(toKebab(key), String(value));
      return true;
    },
  });
}

function createDataset(el) {
  return new Proxy({}, {
    get: (_, key) => (typeof key === "string" ? el.getAttribute(`data-${toKebab(key)}`) ?? undefined : undefined),
    set: (_, key, value) => { el.setAttribute(`data-${toKebab(key)}`, String(value)); return true; },
    deleteProperty: (_, key) => { el.removeAttribute(`data-${toKebab(key)}`); return true; },
    has: (_, key) => el.hasAttribute(`data-${toKebab(key)}`),
    ownKeys: () => [...el._attrs.keys()].filter((k) => k.startsWith("data-")).map((k) => toCamel(k.slice(5))),
    getOwnPropertyDescriptor: (_, key) => ({ enumerable: true, configurable: true, value: el.getAttribute(`data-${toKebab(key)}`) }),
  });
}

export class Node {
  constructor(ownerDocument = null) {
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.childNodes = [];
    this._listeners = new Map();
  }

  get parentElement() { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; }
  get firstChild() { return this.childNodes[0] ?? null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] ?? null; }
  get nextSibling() {
    if (!this.parentNode) return null;
    const siblings = this.parentNode.childNodes;
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }
  get isConnected() {
    for (let n = this; n; n = n.parentNode) if (n.nodeType === 9) return true;
    return false;
  }
  get children() { return this.childNodes.filter((c) => c.nodeType === 1); }
  get firstElementChild() { return this.children[0] ?? null; }

  get textContent() { return this.childNodes.map((c) => c.textContent).join(""); }
  set textContent(value) {
    for (const c of [...this.childNodes]) this.removeChild(c);
    if (value !== null && value !== undefined && value !== "") this.appendChild(new Text(String(value), this.ownerDocument));
  }

  _adopt(value) {
    return value && typeof value === "object" && "nodeType" in value ? value : new Text(String(value), this.ownerDocument);
  }

  insertBefore(child, ref) {
    if (child.nodeType === 11) {
      for (const c of [...child.childNodes]) this.insertBefore(c, ref);
      return child;
    }
    if (child.parentNode) child.parentNode.removeChild(child);
    const i = ref ? this.childNodes.indexOf(ref) : -1;
    if (i < 0) this.childNodes.push(child);
    else this.childNodes.splice(i, 0, child);
    child.parentNode = this;
    return child;
  }
  appendChild(child) { return this.insertBefore(child, null); }
  removeChild(child) {
    const i = this.childNodes.indexOf(child);
    if (i >= 0) { this.childNodes.splice(i, 1); child.parentNode = null; }
    return child;
  }
  append(...nodes) { for (const n of nodes) this.appendChild(this._adopt(n)); }
  prepend(...nodes) { const ref = this.firstChild; for (const n of nodes) this.insertBefore(this._adopt(n), ref); }
  replaceChildren(...nodes) { for (const c of [...this.childNodes]) this.removeChild(c); this.append(...nodes); }
  remove() { this.parentNode?.removeChild(this); }
  replaceWith(...nodes) {
    const parent = this.parentNode;
    if (!parent) return;
    const ref = this.nextSibling;
    parent.removeChild(this);
    for (const n of nodes) parent.insertBefore(parent._adopt(n), ref);
  }
  contains(other) {
    for (let n = other; n; n = n.parentNode) if (n === this) return true;
    return false;
  }

  addEventListener(type, fn) {
    if (typeof fn !== "function") return;
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(fn);
  }
  removeEventListener(type, fn) {
    const list = this._listeners.get(type);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }
  dispatchEvent(event) {
    if (typeof event.preventDefault !== "function") event.preventDefault = () => { event.defaultPrevented = true; };
    if (typeof event.stopPropagation !== "function") event.stopPropagation = () => { event._stopped = true; };
    if (!event.target) event.target = this;
    for (let node = this; node; node = node.parentNode) {
      event.currentTarget = node;
      for (const fn of [...(node._listeners.get(event.type) || [])]) fn.call(node, event);
      if (event._stopped || event.bubbles === false) break;
    }
    return !event.defaultPrevented;
  }

  querySelectorAll(selector) {
    const out = [];
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 1) {
          if (matches(child, selector)) out.push(child);
          walk(child);
        }
      }
    };
    walk(this);
    return out;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

export class Text extends Node {
  constructor(data, ownerDocument = null) {
    super(ownerDocument);
    this.nodeType = 3;
    this.data = String(data);
  }
  get textContent() { return this.data; }
  set textContent(value) { this.data = String(value); }
  cloneNode() { return new Text(this.data, this.ownerDocument); }
}

export class DocumentFragment extends Node {
  constructor(ownerDocument = null) {
    super(ownerDocument);
    this.nodeType = 11;
  }
  cloneNode(deep = false) {
    const copy = new DocumentFragment(this.ownerDocument);
    if (deep) for (const c of this.childNodes) copy.appendChild(c.cloneNode(true));
    return copy;
  }
}

export class Element extends Node {
  constructor(tagName, ownerDocument = null, namespaceURI = HTML_NS) {
    super(ownerDocument);
    this.nodeType = 1;
    this.namespaceURI = namespaceURI;
    this.localName = namespaceURI === HTML_NS ? String(tagName).toLowerCase() : String(tagName);
    this.tagName = namespaceURI === HTML_NS ? this.localName.toUpperCase() : this.localName;
    this._attrs = new Map();
    this._style = createStyle();
    this.classList = createClassList(this);
    this.dataset = createDataset(this);
  }

  get className() { return this._attrs.get("class") ?? ""; }
  set className(value) { this._attrs.set("class", String(value)); }
  get id() { return this._attrs.get("id") ?? ""; }
  set id(value) { this._attrs.set("id", String(value)); }
  get style() { return this._style; }
  set style(value) { this._style.cssText = String(value); }

  getAttribute(name) { return this._attrs.has(name) ? this._attrs.get(name) : null; }
  setAttribute(name, value) {
    if (name === "style") this._style.cssText = String(value);
    else this._attrs.set(name, String(value));
  }
  removeAttribute(name) { this._attrs.delete(name); }
  hasAttribute(name) { return this._attrs.has(name); }

  matches(selector) { return matches(this, selector); }
  closest(selector) {
    for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (matches(n, selector)) return n;
    return null;
  }

  click() { this.dispatchEvent(new MiniEvent("click")); }
  focus() { if (this.ownerDocument) this.ownerDocument.activeElement = this; }
  blur() {}
  select() {}
  setSelectionRange() {}
  scrollIntoView() {}
  getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }; }

  cloneNode(deep = false) {
    const copy = new Element(this.localName, this.ownerDocument, this.namespaceURI);
    for (const [k, v] of this._attrs) copy._attrs.set(k, v);
    copy._style.cssText = this._style.cssText;
    if (deep) for (const c of this.childNodes) copy.appendChild(c.cloneNode(true));
    return copy;
  }
}

// Properties that el() assigns directly because `key in node` is true.
const BOOLEAN_PROPS = new Set(["disabled", "checked", "hidden"]);
const REFLECTED = {
  title: "title", type: "type", value: "value", placeholder: "placeholder", tabIndex: "tabindex",
  draggable: "draggable", disabled: "disabled", src: "src", alt: "alt", href: "href", name: "name",
  checked: "checked", hidden: "hidden", maxLength: "maxlength", autocomplete: "autocomplete", loading: "loading",
};
for (const [prop, attr] of Object.entries(REFLECTED)) {
  Object.defineProperty(Element.prototype, prop, {
    configurable: true,
    get() {
      const v = this.getAttribute(attr);
      return BOOLEAN_PROPS.has(prop) ? v !== null : v ?? "";
    },
    set(value) {
      if (BOOLEAN_PROPS.has(prop)) {
        if (value) this.setAttribute(attr, "");
        else this.removeAttribute(attr);
      } else {
        this.setAttribute(attr, String(value));
      }
    },
  });
}

export class Document extends Node {
  constructor() {
    super(null);
    this.nodeType = 9;
    this.activeElement = null;
    this.documentElement = new Element("html", this);
    this.head = new Element("head", this);
    this.body = new Element("body", this);
    this.documentElement.append(this.head, this.body);
    this.appendChild(this.documentElement);
  }
  createElement(tag) { return new Element(tag, this); }
  createElementNS(ns, tag) { return new Element(tag, this, ns); }
  createTextNode(text) { return new Text(text, this); }
  createDocumentFragment() { return new DocumentFragment(this); }
  getElementById(id) { return this.querySelector(`#${id}`); }
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear(),
  };
}

/** Install a fresh document and the browser globals the views read. */
export function installMiniDom() {
  const document = new Document();
  const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  define("document", document);
  define("window", globalThis);
  define("Node", Node);
  define("Element", Element);
  define("HTMLElement", Element);
  define("Text", Text);
  define("DocumentFragment", DocumentFragment);
  define("localStorage", memoryStorage());
  define("location", { href: "http://localhost/", search: "", origin: "http://localhost", assign() {} });
  define("innerWidth", 1440);
  define("innerHeight", 900);
  if (typeof globalThis.requestAnimationFrame !== "function") define("requestAnimationFrame", (fn) => setTimeout(fn, 0));
  return document;
}
