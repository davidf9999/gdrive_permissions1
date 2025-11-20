# Testing Guide

This project uses a two-pronged approach to testing to ensure both the correctness of the code's logic and its proper functioning in a live Google environment. This guide covers both testing strategies.

---

## Automated Unit Testing (with Jest)

*   **Environment:** Runs locally on your computer (or in a CI/CD pipeline).
*   **Goal:** To verify the **correctness of individual functions** in isolation.

These are fast, automated tests that check small, specific pieces of logic. For example, a unit test might verify that the `generateGroupEmail_` function correctly formats a string, or that the audit logic correctly identifies a missing user in a list.

Because they don't use live Google services (they use mock data), they can run in seconds and are ideal for running frequently during development to prevent bugs and regressions. They are the foundation of the project's CI/CD pipeline.

### How to Run the Tests

1.  **Install Dependencies:** If you haven't already, install the necessary development dependencies by running:
    ```bash
    npm install
    ```
2.  **Run the Tests:** Execute the test suite by running:
    ```bash
    npm test
    ```
    Jest will discover and run all test files (ending in `.test.js`) located in the `tests/` directory.

### Optional: Real Email Capability Test

If you want to verify that your SMTP credentials can deliver a real email, an optional integration test is available. It is excluded from the default `npm test` run so that CI pipelines are not blocked by external network calls.

1.  Provide the following environment variables (for example in a one-off command line invocation):
    *   `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` (`true`/`false`), `SMTP_USER`, `SMTP_PASS`
    *   `EMAIL_FROM`, `EMAIL_TO`
2.  Run the email test command:
    ```bash
    npm run test:email
    ```
    The script sets `RUN_EMAIL_TEST=1` and runs Jest against `tests/manual/EmailCapability.test.js`, which sends a short test email using `nodemailer`.

If the environment variables are missing, the test is skipped automatically.

### Optional: Email Capability Test from Google Spreadsheets

To trigger a live email using the Apps Script runtime (no local tooling required), run the menu action:

*   **Menu:** `Permissions Manager > Testing > Run Email Capability Test`
*   **Purpose:** Confirms that the spreadsheet can send outbound notification email via `MailApp.sendEmail` using the configured `NotificationEmail` (or an address you enter on the prompt).
*   **Process:**
    1.  You will be asked which email address should receive the message. Leave the prompt blank to use the `NotificationEmail` value from the `Config` sheet (or your account email if that cell is empty).
    2.  The script sends an email with the subject `Email Capability Test` and logs the outcome to the `TestLog` sheet.
    3.  Verify that the email arrives in the recipient's inbox.

### How it Works: Mocking Apps Script Services

A major challenge of testing Apps Script code locally is that the global Google services (e.g., `SpreadsheetApp`, `DriveApp`, `Session`) are not available.

To solve this, the test environment uses **mocks**. The `tests/setup.js` file creates simple, fake versions of these global services. When Jest runs, it uses these fake objects instead of the real ones. This allows us to test the logic of our functions without needing to connect to live Google services.

For example, the mock for `Session` is configured to return a fake user email, allowing us to test functions that rely on `Session.getActiveUser().getEmail()` without needing a real user to be logged in.

### How to Write a New Test

1.  Create a new file in the `tests/` directory with the `.test.js` suffix (e.g., `tests/Core.test.js`).
2.  At the top of your test file, you will need to load the `.gs` file containing the function you want to test. Since Apps Script files are not standard JavaScript modules, you must load them manually. The current pattern is to use Jest's `setupFiles` configuration in `jest.config.js` to load the necessary scripts into the global scope before tests run.
3.  Write your test cases using Jest's `describe`, `it`, and `expect` functions.
4.  If your function uses a global Apps Script service, you can rely on the default mocks in `tests/setup.js` or override them for a specific test if needed.

---

## Manual & End-to-End Testing (from Google Spreadsheets)

*   **Environment:** Runs inside the Google Apps Script editor.
*   **Goal:** To verify the **entire end-to-end workflow** and its integration with live Google services.

These tests are run from the **Permissions Manager > Testing** menu inside your Google Spreadsheet. They are designed to confirm that all the pieces of the system (the spreadsheet, the script, Google Drive, and Google Groups) are working together correctly in your specific Google Workspace environment.

Because they create real folders and groups, they are much slower than unit tests. They are perfect for:
*   Verifying your initial setup and API permissions.
*   Performing a full system health check.
*   Troubleshooting complex, environment-specific issues.

