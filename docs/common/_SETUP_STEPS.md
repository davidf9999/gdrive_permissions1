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
4. **Note on 2-Step Verification (2SV):** Google Cloud may require 2SV for Super Admin accounts. If it's not enabled, you may be prompted to set it up during the Google Cloud login process.
5. Open a new tab to [console.cloud.google.com](https://console.cloud.google.com) and accept the Terms of Service.

> **Why Super Admin?** The script needs Super Admin privileges to create and manage Google Groups via the Admin SDK.


## 3. Create or select a Google Cloud Project

The script requires a Google Cloud Platform (GCP) project to manage APIs.

1.  Go to the [Google Cloud Console](https://console.cloud.google.com).
2.  In the top menu bar, (right to "Googlr Cloud") click the project selection dropdown.
3.  Either select an existing, unused project or click **NEW PROJECT**.
    - If reusing a project, make sure you have **Owner** access.
    - If creating a new project, give it a clear name and choose your Google Workspace organization as the parent if prompted.
4.  Once your project is created and selected, at the top left hamburger menu, at in **Cloud overview** menu under **Project info** copy and save **Project number** and **Project ID** for future use.  
    - To find the **Project Number**, you can also run `gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)'`.


## 4. Create the control spreadsheet

This step must be performed while signed in as the **Google Workspace Super Admin**.

1.  Go to Google Drive and create a new **Google Spreadsheet**. Name it something descriptive like `Drive Permissions Control`.
2.  Inside the spreadsheet, open **Extensions → Apps Script** to create a new script project.
3.  In the apps script editor, open **Project Settings** (the gear icon ⚙️ on the left).
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

1.  **Enable Project-Level APIs.**
    **GPT:** In the Cloud Console, go to **APIs & Services → Library**, then search for and enable:
    - **Admin SDK API** (`admin.googleapis.com`)
    - **Google Drive API** (`drive.googleapis.com`)
    - **Google Apps Script API** (`script.googleapis.com`)
    ```bash
    # For CLI users: Enable Admin SDK, Drive, and Apps Script APIs
    # In your terminal, run the following command, replacing `YOUR_PROJECT_ID` with your GCP project ID:
    gcloud services enable admin.googleapis.com drive.googleapis.com script.googleapis.com --project=YOUR_PROJECT_ID
    ```
2.  **Enable User-Level API.** Visit **[script.google.com/home/usersettings](https://script.google.com/home/usersettings)** and toggle the "Google Apps Script API" setting **ON**.
3.  **Configure the OAuth Consent Screen.** In the [Cloud Console](https://console.cloud.google.com), go to **APIs & Services → OAuth consent screen**.
    *   Press: Get started.
    *   App name: A descriptive name like `Drive Permission Manager`.
    *   User type: **Internal**.
    *   Contact info: your email or what ever email you prefer.
    *   Save and continue.


## 7. Deploy the Apps Script project

1.  **Copy the bundled code.** Open [apps_scripts_bundle.gs](https://raw.githubusercontent.com/davidf9999/gdrive_permissions1/refs/heads/main/dist/apps_scripts_bundle.gs), select all text, and copy it.
    *Optional (local build):* run `npm install` then `npm run build` to regenerate the bundle from source.
2.  **Paste into the apps script editor (<>).** Return to the Apps Script editor, delete any code in `Code.gs`, paste the bundled code, and save.
3.  **Configure Project Settings.**
*   In the apps script editor, open **Project Settings** (⚙️).
*   Check the box for **Show "appsscript.json" manifest file in editor**.
*   Return to the editor and open the new `appsscript.json` file.
*   Copy the content from `apps_script_project/appsscript.json` in this repository and paste it into the editor's `appsscript.json`.
*   In the editor, set the `timeZone` to your organization's timezone (e.g., `America/New_York`). Save the file.
4.  **Link the GCP Project.** In **Project Settings** (⚙️), scroll to **Google Cloud Platform (GCP) Project**, click **Change project**, and enter your GCP **Project Number**.
*   Find the Project Number in the Cloud Console under **Project info**.
*   Or run `gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)'` in your terminal.
5.  Return to your spreadsheet and **refresh the page**. The **Permissions Manager** menu should appear.


## 8. Run the first sync

1. Refresh the spreadsheet so the **Permissions Manager** menu appears.
2. In the spreadsheet, open **Permissions Manager → ManualSync → Full Sync**.
3. Grant the script the requested permissions.
<details>
<summary>Visual aid: Authorization prompt</summary>

![Screenshot of the Google authorization prompt asking for permission to access Admin SDK and Drive APIs.](./images/workspace_setup/06-authorization-prompt.png)

</details>
4. During first run a a script (Full Sync in this case), multiple sheets will be created and populated, 
  including **Config**, **UserGroups**, and **Logs**.
  The default Sheet1 sheet may safely be deleted.
5. Check the execution log in sheet **Logs** for progress and errors.
6. At the UserGroups sheet, there should be (at the least) a GroupName SheetEditors_G and the related Group Admin Link should point to a google workspace group (that may be empty).
7. Review the setting in Config sheet and adjust as needed.

See the [User Guide](USER_GUIDE.md) for next steps.


## 9. Sending emails
It is important that the apps script can send notification emails successfully, for example, about errors.
Run **Email Capacity Test** at: 'Permissions Manager, Testing, Standalon Tests, Run Email Capacity Test'
to verify that the apps script can send emails to the email of the NotificationEmail setting in Config sheet.
If it fails, and if the configured email address is external to the organization domain, as a (temporary) workaround, you may try
configuring an internal email, such as that of the super admin.
