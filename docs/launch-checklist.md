# Launch Checklist — Syncly

> **Syncly** is a Chrome Manifest V3 new-tab bookmark manager — a zero-build, vanilla JS (ES modules) extension that runs directly on Chrome's `chrome.bookmarks` + `chrome.storage.local` with no backend, no database, and no monthly hosting bill.

**Estimated total hands-on time:** 3–4 hours + Chrome Web Store review wait (1–3 days, sometimes up to a week).
**Ongoing cost:** **$5 one-time** to register as a Chrome Web Store developer. No server costs. Everything else is free.

### Legend — who does what

- 🧑 **You** — needs your identity, decision, or payment. An agent can't do this for you.
- 🤖 **Agent** — paste the quoted prompt into your coding agent (Claude Code / OpenCode / Cursor) and it runs.
- 🤝 **Together** — the agent prepares a file, you click the final button or paste a value.

---

## Phase 0 — Fix blockers before you launch (30–45 min)

These are small gaps that would get your submission rejected or look unfinished. Do them first.

- [ ] 🤖 **Verify no hardcoded secrets and that tests still pass — 5 min**
  > Prompt for your agent:
  > ```
  > In the Syncly repo, do a full launch-blocker audit: grep the codebase for any hardcoded API keys, tokens, URLs or TODO secrets, check manifest.json is valid JSON, and run npm test until all 222 tests pass. Report any failures. Do not edit store assets.
  > ```
  *Why:* Reviewers reject extensions with leftover test keys or a broken build.
  **You'll know it worked when** `npm test` shows 222 pass, 0 fail and `node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))"` prints no error.

- [ ] 🤖 **Generate the two missing promo tiles — 10 min**
  > Prompt for your agent:
  > ```
  > Create the two missing Chrome Web Store promo tiles for Syncly using the existing brand (terracotta #D2683F / #E64A19, Plus Jakarta Sans, dark #121316). Save them as public/store-assets/small-promo-440x280.png (440×280) and public/store-assets/marquee-920x680.png (920×680) exactly. Keep them under 1MB, no text smaller than 16px, and export as PNG. Do not modify public/icons/.
  > ```
  *Why:* The Store requires at least a small promo tile (440×280) to be featured. Without it you can still publish, but you lose discovery.
  **You'll know it worked when** both files exist, open cleanly in your image viewer, and are the exact pixel sizes above.

