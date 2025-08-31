# Onboarding Guide: Preparing Your Google Account

Welcome! This guide will walk you through the initial, manual steps required before you can run the automated setup wizard. 

You must complete these steps to ensure the setup wizard has the necessary permissions and billing information to create and configure resources on your behalf.

---

## Part 1: Set Up a Google Workspace Account

This solution requires a Google Workspace account to manage users and groups via the Admin SDK API. A standard Gmail account (`@gmail.com`) is **not** sufficient.

1.  **Obtain a Google Workspace Account:**
    *   If you do not have a Google Workspace account, you will need to sign up for one. Google Workspace is a paid product, but it offers a free trial.
    *   Visit the [Google Workspace sign-up page](https://workspace.google.com/signup/businessstarter) to begin.

2.  **You Need a Domain Name:**
    *   Google Workspace requires you to have your own domain name (e.g., `your-company.com`). You can purchase one during the Workspace sign-up process if you don't already have one.

3.  **Ensure You Are a Super Admin:**
    *   The user account you use to run the setup wizard **must** be a **Super Admin** for your Google Workspace domain. This is required to grant the necessary permissions for creating groups and managing users.

---

## Part 2: Set Up a Google Cloud Billing Account

The setup wizard will create a new Google Cloud Platform (GCP) project for you. To use Google Cloud services and enable the necessary APIs, this new project must be linked to a billing account.

1.  **Navigate to the Google Cloud Console:**
    *   Go to the [Google Cloud Console Billing page](https://console.cloud.google.com/billing).
    *   Make sure you are logged in as the same Super Admin user from Part 1.

2.  **Create or Verify Your Billing Account:**
    *   If you do not have a billing account, Google will guide you through creating one. This requires a valid credit card.
    *   New Google Cloud users are eligible for a significant free trial credit.
    *   If you already have a billing account, ensure it is active and in good standing.

**Important:** The setup wizard will later ask you for your **Billing Account ID**. You can find this on the billing page. It will be a string of letters and numbers like `012345-ABCDEF-GHIJKL`.

---

## Part 3: Authenticate Your Local Environment

Before running the Docker container, you must first authenticate your local machine with Google Cloud (`gcloud`) and the Apps Script CLI (`clasp`). This is a one-time setup that generates credential files. The Docker container will then use these local credentials to run the setup non-interactively.

**Why is this necessary?**
Running interactive browser-based login prompts from within a Docker container is complex and unreliable. By authenticating on your local machine first, we can securely pass those credentials into the container, allowing the automated script to run without interruption.

1.  **Authenticate with gcloud:**
    Run the following command in your terminal. This will open a browser window for you to log in and authorize Google Cloud SDK access.
    ```bash
    gcloud auth application-default login
    ```
    This command will create a credentials file in `~/.config/gcloud/application_default_credentials.json`.

2.  **Authenticate with clasp:**
    Run the following command. This will also open a browser window for you to log in and authorize `clasp` to manage your Google Apps Script projects.
    ```bash
    clasp login
    ```
    This command will create a credentials file at `~/.clasprc.json`.

---

## Part 4: Next Steps

Once you have:

1.  A Google Workspace account.
2.  A user with **Super Admin** privileges.
3.  An active Google Cloud **Billing Account**.
4.  Authenticated with `gcloud` and `clasp` on your local machine.

You are ready to proceed with the automated setup.

Return to the main `README.md` file and follow the instructions in the "Getting Started" section to build and run the setup wizard.