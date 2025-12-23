# Google Workspace + GCP setup guide

> **Note for AI Assistant Users**
>
> This guide is the single source of truth for preparing Google Workspace and Google Cloud before deploying the Apps Script project. The AI assistant will always show the GUI steps. If you ask for `gcloud`, it will include the optional CLI commands shown here.

This document walks you through Google Workspace + Google Cloud setup in a deterministic, GUI-first way. Follow the steps in order. If you prefer to use `gcloud`, each step includes optional commands you can run after completing the GUI instructions.

---

## Setup Steps Overview

1. [Acquire a domain and start a Google Workspace tenant](#1-acquire-domain-and-workspace)
2. [Verify your domain and access the Admin console](#2-verify-domain-and-admin-access)
3. [Create or select a Google Cloud project](#3-create-or-select-gcp-project)
4. [Enable required Google APIs](#4-enable-required-apis)
5. [Configure the OAuth consent screen](#5-configure-oauth-consent-screen)
6. [Enable the Apps Script API user setting](#6-enable-apps-script-user-setting)

---

## A Note on GUI Language

The instructions assume the Admin console and Google Cloud Console are in English. If your interface is in another language, the assistant can guide you in temporarily switching it to English.

---

## Security Reminders

* Use a dedicated Super Admin account for setup.
* Enable 2-Step Verification (2SV) and store recovery codes securely.
* Avoid sharing Super Admin credentials in chat logs or tickets.

## 1. Acquire a domain and start a Google Workspace tenant

1. Purchase or select a domain you control (e.g., from Google Domains or another registrar).
2. Start a Google Workspace trial at [workspace.google.com](https://workspace.google.com/).
3. Use the domain from step 1 during sign-up.
4. Create the initial Super Admin account and save the credentials securely.

> **Why this matters:** Google Workspace is required for Admin SDK access and Google Groups management.


## 2. Verify your domain and access the Admin console

1. In the Admin console, follow the domain verification prompts.
2. Add the provided TXT record at your DNS host.
3. Wait for DNS to propagate, then click **Verify** in the Admin console.
4. Sign in at [admin.google.com](https://admin.google.com/) with your Super Admin account.
5. Confirm 2-Step Verification (2SV) is enabled or complete the enrollment when prompted.

> **Tip:** If verification fails, wait a few minutes and retry. DNS changes can take time to propagate.


## 3. Create or select a Google Cloud project

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Use the project selector in the top bar to create a **NEW PROJECT** or select an existing one.
3. Record the **Project ID** (not the project number).

**Optional: gcloud commands**
```bash
# Create a new project (requires an organization or billing account in many cases)
gcloud projects create YOUR_PROJECT_ID --name="Drive Permissions Manager"

# Set the active project for future commands
gcloud config set project YOUR_PROJECT_ID
```


## 4. Enable required Google APIs

1. In the Cloud Console, go to **APIs & Services → Library**.
2. Enable the following APIs:
   * Admin SDK API
   * Google Drive API
   * Google Apps Script API

**Optional: gcloud commands**
```bash
gcloud services enable admin.googleapis.com drive.googleapis.com script.googleapis.com --project=YOUR_PROJECT_ID
```


## 5. Configure the OAuth consent screen

1. In the Cloud Console, go to **APIs & Services → OAuth consent screen**.
2. Choose **Internal** as the user type.
3. Set an **App name** such as `Drive Permissions Manager`.
4. Provide a **User support email** and **Developer contact information**.
5. Save and continue without adding scopes for now.

> **Note:** There is no reliable gcloud equivalent for this step. Use the GUI.


## 6. Enable the Apps Script API user setting

1. Visit [script.google.com/home/usersettings](https://script.google.com/home/usersettings).
2. Toggle **Google Apps Script API** to **ON**.

> **Note:** There is no reliable gcloud equivalent for this setting. Use the GUI.


---

## Troubleshooting

* **Domain verification fails:** wait a few minutes, confirm the TXT record matches exactly, and retry.
* **API enablement errors:** ensure you are using the correct project and that billing/organization permissions allow API activation.
* **OAuth consent screen missing:** verify you are signed into the correct GCP project and have `Owner` or `Project Admin` access.
