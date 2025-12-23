# Google Workspace + GCP setup guide

> **Note for AI Assistant Users**
>
> This guide is the single source of truth for preparing Google Workspace and Google Cloud before deploying the Apps Script project. The AI assistant will always show the GUI steps. If you ask for `gcloud`, it will include the optional CLI commands shown here.

This document walks you through Google Workspace + Google Cloud setup in a deterministic, GUI-first way. Follow the steps in order. If you prefer to use `gcloud`, each step includes optional commands you can run after completing the GUI instructions.

---

## Setup Steps Overview

{{GCP_SETUP_STEPS_LIST}}

---

## A Note on GUI Language

The instructions assume the Admin console and Google Cloud Console are in English. If your interface is in another language, the assistant can guide you in temporarily switching it to English.

---

## Security Reminders

* Use a dedicated Super Admin account for setup.
* Enable 2-Step Verification (2SV) and store recovery codes securely.
* Avoid sharing Super Admin credentials in chat logs or tickets.

{{GCP_SETUP_STEPS}}

---

## Troubleshooting

* **Domain verification fails:** wait a few minutes, confirm the TXT record matches exactly, and retry.
* **API enablement errors:** ensure you are using the correct project and that billing/organization permissions allow API activation.
* **OAuth consent screen missing:** verify you are signed into the correct GCP project and have `Owner` or `Project Admin` access.
