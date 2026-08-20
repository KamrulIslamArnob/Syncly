// Safe DOM construction. NEVER uses innerHTML — all strings go
// through createElement + textContent / setAttribute. This is the
// defense-in-depth counterpart to BasicSanitizer: even if a
// malicious string somehow reaches the presentation layer, it
// cannot become executable HTML.

/**
 * Create a DOM element.
 *
 * @param {string} tag
 * @param {Object} [props] - attributes, event handlers, className, style
 * @param {...(Node|string|number|false|null|undefined)} children
 * @returns {HTMLElement}
 */
export function el(tag, props, ...children) {
  const node = document.createElement(tag);

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;

      if (key === "className") {
        node.className = value;
      } else if (key === "dataset" && typeof value === "object") {
        for (const [k, v] of Object.entries(value)) {
          if (v != null) node.dataset[k] = String(v);
        }
      } else if (key === "style" && typeof value === "object") {
        // Use setProperty for CSS shorthand values that contain "/" (e.g.
        // "grid-column: 2 / span 6"). Assigning to the IDL property would
        // be parsed as a single grid-line value and silently invalidate
        // the whole declaration. CamelCased keys are mapped to kebab-case.
        for (const [prop, propValue] of Object.entries(value)) {
          if (propValue === null || propValue === undefined || propValue === false) continue;
          const cssProp = prop.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
          node.style.setProperty(cssProp, String(propValue));
        }
      } else if (key === "ref" && typeof value === "function") {
        value(node);
      } else if (key.startsWith("on") && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key in node && key !== "list") {
        try {
          node[key] = value;
        } catch {
          node.setAttribute(key, String(value));
        }
      } else {
        node.setAttribute(key, String(value));
      }
    }
  }

  appendChildren(node, children);
  return node;
}

/** Append a list of children, filtering out empty / falsey values. */
function appendChildren(parent, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) {
      appendChildren(parent, child);
    } else if (child instanceof Node) {
      parent.appendChild(child);
    } else {
      parent.appendChild(document.createTextNode(String(child)));
    }
  }
}

/** Remove all child nodes from a parent. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
