# Project architecture overview

This document summarises the core components that make up the Google Drive
Permission Manager. It complements the high-level description in the README and
is intended for developers or reviewers who need to understand how the pieces
fit together.

## Control spreadsheet structure

The Apps Script solution operates on a purpose-built Google Sheet that acts as
the source of truth for permissions. Important tabs include:

- **ManagedFolders** — defines each folder to manage. Columns specify folder
  names, Drive IDs, target roles (Editor/Viewer/Commenter), default email
  prefixes for Google Groups, and optional settings such as disabled rows.
- **Admins** — list of spreadsheet editors. The script keeps this sheet in sync
  with the document's sharing settings so only approved administrators can edit
  the control sheet.
- **User group sheets** — automatically generated tabs for each
  folder/role combination plus any reusable groups defined in `UserGroups`. Each
  sheet accepts a list of email addresses and exposes toggles for disabled users
  and optional expiry metadata.
- **UserGroups** — reusable lists of members that can be referenced from
  multiple folders. These entries hydrate dynamic tabs during provisioning.
- **Config** — flags for email notifications, logging verbosity, dry-run mode,
  and experimental automation such as risk-based auto sync.
- **Log** and **TestLog** — append-only audit trails that capture sync outcomes
  and built-in test results respectively.

## Apps Script modules

The Apps Script project lives in the `apps_script_project/` directory and is
split into focused modules:

- **Code.js** — entry point that registers custom menus, defines simple triggers,
  and wires top-level functions to the Google Sheets UI.
- **Core.gs** — orchestration for the primary sync operations, including sheet
  parsing, locking, status updates, and dispatch to helper modules.
- **Sync.gs** — low-level utilities for provisioning Google Groups, applying
  Drive permissions, and reconciling membership differences.
- **Audit.gs** — read-only checks that validate the sheet configuration against
  the current state in Google Workspace.
- **TestHelpers.gs / Tests.gs** — in-sheet testing harness that powers the
  "Manual Access Test", "Stress Test", and other validation routines.
- **Utils.gs, Discovery.gs, Help.gs, EditMode.gs, Setup.gs, Triggers.gs** —
  support files for logging, dynamic menu content, discovery of existing Drive
  assets, edit-mode safeguards, and optional onboarding helpers.
- **ProductionOptimizations.gs** — optional performance enhancements that reduce
  API traffic during large syncs. This file is not required for basic usage but
  can be deployed when scale demands it.
- **ConfigDiagnostic.gs** — diagnostics for the `Config` sheet used during
  troubleshooting.

All modules share constants via `Code.js` and follow the stateless enforcer
model: the spreadsheet contains the desired state, while the script enforces it
without storing additional hidden configuration.

## Execution flow

1. **Menu initialisation** — When the spreadsheet opens, `onOpen()` inserts the
   `Permissions Manager` menu. The Setup module ensures required sheets exist.
2. **Sync invocation** — Administrators choose `Sync Adds`, `Sync Deletes`, or
   `Full Sync`. These menu handlers lock the spreadsheet to avoid concurrent
   edits and then call into `Core.gs`.
3. **Row processing** — `Core.gs` reads `ManagedFolders`, resolves folder IDs via
   `Discovery.gs`, provisions Google Groups using `Sync.gs`, and compares desired
   membership with the Admin SDK.
4. **Permission updates** — Differences are applied through the Drive and Admin
   SDK APIs. The script uses `sendNotificationEmail: false` to prevent redundant
   email noise.
5. **Logging** — Outcomes are written to the `Log` sheet. Errors bubble up with
   contextual hints so administrators can take corrective action.
6. **Testing harness** — When triggered from the testing menu, `Tests.gs`
   executes targeted sync routines defined in `TestHelpers.gs` that operate on
   dedicated test folders without touching production data.

## External dependencies

- **Google Admin SDK** — managing group creation, membership, and metadata.
- **Google Drive API v3** — granting and revoking folder permissions without
  notifying end users.
- **Utilities.sleep / exponential backoff** — rate limiting to respect Google
  API quotas. Production optimisations add caching to further reduce calls.

This modular layout keeps business logic isolated, improves testability, and
allows maintainers to enhance specific behaviour (such as automation or logging)
without editing a monolithic file.
