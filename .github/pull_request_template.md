# Pull Request

## Summary
<!-- Provide a brief, high-level summary of what this pull request does. -->

## Motivation & Context
<!-- Why is this change required? What problem does it solve? If it fixes an open issue, link it here: e.g. Fixes #123 -->

## Changes Made
<!-- List key technical changes, refactors, or new files added. -->
- 

## Testing Performed
<!-- Describe the manual and automated testing performed to verify this change. -->
- [ ] Loaded as unpacked extension at `chrome://extensions` and verified in a new tab.
- [ ] Tested in both Dark and Light color modes.
- [ ] Automated unit tests passed: `npm test` (`node --test`).

## Screenshots / Visual Proof (if applicable)
<!-- If this PR changes any UI or layout, please include screenshots or short recordings demonstrating the change. -->
| Before | After |
| :--- | :--- |
| *(Image/Description)* | *(Image/Description)* |

## Breaking Changes
<!-- Does this change break backwards compatibility with stored bookmarks, settings, or backups? -->
- [ ] No breaking changes.
- [ ] Yes (explain migration path below).

## Checklist
- [ ] I tested my changes thoroughly.
- [ ] I did not introduce any secrets, API keys, or private credentials.
- [ ] I did not use `innerHTML` for dynamic user data (strictly using `el()` with text nodes).
- [ ] I updated relevant documentation where necessary.
- [ ] I added/updated automated unit tests where appropriate.
- [ ] All CI checks and unit tests pass (`npm test`).
