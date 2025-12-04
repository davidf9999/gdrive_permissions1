# Roles and Responsibilities

This document outlines the different roles involved in setting up and using the Google Drive Permission Manager. Understanding these roles is key to a smooth setup and operation.

| Role | Account Type | Relevance | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Installer** | A personal GitHub account and an associated email (can be any email, including a free Gmail account). | **Setup** | The person who initiates the setup process. They use their GitHub account to create a Codespace environment and follow the AI Assistant's guidance to install the system. |
| **Google Workspace Super Admin** | A Google Workspace account with Super Admin privileges (e.g., `admin@your-domain.com`). **Cannot** be a personal `@gmail.com` account. | **Setup & Maintenance** | The high-privilege account responsible for all actions within the Google Workspace. This user creates the master control spreadsheet, authenticates the `clasp` CLI to push the script code, and is the owner of the script and the folders it creates. The script runs under this user's authority. |
| **Sheet Editor** | Any Google Account. | **Day-to-Day Operation** | A trusted user who manages folder permissions by editing the control spreadsheet (e.g., adding/removing users from permission sheets). This role does not need Super Admin rights but is controlled via the `SheetEditors` tab. |
| **Managed User** | Any Google Account. | **End User** | A regular user who is granted access to folders by the system. Their access is defined by their presence in the permission sheets. |