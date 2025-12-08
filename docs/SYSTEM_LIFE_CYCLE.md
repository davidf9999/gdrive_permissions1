# System life cycle

This guide summarizes the major life cycle stages for the Google Drive Permission Manager and points to the canonical documents for each phase. Use it as a checklist when planning operational procedures or delegating work.

## Stages at a glance

- **Setup** – Prepare Google Workspace and Apps Script resources so the control spreadsheet and automation can run. Follow the detailed steps in the [Setup Guide](SETUP_GUIDE.md) and the [Onboarding checklist](ONBOARDING.md) for first-time administrators.
- **Usage** – Operate the system by editing the control spreadsheet, reviewing logs, and running sync actions. The [User Guide](USER_GUIDE.md) explains daily workflows, while the [Roles and Responsibilities](ROLES_AND_RESPONSIBILITIES.md) document clarifies who should perform each action.
- **Teardown** – Retire the deployment, revoke access, and clean up Google Workspace artifacts. Refer to [Delete a Google Workspace deployment](DELETE_GOOGLE_WORKSPACE.md) for a structured shutdown process and to [STOP_SCRIPTS.md](STOP_SCRIPTS.md) if you only need to pause automation temporarily.

## Operational decisions and actions

Use this checklist to capture concrete decisions and playbooks for each stage:

- **Setup**
  - Assign a primary admin and backup for provisioning Sheets, Apps Script, and Workspace APIs; record required approvals and change windows.
  - Decide where canonical links live (control spreadsheet URL, script project URL, GCP project ID) and how they are shared.
  - Define how initial folder ownership is validated before first sync (e.g., sample audit of Editor/Viewer/Commenter groups).
- **Usage**
  - Document who can edit the control spreadsheet, who reviews the `Log`/`TestLog` sheets, and the cadence for checking sync results.
  - Capture communication steps for permission changes (notifications to folder owners or distribution lists) and how to pause/resume AutoSync when needed.
  - Note the rollback plan for bad edits (restore prior sheet versions, re-run sync, or revert to a previous Apps Script bundle).
- **Teardown**
  - Specify approvals required to retire the deployment and who executes each task (revoking folder access, disabling triggers, deleting Apps Script resources).
  - Record retention expectations for spreadsheets, logs, and audit evidence after shutdown.
  - Clarify whether a partial pause (e.g., disabling triggers only) is acceptable before full removal and how to communicate the timeline.

Keeping these decisions adjacent to the links above gives operators a ready-made runbook for safe changes at every stage.
