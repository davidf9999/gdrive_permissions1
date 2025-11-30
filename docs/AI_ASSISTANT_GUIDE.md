# AI Assistant Guide

This document provides guidance for using and developing the AI-powered assistant for the `gdrive-permissions` project.

## Recommended Environment: GitHub Codespaces

For both setting up this project using the AI assistant and for developing the assistant itself, we **strongly recommend** using the provided GitHub Codespaces environment.

*   **For Users:** Launching Codespaces gives you a pre-configured, zero-installation environment where the AI Assistant can guide you through the setup process seamlessly.
*   **For Developers:** The Codespace contains all the necessary dependencies and tools (`node`, `gcloud`, `clasp`). This avoids "it works on my machine" problems and provides a consistent environment for developing and testing.

All instructions from the AI assistant assume you are operating within the Codespaces environment.

## Developing the AI Assistant

For developers working on the AI assistant itself within the Codespaces environment, here is the recommended workflow for testing changes:

1.  **Make Local Changes:** Edit the relevant files, such as `AI_ASSISTANT_PROMPT.md`, directly within the Codespace.
2.  **Restart the Assistant:** To have the assistant use your updated instructions, you must restart it. You can do this by running the startup script directly in the terminal:
    ```bash
    /bin/bash .devcontainer/start-assistant.sh
    ```
3.  **Test the New Behavior:** A new assistant session will begin, using the latest version of the files you edited.

### Important Notes:

*   **Save Your Work:** Any changes you make within a Codespace instance are local to that instance. To persist your changes and ensure they are not lost if the Codespace is deleted, you *must* regularly commit and push them to your Git repository.
*   You **do not** need to create a new Codespace from the `README.md` button to test prompt or script changes. This is a slow process and is only necessary if you are changing the Codespace configuration itself (e.g., `devcontainer.json`).
*   You **do not** need to run `git pull` or `git fetch` to see your *local* changes. Those commands are for retrieving updates from the remote repository on GitHub, not for loading files you have just edited in your current workspace.

## DNS Configuration Options

This project requires DNS records to be configured for your `gdrive-permissions1` instance to be accessible. Depending on your role, there are two primary ways this can be handled. The AI assistant will adapt its guidance based on your environment's setup.

### Option 1: Manual DNS Configuration (For Independent Users)

This is the default path for users who are setting up `gdrive-permissions1` for their own domain.

*   **Who it's for:** Users who have their own domain and manage their DNS records through a registrar like GoDaddy, Namecheap, Google Domains, etc.
*   **How it works:** The AI assistant will guide you through finding the public IP address of your Codespace environment. It will then provide you with clear instructions to manually create an `A` record (or CNAME record, if applicable) at your domain registrar, pointing to your Codespace's IP.
*   **Administrator Action:** None beyond guiding the user.
*   **User Action:** Follow the AI assistant's instructions to manually configure your DNS at your domain registrar.

### Option 2: Automated DNS Configuration (For Managed Testers)

This option provides a seamless, automated experience for testers who are assigned a specific subdomain by an administrator.

*   **Who it's for:** Testers who have been provided with a pre-configured subdomain (e.g., `tester1.yourdomain.com`) and a special API token by the project administrator.
*   **How it works:** When the AI assistant detects the presence of specific Cloudflare environment variables (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `ROOT_DOMAIN_NAME`), it will prompt you for your assigned subdomain. It will then automatically create or update the necessary DNS records in Cloudflare, pointing your subdomain to your Codespace's IP address.
*   **Administrator Action:**
    *   **One-time setup per tester:** For each tester you wish to onboard, you (the administrator) will need to:
        1.  **Create Initial DNS Record:** In your Cloudflare account, manually create a placeholder `A` record for the tester's assigned subdomain (e.g., `tester1.yourdomain.com`) pointing to a temporary IP (e.g., `1.1.1.1`). This record must exist before you can scope an API token to it.
        2.  **Generate a Sandboxed API Token:**
            *   Log in to your Cloudflare account.
            *   Go to **My Profile -> API Tokens -> Create Token**.
            *   Select **"Create Custom Token"**.
            *   **Token Name:** Give it a descriptive name (e.g., `gdrive-permissions-tester1-dns`).
            *   **Permissions:**
                *   Select `Zone` -> `DNS` -> `Edit`.
            *   **Zone Resources:**
                *   Select `Include` -> `Specific zone` -> Choose **your root domain** (e.g., `yourdomain.com`).
            *   **Record Resources (Crucial for Security):**
                *   Select `Include` -> `Specific record` -> Choose the **tester's specific subdomain** (e.g., `tester1.yourdomain.com`). This ensures the token can *only* affect this single record.
            *   Continue to create the token.
        3.  **Provide Credentials to Tester:** Securely provide the generated API Token (e.g., `CLOUDFLARE_API_TOKEN`) and your Cloudflare Zone ID (e.g., `CLOUDFLARE_ZONE_ID`, found in your Cloudflare dashboard overview for your domain) and your root domain name (e.g., `ROOT_DOMAIN_NAME='yourdomain.com'`) to the tester. The tester will then add these as environment variables to their Codespace.
