# Google Workspace setup & installation guide

## There are three common setup modes

*   **Manual:** You follow the steps in this guide without a specialized chatbot.
*   **Gemini CLI Assistant:** A terminal-based helper that can automate commands and prompts, often used in GitHub Codespaces. See the [Gemini CLI Assistant Guide](AI_ASSISTANT_GUIDE.md).
*   **OpenAI GPT Assistant:** A chat-based helper that explains steps and generates commands, but does not run them for you.

For brevity, this guide refers to these modes as **manual**, **gemini**, and **gpt**.

> **Note**
>
> This document is the master guide for all setup steps. The steps are the same in every mode; only the way you get help differs.
>
> *   **Follow the Guide:** Gemini CLI and OpenAI GPT assistants should reference this document for browser steps.
> *   **Read the Chat:** Follow the assistant's responses and the steps here.
> *   **Sharing Screenshots:** If you need to show the assistant something from your screen, you can copy text and paste it into the chat. For images, save a screenshot to a file and share the file path with the assistant so it can open the image.
> *   **You're in Control:** Assistants can run commands for you, but you can always choose to run them manually.

This document is the comprehensive, step-by-step guide for setting up the Google Drive Permission Manager. For a successful deployment, follow these steps in the presented order.

---

## Prerequisites

*   **Administrative Skills:** Even with assistance (Gemini CLI or OpenAI GPT), this setup requires a basic understanding of administrative concepts like domain management and user permissions.
*   **GitHub Account (Gemini CLI only):** Required to run the Gemini CLI Assistant in Codespaces or manage Codespaces settings.
*   **Google Account (Gemini CLI only):** Required to authenticate the `gemini` CLI tool. This account does **not** need to be your GitHub or Google Workspace admin account.

### Authenticating the Gemini CLI (Gemini CLI Assistant only)

If you are using the Gemini CLI Assistant, you need to authenticate the `gemini` command-line tool. This is not required for manual setup or OpenAI GPT usage.

1.  In the terminal, you will be prompted to authenticate.
2.  Select **1: Login with Google**.
3.  A URL will be displayed. Copy and paste it into your browser.
4.  Sign in with any Google account. This authentication provides a free daily quota for using the Gemini CLI Assistant.

---

## Setup Steps Overview

