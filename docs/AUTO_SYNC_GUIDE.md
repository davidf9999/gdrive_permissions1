# AutoSync Guide

## Overview

The AutoSync feature allows the Permission Manager to run automatically on a schedule, eliminating the need for users to manually trigger syncs. This is particularly useful for:

- **NGOs with volunteers** - Volunteers can edit sheets without needing to run scripts
- **Teams with non-technical users** - No need to understand or trigger syncs
- **24/7 operations** - Changes are automatically applied within the scheduled interval
- **Avoiding OAuth complexity** - The script runs with the owner's permissions only

---

## How It Works

### The Problem It Solves

**Without AutoSync:**
1. Volunteer edits sheet (adds user email)
2. Volunteer must click "Permissions Manager → Full Sync"
3. Volunteer may need to authenticate with Google
4. May encounter permission errors if not a Workspace user

**With AutoSync:**
1. Volunteer edits sheet (adds user email)
2. **That's it!** The change is automatically applied within 5 minutes (or your chosen interval)
3. No authentication required from volunteer
4. Script runs with the owner's (your) permissions

---

## Setup Instructions

### Step 1: Enable AutoSync

1. Open your Permission Manager spreadsheet
2. Go to **Permissions Manager → AutoSync → ⚡ Setup AutoSync (Every 5 Minutes)**
3. Click "OK" when prompted

That's it! The script will now run automatically every five minutes.

### Step 2: Verify It's Running

To confirm AutoSync is active:

1. Go to **Permissions Manager → AutoSync → 📊 View Trigger Status**
2. You should see: "Auto-sync is ENABLED"

---

## Configuration Options

### Choose Your Sync Frequency

**5-Minute Sync (Recommended)**
- Menu: `AutoSync → ⚡ Setup AutoSync (Every 5 Minutes)`
- Runs roughly every five minutes
- Good for: Active NGOs with frequent changes

**Daily Sync**
- Menu: `AutoSync → 📅 Setup Daily Sync`
- Runs once per day at a specific hour
- Good for: Low-activity organizations

**Custom Interval**
- Menu: `AutoSync → ⚙️ Setup Custom Interval`
- Choose: 1, 2, 4, 6, 8, or 12 hours
- Good for: Specific needs

### Enable/Disable in Config Sheet

You can temporarily disable AutoSync without removing the trigger:

1. Open the **Config** sheet
2. Find the row: `EnableAutoSync`
3. Change the value:
   - `TRUE` - Auto-sync will run on schedule
   - `FALSE` - Auto-sync will skip (but trigger remains installed)

This is useful if you want to pause automatic syncing temporarily (e.g., during maintenance).

---

## Google Workspace User Configuration

For the AutoSync feature to function correctly, the Google Workspace user account that owns the script must have specific administrative privileges. This is best accomplished by creating a custom admin role with the minimum necessary permissions.

### Creating a Custom Admin Role

