# Glossary

Short explanations of common terms used in this project.

## Terms

- **Apps Script project:** The Google Apps Script code bound to the control spreadsheet.
- **Apps Script API:** Google API that lets tools (like clasp or scripts) manage Apps Script projects.
- **Admin SDK API:** Google API used by the script to create and manage Google Groups.
- **Control spreadsheet:** The Google Sheet used to configure folders, roles, and sync behavior.
- **Config sheet:** A tab in the control spreadsheet with system settings (e.g., notification email).
- **Drive Permissions Manager:** The overall system that reads the control sheet and applies Drive permissions.
- **Drive API:** Google API used to read and update Drive permissions.
- **Domain verification:** A DNS-based check that proves you own the Workspace domain.
- **Full Sync:** A manual run that applies the control sheet rules across managed folders.
- **GCP project ID:** The human-readable identifier for your Google Cloud project (example: `my-project-123`).
- **GCP project number:** The numeric identifier for your Google Cloud project, required to link Apps Script to GCP.
- **Google Groups:** Groups used to manage access at scale; created and managed by the script.
- **Google Workspace tenant:** Your organization’s Google Workspace domain and admin console environment.
- **Group Admin Link:** A link in the `UserGroups` sheet that opens the matching Google Group in the Admin console.
- **Logs sheet:** A tab that records sync activity, progress, and errors.
- **Manual Sync:** A menu action that runs a Full Sync on demand.
- **OAuth consent screen:** The configuration that tells Google who can authorize the script and what it can access.
- **OAuth scopes:** The permission list Google shows during authorization.
- **Script ID:** The unique ID of the Apps Script project, shown in Apps Script Project Settings.
- **SheetEditors_G:** The default Google Group used to manage who can edit the control spreadsheet.
- **Super Admin:** A Google Workspace account with the highest admin privileges, required for setup tasks.
- **Triggers:** Apps Script time-based or event-based schedules that run syncs automatically.
- **UserGroups sheet:** A tab listing managed groups and their admin links.
