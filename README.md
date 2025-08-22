# Google Drive Permission Manager

This repository contains a complete, automated solution for managing access to a large number of Google Drive folders for many users. It uses Google Groups, controlled by a central Google Sheet, to provide a scalable and auditable permissions system.

It is designed to be set up from scratch by any user with a Google Workspace account, using a containerized setup wizard that provisions all necessary cloud infrastructure automatically.

---

## The Problem: Managing Drive Access at Scale

Google Drive is a powerful collaboration tool, but managing permissions directly on folders becomes difficult and error-prone as your organization grows:

*   **Insecure Public Sharing:** The simplest way to share is with "anyone with the link." However, for sensitive or confidential data, this is not a secure option as the link can be forwarded or shared publicly, granting access to anyone.
*   **Direct Sharing Limits:** For secure, direct sharing, a single Google Drive file or folder can only be shared with a maximum of 100 users or groups who can have editor/viewer/commenter access. For larger teams, this limit is quickly reached.
*   **Lack of Centralization:** When permissions are managed on a folder-by-folder basis, there is no central place to see "who has access to what." This makes auditing and management difficult.
*   **Manual Workload:** Manually adding and removing individual users from many different folders is time-consuming and prone to human error.

## The Solution: Google Groups and Automation

This project solves these problems by using **Google Groups** as the access control mechanism. Instead of sharing a folder with 100 individual users, you share it with a single Google Group. You can then add hundreds (or thousands) of members to that group.

This solution automates the entire lifecycle of this approach:

1.  You define which folders to manage in a central Google Sheet.
2.  The script automatically creates dedicated Google Groups for different roles (e.g., `project-x-editors@your-domain.com`).
3.  You manage the membership of these groups simply by adding or removing emails from other sheets.
4.  The script runs automatically to sync the group memberships, effectively granting or revoking access to the Drive folders.

### Why is a Google Workspace Account Required?

While Google Groups can be used with free `@gmail.com` accounts, the **automation** of group management is a feature exclusive to **Google Workspace**.

*   **The Admin SDK API:** To create groups, add members, and remove members programmatically, this script needs to use the Google Admin SDK API.
*   **Workspace-Only Access:** Access to the Admin SDK API is only granted to users who are part of a Google Workspace domain. It is not available for standard Gmail accounts.

Therefore, a (paid) Google Workspace account is a fundamental requirement to enable the automation that makes this solution powerful.

**Important Clarification:** Only **one** Google Workspace account is needed—the account used by the administrator to run the setup wizard and own the project. The end-users who are granted access to the folders can have **any type of Google account**, including free, personal `@gmail.com` accounts.

---

## Getting Started

This project includes a complete, automated setup wizard that runs inside a Docker container. It will guide you through creating and configuring all the necessary Google Cloud and Apps Script resources.

To begin, please follow the step-by-step guide here: **[docs/ONBOARDING.md](./docs/ONBOARDING.md)**

---

## Developer & Testing Features

### Manual Access Test

The "Permissions Manager" menu in the Google Sheet includes a "Run Manual Access Test" item. This provides a guided, step-by-step wizard to test the end-to-end process of granting and revoking access for a single user to a new test folder. This is useful for verifying that the core logic is working correctly after setup.

### Stress Test

The menu also includes a "Run Stress Test" item. This is a powerful tool for developers or administrators to test the performance and scalability of the script in their environment. It will:

1.  Prompt for the number of folders and users per folder to create.
2.  Generate a large volume of test data (folders, groups, user sheets, and user email entries).
3.  Run the `syncAll` function and time its execution.
4.  Provide an option to automatically clean up all the generated test data.

This is useful for identifying potential bottlenecks and understanding how the script will perform under a heavy load.

### Test Data Cleanup

If a test is interrupted, it may leave behind test folders, groups, and sheets. The "Permissions Manager" -> "Testing" menu provides tools to clean up this data:

*   **Cleanup Manual Test Data:** This option will prompt you for the name of the folder used in a manual access test. It will then find the corresponding entry in the `ManagedFolders` sheet and remove the associated folder, group, and user sheet.
*   **Cleanup Stress Test Data:** This option will automatically find and delete all folders, groups, and sheets that were created by the stress test, by identifying them with the "StressTestFolder_" prefix.

---

## Logging

The script now includes a comprehensive logging system to track its operations.

*   **Log Sheet:** A new sheet named "Log" will be automatically created in your spreadsheet. It will contain a timestamped record of all the main operations performed by the script, such as syncing folders, creating groups, and updating permissions.
*   **Test Log Sheet:** A separate sheet named "TestLog" will be created to store logs from the testing and cleanup functions. This keeps the main log clean and allows you to easily discard test-related logs.
*   **Clear Logs:** You can clear all the logs in both the "Log" and "TestLog" sheets by using the "Permissions Manager" -> "Logging" -> "Clear All Logs" menu item.

---

## User Groups

You can now define and manage your own user groups directly within the spreadsheet. This allows you to create logical groupings of users (e.g., "Marketing Team", "Developers") and then grant them access to folders as a single unit.

*   **UserGroups Sheet:** A new sheet named "UserGroups" will be automatically created. This sheet has two columns: "GroupName" and "GroupEmail". You can define your user groups in this sheet.
*   **User Group Sheets:** For each group you define in the "UserGroups" sheet, a corresponding sheet named after the "GroupName" will be automatically created by the "Sync User Groups" function if it doesn't already exist. In this sheet, you can list the email addresses of the members of that group.
*   **Sync User Groups:** The "Permissions Manager" menu now includes a "Sync User Groups" option. This will create the Google Groups for your user groups and sync their memberships from the corresponding sheets.
*   **Using User Groups:** Once you have synced your user groups, you can use the group's email address in any of the folder-role sheets to grant access to all the members of that group.

---

## Configuration

A new "Config" sheet is now available for configuring advanced settings.

*   **Email Error Notifications:** You can enable or disable email notifications for fatal errors by setting the "EnableEmailNotifications" value to TRUE or FALSE. You can also specify the email address to which the notifications will be sent in the "NotificationEmailAddress" field.