# Google Drive Permission Manager

> **Important Note:** This project requires a **Google Workspace domain**. While personal @gmail.com accounts can be managed by this system, they cannot be used by administrators to directly run the Apps Script due to its reliance on Google Workspace administrative APIs.

The Google Drive Permission Manager automates Drive folder sharing by treating
one Google Spreadsheet as the source of truth for access. Each folder/role combination
gets its own tab where administrators list email addresses—no scripting
experience required. A bound Apps Script project runs on a five-minute cadence
to keep the relevant Google Groups and Drive permissions aligned with those
tabs. This repository packages that script alongside guided setup
documentation, automated tests, and optional infrastructure helpers so teams can
roll out the workflow consistently.

---

## Table of contents

1. [Key features](#key-features)
2. [Example use cases](#example-use-cases)
3. [✋ Stop! Do you have these requirements?](#-stop-do-you-have-these-requirements)
4. [Architecture overview](#architecture-overview)
5. [First-time Google Workspace setup](#first-time-google-workspace-setup)
6. [Manual setup with clasp](#manual-setup-with-clasp)
7. [Daily usage](#daily-usage)
8. [Cost transparency](#cost-transparency)
9. [Security & privacy](#security--privacy)
10. [Automation & production deployment](#automation--production-deployment)
11. [Documentation map](#documentation-map)
12. [Testing](#testing)
13. [Tearing down the project](#tearing-down-the-project)
14. [Community](#community)

---

## AI-Assisted Setup (Quick Start)

For the easiest and fastest setup experience, you can use our AI-powered assistant.

**Note:** The assistant runs in a pre-configured cloud environment (GitHub Codespaces). We strongly recommend this method to avoid manual installation of tools. For more details, see our [Setup Guide](docs/SETUP_GUIDE.md).

To launch the assistant, you will need a GitHub account. Once you are logged in to GitHub, click the button below to start the setup process in a new Codespace.

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/davidf9999/gdrive_permissions1?ref=feature/ai-setup-assistant)

The assistant will guide you through every step of the process in an interactive terminal.

---

## Key features

- **Spreadsheet-first workflow** – Manage Drive access using a Google Spreadsheet that
  team members can edit.
- **Google Group indirection** – Each folder/role combination receives its own
  Google Group so Drive never hits the per-folder sharing limit.
- **Safety-first syncs** – Separate menu items for "Sync Adds", "Sync Deletes",
  and "Full Sync" help administrators preview destructive operations.
- **Comprehensive logging** – Operational logs, test logs, and optional email
  notifications make auditing straightforward.
- **Extensive test helpers** – Built-in stress tests and manual access tests are
  available directly from the spreadsheet UI.

---

## Example use cases

This tool is most effective for managing access for ad-hoc teams and projects that exist outside of an organization's primary, automated systems (like an HR database or a student enrollment system).

- **University Research Lab** – A lab includes professors, post-docs, and a rotating group of graduate students and visiting scholars. They need tiered access to shared folders for raw data (PIs only), analysis scripts (lab members), and manuscript drafts (lab members + external collaborators). These groups are not formal university "classes," making them ideal for spreadsheet-based management.
- **Consulting Firm** – 50 active client projects that each require separate Editor and Viewer groups to isolate deliverables from engagement records. As consultants join or leave a project team, an administrator can quickly update the relevant spreadsheet tab to grant or revoke access in minutes.

---

## ✋ Getting Started with the AI Assistant

The AI Assistant is designed to guide you through the entire setup process from start to finish. Here are the core components the assistant will help you create and configure:

-   **A Google Workspace Tenant:** The foundation of the system. The assistant will guide you on how to sign up for a new Workspace trial.
-   **A Super Admin User:** You will create or designate a user with Super Admin privileges to manage the Workspace.
-   **A Registered Domain Name:** The assistant will instruct you on how to connect your domain to Google Workspace.

Even if you have none of these items ready, the assistant will start at the very beginning and walk you through each step. Just launch the assistant to get started.

---

## Understanding the Roles

This system involves a few key user roles, from the Super Admin who performs the initial setup to the Sheet Editors who manage permissions day-to-day. Before you begin, it's helpful to understand who does what.

**➡️ See our [Roles and Responsibilities Guide](docs/ROLES_AND_RESPONSIBILITIES.md) for a full breakdown.**

---

## Architecture overview

At a glance, the system combines three moving pieces:

1. **Control spreadsheet** – Administrators describe folders, roles, and Google Group
   membership using purpose-built tabs.
2. **Apps Script automation** – A bound script reads those tabs every five
   minutes (or on-demand) and reconciles Workspace to match the plan.
3. **Google Workspace services** – Drive folders and Google Groups are updated
   via the Admin SDK and Drive APIs, with results surfaced back to the spreadsheet via
   status tabs and optional alerting.

```mermaid
flowchart LR
  Control["Control spreadsheet tabs<br>(Control tabs)"]
  Script["Apps Script automation<br>(5-min trigger)"]
  Groups["Google Groups<br>(one per folder/role)"]
  Drive["Drive folder permissions<br>(Editor / Viewer / etc.)"]
  Status["Status + Logs tabs<br>(for administrators)"]
  Alerts["Email / Chat alerts<br>(on errors)"]
 
  Control -- desired access --> Script
  Script -- enforce membership --> Groups
  Script -- enforce sharing --> Drive
  Groups -- hydrate from --> Control
  Drive -- grants access to --> Users[(Managed users)]
  Script -- write outcomes --> Status
  Script -- notify issues --> Alerts

  classDef default fill:#f4fbff,stroke:#1463a5,stroke-width:1.5px,color:#0d273d;
  classDef script fill:#eefcf3,stroke:#047857,color:#092314;
  classDef ws fill:#fff6e8,stroke:#d97706,color:#4a1d05;
  classDef status fill:#e5e7eb,stroke:#6b7280,color:#1f2937;
  classDef alerts fill:#fce7f3,stroke:#be185d,color:#4a0418;
  class Script script;
  class Groups,Drive ws;
  class Status status;
  class Alerts alerts;
```

For a detailed architectural narrative—including how the control spreadsheet is
structured, how folder roles fan out to groups and individuals, how the sync
loop runs, and which personas operate each part—see
[`docs/ARCHITECTURE_OVERVIEW.md`](docs/ARCHITECTURE_OVERVIEW.md).

That document also includes important **[Performance & Scaling
Considerations](docs/ARCHITECTURE_OVERVIEW.md#performance--scaling-considerations)**,
which explains the expected limits of the Apps Script platform and suggests
alternatives for enterprise-scale deployments.

---

## Manual setup with clasp

The canonical deployment flow uses [`clasp`](https://github.com/google/clasp) to
push the multi-file Apps Script project to your spreadsheet.

### 1. Install tooling

- Install Node.js 18+ and npm.
- Install clasp globally:
  ```bash
  npm install -g @google/clasp
  ```

### 2. Create the control spreadsheet

1. Create a new Google Spreadsheet named something descriptive (e.g., `Drive
   Permissions Control`).
2. Open **Extensions → Apps Script** to create the bound script project.
3. Copy the **Script ID** from **Project Settings → IDs** — you need it shortly.

### 3. Configure clasp locally

1. Log into clasp:
   ```bash
   clasp login
   ```
2. At the repository root, create `.clasp.json` pointing at the bound project:
   ```json
   {
     "scriptId": "YOUR_SCRIPT_ID",
     "rootDir": "apps_script_project"
   }
   ```
3. Pull the remote manifest so the local project matches the Apps Script
   project:
   ```bash
   clasp pull
   ```

### 4. Push the source files

Deploy all `.gs` and `.js` files to Apps Script:

```bash
clasp push
```

Refreshing the spreadsheet should now reveal a **Permissions Manager** menu.

### 5. Enable required APIs and consent screen

1. In the Apps Script editor, open **Services** and add the following advanced
   services:
   - `AdminDirectory`
   - `Drive` (API v3)
2. From **Project Settings**, follow the link to the attached Google Cloud
   project and ensure the **Admin SDK API** and **Google Drive API** are both
   enabled.
3. Configure the OAuth consent screen if prompted:
   - User type: **Internal** (recommended for Workspace domains)
   - Populate the required contact details and add yourself as a test user.

With APIs enabled, you can return to the spreadsheet and run the initial sync.

---

## Daily usage

1. Refresh the spreadsheet and open **Permissions Manager** from the menu bar.
2. Run **Full Sync (Add & Delete)** for the first execution so all folders,
   groups, and tabs are provisioned.
3. Populate the generated user tabs with email addresses. Removing an email (or
   marking it disabled) followed by **Sync Deletes** revokes access.
4. Review the `Log` sheet after each sync for status messages. Errors contain
   actionable guidance.

For advanced workflows (AutoSync scheduling, edit mode safeguards, or the
risk-based auto sync), consult the guides in the `docs/` directory.

---

## Cost transparency

- **Google Workspace**: typically **$6–18/user/month** depending on your plan
  ([pricing details](https://workspace.google.com/pricing.html)).
- **Google Cloud APIs**: Admin SDK and Drive API usage for this tool generally
  stays within the free tier; costs scale with very large deployments. Use the
  [Google Cloud pricing calculator](https://cloud.google.com/products/calculator)
  if you expect high volumes.
- **Domain registration**: varies by provider (commonly **~$20/year**).

Most small to medium deployments remain within free quotas; billing is still
required to unlock Admin SDK limits.

---

## Security & privacy

- **Permissions requested**: the script uses Admin SDK scopes to manage Google
  Groups and Drive scopes to share folders on your behalf.
- **Data location**: all managed data (folder metadata, group membership, and
  logs) stays inside your Google Spreadsheet and Workspace tenant; nothing is
  sent to external services.
- **Access to your data**: neither the script authors nor contributors can see
  your spreadsheet contents because everything runs within your domain.
- **Compliance**: administrators should review organisational requirements (e.g.
  GDPR or FERPA) and ensure only authorised users have edit access to the control
  spreadsheet and Apps Script project.

---

## Automation & production deployment

Infrastructure helpers are currently **archived** from `main` to keep the
deployment path simple and avoid shipping untested automation. The remaining
recommendation is to use `ProductionOptimizations.gs` (optional helpers that
reduce API calls during large syncs).

---

## Documentation map

| Topic | Location |
| ----- | -------- |
| AI assistant setup & development | [`docs/AI_ASSISTANT_GUIDE.md`](docs/AI_ASSISTANT_GUIDE.md) |
| End-user how-to guide | [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) |
| Testing menus and stress scenarios | [`docs/TESTING.md`](docs/TESTING.md) |
| Edit-only mode walkthrough | [`docs/EDIT_MODE_GUIDE.md`](docs/EDIT_MODE_GUIDE.md) |
| Auto-sync options & safety levers | [`docs/AUTO_SYNC_GUIDE.md`](docs/AUTO_SYNC_GUIDE.md) & [`docs/RISK_BASED_AUTO_SYNC.md`](docs/RISK_BASED_AUTO_SYNC.md) |
| Stopping or pausing scripts | [`docs/STOP_SCRIPTS.md`](docs/STOP_SCRIPTS.md) |
| Full setup walkthrough (Workspace, Cloud, Script) | [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md) |
| Spreadsheet and script onboarding checklist | [`docs/ONBOARDING.md`](docs/ONBOARDING.md) |
| Frequently asked questions | [`FAQ.md`](FAQ.md) |
| Architecture deep dive | [`docs/ARCHITECTURE_OVERVIEW.md`](docs/ARCHITECTURE_OVERVIEW.md) |
| Historical decisions & debugging notes | [`GEMINI.md`](GEMINI.md) |
| Release history | [`CHANGELOG.md`](CHANGELOG.md) |

---

## Testing

Automated Jest tests validate the merge utilities and supporting JavaScript:

```bash
npm ci
npm test -- --runInBand
```

The Apps Script logic is validated through the in-spreadsheet testing harness. After
pushing updates, open the spreadsheet and run **Permissions Manager → Testing →
Run All Tests**. See [`docs/TESTING.md`](docs/TESTING.md) for details and
troubleshooting.

---

## Tearing down the project

To remove the automation:

1. In the spreadsheet, run **Sync Deletes** to revoke any remaining folder
   access.
2. Delete the Google Groups that were created for managed folders.
3. Remove the Apps Script project or delete the bound spreadsheet entirely.
4. If you used the Terraform or Docker workflows, destroy the provisioned Google
   Cloud resources using the respective tooling.

---

## Community

- Review the [Contributing guide](CONTRIBUTING.md) before opening a pull
  request.
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md) to keep the community
  welcoming.
- File issues using the templates under `.github/ISSUE_TEMPLATE/` so we can
  triage efficiently.

Thank you for helping us build a safer way to manage Google Drive permissions!
