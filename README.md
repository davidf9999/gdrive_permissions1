# Google Drive Permission Manager via Google Sheets

This project provides a powerful and flexible system for managing access to multiple Google Drive folders using Google Groups, all controlled from a single Google Sheet.

The system is designed to be self-maintaining, automatically creating necessary folders, groups, and user sheets, while also providing clear feedback and error reporting.

## Key Features

*   **Multi-Folder Management:** Control permissions for any number of Google Drive folders.
*   **Role-Based Access Control:** Manage different roles (Editor, Viewer, etc.) for each folder.
*   **Google Group Integration:** Leverages the efficiency of Google Groups for clean and scalable permission management.
*   **Automated Provisioning:**
    *   Automatically creates new Google Drive folders if they don't exist.
    *   Automatically generates corresponding Google Groups.
    *   Automatically creates dedicated sheets for managing user lists for each role.
*   **Centralized Control Panel:** A single `ManagedFolders` sheet acts as the main dashboard for the entire system.
*   **Intelligent UI:**
    *   Script-managed columns are color-coded (grey) and made read-only to prevent accidental manual edits.
    *   A `Status` column provides real-time feedback on all operations.
*   **Safe & Robust:**
    *   Uses a locking mechanism to prevent issues with multiple simultaneous users.
    *   Includes comprehensive error handling and status reporting.
    *   Detects and warns about "orphan" sheets that are not part of the configuration.
*   **Admin Control:** A dedicated `Admins` sheet controls who is allowed to edit the master spreadsheet itself.

## How It Works

The system is built around a Google Apps Script that orchestrates all operations based on the configuration you provide in a few key sheets within a single Google Spreadsheet.

### 1. The `Admins` Sheet

This sheet is the list of gatekeepers.

*   **Purpose:** To define who has permission to edit this Google Sheet workbook.
*   **Setup:** A single column containing the email addresses of authorized administrators.
*   **Logic:** A script runs regularly to enforce this list, adding and removing editors from the spreadsheet file to match it.

### 2. The `ManagedFolders` Sheet

This is the main control panel for the entire system. Each row represents a specific role for a specific folder that you want to manage.

| FolderName | FolderID | Role | UserSheetName (Auto) | GroupEmail (Auto) | Last Synced (Auto) | Status (Auto) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Project Docs** | | **Editor** | Project Docs_Editor | project-docs_editor@... | | |
| **Reports** | 123...abc | **Viewer** | Reports_Viewer | reports_viewer@... | | |

*   **User-Managed Columns:**
    *   `FolderName`: The human-readable name of the Drive folder. If the `FolderID` is blank, the script will create a new folder with this name.
    *   `FolderID`: The unique ID of the Drive folder. Can be left blank if you provide a `FolderName`.
    *   `Role`: The permission level you want to manage (e.g., "Editor", "Viewer").
*   **Script-Managed Columns (Read-Only & Grey):**
    *   `UserSheetName`: Automatically generated name for the sheet that will hold the user list (e.g., `Project Docs_Editor`).
    *   `GroupEmail`: Automatically generated email for the Google Group that will be created and managed. The domain is detected automatically.
    *   `Last Synced`: A timestamp indicating the last time the script successfully synced this row.
    *   `Status`: A message indicating the result of the last sync operation (e.g., "OK", "Folder Created", "Error: ...").

### 3. User List Sheets (e.g., `Project Docs_Editor`)

For each row in `ManagedFolders`, a corresponding sheet is used to list the members.

*   **Automatic Creation:** If this sheet doesn't exist, the script will create it automatically.
*   **Content:** A single column of user email addresses.
*   **Logic:** The script reads this list of emails and syncs the membership of the corresponding Google Group to match it exactly.

## Execution

*   **Manual Trigger:** The main sync process is initiated by a user from a custom menu within the spreadsheet (e.g., "Sync All Folders").
*   **Safety:** The script is designed to be run manually, giving you full control. It uses a locking service to prevent multiple users from running it at the same time.
