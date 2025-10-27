# Project Evolution Summary

This document summarizes the debugging process and final architecture of the Google Drive Permission Manager project.

## Initial Problem

The initial `setup.sh` script, designed to be run within a Docker container for a fully automated setup, was not functional. It suffered from a series of issues related to authentication, idempotency, state management, and outdated command syntax. This led to a pivot in the project's setup strategy.

## Final Architecture & Workflow

The project is now in a robust, well-documented state with a **manual-first** setup approach, which is simpler and more reliable. The automated infrastructure provisioning is now an optional, advanced step for users who need to upgrade to a production environment with higher API quotas.

1.  **Recommended Setup: Manual Copy-Paste**
    *   The primary setup method, as detailed in the `README.md`, involves the user creating a new Google Sheet.
    *   The user then copies the contents of `apps_script_project/Code.js` directly into the Apps Script editor associated with their sheet.
    *   This method is fast, easy to troubleshoot, and does not require any local dependencies like Docker or the Google Cloud SDK.

2.  **Optional Upgrade: Automated Infrastructure Provisioning**
    *   For users who require a dedicated GCP project for higher API quotas, a tool for automated infrastructure setup is provided.
    *   A `docker-compose.yml` file simplifies running the provisioning script. It defines the service, the image to build, and all necessary volume mounts (`~/.config/gcloud`, `./setup.conf`, etc.).
    *   The user runs `docker-compose up --build`, which executes the `scripts/setup.sh` script.
    *   This script uses **Terraform** to create a new GCP project and enable the required APIs.
    *   After the infrastructure is created, the user manually links their existing Apps Script project to the new GCP project number, as described in the `README.md`.

3.  **Improved Documentation:** The `README.md` has been significantly overhauled to reflect the new, simpler manual-first workflow. It now includes clear sections for the recommended manual setup and the optional production upgrade.

4.  **`teardown.sh`:** A helper script is provided to automate the deletion of the GCP project created during the optional upgrade, making it easy to start fresh.

## Core Design Philosophy: The "Stateless Enforcer" Model

A key design decision is how the script handles permissions changes made manually by admins or file owners directly in Google Drive or Google Groups, outside of the control sheet.

The project follows a **"Stateless Enforcer"** model:

*   **The Sheet is the Single Source of Truth:** The Google Sheet is considered the definitive record of who *should* have access.
*   **The Script is a State Enforcer:** The script's primary role is to make the actual state of permissions in Google Drive and Google Groups match the desired state defined in the sheet. It does not have a memory of past states.
*   **Handling Manual Changes ("Configuration Drift"):** Any manual change is considered "configuration drift." The script does not try to preserve or merge these changes. Instead, it provides tools for the administrator to detect and manage them.
    *   **Detection:** The **`Dry Run Audit`** feature is the primary tool for detecting drift. It compares the sheet (desired state) with the live environment (actual state) and logs any discrepancies, such as `Extra Members` (manual additions) or `Missing Members` (manual removals), in the `DryRunAuditLog` sheet.
    *   **Correction:** The **`Full Sync (Add & Delete)`** function acts as the correction mechanism. It will overwrite any manual changes to enforce the state defined in the sheet. For example, an "Extra Member" will be removed from the group, and a "Missing Member" will be added back.

This approach prioritizes simplicity, predictability, and maintainability. The administrator is the "state interpreter" who uses the audit tool to understand drift, while the script is the simple, reliable "state enforcer."

## Enhanced Auditing for Direct Permissions

To address the limitation of the original "Stateless Enforcer" model, which was blind to permissions granted directly to folders and files (bypassing the managed Google Groups), new auditing features have been introduced.

1.  **Manual Addition Auditing:**
    *   The main **`Dry Run Audit`** function has been enhanced to discover users who have been manually added to the system, either by being added to a Google Group directly or by being granted direct access to a folder.
    *   If it finds a user who should be in a sheet but isn't, it will log this finding in the `DryRunAuditLog` sheet with the issue type **`Manual Addition`**.
    *   The **`Merge & Reconcile`** feature uses this exact same discovery logic to propose adding these users to the correct sheet.

