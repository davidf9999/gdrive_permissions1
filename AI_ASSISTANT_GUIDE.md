# AI Assistant Setup Guide

Welcome! This guide is a checklist for you to follow along with the AI assistant as it helps you set up the `gdrive-permissions` project. The assistant will drive the process, but you can use this document to track your progress and understand the overall flow.

All steps will be initiated by the assistant in your terminal. Your main job is to follow its lead, perform actions in your web browser when asked, and report back.

---

### Phase 1: Google Workspace & Domain Setup

This phase is entirely manual. The assistant cannot do this for you.

-   [ ] **Your Action:** The assistant will provide a link to the `docs/WORKSPACE_SETUP.md` guide.
-   [ ] **Your Action:** Follow that guide in your web browser to:
    -   Create or sign into a Google Workspace tenant.
    -   Create or designate a **Super Admin** user account.
    -   Keep the Super Admin username and password ready.
-   [ ] **Your Action:** Inform the assistant when this phase is complete.

---

### Phase 2: Authenticate Your Environment

The assistant needs to connect your Codespace environment to your new Google Account.

-   [ ] **Assistant's Action:** The assistant will provide you with a command to run in your terminal. It will look something like `source ... && gcloud auth login --no-launch-browser`.
-   [ ] **Your Action:** Copy the full command and run it in your terminal.
-   [ ] **Your Action:** A long URL will be printed. Copy the URL and paste it into your browser.
    > **Note:** If the URL is hard to copy because it wraps across multiple lines, tell the assistant. It can help by saving the URL to a file.
-   [ ] **Your Action:** In your browser, log in with your **Super Admin** account and grant the permissions.
-   [ ] **Your Action:** Copy the verification code from the browser and paste it back into the terminal when prompted.
-   [ ] **Your Action:** Inform the assistant when you are successfully logged in.

---

### Phase 3: System & Prerequisite Validation

-   [ ] **Assistant's Action:** The assistant will report that this phase is already complete, as all tools were pre-installed in the Codespace environment. No action is needed from you.

---

### Phase 4: Create the Control Spreadsheet

You need a Google Sheet to manage permissions. The assistant needs its unique ID to deploy the code.

-   [ ] **Your Action:** In your browser, while logged in as the Super Admin, create a new Google Sheet.
-   [ ] **Your Action:** In the sheet, go to **Extensions → Apps Script**.
-   [ ] **Your Action:** In the Apps Script editor, go to **Project Settings (⚙️)**.
-   [ ] **Your Action:** Copy the **Script ID**.
-   [ ] **Your Action:** Paste the Script ID into the chat when the assistant asks for it.

---

### Phase 5: Deploy the Apps Script Project

The assistant will now automate the code deployment.

-   [ ] **Assistant's Action:** The assistant will create a `.clasp.json` file for you.
-   [ ] **Assistant's Action:** The assistant will run the `clasp push` command to send the code to your Apps Script project.
-   [ ] **Your Action:** Wait for the assistant to confirm the deployment was successful. After this, a "Permissions Manager" menu should appear in your spreadsheet.

---

### Phase 6: Enable APIs and Configure Consent

The script needs permission to manage Groups and Drive folders.

-   [ ] **Assistant's Action:** The assistant will guide you through the process of linking your Apps Script project to a Google Cloud project.
-   [ ] **Assistant's Action:** The assistant will run commands to enable the necessary APIs (`Admin SDK`, `Drive API`).
-   [ ] **Your Action:** The assistant will then instruct you on how to configure the **OAuth Consent Screen** in your browser. This typically involves setting the app as "Internal" and adding your Super Admin as a test user.

---

### Phase 7: Run the First Sync

This is the final step to initialize the system.

-   [ ] **Assistant's Action:** The assistant will instruct you to run the first sync from the **Permissions Manager → ManualSync → Full Sync** menu in your Google Sheet.
-   [ ] **Your Action:** Run the function from the menu.
-   [ ] **Your Action:** Your browser will show one or more pop-ups asking for permission. Grant the permissions.
-   [ ] **Your Action:** The script will run and create several new sheets (like `ManagedFolders`, `UserGroups`, etc.). Report the status back to the assistant.

Congratulations! Your `gdrive-permissions` instance is now set up.