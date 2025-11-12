# Contributing

Thanks for your interest in improving the Google Drive Permission Manager! This
project depends on community feedback and contributions. The guidelines below
help us review changes consistently and keep the project stable for production
use.

## Getting Started

1. **Fork the repository** and create a feature branch from `main`.
2. **Install dependencies:**
   ```bash
   npm ci
   ```
3. **Run the test suite:**
   ```bash
   npm test -- --runInBand
   ```
   The Apps Script portion of the project is also covered by the in-sheet tests
   documented in [`docs/TESTING.md`](docs/TESTING.md). Please exercise them when
   you change sync logic or folder processing.
4. **Respect coding conventions:** Follow the formatting and naming guidelines
   described in [`AGENTS.md`](AGENTS.md) when editing Apps Script files.

## Proposing Changes

- **Open an issue first** for substantial feature work so we can discuss scope
  and design. Bug fixes and documentation improvements can go straight to a
  pull request (PR).
- **Keep PRs focused.** Small, self-contained changes are easier to review and
  revert if something goes wrong.
- **Update documentation** when behavior changes. The README should always
  reflect the recommended onboarding flow.
- **Add tests** for bug fixes or new functionality. Include regression coverage
  whenever possible.
- **Run `npm test`** before submitting your PR and describe any additional
  manual verification in the PR body.

## Pull Request Checklist

- [ ] The change is covered by unit tests or reasoning about the Apps Script
      tests.
- [ ] `npm test -- --runInBand` succeeds locally.
- [ ] Relevant documentation has been updated (README, docs/, inline comments).
- [ ] Commit messages use the imperative mood (e.g., `fix: adjust sync logging`).
- [ ] Large changes were discussed with maintainers in an issue first.

## Reporting Issues

When filing an issue, please include the following details:

- Version of Google Workspace and whether the control sheet runs in a shared
  drive.
- What operation you attempted (`Full Sync`, `Sync Adds`, `Sync Deletes`,
  testing menus, etc.).
- Relevant log output from the `Log` or `TestLog` sheets.
- Steps to reproduce the problem. Screenshots or spreadsheet copies (with
  sensitive data removed) are extremely helpful.

## Community Expectations

The project follows the [Code of Conduct](CODE_OF_CONDUCT.md). Please review it
before participating in discussions or reviews. We welcome all contributions
that improve reliability, documentation clarity, or usability.

Thank you for helping us automate Google Drive permissions safely!
