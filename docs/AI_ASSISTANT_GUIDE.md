# AI Assistant Guide

This document provides guidance for using and developing the AI-powered assistant for the `gdrive-permissions` project.

## Who Is This Guide For?

*   **Installer:** You are setting up the `gdrive-permissions` system for your organization. Your goal is to use the AI Assistant to get the project running. You will interact with a **Google Workspace Super Admin** account to perform privileged actions. You do not intend to modify the assistant's code. For a full breakdown of roles, see the [Roles and Responsibilities](ROLES_AND_RESPONSIBILITIES.md) guide.

*   **Developer:** You want to modify, extend, or contribute to the AI Assistant itself. Your goal is to work on the codebase of the assistant.

> **Prerequisite:** A GitHub account is required. The recommended setup process uses GitHub Codespaces, which is tied to your GitHub identity.

---

## For Installers: Setting Up the Project

This section is for you if your goal is to get the `gdrive-permissions` project up and running. The AI Assistant will guide you through the process outlined in the main [Setup Guide](SETUP_GUIDE.md).

### Recommended Environment: GitHub Codespaces

We **strongly recommend** using the provided GitHub Codespaces environment. This gives you a pre-configured, zero-installation environment where the AI Assistant can guide you seamlessly. **Do not clone the repository manually;** launch the Codespace directly from the project's `README.md`.

### Testing the Project for Free

The `gdrive-permissions` project requires a Google Workspace account and a registered domain.

1.  **Google Workspace:** The setup requires administrative APIs only available through Google Workspace. A standard `@gmail.com` account will not work. Google offers a **[14-day free trial](https://workspace.google.com/pricing.html)** for new accounts.
    > **Warning:** The free trial usually requires a credit card and must be cancelled before the trial period ends to avoid charges.

2.  **Domain Name:** You will need a domain name. We recommend purchasing one from a registrar like [Namecheap](https://www.namecheap.com/) or [Google Domains](https://domains.google/). We strongly advise against free domain providers, which are often unreliable.

---

## For Developers: Contributing to the AI Assistant

This section is for you if you want to modify or improve the AI assistant.

### Development Environment

The Codespace environment contains all necessary dependencies (`node`, `gcloud`, etc.) to provide a consistent development and testing environment.

### Testing Local Changes

1.  **Make Changes:** Edit the relevant files (e.g., `AI_ASSISTANT_PROMPT.md`) directly within the Codespace.
2.  **Restart the Assistant:** To test your changes, you must restart the assistant by running the startup script in the terminal:
    ```bash
    /bin/bash .devcontainer/start-assistant.sh
    ```
    A new assistant session will begin using the latest version of your files.

### Auto-Committing Changes (Safety Feature)

To prevent you from losing work if your Codespace session times out, the environment is configured to automatically commit your progress after every change.

*   **How it works:** After every action that modifies the workspace (like creating a file), the assistant automatically commits those changes to your current local branch with a message like `codespace-autosave: YYYY-MM-DDTHH:MM:SSZ`.
*   **What to do:** You can treat these as regular commits. When you are ready to make a "real" commit, you can either **amend** the last commit (`git commit --amend`) or **squash** multiple auto-save commits into one (`git rebase -i`).
*   **No Pushing:** This feature only commits locally. It will never push to the remote repository.

### Administrator Setup for Automated DNS

To enable the **Automated DNS Configuration** flow for a tester, an administrator must perform this one-time setup.

1.  **Create Placeholder DNS Record:** In your Cloudflare account, manually create a placeholder `A` record for the tester's assigned subdomain (e.g., `tester1.yourdomain.com`) pointing to a temporary IP like `192.0.2.1`.
2.  **Generate a Scoped API Token:**
    *   In Cloudflare, go to **My Profile -> API Tokens -> Create Token**.
    *   Use the **"Create Custom Token"** template.
    *   **Permissions:** `Zone` -> `DNS` -> `Edit`.
    *   **Zone Resources:** `Include` -> `Specific zone` -> Your root domain.
    *   **Record Resources (Crucial for Security):** `Include` -> `Specific record` -> The tester's specific subdomain (e.g., `tester1.yourdomain.com`). This ensures the token can *only* affect this single record.
3.  **Provide Credentials:** Securely provide the generated `CLOUDFLARE_API_TOKEN`, your `CLOUDFLARE_ZONE_ID`, and your `ROOT_DOMAIN_NAME` to the tester so they can add them as GitHub Codespace secrets.

### Important Notes
*   You **do not** need to create a new Codespace to test prompt or script changes. That is only for changing the Codespace configuration itself (e.g., `devcontainer.json`).
*   You **do not** need to `git pull` or `git fetch` to see your *local* changes. Those commands are for retrieving updates from the remote repository.