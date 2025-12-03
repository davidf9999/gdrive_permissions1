# Roles and Responsibilities

This document outlines the different roles involved in setting up and using the Google Drive Permission Manager.

Following are some of the roles involved in setting up and using this system. During setup, you will primarily act as the **Script Executor**, and you will use a **Google Workspace Super Admin** account to perform privileged actions.

| Role | Account Type | Relevance | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Script Executor / You** | Standard Google Account (e.g., `you@gmail.com`) or Workspace Account. | **Setup-critical** | The user running the commands in the terminal. You will launch the AI Assistant and follow its guidance. |
| **Google Workspace Super Admin** | Workspace Account (`admin@your-domain.com`). **Cannot** be a personal `@gmail.com` account. | **Setup-critical** | The administrative account used to authorize the script, create groups, and perform actions inside the Google Workspace Admin Console. |
| **Sheet Editor** | Any Google Account. | Post-setup | A trusted user who manages folder permissions day-to-day by editing the control spreadsheet. This role does not need Super Admin rights. |
| **End User** | Any Google Account. | Post-setup | A regular user who is granted access to folders by the system. |
