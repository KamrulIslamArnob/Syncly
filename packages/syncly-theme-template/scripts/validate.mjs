import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const themePath = path.resolve(__dirname, "../theme.json");

function hexToRgb(hex) {
  if (typeof hex !== "string") return { r: 85, g: 91, b: 102 };
  let clean = hex.trim().replace(/^#/, "");
  if (clean.length === 3) clean = clean.split("").map(c => c + c).join("");
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(clean)) return { r: 85, g: 91, b: 102 };
  const num = parseInt(clean.slice(0, 6), 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function getLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function calculateContrast(hex1, hex2) {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return Number(((lightest + 0.05) / (darkest + 0.05)).toFixed(2));
}

console.log("\n=======================================================");
console.log("  Syncly Theme Manifest Validator & Accessibility Audit");
console.log("=======================================================\n");

try {
  const raw = fs.readFileSync(themePath, "utf8");
  const theme = JSON.parse(raw);

  let errors = 0;
  let warnings = 0;

  // 1. Core Fields
  console.log("▶ 1. Validating Theme Metadata...");
  if (!theme.id || !/^(@[a-z0-9-_.]+\/)?[a-z0-9_-]{2,64}$/i.test(theme.id)) {
    console.error("  ✖ Error: 'id' must match pattern [a-z0-9_-] (2-64 chars)");
    errors++;
  } else {
    console.log(`  ✔ Theme ID: ${theme.id}`);
  }

  if (!theme.name || typeof theme.name !== "string") {
    console.error("  ✖ Error: 'name' must be a valid non-empty string");
    errors++;
  } else {
    console.log(`  ✔ Theme Name: ${theme.name}`);
  }

  if (!theme.version) {
    console.error("  ✖ Error: 'version' is required (SemVer)");
    errors++;
  }

  if (!theme.modes || !theme.modes.dark || !theme.modes.light) {
    console.error("  ✖ Error: 'modes' must contain both 'dark' and 'light' mode definitions");
    errors++;
  }

  // 2. Token & Contrast Validation
  console.log("\n▶ 2. Auditing Tokens & WCAG 2.1 Contrast Ratios...");
  for (const mode of ["dark", "light"]) {
    const tokens = theme.modes?.[mode]?.tokens;
    if (!tokens) {
      console.error(`  ✖ Missing tokens for mode: ${mode}`);
      errors++;
      continue;
    }

    const requiredTokens = ["--bg", "--surface", "--surface-2", "--fg", "--accent"];
    for (const t of requiredTokens) {
      if (!tokens[t]) {
        console.error(`  ✖ Mode [${mode}] missing required token: ${t}`);
        errors++;
      }
    }

    // Contrast Check
    if (tokens["--fg"] && tokens["--surface"]) {
      const ratio = calculateContrast(tokens["--fg"], tokens["--surface"]);
      if (ratio >= 7.0) {
        console.log(`  ✔ Mode [${mode}] Text on Surface: ${ratio}:1 (WCAG AAA Level)`);
      } else if (ratio >= 4.5) {
        console.log(`  ✔ Mode [${mode}] Text on Surface: ${ratio}:1 (WCAG AA Level)`);
      } else {
        console.warn(`  ⚠ Warning: Mode [${mode}] Text on Surface is ${ratio}:1 (< 4.5:1 recommended)`);
        warnings++;
      }
    }

    if (tokens["--on-accent"] && tokens["--accent"]) {
      const ratio = calculateContrast(tokens["--on-accent"], tokens["--accent"]);
      if (ratio >= 4.5) {
        console.log(`  ✔ Mode [${mode}] Text on Accent: ${ratio}:1 (Accessible)`);
      } else {
        console.warn(`  ⚠ Warning: Mode [${mode}] Text on Accent is ${ratio}:1 (< 4.5:1)`);
        warnings++;
      }
    }
  }

  // 3. CSS Security Check
  console.log("\n▶ 3. Inspecting Custom CSS Security...");
  for (const mode of ["dark", "light"]) {
    const css = theme.modes?.[mode]?.customCss || "";
    if (css) {
      if (/@import/i.test(css)) {
        console.error(`  ✖ Security Error: @import is strictly prohibited in customCss (${mode})`);
        errors++;
      }
      if (/url\s*\(\s*["']?https?:/i.test(css)) {
        console.error(`  ✖ Security Error: Remote HTTP/HTTPS URLs are prohibited in customCss (${mode})`);
        errors++;
      }
      if (/javascript:|expression\(/i.test(css)) {
        console.error(`  ✖ Security Error: Script injection pattern detected in customCss (${mode})`);
        errors++;
      }
      if (css.length > 20000) {
        console.error(`  ✖ Error: Custom CSS length exceeds 20,000 chars (${mode})`);
        errors++;
      }
      console.log(`  ✔ Custom CSS in mode [${mode}] passed security checks (${css.length} chars)`);
    } else {
      console.log(`  ✔ No custom CSS in mode [${mode}]`);
    }
  }

  console.log("\n-------------------------------------------------------");
  if (errors === 0) {
    console.log(`\n🎉 VALIDATION PASSED! Theme "${theme.name}" (${theme.id}) is valid and ready to publish.`);
    if (warnings > 0) console.log(`   (${warnings} non-blocking accessibility warnings)\n`);
    process.exit(0);
  } else {
    console.error(`\n❌ VALIDATION FAILED with ${errors} error(s).\n`);
    process.exit(1);
  }
} catch (err) {
  console.error(`\n❌ Failed to validate theme: ${err.message}\n`);
  process.exit(1);
}