- [ ] 🤖 **Create a real privacy policy page and host it — 15 min**
  > Prompt for your agent:
  > ```
  > Create docs/PRIVACY.md for Syncly that states: single purpose (bookmark manager + new tab), zero data collection (no accounts, no telemetry, all data in chrome.storage.local), permissions justification for bookmarks/storage/tabs/activeTab/favicon/unlimitedStorage, connect-src allowlist (api.github.com, api.open-meteo.com only if user enables), and contact email placeholder. Keep it plain language, MIT-friendly, and Chrome Web Store compliant. Also create a one-page HTML version at docs/privacy.html that is self-contained (no external CSS/JS) so it can be pasted into GitHub Pages or any static host.
  > ```
  *What is a privacy policy?* A public page that tells users and Google what data you collect (in Syncly's case: none) and why you need each browser permission.
  **You'll know it worked when** `docs/PRIVACY.md` and `docs/privacy.html` exist and `docs/privacy.html` opens in your browser with no broken styling.

- [ ] 🤝 **Publish the privacy policy to a public URL — 10 min**
  Copy `docs/privacy.html` to a public place. Easiest free path: create a GitHub repo `your-username.github.io`, enable **Settings → Pages → Deploy from main branch**, and upload the file as `privacy.html`.
  *Why:* The Chrome Web Store *requires* a public privacy policy URL before you can submit. It cannot be a localhost or `file://` link.
  **You'll know it worked when** you can open `https://your-username.github.io/privacy.html` in an Incognito window and see the policy with no login.

- [ ] 🤖 **Take fresh store screenshots (1280×800) — 10 min**
  > Prompt for your agent:
  > ```
  > Update public/screenshot_dashboard.png to a 1280×800 screenshot of Syncly's new tab (two-pane: sidebar with Workspaces + BOOKMARKS folder tree, search bar, card grid, light and dark theme). If you cannot capture, generate a placeholder screenshot that matches the listing description and mark it as [PLACEHOLDER — recapture after install]. Also verify public/icons/icon128.png is 128×128 and not blurry.
  > ```
  **You'll know it worked when** `public/screenshot_dashboard.png` is exactly 1280×800 and clearly shows the dashboard, and the 128px icon is crisp.

---

## Phase 1 — Accounts and prerequisites (15–20 min)

- [ ] 🧑 **Create / confirm your Google account for the Web Store — 5 min • Cost $5 one-time**
  Go to `chrome.google.com/webstore/devconsole`. Sign in with the Google account you want to own Syncly forever (personal Gmail is fine; company account is better if this is a company product). You'll be asked for a **$5 one-time developer registration fee** (credit/debit card, paid to Google). This is the *only* mandatory cost to launch an extension.
  **You'll know it worked when** the Developer Dashboard loads with no "pay registration fee" banner.

- [ ] 🧑 **Confirm you have a GitHub account — 2 min • Free**
  You already push to `https://github.com/KamrulIslamArnob/Syncly` — just make sure you can log in. You need it for backup features and for hosting the privacy policy.
  **You'll know it worked when** you can open your GitHub profile while logged out (public).

- [ ] 🧑 **Decide: do you want a custom domain / landing page? — 2 min • Optional, ~$12/year**
  For a Chrome extension you **do NOT need a domain** to launch. The Store listing, privacy policy on GitHub Pages, and your GitHub repo are enough. Skip this now if you want to ship faster; you can add `syncly.app` later. If you do want one, note the name you want.
  **You'll know it worked when** you've written down either "skip landing page for v1" or a domain name like `syncly.app`.

---

## Phase 2 — Secrets and configuration (10 min)

> *Environment variable* (a setting stored outside your code, used for secrets like API keys). Syncly has **almost none** — that's a feature, not a bug.

- [ ] 🧑 **Understand Syncly's secret model — 2 min**
  There is **no `.env` to fill in** and no database password. The extension stores everything locally in the user's browser. The only optional secrets are:
  - **GitHub Personal Access Token (PAT)** for the *optional* Gist backup (`chrome.storage.local` keys `githubBackupPAT` / `githubBackupGistId`). Only needed if *you as a user* want cloud backup — never required for reviewers or customers.
  - **Supabase** keys for the *future* AI Quota Tracker (`docs/AI-Quota-Tracker*`, not wired into the extension yet).
  For the Store submission, you submit **zero** secrets.
  **You'll know it worked when** you have read this and know *not* to paste any secrets into chat or into `manifest.json`.

- [ ] 🧑 **Create an optional GitHub PAT only if YOU want to test backup — 5 min • Optional**
  If you want to verify backup before launch: GitHub → **Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token** → give it `gist` scope → copy the token → in Syncly open a new tab → Settings → GitHub Backup → paste the token → click Backup. **Never** commit this token; it goes straight into the extension's `chrome.storage.local` on your machine.
  **You'll know it worked when** Syncly shows "Backup saved to Gist" and a new private Gist appears at `gist.github.com`.

- [ ] 🤖 **Double-check no secrets are in the ZIP — 3 min**
  > Prompt for your agent:
  > ```
  > Scan Syncly for any file that would leak a secret if zipped: grep for "PAT", "token", "sk-", ".env", "service-account", "supabase" and list .env files. Confirm .gitignore excludes node_modules and .env, and that manifest.json connect-src only lists api.github.com and open-meteo. Print the list of files that will go into the production ZIP (manifest.json src public README.md LICENSE).
  > ```
  **You'll know it worked when** the only "secret-like" hits are in docs/examples and the ZIP file list looks short and clean.

---

## Phase 3 — Production services (10 min)

All services Syncly touches already work in production with no extra billing step.

- [ ] 🧑 **Verify Open-Meteo weather (no key needed) — 2 min**
  Weather uses `https://geocoding-api.open-meteo.com` and `https://api.open-meteo.com` — both are **free, no API key, no billing**. You already allow them in `manifest.json` `connect-src`. Nothing to enable.
  **You'll know it worked when** enabling Weather in Syncly's settings and typing "London" shows a temperature — no error toast.

- [ ] 🧑 **Understand storage — 2 min**
  *`chrome.storage.local`* is like a tiny private database built into Chrome on the user's computer. Syncly uses it for workspaces, collections, tags, and settings. *`chrome.storage.sync`* is an optional mirror for `categories/bookmarks/settings/bookmarkGroups/collections/tags` so two Chrome profiles on the same Google account stay in sync. Both are **free and unlimited** (you request `unlimitedStorage` in the manifest so large libraries aren't truncated). No setup.
  **You'll know it worked when** you can see the distinction: Tier 1 = `chrome.bookmarks` (real tree), Tier 2 = `chrome.storage.local` (your metadata).

