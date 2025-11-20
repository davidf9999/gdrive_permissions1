# AutoSync Guide

## Overview

The AutoSync feature allows the Permission Manager to run automatically on a schedule, eliminating the need for users to manually trigger syncs. This is particularly useful for:

- **Organizations with distributed teams** - Team members can edit sheets without needing to run scripts
- **Teams with non-technical users** - No need to understand or trigger syncs
- **24/7 operations** - Changes are automatically applied within the scheduled interval
- **Avoiding OAuth complexity** - The script runs with the owner's permissions only

---

## How It Works

### The Problem It Solves

**Without AutoSync:**
1. A user edits a sheet (e.g., adds a team member's email).
2. The user must manually click "Permissions Manager → Full Sync".
3. The user may need to authenticate with Google.
4. May encounter permission errors if not a Google Workspace user with appropriate access.

**With AutoSync:**
1. A user edits a sheet (e.g., adds a team member's email).
2. **That's it!** The change is automatically applied within 5 minutes (or your chosen interval).
3. No authentication required from the sheet editor.
4. The script runs with the owner's (your) permissions, ensuring consistent execution.

---

## Setup Instructions

### Step 1: Enable AutoSync

1. Open your Permission Manager spreadsheet.
2. Go to **Permissions Manager → AutoSync → ⚡ Setup AutoSync (Every 5 Minutes)**.
3. Click "OK" when prompted.

That's it! The script will now run automatically every five minutes.

### Step 2: Verify It's Running

To confirm AutoSync is active:

1. Go to **Permissions Manager → AutoSync → 📊 View Trigger Status**.
2. You should see: "Auto-sync is ENABLED".

---

## Configuration Options

### Choose Your Sync Frequency

**5-Minute Sync (Recommended)**
- Menu: `AutoSync → ⚡ Setup AutoSync (Every 5 Minutes)`
- Runs roughly every five minutes.
- Good for: Active organizations with frequent changes.

**Daily Sync**
- Menu: `AutoSync → 📅 Setup Daily Sync`
- Runs once per day at a specific hour.
- Good for: Low-activity organizations.

**Custom Interval**
- Menu: `AutoSync → ⚙️ Setup Custom Interval`
- Choose: 1, 2, 4, 6, 8, or 12 hours.
- Good for: Specific needs.

### Enable/Disable in Config Sheet

You can temporarily disable AutoSync without removing the trigger:

1. Open the **Config** sheet.
2. Find the row: `EnableAutoSync`.
3. Change the value:
   - `TRUE` - Auto-sync will run on schedule.
   - `FALSE` - Auto-sync will skip (but trigger remains installed).

This is useful if you want to pause automatic syncing temporarily (e.g., during maintenance).

---

## Google Workspace Permissions for the Script Owner

For the AutoSync feature to function correctly, the **Google Workspace user account that owns and deploys the Apps Script project** must have specific administrative privileges. This is crucial for the script to manage Google Groups and Drive permissions on your behalf.

This is best accomplished by creating a custom admin role with the minimum necessary permissions and assigning it to the script owner's account.

### Creating a Custom Admin Role (Recommended)

1.  **Sign in to your Google Admin console with a Super Administrator account.**
    *   Go to [admin.google.com](https://admin.google.com/).

2.  **Navigate to Admin roles.**
    *   From the Admin console Home page, go to **Menu** (☰) > **Account** > **Admin roles**.

3.  **Create a new role.**
    *   Click **Create new role**.
    *   Enter a **Name** for the role (e.g., "Drive and Groups Permission Manager").
    *   (Optional) Enter a **Description** for the role.
    *   Click **CONTINUE**.

4.  **Select privileges for Google Groups.**
    *   In the privileges list, find the section **Admin API privileges**.
    *   Expand the **Groups** entry.
    *   Select the following four privileges:
        *   **Read**
        *   **Create**
        *   **Update**
        *   **Delete**

5.  **Review and create the role.**
    *   Click **CONTINUE**.
    *   Review the selected privileges.
    *   Click **CREATE ROLE**.

6.  **Assign the role to the script owner's user account.**
    *   Once the role is created, assign it to the Google Workspace user account that **owns the Apps Script project**.
    *   From the "Admin roles" page, click on the custom role you just created.
    *   Click **Assign members**. A new panel or dialog will open.
    *   Enter the name or email of the script owner's user account.
    *   Click **ASSIGN ROLE**.

After assigning this custom role, the script owner's account will have the necessary permissions to manage Google Groups through the script.

---

## User Workflows

### Setting Up for Your Team Members

1. **You (the script owner/admin) set up AutoSync ONCE:**
   - Install the script (see main README for setup instructions).
   - Run `Setup AutoSync (Every 5 Minutes)` from the menu.
   - This creates a time-based trigger that runs under your account.

2. **Your team members can now:**
   - ✅ Edit any permission sheet (add/remove emails, update folder details).
   - ✅ Add new entries (folders, user groups) to the `ManagedFolders` or `UserGroups` sheets.
   - ✅ Work with regular Gmail accounts or Google Workspace accounts (no special script permissions needed for them).
   - ❌ Don't need to run any menu items.
   - ❌ Don't need to authenticate with Google for the script.

3. **How team members see changes applied:**
   - Changes they make in the sheets will be automatically applied to Google Drive and Google Groups within 5 minutes (or your chosen interval).
   - They can check the `Last Synced` column in the respective sheets to see when the changes were processed.
   - They can check the `Status` column for any feedback or errors related to their entries.

### Manual Sync (For Immediate Changes)

If you (the script owner/admin) need an immediate sync to apply changes without waiting for the scheduled AutoSync:

1. Go to **Permissions Manager → AutoSync → ▶️ Run Manual Sync Now**.
2. Confirm when prompted.
3. Changes will be applied immediately.

Note: This manual trigger requires you (the script owner/admin) to be logged in and execute it. It does not run under the permissions of other team members.

---

## Advanced Configuration

### How AutoSync Handles Deletions

By default, AutoSync is designed to be **non-destructive**. This is a critical safety feature to prevent accidental removal of user permissions.

-   **Auto-sync only performs additions:** It will process new users added to sheets, but it will **not** automatically remove users or revoke permissions.
-   **Deletions require manual action:** When the script detects that a user should be removed or a permission revoked, it does not perform the deletion automatically. Instead, it sends an email notification to the administrator (configured in the `Config` sheet) with the subject "⚠️ Manual Action Required: Permission Deletions Pending".
-   **Manual Deletion Step:** To execute the pending deletions, you (the administrator) must run **Permissions Manager → Sync Deletes** from the menu. This allows you to review and confirm the changes before they are applied.

This "Risk-Based" approach ensures a human is always in the loop for destructive operations, preventing accidental lockouts or data exposure.

### Auditing and File Size Management

To improve auditability and prevent the spreadsheet from growing too large, the following features have been implemented:

**1. Sync History Sheet (for Auditing)**

-   **What it does:** After each successful AutoSync, the script automatically logs the sync details in a dedicated `SyncHistory` sheet.
-   **What's tracked:**
    -   Timestamp of the sync
    -   Revision ID (Google's internal identifier)
    -   Clickable link to version history
    -   Changes summary (users/groups added, removed, failed)
    -   Sync duration in seconds
-   **The Benefit:** Provides a complete audit trail of all sync operations. You can click "View History" to open Google's version history panel and find the exact state of the spreadsheet at any sync time by matching timestamps.
-   **Retention:** Google automatically keeps revisions for 30-100 days (depending on file activity). After this period, older revisions are automatically deleted by Google.
-   **Configuration:** This feature is always enabled - no configuration needed.

**How to view a past version:**
1. Open the `SyncHistory` sheet.
2. Find the sync you want to review by timestamp.
3. Click the "View History" link in that row.
4. In the version history panel, match the timestamp to find the revision.
5. Click on it to view the spreadsheet state at that moment.

**2. File Size Limit (Safety Net)**

-   **The Problem:** Google Sheets automatically saves version history, which can cause the file to grow over time, potentially impacting performance or hitting Google Drive limits.
-   **The Solution:** A `MaxFileSizeMB` setting in the `Config` sheet (defaulting to 100 MB) acts as a safeguard.
-   **How it works:** Before each AutoSync, the script checks the spreadsheet's total size. If it exceeds the configured limit, the sync is **aborted**, and an email alert is sent to the administrator. This prevents the file from becoming unusably large and prompts you to perform manual cleanup.
-   **Manual Cleanup:** You can delete old versions by going to **File → Version history → See version history** in your spreadsheet. This action helps to reduce the file size.

### Handling Errors

If AutoSync encounters an error:

1. **Email notifications** (if enabled in Config sheet):
   - You'll receive an email with the error.
   - Configure: `EnableEmailNotifications = TRUE`.
   - Set: `NotificationEmail = your@email.com`.

2. **Check the Log sheet:**
   - All AutoSync runs are logged.
   - Look for entries starting with "*** Starting scheduled AutoSync...".

3. **Manual intervention:**
   - Run **Permissions Manager → AutoSync → ▶️ Run Manual Sync Now** to see the error in real-time.
   - Fix the issue in the sheet or underlying configuration.
   - The next scheduled run will retry automatically.

---

## Troubleshooting

### "Auto-sync skipped: another sync is already in progress"

**Cause:** A previous sync is still running when the next one starts.

**Solution:**
- This is normal behavior for very large syncs or if a previous run took longer than the interval.
- The script's locking mechanism ensures only one sync runs at a time, preventing data corruption.
- The next scheduled run will proceed once the lock is released.

### "Auto-sync is disabled in Config sheet"

**Cause:** The `EnableAutoSync` setting in the `Config` sheet is `FALSE`.

**Solution:**
- Open the `Config` sheet.
- Change `EnableAutoSync` to `TRUE`.
- The next scheduled run will execute.

### Triggers aren't running

**Check:**

1. **Verify trigger exists:**
   - Menu: `Permissions Manager → AutoSync → 📊 View Trigger Status`.
   - Should show "Auto-sync is ENABLED".

2. **Check trigger in Apps Script:**
   - Extensions → Apps Script.
   - Click the clock icon (⏰ Triggers) in the left sidebar.
   - You should see the `autoSync` function listed with a time-driven trigger.

3. **Check execution log:**
   - Extensions → Apps Script.
   - Click "Executions" in the left sidebar.
   - Recent runs of `autoSync` should appear. Look for any errors.

4. **Re-install trigger:**
   - Menu: `Permissions Manager → AutoSync → 🛑 Disable AutoSync`.
   - Menu: `Permissions Manager → AutoSync → ⚡ Setup AutoSync (Every 5 Minutes)`.

---

## FAQ

### Do sheet editors need Google Workspace accounts?

**No!** Sheet editors can use free Gmail accounts. Only the **script owner/admin** (the Google Workspace account that owns and deploys the Apps Script project) needs a Google Workspace account with the necessary administrative privileges.

### Can multiple admins use AutoSync?

The AutoSync trigger runs under the permissions of the **script owner's** Google Workspace account (whoever originally deployed the script). While other administrators can edit the sheets and trigger manual syncs, the automated process always uses the script owner's credentials.

### Does AutoSync use quotas?

Yes, all Google Apps Script and Admin SDK operations are subject to Google's daily quotas.
- **Trigger quota:** Google Apps Script triggers have a daily runtime limit (e.g., 90 minutes).
- **API quotas:** The Admin SDK has daily limits for group and user management operations.

For most organizations, a 5-minute sync cadence will be well within these limits. If you experience quota issues, consider switching to less frequent syncs (e.g., every 4-6 hours).

### Can I see when the next sync will run?

Unfortunately, Google Apps Script doesn't expose the exact next trigger time via the UI. However:
- **For 5-minute triggers:** Expect it to run approximately every five minutes.
- **For daily triggers:** It runs at your specified time.
- You can check the `Last Synced` column in your control sheets (e.g., `ManagedFolders`) to estimate the interval.

### What happens if I'm in the middle of editing when AutoSync runs?

No problem! The script:
1. Uses a locking mechanism to prevent concurrent runs, ensuring only one sync operates at a time.
2. Reads sheet data at the moment it starts, taking a consistent snapshot.
3. Will not corrupt your edits.

Your edits will be picked up and applied in the next scheduled sync run.

---

## Disabling AutoSync

To completely remove the AutoSync trigger:

1. Go to **Permissions Manager → AutoSync → 🛑 Disable AutoSync**.
2. Confirm when prompted.
3. The trigger is removed.

You can always re-enable it later using **Permissions Manager → AutoSync → ⚡ Setup AutoSync**.

---

## Best Practices

### For Organizations with Collaborative Teams:

1. ✅ **Use 5-minute sync** - Ensures team members' changes are applied quickly.
2. ✅ **Enable email notifications** - Configure in the `Config` sheet to receive alerts on errors or pending deletions.
3. ✅ **Train team members:**
   - "Edit the sheet, changes apply automatically within minutes."
   - "Check the `Status` column if unsure about the sync result."
4. ✅ **Run Folders Audit weekly** - Use **Permissions Manager → Folders Audit** to periodically verify all permissions are correct.

### For Production Deployments:

1. ✅ **Start with adds-only** - Prioritize safety; AutoSync will only add permissions, never accidentally remove.
2. ✅ **Test with daily sync first** - Verify everything works as expected in a less frequent schedule before increasing frequency.
3. ✅ **Monitor the Log sheet** - Regularly check for patterns, warnings, or errors.
4. ✅ **Use the `Config` sheet to pause** - Temporarily disable AutoSync via `EnableAutoSync` setting during maintenance without deleting triggers.

---

## Technical Details

### Trigger Lifecycle

When you run "Setup AutoSync":

1. The script creates a time-based trigger via `ScriptApp.newTrigger()`.
2. This trigger is stored in the Apps Script project's trigger list.
3. Google's servers call the `autoSync()` function on the specified schedule.
4. The `autoSync()` function runs with the **script owner's** authentication context.
5. Other sheet editors never directly interact with the trigger or the underlying script code.

### Security Model

- **Script runs as:** The Google Workspace account that owns the Apps Script project (the script owner).
- **Permissions used:** The script owner's Google Workspace admin permissions (as configured in the "Google Workspace Permissions for the Script Owner" section).
- **Other sheet editors see:** Only the spreadsheet interface, with no direct access to the script code or triggers.
- **OAuth:** Only the script owner needs to authorize the script's access to Google services.

This design allows team members to edit sheets without needing their own Google Workspace admin accounts or complex authentication.

### Change Detection & Self-Healing

AutoSync intelligently detects when changes require a sync:

**When AutoSync Runs:**
1. **Data Changes** - When `ManagedFolders`, `Admins`, or `UserGroups` sheets are modified.
   - The script uses an SHA-256 hash of the actual data content to detect changes.
   - It ignores formatting, validation rules, and status updates, ensuring only meaningful data changes trigger a sync.
2. **Folder Changes** - When managed Google Drive folders are modified (e.g., renamed, moved).
3. **Previous Sync Failed** - Automatically retries failed syncs.

**Self-Healing Behavior:**
- If a sync fails (due to an error, manual termination, or validation failure), AutoSync automatically retries on the next scheduled interval.
- This provides a degree of self-recovery without manual intervention.
- Failures are logged as: "Previous AutoSync run did not complete successfully or status unknown. Retrying."

**What Doesn't Trigger AutoSync:**
- Simply opening the spreadsheet.
- Applying validation rules or formatting changes (without data modification).
- Updating `Config` sheet settings (unless it's `EnableAutoSync`).
- Changes to status columns or log entries.

This smart detection prevents unnecessary syncs while ensuring reliable automatic recovery from failures.

---

## Support

If you have questions about AutoSync:

1. Check this guide first.
2. Review the `Log` sheet for errors and warnings.
3. Run a manual sync (**Permissions Manager → AutoSync → ▶️ Run Manual Sync Now**) to test immediately.
4. Open an issue on [GitHub](https://www.github.com/davidf9999/gdrive_permissions1/issues).

---

## Related Documentation

- [Main README](../README.md) - Initial setup and overview.
- [User Guide](./USER_GUIDE.md) - Day-to-day usage of the Permission Manager spreadsheet.
- [Testing Guide](./TESTING.md) - How to verify functionality and test your setup.