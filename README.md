# Google Drive Permission Manager

This repository contains a complete, automated solution for managing access to a large number of Google Drive folders for many users. It uses Google Groups, controlled by a central Google Sheet, to provide a scalable and auditable permissions system.

It is designed to be set up from scratch by any user with a Google Workspace account, using a containerized setup wizard that provisions all necessary cloud infrastructure automatically.

---

## The Problem: Managing Drive Access at Scale

Google Drive is a powerful collaboration tool, but managing permissions directly on folders becomes difficult and error-prone as your organization grows:

*   **Insecure Public Sharing:** The simplest way to share is with "anyone with the link." However, for sensitive or confidential data, this is not a secure option as the link can be forwarded or shared publicly, granting access to anyone.
*   **Direct Sharing Limits:** For secure, direct sharing, a single Google Drive file or folder can only be shared with a maximum of 100 users or groups who can have editor/viewer/commenter access. For larger teams, this limit is quickly reached.
*   **Lack of Centralization:** When permissions are managed on a folder-by-folder basis, there is no central place to see "who has access to what." This makes auditing and management difficult.
*   **Manual Workload:** Manually adding and removing individual users from many different folders is time-consuming and prone to human error.

## The Solution: Google Groups and Automation

This project solves these problems by using **Google Groups** as the access control mechanism. Instead of sharing a folder with 100 individual users, you share it with a single Google Group. You can then add hundreds (or thousands) of members to that group.

This solution automates the entire lifecycle of this approach:

1.  You define which folders to manage in a central Google Sheet.
2.  The script automatically creates dedicated Google Groups for different roles (e.g., `project-x-editors@your-domain.com`).
3.  You manage the membership of these groups simply by adding or removing emails from other sheets.
4.  The script runs automatically to sync the group memberships, effectively granting or revoking access to the Drive folders.

### Why is a Google Workspace Account Required?

While Google Groups can be used with free `@gmail.com` accounts, the **automation** of group management is a feature exclusive to **Google Workspace**.

*   **The Admin SDK API:** To create groups, add members, and remove members programmatically, this script needs to use the Google Admin SDK API.
*   **Workspace-Only Access:** Access to the Admin SDK API is only granted to users who are part of a Google Workspace domain. It is not available for standard Gmail accounts.

Therefore, a (paid) Google Workspace account is a fundamental requirement to enable the automation that makes this solution powerful.

**Important Clarification:** Only **one** Google Workspace account is needed—the account used by the administrator to run the setup wizard and own the project. The end-users who are granted access to the folders can have **any type of Google account**, including free, personal `@gmail.com` accounts.

---

## Getting Started

This project includes a complete, automated setup wizard that runs inside a Docker container. It will guide you through creating and configuring all the necessary Google Cloud and Apps Script resources.

To begin, please follow the step-by-step guide here: **[docs/ONBOARDING.md](./docs/ONBOARDING.md)**