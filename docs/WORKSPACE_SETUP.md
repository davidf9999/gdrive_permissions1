# Google Workspace setup & installation guide

This walkthrough expands on the quick checklist in the [README](../README.md) so
first-time administrators can stand up a Google Workspace tenant, create the
required Super Admin user, and deploy the Google Drive Permission Manager from a
fresh spreadsheet. Each step is short and sequential—follow them in order the
first time you roll out the tool.

---

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
   your DNS provider). Google provides step-by-step instructions for the most
   common registrars.

> **Tip:** If your organisation already has Workspace, sign into the Admin
> console with an existing Super Admin instead of creating a brand new tenant.

---

## 2. Prepare the Super Admin account

1. Sign in to [admin.google.com](https://admin.google.com/) using the admin
   account from the previous step.
2. Confirm the account has the **Super Admin** role by visiting
   **Directory → Users → [your user] → Admin roles and privileges**. If the role
   is missing, assign it now.
3. Enable the Google Groups service if it is not already active:
   - Navigate to **Apps → Google Workspace → Groups for Business**.
   - Click **On for everyone** and save.
4. Optional but recommended: enable 2-Step Verification for the admin account in
   **Security → 2-step verification** to protect API access.
5. Open a new tab to [console.cloud.google.com](https://console.cloud.google.com)
   and accept the Terms of Service so the account can manage Google Cloud
   resources.

---

## 3. Create the control spreadsheet

1. While signed in as the Super Admin, go to Google Drive and create a new
   Google Spreadsheet. Give it a descriptive name such as `Drive Permissions Control`.
2. Inside the spreadsheet, open **Extensions → Apps Script** to create a bound Apps
   Script project. Leave the editor open—you will connect the local source files
   shortly.
3. In the Apps Script editor, open **Project Settings → IDs** and copy the
   **Script ID** value. You will paste it into `.clasp.json` when configuring the
   CLI.

---

## 4. Install the Apps Script project with clasp

1. On your local machine, install the required tools:
   ```bash
   # Install clasp globally if you haven't already
   npm install -g @google/clasp
   ```
2. Clone this repository and change into the project directory:
   ```bash
   git clone https://github.com/<your-org>/gdrive-permission-manager.git
   cd gdrive-permission-manager
   ```
3. Authenticate clasp with the same Super Admin account:
   ```bash
   clasp login
   ```
4. Create `.clasp.json` in the repository root pointing at the bound Apps Script
   project:
   ```json
   {
     "scriptId": "YOUR_SCRIPT_ID",
     "rootDir": "apps_script_project"
   }
   ```
5. Pull the remote project once so clasp knows about the manifest:
   ```bash
   clasp pull
   ```
6. Push the repository sources into Apps Script:
   ```bash
   clasp push
   ```
7. Return to the spreadsheet and refresh. The **Permissions Manager** menu will
   appear once the push completes.

---

## 5. Enable APIs and grant consent

1. In the Apps Script editor, click the **+** button next to **Services** and add
   the following advanced services:
   - **AdminDirectory API**
   - **Drive API (v3)**
2. From **Project Settings**, open the associated Google Cloud project in a new
   tab.
3. In the Cloud Console, enable these APIs if they are not already active:
   - **Admin SDK API**
   - **Google Drive API**
4. Configure the OAuth consent screen when prompted:
   - User type: **Internal** (recommended for most Workspace tenants)
   - App name: something descriptive such as `Drive Permission Manager`
   - Add the Super Admin account as a test user
   - Save and publish

---

## 6. Run the first sync

1. Back in the spreadsheet, open **Permissions Manager → Full Sync (Add & Delete)**.
2. Grant the script permissions when asked—the prompts will appear twice: once
   for Admin SDK access and once for Drive access.
3. After the sync completes, review the generated sheets and populate the user
   tabs with email addresses.
4. Use **Sync Adds** and **Sync Deletes** for day-to-day changes. The
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