# Roles and Responsibilities

This document outlines the different roles involved in setting up and using the Google Drive Permission Manager. Understanding these roles is key to a smooth setup and operation.

| Role | Account Type | Relevance | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Installer** | Any person following the setup guide. If using the recommended Codespace setup, this person needs a **GitHub account**. | **Setup** | The person running the setup process, interacting with the AI assistant, and performing manual steps in the browser. This is "you" during the setup. |
| **Google Workspace Super Admin** | A Google Workspace account with Super Admin privileges (e.g., `admin@your-domain.com`). **Cannot** be a personal `@gmail.com` account. | **Setup & Maintenance** | The high-privilege account whose **credentials are used to authorize** the setup tools (`gcloud`, `clasp`). This user account creates the master control spreadsheet, owns the script project, and has the authority to manage Google Groups and Drive permissions. |
| **Sheet Editor** | Any Google Account. | **Day-to-Day Operation** | A trusted user who manages folder permissions by editing the control spreadsheet (e.g., adding/removing users from permission sheets). This role does not need Super Admin rights but is controlled via the `SheetEditors` tab. |
| **Managed User** | Any Google Account. | **End User** | A regular user who is granted access to folders by the system. Their access is defined by their presence in the permission sheets. |

### A Note on the "Gemini CLI User"

The user also asked about the "user that is used to run gemini cli". The `gemini-cli` tool itself does not require a specific user. The person running the command is the **Installer**.

However, the **authentication** that happens during the setup process *must* be done using the **Google Workspace Super Admin** account, because the tools that the assistant uses (`gcloud`, `clasp`) require that level of permission. The assistant's prompts have been updated to make this clear.
