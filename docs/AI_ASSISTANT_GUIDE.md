# AI Assistant Guide

This document provides guidance for using and developing the AI-powered assistant for the `gdrive-permissions` project.

## Who Is This Guide For?

First, it's important to understand the roles within this project's context.

*   **User:** A **User** is typically an administrator who wants to set up and manage the `gdrive-permissions` system for their organization. Your primary goal is to use the AI Assistant to get the project running. You do not intend to modify the assistant's code.

*   **Developer:** A **Developer** is someone who wants to modify, extend, or contribute to the AI Assistant itself. Your goal is to work on the codebase of the assistant.

> **Prerequisite:** A GitHub account is required for all users and developers. The recommended setup process uses GitHub Codespaces, which is tied to your GitHub identity.

---

## For Users: Setting Up the Project with the AI Assistant

This section is for you if your goal is to get the `gdrive-permissions` project up and running.

### Recommended Environment: GitHub Codespaces

For setting up this project, we **strongly recommend** using the provided GitHub Codespaces environment. Launching a Codespace gives you a pre-configured, zero-installation environment where the AI Assistant can guide you through the setup process seamlessly. **You do not need to manually clone the repository; this is handled automatically by Codespaces.** All instructions from the AI assistant assume you are operating within this environment.

You can launch it from the main `README.md` file of the project.

### DNS Configuration Options

Your `gdrive-permissions1` instance needs a web address (DNS record) to be accessible. The AI assistant will help you with this. Depending on your situation, there are two ways this can be handled.

#### Option 1: Manual DNS Configuration

This is the default path if you are setting up the project for your own domain.

*   **Who it's for:** Users who have their own domain and manage their DNS records through a registrar like GoDaddy, Namecheap, Google Domains, etc.
*   **How it works:** The AI assistant will guide you through finding the public IP address of your Codespace environment. It will then provide you with clear instructions to manually create an `A` record at your domain registrar, pointing to your Codespace's IP.

#### Option 2: Automated DNS Configuration

This path provides a seamless, automated experience if an administrator has assigned you a specific subdomain.

*   **Who it's for:** Users or testers who have been provided with a pre-configured subdomain (e.g., `tester1.yourdomain.com`) and special credentials from a project administrator.
*   **How it works:** If you add the provided Cloudflare credentials to your Codespace environment, the AI assistant will detect them. It will then prompt you for your assigned subdomain and automatically create or update the necessary DNS records for you.

### Testing the Assistant for Free

The `gdrive-permissions` project requires a Google Workspace account and a registered domain, which typically involve costs.

1.  **Google Workspace:** The setup process relies on administrative APIs only available through a Google Workspace account. A standard `@gmail.com` account will not work. Google offers a **14-day free trial** for new Workspace accounts, which is ideal for testing.
    > **Warning:** The free trial usually requires a credit card and must be cancelled before the trial period ends to avoid charges.

2.  **Domain Name:** Every Google Workspace account needs its own domain name. We recommend purchasing a low-cost domain from a registrar like Namecheap or Google Domains. We strongly advise against using free domain providers (`.tk`, `.ml`, etc.) as they are often unreliable and may lack the features needed for Google Workspace verification.

---

## For Developers: Contributing to the AI Assistant

This section is for you if you want to modify or improve the AI assistant itself.

### Development Environment

The Codespace environment contains all the necessary dependencies and tools (`node`, `gcloud`, `clasp`). This avoids "it works on my machine" problems and provides a consistent environment for developing and testing.

### Testing Local Changes

1.  **Make Local Changes:** Edit the relevant files, such as `AI_ASSISTANT_PROMPT.md`, directly within the Codespace.
2.  **Restart the Assistant:** To have the assistant use your updated instructions, you must restart it by running the startup script directly in the terminal:
    ```bash
    /bin/bash .devcontainer/start-assistant.sh
    ```
3.  **Test the New Behavior:** A new assistant session will begin, using the latest version of the files you edited.

### Administrator Setup for Automated DNS

To test the **Automated DNS Configuration** flow (Option 2 for users), an administrator or developer must first perform this one-time setup for a tester.

1.  **Create Initial DNS Record:** In your Cloudflare account, manually create a placeholder `A` record for the tester's assigned subdomain (e.g., `tester1.yourdomain.com`) pointing to a temporary, non-Cloudflare IP (e.g., `192.0.2.1`). This record must exist before you can scope an API token to it.
2.  **Generate a Sandboxed API Token:**
    *   Log in to your Cloudflare account.
    *   Go to **My Profile -> API Tokens -> Create Token**.
    *   Select **"Create Custom Token"**.
    *   **Token Name:** Give it a descriptive name (e.g., `gdrive-permissions-tester1-dns`).
    *   **Permissions:** `Zone` -> `DNS` -> `Edit`.
    *   **Zone Resources:** `Include` -> `Specific zone` -> Your root domain.
    *   **Record Resources (Crucial for Security):** `Include` -> `Specific record` -> The tester's specific subdomain (e.g., `tester1.yourdomain.com`). This ensures the token can *only* affect this single record.
    *   Continue to create the token.
3.  **Provide Credentials to Tester:** Securely provide the generated `CLOUDFLARE_API_TOKEN`, your `CLOUDFLARE_ZONE_ID`, and your `ROOT_DOMAIN_NAME` to the tester. The tester will add these as secrets to their GitHub Codespace environment.

### Important Notes for Developers

*   **Save Your Work:** Any changes you make within a Codespace instance are local to that instance. To persist your changes, you *must* regularly commit and push them to your Git repository.
*   You **do not** need to create a new Codespace from the `README.md` button to test prompt or script changes. That is only necessary if you are changing the Codespace configuration itself (e.g., `devcontainer.json`).
*   You **do not** need to run `git pull` or `git fetch` to see your *local* changes. Those commands are for retrieving updates from the remote repository.