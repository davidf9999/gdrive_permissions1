# GPT Knowledge Pack (gdrive_permissions1)

> This file is generated. Do not edit directly.
> Source: `GPT_KNOWLEDGE.template.md` and `docs/common/steps.yaml` via `npm run build:docs`.

## Purpose
This knowledge pack provides a compact, deterministic reference for a Custom GPT assisting setup and day-to-day usage of the gdrive_permissions1 project. It prioritizes stable instructions and references the full docs for detailed steps.

## Project summary
- Spreadsheet-first permissions manager for Google Drive.
- Uses Apps Script + Google Workspace Admin SDK + Drive API.
- Control sheet is the single source of truth for access and group membership.

## Key artifacts
- Apps Script bundle: `dist/apps_scripts_bundle.gs`
- Bundle build command: `npm run build:bundle`
- Apps Script source: `apps_script_project/`
- Setup guide: `docs/SETUP_GUIDE.md`
- User guide: `docs/USER_GUIDE.md`
- Super Admin guide: `docs/SUPER_ADMIN_USER_GUIDE.md`
- Sheet Editor guide: `docs/SHEET_EDITOR_USER_GUIDE.md`
- Roles overview: `docs/ROLES_AND_RESPONSIBILITIES.md`

## Usage scope (non-testing)
- Super Admin and Sheet Editor usage is documented in the role-specific guides above.
- Testing workflows are documented separately in `docs/TESTING.md`.

## Setup steps overview
1. [Create or reuse a Google Workspace tenant](#1-create-or-reuse-a-google-workspace-tenant)
2. [Prepare the Super Admin account](#2-prepare-the-super-admin-account)
3. [Create or select a Google Cloud Project](#3-create-or-select-a-google-cloud-project)
4. [Create the control spreadsheet](#4-create-the-control-spreadsheet)
5. [Configure the Google Cloud CLI (gcloud)](#5-configure-the-google-cloud-cli-gcloud)
6. [Enable APIs and grant consent](#6-enable-apis-and-grant-consent)
7. [Deploy the Apps Script project](#7-deploy-the-apps-script-project)
8. [Run the first sync](#8-run-the-first-sync)
9. [Post-Setup Verification](#9-post-setup-verification)

## Setup steps (full text)
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
5.  Find the **Project Number** in the Cloud Console,in **Cloud overview** menu under **Project info** and save it for later (you will need it to link Apps Script to GCP).
    - You can also run `gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)'`.


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

> **GPT note:** This step is not required if you are following the setup with the OpenAI GPT Assistant and do not plan to use a terminal.
>
> **Gemini note:** The assistant should ask you to run these commands in your own terminal. It should not try to authenticate `gcloud` for you.

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
    **GPT note (no terminal):** In the Cloud Console, go to **APIs & Services → Library**, then search for and enable:
    - **Admin SDK API** (`admin.googleapis.com`)
    - **Google Drive API** (`drive.googleapis.com`)
    - **Google Apps Script API** (`script.googleapis.com`)
2.  **Enable User-Level API.** Visit **[script.google.com/home/usersettings](https://script.google.com/home/usersettings)** and toggle the "Google Apps Script API" setting **ON**.
3.  **Configure the OAuth Consent Screen.** In the [Cloud Console](https://console.cloud.google.com), go to **APIs & Services → OAuth consent screen**.
    *   App name: A descriptive name like `Drive Permission Manager`.
    *   User type: **Internal**.
    *   Save and continue.


## 7. Deploy the Apps Script project

1.  **Copy the bundled code.** Open [apps_scripts_bundle.gs](https://raw.githubusercontent.com/davidf9999/gdrive_permissions1/refs/heads/main/dist/apps_scripts_bundle.gs), select all text, and copy it.
    *Optional (local build):* run `npm install` then `npm run build` to regenerate the bundle from source.
2.  **Paste into the Apps Script Editor.** Return to the Apps Script editor, delete any code in `Code.gs`, paste the bundled code, and save.
3.  **Configure Project Settings.**
*   In the Apps Script editor, open **Project Settings** (⚙️).
*   Check the box for **Show "appsscript.json" manifest file in editor**.
*   Return to the editor and open the new `appsscript.json` file.
*   Copy the content from `apps_script_project/appsscript.json` in this repository and paste it into the editor's `appsscript.json`.
*   In the editor, set the `timeZone` to your organization's timezone (e.g., `America/New_York`). Save the file.
4.  **Link the GCP Project.** In **Project Settings** (⚙️), scroll to **Google Cloud Platform (GCP) Project**, click **Change project**, and enter your GCP **Project Number**.
*   Find the Project Number in the Cloud Console under **Project info**.
*   Or run `gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)'` in your terminal.
*   **Do not** try to infer the Project Number from the Project ID.
5.  Return to your spreadsheet and **refresh the page**. The **Permissions Manager** menu should appear.

> **Notes on Configuration:** 
> The script's configuration (like Sheet ID) is stored in a sheet named `Config`, which will be created automatically on the first run.
> The original sheet called "Sheet1" may be deleted.


## 8. Run the first sync (only Google Workspace Super Admins can use the menu items)

1. Refresh the spreadsheet so the **Permissions Manager** menu appears.
2. In the spreadsheet, open **Permissions Manager → ManualSync → Full Sync**.
3. Grant the script the requested permissions.
4. Check the execution log in sheet **Logs** for progress and errors.

<details>
<summary>Visual aid: Authorization prompt</summary>

![Screenshot of the Google authorization prompt asking for permission to access Admin SDK and Drive APIs.](./images/workspace_setup/06-authorization-prompt.png)

</details>

After the script finishes, the management sheets will be created. See the [User Guide](USER_GUIDE.md) for next steps.


## 9. Post-Setup Verification

After the initial setup and first sync, it's a good practice to verify a few key configurations to ensure the long-term health of the system.

### Verify Email Authentication (SPF & DKIM)

**Why is this important?** The script sends email notifications for audits, errors, and other events. Without proper email authentication, these important emails are likely to be marked as spam or bounce.

1.  **Check SPF Record:** Run the built-in sanity check script to ensure you have a correct SPF record, which tells mail servers that Google is an authorized sender for your domain.
    ```bash
    ./scripts/dns_sanity_check.sh your-domain.com
    ```
    The output should show `OK: SPF includes _spf.google.com`.

2.  **Check DKIM Record:** DKIM provides a digital signature to your emails, which is critical for deliverability. Check if it's set up correctly:
    ```bash
    dig TXT google._domainkey.your-domain.com
    ```
    You should see a `v=DKIM1...` record in the output.

3.  **If Records are Missing:** If your SPF record is missing or the `dig` command returns `NXDOMAIN` for DKIM, it means your setup is incomplete. For a detailed guide on how to fix this, see the **[Emails Sent from the Script are Bouncing](TROUBLESHOOTING.md#emails-sent-from-the-script-are-bouncing)** section in our troubleshooting guide.


## Operational notes
- The bundle is copied into the Apps Script editor (`Code.gs`).
- The script uses a `Config` sheet that is created on first run.
- Permissions and logs are managed within the control spreadsheet.
