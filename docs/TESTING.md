# Testing Guide

This document provides instructions for using the testing functions built into the Google Drive Permission Manager script.

## Viewing Test Logs

All test operations are logged to the **TestLog** sheet. If a test fails or does not behave as expected, this sheet is the first place to look for detailed error messages.

If you have enabled the [Advanced Logging with Google Cloud](../../README.md#advanced-logging-with-google-cloud), the test logs will also be sent there, providing a more robust and searchable view of the test execution.

## Running Tests

The testing functions are available in the **Permissions Manager > Testing** menu.

**Important:** When running tests that require user interaction (like the Manual Access Test), it is highly recommended to have two instances of the Google Sheet open in separate browser windows or tabs. Use one window to run the test from the menu, and the other to view the changes the script is making to the sheets. This is because the modal dialog boxes used by the script can interrupt the execution flow if you interact with the sheet in the same window.

### Manual Access Test

*   **Menu:** `Permissions Manager > Testing > Run Manual Access Test`
*   **Purpose:** This test provides a step-by-step walkthrough of the entire permission-granting and revoking process for a single user and a single folder. It is useful for verifying that the core functionality of the script is working correctly in your environment.
*   **Process:**
    1.  The script will prompt you to enter a name for a new test folder.
    2.  It will then ask for a role to test (e.g., `Editor`).
    3.  You will be asked to provide a real email address you can access for testing (e.g., a personal Gmail account).
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

## Manual Testing with Existing Resources

This test allows you to verify the permission system using your own existing folder structure and user groups. This is useful for confirming that the permissions managed by the sheet align with the actual access in Google Drive.

### Prerequisites

1.  **An Existing Managed Folder:** Choose a folder in Google Drive that is already listed in your `ManagedFolders` sheet.
2.  **Defined User Groups:** This folder should have corresponding user sheets (e.g., `MyFolder_Editor`, `MyFolder_Viewer`).
3.  **Test Users:** You will need access to several Google accounts to perform the verification:
    *   An account whose email is listed in the `_Editor` sheet for the folder.
    *   An account whose email is listed in the `_Viewer` sheet for the folder.
    *   An account that is **not** listed in any sheet for the folder (and is not a member of any group that has access).

### Test Scenarios

#### 1. Verify Editor Access

1.  **Log In:** Sign in to Google Drive with the account that should have **Editor** access.
2.  **Navigate to Folder:** Locate and open the managed folder. You should be able to see its contents.
3.  **Test Permissions:**
    *   **Create:** Create a new Google Doc or Sheet inside the folder. This should succeed.
    *   **Edit:** Open a file and make a change. This should succeed.
    *   **Delete:** Delete the file you just created. This should succeed.
4.  **Cleanup:** If you don't want to keep the test file, ensure it's deleted from the folder's trash.

#### 2. Verify Viewer Access and Limitations

1.  **Log In:** Sign in to Google Drive with the account that should have **Viewer** access.
2.  **Navigate to Folder:** Locate and open the managed folder. You should be able to see its contents.
3.  **Test Permissions:**
    *   **View:** Open a file. You should be able to view its content but not edit it (the "Read-only" or "View only" mode should be active).
    *   **Attempt to Edit:** Try to type in a document. You should be denied.
    *   **Attempt to Create:** Try to create a new file in the folder. The option should be greyed out or you should receive a permissions error.
    *   **Attempt to Share:** Open a file and try to share it with another person. This should be blocked if the folder's settings prevent viewers from sharing.

#### 3. Verify No Access

1.  **Log In:** Sign in to Google Drive with the account that should have **no access**.
2.  **Attempt to Navigate:** Try to access the folder using a direct link.
3.  **Test Permissions:** You should see a "You need permission" or "Access Denied" page. You should not be able to see the folder's name (unless you had prior access) or its contents.

By running these manual tests, you can be confident that the permissions you have defined in the Google Sheet are being correctly applied and enforced by Google Drive.

## Enabling Progress Messages (Toasts)

By default, the on-screen progress messages (toasts) are disabled to improve performance. To enable them for debugging or testing, follow these steps:

1.  Go to the **Config** sheet in your spreadsheet.
2.  Find the setting named **EnableToasts**.
3.  Change the value from `FALSE` to `TRUE`.

The script will now display toast messages during synchronization, which can be helpful for monitoring its progress.
