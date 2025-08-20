# Project Summary

## Maintaining Project Context

This `GEMINI.md` file serves as a living document to maintain project context across different CLI sessions and for future reference. It is crucial to keep this file updated with significant changes, resolved issues, and key decisions. This practice ensures that any future interactions with this project, especially through CLI agents, are well-informed and efficient.

### Git Best Practices for CLI Agents

When interacting with this repository via a CLI agent, please adhere to the following Git practices to ensure the repository remains consistent and up-to-date:

*   **Commit Frequently:** Make small, atomic commits that address a single logical change.
*   **Descriptive Commit Messages:** Use clear and concise commit messages that explain *what* was changed and *why*. Follow conventional commit guidelines (e.g., `feat:`, `fix:`, `docs:`).
*   **Push Regularly:** Push changes to the remote repository frequently to avoid merge conflicts and keep the remote up-to-date.
*   **Review `git status`:** Before making changes or committing, always review `git status` to understand the current state of the repository.
*   **Add Necessary Files:** Ensure all new or modified files relevant to the project are added to Git.
*   **Remove Obsolete Files:** Remove any files that are no longer needed from the repository.

## Objective
Grant non-owners edit access to specific Drive folders via Google Group membership, where group members are managed from a Google Sheet (no domain-wide delegation / impersonation).

## Current Auth/Setup
* **GAM** is configured with a Desktop OAuth client (oauth2.txt) and works for Directory/Admin ops.
* **Service-account key upload** is blocked by org policy, so we are deliberately not using DWD/impersonation.
* This setup is compatible with our plan; impersonation is only needed if we must act as arbitrary users without sharing. (Apps Script advanced services + time-driven triggers cover our needs.) 

## Decisions
* Manage group membership via GAM and/or Apps Script.
* Folder sharing to the Group (Editor role) is now automated via Apps Script.
* Use Apps Script time-driven triggers to keep membership in sync on a schedule; no deployment required for triggers or custom menus.

## What Works Now
* `gam info domain` and `gam print users` succeed.
* The `editors@dfront1.com` Group exists; you can bulk-add members with `gam csv ... add member ~Email`. 
* The Apps Script (`access_control.js`) is fully implemented and working, including:
    * Syncing group members from a Google Sheet (with pagination, add/remove diffs, logging, summary alert, and a custom "Group Sync Tools" menu).
    * Automatically sharing the target Drive folder with the `editors@dfront1.com` group (Editor role) via the `shareFolderWithGroup` function.
    * The `showPermissions` function confirms the group is correctly on the folder's ACL.

## Open Items / Common Blockers
* If an external user can't open the folder after joining the group, check:
    * External sharing policy allows sharing outside your domain. 
    * Group settings permit external members.
    * Wait for propagation and re-test in an incognito session.
* **GAM Drive ACL commands** like `gam user <owner> add/show drivefileacl` will fail without a service account (they require impersonation). Use the Drive UI or Apps Script with the owner's session instead.

## Next Steps (Recommended)
* Ensure **Admin SDK** is enabled as an Advanced Service for the Apps Script project.
* Add/keep the custom menu (`onOpen`) and create a time-driven trigger (hourly/daily) via `ScriptApp.newTrigger('syncGroupFromSheet').

## Development Workflow
* The Apps Script code is managed locally using `clasp`.
* The project is version-controlled with Git and GitHub, using a configured `.gitignore` file to exclude sensitive files.

---

**Important Note for Multi-Session/Multi-User Development:**
If working with this repository from multiple CLI sessions or with other collaborators on the same local directory, please be aware that file changes made by one session/user are immediately reflected on disk. To ensure this AI agent is working with the most current information, explicitly request to re-read relevant files (e.g., `read_file <path/to/file>`) if you suspect external modifications have occurred since the last time this agent accessed them.

## Resolved Issues

### `clasp push` Deployment Failure

**Resolution:** This issue has been resolved. The problem was caused by `clasp` incorrectly scanning the Python virtual environment (`.venv`) during deployment attempts, despite `.claspignore` configurations.

**Steps Taken:**
1.  The `.venv` directory was removed from the project root.
2.  The Apps Script project files (`Code.js`, `appsscript.json`, and `.clasp.json`) were consolidated into the `apps_script_project` directory. This ensures `clasp` operates within a dedicated and isolated project context.
3.  `clasp push` now executes successfully from within the `apps_script_project` directory, confirming that local changes can be deployed to the Google Apps Script project.