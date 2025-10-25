# Google Drive Permissions Manager: User Guide

Welcome! This guide explains how to use the Google Sheet to manage folder permissions after the initial setup has been completed.

---

## The Core Concept

This system works by linking Google Drive folders to Google Groups. Instead of sharing a folder with hundreds of individual email addresses, you share it with a single group (e.g., `my-project-editors@your-domain.com`). You then control who has access by simply adding or removing people from that group.

This spreadsheet is your central control panel for this entire process. The script reads your configuration from these sheets, and then automatically creates the groups, manages their members, and sets the correct permissions on the folders.

---

## The Control Sheets

After you initialize the script, several sheets are created automatically. Here is a breakdown of what they do.

### 1. `ManagedFolders` (Primary Control Sheet)

This is the most important sheet. Each row represents a folder you want the script to manage.

*   **`FolderName` (Column A):** The name of the Google Drive folder. 
    *   If a folder with this name doesn't exist, the script will create it for you.
    *   If a folder with this name already exists, the script will find it and use it.
*   **`FolderID` (Column B):** The unique ID of the Google Drive folder. 
    *   You can leave this blank. The script will automatically find or create the folder based on the `FolderName` and will fill in this ID for you.
    *   If you have multiple folders with the same name, you can paste the specific Folder ID here to avoid ambiguity.
*   **`Role` (Column C):** The permission level you want to grant. Use the dropdown to select one of:
    *   `Editor`: Can organize, add, and edit files.
    *   `Viewer`: Can view files.
    *   `Commenter`: Can comment on files.
*   **`UserSheetName` (Column D):** *Managed by Script.* The script will automatically generate the name of the sheet that will hold the user list for this folder/role combination (e.g., `MyProject_Editor`).
*   **`GroupEmail` (Column E):** *Managed by Script.* The script will automatically generate the email address for the Google Group it creates for this folder/role.
*   **`Last Synced` (Column F):** *Managed by Script.* A timestamp of the last time the script successfully processed this row.
*   **`Status` (Column G):** *Managed by Script.* Shows the status of the last sync (`OK`, `Processing...`, or an error message).

### 2. User Sheets (e.g., `MyProject_Editor`)

For every row in `ManagedFolders`, the script creates a corresponding **user sheet**. The name of this sheet is shown in the `UserSheetName` column.

*   **Purpose:** This is where you list the email addresses of the people who should have the specified role for that folder.
*   **How to Use:** Enter **exactly one valid email address per row** in Column A (`User Email Address`). If a cell contains multiple addresses or anything other than a single valid email, the script will log an error and ignore that entry. Optional Column B (`Disabled`) lets you temporarily exclude a user from receiving permissions—set it to `TRUE`, `YES`, or check the box to disable the user without deleting their row.

### 3. `UserGroups`

This sheet allows you to create your own reusable groups of people.

*   **`GroupName` (Column A):** A friendly name for your group (e.g., "Marketing Team", "Project X Developers").
*   **`GroupEmail` (Column B):** *Managed by Script.* The script will generate the email for the Google Group.
*   **How it Works:** For each `GroupName` you define here, the script creates a corresponding sheet with that name. You then list the members of that group in that sheet. You can then use the `GroupEmail` in any of your other user sheets to grant access to everyone in that group at once.

### 4. `Admins`

This sheet controls who has permission to edit this spreadsheet itself. Add the email addresses of anyone who should be an administrator of this control panel.

Each sync also keeps a dedicated Google Group in sync with this list. Column **B** shows the reusable group email so you can share any managed folder with all admins at once, and columns **C–D** record the latest group-sync status.

### 5. `Config`

This sheet allows you to configure advanced settings, such as enabling email notifications for script errors. It also displays important system information:

- **AdminGroupEmail**: Shows the email address of the administrators' Google Group (e.g., `admins-control-panel@yourdomain.com`). This is automatically updated when you run "Sync Admins" and can be used to grant admin access to any managed folder by adding this group email to the folder's user sheet.

### 6. `Log` & `TestLog`

These sheets contain detailed, timestamped logs of all the actions the script performs. They are very useful for troubleshooting if something goes wrong.

### 7. Advanced Logging with Google Cloud

For more robust logging, especially in production environments, you can enable integration with Google Cloud Logging. When enabled, the script sends detailed, structured logs to your own Google Cloud project.

**To enable this:**

