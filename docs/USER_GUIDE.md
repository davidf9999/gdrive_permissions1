# Google Drive Permissions Manager: User Guide

Welcome! This guide explains how to use the Google Spreadsheet to manage folder permissions after the initial setup has been completed.

---

## The Core Concept

This system works by linking Google Drive folders to Google Groups. Instead of sharing a folder with hundreds of individual email addresses, you share it with a single group (e.g., `my-project-editors@your-domain.com`). You then control who has access by simply adding or removing people from that group.

This spreadsheet is your central control panel for this entire process. The script reads your configuration from the sheets (tabs) within this spreadsheet, and then automatically creates the groups, manages their members, and sets the correct permissions on the folders.

---

## The Control Sheets (Tabs)

After you initialize the script, several sheets (tabs) are created automatically. Here is a breakdown of what they do.

### 1. `ManagedFolders` (Primary Control Tab)

This is the most important tab. Each row represents a folder you want the script to manage.

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
*   **`GroupEmail` (Column E):** *Managed by Script or Manual.* The script will automatically generate the email address for the Google Group it creates for this folder/role.
    *   **For ASCII folder names** (English, numbers): Leave blank - the script auto-generates (e.g., `my-project-editor@yourdomain.com`)
    *   **For non-ASCII folder names** (Hebrew, Arabic, Chinese, etc.): You must manually specify an ASCII email address (e.g., `coordinators-editor@jvact.org`). See [Working with Non-ASCII Characters](#working-with-non-ascii-characters) below.
*   **`Last Synced` (Column F):** *Managed by Script.* A timestamp of the last time the script successfully processed this row.
*   **`Status` (Column G):** *Managed by Script.* Shows the status of the last sync (`OK`, `Processing...`, or an error message).
*   **`URL` (Column H):** *Managed by Script.* A direct link to the folder in Google Drive.
*   **`Delete` (Column I):** *User-editable.* Check this checkbox to mark the folder-role binding for deletion. See [Deleting Groups and Folder-Role Bindings](#deleting-groups-and-folder-role-bindings) for details.

### 2. User Sheets (e.g., `MyProject_Editor`)

For every row in `ManagedFolders`, the script creates a corresponding **user sheet** (tab). The name of this sheet is shown in the `UserSheetName` column.

*   **Purpose:** This is where you list the email addresses of the people who should have the specified role for that folder.
*   **How to Use:** Enter **exactly one valid email address per row** in Column A (`User Email Address`). If a cell contains multiple addresses or anything other than a single valid email, the script will log an error and ignore that entry. Optional Column B (`Disabled`) lets you temporarily exclude a user from receiving permissions—set it to `TRUE`, `YES`, or check the box to disable the user without deleting their row.

**Important: Duplicate Email Validation**
- Each email address must appear **only once** per sheet (case-insensitive).
- The script will automatically detect duplicates and stop processing that folder with a clear error message.
- Example error: `"user@domain.com" appears in rows 2, 5, 8`.
- Use the **"Validate All User Sheets"** menu option to check all sheets at once for duplicates.
- Duplicates prevent sync operations to ensure data integrity.

### 3. `UserGroups`

This sheet allows you to create your own reusable groups of people.

*   **`GroupName` (Column A):** A friendly name for your group (e.g., "Marketing Team", "Project X Developers", "מתאמים").
*   **`GroupEmail` (Column B):** *Managed by Script or Manual.* The script will generate the email for the Google Group.
    *   **For ASCII group names** (English, numbers): Leave blank - the script auto-generates (e.g., `marketing-team@yourdomain.com`).
    *   **For non-ASCII group names** (Hebrew, Arabic, Chinese, etc.): You must manually specify an ASCII email address (e.g., `coordinators@jvact.org`). See [Working with Non-ASCII Characters](#working-with-non-ascii-characters) below.
*   **`Group Admin Link` (Column C):** *Managed by Script.* A direct link to manage the Google Group.
*   **`Last Synced` (Column D):** *Managed by Script.* A timestamp of the last time the script successfully processed this row.
*   **`Status` (Column E):** *Managed by Script.* Shows the status of the last sync (`OK`, `Processing...`, or an error message).
*   **`Delete` (Column F):** *User-editable.* Check this checkbox to mark the user group for deletion. See [Deleting Groups and Folder-Role Bindings](#deleting-groups-and-folder-role-bindings) for details.
*   **How it Works:** For each `GroupName` you define here, the script creates a corresponding sheet with the name `GroupName_G` (the "_G" suffix distinguishes group sheets from folder sheets). You then list the members of that group in that sheet. You can then use the `GroupEmail` in any of your other user sheets to grant access to everyone in that group at once.
    *   **Example:** Group name "Marketing Team" creates sheet "Marketing Team_G".
    *   **Note:** The script automatically migrates old sheets without the "_G" suffix when you run a sync.

### 4. `SheetEditors`

This sheet controls who has permission to **edit** this spreadsheet itself. Add the email addresses of anyone who should be an editor of this control panel.

**Sheet Structure:**
- **Column A**: Sheet Editor Emails - List the email addresses of all editors (one per row).
- **Column B**: Last Synced - Timestamp of the last successful sync.
- **Column C**: Status - Current sync status (OK, Processing..., ERROR, etc.).

Each sync also keeps a dedicated Google Group in sync with this list. The editors' group email (e.g., `sheet-editors-control-panel@yourdomain.com`) is stored in the **Config sheet** under `AdminGroupEmail`. You can use this group email to grant editor access to any managed folder by adding it to that folder's user sheet.

**Adding Viewers to the Control Spreadsheet:** If you want to grant some users **view-only** access to the control spreadsheet (without editing permissions), simply use the standard Google Sheets sharing functionality. Click the "Share" button in the top-right corner of the spreadsheet and add users with "Viewer" permissions. This does not need to be managed through the script.

### 5. `Config`



This sheet allows you to configure advanced settings for the script. It also displays important, read-only information that is updated by the script.



**Key Configuration Settings:**



| Setting | Description | Default |

| :--- | :--- | :--- |

| `EnableAutoSync` | Set to `TRUE` to allow the time-based trigger to run. Set to `FALSE` to pause all automatic syncing without deleting the trigger. | `TRUE` |

| `NotificationEmail` | The email address where important notifications (like errors or pending deletions) will be sent. | The script owner's email |

| `MaxFileSizeMB` | A safeguard to prevent the spreadsheet from becoming too large. If the file size exceeds this limit, AutoSync is aborted and an admin is notified. | `100` |

| `EnableGCPLogging` | Set to `TRUE` to send detailed logs to Google Cloud Logging (requires a linked GCP project). | `FALSE` |



**System Information (Read-Only):**



-   **`AutoSyncStatus`**: A visual indicator showing the current status of the AutoSync trigger. Updated automatically when the spreadsheet is opened or when triggers are changed.

-   **`AdminGroupEmail`**: Shows the email address of the Sheet Editors' Google Group (e.g., `sheet-editors-control-panel@yourdomain.com`). This is automatically updated when you run "Sync Sheet Editors" and can be used to grant editor access to any managed folder by adding it to that folder's user sheet.



#### Logging Verbosity

The `LogLevel` setting controls how much detail is written to the Log sheet. This is especially useful to reduce log clutter from routine AutoSync checks:

| Level | What Gets Logged | Use Case |
| :---- | :--------------- | :------- |
| `ERROR` | Critical errors only | Production with minimal logging |
| `WARN` | Warnings and errors | Production with basic monitoring |
| `INFO` | Normal operations, warnings, errors (default) | Standard usage |
| `DEBUG` | Everything including routine AutoSync checks | Troubleshooting or development |

**Recommendation:** Use `INFO` (default) for normal operation. Switch to `DEBUG` only when troubleshooting. With `INFO`, routine "AutoSync skipped: No changes detected" messages won't clutter your logs every 5 minutes.

#### API Retry Settings



The script is designed with built-in retry mechanisms to handle temporary API errors, such as Google's rate limits. The behavior of these retries can be configured in this sheet:



| Setting           | Description                                                                                                                                              | Default |

| :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- | :------ |

| `RetryMaxRetries` | The maximum number of times the script will attempt to re-execute a failed API call (e.g., due to rate limiting).                                        | `5`     |

| `RetryInitialDelayMs` | The initial time in milliseconds to wait before the first retry. This delay doubles with each subsequent retry (exponential backoff).                     | `1000`  |



Adjusting these settings can help the script successfully complete operations under varying API loads. For a deeper understanding of how these settings impact performance, especially during high-volume operations, refer to the [Testing Guide (docs/TESTING.md)](TESTING.md) section on Stress Testing.



### 6. `Log` & `TestLog`



These sheets contain detailed, timestamped logs of all the actions the script performs. They are very useful for troubleshooting if something goes wrong.

### 7. Advanced Logging with Google Cloud

For more robust logging, especially in production environments, you can enable integration with Google Cloud Logging. When enabled, the script sends detailed, structured logs to your own Google Cloud project.

**To enable this:**

1.  First, you must have linked the script to a Google Cloud project. See the instructions in the main [README.md file](../../README.md).
2.  In the `Config` sheet, set the value of `EnableGCPLogging` to `TRUE`.

Once enabled, you can view the logs in the [Google Cloud Logs Explorer](https://console.cloud.google.com/logs/viewer), which provides powerful searching and filtering capabilities.

---

## Verifying Permissions with the Folders Audit

The script includes a powerful, read-only **Folders Audit** feature that lets you check for any issues or discrepancies without making any changes. It's highly recommended to run this periodically to ensure the integrity of your permissions setup.

### How to Run the Audit

From the spreadsheet menu, select **Permissions Manager > Folders Audit**.

The script will run in the background and post its findings to a dedicated log sheet.

### Understanding the `FoldersAuditLog` Sheet

After the audit runs, check the **`FoldersAuditLog`** sheet.

*   **If the sheet is empty:** Congratulations! The audit found no problems. Your configured permissions match the actual state in Google Drive and Google Groups.
*   **If the sheet has entries:** Each row represents a discrepancy that the audit found. Here are the common issues it can detect:

| Issue Type          | Identifier    | Issue                 | Details                                                                              |
| :------------------ | :------------ | :-------------------- | :----------------------------------------------------------------------------------- |
| **Folder Permission** | Folder Name   | `Permission Mismatch` | The group has a different role on the folder than what is configured. (e.g., Expected: Viewer, Actual: NONE). |
| **Folder**          | Folder Name   | `Folder Not Found`    | The Folder ID in the `ManagedFolders` sheet is invalid or points to a deleted folder. |
| **Group Membership**  | Group Name    | `VALIDATION ERROR`    | Duplicate emails found in the user sheet (e.g., "user@domain.com" appears in rows 2, 5). |
| **Group Membership**  | Group Name    | `Missing Members`     | Users are listed in the user sheet but are not in the actual Google Group.         |
| **Group Membership**  | Group Name    | `Extra Members`       | Users are in the Google Group but are not listed in the corresponding user sheet.    |
| **Group Membership**  | Group Name    | `Error`               | The audit could not check the group, often because the group itself does not exist.  |

Running the audit is a safe and effective way to confirm that your permissions are exactly as you've defined them in the sheets.

---

## Validating User Sheets for Duplicate Emails

To maintain data integrity and prevent sync errors, the system automatically validates that each email address appears only once in each user sheet (case-insensitive). This validation runs automatically during sync operations and audits.

### Automatic Validation

Duplicate email validation happens automatically in these scenarios:
- **During sync operations**: Before processing any folder, the script validates its user sheet.
- **During folders audit**: Each user sheet is validated before checking group membership.
- **When accessing existing sheets**: If a user sheet already exists with data, it's validated before use.

If duplicates are found, the script will:
- Stop processing that specific folder/group.
- Log a clear error message with exact duplicate emails and row numbers.
- Update the folder status to show the validation error.
- Continue processing other folders normally (non-blocking).

### Manual Validation: "Validate All User Sheets"

You can manually check all user sheets at once using the menu option: **Permissions Manager > Validate All User Sheets**

This will:
1. Check all user sheets from `ManagedFolders`, `UserGroups`, and `SheetEditors`.
2. Display a summary showing which sheets have errors.
3. Provide detailed information about each duplicate found.

**Example Output:**
```
Validated 10 user sheets.

Sheets with errors: 2
Sheets without errors: 8

Details:
✓ Project_A_Editors: OK
✓ Project_A_Viewers: OK
❌ Project_B_Editors: Duplicate emails found: "user@domain.com" appears in rows 3, 7
✓ Project_C_Editors: OK
❌ Marketing_Team: Duplicate emails found: "admin@company.com" appears in rows 2, 5, 9
✓ SheetEditors: OK
...
```

### Fixing Duplicate Email Errors

When you see a validation error:
1. Note which sheet has the problem.
2. Open that sheet and look at the row numbers mentioned.
3. Remove the duplicate entries (keep only one instance of each email).
4. Re-run the sync or validation to confirm the issue is resolved.

**Remember:** Email comparison is case-insensitive, so `user@domain.com`, `USER@domain.com`, and `UsEr@DoMaIn.CoM` are all considered duplicates.

---

## Working with Non-ASCII Characters

The system fully supports using non-ASCII characters (Hebrew, Arabic, Chinese, emoji, etc.) in most places, with one important limitation: **Google Group email addresses must use only ASCII characters** (a-z, 0-9, hyphens).

### What Works Everywhere

✅ **Folder names**: Hebrew, Arabic, Chinese, etc. are fully supported.
✅ **Group names**: Hebrew, Arabic, Chinese, etc. are fully supported.
✅ **Sheet names**: Any Unicode characters work.
✅ **User email addresses**: Any valid email format (including international domains).

### The Email Address Limitation

❌ **Group email addresses**: Must be ASCII only (Google's requirement, not ours).

### How to Handle Non-ASCII Names

When you create groups or folders with non-ASCII names, you must **manually specify the group email** using ASCII characters:

(Note: Examples below use Hebrew for demonstration, but the principle applies to any non-ASCII characters.)

#### Example 1: UserGroups Sheet

| Column A (GroupName) | Column B (GroupEmail) ← **Manual for Hebrew** | Column C | Column D |
|---------------------|-----------------------------------------------|----------|----------|
| Marketing Team      | (leave empty - auto-generates)                |          |           |
| מתאמים              | `coordinators@jvact.org`                      |          |           |
| פעילים              | `activists@jvact.org`                         |          |           |

#### Example 2: ManagedFolders Sheet

| FolderName | FolderID | Role | UserSheetName | **Column E (GroupEmail)** ← **Manual for Hebrew** |
|------------|----------|------|---------------|---------------------------------------------------|
| Reports    | ...      | Editor | (auto)      | (leave empty - auto-generates)                    |
| מתאמים     | ...      | Editor | (auto)      | `coordinators-editor@jvact.org`                   |
| admin      | ...      | Viewer | (auto)      | (leave empty - auto-generates)                    |

### Important Notes

**💡 Google Groups are FREE!** You are not paying per group email - Google Groups are included with Google Workspace at no extra cost. When you specify a group email manually, the script still creates and manages the group for you automatically.

**🎯 The script auto-creates everything:** Whether you let the script auto-generate the email or you specify it manually, the script handles creating the Google Group, adding members, and managing permissions. You're just choosing the email address format.

**⚠️ Collision risk with auto-generation:** If you don't manually specify emails for non-ASCII names, multiple groups may generate the same email address (e.g., both "מתאמים" and "פעילים" would try to use similar ASCII-stripped emails), causing permission conflicts.

### What Happens if You Forget

If you forget to manually specify a group email for a non-ASCII name, the script will give you a clear, helpful error message:

**For UserGroups:**
```
Group name "מתאמים" contains only non-ASCII characters (e.g., Hebrew, Arabic,
Chinese) which cannot be used in email addresses. Please manually specify a
group email in the "GroupEmail" column (Column B) using only ASCII characters
(a-z, 0-9, hyphens). Example: for "מתאמים", you could use "coordinators@jvact.org"
or "team-a@jvact.org".
```

**For ManagedFolders:**
```
Cannot auto-generate group email for folder "מתאמים" with role "Editor".
The folder name contains non-ASCII characters (e.g., Hebrew, Arabic, Chinese).
Please manually specify a group email in the "GroupEmail" column (Column E)
of the ManagedFolders sheet. Example: "coordinators-editor@jvact.org"
```

Simply fill in the appropriate column with an ASCII email address and run the sync again!

### Duplicate Group Email Validation

**Important:** Each group email must be unique across your entire configuration. The system validates that no two groups share the same email address, as this would cause them to have the same members and create permission conflicts.

**The validation checks:**
- ✅ Within UserGroups sheet (Column B)
- ✅ Within ManagedFolders sheet (Column E)
- ✅ Between UserGroups and ManagedFolders

**When duplicates are found:**
- Sync is blocked before any changes are made
- Clear error message shows all duplicate locations
- Folders Audit reports duplicates in the audit log

**Example error:**
```
VALIDATION ERROR: Duplicate group emails detected!

Duplicate group email "team@jvact.org" found in:
UserGroups row 2 (Group: Marketing);
ManagedFolders row 5 (Folder: Project A, Role: Editor)

Each group must have a unique email address. Please fix these duplicates and try again.
```

**How to fix:**
1. Review the error message to see which groups/folders share the same email
2. Update one or more of the duplicate emails to be unique
3. Re-run the sync again

**Note:** This validation prevents a common mistake where manually specifying the same email for multiple groups would silently cause them to share members.

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
5.  **Run the creation sync.** From the spreadsheet menu, click **Permissions Manager > ManualSync > Add Users to Groups**.
6.  The script will now run. It will:
    *   Create the "Q4 Sales Reports" folder in Google Drive.
    *   Create a user sheet named `Q4 Sales Reports_Editor`.
    *   Create a Google Group for the Sales Team and a sheet named `Sales Team_G`.
7.  **Go to the `Sales Team_G` sheet.** Add the email addresses of your sales team members to Column A. Mark Column B if you want any member to stay listed but not yet receive access.
8.  **Go to the `Q4 Sales Reports_Editor` sheet.** In Column A, add the group email address for the sales team (you can copy this from the `GroupEmail` column in the `UserGroups` sheet).
9. **Run the final sync.** Click **Permissions Manager > ManualSync > Add Users to Groups** again.

The script will now add all the members from the `Sales Team` group to the `Q4 Sales Reports_Editor` group, granting them all editor access to the folder.

### How to Add a User

1.  Find the correct user sheet for the folder and role you want to change (e.g., `Q4 Sales Reports_Editor`).
2.  To add a user, add their email address to a new row in Column A. You can temporarily disable access later by marking Column B.
3.  Run **Permissions Manager > ManualSync > Add Users to Groups**.

### How to Remove a User

1.  Find the correct user sheet for the folder and role you want to change.
2.  To remove a user, delete the row containing their email address.
3.  Run **Permissions Manager > ManualSync > Remove Users from Groups**. You will be asked to confirm the removal.

**Note on `Remove Users from Groups`**: This function only *revokes permissions* by removing users from the Google Groups associated with your folders. It does **not** delete the Google Group itself, the Google Drive folder, or the user sheet from your spreadsheet. This is a safety feature to prevent accidental data loss. See the next section for how to handle obsolete resources.

---

## Deleting Groups and Folder-Role Bindings

When you no longer need to manage a group or a folder-role binding, you can explicitly request deletion using the **Delete checkbox** feature.

### Understanding What Gets Deleted (and What Doesn't)

**What the deletion feature deletes:**
- ✅ Google Groups (from Google Workspace)
- ✅ User sheets (from the spreadsheet)
- ✅ Folder permissions (group removed from folder)
- ✅ Control sheet rows (from ManagedFolders or UserGroups)

**What is NEVER deleted:**
- ❌ **Google Drive folders** - Folders remain in Drive even when all roles are deleted

This asymmetric design (folders auto-created but never deleted) is intentional. The system manages **permissions**, not folder lifecycle. Deleting a folder by mistake could cause major data loss, so folders must be deleted manually if truly no longer needed.

### Prerequisites

Before you can use the deletion feature, it must be enabled by a Super Admin:

1. Go to the **Config** sheet
2. Find the setting **`AllowGroupFolderDeletion`**
3. Set it to **`TRUE`**

When this setting is `FALSE`, the Delete checkboxes are visible but non-functional. Any rows marked for deletion will show a status warning: "⚠️ Deletion disabled in Config".

### How to Delete a UserGroup

UserGroups are standalone groups defined in the `UserGroups` sheet.

**Steps:**
1. Go to the **UserGroups** sheet
2. Find the group you want to delete (e.g., "Marketing Team")
3. Check the **Delete** checkbox (Column F) for that row
4. Run **Permissions Manager > Full Sync**

**What happens:**
- The Google Group is deleted from Google Workspace
- The user sheet (e.g., "Marketing Team_G") is deleted
- The row is removed from the UserGroups sheet
- Email notification sent (if enabled in Config)

**⚠️ Warning:** If this group is used as a member in other groups (nested), you'll receive a warning in the Status column showing where it's still in use.

### How to Delete a Folder-Role Binding

Folder-role bindings are defined in the `ManagedFolders` sheet. Each binding represents one role (e.g., Editor) for one folder.

**Steps:**
1. Go to the **ManagedFolders** sheet
2. Find the folder-role binding you want to delete (e.g., "Project A" with role "Editor")
3. Check the **Delete** checkbox (Column I) for that row
4. Run **Permissions Manager > Full Sync**

**What happens:**
- The Google Group for that folder-role is deleted
- The group is removed from the folder's permissions
- The user sheet (e.g., "Project A_Editor") is deleted
- The row is removed from ManagedFolders
- Email notification sent (if enabled in Config)
- **The folder itself remains in Drive** (by design)

**ℹ️ Important:** If this is the last binding for a folder (e.g., you delete "Project A_Editor" and it was the only role), the Log sheet will note that you're deleting the last binding for that folder. The folder will remain in Drive but will no longer be managed by the script.

### Using the Delete Checkbox

The Delete column appears in:
- **ManagedFolders** sheet - Column I
- **UserGroups** sheet - Column F

**To mark for deletion:**
- Click the cell
- Check the checkbox (or type TRUE)
- The Status column will update on next sync

**To cancel deletion:**
- Uncheck the checkbox before running sync
- If already synced, the row will be gone (deletion complete)

### Delete Triggers and Safety

**When deletion happens:**
- Deletions are processed during **Full Sync** only
- Deletions happen AFTER validation, BEFORE regular sync operations
- Deletions require the `AllowGroupFolderDeletion` config setting to be TRUE

**Safety mechanisms:**
1. **Master Switch:** Must be explicitly enabled in Config
2. **Explicit Checkbox:** No accidental deletions from row removal
3. **Super Admin Approval:** Only Super Admins can run Full Sync
4. **Email Notifications:** Optional alerts when deletions occur (Config: `NotifyOnGroupFolderDeletion`)
5. **Audit Trail:** All deletions logged to Log sheet with timestamps
6. **Status Visibility:** Status column shows deletion pending/warnings
7. **Nested Group Detection:** Warns if deleting a group that's used elsewhere
8. **Last Binding Detection:** Warns when removing the last role from a folder

**⚠️ Preventing Manual Row Deletion:**

The script includes an `onEdit` trigger that monitors the ManagedFolders and UserGroups sheets. If you try to delete a row manually (by clearing the first 3 columns), you'll see a warning message:

```
⚠️ Warning: Did you delete a row in ManagedFolders or UserGroups?

If you want to delete a group or folder-role binding, please use the
Delete checkbox in column I (ManagedFolders) or column F (UserGroups)
instead of manually deleting rows.

Manual row deletion may cause orphaned resources (groups, sheets, permissions).
```

This is a warning only - manual deletion is not blocked. However, the Delete checkbox is the recommended approach.

### Email Notifications

When groups or folder-roles are deleted, Super Admins can optionally receive email notifications.

**To enable notifications:**
1. Config sheet: Set `EnableEmailNotifications` = TRUE
2. Config sheet: Set `NotifyOnGroupFolderDeletion` = TRUE (default)
3. Config sheet: Verify `NotificationEmail` is correct

**Email includes:**
- Number of groups deleted
- Number of folder-role bindings deleted
- List of what was deleted
- Confirmation that folders remain in Drive
- Links to Log and SyncHistory sheets

### Troubleshooting Deletion

**Status shows "⚠️ Deletion disabled in Config":**
- The Delete checkbox is marked, but `AllowGroupFolderDeletion` is FALSE
- Go to Config sheet and set it to TRUE to enable deletions

**Status shows "⚠️ Group used in [OtherGroup1, OtherGroup2]":**
- You're trying to delete a group that's nested inside other groups
- Remove this group from those other groups first, or delete those groups first

**Group already deleted but row still exists:**
- If you manually deleted the Google Group outside the script, marking Delete checkbox will still clean up the sheet and row
- The script handles already-deleted groups gracefully (idempotent operation)

**I want to delete the folder too:**
- Folders are never deleted by the script (by design - safety feature)
- After deleting all roles for a folder, manually delete the folder in Google Drive if needed
- Go to [Google Drive](https://drive.google.com), find the folder, right-click, select "Move to trash"

---

## Troubleshooting & FAQ

### I added a user, but they didn't get an email notification. Why?

This is a common and complex issue that can have several causes:

1.  **The Group Already Had Permission:** The script works by giving a *Google Group* access to a folder. The "Folder shared with you" email is only sent the very first time the group is granted access. If the group already had permission from a previous run, adding a new user to that group will *not* trigger a new folder-sharing email from Google. The only notification the user might receive is one saying "You have been added to group X," which is controlled by the Google Group's own settings.

2.  **Browser/Gmail Notification Settings:** Notification delivery depends heavily on the user's own client-side settings. For notifications to appear, the user must have granted Gmail permission to show notifications in their browser. They can typically check this by looking for a prompt from their browser when in Gmail or by checking their browser's site settings for `mail.google.com`.

3.  **Google Workspace / Account Settings:** Notification behavior can sometimes vary based on your organization's Google Workspace settings or a user's individual Google account settings.