### Verifying the AutoSync Trigger

The following steps provide a gradual plan to safely verify that the scheduled, automatic sync is working correctly.

**Phase 1: Admin Verification (Default Safe Mode)**

The system is designed to be safe by default. The automatic sync will only process additions; it will not automatically remove users. Deletions require manual approval.

1.  **Enable and Verify the Trigger**:
    *   In your spreadsheet, go to **Permissions Manager → AutoSync → ⚡ Setup AutoSync (Every 5 Minutes)**.
    *   The first time you run this, it's normal to see a `"No AutoSync triggers were found."` message, followed by an `"AutoSync Enabled"` confirmation.
    *   Verify it's active by going to **Permissions Manager → AutoSync → 📊 View Trigger Status**.

2.  **Perform an "Add" Test**:
    *   Add a **test user's email** to one of the permission sheets (e.g., a sheet named `MyFolder_Viewers_G`).
    *   Wait for the next 5-minute sync (the trigger runs roughly every five minutes).
    *   **Verification**: Check the **`Log`** sheet to confirm the sync ran. Then, check the **`Status`** column in the **`ManagedFolders`** sheet for the corresponding folder row. It should update to `OK`. Finally, verify the test user was actually added to the correct Google Group or given direct folder access.

3.  **Perform a "Deletion Detection" Test**:
    *   Now, remove the same **test user** from the permission sheet.
    *   Wait for the next 5-minute sync.
    *   **Verification**:
        *   The user will **NOT** be removed from the Google Group. This is the expected safe behavior.
        *   Check your email. You should receive a **"MANUAL ACTION REQUIRED"** notification listing the pending deletion.
        *   To complete the deletion, you must manually run **Permissions Manager → Sync Deletes**.

**Phase 2: Standard User Verification**

This simulates the experience for a non-technical user.

1.  **Share the Spreadsheet**:
    *   Share the main Google Spreadsheet with a non-admin user (a regular Gmail account is perfect) and give them **Editor** access to the spreadsheet itself.

2.  **Instruct the User**:
    *   Ask the non-admin user to add a new test user's email to a permission sheet.
    *   Crucially, tell them **not to click any menu items**; they should only edit the cell.

3.  **Wait and Verify**:
    *   After the next 5-minute sync, you (the admin) can verify that the new user was added to the correct Google Group.
    *   The non-admin user will see the **`Status`** column in the `ManagedFolders` sheet update, confirming their change was processed automatically without any manual action on their part.

## Viewing Test Logs

All test operations are logged to the **TestLog** sheet. If a test fails or does not behave as expected, this sheet is the first place to look for detailed error messages.

If you have enabled the [Advanced Logging with Google Cloud](../README.md#advanced-logging-with-google-cloud), the test logs will also be sent there, providing a more robust and searchable view of the test execution.

## Running Tests

Prerequisites for tests that manage Google Groups:
- In Apps Script, add the Admin Directory API (advanced service).
- In Google Cloud, enable the Admin SDK for the linked project.
- You must be using a Google Workspace account with sufficient admin privileges.

If Admin SDK is not available (e.g., personal `@gmail.com` account), the tests will alert and abort, and sync flows will mark rows as `SKIPPED (No Admin SDK)`.

The testing functions are available in the **Permissions Manager > Testing** menu.

**Important:** When running tests that require user interaction (like the Manual Access Test), it is highly recommended to have two instances of the Google Spreadsheet open in separate browser windows or tabs. Use one window to run the test from the menu, and the other to view the changes the script is making to the sheets. This is because the modal dialog boxes used by the script can interrupt the execution flow if you interact with the spreadsheet in the same window.

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

This test allows you to verify the permission system using your own existing folder structure and user groups. This is useful for confirming that the permissions managed by the spreadsheet align with the actual access in Google Drive.

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
3.  **Test Permissions:** You should see a "You need permission" or "Access Denied" page. You should not be able to see the spreadsheet's name (unless you had prior access) or its contents.

By running these manual tests, you can be confident that the permissions you have defined in the Google Spreadsheet are being correctly applied and enforced by Google Drive.

## Enabling Progress Messages (Toasts)

By default, the on-screen progress messages (toasts) are disabled to improve performance. To enable them for debugging or testing, follow these steps:

1.  Go to the **Config** sheet in your spreadsheet.
2.  Find the setting named **EnableToasts**.
3.  Change the value from `FALSE` to `TRUE`.

The script will now display toast messages during synchronization, which can be helpful for monitoring its progress.