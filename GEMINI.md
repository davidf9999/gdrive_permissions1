# Project Evolution Summary

This document summarizes the debugging process and final architecture of the Google Drive Permission Manager project.

## Initial Problem

The initial `setup.sh` script, designed to be run within a Docker container for a fully automated setup, was not functional. It suffered from a series of issues related to authentication, idempotency, state management, and outdated command syntax. This led to a pivot in the project's setup strategy.

## Debugging Journey & Resolutions

Through an iterative process, several core issues with the automated setup were diagnosed, leading to the current hybrid manual/automated approach:

1.  **Authentication Failures:** The script failed because `gcloud` auth tokens mounted into the Docker container would expire. The intended fix was to have the user run `gcloud auth login` locally before running the container.

2.  **Lack of Idempotency:** The `setup.sh` script failed on re-runs because `terraform` would try to create a Google Cloud project that already existed. This was partially solved by making the script check if the project exists and use `terraform import` to adopt the existing resources.

3.  **State Persistence & `clasp` Issues:** The original concept relied on the `clasp` command-line tool to manage the Apps Script project. However, this created a critical issue where the vital `.clasp.json` file (linking the local code to the remote script) was created *inside* the container and destroyed when the container exited. Furthermore, `clasp` itself proved unreliable in some environments. This was a major factor in moving away from a `clasp`-based workflow.

4.  **User Experience:** The initial `docker run` command was long and complex. While this was simplified with `docker-compose.yml`, the underlying issues with automation remained.

5.  **Advanced Script Debugging:** A deep debugging session revealed further failures within `setup.sh`:
    *   **Path-Dependence:** The script would `cd` into the `terraform` directory, causing subsequent commands to fail. This was fixed by carefully managing the working directory.
    *   **API Race Conditions:** The script would fail by trying to use a Google Cloud resource immediately after creation, before it had fully propagated. A `sleep` command was added to mitigate this, but it highlighted the fragility of a fully automated approach.

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
    *   `Setup.gs`: Functions for creating and configuring the necessary sheets.
    *   `Sync.gs`: The main functions for syncing permissions (`syncAdds`, `syncDeletes`, etc.).
    *   `Core.gs`: The core logic for interacting with Google Drive and Google Groups.
    *   `Utils.gs`: Helper functions for logging, configuration, and other utilities.
    *   `Help.gs`: Functions for the "Help" menu.
    *   `Audit.gs`: Contains the logic for the new Dry Run Audit feature.
    *   `Tests.gs`: All test-related functions.

*   **`clasp` for Deployment:** Due to the new multi-file structure, using the `clasp` command-line tool is now the **required method** for deploying the script. The old manual copy-paste method is no longer feasible. The `README.md` has been updated with detailed instructions on how to configure and use `clasp`, including setting the `rootDir` in a `.clasp.json` file.

## New Feature: Dry Run Audit

A new "Dry Run Audit" feature was added to allow administrators to verify the integrity of their permissions configuration without making any changes.

*   **Purpose:** The audit checks for discrepancies between the desired state (defined in the Google Sheets) and the actual state (in Google Drive and Google Groups).
*   **How it Works:** When run from the **Permissions Manager > Dry Run Audit** menu, the script performs the following checks:
    1.  **Folder Permissions:** Verifies that each managed folder has the correct Google Group assigned to it with the proper role (Viewer, Editor, etc.).
    2.  **Group Membership:** For every managed group, it compares the list of desired members (from the user sheets) against the actual members in the Google Group.
*   **Reporting:** All findings are logged in a new **`DryRunAuditLog`** sheet. If the sheet is empty after a run, it means no discrepancies were found. The audit will log issues such as:
    *   `Permission Mismatch`: A group has the wrong role on a folder.
    *   `Missing Members`: Users who are in a sheet but not in the corresponding Google Group.
    *   `Extra Members`: Users who are in a Google Group but have been removed from the sheet.
    *   `Folder Not Found`: A folder ID in the sheet does not correspond to an existing folder.

This feature provides a powerful, read-only way to ensure the system is in its expected state and to troubleshoot any issues.