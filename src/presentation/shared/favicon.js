// Returns favicon URLs for bookmarks. `websiteFaviconUrl()` fetches
// the website HTML and extracts the declared favicon, while
// `faviconUrl()` remains a simple same-origin fallback to /favicon.ico.
//
// The presentation layer wraps the URL in an <img> with fallback.
// We never embed the URL as an <a href> or as a string injected
// into the DOM, so the "src" attribute is the only XSS surface.

import { icon } from "./icons.js";

const faviconCache = new Map();

/**
 * @param {string} pageUrl - a fully-qualified http(s) URL
 * @returns {string|null}
 */
export function faviconUrl(pageUrl) {
  if (typeof pageUrl !== "string" || pageUrl.length === 0) return null;
  try {
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(pageUrl)
      ? pageUrl
      : `https://${pageUrl}`;
    const url = new URL(candidate);
    if (!/^https?:$/.test(url.protocol)) return null;
    return `${url.origin}/favicon.ico`;
  } catch {
    return null;
  }
}

function isPrivateOrHttpHost(url) {
  if (!url || url.protocol !== "https:") return true; // CSP blocks plain http: images
  const h = url.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".test")) return true;
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(h)) return true;
  return false;
}

/**
 * Fetches the favicon referenced by the website itself.
 * Prefers Chrome's built-in favicon API (_favicon) using the 'favicon' permission.
 * Falls back to Google S2 favicon service (always returns 200 with fallback, no 404 console errors).
 *
 * @param {string} pageUrl
 * @returns {Promise<string|null>}
 */
export function websiteFaviconUrl(pageUrl) {
  if (typeof pageUrl !== "string" || pageUrl.length === 0)
    return Promise.resolve(null);
  let normalized;
  try {
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(pageUrl)
      ? pageUrl
      : `https://${pageUrl}`;
    normalized = new URL(candidate);
    if (!/^https?:$/.test(normalized.protocol)) return Promise.resolve(null);
  } catch {
    return Promise.resolve(null);
  }

  // 1. Chrome extension native favicon API (fast, offline, uses browser's favicon cache)
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    try {
      const url = new URL(chrome.runtime.getURL("/_favicon/"));
      url.searchParams.set("pageUrl", normalized.href);
      url.searchParams.set("size", "32");
      return Promise.resolve(url.href);
    } catch {
      // fallback below
    }
  }

  // Privacy: do not fallback to Google S2 (leaks hostname to third party)
  // Only use Chrome's native _favicon (local) - return null otherwise
  return Promise.resolve(null);
}

/**
 * Returns a website screenshot/preview image URL for a given page URL.
 * Privacy-hardened: external mShots service removed to prevent hostname
 * leakage to third party (WordPress). Returns null - previews disabled.
 * Future: implement local canvas screenshot if needed, behind explicit opt-in.
 *
 * @param {string} pageUrl
 * @returns {string|null}
 */
export function websitePreviewUrl(pageUrl) {
  // Disabled for privacy - would leak full URL to s0.wp.com
  // Return null to disable third-party preview; caller shows gradient fallback.
  void pageUrl;
  return null;
}

/** First letter of the bookmark title, uppercased. Used as
 *  a fallback when the favicon fails to load. */
export function initial(title) {
  if (typeof title !== "string") return "?";
  const trimmed = title.trim();
  if (trimmed.length === 0) return "?";
  return trimmed.charAt(0).toUpperCase();
}

/** Default fallback icon as a data URI SVG (circle icon) */
export function defaultFavicon() {
  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;
  const base64 = btoa(svgString);
  return `data:image/svg+xml;base64,${base64}`;
}
