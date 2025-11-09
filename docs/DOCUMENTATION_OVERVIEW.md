# Documentation Overview

This file provides a summary of all the Markdown documentation files in this project, their purpose, and recommendations for keeping them clean and effective.

| File Path | Purpose & Goal | Target Audience | Review Notes |
| :--- | :--- | :--- | :--- |
| `README.md` | The main entry point. Explains what the project does, who it's for, and provides the primary (manual) setup instructions. | New Users & Developers | **Role is clear.** This is the front door to the project. |
| `gdrive_permissions1.md` | A concise, high-level overview of the current architecture, components, and data flow. | Developers & AI Agents | **Role is clear.** Serves as a quick technical reference. |
| `GEMINI.md` | A historical log of the project's evolution, documenting past problems, debugging journeys, and major refactoring decisions. | Developers & AI Agents | **Role is clear.** Explains *why* the architecture is the way it is. |
| `docs/USER_GUIDE.md` | A detailed "how-to" guide for end-users on the daily operation of the spreadsheet interface after setup is complete. | End-Users | **Role is clear.** Good separation from the `README.md`'s setup guide. |
| `docs/TESTING.md` | Explains how to use the built-in testing functions (`Manual Access Test`, `Stress Test`, etc.) and interpret their results. | Developers & Power Users | **Role is clear.** |
| `docs/ONBOARDING.md` | A prerequisite guide for users who need to set up a Google Workspace and Google Cloud Billing account from scratch. | New Users (less technical) | **Suggestion:** This content could be merged into the `README.md`'s prerequisite section to consolidate all setup steps. However, keeping it separate as a detailed "Step 0" guide is also reasonable. |
| `docs/USER_GUIDE_he.md`| Hebrew translation of the `USER_GUIDE.md`. | Hebrew-speaking End-Users | **Role is clear.** |
| `AGENTS.md` | Provides instructions and guidelines for AI agents on coding style, project structure, and commit conventions. | AI Agents (like me) | **Role is clear.** This is my primary instruction file. |
| `CLAUDE.md` | Contains similar instructions as `AGENTS.md`, but is specific to a different AI model. | AI Agents (Claude) | **Redundant.** This file is largely redundant with `AGENTS.md`. To maintain a single source of truth for AI agent instructions, I recommend deleting this file and consolidating any unique, valuable information into `AGENTS.md`. |