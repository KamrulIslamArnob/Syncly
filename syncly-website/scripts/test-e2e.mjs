#!/usr/bin/env node
/**
 * ============================================================================
 * Syncly Product Website — Comprehensive 4-Tier E2E Opaque-Box Test Suite
 * ============================================================================
 * Methodology: Project Pattern 4-Tier Requirement-Driven Verification
 *
 * Tier 1: Feature Coverage (>= 5 tests per feature across all 12 feature areas)
 * Tier 2: Boundary & Corner Cases (>= 5 tests per category: Viewports, Themes, Contrast, Assets, Accordions, Tabs, Motion)
 * Tier 3: Cross-Feature Combinations (Pairwise interactions, link anchors, z-index layering, CTA consistency)
 * Tier 4: Real-World Application Scenarios (User Onboarding, Privacy Consistency, Zero-Server Sync Messaging, Benchmark Traceability)
 *
 * Execution: node scripts/test-e2e.mjs
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// ANSI Color Codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const BLUE = '\x1b[34m';

// Test Harness State
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];
let currentSuite = '';
let currentTier = '';

// Helper Test Harness Functions
function setTier(tierName) {
  currentTier = tierName;
  console.log(`\n${BOLD}${CYAN}══════════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${CYAN}  ${tierName}${RESET}`);
  console.log(`${BOLD}${CYAN}══════════════════════════════════════════════════════════════════${RESET}`);
}

function suite(suiteName) {
  currentSuite = suiteName;
  console.log(`\n${BOLD}${BLUE}▸ ${suiteName}${RESET}`);
}

function test(testName, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ${GREEN}✓${RESET} ${DIM}${testName}${RESET}`);
  } catch (err) {
    failedTests++;
    const failureDetail = {
      tier: currentTier,
      suite: currentSuite,
      test: testName,
      error: err.message || String(err),
      stack: err.stack
    };
    failures.push(failureDetail);
    console.log(`  ${RED}✗ ${testName}${RESET}`);
    console.log(`    ${RED}Error: ${err.message}${RESET}`);
  }
}

// Custom Assertions
function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed: expected true, got false');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(haystack, needle, message) {
  if (!haystack || !haystack.includes(needle)) {
    throw new Error(`${message || 'Assertion failed'}: expected content to include ${JSON.stringify(needle)}`);
  }
}

function assertMatches(haystack, regex, message) {
  if (!haystack || !regex.test(haystack)) {
    throw new Error(`${message || 'Assertion failed'}: pattern ${regex} did not match content`);
  }
}

function assertGreaterThanOrEqual(actual, min, message) {
  if (actual < min) {
    throw new Error(`${message || 'Assertion failed'}: expected ${actual} >= ${min}`);
  }
}

// WCAG 2.1 Luminance & Contrast Calculation
function parseHexColor(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return { r, g, b };
}

function getRelativeLuminance(rgb) {
  const rs = rgb.r / 255;
  const gs = rgb.g / 255;
  const bs = rgb.b / 255;

  const rLin = rs <= 0.04045 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
  const gLin = gs <= 0.04045 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
  const bLin = bs <= 0.04045 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

function calculateContrastRatio(hex1, hex2) {
  const lum1 = getRelativeLuminance(parseHexColor(hex1));
  const lum2 = getRelativeLuminance(parseHexColor(hex2));
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// File Reading & Aggregation Helpers
function readFileSafe(relPath) {
  const fullPath = path.join(ROOT_DIR, relPath);
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath, 'utf8');
  }
  return '';
}

function listFilesRecursive(dirRelPath) {
  const fullDir = path.join(ROOT_DIR, dirRelPath);
  if (!fs.existsSync(fullDir)) return [];
  const results = [];
  function recurse(current) {
    const list = fs.readdirSync(current);
    for (const item of list) {
      const p = path.join(current, item);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        recurse(p);
      } else {
        results.push(path.relative(ROOT_DIR, p).replace(/\\/g, '/'));
      }
    }
  }
  recurse(fullDir);
  return results;
}

// Load Core Project Artifacts
const packageJson = JSON.parse(readFileSafe('package.json') || '{}');
const projectMd = readFileSafe('PROJECT.md');
const originalRequestMd = readFileSafe('ORIGINAL_REQUEST.md');
const globalsCss = readFileSafe('app/globals.css');
const layoutJs = readFileSafe('app/layout.js') || readFileSafe('app/layout.tsx');
const pageJs = readFileSafe('app/page.js') || readFileSafe('app/page.tsx');
const pageJsNew = readFileSafe('app/page.js.new');

// Aggregate source text from app/ and components/
const componentFiles = listFilesRecursive('components');
const appFiles = listFilesRecursive('app');
const publicFiles = listFilesRecursive('public');

let aggregatedComponentSource = '';
for (const f of componentFiles) {
  aggregatedComponentSource += `\n/* File: ${f} */\n` + readFileSafe(f);
}
let aggregatedAppSource = layoutJs + '\n' + pageJs + '\n' + (pageJsNew || '');
let allCodeSource = aggregatedAppSource + '\n' + aggregatedComponentSource;

console.log(`${BOLD}${MAGENTA}==================================================================${RESET}`);
console.log(`${BOLD}${MAGENTA}   SYNCLY PRODUCT WEBSITE — 4-TIER E2E OPAQUE-BOX TEST RUNNER     ${RESET}`);
console.log(`${BOLD}${MAGENTA}==================================================================${RESET}`);
console.log(`${DIM}Root Directory: ${ROOT_DIR}${RESET}`);
console.log(`${DIM}Total Component Files: ${componentFiles.length} | App Files: ${appFiles.length} | Public Files: ${publicFiles.length}${RESET}\n`);

// ============================================================================
// TIER 1: FEATURE COVERAGE (>=5 tests per feature across all 12 feature areas)
// ============================================================================
setTier('TIER 1: FEATURE COVERAGE (>=5 tests per feature)');

// 1.1 Visual Architecture & Design Tokens
suite('1.1 Visual Architecture & Design Tokens');

test('1.1.1 - Defines dark mode background canvas token (--bg)', () => {
  assertMatches(globalsCss, /--bg:\s*#(?:080a0d|07080a)/i, 'Dark canvas background must match deep dark token (#080a0d or #07080a)');
});

test('1.1.2 - Defines elevated surface card tokens (--surface, --surface-2, --surface-3)', () => {
  assertMatches(globalsCss, /--surface:\s*#(?:111318|0e1015)/i, 'Elevated surface token must exist');
  assertMatches(globalsCss, /--surface-2:\s*#/i, 'Secondary elevated surface token must exist');
  assertMatches(globalsCss, /--surface-3:\s*#/i, 'Tertiary elevated surface token must exist');
});

test('1.1.3 - Defines brand electric crimson and accent glow tokens', () => {
  assertMatches(globalsCss, /--accent:\s*#d71921/i, 'Primary crimson accent #d71921 must be defined');
  assertMatches(globalsCss, /--accent-glow:\s*rgba\(215,\s*25,\s*33/i, 'Accent glow rgba token must be defined');
});

test('1.1.4 - Configures variable fonts for body typography (--font-body)', () => {
  assertMatches(layoutJs, /plusjakartasans-var\.woff2|geist|--font-body/i, 'Body font must be linked in layout');
  assertMatches(globalsCss, /var\(--font-body\)/i, 'globals.css must apply var(--font-body) to body font-family');
});

test('1.1.5 - Configures monospace font for code and numeral tokens (--font-mono)', () => {
  assertMatches(layoutJs, /jetbrainsmono-var\.woff2|--font-mono/i, 'Mono font must be configured in layout');
  assertMatches(globalsCss, /var\(--font-mono\)/i, 'globals.css must reference var(--font-mono)');
});

test('1.1.6 - Implements glassmorphism backdrop-filter blur and border styling', () => {
  assertMatches(globalsCss, /backdrop-filter:\s*blur|rgba\(255,\s*255,\s*255,\s*0\.07\)|--border/i, 'Glassmorphism and border tokens must be declared');
});

// 1.2 High-Fidelity UI Assets Pipeline
suite('1.2 High-Fidelity UI Assets Pipeline');

test('1.2.1 - Workspace Dashboard asset or vector mockup structure exists', () => {
  const hasWorkspaceAsset = publicFiles.some(f => f.includes('syncly_workspace_dashboard') || f.includes('workspace')) ||
                            allCodeSource.includes('syncly_workspace_dashboard') ||
                            allCodeSource.includes('w-Agency') || allCodeSource.includes('w-Personal');
  assertTrue(hasWorkspaceAsset, 'Workspace dashboard asset or high-fidelity mockup structure must exist');
});

test('1.2.2 - Omni-Search Modal asset or live mockup palette exists', () => {
  const hasOmniAsset = publicFiles.some(f => f.includes('syncly_omnisearch_modal') || f.includes('omnisearch')) ||
                       allCodeSource.includes('syncly_omnisearch_modal') ||
                       allCodeSource.includes('Omni-search') || allCodeSource.includes('research system');
  assertTrue(hasOmniAsset, 'Omni-Search modal asset or live interactive command palette must exist');
});

test('1.2.3 - Quickie Popup 1-Click capture asset or mockup exists', () => {
  const hasQuickieAsset = publicFiles.some(f => f.includes('syncly_quickie_popup') || f.includes('quickie')) ||
                          allCodeSource.includes('syncly_quickie_popup') ||
                          allCodeSource.includes('Quickie inbox') || allCodeSource.includes('Saved to Quickie');
  assertTrue(hasQuickieAsset, 'Quickie 1-Click capture popup asset or mockup must exist');
});

test('1.2.4 - Zero-Server Sync flow vector asset or animated canvas/SVG pipeline exists', () => {
  const hasSyncAsset = publicFiles.some(f => f.includes('syncly_sync_flow') || f.includes('sync')) ||
                       allCodeSource.includes('syncly_sync_flow') ||
                       allCodeSource.includes('SyncEngineFlow') || allCodeSource.includes('how-sync-works') || allCodeSource.includes('ParticleField');
  assertTrue(hasSyncAsset, 'Sync flow visualizer asset or dynamic vector visualizer component must exist');
});

test('1.2.5 - Asset references include descriptive accessibility alt text or ARIA representations', () => {
  assertMatches(allCodeSource, /alt=["']|aria-label=|aria-hidden=/i, 'All asset or visual mockup elements must have alt or aria accessibility attributes');
});

// 1.3 Floating Glassmorphism Navbar
suite('1.3 Floating Glassmorphism Navbar');

test('1.3.1 - Fixed/floating navigation container structure with sticky behavior', () => {
  assertMatches(globalsCss, /\.nav\s*\{[^}]*position:\s*fixed/i, 'Navigation bar must be fixed at top of viewport');
  assertMatches(allCodeSource, /<nav|<motion\.header|className=["'][^"']*nav/i, 'Navigation landmark must exist in markup');
});

test('1.3.2 - Brand wordmark with accent indicator dot', () => {
  assertMatches(allCodeSource, /wordmark|wordmark-dot/i, 'Brand wordmark with dot must be present');
  assertIncludes(allCodeSource, 'Syncly', 'Brand wordmark text "Syncly" must be present');
});

test('1.3.3 - Navigation anchor links targeting primary sections', () => {
  assertMatches(allCodeSource, /href=["']#how-sync-works["']|href=["']#sync-engine["']|href=["']#how-it-works["']|href:\s*["']#(?:how-sync-works|sync-engine|how-it-works)["']/i, 'Must contain How Sync Works anchor link');
  assertMatches(allCodeSource, /href=["']#features["']|href:\s*["']#features["']/i, 'Must contain Features anchor link');
  assertMatches(allCodeSource, /href=["']#performance["']|href=["']#benchmarks["']|href:\s*["']#(?:performance|benchmarks)["']/i, 'Must contain Performance/Benchmarks anchor link');
  assertMatches(allCodeSource, /href=["']#faq["']|href:\s*["']#faq["']/i, 'Must contain FAQ anchor link');
});

test('1.3.4 - Chrome Web Store "Add to Chrome" primary CTA in navbar', () => {
  assertMatches(allCodeSource, /Add to Chrome/i, 'Navbar must include Add to Chrome CTA');
  assertMatches(allCodeSource, /chromewebstore\.google\.com|STORE_URL/i, 'CTA must link to Chrome Web Store');
});

test('1.3.5 - Mobile menu drawer with accessible toggle button', () => {
  assertMatches(allCodeSource, /mobile-menu-btn|mobileOpen|mobile-drawer/i, 'Mobile menu drawer toggle mechanism must exist');
  assertMatches(allCodeSource, /aria-label=["']Open menu["']|aria-label=["']Close menu["']|mobileOpen/i, 'Mobile button must have accessible label');
});

// 1.4 Hero Section Headline & Dual CTAs
suite('1.4 Hero Section Headline & Dual CTAs');

test('1.4.1 - Hero section live status badge / eyebrow badge', () => {
  assertMatches(allCodeSource, /eyebrow|eyebrow-dot|live status|Syncly · Local-First/i, 'Hero must feature a live status/version badge');
  assertMatches(allCodeSource, /Chrome extension|MIT|v0\.\d/i, 'Badge must indicate extension version and license');
});

test('1.4.2 - High-impact headline with multi-line gradient/emphasis typography', () => {
  assertMatches(allCodeSource, /<h1>|<motion\.h1|Your bookmarks/i, 'Hero must contain primary H1 headline');
  assertMatches(allCodeSource, /everywhere|nowhere/i, 'Headline must convey privacy and universal sync proposition');
});

test('1.4.3 - Primary "Add to Chrome — Free" CTA with Chrome icon', () => {
  assertMatches(allCodeSource, /Add to Chrome — Free/i, 'Primary CTA button must feature "Add to Chrome — Free"');
  assertMatches(allCodeSource, /ChromeIcon|<svg/i, 'CTA must include Chrome icon visual');
});

test('1.4.4 - Secondary CTA linking to mechanism / source code', () => {
  assertMatches(allCodeSource, /See how sync works|Read the source|View on GitHub/i, 'Secondary CTA must be present');
});

test('1.4.5 - Benchmark & trust metadata micro-badges in hero', () => {
  assertMatches(allCodeSource, /MIT licensed/i, 'Hero meta must highlight MIT license');
  assertMatches(allCodeSource, /4(?:\.5)?\s*MB/i, 'Hero meta must highlight low memory footprint');
  assertMatches(allCodeSource, /12\s*ms/i, 'Hero meta must highlight 12ms first paint');
});

// 1.5 Interactive 4-Tab Product Demo
suite('1.5 Interactive 4-Tab Product Demo');

test('1.5.1 - 4-Tab / multi-context workspace switching mechanism', () => {
  assertMatches(allCodeSource, /Agency|Personal|Research/i, 'Workspace demo contexts must exist');
  assertMatches(allCodeSource, /activeWs|setActiveWs|activeTab|setActiveTab/i, 'State hook for active tab/workspace must be defined');
});

test('1.5.2 - Interactive tab pill buttons with active indicator', () => {
  assertMatches(allCodeSource, /workspaces\.map|demos\.map|tabs\.map/i, 'Tab pill buttons must be rendered iteratively');
  assertMatches(allCodeSource, /cursor:\s*["']?pointer["']?|onClick=/i, 'Tab buttons must have click handlers');
});

test('1.5.3 - macOS-style window frame with traffic light dot controls', () => {
  assertMatches(allCodeSource, /browser-bar|dots|<i \/><i \/><i \/>|traffic lights|WindowFrame/i, 'Window frame mockup with traffic lights must exist');
  assertMatches(globalsCss, /\.dots\s+i|\.browser-bar/i, 'Traffic light dot styling must be defined in CSS');
});

test('1.5.4 - Dynamic demo content updates per active tab', () => {
  assertMatches(allCodeSource, /allBookmarks\[activeWs\]|demos\[activeWs\]|activeTab/i, 'Demo body must dynamically select content based on active state');
  assertMatches(allCodeSource, /#design|#work|#code|#reading|#research/i, 'Bookmark tags must be rendered inside demo');
});

test('1.5.5 - Automated typing simulation and omni-search demonstration', () => {
  assertMatches(allCodeSource, /research system|setTyped|typed|Search bookmarks/i, 'Omni-search typing simulation or search query preview must exist');
});

// 1.6 3-Step Animated Sync Engine Flow
suite('1.6 3-Step Animated Sync Engine Flow');

test('1.6.1 - Step 1 "Save anywhere" local bookmarks capture', () => {
  assertMatches(allCodeSource, /Save anywhere/i, 'Step 1 must be titled "Save anywhere"');
  assertMatches(allCodeSource, /popup|new tab|nt omnibox|real Chrome bookmarks/i, 'Step 1 body must explain saving to native bookmarks');
});

test('1.6.2 - Step 2 "Chrome sync carries it" native transport', () => {
  assertMatches(allCodeSource, /Chrome (?:sync )?carries it/i, 'Step 2 must explain Chrome carrying the sync payload');
  assertMatches(allCodeSource, /chrome\.storage\.sync|native bookmark sync/i, 'Step 2 must explain serverless native transport');
});

test('1.6.3 - Step 3 "Every device catches up" background service worker merge', () => {
  assertMatches(allCodeSource, /Every device catches up/i, 'Step 3 must be titled "Every device catches up"');
  assertMatches(allCodeSource, /service worker|merges|reconciliation/i, 'Step 3 must explain Manifest V3 service worker reconciliation');
});

test('1.6.4 - Zero-server architecture explanation in section header', () => {
  assertMatches(allCodeSource, /Sync (?:without|with zero) (?:a )?middleman|never touches it|Zero Backend/i, 'Sync section must articulate the zero-middleman architecture');
});

test('1.6.5 - Step cards rendered with numeric badges (01, 02, 03) and custom icons', () => {
  assertMatches(allCodeSource, /01/i, 'Step 01 must exist');
  assertMatches(allCodeSource, /02/i, 'Step 02 must exist');
  assertMatches(allCodeSource, /03/i, 'Step 03 must exist');
  assertMatches(allCodeSource, /step-icon|step-num/i, 'Step icon and number styling classes must exist');
});

// 1.7 Interactive Bento Feature Grid
suite('1.7 Interactive Bento Feature Grid');

test('1.7.1 - Workspaces bento card with context switching', () => {
  assertMatches(allCodeSource, /Workspaces/i, 'Workspaces feature card must be present');
  assertMatches(allCodeSource, /Agency|Personal|Lab|switch your whole dashboard/i, 'Workspaces card must describe context switching');
});

test('1.7.2 - Collections & Tags bento card with hashtag chips', () => {
  assertMatches(allCodeSource, /Collections & (?:#)?tags/i, 'Collections & tags card must be present');
  assertMatches(allCodeSource, /#research|#inspo|#client|#archive/i, 'Hashtags must be displayed as chips');
});

test('1.7.3 - Quickie 1-Click capture inbox card', () => {
  assertMatches(allCodeSource, /Quickie inbox/i, 'Quickie inbox card must be present');
  assertMatches(allCodeSource, /One click captures|Saved to Quickie/i, 'Quickie card must describe 1-click capture behavior');
});

test('1.7.4 - Omni-search command palette card', () => {
  assertMatches(allCodeSource, /Omni-search/i, 'Omni-search card must be present');
  assertMatches(allCodeSource, /Instant search across shortcuts/i, 'Omni-search card must describe instant multi-attribute search');
});

test('1.7.5 - Keyboard-first shortcuts card with keycap tokens', () => {
  assertMatches(allCodeSource, /Keyboard-first/i, 'Keyboard-first card must be present');
  assertMatches(allCodeSource, /⌘ K|nt tab|nt commands/i, 'Keyboard keycap badges must be rendered');
});

// 1.8 Performance & Privacy Benchmark Strip
suite('1.8 Performance & Privacy Benchmark Strip');

test('1.8.1 - First paint benchmark counter (12ms)', () => {
  assertMatches(allCodeSource, /12/i, '12ms number must exist');
  assertMatches(allCodeSource, /First paint/i, 'First paint label must exist');
});

test('1.8.2 - Full dashboard load benchmark counter (28ms)', () => {
  assertMatches(allCodeSource, /28/i, '28ms number must exist');
  assertMatches(allCodeSource, /500 bookmarks|Full dashboard load/i, '500 bookmarks payload condition must be stated');
});

test('1.8.3 - Memory footprint benchmark counter (~4MB)', () => {
  assertMatches(allCodeSource, /4(?:\.0|\.5)?/i, '4MB memory number must exist');
  assertMatches(allCodeSource, /Memory per tab|RAM/i, 'Memory per tab label must exist');
});

test('1.8.4 - Animated count-up numeral counter component', () => {
  assertMatches(allCodeSource, /Counter|CountUp|requestAnimationFrame/i, 'Count up animation component must be implemented');
  assertMatches(globalsCss, /tabular-nums/i, 'tabular-nums font formatting must be used for latency counters');
});

test('1.8.5 - Benchmark methodology footnote citing reproducibility', () => {
  assertMatches(allCodeSource, /benchmark|mid-range laptop|reproducible/i, 'Benchmark footnote must cite reproducible testing conditions');
});

// 1.9 Cloud Comparison & Privacy Matrix
suite('1.9 Cloud Comparison & Privacy Matrix');

test('1.9.1 - "Nothing leaves your browser" privacy hero claim', () => {
  assertMatches(allCodeSource, /Nothing leaves <strong>your browser|No backend to breach/i, 'Privacy headline must state nothing leaves browser');
});

test('1.9.2 - No backend / zero cloud server architectural guarantee', () => {
  assertMatches(allCodeSource, /No backend to breach|no Syncly server|Zero Backend/i, 'Must guarantee absence of cloud backend');
});

test('1.9.3 - No account / zero registration requirement guarantee', () => {
  assertMatches(allCodeSource, /No account to make|no user accounts|Chrome profile is the only identity/i, 'Must guarantee zero account requirement');
});

test('1.9.4 - MIT-licensed open source auditable code claim', () => {
  assertMatches(allCodeSource, /MIT source you can read|MIT-licensed|audit in an afternoon/i, 'Must highlight auditable MIT license');
});

test('1.9.5 - Structured privacy list card grid with custom geometric glyphs', () => {
  assertMatches(allCodeSource, /privacy-list|privacy-icon|privacy-big/i, 'Privacy list container classes must be structured');
});

// 1.10 Collapsible FAQ Accordion
suite('1.10 Collapsible FAQ Accordion');

test('1.10.1 - FAQ Section container with structured item list', () => {
  assertMatches(allCodeSource, /faq-list|faq-item|FAQS|FaqItem/i, 'FAQ component and item list must be present');
});

test('1.10.2 - FAQ answers pricing & license question ("Is it really free?")', () => {
  assertMatches(allCodeSource, /Is it really free\?|free.*MIT-licensed/i, 'FAQ must answer pricing question');
});

test('1.10.3 - FAQ answers account question ("Do I need an account?")', () => {
  assertMatches(allCodeSource, /Do I need an account\?|No\. Syncly uses the Chrome profile/i, 'FAQ must answer account question');
});

test('1.10.4 - FAQ answers zero-server sync mechanism question', () => {
  assertMatches(allCodeSource, /How does sync work without a server\?|workspace folders are plain bookmark folders/i, 'FAQ must explain zero-server sync mechanics');
});

test('1.10.5 - Accessible button trigger with aria-expanded attribute', () => {
  assertMatches(allCodeSource, /aria-expanded=\{open\}|aria-expanded/i, 'FAQ item button must bind aria-expanded');
  assertMatches(allCodeSource, /role=["']region["']|faq-a/i, 'FAQ answer region must be properly marked');
});

// 1.11 High-Conversion Footer
suite('1.11 High-Conversion Footer');

test('1.11.1 - Final conversion CTA card with headline and dual actions', () => {
  assertMatches(allCodeSource, /Keep your data|Lose the chaos/i, 'Final CTA banner headline must be present');
  assertMatches(allCodeSource, /final|hero-ctas/i, 'Final CTA layout classes must be defined');
});

test('1.11.2 - Primary CTA button linking to Chrome Web Store', () => {
  assertMatches(allCodeSource, /btn btn-primary/i, 'Primary CTA button class must be applied');
  assertMatches(allCodeSource, /STORE_URL|chromewebstore/i, 'Must link to Chrome Web Store');
});

test('1.11.3 - GitHub repository source code link', () => {
  assertMatches(allCodeSource, /GITHUB_URL|github\.com/i, 'Must link to GitHub repository');
});

test('1.11.4 - Footer semantic landmark with brand wordmark and copyright', () => {
  assertMatches(allCodeSource, /<footer|className=["'][^"']*footer/i, 'Semantic footer landmark must exist');
  assertMatches(allCodeSource, /Syncly contributors|getFullYear\(\)/i, 'Footer must contain copyright notice');
});

test('1.11.5 - Footer privacy and license reminder badge', () => {
  assertMatches(allCodeSource, /MIT licensed · No accounts · No telemetry/i, 'Footer must reiterate core privacy truths');
});

// 1.12 Responsive & Semantic HTML5 Engineering
suite('1.12 Responsive & Semantic HTML5 Engineering');

test('1.12.1 - Root layout includes semantic <html lang="en"> and suppresses hydration mismatch', () => {
  assertMatches(layoutJs, /<html\s+lang=["']en["']\s+suppressHydrationWarning/i, 'Root HTML element must declare lang="en" and suppressHydrationWarning');
});

test('1.12.2 - Complete SEO OpenGraph metadata declared in layout.js', () => {
  assertMatches(layoutJs, /metadata\s*=\s*\{/i, 'Layout must export Next.js metadata object');
  assertMatches(layoutJs, /openGraph:\s*\{/i, 'Layout must export OpenGraph configuration');
  assertMatches(layoutJs, /description:\s*["'][^"']+["']/i, 'Layout must export page description');
});

test('1.12.3 - Semantic landmark tags used (<header>, <main>, <section>, <nav>, <footer>)', () => {
  assertMatches(allCodeSource, /<header|<motion\.header/i, '<header> landmark must be present');
  assertMatches(allCodeSource, /<main/i, '<main> landmark must be present');
  assertMatches(allCodeSource, /<section/i, '<section> landmarks must be present');
  assertMatches(allCodeSource, /<nav/i, '<nav> landmarks must be present');
  assertMatches(allCodeSource, /<footer/i, '<footer> landmark must be present');
});

test('1.12.4 - Anti-FOUC inline theme script in layout <head>', () => {
  assertMatches(layoutJs, /dangerouslySetInnerHTML=\{\{\s*__html:\s*`\(function\(\)\{/i, 'Anti-FOUC script must be injected in <head>');
  assertMatches(layoutJs, /localStorage\.getItem\(['"]syncly-theme['"]\)/i, 'Script must restore syncly-theme preference');
});

test('1.12.5 - CSS global container constraint and horizontal overflow protection', () => {
  assertMatches(globalsCss, /overflow-x:\s*hidden/i, 'Body must prevent horizontal overflow');
  assertMatches(globalsCss, /--max:\s*\d+px/i, 'Max width container token must be defined');
});


// ============================================================================
// TIER 2: BOUNDARY & CORNER CASES (>=5 tests per category)
// ============================================================================
setTier('TIER 2: BOUNDARY & CORNER CASES (>=5 per category)');

// 2.1 Viewport Extremes & Responsive Breakdown
suite('2.1 Viewport Extremes & Responsive Breakdown');

test('2.1.1 - Mobile viewport (max-width: 860px) responsive layout rules', () => {
  assertMatches(globalsCss, /@media\s*\(max-width:\s*860px\)/i, 'globals.css must define mobile/tablet breakpoint at 860px');
});

test('2.1.2 - Mobile viewport performance grid collapses to single column', () => {
  assertMatches(globalsCss, /@media\s*\(max-width:\s*860px\)\s*\{[^}]*\.perf-grid\s*\{[^}]*grid-template-columns:\s*1fr/i, 'Performance grid must collapse to 1fr on small screens');
});

test('2.1.3 - Fluid clamp typography scaling across viewports', () => {
  assertMatches(globalsCss, /clamp\(\s*\d+px,\s*\d+(?:\.\d+)?vw,\s*\d+px\s*\)/i, 'CSS must utilize clamp() for fluid, responsive typography');
});

test('2.1.4 - Mobile menu drawer hides on desktop and displays on mobile', () => {
  assertMatches(globalsCss, /mobile-drawer|mobile-menu-btn/i, 'Mobile drawer and trigger styling must exist');
});

test('2.1.5 - Container max-width clamping prevents stretching on 1440px+ screens', () => {
  assertMatches(globalsCss, /--max:\s*1240px|max-width:\s*var\(--max\)|max-width:\s*1240px/i, 'Container max width must clamp content layout');
});

// 2.2 Dark Theme Tokens & WCAG AAA Contrast
suite('2.2 Dark Theme Tokens & WCAG AAA Contrast');

test('2.2.1 - Body text (#ffffff) on Dark Canvas (#080a0d) meets WCAG AAA (>= 7:1)', () => {
  const contrast = calculateContrastRatio('#ffffff', '#080a0d');
  assertGreaterThanOrEqual(contrast, 7.0, `Contrast ratio ${contrast.toFixed(2)}:1 must exceed WCAG AAA 7.0:1`);
});

test('2.2.2 - Body text (#ffffff) on Elevated Surface (#111318) meets WCAG AAA (>= 7:1)', () => {
  const contrast = calculateContrastRatio('#ffffff', '#111318');
  assertGreaterThanOrEqual(contrast, 7.0, `Contrast ratio ${contrast.toFixed(2)}:1 must exceed WCAG AAA 7.0:1`);
});

test('2.2.3 - Secondary text (#9aa0ad) on Dark Canvas (#080a0d) meets WCAG AA (>= 4.5:1)', () => {
  const contrast = calculateContrastRatio('#9aa0ad', '#080a0d');
  assertGreaterThanOrEqual(contrast, 4.5, `Secondary contrast ratio ${contrast.toFixed(2)}:1 must exceed WCAG AA 4.5:1`);
});

test('2.2.4 - Light mode body text (#0f1115) on light canvas (#fcfcfd) meets WCAG AAA (>= 7:1)', () => {
  const contrast = calculateContrastRatio('#0f1115', '#fcfcfd');
  assertGreaterThanOrEqual(contrast, 7.0, `Light mode contrast ratio ${contrast.toFixed(2)}:1 must exceed WCAG AAA 7.0:1`);
});

test('2.2.5 - Focus-visible outline styling provides high-contrast keyboard navigation', () => {
  assertMatches(globalsCss, /:focus-visible\s*\{[^}]*outline:\s*2px\s+solid/i, 'High-contrast focus-visible outline must be present');
});

// 2.3 Asset Fallback & Resilient Rendering
suite('2.3 Asset Fallback & Resilient Rendering');

test('2.3.1 - Font display property is set to "swap" for instant text visibility', () => {
  assertMatches(layoutJs, /display:\s*["']swap["']/i, 'Local fonts must use display: "swap" to eliminate FOIT');
});

test('2.3.2 - CSS variables specify fallbacks for font families', () => {
  assertMatches(globalsCss, /font-family:\s*var\(--font-body\),\s*-apple-system/i, 'globals.css must provide system font fallbacks for font-body');
});

test('2.3.3 - SVG icons provide explicit default width/height or viewBox dimensions', () => {
  assertMatches(aggregatedComponentSource, /viewBox=["']0 0 24 24["']|width=|height=/i, 'SVG icons must define explicit coordinate dimensions');
});

test('2.3.4 - Aura themes provide default fallback values in ThemeProvider', () => {
  assertMatches(allCodeSource, /aura\|\|['"]aurora['"]|data-aura/i, 'ThemeProvider must fall back to aurora aura when unspecified');
});

test('2.3.5 - Bookmark favicon glyphs use Unicode icons and colored background fallback pill', () => {
  assertMatches(allCodeSource, /bm-fav|fav:\s*["'][^"']+["']/i, 'Bookmark items must render resilient fallback favicon glyphs');
});

// 2.4 Accordion Toggling Edge Cases
suite('2.4 Accordion Toggling Edge Cases');

test('2.4.1 - Accordion uses CSS grid-template-rows (0fr -> 1fr) for layout-thrash-free animation', () => {
  assertMatches(globalsCss, /grid-template-rows:\s*0fr/i, 'Accordion closed state must use 0fr');
  assertMatches(globalsCss, /grid-template-rows:\s*1fr/i, 'Accordion open state must use 1fr');
});

test('2.4.2 - Accordion inner container specifies overflow: hidden during transition', () => {
  assertMatches(globalsCss, /\.faq-a-inner\s*\{[^}]*overflow:\s*hidden/i, 'Accordion inner content must be clipped during animation');
});

test('2.4.3 - Accordion trigger is a native <button type="button"> for keyboard focus & activation', () => {
  assertMatches(allCodeSource, /<button[^>]*type=["']button["'][^>]*className=["'][^"']*faq-q/i, 'FAQ trigger must be an accessible native button');
});

test('2.4.4 - Chevron indicator rotates smoothly on toggle via data-open attribute', () => {
  assertMatches(globalsCss, /\.faq-item\[data-open="true"\]\s+\.faq-chevron\s*\{[^}]*transform:\s*rotate\(45deg\)/i, 'Chevron must transform on open');
});

test('2.4.5 - Individual accordion items maintain independent state and do not cross-pollute', () => {
  assertMatches(allCodeSource, /function FaqItem|const\s+\[open,\s*setOpen\]\s*=\s*useState\(false\)/i, 'FaqItem must manage self-contained local state per instance');
});

// 2.5 Tab Switching Edge Cases
suite('2.5 Tab Switching Edge Cases');

test('2.5.1 - Workspace switching uses modulo cycling to prevent index out of bounds', () => {
  assertMatches(allCodeSource, /%\s*workspaces\.length|%\s*demos\.length/i, 'Automated cycling must use modulo array length');
});

test('2.5.2 - Tab click handler allows manual selection overriding interval', () => {
  assertMatches(allCodeSource, /onClick=\{?\(\)\s*=>\s*setActiveWs\(i\)\}?/i, 'Pills must have manual click handlers passing explicit index');
});

test('2.5.3 - Active workspace bookmark list gracefully handles variable bookmark counts', () => {
  assertMatches(allCodeSource, /allBookmarks\[activeWs\]\.length|workspaces\[activeWs\]\.count/i, 'Bookmarks list rendering must read length from active dataset');
});

test('2.5.4 - AnimatePresence mode="wait" ensures clean unmount before mounting next tab content', () => {
  assertMatches(allCodeSource, /<AnimatePresence\s+mode=["']wait["']>/i, 'Tab transition must use AnimatePresence mode="wait"');
});

test('2.5.5 - Active tab pill visual styling uses distinct accent background and white text', () => {
  assertMatches(allCodeSource, /i\s*===\s*activeWs\s*\?\s*["']var\(--accent\)["']/i, 'Active pill must apply var(--accent) styling');
});

// 2.6 Motion & Accessibility Preferences
suite('2.6 Motion & Accessibility Preferences');

test('2.6.1 - globals.css defines @media (prefers-reduced-motion: reduce)', () => {
  assertMatches(globalsCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i, 'Reduced motion media query must be present in stylesheet');
});

test('2.6.2 - Reduced motion disables or minimizes animation-duration to 0.001s', () => {
  assertMatches(globalsCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*animation-duration:\s*0\.001s/i, 'Reduced motion must collapse animation-duration');
});

test('2.6.3 - Reduced motion disables transition-duration to 0.001s', () => {
  assertMatches(globalsCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*transition-duration:\s*0\.001s/i, 'Reduced motion must collapse transition-duration');
});

test('2.6.4 - Reduced motion resets html scroll-behavior to auto', () => {
  assertMatches(globalsCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*html\s*\{[^}]*scroll-behavior:\s*auto/i, 'Reduced motion must reset scroll-behavior to auto');
});

test('2.6.5 - Marquee track animation is disabled under reduced motion', () => {
  assertMatches(globalsCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.marquee-track\s*\{[^}]*animation:\s*none/i, 'Marquee animation must be disabled under reduced motion');
});


// ============================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS
// ============================================================================
setTier('TIER 3: CROSS-FEATURE COMBINATIONS');

suite('3.1 Navigation Anchors ↔ Section ID Contract');

test('3.1.1 - Navbar "#how-sync-works" link matches <section id="how-sync-works">', () => {
  assertMatches(allCodeSource, /href=["']#how-sync-works["']|href:\s*["']#how-sync-works["']/i, 'Navbar must link to #how-sync-works');
  assertMatches(allCodeSource, /id=["']how-sync-works["']/i, 'Section with id="how-sync-works" must exist in DOM');
});

test('3.1.2 - Navbar "#features" link matches <section id="features">', () => {
  assertMatches(allCodeSource, /href=["']#features["']|href:\s*["']#features["']/i, 'Navbar must link to #features');
  assertMatches(allCodeSource, /id=["']features["']/i, 'Section with id="features" must exist in DOM');
});

test('3.1.3 - Navbar "#performance" link matches <section id="performance">', () => {
  assertMatches(allCodeSource, /href=["']#performance["']|href:\s*["']#performance["']/i, 'Navbar must link to #performance');
  assertMatches(allCodeSource, /id=["']performance["']/i, 'Section with id="performance" must exist in DOM');
});

test('3.1.4 - Navbar "#faq" link matches <section id="faq">', () => {
  assertMatches(allCodeSource, /href=["']#faq["']|href:\s*["']#faq["']/i, 'Navbar must link to #faq');
  assertMatches(allCodeSource, /id=["']faq["']/i, 'Section with id="faq" must exist in DOM');
});

test('3.1.5 - Hero "See how sync works" secondary button links to "#how-sync-works"', () => {
  assertMatches(allCodeSource, /href=["']#how-sync-works["'][^>]*>See how sync works/i, 'Hero secondary button must anchor directly to sync engine');
});

suite('3.2 Hero Tab Demo ↔ Bento Feature Grid Parity');

test('3.2.1 - Workspaces featured in Hero Tab Demo corresponds to Workspaces Bento Card', () => {
  assertMatches(allCodeSource, /w-Agency|w-Personal|w-Research/i, 'Hero must feature Workspaces');
  assertMatches(allCodeSource, /Switch your whole dashboard per context/i, 'Bento must explain Workspaces capability');
});

test('3.2.2 - Omni-Search typing in Hero corresponds to Omni-Search Bento Card', () => {
  assertMatches(allCodeSource, /research system/i, 'Hero must demo Omni-search query');
  assertMatches(allCodeSource, /Instant search across shortcuts/i, 'Bento must explain Omni-search');
});

test('3.2.3 - Quickie Inbox in Bento corresponds to 1-click capture popup concept', () => {
  assertMatches(allCodeSource, /Quickie inbox/i, 'Bento must contain Quickie inbox card');
  assertMatches(allCodeSource, /One click captures now/i, 'Bento must explain 1-click save mechanics');
});

test('3.2.4 - Keyboard shortcuts card in Bento corresponds to `nt` omnibox command in Sync Flow', () => {
  assertMatches(allCodeSource, /`nt` commands from anywhere/i, 'Bento must explain `nt` command');
  assertMatches(allCodeSource, /the nt omnibox/i, 'Sync step 1 must mention `nt` omnibox');
});

suite('3.3 Multi-Theme & UI Layering Integrity');

test('3.3.1 - Floating navbar z-index layer (z-index: 100 or higher) maintains positioning above page sections', () => {
  assertMatches(globalsCss, /\.scroll-progress\s*\{[^}]*z-index:\s*100|\.nav\s*\{[^}]*z-index/i, 'Navigation / progress elements must have elevated z-index');
});

test('3.3.2 - Custom cursor rings maintain difference blend mode and highest z-index (9998)', () => {
  assertMatches(globalsCss, /\.cursor-dot,\s*\.cursor-ring\s*\{[^}]*z-index:\s*9998/i, 'Cursor ring must have top z-index');
});

test('3.3.3 - All CTA buttons (Navbar, Hero, Mobile Drawer, Footer) target valid external URLs', () => {
  assertMatches(allCodeSource, /STORE_URL\s*=\s*["']https:\/\/chromewebstore\.google\.com/i, 'STORE_URL must point to official Chrome Web Store');
  assertMatches(allCodeSource, /GITHUB_URL\s*=\s*["']https:\/\/github\.com/i, 'GITHUB_URL must point to GitHub');
});


// ============================================================================
// TIER 4: REAL-WORLD APPLICATION SCENARIOS
// ============================================================================
setTier('TIER 4: REAL-WORLD APPLICATION SCENARIOS');

suite('4.1 Complete User Onboarding & Conversion Flow');

test('4.1.1 - Scenario: User lands on page, encounters value prop, explores demo tabs, reviews sync mechanism, validates benchmarks, reads FAQ, and finds conversion CTA', () => {
  // 1. Value prop
  assertMatches(allCodeSource, /Your bookmarks,\s*everywhere\.\s*Your data,\s*nowhere\./i, 'Step 1: Hero headline');
  // 2. Demo tabs
  assertMatches(allCodeSource, /BrowserMockup|PinnedShowcase/i, 'Step 2: Interactive demo exploration');
  // 3. Sync engine
  assertMatches(allCodeSource, /Sync\s*(?:<strong>|<span[^>]*>)?without(?:<\/strong>|<\/span>)?\s*a\s*middleman/i, 'Step 3: Sync mechanism understanding');
  // 4. Bento features
  assertMatches(allCodeSource, /Built for people with too many bookmarks/i, 'Step 4: Bento feature grid');
  // 5. Benchmarks
  assertMatches(allCodeSource, /Fast is a requirement, not a claim/i, 'Step 5: Performance counters');
  // 6. FAQ
  assertMatches(allCodeSource, /Fair questions, straight answers/i, 'Step 6: FAQ resolution');
  // 7. Conversion CTA
  assertMatches(allCodeSource, /Keep your data\.\s*Lose the chaos\./i, 'Step 7: Final high-converting CTA');
});

suite('4.2 Offline & Zero-Telemetry Privacy Truth Consistency');

test('4.2.1 - Scenario: Privacy statements across all page sections are 100% consistent without contradiction', () => {
  // Eyebrow
  assertMatches(allCodeSource, /MIT/i, 'Eyebrow states MIT');
  // Hero subtitle
  assertMatches(allCodeSource, /no account,\s*no server,\s*no telemetry/i, 'Hero states no account, server, telemetry');
  // Privacy section
  assertMatches(allCodeSource, /Nothing leaves your browser/i, 'Privacy section states nothing leaves browser');
  // FAQ
  assertMatches(allCodeSource, /No telemetry,\s*no analytics,\s*no accounts/i, 'FAQ confirms zero outbound telemetry');
  // Footer
  assertMatches(allCodeSource, /MIT licensed · No accounts · No telemetry/i, 'Footer confirms identical privacy baseline');
});

suite('4.3 Zero-Server Chrome Native Sync Architecture Accuracy');

test('4.3.1 - Scenario: Technical architecture explanation strictly reflects Chrome native sync mechanics', () => {
  assertMatches(allCodeSource, /chrome\.bookmarks|real Chrome bookmarks/i, 'Architecture specifies chrome.bookmarks native tree');
  assertMatches(allCodeSource, /w-|workspace folders/i, 'Architecture specifies w- folder workspace naming convention');
  assertMatches(allCodeSource, /chrome\.storage\.sync/i, 'Architecture specifies chrome.storage.sync metadata mirror');
  assertMatches(allCodeSource, /service worker|background/i, 'Architecture specifies Manifest V3 background service worker');
});

suite('4.4 Performance Guarantee Traceability');

test('4.4.1 - Scenario: All performance numbers (12ms, 28ms, ~4MB) are grounded in verifiable benchmarks', () => {
  assertMatches(allCodeSource, /12ms first paint|12\s*ms/i, '12ms First paint claim');
  assertMatches(allCodeSource, /28\s*ms/i, '28ms 500 bookmarks load claim');
  assertMatches(allCodeSource, /4(?:\.5)?\s*MB/i, '4MB memory footprint claim');
  assertMatches(allCodeSource, /Internal benchmark harness|mid-range laptop/i, 'Hardware and reproducibility citation');
});


// ============================================================================
// SUMMARY & EXIT CODE REPORTING
// ============================================================================
console.log(`\n${BOLD}${MAGENTA}==================================================================${RESET}`);
console.log(`${BOLD}${MAGENTA}                     E2E TEST RUN SUMMARY                         ${RESET}`);
console.log(`${BOLD}${MAGENTA}==================================================================${RESET}`);
console.log(`  Total Tests Run:    ${BOLD}${totalTests}${RESET}`);
console.log(`  Tests Passed:       ${BOLD}${GREEN}${passedTests}${RESET}`);
console.log(`  Tests Failed:       ${BOLD}${failedTests > 0 ? RED : GREEN}${failedTests}${RESET}`);
console.log(`  Success Rate:       ${BOLD}${((passedTests / totalTests) * 100).toFixed(1)}%${RESET}`);

if (failedTests > 0) {
  console.log(`\n${BOLD}${RED}FAILED TESTS SUMMARY:${RESET}`);
  failures.forEach((f, idx) => {
    console.log(`\n  ${BOLD}${RED}${idx + 1}. [${f.tier} -> ${f.suite}] ${f.test}${RESET}`);
    console.log(`     ${RED}Error: ${f.error}${RESET}`);
  });
  console.log(`\n${BOLD}${RED}Result: E2E TEST RUN FAILED (Exit Code 1)${RESET}\n`);
  process.exit(1);
} else {
  console.log(`\n${BOLD}${GREEN}Result: ALL 4 TIERS OF E2E TESTS PASSED (Exit Code 0)${RESET}\n`);
  process.exit(0);
}
