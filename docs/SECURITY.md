# Security Policy

> **Canonical location:** `docs/security/SECURITY.md` — this duplicate lives at `docs/SECURITY.md` for GitHub security-policy detection (former root `SECURITY.md` moved to `docs/security/SECURITY.md`).

## Supported Versions

Syncly is actively maintained. Security updates are applied to the latest development version and published releases.

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2.0 | :x:                |

---

## Reporting a Vulnerability

We take the security and privacy of Syncly users seriously. If you discover a security vulnerability or privacy flaw in this extension, please report it responsibly.

### How to Report Privately

1. **Do NOT open a public GitHub issue** for undisclosed security vulnerabilities.
2. **GitHub Private Vulnerability Reporting (Recommended):**
   - Navigate to the **Security** tab of the repository.
   - Click **Report a vulnerability** (or visit [Security Advisories](https://github.com/KamrulIslamArnob/NothingTab/security/advisories/new)).
   - Fill out the advisory form with reproduction steps and potential impact.
3. **Direct Maintainer Contact:**
   - If GitHub Private Vulnerability Reporting is unavailable, contact the project maintainer directly via GitHub profile: [@KamrulIslamArnob](https://github.com/KamrulIslamArnob).

### Information to Include
To help us triage and resolve the issue quickly, please provide:
- A clear description of the vulnerability (e.g., CSP violation, XSS vector, unsafe URL scheme handling, storage leak).
- Step-by-step instructions to reproduce the issue.
- Proof of Concept (PoC) or minimal reproduction script if applicable.
- Potential impact and affected components.

### What to Expect
- **Acknowledgment:** Within 48 hours of receipt.
- **Triage & Assessment:** We will verify the issue and keep you updated on progress.
- **Remediation:** A fix will be developed, tested, and released as quickly as possible.
- **Credit:** We will gladly credit your responsible disclosure in the release notes and advisory (if desired).

---

## Security Architecture & Design Safeguards

Syncly is architected with strict security constraints:
- **Manifest V3 Content Security Policy**: Prohibits remote script execution (`script-src 'self'`) and bans `eval()`.
- **Zero Remote Telemetry**: Syncly transmits no browsing history, bookmark contents, or usage analytics to third-party servers.
- **Local-First Storage**: All data resides in local browser storage (`chrome.storage.local` and IndexedDB).
- **XSS Prevention**: DOM elements are constructed programmatically using the `el()` helper with text nodes; `innerHTML` is never used with dynamic user data.
- **URL Sanitization**: All bookmark and shortcut URLs are validated via `isSafeUrl()` to reject dangerous schemes (e.g. `javascript:`, `data:text/html`).