1.  First, you must have linked the script to a Google Cloud project. See the instructions in the main [README.md file](../../README.md#upgrading-to-a-production-environment).
2.  In the `Config` sheet, set the value of `EnableGCPLogging` to `TRUE`.

Once enabled, you can view the logs in the [Google Cloud Logs Explorer](https://console.cloud.google.com/logs/viewer), which provides powerful searching and filtering capabilities.

---

## Verifying Permissions with the Dry Run Audit

The script includes a powerful, read-only **Dry Run Audit** feature that lets you check for any issues or discrepancies without making any changes. It's highly recommended to run this periodically to ensure the integrity of your permissions setup.

### How to Run the Audit

From the spreadsheet menu, select **Permissions Manager > Dry Run Audit**.

The script will run in the background and post its findings to a dedicated log sheet.

### Understanding the `DryRunAuditLog` Sheet

After the audit runs, check the **`DryRunAuditLog`** sheet.

*   **If the sheet is empty:** Congratulations! The audit found no problems. Your configured permissions match the actual state in Google Drive and Google Groups.
*   **If the sheet has entries:** Each row represents a discrepancy that the audit found. Here are the common issues it can detect:

| Issue Type          | Identifier    | Issue                 | Details                                                                              |
| :------------------ | :------------ | :-------------------- | :----------------------------------------------------------------------------------- |
| **Folder Permission** | Folder Name   | `Permission Mismatch` | The group has a different role on the folder than what is configured. (e.g., Expected: Viewer, Actual: NONE). |
| **Folder**          | Folder Name   | `Folder Not Found`    | The Folder ID in the `ManagedFolders` sheet is invalid or points to a deleted folder. |
| **Group Membership**  | Group Name    | `Missing Members`     | Users are listed in the user sheet but are not in the actual Google Group.         |
| **Group Membership**  | Group Name    | `Extra Members`       | Users are in the Google Group but are not listed in the corresponding user sheet.    |
| **Group Membership**  | Group Name    | `Error`               | The audit could not check the group, often because the group itself does not exist.  |

Running the audit is a safe and effective way to confirm that your permissions are exactly as you've defined them in the sheets.

---

## Common Workflows

### How to Grant a Team Access to a New Folder

Let's say you want to give the "Sales Team" editor access to a new folder called "Q4 Sales Reports".

1.  **Go to the `ManagedFolders` sheet.**
2.  In a new row, enter:
    *   `FolderName`: `Q4 Sales Reports`
    *   `Role`: `Editor`
3.  **Go to the `UserGroups` sheet.**
4.  In a new row, enter:
    *   `GroupName`: `Sales Team`
5.  **Run the creation sync.** From the spreadsheet menu, click **Permissions Manager > Sync Adds**.
6.  The script will now run. It will:
    *   Create the "Q4 Sales Reports" folder in Google Drive.
    *   Create a user sheet named `Q4 Sales Reports_Editor`.
    *   Create a Google Group for the Sales Team and a sheet named `Sales Team`.
7.  **Go to the `Sales Team` sheet.** Add the email addresses of your sales team members to Column A. Mark Column B if you want any member to stay listed but not yet receive access.
8.  **Go to the `Q4 Sales Reports_Editor` sheet.** In Column A, add the group email address for the sales team (you can copy this from the `GroupEmail` column in the `UserGroups` sheet).
9. **Run the final sync.** Click **Permissions Manager > Sync Adds** again.

The script will now add all the members from the `Sales Team` group to the `Q4 Sales Reports_Editor` group, granting them all editor access to the folder.

### How to Add a User

1.  Find the correct user sheet for the folder and role you want to change (e.g., `Q4 Sales Reports_Editor`).
2.  To add a user, add their email address to a new row in Column A. You can temporarily disable access later by marking Column B.
3.  Run **Permissions Manager > Sync Adds**.

### How to Remove a User

1.  Find the correct user sheet for the folder and role you want to change.
2.  To remove a user, delete the row containing their email address.
3.  Run **Permissions Manager > Sync Deletes**. You will be asked to confirm the deletion.

---

## Troubleshooting & FAQ

### I added a user, but they didn't get an email notification. Why?

This is a common and complex issue that can have several causes:

1.  **The Group Already Had Permission:** The script works by giving a *Google Group* access to a folder. The "Folder shared with you" email is only sent the very first time the group is granted access. If the group already had permission from a previous run, adding a new user to that group will *not* trigger a new folder-sharing email from Google. The only notification the user might receive is one saying "You have been added to group X," which is controlled by the Google Group's own settings.

2.  **Browser/Gmail Notification Settings:** Notification delivery depends heavily on the user's own client-side settings. For notifications to appear, the user must have granted Gmail permission to show notifications in their browser. They can typically check this by looking for a prompt from their browser when in Gmail or by checking their browser's site settings for `mail.google.com`.

3.  **Google Workspace / Account Settings:** Notification behavior can sometimes vary based on your organization's Google Workspace settings or a user's individual Google account settings.
