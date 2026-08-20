# Contributing to Syncly

Thank you for your interest in contributing to **Syncly**! 🎉

Syncly is an open-source, privacy-first Manifest V3 Chrome extension engineered with clean architecture, zero-build vanilla ES modules, and local-first data persistence.

These guidelines help ensure a smooth, transparent, and productive contribution process for everyone.

---

## Table of Contents
- [Before Contributing](#before-contributing)
- [Development Setup](#development-setup)
- [Branch Naming Conventions](#branch-naming-conventions)
- [Code Quality & Architecture Standards](#code-quality--architecture-standards)
- [Commit Message Conventions](#commit-message-conventions)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Code of Conduct](#code-of-conduct)

---

## Before Contributing

1. **Read the Documentation**: Familiarize yourself with the [README](README.md), [Architecture](README.md#architecture), and [Product Specification](PRODUCT_SPEC.md).
2. **Search Existing Issues**: Before opening a new issue or pull request, search the [GitHub Issues tracker](https://github.com/KamrulIslamArnob/NothingTab/issues) to verify if the bug or feature has already been reported or is currently in progress.
3. **Open an Issue for Major Changes**: For significant architectural refactors, new third-party integrations, or major UX overhauls, open an issue first to discuss the design with maintainers before writing code.

---

## Development Setup

Syncly has **zero build tools, zero bundlers, and zero npm runtime dependencies**. Setting up your local environment takes less than a minute.

### 1. Fork and Clone
```bash
# Fork the repository on GitHub, then clone your fork:
git clone https://github.com/<your-username>/NothingTab.git
cd NothingTab
```

### 2. Install Development Dependencies
Install devDependencies used for automated testing (e.g. `puppeteer-core`):
```bash
npm install
```

### 3. Environment Configuration
Syncly runs entirely client-side and requires no `.env` file for runtime execution. If you need to specify a custom Chrome executable path for automated smoke testing, copy `.env.example`:
```bash
cp .env.example .env
```

### 4. Load the Extension in Chrome
1. Open `chrome://extensions` in any Chromium browser (Chrome, Brave, Edge, Arc).
2. Enable **Developer mode** via the toggle switch in the top-right corner.
3. Click **Load unpacked** and select the cloned repository root folder.
4. Open a new tab (`Ctrl + T` / `Cmd + T`) to launch Syncly.

### 5. Iterating and Testing
- **UI & Layout changes**: Edit source files in `src/presentation/` and refresh your active new tab page (`F5`).
- **Service Worker / Manifest changes**: After modifying `manifest.json` or `src/presentation/shared/serviceWorker.js`, click the reload icon on `chrome://extensions`.
- **Run Unit Tests**:
  ```bash
  npm test
  ```

---

## Branch Naming Conventions

Create dedicated feature branches with descriptive, prefixed names:

| Prefix | Description | Example |
| :--- | :--- | :--- |
| `feature/` | New features or UI additions | `feature/collection-reordering` |
| `fix/` | Bug fixes and defect resolutions | `fix/sidebar-shadow-bleed` |
| `refactor/` | Code refactoring without behavioral changes | `refactor/tree-view-selectors` |
| `docs/` | Documentation additions or corrections | `docs/update-architecture-guide` |
| `test/` | Adding or updating automated tests | `test/collection-repository-tests` |

```bash
git checkout -b fix/sidebar-shadow-bleed
```

---

## Code Quality & Architecture Standards

To preserve performance, security, and maintainability, all contributions must respect the following standards:

### 1. Clean Architecture Layer Boundaries
- **`presentation`** handles DOM creation, controllers, and styling. Never import infrastructure persistence directly into views; invoke application use cases.
- **`application`** coordinates domain entities and defines abstract ports for repositories and external services.
- **`domain`** contains pure entities and value objects. Keep domain logic pure and free of browser or Chrome API dependencies.
- **`infrastructure`** implements concrete storage adapters, Chrome API wrappers, and the Dependency Injection container (`container.js`).

### 2. Zero-Build & Vanilla JavaScript
- Do not introduce Webpack, Rollup, Vite, Babel, or compile steps.
- Write standard modern ECMAScript (ES2022+ modules) using native browser capabilities.

### 3. XSS Prevention & DOM Construction
- **Never use `innerHTML` or `outerHTML` with dynamic user data.**
- Always build DOM elements using the `el()` helper (`src/presentation/shared/dom.js`) or native `document.createElement()` and assign user text via `textContent`.
- Sanitize external URLs using `isSafeUrl()` before assigning to `href`.

### 4. Local-First Storage
- User bookmark collections, groupings, and preferences must be stored in `chrome.storage.local`.
- Never transmit user data to external endpoints without explicit, user-initiated opt-in (e.g. GitHub PAT backup).

### 5. Automated Verification
All tests must pass before submitting code:
```bash
npm test
```

---

## Commit Message Conventions

Syncly follows the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

### Types
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (whitespace, formatting)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to build tooling, dependencies, or configuration

### Examples
```
feat(collections): add custom color badge to bookmark collections
fix(sidebar): remove drop-shadow bleed when settings sidebar is closed
docs(readme): add installation guide for brave and arc browsers
test(backup): add compatibility test for legacy v1 bookmark format
```

---

## Submitting a Pull Request

1. **Keep Pull Requests Focused**: Each PR should address a single bug fix, feature, or improvement.
2. **Include Clear Descriptions**: Explain:
   - What was changed.
   - Why the change was necessary.
   - How the change was tested.
3. **Provide Visual Proof**: For UI changes, attach before-and-after screenshots or a short screen recording.
4. **No Committed Secrets**: Verify that no API keys, tokens, or personal configuration files are included in the diff.
5. **Ensure CI Passes**: Ensure that all automated checks in GitHub Actions pass cleanly.

---

## Code of Conduct

All contributors and participants are expected to uphold our **[Code of Conduct](CODE_OF_CONDUCT.md)**. Please report unacceptable behavior to project maintainers.