1.  **Sign in to your Google Admin console.**
    *   Go to [admin.google.com](https://admin.google.com/) and sign in with a super administrator account.

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

6.  **Assign the role to the user.**
    *   Once the role is created, you need to assign it to the user who owns the Apps Script project.
    *   From the "Admin roles" page, click on the custom role you just created.
    *   Click **Assign members**. A new panel or dialog will open.
    *   Enter the name or email of the user.
    *   Click **ASSIGN ROLE**.

After assigning this custom role, the user will have the necessary permissions to manage Google Groups through the script.  

### Note on `gcloud` CLI

It's important to distinguish between Google Workspace admin roles and Google Cloud Platform (GCP) IAM roles. The `gcloud` command-line interface is primarily used for managing GCP IAM roles and resources.

**`gcloud` CLI is NOT used for:**
*   Creating or managing Google Workspace custom admin roles.
*   Assigning Google Workspace admin roles to users.

These operations are performed either through the Google Workspace Admin Console (as described above) or programmatically via the Google Admin SDK Directory API. The `gcloud` CLI does not directly interact with Google Workspace administrative functions for user and role management.

---

## For NGO Administrators

### Setting Up for Your Volunteers

1. **You (the admin) set up AutoSync ONCE:**
   - Install the script (see main README)
   - Run `Setup AutoSync (Every 5 Minutes)` from the menu
   - This creates a time-based trigger

2. **Volunteers can now:**
   - ✅ Edit any sheet (add/remove emails)
   - ✅ Add rows to ManagedFolders
   - ✅ Work with regular Gmail accounts (no Workspace needed)
   - ❌ Don't need to run any menu items
   - ❌ Don't need to authenticate

3. **How volunteers see changes:**
   - Changes appear within 5 minutes (or your chosen interval)
   - Check the `Last Synced` column to see when it ran
   - Check the `Status` column for any errors

### Manual Sync (For Immediate Changes)

If you (the admin) need immediate sync:

1. Go to **AutoSync → ▶️ Run Manual Sync Now**
2. Confirm when prompted
3. Changes apply immediately

Note: This requires YOU to be logged in (not volunteers).

---

## Advanced Configuration

### How AutoSync Handles Deletions

By default, AutoSync is designed to be **non-destructive**. This is a critical safety feature to prevent accidental removal of user permissions.

-   **Auto-sync only performs additions:** It will process new users added to sheets, but it will **not** remove users.
-   **Deletions require manual action:** When the script detects that a user should be removed, it does not perform the deletion. Instead, it sends an email notification to the administrator with the subject "⚠️ Manual Action Required: Permission Deletions Pending".
-   **Manual Deletion Step:** To execute the pending deletions, you must run **Permissions Manager → Sync Deletes** from the menu. This allows you to review and confirm the changes before they are applied.

This "Risk-Based" approach ensures a human is always in the loop for destructive operations, preventing accidental lockouts.

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
1. Open the `SyncHistory` sheet
2. Find the sync you want to review by timestamp
3. Click the "View History" link in that row
4. In the version history panel, match the timestamp to find the revision
5. Click on it to view the spreadsheet state at that moment

**2. File Size Limit (Safety Net)**

-   **The Problem:** Google Sheets automatically saves version history, which can cause the file to grow over time.
-   **The Solution:** A `MaxFileSizeMB` setting in the `Config` sheet (defaulting to 100 MB) acts as a safeguard.
-   **How it works:** Before each AutoSync, the script checks the spreadsheet's total size. If it exceeds the configured limit, the sync is **aborted**, and an email alert is sent to the administrator. This prevents the file from becoming unusably large and prompts you to perform manual cleanup.
-   **Manual Cleanup:** You can delete old versions by going to **File → Version history → See version history** in your spreadsheet.

### Handling Errors

If AutoSync encounters an error:

1. **Email notifications** (if enabled in Config sheet):
   - You'll receive an email with the error
   - Configure: `EnableEmailNotifications = TRUE`
   - Set: `NotificationEmail = your@email.com`

2. **Check the Log sheet:**
   - All AutoSync runs are logged
   - Look for entries starting with "*** Starting scheduled AutoSync..."

3. **Manual intervention:**
   - Run **Run Manual Sync Now** to see the error in real-time
   - Fix the issue in the sheet
   - Next scheduled run will retry

---

## Troubleshooting

### "Auto-sync skipped: another sync is already in progress"

**Cause:** A previous sync is still running when the next one starts.

**Solution:**
- This is normal for very large syncs
- The lock ensures only one sync runs at a time
- Next scheduled run will work fine

### "Auto-sync is disabled in Config sheet"

**Cause:** The `EnableAutoSync` setting in Config is `FALSE`.

**Solution:**
- Open the Config sheet
- Change `EnableAutoSync` to `TRUE`
- Next scheduled run will execute

### Triggers aren't running

**Check:**

1. **Verify trigger exists:**
   - Menu: `AutoSync → View Trigger Status`
   - Should show "Auto-sync is ENABLED"

2. **Check trigger in Apps Script:**
   - Extensions → Apps Script
   - Click the clock icon (⏰ Triggers) in the left sidebar
   - Should see: `autoSync` function listed

3. **Check execution log:**
   - Extensions → Apps Script
   - Click "Executions" in the left sidebar
   - Recent runs of `autoSync` should appear

4. **Re-install trigger:**
   - Menu: `AutoSync → Disable AutoSync`
   - Menu: `AutoSync → Setup AutoSync (Every 5 Minutes)`

---

## FAQ

### Do volunteers need Google Workspace accounts?

**No!** Volunteers can use free Gmail accounts. Only YOU (the script owner/admin) need a Workspace account.

### Can multiple admins use AutoSync?

The trigger runs with the **script owner's** permissions (whoever deployed it). Other admins can edit sheets, but the sync runs under one account.

### Does AutoSync use quotas?

Yes, but Google's quotas are generous:
- **Trigger quota:** 90 minutes of runtime per day
- **API quotas:** Admin SDK has daily limits

For most NGOs, a 5-minute sync cadence is well within limits. If you hit limits, switch to less frequent syncs (every 4-6 hours).

### Can I see when the next sync will run?

Unfortunately, Google Apps Script doesn't expose this via the UI. But:
- **5-minute trigger:** Runs approximately every five minutes
- **Daily triggers:** Run at your specified time
- Check the `Last Synced` column to estimate

### What happens if I'm in the middle of editing when sync runs?

No problem! The script:
1. Uses a lock to prevent concurrent runs
2. Reads sheet data at the moment it starts
3. Won't corrupt your edits

Your edits will be picked up in the next sync.

---

## Disabling AutoSync

To completely remove AutoSync:

1. Go to **AutoSync → 🛑 Disable AutoSync**
2. Confirm when prompted
3. The trigger is removed

You can always re-enable it later using Setup AutoSync.

---

## Best Practices

### For NGOs with Volunteers:

1. ✅ **Use 5-minute sync** - Volunteers see changes quickly
2. ✅ **Enable email notifications** - You get alerts on errors
3. ✅ **Train volunteers:**
   - "Edit the sheet, changes apply within 5 minutes"
   - "Check Status column if unsure"
4. ✅ **Run Folders Audit weekly** - Verify everything is correct

### For Production Use:

1. ✅ **Start with adds-only** - Never accidentally remove access
2. ✅ **Test with daily sync first** - Verify everything works
3. ✅ **Monitor the Log sheet** - Check for patterns
4. ✅ **Use Config sheet to pause** - Don't delete triggers during testing

---

## Technical Details

### Trigger Lifecycle

When you run "Setup AutoSync":

1. Script creates a time-based trigger via `ScriptApp.newTrigger()`
2. Trigger is stored in the project's trigger list
3. Google's servers call `autoSync()` on schedule
4. Function runs with **your** authentication context
5. Volunteers never interact with the trigger

### Security Model

- **Script runs as:** The project owner (you)
- **Permissions used:** Your Google Workspace admin permissions
- **Volunteers see:** Only the spreadsheet, no script access
- **OAuth:** Only you need to authorize the script

This is why volunteers don't need Workspace accounts!

### Change Detection & Self-Healing

AutoSync intelligently detects when changes require a sync:

**When AutoSync Runs:**
1. **Data Changes** - When ManagedFolders, Admins, or UserGroups sheets are modified
   - Uses SHA-256 hash of actual data content
   - Ignores formatting, validation rules, and status updates
2. **Folder Changes** - When managed Google Drive folders are modified
3. **Previous Sync Failed** - Automatically retries failed syncs

**Self-Healing Behavior:**
- If a sync fails (error, manual termination, validation failure), AutoSync automatically retries on the next schedule
- No manual intervention needed - system recovers automatically
- Logged as: "Previous AutoSync run did not complete successfully or status unknown. Retrying."

**What Doesn't Trigger AutoSync:**
- Opening the spreadsheet
- Applying validation rules or formatting
- Updating Config sheet settings
- Status column updates
- Log entries

This smart detection prevents unnecessary syncs while ensuring reliable automatic recovery from failures.

---

## Support

If you have questions about AutoSync:

1. Check this guide first
2. Review the Log sheet for errors
3. Run a manual sync to test
4. Open an issue on [GitHub](https://github.com/davidf9999/gdrive_permissions1/issues)

---

## Related Documentation

- [Main README](../README.md) - Initial setup
- [User Guide](./USER_GUIDE.md) - Day-to-day usage
- [Testing Guide](./TESTING.md) - Verify functionality