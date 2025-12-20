### Step 1: Create or reuse a Google Workspace tenant
*** Current state: 1 "Create or reuse a Google Workspace tenant" out of 8 steps. ***
This is the foundational step for your Google Drive Permissions Manager. You'll need an active Google Workspace tenant. If you don't have one, you can start a free trial.

**Manual Action Required:**
Follow the instructions in the [Setup Guide](docs/SETUP_GUIDE.md#1-create-or-reuse-a-google-workspace-tenant) to either create a new Google Workspace tenant or sign into an existing one.

**Once you have successfully set up or signed into your Google Workspace tenant, type 'done' to continue.**


### Step 2: Prepare the Super Admin account
*** Current state: 2 "Prepare the Super Admin account" out of 8 steps. ***
Now, you'll prepare the Super Admin account that will be used for the setup. This involves ensuring the correct roles and enabling necessary services.

**Manual Action Required:**
Follow the instructions in the [Setup Guide](docs/SETUP_GUIDE.md#2-prepare-the-super-admin-account) to:
1. Confirm your account has the Super Admin role.
2. Enable the Google Groups service.
3. Accept the Google Cloud Terms of Service.
4. Ensure 2-Step Verification (2SV) is enabled or be prepared to enable it.

**Once your Super Admin account is prepared, type 'done' to continue.**


### Step 3: Create or select a Google Cloud Project
*** Current state: 3 "Create or select a Google Cloud Project" out of 8 steps. ***
The Google Drive Permissions Manager requires a Google Cloud Platform (GCP) project to manage APIs.

**Manual Action Required:**
Follow the instructions in the [Setup Guide](docs/SETUP_GUIDE.md#3-create-or-select-a-google-cloud-project) to:
1. Navigate to the Google Cloud Console.
2. Create a **NEW PROJECT** or select an existing, unused project.
3. **Copy the Project ID and save it.** You will need it in subsequent steps.

**Once you have your Google Cloud Project ID, type 'done' to continue.**


### Step 4: Create the control spreadsheet
*** Current state: 4 "Create the control spreadsheet" out of 8 steps. ***
This spreadsheet will be the central hub for managing all your Drive permissions.

**Manual Action Required:**
Follow the instructions in the [Setup Guide](docs/SETUP_GUIDE.md#4-create-the-control-spreadsheet) to:
1. Create a new Google Spreadsheet in Google Drive.
2. Open **Extensions → Apps Script** to create a new Apps Script project bound to the spreadsheet.
3. In the Apps Script editor, open **Project Settings** (the gear icon ⚙️) and copy the **Script ID**. You will need this later.

**Once your control spreadsheet is created and you have noted its Script ID, type 'done' to continue.**


### Step 5: Configure the Google Cloud CLI (gcloud)
*** Current state: 5 "Configure the Google Cloud CLI (gcloud)" out of 8 steps. ***
You need to authenticate the `gcloud` CLI tool so it can manage resources in your GCP project. For authentication, you should run the commands in your own terminal.

**Manual Action Required:**
Please run these commands in your terminal, then let me know once each one completes:
1. `gcloud --version`
2. `gcloud auth login`
3. `gcloud config set project YOUR_PROJECT_ID`

**When you're done, type 'done' and we'll continue.**


### Step 6: Enable APIs and grant consent
*** Current state: 6 "Enable APIs and grant consent" out of 8 steps. ***
The script requires specific Google Cloud APIs to be enabled and user consent for OAuth. I can help automate the project-level API enablement.

**Automated Action (with your approval):**
I can run the `gcloud services enable` command to enable the necessary APIs for your GCP project.

**Manual Action Required:**
You will also need to manually enable the user-level Apps Script API and configure the OAuth consent screen in your browser.

**Do you want me to proceed with enabling the project-level APIs? (yes/no)**


### Step 7: Deploy the Apps Script project
*** Current state: 7 "Deploy the Apps Script project" out of 8 steps. ***
Now it's time to deploy the actual script code into the Apps Script project you created earlier. This involves building the project locally and then copying the code manually.

**Automated Action (with your approval):**
I can run `npm install` and `npm run build` to prepare the script bundle for deployment.

**Manual Action Required:**
You will then need to manually copy the bundled code into your Apps Script editor, configure the `appsscript.json` manifest, and link your GCP project in the Apps Script project settings.

**To find your Project Number:**
* In the Cloud Console, open **Project info** and copy the **Project number**.
* Or run `gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)'` in your terminal.
* **Do not** try to infer the Project Number from the Project ID.

**Do you want me to proceed with building the Apps Script project? (yes/no)**


### Step 8: Run the first sync
*** Current state: 8 "Run the first sync" out of 8 steps. ***
This is the final step where you'll authorize the script and let it create the necessary management sheets in your spreadsheet.

**Manual Action Required:**
1. Return to your control spreadsheet and refresh the page so the **Permissions Manager** menu appears (menu items are available only to Google Workspace Super Admins).
2. From the menu, select **Permissions Manager → ManualSync → Granular Sync → Sync Sheet Editors**.
3. You will be prompted to grant the script permissions. Review and accept these.

After the sync completes, the necessary sheets will be created, and you can begin populating them. Refer to the [User Guide](docs/SETUP_GUIDE.md#8-run-the-first-sync) for more details on day-to-day operations.

**Once you have completed the first sync, type 'done' to mark the setup as complete!**
