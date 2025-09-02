# Google Drive Permission Manager

This repository contains a complete, automated solution for managing access to a large number of Google Drive folders for many users. It uses Google Groups, controlled by a central Google Sheet, to provide a scalable and auditable permissions system.

It is designed to be set up from scratch by any user with a Google Workspace account, using a containerized setup wizard that provisions all necessary cloud infrastructure automatically.

---

## Table of Contents

- [How it Works](#the-solution-google-groups-and-automation)
- [Setup Guide](#setup-guide)
- [Usage Guide](#usage-guide)
- [Tearing Down the Project](#tearing-down-the-project)
- [Advanced Features](#advanced-features)

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

This guide will walk you through the complete, one-time setup process.

### Step 1: Prerequisites

Before you begin, you must have the following command-line tools installed on your local machine.

*   **Google Cloud SDK (`gcloud`):** This is used to authenticate with your Google account and manage cloud resources.
    *   [Installation Guide](https://cloud.google.com/sdk/docs/install)
*   **`clasp`:** This is the official command-line tool for Google Apps Script.
    *   [Installation Guide](https://github.com/google/clasp#install)
*   **Docker and Docker Compose:** This is used to build and run the setup container in a consistent environment.
    *   [Installation Guide](https://docs.docker.com/get-docker/)

### Step 2: Google Account & Billing Setup

This solution requires a Google Workspace account and an active Google Cloud Billing account.

1.  **Set Up Google Workspace:**
    *   You must have a **Google Workspace** account with your own domain name (e.g., `your-company.com`). A standard `@gmail.com` account is **not** sufficient.
    *   The user account you use for this setup **must** be a **Super Admin** for your Google Workspace domain.

2.  **Set Up Google Cloud Billing:**
    *   Go to the [Google Cloud Console Billing page](https://console.cloud.google.com/billing).
    *   Ensure you are logged in as the same Super Admin user.
    *   Create a new billing account if you don't have one. This requires a valid credit card. New users are often eligible for a free trial.
    *   Take note of your **Billing Account ID** (e.g., `012345-ABCDEF-GHIJKL`). You will need this for the next step.

### Step 3: Project Configuration

The setup wizard runs non-interactively using a configuration file.

1.  **Create a Configuration File:**
    Copy the `setup.conf.example` file to a new file named `setup.conf`.

    ```bash
    cp setup.conf.example setup.conf
    ```

2.  **Populate the File:**
    Edit the `setup.conf` file and fill in the required values, including the Billing Account ID you noted in the previous step.

### Step 4: Run the Infrastructure Setup

This step creates all the Google Cloud resources you need.

1.  **Authenticate Your Local Environment:**
    Before running the setup, ensure your local environment is authenticated with Google. Your authentication tokens can expire, so it's good practice to run these commands even if you have authenticated before.

    ```bash
    # Authenticate with the Google Cloud SDK
    gcloud auth login
    
    # Set up Application Default Credentials for API access
    gcloud auth application-default login

    # Authenticate with clasp (for Apps Script detection only)
    clasp login
    ```

    **Note:** The `gcloud auth application-default login` command is required because the setup process needs to access Google Cloud APIs.

2.  **Run the Setup Wizard with Docker Compose:**
    After authenticating, execute the following commands from the root of the project directory.

    First, build the Docker image:
    ```bash
    docker compose build
    ```

    Next, run the setup wizard:
    ```bash
    docker compose up
    ```

    This will create all the Google Cloud infrastructure and prepare the Apps Script code.

### Step 5: Manual Setup Completion

After the infrastructure setup completes, you need to manually set up the Google Sheet and Apps Script:

1.  **Create Google Sheet:**
    *   Go to [Google Sheets](https://sheets.google.com)
    *   Create a new sheet with the exact title shown in the setup output (e.g., `[Control Sheet] DrivePermissionManager25`)
    *   Copy the Sheet ID from the URL (the long string between `/d/` and `/edit`)

2.  **Set Up Apps Script:**
    *   In your new Google Sheet, go to **Extensions** > **Apps Script**
    *   Delete the default `function myFunction() {}` code
    *   Copy all content from the file `apps_script_project/Code.js` in this repository
    *   Paste it into the Apps Script editor

3.  **Create Config File:**
    *   In the Apps Script editor, click the **+** next to **Files**
    *   Create a new **JSON** file named `config.json`
    *   Paste this content, replacing `YOUR_SHEET_ID` with the Sheet ID you copied:
    
    ```json
    {"gcpProjectId": "your-project-id", "sheetId": "YOUR_SHEET_ID"}
    ```
    
    *   The correct project ID will be shown in the setup output

4.  **Test the Setup:**
    *   Save the Apps Script project
    *   Refresh your Google Sheet
    *   You should see a **Permissions Manager** menu appear
    *   Click **Permissions Manager** > **Sync All** to run your first sync

### Step 6: Optional Post-Setup Steps

1.  **Link Your Billing Account:**
    *   Go to the [Google Cloud Console Billing page](https://console.cloud.google.com/billing).
    *   Select your organization (your domain) from the dropdown
    *   Find your new project and link it to your billing account if prompted

2.  **Link Your Apps Script to GCP Project (Advanced):**
    *   In Apps Script, go to **Project Settings** (gear icon ⚙️)
    *   Under **Google Cloud Platform (GCP) Project**, click **Change Project**
    *   Enter your GCP Project Number (shown in the setup output)

---

## Usage Guide

For a detailed tutorial on how to use the spreadsheet, what each sheet and column means, and common workflows, please see the dedicated **[User Guide](./docs/USER_GUIDE.md)**.

---

## Tearing Down the Project

If you wish to remove all the resources created by this project, a `teardown.sh` script is provided.

1.  **Manually Delete the Apps Script Project:**
    *   Go to your [Apps Script Dashboard](https://script.google.com/home).
    *   Find the project, click the three dots (⋮), and select **Remove**.

2.  **Run the Automated Teardown Script:**
    *   Make sure the `gcp_project_id` in your `setup.conf` file still points to the project you want to delete.
    *   Run the script from your terminal: `./teardown.sh`

---

## Advanced Features

This project also includes features for testing and logging, which are explained in more detail in the [User Guide](./docs/USER_GUIDE.md).