*   **Tester Action:**
    1.  Receive the `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, and `ROOT_DOMAIN_NAME` from the administrator.
    2.  Add these as environment variables/secrets to their GitHub Codespace environment (e.g., via the Codespaces Secrets interface or by configuring `.env` if using a local `.env` setup).
    3.  Proceed with the AI assistant. When it reaches the DNS configuration phase, it will automatically detect these variables and guide them through the automated process.

## Testing the Assistant for Free

The `gdrive-permissions` project requires a Google Workspace account and a registered domain, which typically involve costs. The models below assume you are using the **Manual DNS Configuration** path (Option 1) unless otherwise specified.

### Understanding the Requirements

1.  **Google Workspace:** The setup process relies on administrative APIs that are only available through a Google Workspace account. A standard `@gmail.com` account cannot be used for the setup. Google offers a **14-day free trial** for new Workspace accounts, which is ideal for testing.
    > **Warning:** The free trial usually requires a credit card and must be cancelled before the trial period ends to avoid charges.
2.  **Domain Name:** Every Google Workspace account needs to be associated with a unique domain name.

### Recommended Testing Models

#### Model A: Individual End-to-End Testing (Manual DNS)

This model is for testers who want to experience the entire setup process from start to finish, managing their own domain.

1.  **Sign up for the Google Workspace 14-day free trial.**
2.  **Purchase a low-cost domain name.** Domains can be purchased for a few dollars for the first year from registrars like Namecheap or Google Domains. This is the most reliable way to get a domain that will work correctly with Google Workspace verification.
3.  Proceed with the AI assistant setup using the new trial Workspace and domain. The assistant will guide you through **Manual DNS Configuration (Option 1)**.
4.  **Remember to cancel the Workspace subscription before the 14-day trial ends.**

#### Model B: Collaborative Assistant Testing (Most Cost-Effective, Manual DNS)

This model is for a group of friends who want to test the AI assistant's functionality *after* the initial Workspace setup, without each person needing a separate domain.

1.  **One person** (the "lead tester") follows Model A: get a Workspace trial and a single cheap domain.
2.  Inside that new Workspace, the lead tester creates several user accounts (e.g., `tester1@your-test-domain.com`, `tester2@your-test-domain.com`).
3.  Each friend can then use one of these user accounts to log in and interact with the AI assistant. They will be able to test all the steps that come after the initial domain setup. They will also use **Manual DNS Configuration (Option 1)**, configuring a subdomain if needed.

#### Model C: Admin-Managed Testing (Automated DNS for Testers)

This model is for an administrator (like yourself) who wants to onboard a small, trusted group of testers to experience the **Automated DNS Configuration (Option 2)**.

1.  **Administrator Actions:**
    *   Set up a Google Workspace account and a domain for testing.
    *   For each tester, follow the "Administrator Action" steps outlined in **Option 2: Automated DNS Configuration** above.
2.  **Tester Actions:**
    *   Receive the required Cloudflare credentials from the administrator.
    *   Add these credentials as environment variables/secrets to their Codespace.
    *   Proceed with the AI assistant. When the DNS configuration phase arrives, they will experience the automated setup.

### What to Avoid

*   **Free Domain Providers:** We strongly advise against using free domain providers (`.tk`, `.ml`, etc.). They are often unreliable, have limited DNS features required for Workspace verification, and can cause unforeseen technical issues.
*   **Sharing Subdomains (Without proper sandboxing):** Do not attempt to create subdomains on a personal or production domain and then grant testers full, un-sandboxed access to your Cloudflare DNS settings. This is an administrative and security risk that can impact your primary domain's reputation. Always use the sandboxed API token method described in **Option 2**.
