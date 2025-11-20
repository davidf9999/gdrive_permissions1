# Documentation overview

This index explains the intent of each documentation file and highlights how to
keep the content current.

| File | Purpose | Audience | Notes |
| ---- | ------- | -------- | ----- |
| [`README.md`](../README.md) | Front door for the project, covering prerequisites, manual setup, and the documentation map. | New administrators & contributors | Keep in sync with the supported deployment path (`clasp`) and update when APIs or menus change. |
| [`gdrive_permissions1.md`](../gdrive_permissions1.md) | Architectural walkthrough of the Apps Script modules and spreadsheet layout. | Developers & reviewers | Update when new modules are added or the execution flow changes. |
| [`docs/WORKSPACE_SETUP.md`](WORKSPACE_SETUP.md) | Linear walkthrough for creating the Workspace admin and installing the script. | First-time Workspace admins | Update when Google Cloud or Admin Console UI flows change. |
| [`docs/ONBOARDING.md`](ONBOARDING.md) | Checklist that complements the README setup section. | Workspace admins | Use during training sessions; revise if prerequisites shift. |
| [`docs/USER_GUIDE.md`](USER_GUIDE.md) | Day-to-day usage guide for the spreadsheet menu. | Spreadsheet operators | Align with the in-sheet menu names and supported workflows. |
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
