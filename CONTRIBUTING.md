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

## Development Setup

While end-users deploy the script by building a bundle and copy-pasting, developers contributing to this project should use [`clasp`](https://github.com/google/clasp) for a much more efficient workflow.

### 1. Initial Setup

1.  **Install clasp:**
    ```bash
    npm install -g @google/clasp
    ```
2.  **Authenticate with Google:** This command opens a browser window for you to log in. You must authenticate with a Google account that has access to the Apps Script project (typically a Super Admin for the target Google Workspace).
    ```bash
    clasp login
    ```
3.  **Create a Test Spreadsheet:** As a developer, you should have your own Google Sheet to act as a testbed. Create a new sheet and open **Extensions > Apps Script**.
4.  **Configure `.clasp.json`:** In the root of your local repository, create a `.clasp.json` file. Get the **Script ID** from your test spreadsheet's Apps Script editor (**Project Settings > IDs**) and add it to the file:
    ```json
    {
      "scriptId": "YOUR_TEST_SCRIPT_ID",
      "rootDir": "apps_script_project"
    }
    ```
    > **Security Note:** This `.clasp.json` file is ignored by `git` to prevent you from accidentally committing your personal script ID.

### 2. Common `clasp` Commands

-   **Push changes:** To deploy your local files to your Apps Script project, run:
    ```bash
    clasp push -f
    ```
-   **Pull changes:** To pull the latest version from the remote Apps Script project (e.g., if you made a change in the web editor), run:
    ```bash
    clasp pull
    ```
-   **Check status:** To see which local files differ from the remote project, run:
    ```bash
    clasp status
    ```

## Documentation Workflow

To ensure consistency, key documentation files are generated from templates and a central data file (`docs/common/steps.yaml`).

-   `docs/SETUP_GUIDE.md`
-   `AI_ASSISTANT_PROMPT.md`
-   And other files in `docs/common/`

**To update the documentation:**

1.  Edit the appropriate source files (e.g., `*.template.md` files or `docs/common/steps.yaml`).
2.  Run the build script to apply your changes:
    ```bash
    npm run build
    ```
3.  **Commit both the source files and the updated generated files.** This is important to keep the repository's documentation user-ready.

> **Important:** Do not edit generated files like `docs/SETUP_GUIDE.md` directly. Your changes will be overwritten. The CI system includes a check to ensure that all generated documentation is up-to-date; pull requests with stale documentation will fail.

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
