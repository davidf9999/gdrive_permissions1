# Roles and Responsibilities

You've raised an excellent point about the distinction between the person performing the setup and the various digital accounts they use. Let's clarify the roles with that in mind.

### Personas vs. Accounts

-   **The Installer (Human Being):** This is you, the person at the keyboard. You have a GitHub account to run the Codespace, and you likely have one or more Google accounts.
-   **The Accounts (Digital Identities):** These are the specific Google accounts that are used to perform actions.

For this system to work, it's critical to use the correct **Account** for the correct task.

### Account Roles

| Role | Account Type | Relevance | Responsibilities |
| :--- | :--- | :--- | :--- |
| **CLI Authenticator** | Google Workspace account with **Super Admin** privileges. | **Setup-critical** | This is the account used to log in when the AI assistant prompts you to authenticate `gcloud`. While you (the Installer) may have many Google accounts, you **must** use the Super Admin account here. This is because the tools used by the assistant (`gcloud`, `clasp`) require Super Admin permissions to manage the GCP project and the Apps Script project. |
| **Sheet Creator & Owner**| Google Workspace account with **Super Admin** privileges. | **Setup & Maintenance** | This is the account that creates the control spreadsheet and therefore owns the Apps Script project. The script will run with this account's authority. For simplicity, this should be the **same account** as the `CLI Authenticator`.|
| **Sheet Editor** | Any Google Account. | **Day-to-Day Operation**| A trusted user who manages folder permissions by editing the control spreadsheet (e.g., adding/removing users). This role does not need Super Admin rights and is managed via the `SheetEditors` tab. |
| **Managed User** | Any Google Account. | **End User** | A regular user who is granted access to folders by the system. Their access is defined by their presence in the permission sheets. |