- [ ] 🤖 **Confirm CSP and permissions are minimal — 3 min**
  > Prompt for your agent:
  > ```
  > Read manifest.json and docs/permissions.md and confirm Syncly declares zero host_permissions, zero content_scripts, and strict CSP (script-src 'self'; no eval/remote code). List any https connect-src origins and justify each in one line.
  > ```
  **You'll know it worked when** the list is exactly `self` + `api.github.com` + `api.open-meteo.com` + `geocoding-api.open-meteo.com`.

---

## Phase 4 — Deploy the app (Chrome Web Store) (45–60 min + wait)

This is the *only* deployment path for Syncly. No Vercel, no Docker, no server.

- [ ] 🤖 **Build the production ZIP — 5 min**
  > Prompt for your agent:
  > ```
  > In the Syncly repo, create a production ZIP for the Chrome Web Store. The rule is: zip manifest.json, the entire src/ folder, the entire public/ folder (icons, fonts, favicons), and docs/PRIVACY.md, README.md, LICENSE. Exclude node_modules, .git, docs/superpowers, scripts/*.mjs dev probes, and any file matching .gitignore. Save as dist/syncly-0.2.0.zip and print its size and file list. Verify manifest.json version is 0.2.0.
  > ```
  *What is the ZIP?* Chrome doesn't install from your GitHub directly; you upload one ZIP file that contains exactly what Chrome should install on users' machines.
  **You'll know it worked when** `dist/syncly-0.2.0.zip` exists, is under ~5 MB, and `unzip -l dist/syncly-0.2.0.zip` shows `manifest.json` at the top level.

- [ ] 🤖 **Smoke-test the ZIP locally before uploading — 5 min**
  > Prompt for your agent:
  > ```
  > Instructions for a human: unzip dist/syncly-0.2.0.zip into a fresh folder /tmp/syncly-prod, load it as unpacked in chrome://extensions, open a new tab, and verify the dashboard renders. Also run npm test and confirm 222 pass.
  > ```
  For you: in Chrome, go to `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the *unzipped* folder → open a new tab.
  **You'll know it worked when** the new tab shows Syncly (two-pane, search works, no console errors) and `npm test` still says 222 pass.

- [ ] 🧑 **Create the Store listing — 20 min**
  Go to **Chrome Web Store Developer Dashboard** → **New Item** → upload `dist/syncly-0.2.0.zip`.
  Fill in:
  - **Name:** Syncly
  - **Short description:** `Sync everywhere, stay local — A minimalist, privacy-first bookmark manager & new tab for Chrome.` (132 chars max — copy from `CHROMEWEBSTORE.md:10`)
  - **Detailed description:** copy the block from `CHROMEWEBSTORE.md:20-39`
  - **Category:** Productivity → **Language:** English (United States)
  - **Icon:** `public/icons/icon128.png` is auto-picked
  - **Screenshots:** upload `public/screenshot_dashboard.png` (1280×800). Add a second screenshot (e.g., dark mode) if you have it.
  - **Small promo tile:** upload `public/store-assets/small-promo-440x280.png` (you made in Phase 0)
  - **Privacy policy URL:** paste your `https://your-username.github.io/privacy.html`
  - **Single purpose:** copy the one-liner from `CHROMEWEBSTORE.md:58`
  **You'll know it worked when** the Dashboard shows all required fields green with no red warnings.

