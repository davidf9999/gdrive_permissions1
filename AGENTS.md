# Repository Guidelines

## Project Structure & Module Organization
- `apps_script_project/`: Source files for the Apps Script project (Code.js, Utils.gs, Tests.gs, etc.).
- `apps_script_project/config.json.template`: Template for in-editor `config.json` (Sheet ID, GCP project). This must be manually created in Apps Script editor as `config.json`.
- `apps_script_project/appsscript.json`: Project manifest template. Settings (timezone, GCP project) must be manually configured in Apps Script editor via Project Settings.
- `create_apps_scripts_bundle.js`: Build script that bundles all source files into `dist/apps_scripts_bundle.gs`.
- `dist/apps_scripts_bundle.gs`: Generated bundle file to copy-paste into Apps Script editor.
- `docs/`: User and testing guides (`USER_GUIDE.md`, `TESTING.md`, `ONBOARDING.md`, `SETUP_GUIDE.md`).
- `scripts/setup.sh`: Optional infra setup steps run inside the container.
- `terraform/`: Optional GCP infrastructure (APIs, roles, settings).
- `docker-compose.yml` and `Dockerfile`: Build/run the setup wizard container.

## Build, Test, and Development Commands
- **Local manual setup (recommended)**:
  1. Run `node create_apps_scripts_bundle.js` to generate `dist/apps_scripts_bundle.gs`
  2. Copy-paste the bundle contents into Apps Script editor
  3. In Apps Script Project Settings: set timezone (e.g., `America/New_York`, `Etc/UTC`) and GCP Project ID
  4. In Apps Script editor: create `config.json` file from `apps_script_project/config.json.template` with your Sheet ID and GCP project ID
  5. See `docs/SETUP_GUIDE.md` for detailed step-by-step instructions
- Docker-based infra (optional):
  - `docker compose build` – Build the setup environment.
  - `docker compose up` – Provision GCP and print next steps.
- Terraform (optional):
  - `cd terraform && terraform init && terraform plan && terraform apply` – Manage GCP infra.
- Apps Script (optional CLI):
  - `clasp login && clasp push --project apps_script_project --force`

## Coding Style & Naming Conventions
- Language: Google Apps Script (ES5/ES6). Use 2-space indentation; semicolons required.
- Naming: `camelCase` for functions/vars (`fullSync`, `processManagedFolders_`), constants in `UPPER_SNAKE_CASE`.
- Files: Source files in `apps_script_project/` are bundled into `dist/apps_scripts_bundle.gs`. Config must be manually created as `config.json` in Apps Script editor from the template.
- Lint/format: no enforced linter; prefer consistent Prettier-style formatting if editing locally.

## Testing Guidelines
- Use in-sheet menus: `Permissions Manager > Testing` to run Manual Access Test and Stress Test.
- Logs: check `Log`/`TestLog` sheets; optionally enable GCP Logging via the `Config` sheet.
- Test naming: keep menu functions clearly prefixed (e.g., `runManualAccessTest`, `runStressTest`).
- Aim to validate add, update, revoke flows on at least one folder per role (Editor/Viewer/Commenter).

## Commit & Pull Request Guidelines
- Commits: short, imperative subject; optional scope. Common prefixes: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:` (e.g., `feat: add log truncation`).
- PRs: include description, rationale, and before/after notes; link related issues; add screenshots or log excerpts for UX/logging changes. Note any required sheet/config changes.

## Security & Configuration Tips
- Never commit real `config.json`, Sheet IDs with sensitive data, or credentials. Use `config.json.template` and `.env`/`setup.conf` examples.
- GCP: restrict roles to least privilege; rotate service account keys; verify Admin SDK/Drive API enablement.
- Sheet access: maintain `SheetEditors` sheet; review group email patterns before syncing.