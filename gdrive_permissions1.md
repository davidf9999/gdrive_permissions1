# gdrive_permissions1 Project Overview

This document provides a high-level overview of the `gdrive_permissions1` project for context and architectural understanding.

## Core Purpose

The project is a Google Apps Script application designed to manage permissions for a large number of Google Drive folders through a Google Sheet interface. It solves the scalability and management issues of sharing folders with many users by leveraging Google Groups.

## Architecture

The system is composed of:

1.  **Google Sheet Interface**: A central Google Sheet acts as the control panel. It contains several configuration sheets:
    *   `ManagedFolders`: Defines the Drive folders to be managed and the permission roles (`Editor`, `Viewer`, etc.).
    *   `UserGroups`: Allows the creation of reusable collections of users.
    *   **User Sheets**: For each managed folder/role and user group, a dedicated sheet is created where administrators can list the email addresses of users.
    *   `Admins`: A list of users who have editor access to the spreadsheet itself.
    *   `Config`: For advanced settings like logging.

2.  **Google Apps Script (`Code.js`)**: This is the core logic of the application. It is embedded in the Google Sheet and provides the following key functionalities:
    *   **Menu Items**: A custom "Permissions Manager" menu in the Google Sheet UI to trigger synchronization tasks.
    *   **Synchronization Logic**:
        *   `Sync Adds`: A non-destructive sync that only adds new permissions. It creates folders and groups if they don't exist, and adds new members to groups based on the user sheets.
        *   `Sync Deletes`: A destructive sync that only removes permissions. It removes members from groups if they are no longer listed in the user sheets. It requires user confirmation before proceeding.
        *   `Full Sync (Add & Delete)`: The original sync behavior that performs both additions and deletions.
    *   **API Integration**: The script uses Google's `AdminDirectory` and `DriveApp` services to interact with Google Groups and Google Drive.

3.  **Google Groups**: For each folder-role combination defined in `ManagedFolders`, a corresponding Google Group is created. Folder permissions are granted to the group, not to individual users. Access is then managed by adding or removing users from this group.

## Workflow

1.  An administrator defines a folder and a role in the `ManagedFolders` sheet.
2.  They run `Sync Adds`. The script creates the folder (if needed), the corresponding Google Group, and a user sheet.
3.  The administrator adds user emails to the newly created user sheet.
4.  They run `Sync Adds` again. The script adds the users to the Google Group, granting them access to the folder.
5.  To revoke access, the administrator either removes a user's email from the sheet or marks the `Disabled` column for that user and runs `Sync Deletes`.

This architecture provides a scalable, auditable, and user-friendly way to manage complex Google Drive permissions.
