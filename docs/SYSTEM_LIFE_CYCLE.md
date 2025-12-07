# System life cycle

This guide summarizes the major life cycle stages for the Google Drive Permission Manager and points to the canonical documents for each phase. Use it as a checklist when planning operational procedures or delegating work.

## Stages at a glance

- **Setup** – Prepare Google Workspace and Apps Script resources so the control spreadsheet and automation can run. Follow the detailed steps in the [Setup Guide](SETUP_GUIDE.md) and the [Onboarding checklist](ONBOARDING.md) for first-time administrators.
- **Usage** – Operate the system by editing the control spreadsheet, reviewing logs, and running sync actions. The [User Guide](USER_GUIDE.md) explains daily workflows, while the [Roles and Responsibilities](ROLES_AND_RESPONSIBILITIES.md) document clarifies who should perform each action.
- **Teardown** – Retire the deployment, revoke access, and clean up Google Workspace artifacts. Refer to [Delete a Google Workspace deployment](DELETE_GOOGLE_WORKSPACE.md) for a structured shutdown process and to [STOP_SCRIPTS.md](STOP_SCRIPTS.md) if you only need to pause automation temporarily.

## Decisions and actions to document

For each stage, consider capturing the following operational details in your internal runbooks:

- **Owners and approvals** – Who can initiate setup, adjust folder permissions, or authorize teardown? Which change windows or security approvals are required?
- **Configuration sources** – Where to store spreadsheet links, trigger settings, and Google Cloud project IDs. Note any variance from the defaults in the guides above.
- **Communication plan** – How you notify users about permission changes, maintenance windows, or system retirement.
- **Audit and logging expectations** – What evidence needs to be kept (e.g., screenshots of `Log` sheet entries or Admin audit logs) and for how long.
- **Fallbacks and rollbacks** – Steps for restoring prior permissions, disabling AutoSync, or reverting to a previous Apps Script bundle.

Keeping these decisions in a single place helps new operators understand how to run the system safely across its entire life cycle.
