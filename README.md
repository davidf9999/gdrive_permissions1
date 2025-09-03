# Google Drive Permission Manager

> **Project Status: Beta**
>
> This project is currently in Beta. It is feature-complete and has been tested, but it is still under active development. Please use it with the understanding that there may be bugs or changes to the functionality. Feedback and contributions are welcome!

This repository contains a powerful solution for managing access to a large number of Google Drive folders using a central Google Sheet. It uses Google Groups to provide a scalable and auditable permissions system, all managed from a familiar spreadsheet interface.

The recommended setup is a simple, manual copy-and-paste of the core script, which can be done in minutes. An optional, more advanced setup is available for production environments that require higher API quotas.

---

## Table of Contents

- [How it Works](#how-it-works)
- [Setup Guide (Recommended Manual Setup)](#setup-guide-recommended-manual-setup)
- [Usage Guide](#usage-guide)
- [Upgrading to a Production Environment](#upgrading-to-a-production-environment)
- [Tearing Down the Project](#tearing-down-the-project)

---

## The Solution: Google Groups and Automation

This project solves the problem of managing Drive access at scale by using **Google Groups** as the access control mechanism. Instead of sharing a folder with many individual users (which can hit Google Drive's sharing limits), you share it with a single Google Group. This allows you to manage hundreds (or even thousands) of members by simply adding or removing them from that group.

This solution automates the entire lifecycle of this approach:

1.  You define which folders to manage in a central Google Sheet.
2.  The script automatically creates dedicated Google Groups for different roles (e.g., `project-x-editors@your-domain.com`).
3.  You manage the membership of these groups simply by adding or removing emails from other sheets.
4.  The script runs automatically to sync the group memberships, effectively granting or revoking access to the Drive folders.

---

## Setup Guide (Recommended Manual Setup)

This guide will walk you through the simple, one-time setup process. This is the recommended approach and requires no special tools.

### Step 1: Prerequisites

*   A **Google Workspace** account (a standard `@gmail.com` account is not sufficient).
*   You must be a **Super Admin** for your Google Workspace domain to have the necessary permissions to create Google Groups.

### Step 2: Create the Google Sheet

1.  Go to [Google Sheets](https://sheets.google.com) and create a new, blank spreadsheet.
2.  Give it a descriptive name, for example: `Drive Permissions Control`.

### Step 3: Install the Apps Script

1.  In your new Google Sheet, click on **Extensions > Apps Script**. A new browser tab will open with the script editor.
2.  In the editor, click on `Code.gs` on the left, and delete the default `function myFunction() {}` code.
3.  Open the `apps_script_project/Code.js` file from this repository.
4.  Copy the entire contents of `Code.js` and paste it into the Apps Script editor.

### Step 4: Enable Advanced Services

To create and manage Google Groups, the script needs access to an advanced Google service.

1.  In the Apps Script editor, click the **+** icon next to the **Services** section in the left-hand menu.
2.  From the list of available APIs, find **Admin SDK API** and select it.
3.  Click the **Add** button. The `AdminDirectory` service will now appear in your list of services, and the error you encountered will be resolved.

### Step 5: Run the Initial Sync

1.  Save the script project by clicking the **Save project** (disk icon 💾) at the top of the Apps Script editor.
2.  Go back to your Google Sheet tab and **refresh the page**.
3.  A new menu named **Permissions Manager** should appear in the Google Sheets menu bar.
4.  Click **Permissions Manager > Sync All**.
5.  The first time you run this, Google will ask you to authorize the script. Follow the on-screen prompts to grant the necessary permissions.

Your setup is now complete! The script will have automatically created the necessary control sheets (`ManagedFolders`, `Admins`, etc.) for you.

---

## Usage Guide

For a detailed tutorial on how to use the spreadsheet, what each sheet and column means, and common workflows, please see the dedicated **[User Guide](./docs/USER_GUIDE.md)**.

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

This project also includes features for testing and logging, which are explained in more detail in the [User Guide](./docs/USER_GUIDE.md).
