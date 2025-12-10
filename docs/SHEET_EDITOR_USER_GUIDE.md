# Google Drive Permissions Manager: Sheet Editor Guide

> **Who is this guide for?** This guide is for **Sheet Editors**, the people who manage permissions day-to-day by editing the control spreadsheet.

Welcome! This guide explains how to use the Google Spreadsheet to manage folder permissions. Your changes will be applied automatically by a Super Admin who runs the synchronization scripts.

---

## The Core Concept

This system works by linking Google Drive folders to Google Groups. Instead of sharing a folder with hundreds of individual email addresses, you share it with a single group (e.g., `my-project-editors@your-domain.com`). You then control who has access by simply adding or removing people from that group.

This spreadsheet is your central control panel for this entire process.

---

## The Control Sheets (Tabs)

Several sheets (tabs) are used to control permissions. Here is a breakdown of what they do.

### 1. `ManagedFolders` (Primary Control Tab)

This is the most important tab. Each row represents a folder you want the script to manage.

*   **`FolderName` (Column A):** The name of the Google Drive folder.
*   **`Role` (Column C):** The permission level to grant (`Editor`, `Viewer`, `Commenter`).
*   **`Delete` (Column I):** Check this checkbox to request that a Super Admin delete this folder-role binding.
*   Other columns (`FolderID`, `UserSheetName`, `GroupEmail`, etc.) are managed by the script and are useful for reference.

### 2. User Sheets (e.g., `MyProject_Editor`)

For every row in `ManagedFolders`, a corresponding **user sheet** (tab) is created. This is where you list the people who should have access.

*   **How to Use:** Enter **exactly one valid email address per row** in Column A (`User Email Address`).
*   **Temporarily Disabling Access:** To temporarily disable a user's access without deleting their name, enter `TRUE` or check the box in Column B (`Disabled`).

**Important: Duplicate Email Validation**
- Each email address must appear **only once** per sheet.
- The system will automatically detect duplicates and a Super Admin will see an error when they try to sync.
- You can use the **"Validate All User Sheets"** menu option to check all sheets at once for duplicates.

### 3. `UserGroups`

This sheet allows you to create your own reusable groups of people (e.g., "Marketing Team").

*   **`GroupName` (Column A):** A friendly name for your group.
*   **`Delete` (Column F):** Check this to request deletion of the group.
*   For each `GroupName` you define, a sheet named `GroupName_G` is created. You list the members of that group in that sheet.
*   You can then use the `GroupEmail` (from Column B) in any of your other user sheets to grant access to everyone in that group at once.

### 4. `SheetEditors`

This sheet controls who is a **Sheet Editor** for this spreadsheet. Add the email addresses of anyone who should have permission to edit this control panel.

**Adding Viewers:** If you want to grant someone **view-only** access to this spreadsheet, use the standard Google Sheets "Share" button.

---

## Common Workflows

**Note:** After you make these changes, a **Super Admin must run a sync** from the "Permissions Manager" menu for them to take effect. You will see the results of the sync in the `Log` sheet and the `Last Synced` and `Status` columns.

### How to Grant a Team Access to a New Folder

1.  **Go to the `UserGroups` sheet.** Create your team by adding a `GroupName` (e.g., "Sales Team").
2.  **Go to the `ManagedFolders` sheet.** Add a `FolderName` (e.g., "Q4 Sales Reports") and select a `Role`.
3.  Wait for the Super Admin to run a sync. The script will create the necessary sheets (`Sales Team_G` and `Q4 Sales Reports_Editor`).
4.  **Go to the `Sales Team_G` sheet.** Add the email addresses of your team members.
5.  **Go to the `Q4 Sales Reports_Editor` sheet.** Add the group's email address (e.g., `sales-team@your-domain.com`, which you can copy from the `UserGroups` sheet).
6.  Wait for the next sync. The Sales Team will now have access to the folder.

### How to Add a User

1.  Find the correct user sheet for the folder and role.
2.  Add their email address to a new row in Column A.
3.  Wait for the next sync.

### How to Remove a User

1.  Find the correct user sheet.
2.  Delete the row containing their email address.
3.  Wait for the next sync.

---

## Understanding Logs

The `Log`, `TestLog`, and `FoldersAuditLog` sheets contain detailed, timestamped records of all actions. You can look at these sheets to see when syncs happened, what changes were made, and if any errors occurred.

---

## Working with Non-ASCII Characters

The system fully supports non-ASCII characters (e.g., Hebrew, Chinese) in folder and group names. However, **Google Group email addresses must use only ASCII characters** (a-z, 0-9, hyphens).

When you create a group or folder with a non-ASCII name, you **must manually specify an ASCII group email** in the `GroupEmail` column.

*   In `UserGroups`, specify the email in **Column B**.
*   In `ManagedFolders`, specify the email in **Column E**.

If you forget, the `Status` column will show a clear error message after a sync attempt, telling you exactly what to do.

---

## Troubleshooting & FAQ

### I added a user, but they didn't get an email notification. Why?

This is normal. The "Folder shared with you" email from Google is only sent the very first time a folder is shared with the managed Google Group. When you add a new user to an *existing* group, they get access immediately after the sync, but Google does not send them a new notification email. The user might get an email saying "You have been added to group X", but not one about the folder itself.

### How do I share a new document with everyone who already has access to a managed folder?

Each managed folder is shared through a Google Group (the `GroupEmail` shown on the `ManagedFolders` tab). To make a document available to the same audience:

- **Recommended (copy/move):** Create the file in the managed folder or move a copy there. The folder’s group permission applies automatically.
- **Only when you know the group email:** If the file must stay elsewhere, share the file with that group's email address. You can find the group's email in the `GroupEmail` column of the `ManagedFolders` sheet.

