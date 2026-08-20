// Shared CSS sanitizer - defense-in-depth for user-supplied customCss
// Strips vectors that can exfiltrate data or load remote resources.
// Used at domain setter, use-case, and presentation live-preview.

export function sanitizeCss(css) {
  if (typeof css !== "string") return "";
  let out = css;

  // Remove @import entirely (with or without url(), with or without semicolon)
  // Matches: @import "...";  @import url("https://evil");  @import '...' 
  out = out.replace(/@import\s+(?:url\s*\([^)]*\)|[^;{}]*)\s*;?/gi, "");

  // Remove @font-face that could load remote font and leak via unicode-range
  // Keep the block structure but strip src containing http(s)
  // Simpler: strip entire @font-face if it contains http
  out = out.replace(/@font-face\s*\{[^}]*https?:[^}]*\}/gi, "");

  // Strip url(...) that references external hosts (http, https, //, data with base64 large)
  // Allow relative url(...) and data:image/svg+xml without http
  // Block: url(http://...), url('https://...'), url("//evil.com"), url(data:text/html...)
  out = out.replace(/url\s*\(\s*(['"]?)\s*(https?:\/\/|\/\/|data:text\/html)[^)]*\1?\s*\)/gi, "url()");

  // Block javascript: inside url or anywhere
  out = out.replace(/javascript\s*:/gi, "");

  // Block expression(...) (IE) and -moz-binding / behavior
  out = out.replace(/expression\s*\([^)]*\)/gi, "");
  out = out.replace(/-moz-binding\s*:[^;{}]*;?/gi, "");
  out = out.replace(/\bbehavior\s*:[^;{}]*;?/gi, "");

  // Limit size to prevent DoS via huge CSS
  if (out.length > 20000) out = out.slice(0, 20000);

  return out;
}
