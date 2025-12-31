# GPT Knowledge Pack (gdrive_permissions1)

> This file is generated. Do not edit directly.
> Source: `GPT_KNOWLEDGE.template.md` and `docs/common/steps.yaml` via `npm run build:docs`.

## Purpose
This knowledge pack provides a compact, deterministic reference for a Custom GPT assisting setup and day-to-day usage of the gdrive_permissions1 project. It prioritizes stable instructions and references the full docs for detailed steps.

## Project summary
- Spreadsheet-first permissions manager for Google Drive.
- Uses Apps Script + Google Workspace Admin SDK + Drive API.
- Control sheet is the single source of truth for access and group membership.

## Key artifacts
- Apps Script bundle: `{{BUNDLE_PATH}}`
- Bundle build command: `{{BUILD_COMMAND}}`
- Apps Script source: `apps_script_project/`
- Setup guide: `docs/SETUP_GUIDE.md`
- User guide: `docs/USER_GUIDE.md`
- Super Admin guide: `docs/SUPER_ADMIN_USER_GUIDE.md`
- Sheet Editor guide: `docs/SHEET_EDITOR_USER_GUIDE.md`
- Roles overview: `docs/ROLES_AND_RESPONSIBILITIES.md`

## Usage scope (non-testing)
- Super Admin and Sheet Editor usage is documented in the role-specific guides above.
- Testing workflows are documented separately in `docs/TESTING.md`.

## Setup steps overview
{{SETUP_STEPS_LIST}}

## Setup steps (full text)
{{SETUP_STEPS}}

## Operational notes
- The bundle is copied into the Apps Script editor (`Code.gs`).
- The script uses a `Config` sheet that is created on first run.
- Permissions and logs are managed within the control spreadsheet.
