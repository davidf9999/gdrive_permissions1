# Project Summary: Google Drive Permission Manager

This project has been evolved from a specific script into a general-purpose, distributable solution for managing Google Drive folder permissions at scale. It uses a combination of Google Apps Script, Google Cloud, and Infrastructure as Code principles to provide an automated setup and a robust management system.

## Final Architecture

The project is now structured as a complete installation package with several key components:

1.  **Docker Environment (`docker/Dockerfile`):**
    *   A Docker container provides a consistent, reproducible environment with all necessary dependencies (`gcloud`, `terraform`, `clasp`, `gam`) pre-installed. This eliminates environment-related setup issues for new users.

2.  **Infrastructure as Code (`terraform/`):**
    *   Terraform is used to programmatically provision and configure all required Google Cloud resources. This includes creating a new GCP project, linking it to a billing account, and enabling all necessary APIs.

3.  **CLI Setup Wizard (`scripts/setup.sh`):**
    *   This is an interactive command-line script that serves as the user-facing installer.
    *   It guides the user through authentication, gathers necessary configuration details, and orchestrates the execution of Terraform and `clasp` commands to set up the entire stack.

4.  **Apps Script Core Logic (`apps_script_project/`):**
    *   This remains the heart of the solution. It is the Google Apps Script code that runs within the user's Google Sheet.
    *   It reads the configuration from the `ManagedFolders` sheet and performs the ongoing synchronization of Google Group memberships to manage Drive folder permissions.

## User Workflow

The end-to-end workflow for a new user is as follows:

1.  **Manual Onboarding:** The user follows the `docs/ONBOARDING.md` guide to perform the initial, one-time steps of setting up a Google Workspace account and a billing account.
2.  **Automated Setup:** The user builds and runs the Docker container, which launches the `setup.sh` wizard.
3.  **Wizard Execution:** The wizard guides the user through authenticating their Google account and providing configuration details. It then automatically provisions the GCP project and deploys the Apps Script.
4.  **Ongoing Management:** Once the setup is complete, the user manages all folder permissions directly from the Google Sheet created by the wizard.

## Resolved Issues

*   **Scalability:** The script has been refactored to be fully synchronous, relying on the 30-minute execution window for Google Workspace accounts. This is more user-friendly than the asynchronous model.
*   **Error Handling:** Added more robust error handling and user feedback mechanisms (e.g., `toast` notifications).
*   **Generalization:** The project is no longer tied to any specific domain or user. The setup process is now generic and automated.

## Testing and Scalability

To ensure the solution can handle a large number of folders and users, a "Stress Test" feature has been integrated into the "Permissions Manager" menu in the Google Sheet. This tool allows administrators to:

*   Programmatically generate a large volume of test data, including folders, Google Groups, and user email lists.
*   Execute the `syncAll` function against this large dataset and measure its execution time.
*   Automatically clean up all generated test data after the test is complete.

This provides a robust way to validate the script's performance and identify potential bottlenecks in a given Google Workspace environment.

Additionally, to handle cases where tests are interrupted, the "Testing" submenu in the "Permissions Manager" menu now includes cleanup utilities:

*   **Cleanup Manual Test Data:** Prompts for a test folder name and removes the associated folder, group, and user sheet.
*   **Cleanup Stress Test Data:** Automatically removes all folders, groups, and sheets created by the stress test.

## Development Workflow

The `apps_script_project/Code.js` file in this repository is the single source of truth for the Google Apps Script code. All development and changes should be made to this local file.

To update the script in the remote Google Sheet, the following workflow must be followed:

1.  **Authentication:** Before pushing any changes, you must be authenticated with Google. This can be done by running the `clasp login` command. This will open a browser window for you to log in and authorize `clasp`.

2.  **Pushing Changes:** Once authenticated, you can push the local `Code.js` file to the remote Google Apps Script project by running the `clasp push --project apps_script_project --force` command from the root of the repository. This will overwrite the remote code with your local changes.

This workflow ensures that the code in the Google Sheet is always in sync with the code in the repository.

## Logging

To provide better traceability and a debuggable history of operations, a logging system has been implemented:

*   **Dual Log Sheets:** The system now maintains two separate log sheets:
    *   `Log`: For all primary operational messages.
    *   `TestLog`: For messages generated by the testing and cleanup functions.
*   **Log Management:** A "Logging" submenu has been added to the "Permissions Manager" menu, which includes a "Clear All Logs" option to easily clear the logs when they are no longer needed.