1. [Create or reuse a Google Workspace tenant](#1-create-or-reuse-a-google-workspace-tenant)
2. [Prepare the Super Admin account](#2-prepare-the-super-admin-account)
3. [Create or select a Google Cloud Project](#3-create-or-select-a-google-cloud-project)
4. [Create the control spreadsheet](#4-create-the-control-spreadsheet)
5. [Configure the Google Cloud CLI (gcloud)](#5-configure-the-google-cloud-cli-gcloud)
6. [Enable APIs and grant consent](#6-enable-apis-and-grant-consent)
7. [Deploy the Apps Script project](#7-deploy-the-apps-script-project)
8. [Run the first sync](#8-run-the-first-sync)

---

## A Note on GUI Language
The instructions and screenshots in this guide assume the Google Admin and Google Cloud consoles are in English. If your interface is in another language, the Gemini CLI Assistant or OpenAI GPT Assistant can provide guidance on how to temporarily switch it to English to make following the steps easier.

---

## Understanding Roles

This setup requires acting as an **Installer** using a **Google Workspace Super Admin** account. For a full breakdown, see [Roles and Responsibilities](ROLES_AND_RESPONSIBILITIES.md).

## 1. Create or reuse a Google Workspace tenant

1. Go to [workspace.google.com/business](https://workspace.google.com/business/) and select a plan, then click the related **Get started** button to begin signup.
2. When prompted, provide a domain you own or purchase one through Google Domains (the default option during setup).
3. Complete the sign-up form to create the administrator account.
4. Verify domain ownership via a DNS record. Follow the official [domain verification steps](https://support.google.com/a/answer/183895).
5. (Optional) Run DNS sanity checks to confirm delegation and verification records:
   ```bash
   ./scripts/dns_sanity_check.sh your-domain.com [subdomain]
   ```
   * After setup, expect TXT/MX records to appear.
   * After teardown, SOA/NS should still exist; empty A/AAAA/MX/TXT answers (NOERROR with SOA) are expected.

<details>
<summary>Visual aid: Domain verification TXT record</summary>

![Example of a TXT record for domain verification in a DNS provider's interface.](./images/workspace_setup/01-domain-verification.png)

</details>

> **Tip:** If your organisation already has Workspace, sign into the [Admin console](https://admin.google.com/) with an existing Super Admin account.


## 2. Prepare the Super Admin account

1. Sign in to [admin.google.com](https://admin.google.com/) using the Super Admin account.
2. Confirm the account has the **Super Admin** role by visiting **Directory → Users → [your user] → Admin roles and privileges**.
3. Enable the Google Groups service if it is not already active: go to **Apps → Google Workspace → Groups for Business** and set it to **On for everyone**.
4. **Note on 2-Step Verification (2SV):** Google Cloud requires 2SV for Super Admin accounts. If it's not enabled, you will be prompted to set it up during the Google Cloud login process.
5. Open a new tab to [console.cloud.google.com](https://console.cloud.google.com) and accept the Terms of Service.

> **Why Super Admin?** The script needs Super Admin privileges to create and manage Google Groups via the Admin SDK.


## 3. Create or select a Google Cloud Project

The script requires a Google Cloud Platform (GCP) project to manage APIs.

1.  Go to the [Google Cloud Console](https://console.cloud.google.com).
2.  In the top menu bar, click the project selection dropdown.
3.  Either select an existing, unused project or click **NEW PROJECT**.
    - If reusing a project, make sure you have **Owner** access.
    - If creating a new project, give it a clear name and choose your Google Workspace organization as the parent if prompted.
4.  Once your project is created and selected, find the **Project ID** on the project dashboard. **Copy this ID and save it for later.**


## 4. Create the control spreadsheet

This step must be performed while signed in as the **Google Workspace Super Admin**.

1.  Go to Google Drive and create a new **Google Spreadsheet**. Name it something descriptive like `Drive Permissions Control`.
2.  Inside the spreadsheet, open **Extensions → Apps Script** to create a new script project.
3.  In the Apps Script editor, open **Project Settings** (the gear icon ⚙️ on the left).
4.  Under **General Settings**, find the **Script ID** and copy it for later use.

<details>
<summary>Visual aid: Finding the Apps Script ID</summary>

![Screenshot of the Apps Script editor showing Project Settings and the location of the Script ID.](./images/workspace_setup/03-script-id.png)

</details>


## 5. Configure the Google Cloud CLI (gcloud)

> **Note for Gemini CLI Assistant users:** The assistant should ask you to run these commands in your own terminal. It should not try to authenticate `gcloud` for you.

This step gives `gcloud` permission to manage resources in your Google Cloud project.

1.  **Verify `gcloud` installation.** In your terminal, run `gcloud --version`. If the command is not found, try opening a new terminal first. If it still fails, please create an issue on our [GitHub repository](https://github.com/davidf9999/gdrive_permissions1/issues).
2.  **Authenticate `gcloud`.** Run `gcloud auth login` and follow the link to sign in with your **Google Workspace Super Admin** account.
3.  **Set your GCP Project.** Run `gcloud config set project YOUR_PROJECT_ID`, replacing `YOUR_PROJECT_ID` with the ID you saved from Step 3.


## 6. Enable APIs and grant consent

1.  **Enable Project-Level APIs.** In your terminal, run the following commands, replacing `YOUR_PROJECT_ID` with your GCP project ID:
    ```bash
    # Enable Admin SDK, Drive, and Apps Script APIs
    gcloud services enable admin.googleapis.com drive.googleapis.com script.googleapis.com --project=YOUR_PROJECT_ID
    ```
2.  **Enable User-Level API.** Visit **[script.google.com/home/usersettings](https://script.google.com/home/usersettings)** and toggle the "Google Apps Script API" setting **ON**.
3.  **Configure the OAuth Consent Screen.** In the [Cloud Console](https://console.cloud.google.com), go to **APIs & Services → OAuth consent screen**.
    *   User type: **Internal**.
    *   App name: A descriptive name like `Drive Permission Manager`.
    *   Save and continue.


## 7. Deploy the Apps Script project

1.  **Install dependencies (optional).** If you want to build the bundle locally, run `npm install`.
2.  **Build the script bundle (optional).** This command combines all source files into a single file for deployment.
    ```bash
    npm run build
    ```
    If you prefer not to run build commands locally, use the prebuilt bundle committed in `dist/apps_scripts_bundle.gs`.
3.  **Copy the bundled code.** Open `dist/apps_scripts_bundle.gs`, select all text, and copy it.
4.  **Paste into the Apps Script Editor.** Return to the Apps Script editor, delete any code in `Code.gs`, paste the bundled code, and save.
5.  **Configure Project Settings.**
    *   In the Apps Script editor, open **Project Settings** (⚙️).
    *   Check the box for **Show "appsscript.json" manifest file in editor**.
    *   Return to the editor and open the new `appsscript.json` file.
    *   Copy the content from `apps_script_project/appsscript.json` in this repository and paste it into the editor's `appsscript.json`.
    *   In the editor, set the `timeZone` to your organization's timezone (e.g., `America/New_York`). Save the file.
6.  **Link the GCP Project.** In **Project Settings** (⚙️), scroll to **Google Cloud Platform (GCP) Project**, click **Change project**, and enter your GCP **Project Number**.
    *   Find the Project Number in the Cloud Console under **Project info**.
    *   Or run `gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)'` in your terminal.
    *   **Do not** try to infer the Project Number from the Project ID.
7.  Return to your spreadsheet and **refresh the page**. The **Permissions Manager** menu should appear.

> **Note on Configuration:** The script's configuration (like Sheet ID) is stored in a sheet named `Config`, which will be created automatically on the first run.


## 8. Run the first sync

1. Refresh the spreadsheet so the **Permissions Manager** menu appears (only Google Workspace Super Admins can use the menu items).
2. In the spreadsheet, open **Permissions Manager → ManualSync → Granular Sync → Sync Sheet Editors**.
3. Grant the script the requested permissions.

<details>
<summary>Visual aid: Authorization prompt</summary>

![Screenshot of the Google authorization prompt asking for permission to access Admin SDK and Drive APIs.](./images/workspace_setup/06-authorization-prompt.png)

</details>

After the script finishes, the management sheets will be created. See the [User Guide](USER_GUIDE.md) for next steps.

