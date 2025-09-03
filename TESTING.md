# Testing Guide

This document provides instructions for using the testing functions built into the Google Drive Permission Manager script.

## Running Tests

The testing functions are available in the **Permissions Manager > Testing** menu.

**Important:** When running tests that require user interaction (like the Manual Access Test), it is highly recommended to have two instances of the Google Sheet open in separate browser windows or tabs. Use one window to run the test from the menu, and the other to view the changes the script is making to the sheets. This is because the modal dialog boxes used by the script can interrupt the execution flow if you interact with the sheet in the same window.

### Manual Access Test

*   **Menu:** `Permissions Manager > Testing > Run Manual Access Test`
*   **Purpose:** This test provides a step-by-step walkthrough of the entire permission-granting and revoking process for a single user and a single folder. It is useful for verifying that the core functionality of the script is working correctly in your environment.
*   **Process:**
    1.  The script will prompt you to enter a name for a new test folder.
    2.  It will then ask for a role to test (e.g., `Editor`).
    3.  You will be asked to provide a real email address that you can access for testing (e.g., a personal Gmail account).
    4.  The script will then automatically:
        *   Add the test folder to the `ManagedFolders` sheet.
        *   Run a sync to create the folder, the corresponding Google Group, and the user sheet.
        *   Add the test email to the new user sheet.
        *   Run another sync to grant the user access to the folder.
    5.  You will be prompted to verify that the user has gained access.
    6.  The script will then remove the user's email and run a final sync to revoke access.
    7.  You will be prompted to verify that the user's access has been revoked.
    8.  Finally, you will be given the option to clean up all the test data that was created.

### Stress Test

*   **Menu:** `Permissions Manager > Testing > Run Stress Test`
*   **Purpose:** This test is designed to evaluate the script's performance and reliability when dealing with a large number of folders and users. It is useful for identifying potential bottlenecks or API rate limit issues.
*   **Process:**
    1.  The script will prompt you for the number of temporary folders to create.
    2.  It will then ask for the number of test users to create for *each* folder.
    3.  You will provide a base email address, which will be used to generate unique test user emails.
    4.  The script will then create all the necessary test data and run a full sync, measuring the time it takes to complete.
    5.  At the end of the test, you will be given the option to clean up all the test data.

## Cleanup Functions

If you need to manually clean up test data, you can use the following functions from the `Permissions Manager > Testing` menu:

*   **Cleanup Manual Test Data:** This will prompt you for the name of a manual test folder and then delete the corresponding folder, group, and sheet.
*   **Cleanup Stress Test Data:** This will automatically find and delete all folders, groups, and sheets that were created by the stress test (identified by the `StressTestFolder_` prefix).

## Enabling Progress Messages (Toasts)

By default, the on-screen progress messages (toasts) are disabled to improve performance. To enable them for debugging or testing, follow these steps:

1.  Go to the **Config** sheet in your spreadsheet.
2.  Find the setting named **EnableToasts**.
3.  Change the value from `FALSE` to `TRUE`.

The script will now display toast messages during synchronization, which can be helpful for monitoring its progress.
