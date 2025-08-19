# Project Summary

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

## Unresolved Issues

### `clasp push` Deployment Failure

**Issue:** `clasp push` consistently fails with a `Syntax error: ParseError: Unexpected token *` pointing to a `.gs` file located within the Python virtual environment (`.venv/lib/python3.11/site-packages/litellm/proxy/_experimental/out/_next/static/chunks/498-ee02f9b58491d7a9.gs`).

**Impact:** Prevents automated deployment of local Apps Script code changes to the live Google Apps Script project.

**Troubleshooting Attempted:**
*   Enabled Apps Script API.
*   Created and verified `.claspignore` with `.venv/` exclusion.
*   Performed full `clasp` project resets (delete config, re-clone).
*   Isolated the `clasp` project in a separate directory (`apps_script_project`) outside the main project root (where `.venv` resides).

**Current Status:** The issue persists. `clasp` appears to be scanning beyond its specified working directory and ignore rules, finding and attempting to parse irrelevant files within `.venv`.

**Workaround:** Manual copy-pasting of `Code.js` content to the Apps Script editor is currently required for deployment.