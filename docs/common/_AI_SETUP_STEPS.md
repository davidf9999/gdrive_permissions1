### If `currentState` is `WORKSPACE_TENANT_CREATED`:
-   **ACTION:**
    1.  Tell the installer this is a manual step.
    2.  Explain that you are now opening the `SETUP_GUIDE.md` file for their reference, which contains the detailed instructions.
    3.  Use `run_shell_command` to execute `code docs/SETUP_GUIDE.md`.
    4.  Instruct them to follow **Step 1: Create or reuse a Google Workspace tenant** in the guide.
    5.  Remind them that Google may require phone verification for the new Super Admin account.
    6.  Ask them to confirm once this is complete.
-   **VERIFICATION:**
    1.  When the installer confirms, transition to `SUPER_ADMIN_PREPARED`.

### If `currentState` is `SUPER_ADMIN_PREPARED`:
-   **ACTION:**
    1.  Tell the installer this is a manual step.
    2.  Explain that you are opening the `SETUP_GUIDE.md` file again for their reference.
    3.  Use `run_shell_command` to execute `code docs/SETUP_GUIDE.md`.
    4.  Instruct them to follow **Step 2: Prepare the Super Admin account** in the guide.
    5.  Ask them to confirm once this is complete.
-   **VERIFICATION:**
    1.  When the installer confirms, transition to `SUPER_ADMIN_EMAIL_PROVIDED`.

### If `currentState` is `SUPER_ADMIN_EMAIL_PROVIDED`:
-   **ACTION:**
    1.  Check if your internal `superAdminEmail` variable is already set (from loading the state file).
    2.  If it is, ask the installer: "I have your Super Admin email as `<superAdminEmail>`. Is this correct? (yes/no)".
        -   If they say "yes", proceed to VERIFICATION.
        -   If they say "no", ask them: "Please enter the correct Google Workspace Super Admin email address."
    3.  If `superAdminEmail` is not set, ask the installer: "Please enter your Google Workspace Super Admin email address."
    4.  Once you receive the email address, store it in your `superAdminEmail` context variable.
    5.  Use `write_file` to save the email to `.gemini/assistant_state.json`. The content should be a JSON object: `{"SUPER_ADMIN_EMAIL": "<the_email>"}`.
-   **VERIFICATION:**
    1.  Confirm that your `superAdminEmail` variable is not empty.
    2.  Transition to `CONTROL_SPREADSHEET_CREATED`.

### If `currentState` is `CONTROL_SPREADSHEET_CREATED`:
-   **ACTION:**
    1.  Tell the installer this is a manual step.
    2.  Use your `run_shell_command` tool to execute `code docs/SETUP_GUIDE.md`.
    3.  Instruct them to follow **Step 3: Create the control spreadsheet** in the guide.
    4.  Ask them to confirm once this is complete.
-   **VERIFICATION:**
    1.  When the installer confirms, transition to `GCLOUD_CLI_CONFIGURED`.

### If `currentState` is `GCLOUD_CLI_CONFIGURED`:
-   **ACTION:**
    1.  Tell the installer that this step involves both automated and manual actions, and you will be using `SETUP_GUIDE.md` as a reference.
    2.  Use `run_shell_command` to execute `code docs/SETUP_GUIDE.md`.
    3.  Instruct them to get ready to follow the parts of **Step 4: Authenticate the Google Cloud CLI (gcloud)** that require manual browser interaction.
-   **Sub-steps:**
    1.  **Verify `gcloud` installation (Automated):** Run `gcloud --version`. If it fails, stop and instruct the user to install the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install).
    2.  **Authenticate the CLI (Manual):**
        -   Explain this part is manual.
        -   Provide these instructions:
            1. In your terminal, run the command: `gcloud auth login`
            2. Your browser will open. You **must** sign in as the Google Workspace Super Admin (**`<superAdminEmail>`**).
        -   Ask the installer to confirm once they have logged in.
    3.  **Set GCP Project (Automated):** Ask for their GCP Project ID and run `gcloud config set project <PROJECT_ID>`.
-   **VERIFICATION:**
    1.  Run `gcloud auth list` and `gcloud config get-value project`.
    2.  If both succeed, transition to `APIS_ENABLED_AND_CONSENT_GRANTED`.

### If `currentState` is `APIS_ENABLED_AND_CONSENT_GRANTED`:
-   **ACTION:**
    1.  Tell the installer this step involves both automated and manual actions, referencing `SETUP_GUIDE.md`.
    2.  Use `run_shell_command` to execute `code docs/SETUP_GUIDE.md`.
    3.  Instruct them to get ready to follow the parts of **Step 5: Enable APIs and grant consent** that require manual browser interaction.
-   **Sub-steps:**
    1.  **Enable Project-Level APIs (Automated):**
        - Explain you will now enable the required APIs for their GCP project.
        - Run the `gcloud services enable` commands for `admin.googleapis.com`, `drive.googleapis.com`, and `script.googleapis.com`.
    2.  **Enable User-Level API (Manual):**
        - Instruct them to visit `script.google.com/home/usersettings` and enable the "Google Apps Script API".
    3.  **Configure OAuth Consent Screen (Manual):**
        - Instruct them to follow the guide to configure the OAuth consent screen if they haven't already.
-   **VERIFICATION:**
    1.  When the installer confirms completion, transition to `SCRIPT_DEPLOYED`.

### If `currentState` is `SCRIPT_DEPLOYED`:
-   **ACTION:**
    1.  Tell the installer this is a manual copy-and-paste step.
    2.  Use `run_shell_command` to execute `code docs/SETUP_GUIDE.md`.
    3.  Instruct them to follow **Step 6: Deploy the Apps Script project** in the guide. This involves running `npm install`, `node create_apps_scripts_bundle.js`, and pasting the result into the Apps Script Editor.
    4.  Ask them to confirm once this is complete.
-   **VERIFICATION:**
    1.  When the installer confirms, transition to `FIRST_SYNC_COMPLETE`.

### If `currentState` is `FIRST_SYNC_COMPLETE`:
-   **ACTION:**
    1.  Tell the installer this is the final manual step.
    2.  Use `run_shell_command` to execute `code docs/SETUP_GUIDE.md`.
    3.  Instruct them to follow **Step 7: Run the first sync** in the guide, which involves running the "Full Sync" from the spreadsheet menu and granting permissions.
    4.  Ask them to confirm once the sync is complete.
-   **VERIFICATION:**
    1.  When the installer confirms, transition to `DONE`.

### If `currentState` is `DONE`:
- **ACTION:**
    1. Print a congratulatory message: "Congratulations! The setup is complete. You can now manage your Google Drive permissions using the control spreadsheet."
    2. Explain that for day-to-day operations, they should refer to the `docs/USER_GUIDE.md`.
- **VERIFICATION:**
    1. The process is finished.
