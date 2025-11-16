# Google Drive Permission Manager

> **Project status:** Beta — feature complete but still evolving. Expect minor
> breaking changes while we continue to refine the onboarding flow and tooling.

The Google Drive Permission Manager automates Drive folder sharing by treating
one Google Sheet as the source of truth for access. Each folder/role combination
gets its own tab where administrators list email addresses—no scripting
experience required. A bound Apps Script project runs on a five-minute cadence
to keep the relevant Google Groups and Drive permissions aligned with those
tabs. This repository packages that script alongside guided setup
documentation, automated tests, and optional infrastructure helpers so teams can
roll out the workflow consistently.

---

## Table of contents

1. [Key features](#key-features)
2. [Architecture overview](#architecture-overview)
3. [First-time Google Workspace setup](#first-time-google-workspace-setup)
4. [Before you begin](#before-you-begin)
5. [Manual setup with clasp](#manual-setup-with-clasp)
6. [Daily usage](#daily-usage)
7. [Automation & production deployment](#automation--production-deployment)
8. [Documentation map](#documentation-map)
9. [Testing](#testing)
10. [Tearing down the project](#tearing-down-the-project)
11. [Community](#community)

---

## Key features

- **Spreadsheet-first workflow** – Manage Drive access using Google Sheets that
  anyone in the organisation can edit.
- **Google Group indirection** – Each folder/role combination receives its own
  Google Group so Drive never hits the per-folder sharing limit.
- **Safety-first syncs** – Separate menu items for "Sync Adds", "Sync Deletes",
  and "Full Sync" help administrators preview destructive operations.
- **Comprehensive logging** – Operational logs, test logs, and optional email
  notifications make auditing straightforward.
- **Extensive test helpers** – Built-in stress tests and manual access tests are
  available directly from the sheet UI.

---

## Architecture overview

The Apps Script project is split into focused modules (`Core.gs`, `Sync.gs`,
`Audit.gs`, etc.) which are orchestrated by `Code.js`. Configuration lives in
the spreadsheet:

- **ManagedFolders** — master list of folders, their Drive IDs, and the role to
  enforce.
- **Admins** — spreadsheet editors managed automatically by the script.
- **User group tabs** — one sheet per folder-role or named user group containing
  email addresses to sync.
- **Config** — advanced settings such as notification options and logging.
- **Log/TestLog** — operational output for day-to-day monitoring.

A deeper architectural walkthrough is available in
[`gdrive_permissions1.md`](gdrive_permissions1.md).

### Visual system overview

```mermaid
flowchart LR
  subgraph Definition[Folder / Role Definition]
    FR["Managed folder + enforced role"]
  end
  subgraph SharingTargets[Sharing Targets]
    Groups["Managed Google Groups"]
    Individuals["Optional direct user invites"]
  end
  subgraph Membership[List-based Membership]
    GroupSheet["Group tab in control sheet"]
    Users["List of user emails"]
  end

  FR -- "Shared with" --> Groups
  FR -- "Shared with" --> Individuals
  Groups -- "Group contains" --> GroupSheet
  GroupSheet -- "Defines" --> Users
  classDef default fill:#f2f7ff,stroke:#335bff,stroke-width:1.5px,color:#0f1e4d;
  classDef def fill:#eefcf3,stroke:#2e8540,stroke-width:1.5px,color:#0c3214;
  classDef targets fill:#fff7eb,stroke:#ff8b33,stroke-width:1.5px,color:#5a2500;
  classDef membership fill:#f9f0ff,stroke:#8a2be2,stroke-width:1.5px,color:#2e0b4d;
  class FR def;
  class Groups,Individuals targets;
  class GroupSheet,Users membership;
```

```mermaid
flowchart LR
  subgraph Workspace[Google Workspace]
    U[Individual Users]
    G[Google Groups]
  end
  subgraph Drive[Google Drive]
    F[Managed Folders]
  end
  subgraph Sheet[Control Sheets]
    tabs((Folder / Role Tabs))
  end

  tabs -- "Membership source" --> G
  tabs -- "Direct invites (optional)" --> U
  G -- "Shared with" --> F
  U -- "Shared with (direct)" --> F
  classDef default fill:#f2f7ff,stroke:#335bff,stroke-width:1.5px,color:#0f1e4d;
  classDef sheet fill:#fff7eb,stroke:#ff8b33,stroke-width:1.5px,color:#5a2500;
  classDef drive fill:#eefcf3,stroke:#2e8540,stroke-width:1.5px,color:#0c3214;
  classDef workspace fill:#f9f0ff,stroke:#8a2be2,stroke-width:1.5px,color:#2e0b4d;
  class tabs sheet;
  class F drive;
  class U,G workspace;
```

### Operational roles

| Persona / role | What they configure | Day-to-day usage |
| --- | --- | --- |
| **Workspace Super Admin** (a.k.a. Google Workspace Super Administrator) | Creates the Workspace tenant, enables Admin SDK + Drive APIs, authorises the Apps Script project, and grants the automation account least-privilege access. | Periodically reviews audit logs, monitors email alerts, and unblocks escalations that require domain-wide privileges. |
| **Sheet / Automation Admin** | Maintains the control spreadsheet, edits ManagedFolders, ManagedGroups, and Config tabs, and runs the "Sync Adds" / "Sync Deletes" / "Full Sync" menu items. | Updates membership tabs in response to business changes, checks the Status sheet to verify sync recency, and triages any errors surfaced via the Logs or email notifications. |
| **Managed User** (anyone granted access to a folder) | No configuration; they are represented by rows within the relevant group or folder-role tab. | Receives Drive access once the next sync completes, and may use the sheet read-only to confirm which folders they should expect. |

```mermaid
sequenceDiagram
  participant Editor as Sheet Editor
  participant Sheets as Control Sheet
  participant Script as Apps Script (5-min Trigger)
  participant Admin as Workspace Admin APIs
  participant Status as Status Sheet / Dashboard
  participant Alerts as Admin Notifications

  Editor->>Sheets: Update adds/removes or disable users
  Note over Sheets,Admin: Sheet now diverges from Google Workspace permissions
  Script-->>Sheets: Periodic trigger detects changes
  Script->>Admin: Apply adds/deletes to Groups and Folders
  Admin-->>Status: Record sync timestamp & outcome
  Admin-->>Alerts: Email on errors with remediation steps
```

```mermaid
flowchart TD
  subgraph ControlSheet[Control Spreadsheet]
    direction TB
    ManagedFolders["ManagedFolders
(Folder IDs + Roles)"]
    ManagedGroups["ManagedGroups
(Optional Indirection)"]
    subgraph GroupTabs[Group Membership Tabs]
      direction LR
      GroupSheet1[Group: Marketing Editors]
      GroupSheet2[Group: Finance Viewers]
    end
    subgraph FolderRoleTabs[Folder / Role Tabs]
      direction LR
      FolderSheet1[Folder: Marketing Drive → Editor]
      FolderSheet2[Folder: Finance Reports → Viewer]
    end
    Config["Config
(Notifications, API toggles)"]
    Logs["Log / TestLog Sheets"]
  end

  ManagedFolders -.-> FolderSheet1
  ManagedFolders -.-> FolderSheet2
  ManagedGroups -.-> GroupSheet1
  ManagedGroups -.-> GroupSheet2
  GroupSheet1 --> FolderSheet1
  GroupSheet2 --> FolderSheet2
  FolderSheet1 --> Logs
  FolderSheet2 --> Logs
  Config --> Logs

  classDef default fill:#f4fbff,stroke:#1463a5,stroke-width:1.5px,color:#0d273d;
  classDef group fill:#fff6e8,stroke:#d97706,color:#4a1d05;
  classDef folder fill:#effaf3,stroke:#047857,color:#092314;
  classDef config fill:#fce7f3,stroke:#be185d,color:#4a0418;
  classDef log fill:#ede9fe,stroke:#4c1d95,color:#1c0c3f;
  class ManagedFolders,ManagedGroups,GroupSheet1,GroupSheet2 group;
  class FolderSheet1,FolderSheet2 folder;
  class Config config;
  class Logs log;
```

---

## First-time Google Workspace setup

If you are starting from a brand-new Google Workspace tenant, follow the
step-by-step guide in [`docs/WORKSPACE_SETUP.md`](docs/WORKSPACE_SETUP.md). It
walks through:

1. Creating (or reusing) a Workspace tenant and initial Super Admin account.
2. Turning on Google Groups for Business and confirming Super Admin privileges.
3. Creating the control spreadsheet and binding an Apps Script project.
4. Installing this repository with [`clasp`](https://github.com/google/clasp).
5. Enabling the Admin SDK and Drive APIs, granting OAuth consent, and running the
   first sync.

Keep that guide open alongside this README when onboarding new administrators—it
captures every click needed for the initial deployment.

---

## Before you begin

These prerequisites must be in place before you deploy the script:

1. **Google Workspace domain** — personal @gmail accounts cannot access the
   Admin SDK or Drive API required for automation.
2. **Super Admin privileges** — the user performing the setup must be able to
   manage Google Groups and enable Google Cloud APIs.
3. **Registered domain name** — needed for Google Workspace. You can purchase a
   domain during Workspace sign-up if necessary.
4. **Google Cloud billing account** — Apps Script links to a Google Cloud
   project. Enable billing for that project to unlock Admin SDK quota. You can
   create or reuse a billing account from the
   [Cloud Console](https://console.cloud.google.com/billing).

Once these are ready, clone this repository locally and continue with the manual
setup.

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

1. Create a new Google Sheet named something descriptive (e.g., `Drive
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

With APIs enabled, you can return to the sheet and run the initial sync.

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

## Automation & production deployment

The repository includes optional tooling for larger environments:

- **Docker setup wizard** — see `Dockerfile` and `docker-compose.yml` for a
  containerised helper that validates prerequisites and provisions Google Cloud
  resources.
- **Terraform modules** — the `terraform/` directory automates API enablement,
  service accounts, and quota configuration for production.
- **ProductionOptimizations.gs** — optional Apps Script helpers that reduce API
  calls during large syncs.

These steps are optional but recommended when managing thousands of folders or
when multiple administrators collaborate on the same control sheet.

---

## Documentation map

| Topic | Location |
| ----- | -------- |
| End-user how-to guide | [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) |
| Hebrew user guide | [`docs/USER_GUIDE_he.md`](docs/USER_GUIDE_he.md) |
| Testing menus and stress scenarios | [`docs/TESTING.md`](docs/TESTING.md) |
| Edit-only mode walkthrough | [`docs/EDIT_MODE_GUIDE.md`](docs/EDIT_MODE_GUIDE.md) |
| Auto-sync options & safety levers | [`docs/AUTO_SYNC_GUIDE.md`](docs/AUTO_SYNC_GUIDE.md) & [`docs/RISK_BASED_AUTO_SYNC.md`](docs/RISK_BASED_AUTO_SYNC.md) |
| Stopping or pausing scripts | [`docs/STOP_SCRIPTS.md`](docs/STOP_SCRIPTS.md) |
| Workspace + script installation walkthrough | [`docs/WORKSPACE_SETUP.md`](docs/WORKSPACE_SETUP.md) |
| Spreadsheet and script onboarding checklist | [`docs/ONBOARDING.md`](docs/ONBOARDING.md) |
| Architecture deep dive | [`gdrive_permissions1.md`](gdrive_permissions1.md) |
| Historical decisions & debugging notes | [`GEMINI.md`](GEMINI.md) |

---

## Testing

Automated Jest tests validate the merge utilities and supporting JavaScript:

```bash
npm ci
npm test -- --runInBand
```

The Apps Script logic is validated through the in-sheet testing harness. After
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
