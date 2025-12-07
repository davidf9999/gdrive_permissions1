# Roles and Responsibilities

Use the correct Google account for each task, even if one person wears multiple hats. In many smaller teams, a single person (using a Workspace Super Admin account) may cover the setup-focused roles below.

### Personas vs. Accounts

- **The Installer (Human Being):** You, the person at the keyboard. You may switch between multiple Google accounts.
- **The Accounts (Digital Identities):** The specific Google accounts used for setup, ongoing administration, or day-to-day edits.

### Account Roles

| Role | Account Type | Setup Responsibilities | Ongoing Usage |
| :--- | :--- | :--- | :--- |
| **Workspace Super Admin** (Google Workspace Super Administrator) | Google Workspace system role. | Creates/enables the Workspace tenant settings, turns on Admin SDK + Drive APIs in Google Cloud, authorizes the Apps Script project, and grants any required API access. Often the same person handles the two sub-roles below. | Rarely involved after setup. Reviews audit logs, monitors email alerts, and handles escalations needing domain-wide privileges. |
| **CLI Authenticator** | Workspace Super Admin account used for CLI auth. | Authenticates `gcloud` when prompted so the tooling can manage the GCP project with the necessary domain-wide privileges. | Primarily used during setup or re-authentication events. |
| **Sheet Creator & Owner** | Workspace Super Admin account (ideally the same as the CLI Authenticator). | Creates the control spreadsheet and owns the Apps Script project. The script runs with this account's authority. | May step in to transfer ownership or approve new scopes, but typically hands off to the Super Admin role below. |
| **Super Admin** (listed in `Config` > `SuperAdminEmails`) | Script-level permission granted to specific accounts. | Configures `Config` settings, manages triggers, runs built-in tests, and troubleshoots errors. | Runs manual syncs, monitors `SyncHistory`/`Logs`, updates configuration, marks items for deletion, and can edit sheets. |
| **Sheet Editor** | Any Google account with edit access to the control spreadsheet. | Edits `ManagedFolders`, `UserGroups`, and membership sheets; marks items for deletion via the Delete checkbox. Cannot run scripts or access menu functions. | Maintains user lists, adds/removes folders, checks Status columns; changes are applied when a Super Admin runs the next sync. |
| **Managed User** | Any Google account represented in folder/group tabs. | None. They simply appear in the relevant group or folder-role tab. | Receives Drive access after the next sync. Sheet access is not required (read-only sharing is optional, for transparency only). |

> Tip: In practice, many deployments keep the Workspace Super Admin, CLI Authenticator, Sheet Creator & Owner, and Super Admin roles on the same user during setup and testing to simplify approvals. You can later hand off ongoing operations to other Super Admins and Sheet Editors without changing the sheet owner.

### Example account mapping (illustrative)

Use placeholder emails to visualize the separation of duties. Replace with real accounts during setup:

| Role | Example account |
| :--- | :--- |
| Workspace Super Admin / CLI Authenticator / Sheet Creator & Owner | `it-admin@example.com` |
| Super Admin (Config + sync runner) | `automation@example.com` |
| Sheet Editor | `data-coordinator@example.com` |
| Managed User | `employee1@example.com` |
