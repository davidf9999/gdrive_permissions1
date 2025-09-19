# Google Drive Permission Manager

> **Project Status: Beta**
>
> This project is currently in Beta. It is feature-complete and has been tested, but it is still under active development. Please use it with the understanding that there may be bugs or changes to the functionality. Feedback and contributions are welcome!

This repository contains a powerful solution for managing access to a large number of Google Drive folders using a central Google Sheet. It uses Google Groups to provide a scalable and auditable permissions system, all managed from a familiar spreadsheet interface.

The recommended setup uses the `clasp` command-line tool to deploy the script, which handles the multi-file project structure automatically. An optional, more advanced setup is available for production environments that require higher API quotas.

---

## Table of Contents

- [How it Works](#how-it-works)
- [Setup Guide (Recommended Manual Setup)](#setup-guide-recommended-manual-setup)
- [Usage Guide](#usage-guide)
- [Upgrading to a Production Environment](#upgrading-to-a-production-environment)
- [Tearing Down the Project](#tearing-down-the-project)
 - [Admin Directory Prerequisites](#admin-directory-prerequisites)
 - [First Run & Testing Notes](#first-run--testing-notes)

---

## The Solution: Google Groups and Automation

This project solves the problem of managing Drive access at scale by using **Google Groups** as the access control mechanism. Instead of sharing a folder with many individual users (which can hit Google Drive's sharing limits), you share it with a single Google Group. This allows you to manage hundreds (or even thousands) of members by simply adding or removing them from that group.

This solution automates the entire lifecycle of this approach:

1.  You define which folders to manage in a central Google Sheet.
2.  The script automatically creates dedicated Google Groups for different roles (e.g., `project-x-editors@your-domain.com`).
3.  You manage the membership of these groups simply by adding or removing emails from other sheets.
4.  The script runs automatically to sync the group memberships, effectively granting or revoking access to the Drive folders.

---

## Setup Guide

This guide will walk you through setting up the project for the first time. Because the script is now split into multiple files for better organization, the installation process uses a command-line tool called `clasp`.

### Step 1: Prerequisites

*   A **Google Workspace** account (a standard `@gmail.com` account is not sufficient).
*   You must be a **Super Admin** for your Google Workspace domain to have the necessary permissions.
*   **Node.js and npm:** You must have Node.js and npm installed on your computer. You can download them from [https://nodejs.org/](https://nodejs.org/).
*   **Clasp:** Install Google's command-line tool for Apps Script by running this command in your terminal:
    ```bash
    npm install -g @google/clasp
    ```

### Step 2: Create the Google Sheet & Apps Script Project

1.  **Create the Sheet:** Go to [Google Sheets](https://sheets.google.com) and create a new, blank spreadsheet. Give it a descriptive name (e.g., `Drive Permissions Control`).
2.  **Open the Script Editor:** In your new sheet, click on **Extensions > Apps Script**. This creates a new, empty Apps Script project that is bound to your sheet.
3.  **Get the Script ID:** In the Apps Script editor, click on **Project Settings** (the gear icon ⚙️). Copy the **Script ID** from the "IDs" section. You will need this in the next step.

### Step 3: Configure and Deploy the Script with `clasp`

1.  **Clone this Repository:** If you haven't already, clone this project repository to your local machine.
2.  **Log in to `clasp`:** In your terminal, run `clasp login` and follow the prompts to authorize it with your Google account.
3.  **Configure the Project:** In the root directory of this repository, create a file named `.clasp.json` and add the following content, pasting the Script ID you copied in the previous step:
    ```json
    {
      "scriptId": "YOUR_SCRIPT_ID_HERE",
      "rootDir": "apps_script_project"
    }
    ```
    The `rootDir` property is essential, as it tells `clasp` that our script files are located in the `apps_script_project` folder.
4.  **Fetch the Manifest:** Before you can push the code, you need the project's manifest file. Run the following command to pull it from the empty project you just created:
    ```bash
    clasp pull
    ```
    This will create an `appsscript.json` file inside the `apps_script_project` directory.
5.  **Deploy the Code:** Now, push all the local script files to your Apps Script project by running:
    ```bash
    clasp push
    ```
    This will upload all the `.js` and `.gs` files from the `apps_script_project` directory.

### Step 4: Enable Required APIs & Configure Consent

This is the most technical step, but it's a one-time setup. It involves enabling the correct API in Apps Script, creating a consent screen in Google Cloud, and then linking the two.

**Important:** This part is only possible with a **Google Workspace** account (e.g., `you@yourcompany.com`). It will not work with a personal `@gmail.com` account. You also need to be a **Super Admin** of your Workspace.

---

#### **Part A: Enable the Admin SDK API in Apps Script**

This makes the necessary services available to your script's code.

1.  **Select the Editor:** In the Apps Script interface, make sure you are in the **Editor** view by clicking the `<>` icon in the left-hand navigation panel.

2.  **Add a Service:** In the "Editor" pane where files like `Code.js` are listed, find the **Services** section. Click the **plus icon (+)** next to the "Services" title. A dialog box titled "Add a service" will appear.

3.  **Select the API:** Scroll through the list of available Google APIs until you find **Admin SDK API**. Click on it.

4.  **Confirm:** Click the blue **Add** button. The dialog will close, and you will now see `AdminDirectory` listed under the "Services" section. (Note: Selecting "Admin SDK API" is what adds the `AdminDirectory` service that the code uses.)

---

#### **Part B: Configure the OAuth Consent Screen in Google Cloud**

Before your script can ask for permissions, you must configure a consent screen. This tells Google what to show users when the script asks for authorization.

1.  **Go to Project Settings:** In the Apps Script editor, click on the **Project Settings** icon (a gear ⚙️) in the left-hand navigation panel.

2.  **Get Project Number:** In the "Google Cloud Platform (GCP) Project" section, a GCP project is associated with your script. It will have a Project ID and a Project Number. **Copy the Project Number.** (If you have previously linked other projects, ensure you are using the default project for this script).

3.  **Check for Existing Consent Screen:** Click the **Change Project** button, paste the copied Project Number into the text box, and click **Set Project**.
    *   **If it succeeds without error:** The consent screen is already configured. You can skip the rest of Part B and proceed directly to **Part C: Link the Project and Enable APIs**.
    *   **If you see an error:** You will see an error stating that the OAuth consent screen needs to be configured. This is expected if it's your first time. The error message should contain a blue link to "configure the consent screen". **Click that link to proceed to the next step.**

4.  **Configure Consent Screen (if required):** The link will take you to the Google Cloud Console.
    *   You may be asked to choose a **User Type** (Internal vs. External). Select **Internal** and click **Create**.
    *   **App name:** Enter a descriptive name, like `Drive Permissions Manager`.
    *   **User support email:** Select your email from the dropdown.
    *   **Developer contact information:** Enter your email address.
    *   Click **Save and Continue**.

5.  **Scopes & Test Users:**
    *   On the "Scopes" page, click **Save and Continue** to skip it.
    *   If your app is "External", you will be on the "Test users" page. Click **+ Add Users**, type in your own Google Workspace email address, and click **Add**.
    *   Click **Save and Continue** to finish.

---

#### **Part C: Link the Project and Enable APIs**

Now you can complete the connection.

1.  **Return to Apps Script:** Go back to the Apps Script browser tab.

2.  **Set the Project (for real this time):** Go to **Project Settings** > **Change Project** again. Paste the same Project Number in. This time, it will succeed.

3.  **Open Google Cloud Console:** The settings page will now show a blue, clickable link with your Project ID. Click this link to go to the Google Cloud Console.

4.  **Enable the Admin SDK API:** In the Google Cloud Console, use the top search bar to find and select **Admin SDK API**. On its page, click the blue **Enable** button. If it already says "Manage", you are all set.

5.  **Enable the Google Drive API:** While still in the Google Cloud Console, use the search bar again to find and select **Google Drive API**. Click the blue **Enable** button. This is required for the script to create and manage folders.

---

### Step 5: Run the Initial Sync

1.  Save the script project by clicking the **Save project** (disk icon 💾) at the top of the Apps Script editor.
2.  Go back to your Google Sheet tab and **refresh the page**.
3.  A new menu named **Permissions Manager** should appear in the Google Sheets menu bar.
4.  Click **Permissions Manager > Full Sync (Add & Delete)**.
5.  The first time you run this, Google will ask you to authorize the script. Follow the on-screen prompts to grant the necessary permissions.

Your setup is now complete! The script will have automatically created the necessary control sheets (`ManagedFolders`, `Admins`, etc.) for you.

---

## Usage Guide

For a detailed tutorial on how to use the spreadsheet, what each sheet and column means, and common workflows, please see the dedicated **[User Guide](./docs/USER_GUIDE.md)**.

---

## Dry Run Audit

This project includes a powerful, read-only audit feature to help you verify your permissions configuration.

*   **What it does:** The audit checks for discrepancies between your configuration in the sheets and the actual permissions in Google Drive and Google Groups. It does **not** make any changes.
*   **How to run it:** From the spreadsheet menu, select **Permissions Manager > Dry Run Audit**.
*   **How to read the results:** All findings are logged in the **`DryRunAuditLog`** sheet. If this sheet is empty after a run, it means no problems were found.

For a detailed explanation of the different issues the audit can find, please see the **[User Guide](./docs/USER_GUIDE.md)**.

---

## Upgrading to a Production Environment

If you find that your script is running into API quota limits or timing out, you can upgrade to a dedicated, billable Google Cloud project for higher performance.

This hybrid approach allows you to start simple and scale up later without losing any of your work.

### Step 1: Provision the GCP Infrastructure

At any time, you can run the automated provisioning tool. This is an **advanced** procedure.

1.  **Prerequisites:**
    *   **Google Cloud SDK (`gcloud`):** [Installation Guide](https://cloud.google.com/sdk/docs/install)
    *   **Docker and Docker Compose:** [Installation Guide](https://docs.docker.com/get-docker/)
    *   An active **Google Cloud Billing Account**.
2.  **Configure:** Copy `setup.conf.example` to `setup.conf` and fill in your details (GCP Billing ID, domain, etc.).
3.  **Authenticate:** Run `gcloud auth login` and `gcloud auth application-default login` from your terminal.
4.  **Run:** Execute `docker compose up --build` from the project root.

This command will create a new, dedicated GCP project and output its **Project Number**. Copy this number.

### Step 2: Link Your Script to the New Project

1.  Open your existing Apps Script project.
2.  Click the **Project Settings** (gear icon ⚙️) on the left.
3.  Under the **Google Cloud Platform (GCP) Project** section, click **Change Project**.
4.  Paste the **Project Number** you copied from the provisioning step and click **Set Project**.

Your script is now linked to the high-performance GCP project. You don't need to change anything else.

---

## Tearing Down the Project

### Manual Setup

To remove the project, simply delete the Google Sheet you created. You may also want to manually delete the Google Groups that were created by the script from the [Google Workspace Admin Console](https://admin.google.com).

### Production Environment

If you used the automated provisioning tool, a `teardown.sh` script is provided to delete all the Google Cloud resources.

1.  Make sure the `gcp_project_id` in your `setup.conf` file points to the project you want to delete.
2.  Run the script from your terminal: `./teardown.sh`

---

## Advanced Features

This project also includes features for testing and logging, which are explained in more detail in [User Guide](./docs/USER_GUIDE.md) and [Testing](./docs/TESTING.md).

### Advanced Logging with Google Cloud

In addition to logging to a sheet, the script can be configured to send logs directly to **Google Cloud Logging (GCL)**. This provides a much more powerful, searchable, and persistent logging solution, which is highly recommended for production environments.

**Benefits:**
*   **Centralized Logging:** View logs from all script executions in one place.
*   **Advanced Filtering:** Search and filter logs by severity (INFO, WARN, ERROR), time, or keyword.
*   **Log-based Metrics & Alerts:** Create alerts for specific errors (e.g., notify you when a "FATAL ERROR" occurs).
*   **Long-term Retention:** Store logs for extended periods, beyond the limits of a Google Sheet.

**How to Enable:**

1.  **Link to a GCP Project:** First, your Apps Script project **must** be linked to a standard Google Cloud Project. Follow the steps in the [Upgrading to a Production Environment](#upgrading-to-a-production-environment) section to do this.
2.  **Enable in the Sheet:** In your Google Sheet, go to the `Config` sheet and change the value for `EnableGCPLogging` from `FALSE` to `TRUE`.

Once enabled, all logs will be sent to Google Cloud Logging. You can view them by navigating to the [Logs Explorer](https://console.cloud.google.com/logs/viewer) in the Google Cloud Console for your linked project.

---

## Admin Directory Prerequisites

Some features (Google Group creation, membership sync, and permission assignment via groups) require the **Admin Directory** advanced service in Apps Script and the **Admin SDK** API in Google Cloud.

- Apps Script: Add the service via the Services panel (Admin Directory API).
- Google Cloud: Enable the Admin SDK in the linked GCP project.
- Access: Requires Google Workspace. Personal `@gmail.com` accounts cannot use the Admin SDK.

Behavior without Admin SDK:
- The script runs, creates/updates sheets and folders, and logs progress.
- Group operations are skipped and clearly marked as `SKIPPED (No Admin SDK)` in the `Status` columns.
- Tests that require groups will alert and abort.

---

## First Run & Testing Notes

- The menu contains three main sync options:
  - **`Sync Adds`**: Performs only additions (creates folders/groups, adds members). This is safe to run to add new permissions without affecting existing ones.
  - **`Sync Deletes`**: Performs only deletions (removes members from groups). It will ask for confirmation before proceeding.
  - **`Full Sync (Add & Delete)`**: Performs both additions and deletions in one go.
- Manual Access Test and Stress Test require Admin SDK. If not enabled or if you’re on a personal Gmail account, they will show an alert and abort. These tests use the `Full Sync` functionality.
- If you want to validate sheet/folder setup only (without Admin SDK), run `Permissions Manager > Sync Adds` and verify:
  - `ManagedFolders` rows populate `FolderID`, `UserSheetName`, and `GroupEmail`.
  - `Status` shows `SKIPPED (No Admin SDK)` when group ops are not available.
- To fully exercise group membership and permissions, ensure Admin SDK is enabled and your account has the required admin privileges.
