import test, { describe, it } from "node:test";
import assert from "node:assert/strict";

import { BasicSanitizer } from "../src/infrastructure/security/BasicSanitizer.js";
import { sanitizeCss } from "../src/infrastructure/security/cssSanitizer.js";
import { Url } from "../src/domain/valueObjects/Url.js";

// ─── BasicSanitizer ───────────────────────────────────────────────
describe("Security: BasicSanitizer", () => {
  const sanitizer = new BasicSanitizer();

  it("SEC-01 text strips control chars, <>, and trims; non-string → \"\"", () => {
    assert.equal(sanitizer.text("  hello\x00\x1F<>world  "), "helloworld");
    assert.equal(sanitizer.text("  clean  "), "clean");
    assert.equal(sanitizer.text("no-change"), "no-change");
    assert.equal(sanitizer.text(""), "");
    assert.equal(sanitizer.text(null), "");
    assert.equal(sanitizer.text(undefined), "");
    assert.equal(sanitizer.text(123), "");
    assert.equal(sanitizer.text({}), "");
    // 0x7F DEL
    assert.equal(sanitizer.text("a\x7Fb"), "ab");
    // < and > individually
    assert.equal(sanitizer.text("a<b>c"), "abc");
    // preserves normal unicode
    assert.equal(sanitizer.text("héllo"), "héllo");
  });

  it("SEC-02 url re-validates via Url VO, returns href or \"\"", () => {
    assert.equal(sanitizer.url("https://example.com"), "https://example.com/");
    assert.equal(sanitizer.url("  https://example.com/path?x=1  "), "https://example.com/path?x=1");
    assert.equal(sanitizer.url("http://a.b"), "http://a.b/");
    // bare host auto-prefixed
    assert.equal(sanitizer.url("example.com"), "http://example.com/");
    // dangerous schemes → ""
    for (const bad of [
      "javascript:alert(1)",
      "JaVAScript:alert(1)",
      "data:text/html,<h1>x</h1>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "ftp://host/x",
      "",
      "   ",
      null,
      undefined,
      42,
    ]) {
      assert.equal(sanitizer.url(bad), "", `expected "" for ${JSON.stringify(bad)}`);
    }
    // invalid but not dangerous also → ""
    assert.equal(sanitizer.url("not a url at all?"), ""); // Url throws, caught
  });

  it("url preserves normalized href (trailing slash)", () => {
    // Url adds trailing slash for origin-only
    const href = sanitizer.url("https://example.com");
    assert.equal(href, "https://example.com/");
  });

  it("text does not double-encode, url does not accept data: image", () => {
    // data:image is blocked by Url VO (must be http(s))
    assert.equal(sanitizer.url("data:image/png;base64,abc"), "");
  });
});

// ─── cssSanitizer ─────────────────────────────────────────────────
describe("Security: sanitizeCss", () => {
  it("SEC-03 strips @import, @font-face with http, url(http), javascript:, expression, -moz-binding, behavior, caps 20k", () => {
    const evil = `
      @import url("https://evil.com/x.css");
      @import "https://evil.com/y.css";
      body { color: red; }
      @font-face { font-family: evil; src: url(https://evil.com/font.woff); }
      @font-face { font-family: safe; src: local("Arial"); }
      div { background: url(https://evil.com/bg.png); }
      span { background: url('//evil.com/a.png'); }
      p { background: url(data:text/html,<h1>hi</h1>); }
      a { background: url(http://evil.com/x.jpg); }
      .x { color: javascript:alert(1); }
      .y { width: expression(alert(1)); }
      .z { -moz-binding: url('http://evil.com/x.xml#x'); }
      .w { behavior: url(x.htc); }
    `;
    const out = sanitizeCss(evil);
    assert.equal(out.includes("@import"), false);
    assert.equal(out.includes("https://evil.com"), false);
    assert.equal(out.includes("javascript:"), false);
    assert.equal(out.includes("expression"), false);
    assert.equal(out.includes("-moz-binding"), false);
    assert.equal(out.includes("behavior"), false);
    // external url() replaced with url()
    assert.ok(out.includes("url()") || out.includes("url()"), "expected url() sanitized");
    // benign parts preserved
    assert.ok(out.includes("body"));
    assert.ok(out.includes("color: red"));
  });

  it("keeps safe @font-face without http", () => {
    const css = `@font-face { font-family: safe; src: local("Arial"); } body { font-family: safe; }`;
    const out = sanitizeCss(css);
    assert.ok(out.includes("@font-face"), "safe font-face should remain");
    assert.ok(out.includes("local"));
  });

  it("allows relative url() and data:image/svg+xml", () => {
    const css = `div { background: url(../img/bg.png); } svg { background: url(data:image/svg+xml;base64,PHN2Zz4=); }`;
    const out = sanitizeCss(css);
    // relative and svg data should not be stripped (only http, //, data:text/html are stripped)
    assert.ok(out.includes("url(../img/bg.png)"));
    // data:image/svg+xml is allowed, so it should remain or at least not become url()
    assert.ok(out.includes("PHN2Zz4=") || out.includes("data:image/svg+xml"));
  });

  it("SEC-04 non-string → \"\", benign css preserved", () => {
    assert.equal(sanitizeCss(null), "");
    assert.equal(sanitizeCss(undefined), "");
    assert.equal(sanitizeCss(123), "");
    assert.equal(sanitizeCss({}), "");
    assert.equal(sanitizeCss(""), "");
    const benign = "body { color: #123; } .x { margin: 0; }";
    assert.equal(sanitizeCss(benign), benign);
  });

  it("caps at 20k", () => {
    const big = "a".repeat(25000);
    const out = sanitizeCss(big);
    assert.equal(out.length, 20000);
    const exact = "b".repeat(20000);
    assert.equal(sanitizeCss(exact).length, 20000);
    const small = "c".repeat(19999);
    assert.equal(sanitizeCss(small).length, 19999);
  });

  it("case-insensitive and handles spacing variants", () => {
    assert.equal(sanitizeCss(`@IMPORT url(https://x)`).includes("@IMPORT"), false);
    assert.equal(sanitizeCss(`JaVaScRiPt:alert(1)`).includes("javascript:"), false);
    assert.equal(sanitizeCss(`EXPRESSION (alert)`).includes("expression"), false);
    assert.equal(sanitizeCss(`URL( https://evil.com/a.png )`).includes("https://evil.com"), false);
  });
});

// ─── Url VO security edge (also security layer) ────────────────────
describe("Security: Url VO extra vectors", () => {
  it("rejects javascript: even with leading spaces or uppercase", () => {
    for (const v of [" javascript:alert(1)", "JavaScript:alert(1)", "javascript :alert(1)"]) {
      assert.throws(() => new Url(v), undefined, `vector ${v}`);
    }
  });
  it("rejects data: with base64", () => {
    assert.throws(() => new Url("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="));
  });
});
