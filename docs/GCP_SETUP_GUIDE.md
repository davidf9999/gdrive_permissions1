# Google Workspace + GCP setup guide

> **Note for AI Assistant Users**
>
> This guide is the single source of truth for preparing Google Workspace and Google Cloud before deploying the Apps Script project. The AI assistant will always show the GUI steps. If you ask for `gcloud`, it will include the optional CLI commands shown here.

This document walks you through Google Workspace + Google Cloud setup in a deterministic, GUI-first way. Follow the steps in order. If you prefer to use `gcloud`, each step includes optional commands you can run after completing the GUI instructions.

---

## Setup Steps Overview

1. [Create or reuse a Google Workspace tenant](#1-create-or-reuse-a-google-workspace-tenant)
2. [Prepare the Super Admin account](#2-prepare-the-super-admin-account)
3. [Create or select a Google Cloud Project](#3-create-or-select-a-google-cloud-project)
4. [Enable APIs and grant consent](#4-enable-apis-and-grant-consent)

---

## A Note on GUI Language

The instructions assume the Admin console and Google Cloud Console are in English. If your interface is in another language, the assistant can guide you in temporarily switching it to English.

---

## Security Reminders

* Use a dedicated Super Admin account for setup.
* Enable 2-Step Verification (2SV) and store recovery codes securely.
* Avoid sharing Super Admin credentials in chat logs or tickets.

## 1. Create or reuse a Google Workspace tenant

1. Go to [workspace.google.com](https://workspace.google.com/) to start a free trial or sign in.
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
4.  Once your project is created and selected, find the **Project ID** on the project dashboard. **Copy this ID and save it for later.**


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


---

## Troubleshooting

* **Domain verification fails:** wait a few minutes, confirm the TXT record matches exactly, and retry.
* **API enablement errors:** ensure you are using the correct project and that billing/organization permissions allow API activation.
* **OAuth consent screen missing:** verify you are signed into the correct GCP project and have `Owner` or `Project Admin` access.
