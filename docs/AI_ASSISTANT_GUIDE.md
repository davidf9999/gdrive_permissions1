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

## Testing the Assistant for Free

The `gdrive-permissions` project requires a Google Workspace account and a registered domain, which typically involve costs. Here are the recommended models for testing the assistant and the project with minimal to no expense.

### Understanding the Requirements

1.  **Google Workspace:** The setup process relies on administrative APIs that are only available through a Google Workspace account. A standard `@gmail.com` account cannot be used for the setup. Google offers a **14-day free trial** for new Workspace accounts, which is ideal for testing.
    > **Warning:** The free trial usually requires a credit card and must be cancelled before the trial period ends to avoid charges.
2.  **Domain Name:** Every Google Workspace account needs to be associated with a unique domain name.

### Recommended Testing Models

#### Model A: Individual End-to-End Testing

This model is for testers who want to experience the entire setup process from start to finish.

1.  **Sign up for the Google Workspace 14-day free trial.**
2.  **Purchase a low-cost domain name.** Domains can be purchased for a few dollars for the first year from registrars like Namecheap or Google Domains. This is the most reliable way to get a domain that will work correctly with Google Workspace verification.
3.  Proceed with the AI assistant setup using the new trial Workspace and domain.
4.  **Remember to cancel the Workspace subscription before the 14-day trial ends.**

#### Model B: Collaborative Assistant Testing (Most Cost-Effective)

This model is for a group of friends who want to test the AI assistant's functionality *after* the initial Workspace setup, without each person needing a separate domain.

1.  **One person** (the "lead tester") follows Model A: get a Workspace trial and a single cheap domain.
2.  Inside that new Workspace, the lead tester creates several user accounts (e.g., `tester1@your-test-domain.com`, `tester2@your-test-domain.com`).
3.  Each friend can then use one of these user accounts to log in and interact with the AI assistant. They will be able to test all the steps that come after the initial domain setup.

### What to Avoid

*   **Free Domain Providers:** We strongly advise against using free domain providers (`.tk`, `.ml`, etc.). They are often unreliable, have limited DNS features required for Workspace verification, and can cause unforeseen technical issues.
*   **Sharing Subdomains:** Do not attempt to create subdomains on a personal or production domain for your friends to use. This is an administrative and security risk that can impact your primary domain's reputation and is not a realistic test of the setup process.
