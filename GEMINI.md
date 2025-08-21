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