- [ ] 🧑 **Complete the privacy questionnaire — 10 min**
  In the Dashboard → **Privacy practices** tab, answer honestly:
  - *Does your extension collect user data?* **No** (all data stays in `chrome.storage.local` on the user's device).
  - *Do you use remote code?* **No** (all JS is `self`, CSP `script-src 'self'`).
  - *Permissions justification:* copy the 6-row table from `CHROMEWEBSTORE.md:45-52` verbatim — reviewers love consistent wording.
  - *Host permissions:* **None**.
  - *Are you compliant with Developer Program Policies?* **Yes**.
  **You'll know it worked when** the blue "Submit for review" button becomes enabled.

- [ ] 🧑 **Submit for review — 2 min**
  Click **Submit for review**. Chrome's automated checks run in minutes; human review then takes **1–3 days typically, sometimes up to 7 days**. If rejected, you get an email with a specific reason — fix it and resubmit (see "If rejected" note below).
  **You'll know it worked when** the Dashboard status changes to **"Pending review"** and you receive a confirmation email from `chromewebstore-noreply@google.com`.

> **If rejected (common, not fatal):** 90% of rejections are for missing privacy policy URL, vague permission justification, or `favicon` permission on an old Chrome version. Fix the exact line cited, bump `manifest.json` `version` from `0.2.0` to `0.2.1`, rebuild the ZIP, re-upload. You do **not** repay the $5.

---

## Phase 5 — Domain (optional, not blocking launch) (15 min if you want it)

- [ ] 🧑 **Decide to skip or buy — 2 min**
  You do **not** need a domain to launch an extension. Your Store listing, GitHub repo, and GitHub Pages privacy policy are enough for v1. Recommended: **skip for now**, ship, and buy a domain only if you want a marketing landing page.
  **You'll know it worked when** you've written `SKIP` or a domain name in your notes.

- [ ] 🧑 **(If buying) Connect the domain — 15 min • ~$12/year**
  If you bought `syncly.app` (Namecheap / Google Domains / Cloudflare):
  1. Create a GitHub Pages site from your repo (or Vercel — *static* site, no server needed).
  2. In your domain provider, add the DNS (Domain Name System — the internet's address book) records GitHub tells you to: usually an `A` record and a `CNAME` for `www`.
  3. Wait up to **24 hours** for DNS propagation (internet address books updating worldwide — it feels slow, that's normal).
  4. Confirm `https://` works (green padlock).
  **You'll know it worked when** `https://syncly.app` loads over HTTPS with no certificate warning.

---

## Phase 6 — Pre-launch verification (30 min) — *Do this as a real customer*

Do every step in an Incognito Chrome profile with **only** the Store version installed (or the ZIP you uploaded) — not your development unpacked build.

- [ ] 🧑 **Install as a new user — 5 min**
  Incognito → install Syncly from the Store link (or drag the ZIP if still pending review) → open a new tab.
  **You'll know it worked when** a blank Chrome new tab is replaced by Syncly's two-pane dashboard with no errors in DevTools (`View → Developer → JavaScript console`).

- [ ] 🧑 **Walk the core journey — 15 min**
  1. **Create a workspace** → click the workspace switcher → "New Workspace" → name it "Work" → assign 2 folders.
  2. **Create a collection** → select 3 bookmarks → bulk-add to new collection "Reading List" → verify it appears under Collections.
  3. **Tag and search** → open a bookmark's tag dialog → add tags `design`, `inspiration` → press `Ctrl+K` → type `design` → see it filter → type `#inspiration` → see tag filter.
  4. **Reorder & persist** → drag a card grid item to new position → refresh the tab → order should stick.
  5. **Theme & settings** → toggle Light/Dark, change accent, search engine (Google → YouTube), verify after reload it persists.
  6. **Backup** → Settings → Export → verify a timestamped JSON downloads; try Import in same settings.
  **You'll know it worked when** every step felt instant, nothing flickered, and refreshing the tab kept your changes.

- [ ] 🧑 **Test on a second device / profile — 5 min**
  If you use Chrome Sync: log into the same Google account on another Chrome profile → install Syncly → your `bookmarks` + `settings` + `collections`/`tags` should appear within a minute via `chrome.storage.sync` mirror.
  **You'll know it worked when** you see the same workspace names without re-creating them.

- [ ] 🧑 **Test on mobile viewport (no install needed) — 5 min**
  Open the new tab, press `F12` → toggle device toolbar → set to iPhone SE → check the grid collapses gracefully, no horizontal scroll, search still works.
  **You'll know it worked when** the dashboard is usable (not perfect — extensions don't run on mobile — but proves responsiveness for Store screenshots).

> The product isn't "deployed" until this smoke test passes as a real customer — not just `npm test` passing.

---

## Phase 7 — After launch (ongoing, 20 min setup + 5 min/week)

- [ ] 🤖 **Verify CI stays green — 3 min**
  > Prompt for your agent:
  > ```
  > Check .github/workflows/ci.yml runs on push to main/dev, runs node 20, does npm ci and npm test. Confirm the last GitHub Actions run on main is green. If not, fix it.
  > ```
  **You'll know it worked when** the badge in `README.md` shows green and clicking it shows a passing run.

- [ ] 🧑 **Monitor the Store dashboard — 5 min/week**
  **Where to look when something breaks:** Chrome Web Store Developer Dashboard → your item → **Stats** (installs), **Reviews** (user reports), **Privacy** (policy). There is no Sentry needed — Syncly has no server to crash. Local errors appear only in the user's DevTools console.
  **You'll know it worked when** you can find new reviews and install counts without asking an engineer.

- [ ] 🧑 **Back up your own data + enable auto-backup — 5 min**
  In Syncly, go to Settings → **Setup Auto Backup** → pick a folder (the File System Access API will ask for permission — a browser popup that says "Syncly wants to see files in this folder" → **Allow**). Leave it enabled; you'll be prompted if permission lapses.
  **You'll know it worked when** a file like `syncly-backup-2026-08-21.json` appears in the folder you chose, and IndexedDB `neptab-backup-db` stores the file handle (check DevTools → Application → IndexedDB).

- [ ] 🧑 **Plan updates — 5 min**
  New versions: bump `manifest.json` `version` (e.g., `0.2.1`), rebuild ZIP `dist/syncly-0.2.1.zip`, upload to Dashboard → **Submit again**. Review for updates is usually faster (hours, not days).
  **You'll know it worked when** the Store page shows the new version and your local Chrome auto-updates within a day.

- [ ] 🧑 **Collect your first 5 users — 10 min**
  Share the Store link with 5 friends/colleagues who live in bookmarks. Ask them to run the Phase 6 journey and send you one sentence of feedback. This is your real launch learning.
  **You'll know it worked when** you have 5 Store ratings (or at least 5 direct messages) and one concrete fix to ship next.

---

### Quick recap — what YOU personally must do

There are **24 checkboxes**; only **14 are 🧑 You**, and most are clicks:

1. Pay $5 developer fee and create the listing (Phase 1 + 4) — the only place money changes hands.
2. Paste the privacy policy to a public URL (Phase 0).
3. Decide on a domain (skip is fine) — (Phase 5).
4. Run the 30-minute real-customer smoke test in Incognito (Phase 6).
5. Watch the dashboard after launch (Phase 7).

Everything else is a copy-paste prompt for your agent.

**Total monthly cost after launch:** `$0` (or $1/month if you bought a domain).

### Recommended first step — do this now

> Paste this into your coding agent:
> ```
> In the Syncly repo, run the Phase 0 blocker check: verify manifest.json is valid, run npm test until 222 pass, and list the exact files that will go into dist/syncly-0.2.0.zip (manifest src public README LICENSE privacy). Report the ZIP size and any missing store assets.
> ```
Then while it runs, open `chrome.google.com/webstore/devconsole` and pay the $5 if you haven't — that's the one human gate before everything else can ship.

You've got this. Syncly is local-first, so there's no server to babysit — once the Store says "Published," customers get it instantly on their next Chrome sync.

*Questions while you work through? Ask with the phase/step number (e.g., "Phase 4 ZIP — how big is too big?") and we'll debug that exact spot.*
