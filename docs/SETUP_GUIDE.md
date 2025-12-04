# Google Workspace setup & installation guide

> **Note for AI Assistant Users:** Welcome! You've been directed here from the AI Assistant. This document is the master guide for all setup steps. The AI Assistant in your terminal will automate many of these steps for you. Follow the interactive prompts from the assistant, and use this guide as a reference for the manual steps you'll need to perform in your web browser. The assistant will tell you when you need to refer to this guide.

This document is the comprehensive, step-by-step guide for setting up the Google Drive Permission Manager. It covers every required action, from creating a Google Workspace tenant to deploying the script and running the first sync. For a successful deployment, follow these steps in the presented order.

---

## Setup Steps Overview

-   [Understanding Roles](#understanding-roles)
1.  [Create or reuse a Google Workspace tenant](#1-create-or-reuse-a-google-workspace-tenant)
2.  [Prepare the Super Admin account](#2-prepare-the-super-admin-account)
3.  [Create the control spreadsheet](#3-create-the-control-spreadsheet)
4.  [Configure the Google Cloud CLI (gcloud)](#4-configure-the-google-cloud-cli-gcloud)
5.  [Enable APIs and grant consent](#5-enable-apis-and-grant-consent)
6.  [Deploy the Apps Script project with clasp](#6-deploy-the-apps-script-project-with-clasp)
7.  [Run the first sync](#7-run-the-first-sync)

---

## Understanding Roles

Before starting the setup, it's important to understand the different roles involved. You will primarily act as the **Installer**, using a **Google Workspace Super Admin** account to perform the privileged actions. We have created a dedicated guide for this.

**➡️ See [Roles and Responsibilities](ROLES_AND_RESPONSIBILITIES.md) for a full breakdown.**


## 1. Create or reuse a Google Workspace tenant

1. Visit [workspace.google.com](https://workspace.google.com/) and start a free
   trial or sign in if your organisation already has a tenant.
2. When prompted for a domain, either:
   - Enter the domain you already own and plan to use for email, **or**
   - Purchase a new domain through Google during the sign-up flow.
3. Complete the sign-up form to create the initial administrator account. Keep
   the username and password handy—you will use this account for the rest of the
   setup.
4. Verify the domain ownership when prompted (usually by adding a TXT record to
   your DNS provider). Follow the official
   [domain verification steps](https://support.google.com/a/answer/183895) and
   use a record similar to:

   | Type | Name/Host | Value |
   | ---- | --------- | ----- |
   | TXT  | @         | google-site-verification=abc123example |

<details>
<summary>Visual aid: Domain verification TXT record</summary>

![Example of a TXT record for domain verification in a DNS provider's interface.](./images/workspace_setup/01-domain-verification.png)

</details>

> **Tip:** If your organisation already has Workspace, sign into the Admin
> console with an existing Super Admin instead of creating a brand new tenant.

**Common issues at this step:**
- ❌ Domain verification fails → Double-check that the TXT record value matches
  exactly and allow DNS propagation (can take up to an hour).
- ❌ Wrong domain appears in Admin Console → Confirm you started signup with the
  domain you intend to manage.

---

## 2. Prepare the Super Admin account

1. Sign in to [admin.google.com](https://admin.google.com/) using the admin
   account from the previous step.
2. Confirm the account has the **Super Admin** role by visiting
   **Directory → Users → [your user] → Admin roles and privileges**. If the role
   is missing, assign it now.

<details>
<summary>Visual aid: Super Admin role assignment</summary>

![Screenshot showing the 'Admin roles and privileges' section for a user in the Google Admin console.](./images/workspace_setup/02-super-admin-role.png)

</details>

3. Enable the Google Groups service if it is not already active:
   - Navigate to **Apps → Google Workspace → Groups for Business**.
   - Click **On for everyone** and save.
4. **Crucial:** Enable 2-Step Verification (2SV) for the admin account in
   **Security → 2-step verification**. Google Cloud enforces this, and you will be blocked from proceeding without it.
5. Open a new tab to [console.cloud.google.com](https://console.cloud.google.com)
   and accept the Terms of Service so the account can manage Google Cloud
   resources.

> **Why Super Admin?** Admin SDK calls that create and manage Google Groups
> require Super Admin privileges. Delegated roles typically cannot grant the
> scopes needed for the script to function, so perform setup with a Super
> Admin account.

**Common issues at this step:**
- ❌ Groups for Business not available → Ensure the service is enabled for the
  entire organisation, not just an OU subset.
- ❌ Cannot access Cloud Console → Accept the Terms of Service while signed in
  with the Super Admin account and retry.

---

## 3. Create the control spreadsheet

This step must be performed while signed in as the **Google Workspace Super Admin**.

1. While signed in as the Super Admin, go to Google Drive and create a new
   Google Spreadsheet. Give it a descriptive name such as `Drive Permissions Control`.
2. Inside the spreadsheet, open **Extensions → Apps Script** to create a bound Apps
   Script project. Leave the editor open—you will connect the local source files
   shortly.
3. In the Apps Script editor, open **Project Settings → IDs** and copy the
   **Script ID** value. You will need this for the `clasp` configuration in a later step.

<details>
<summary>Visual aid: Finding the Apps Script ID</summary>

![Screenshot of the Apps Script editor showing Project Settings and the location of the Script ID.](./images/workspace_setup/03-script-id.png)

</details>

**Common issues at this step:**
- ❌ Script ID not found → Open **Extensions → Apps Script**, then **Project
  Settings** to reveal the ID.
- ❌ Wrong Google account → Confirm you are signed in with the Super Admin
  before copying the Script ID or running later steps.

---

## 4. Configure the Google Cloud CLI (gcloud)

> **Note for AI Assistant Users:** The assistant will now handle these command-line steps for you.

Authentication for `clasp` is best handled by the Google Cloud CLI (`gcloud`). This is a more robust method than `clasp login`, especially in cloud development environments.

1. **Verify `gcloud` installation.** In your terminal, run `gcloud --version`. If the command is not found, you must install the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) first. In the recommended Codespaces environment, it should be pre-installed.

2. **Authenticate with Google.** Use the **Google Workspace Super Admin** account from the previous steps. You will be asked to visit a URL in your browser and paste back a verification code.
   ```bash
   gcloud auth login --no-launch-browser
   ```
   > **Important:** Your Google account must have **2-Step Verification (2SV)** enabled for this to work.

3. **Set your GCP Project.** Tell `gcloud` which project you are working on. Replace `YOUR_PROJECT_ID` with your actual Google Cloud Project ID.
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   ```

**Common issues at this step:**
- ❌ `gcloud: command not found` → Ensure the Google Cloud SDK is installed and that its `bin` directory is in your system's PATH.
- ❌ `Access blocked` during login → Verify that 2-Step Verification is enabled on your Google account.

---

## 5. Enable APIs and grant consent

The script requires the Apps Script API to be enabled in two places: for your GCP project and for the Super Admin's user account.

1.  **Enable the Project-Level API.** In your terminal, run the following `gcloud` command to enable the Apps Script API for your project:
    ```bash
    gcloud services enable script.googleapis.com
    ```
2.  **Enable the User-Level API.** This is a manual step.
    -   Visit **[script.google.com/home/usersettings](https://script.google.com/home/usersettings)**.
    -   Find the setting for "Google Apps Script API" and toggle it **ON**.

    > **Note:** If you have just enabled these APIs, it may take a few minutes for the changes to propagate through Google's systems.

3.  **Configure the OAuth Consent Screen.** If you have not done so already for this project:
    -   In the [Cloud Console](https://console.cloud.google.com), navigate to **APIs & Services → OAuth consent screen**.
    -   User type: **Internal** (recommended for most Workspace tenants).
    -   App name: something descriptive such as `Drive Permission Manager`.
    -   Add the Super Admin account as a test user, then save and publish.

**Common issues at this step:**
- ❌ API errors during a later step → Verify you enabled the API in both the Cloud Console (`gcloud` command) **and** the Apps Script user settings page.

---

## 6. Deploy the Apps Script project with clasp

Now we will push the code from this repository into the Apps Script project you created. `clasp` will automatically use the credentials you configured with `gcloud`.

1. Create a file named `.clasp.json` in the repository root with the Script ID you copied earlier:
   ```json
   {
     "scriptId": "YOUR_SCRIPT_ID",
     "rootDir": "apps_script_project"
   }
   ```
2. Push the repository source code to your Apps Script project. The `-f` flag forces an overwrite of the remote project with your local files.
   ```bash
   clasp push -f
   ```
3. Return to your control spreadsheet and refresh the page. The **Permissions Manager** menu will appear once the push is complete.

<details>
<summary>Visual aid: Permissions Manager menu</summary>

![Screenshot of the Google Sheet interface with the 'Permissions Manager' menu visible after a successful 'clasp push'.](./images/workspace_setup/04-permissions-manager-menu.png)

</details>

**Common issues at this step:**
- ❌ `Authentication error` → Ensure you have successfully run `gcloud auth login` and `gcloud config set project`. Do **not** use `clasp login`.
- ❌ `Script ID not found` → Double-check that the `scriptId` in `.clasp.json` is correct.

---

## 7. Run the first sync

1. Back in the spreadsheet, open **Permissions Manager → ManualSync → Full Sync**.
2. Grant the script permissions when asked—the prompts will appear twice: once
   for Admin SDK access and once for Drive access.

<details>
<summary>Visual aid: Authorization prompt</summary>

![Screenshot of the Google authorization prompt asking for permission to access Admin SDK and Drive APIs.](./images/workspace_setup/06-authorization-prompt.png)

</details>

3. After the sync completes, review the generated sheets and populate the user
   tabs with email addresses.
4. Use **Add Users to Groups** and **Remove Users from Groups** (under the ManualSync menu) for day-to-day changes. The
   [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) file explains the workflow in
   detail.

You now have a fully configured Google Workspace administrator account and a
working installation of the Google Drive Permission Manager. Keep the Super
Admin credentials secure and add additional administrators through the `SheetEditors`
sheet rather than sharing the Super Admin password directly.

---

## Optional onboarding aids

- **Screen recording walkthrough:** Record a short (5–10 minute) video that
  demonstrates the exact clicks in this guide. Tools like Loom, Screencastify,
  or Google Meet recordings are sufficient—you do not need professional editing
  to be helpful.
- **Slide deck or checklist PDF:** Export this guide or the
  [`ONBOARDING.md`](ONBOARDING.md) checklist to share with colleagues who
  prefer printable references.
- **Live demo session:** Host a short call where you follow this guide in real
  time and let other admins ask questions.

Any of these aids can significantly reduce onboarding time for new team members
once you have the written steps in place.