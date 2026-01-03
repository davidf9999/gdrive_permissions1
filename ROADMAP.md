# Roadmap

This document outlines the development trajectory for the Google Drive Permissions Manager, including near-term goals and potential long-term enhancements.

## Near-Term Goals

This section highlights specific features and improvements that are planned for upcoming development cycles. The associated links point to proofs-of-concept, pull requests, and design discussions related to each item.

| Feature                                      | Description                                                                                                        | Context & Discussion                                                                                                                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Centralized Logging with Cloud Logging** | Implement a configuration option to stream Apps Script execution logs directly to Google Cloud Logging for improved, centralized monitoring. | [PR #47](https://github.com/davidf9999/gdrive_permissions1/pull/47)<br>[Codex Task](https://chatgpt.com/s/cd_6936b78b56088191b348c1fb7ad96dfe)         |
| **Enhanced Integration Documentation**       | Create comprehensive documentation and examples for integrating the Permissions Manager with other products and internal workflows. | [PR #42](https://github.com/davidf9999/gdrive_permissions1/pull/42)<br>[Codex Task](https://chatgpt.com/s/cd_6936b7da0a9c819194aa7183ddb1348f)         |
| **Streamlined Developer Setup**              | Finalize and document setup options for both cloud-based (GitHub Codespaces) and local development to simplify contributor onboarding. | [PR #44](https://github.com/davidf9999/gdrive_permissions1/pull/44)<br>[Codex Task](https://chatgpt.com/s/cd_6936b811da40819198c1f4a94bf35dc9)         |
| **Local Docker Setup Image**                 | Provide a Dockerfile and optional Docker Compose workflow to run the assistant locally without Codespaces. | TBD |

---

## Future Vision

This section contains ideas for long-term development, aimed at expanding the tool's capabilities, improving user experience, and increasing performance. These are not firm commitments but represent areas of potential growth.

### Core Functionality

- **Support for Shared Drives (Team Drives):** Extend the permission management capabilities to include Google Shared Drives, which use a different permission and membership model than standard folders.
- **Time-Based Access Control:** Introduce the ability to grant temporary access by defining start and end dates for permissions in the user sheets. A scheduled trigger would manage the automated granting and revoking of access.
- **Multi-Approver Workflow:** Require multiple manager approvals before a permission change is synced, with the state managed in a new sheet. See [PR #65](https://github.com/davidf9999/gdrive_permissions1/pull/65) and [Codex Task](https://chatgpt.com/codex/tasks/task_e_6942d181af108320a14ff233c6dbab19).

### Integrations & Extensibility

- **Webhook/API Notifications:** Send notifications for key events (e.g., sync completion, audit failures, manual changes detected) to external services like Slack or Microsoft Teams via webhooks.
- **External System Sync (Connectors):** Re-evaluate and design a "Connectors" feature to allow syncing permissions from an external source of truth, such as an HR system or another database via a REST API.

### User Experience (UX) & Interface

- **Dedicated Web App UI:** Develop a simple, standalone web interface (e.g., using Google Apps Script's HTML Service or a modern web framework) to provide a more intuitive way to manage permissions, view logs, and run syncs, as an alternative to the spreadsheet.
- **Interactive Setup Wizard:** Create a guided, step-by-step process within the spreadsheet itself to help first-time users configure their environment and set up their first managed folder.

### Performance & Scalability

- **Advanced Batching:** Further optimize API interactions by batching more operations across different groups and folders in a single request to Google's APIs.
- **Intelligent Caching:** Implement a more sophisticated caching layer that intelligently invalidates and refreshes cached data (like group memberships) to reduce API quota usage while ensuring data freshness.

### Developer Experience & Maintainability

- **Expanded Test Coverage:** Increase the scope of the automated test suite (both Apps Script tests and Jest tests) to cover more complex edge cases and user scenarios.
- **CI/CD Pipeline for Apps Script:** Enhance the development workflow by creating a CI/CD pipeline that automates the deployment of the Apps Script project to staging and production environments based on Git branches.
