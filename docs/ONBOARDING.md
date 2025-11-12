# Onboarding checklist

Use this quick reference while following the main setup instructions in the
[README](../README.md). It highlights the prerequisites you must satisfy before
running the Apps Script for the first time.

## Workspace prerequisites

- [ ] You are using a **Google Workspace** domain (consumer Gmail accounts are
      not supported).
- [ ] Your user has **Super Admin** privileges.
- [ ] A custom domain name is connected to the Workspace tenant.
- [ ] You can sign in to the [Google Cloud Console](https://console.cloud.google.com)
      with the same Super Admin account.

## Billing

- [ ] A Google Cloud billing account exists and is active.
- [ ] You know the **Billing Account ID** (format `012345-ABCDEF-GHIJKL`).
- [ ] The billing account can be attached to new Google Cloud projects.

## Local tooling

- [ ] Node.js 18+ and npm installed.
- [ ] [`@google/clasp`](https://github.com/google/clasp) installed globally.
- [ ] This repository cloned locally.

## First-run reminders

- [ ] After pushing the Apps Script files, enable the **Admin SDK** and **Google
      Drive** APIs on the linked Google Cloud project.
- [ ] Add the `AdminDirectory` and `Drive` advanced services inside the Apps
      Script editor.
- [ ] Configure the OAuth consent screen (Internal user type is sufficient for
      Workspace domains).
- [ ] Run **Full Sync (Add & Delete)** once to provision folders, groups, and
      user tabs.

Keep this checklist nearby when helping new administrators join the project—it
keeps the detailed README focused while ensuring nobody skips a critical step.
