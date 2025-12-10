# Documentation overview

This index explains the intent of each documentation file and highlights how to
keep the content current.

| File | Purpose | Audience | Notes |
| ---- | ------- | -------- | ----- |
| [`README.md`](../README.md) | Front door for the project, covering prerequisites, setup options, and the documentation map. | New administrators & contributors | Keep in sync with the supported deployment paths (manual `create_apps_scripts_bundle.js` for users, `clasp` for developers) and update when APIs or menus change. |
| [`docs/ARCHITECTURE_OVERVIEW.md`](ARCHITECTURE_OVERVIEW.md) | Architectural walkthrough of the Apps Script modules and spreadsheet layout. | Developers & reviewers | Update when new modules are added or the execution flow changes. |
| [`docs/SETUP_GUIDE.md`](SETUP_GUIDE.md) | The canonical, step-by-step guide for a full manual installation. | First-time administrators | Update when Google Cloud, Workspace, or Apps Script UI flows change. |
| [`docs/ONBOARDING.md`](ONBOARDING.md) | A high-level checklist that complements the Setup Guide. | Workspace admins | Use during training sessions; revise if prerequisites shift. |
| [`docs/USER_GUIDE.md`](USER_GUIDE.md) | Hub page that directs users to the correct role-based guide. | All Users | - |
| [`docs/SUPER_ADMIN_USER_GUIDE.md`](SUPER_ADMIN_USER_GUIDE.md) | Guide for Super Admins covering setup, syncs, and advanced tasks. | Super Admins | Contains all instructions requiring Super Admin privileges. |
| [`docs/SHEET_EDITOR_USER_GUIDE.md`](SHEET_EDITOR_USER_GUIDE.md) | Guide for Sheet Editors covering day-to-day permission management. | Sheet Editors | Explains how to edit the sheets to manage permissions. |
| [`docs/SYSTEM_LIFE_CYCLE.md`](SYSTEM_LIFE_CYCLE.md) | Describes the setup, usage, and teardown stages at a glance and links to the detailed guides. | Administrators & operators | Update when prerequisites or retirement steps change. |
| [`docs/TESTING.md`](TESTING.md) | Describes the in-sheet testing harness and expected results. | Developers & QA | Update when new tests or diagnostics are added. |
| [`docs/AUTO_SYNC_GUIDE.md`](AUTO_SYNC_GUIDE.md) | Explains optional AutoSync triggers. | Advanced admins | Validate instructions alongside `RISK_BASED_AUTO_SYNC.md`. |
| [`docs/RISK_BASED_AUTO_SYNC.md`](RISK_BASED_AUTO_SYNC.md) | Details the risk-based AutoSync safeguards. | Advanced admins | Ensure screenshots and copy match the current script options. |
| [`docs/EDIT_MODE_GUIDE.md`](EDIT_MODE_GUIDE.md) | Walkthrough for edit-mode protections. | Editors & auditors | Revise if the locking strategy changes. |
| [`docs/STOP_SCRIPTS.md`](STOP_SCRIPTS.md) | How to temporarily or permanently halt automation. | Administrators | Keep remediation steps accurate when trigger names or menus change. |
| [`GEMINI.md`](../GEMINI.md) | Historical decision log and debugging notes. | Maintainers | Add entries when significant architectural decisions are made. |
| [`AGENTS.md`](../AGENTS.md) | Repository guidance for AI-based assistants. | Automation agents | Serves as the canonical source; other AI-specific docs should defer to this file. |
| [`CLAUDE.md`](../CLAUDE.md) | Claude-specific pointer back to `AGENTS.md`. | Claude agents | Avoid duplicating guidance; keep as a short redirect. |

Retired documents (`ACTION_PLAN.md`, performance summaries, etc.) were removed to
reduce duplication and avoid referencing outdated fixes. Keeping this table up to
date helps reviewers discover the right level of documentation quickly.
