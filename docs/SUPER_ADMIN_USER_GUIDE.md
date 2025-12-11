# Google Drive Permissions Manager: Super Admin Guide

> **Who is this guide for?** This guide is for **Google Workspace Super Admins** who are responsible for the initial setup, ongoing maintenance, and execution of the core synchronization scripts.

**Crucial Prerequisite:** To perform any of the actions in this guide, you must be a Google Workspace Super Admin **and** have permission to edit the Permissions Manager Google Sheet. This permission is granted in one of two ways:
*   **By being the Owner of the spreadsheet file.**
*   **By being listed as an active user in the `SheetEditors` sheet.**

Being a Super Admin alone does **not** automatically grant you access to the sheet. The script will always treat the spreadsheet Owner as an editor, even if they are not listed in the `SheetEditors` sheet.

---

## The Super Admin Role

As a Super Admin, your primary responsibilities are:
- Performing the initial setup and authorization of the script.
- Taking care that sheet edits are applied, either manually or via configuring auto-sync.
- Running the synchronization functions that apply the permissions defined in the sheets.
- Managing advanced configuration and deletion operations.
- Troubleshooting system-level errors and monitoring logs.

---

## Running Sync and Audit Functions

All core actions are run from the spreadsheet menu: **Permissions Manager**.

### Sync Functions (under `Permissions Manager > ManualSync`)

These functions read the control sheets and apply the defined state to Google Drive and Google Groups.

*   **`Add/Enable Users in Groups`**: A non-destructive sync. It **adds or re-enables** members in groups based on the control sheets. It will create new folders and groups if they don't exist. It will **not** disable anyone. This is safe to run to apply additions or reversals of prior disables.
*   **`Remove/Disable Users from Groups`**: A destructive sync. It **removes/marks users as disabled** in groups when they have been removed from the user sheets. It will **not** add or re-enable anyone. You will be asked to confirm before it proceeds.
*   **`Full Sync`**: Performs both additions and removals in one operation. It also processes deletion requests for entire groups or folder-role bindings. **This is the most powerful sync and should be used with care.**

For changes made by Sheet Editors to be reflected in Google Drive and Google Groups, these synchronization functions must be executed. This can happen in two ways:

1.  **Manual Sync:** A Super Admin (or the Script Owner) manually selects one of the above menu items. This provides immediate application of changes.
2.  **Auto Sync:** The `autoSync` feature, if enabled and configured (refer to the `Config` sheet settings and the "Setup AutoSync" menu option), will periodically run the synchronization in the background. A Super Admin must ensure `autoSync` is correctly configured for automated application of changes.

### Verifying Permissions with the Folders Audit

The script includes a powerful, read-only **Folders Audit** feature that lets you check for any issues or discrepancies without making any changes. It's highly recommended to run this periodically to ensure the integrity of your permissions setup.

#### How to Run the Audit

From the spreadsheet menu, select **Permissions Manager > Folders Audit**.

The script will run in the background and post its findings to a dedicated log sheet.

#### Understanding the `FoldersAuditLog` Sheet

After the audit runs, check the **`FoldersAuditLog`** sheet.

*   **If the sheet is empty:** Congratulations! The audit found no problems.
*   **If the sheet has entries:** Each row represents a discrepancy. As a Super Admin, it is your responsibility to investigate and resolve these issues. Common issues include `Permission Mismatch`, `Folder Not Found`, `Missing Members`, and `Extra Members`.

---

## Deleting Groups and Folder-Role Bindings

When you no longer need to manage a group or a folder-role binding, you can explicitly request deletion using the **Delete checkbox** feature.

### Prerequisites

Before you can use the deletion feature, it must be enabled:

1. Go to the **Config** sheet.
2. Find the setting **`AllowGroupFolderDeletion`**.
3. Set it to **`TRUE`**.

When this setting is `FALSE`, any rows marked for deletion will show a status warning: "⚠️ Deletion disabled in Config".

### How to Delete

1.  A Sheet Editor (or you) marks the item for deletion by checking the **Delete** checkbox in the `ManagedFolders` (Column I) or `UserGroups` (Column F) sheet.
2.  You, the Super Admin, run **Permissions Manager > Full Sync**.

**What happens:**
- The Google Group is deleted from Google Workspace.
- The user sheet is deleted from the spreadsheet.
- The folder permission is removed.
- The control row is removed.
- **The Google Drive folder itself is NEVER deleted.** This is an intentional safety feature.

### Safety Mechanisms
1.  **Master Switch:** Deletion must be explicitly enabled in the `Config` sheet.
2.  **Explicit Checkbox:** A user must check a box to initiate a deletion.
3.  **Super Admin Approval:** Only a Super Admin running `Full Sync` can execute the deletion.
4.  **Audit Trail:** All deletions are logged to the `Log` sheet.

---

## Advanced Configuration (`Config` Sheet)

The `Config` sheet allows you to configure advanced settings.

| Setting | Description |
| :--- | :--- |
| `EnableAutoSync` | Set to `TRUE` to allow the time-based trigger to run. `FALSE` pauses automatic syncing. |
| `NotificationEmail` | The email address where important notifications (like errors or pending deletions) will be sent. |
| `AllowGroupFolderDeletion` | Set to `TRUE` to allow the `Full Sync` operation to process deletions marked with the Delete checkbox. |
| `EnableGCPLogging` | Set to `TRUE` to send detailed logs to Google Cloud Logging (requires a linked GCP project). |
| `RetryMaxRetries` | Max number of times the script will retry a failed API call. |
| `RetryInitialDelayMs`| Initial delay in milliseconds before the first retry (uses exponential backoff). |

---

## Advanced Logging with Google Cloud

For more robust logging, you can enable integration with Google Cloud Logging.

**To enable this:**

1.  You must have linked the script to a Google Cloud project during setup.
2.  In the `Config` sheet, set the value of `EnableGCPLogging` to `TRUE`.

Once enabled, you can view the logs in the [Google Cloud Logs Explorer](https://console.cloud.google.com/logs/viewer), which provides powerful searching and filtering capabilities.