2.  **Role Mismatch Auditing:**
    *   The `Dry Run Audit` now performs an additional check. For every member of a managed group, it verifies their specific permission on the associated folder.
    *   If a user's actual permission (e.g., `Editor`) does not match the permission they are supposed to have based on the `ManagedFolders` sheet (e.g., `Viewer`), it will log this in the `DryRunAuditLog` with the issue type **`Role Mismatch`**.
    *   **Important:** This is a detection-only feature. The `Merge & Reconcile` function will **not** attempt to fix these mismatches. Correcting a role mismatch is a manual administrative task, as automatically downgrading a permission could be disruptive.

3.  **Deep Audit (Files & Sub-folders):**
    *   A new, separate function called **`Deep Audit a Folder...`** has been added to the **`Advanced`** menu.
    *   This function prompts the user for the ID of a specific managed folder.
    *   It then performs a **recursive** audit of **every file and sub-folder** within that managed folder.
    *   Any user found to have direct access to any of these items (and who is not in the official Google Group) will be logged in the `DryRunAuditLog` sheet with the issue type **`Direct File Access`**.
    *   **Performance Warning:** This is a powerful but potentially slow and API-intensive operation. It should be used sparingly and is intended for in-depth investigations of specific folders where permission drift is suspected, not for regular, broad audits.

## Refactoring Sync Logic (Add/Delete Separation)

To prevent accidental data loss and provide more granular control, the main synchronization logic was refactored. The single `Sync All` function, which performed both additions and deletions, was supplemented with two new, more specific functions:

1.  **`Sync Adds`**: This is a non-destructive operation. It is designed to be run to add new permissions. It will:
    *   Create new folders and Google Groups if they are defined in the sheets but do not yet exist.
    *   Add new members to Google Groups if they are listed in the user sheets but are not yet in the group.
    *   It will **not** remove any users, groups, or folders.

2.  **`Sync Deletes`**: This is a destructive operation that requires user confirmation before proceeding. It is designed to be run to revoke permissions. It will:
    *   Remove members from Google Groups if they have been removed from the user sheets.
    *   It will **not** add any new users, groups, or folders.

3.  **`Full Sync (Add & Delete)`**: The original `Sync All` function still exists under this name and performs both add and delete operations simultaneously.

This separation makes the script safer to use, especially in environments where manual changes might occur. A dedicated test function, `runAddDeleteSeparationTest`, was also added to verify this new, separated logic.

## Code Refactoring and `clasp` Integration

To improve maintainability and scalability, the monolithic `Code.js` file was refactored into a modular, multi-file structure. This change makes the codebase much easier to understand and manage.

*   **New File Structure:** The logic is now organized into the following files within the `apps_script_project` directory:
    *   `Code.js`: The main file, containing only global constants and the `onOpen()` menu creation function.
    *   `Discovery.gs`: Contains the centralized logic for discovering manual permission changes.
    *   `Setup.gs`: Functions for creating and configuring the necessary sheets.
    *   `Sync.gs`: The main functions for syncing permissions (`syncAdds`, `syncDeletes`, etc.).
    *   `Core.gs`: The core logic for interacting with Google Drive and Google Groups.
    *   `Utils.gs`: Helper functions for logging, configuration, and other utilities.
    *   `Help.gs`: Functions for the "Help" menu.
    *   `Audit.gs`: Contains the logic for the new Dry Run Audit feature.
    *   `Tests.gs`: All test-related functions.

*   **`clasp` for Deployment:** Due to the new multi-file structure, using the `clasp` command-line tool is now the **required method** for deploying the script. The old manual copy-paste method is no longer feasible. The `README.md` has been updated with detailed instructions on how to configure and use `clasp`, including setting the `rootDir` in a `.clasp.json` file.
