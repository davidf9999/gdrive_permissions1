# Auto-Sync Guide

## Overview

The Auto-Sync feature allows the Permission Manager to run automatically on a schedule, eliminating the need for users to manually trigger syncs. This is particularly useful for:

- **NGOs with volunteers** - Volunteers can edit sheets without needing to run scripts
- **Teams with non-technical users** - No need to understand or trigger syncs
- **24/7 operations** - Changes are automatically applied within the scheduled interval
- **Avoiding OAuth complexity** - The script runs with the owner's permissions only

---

## How It Works

### The Problem It Solves

**Without Auto-Sync:**
1. Volunteer edits sheet (adds user email)
2. Volunteer must click "Permissions Manager → Full Sync"
3. Volunteer may need to authenticate with Google
4. May encounter permission errors if not a Workspace user

**With Auto-Sync:**
1. Volunteer edits sheet (adds user email)
2. **That's it!** The change is automatically applied within 1 hour (or your chosen interval)
3. No authentication required from volunteer
4. Script runs with the owner's (your) permissions

---

## Setup Instructions

### Step 1: Enable Auto-Sync

1. Open your Permission Manager spreadsheet
2. Go to **Permissions Manager → Auto-Sync → ⚡ Setup Auto-Sync (Hourly)**
3. Click "OK" when prompted

That's it! The script will now run automatically every hour.

### Step 2: Verify It's Running

To confirm auto-sync is active:

1. Go to **Permissions Manager → Auto-Sync → 📊 View Trigger Status**
2. You should see: "Auto-sync is ENABLED"

---

## Configuration Options

### Choose Your Sync Frequency

**Hourly Sync (Recommended)**
- Menu: `Auto-Sync → ⚡ Setup Auto-Sync (Hourly)`
- Runs every 60 minutes
- Good for: Active NGOs with frequent changes

**Daily Sync**
- Menu: `Auto-Sync → 📅 Setup Daily Sync`
- Runs once per day at a specific hour
- Good for: Low-activity organizations

**Custom Interval**
- Menu: `Auto-Sync → ⚙️ Setup Custom Interval`
- Choose: 1, 2, 4, 6, 8, or 12 hours
- Good for: Specific needs

### Enable/Disable in Config Sheet

You can temporarily disable auto-sync without removing the trigger:

1. Open the **Config** sheet
2. Find the row: `EnableAutoSync`
3. Change the value:
   - `TRUE` - Auto-sync will run on schedule
   - `FALSE` - Auto-sync will skip (but trigger remains installed)

This is useful if you want to pause automatic syncing temporarily (e.g., during maintenance).

---

## Google Workspace User Configuration

For the auto-sync feature to function correctly, the Google Workspace user account that owns the script must have specific administrative privileges. This is best accomplished by creating a custom admin role with the minimum necessary permissions.

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

1. **You (the admin) set up auto-sync ONCE:**
   - Install the script (see main README)
   - Run `Setup Auto-Sync (Hourly)` from the menu
   - This creates a time-based trigger

2. **Volunteers can now:**
   - ✅ Edit any sheet (add/remove emails)
   - ✅ Add rows to ManagedFolders
   - ✅ Work with regular Gmail accounts (no Workspace needed)
   - ❌ Don't need to run any menu items
   - ❌ Don't need to authenticate

3. **How volunteers see changes:**
   - Changes appear within 1 hour (or your chosen interval)
   - Check the `Last Synced` column to see when it ran
   - Check the `Status` column for any errors

### Manual Sync (For Immediate Changes)

If you (the admin) need immediate sync:

1. Go to **Auto-Sync → ▶️ Run Manual Sync Now**
2. Confirm when prompted
3. Changes apply immediately

Note: This requires YOU to be logged in (not volunteers).

---

## Advanced Configuration

### Customizing What Gets Synced

By default, auto-sync runs `fullSync()` (adds and deletes). To change this:

1. Open the Apps Script editor: **Extensions → Apps Script**
2. Find the file `Triggers.gs`
3. Locate the `autoSync()` function (around line 68)
4. Change the sync type:

```javascript
// Option 1: Full sync (current default)
fullSync();

// Option 2: Only additions (never removes access)
syncAdds();
```

**When to use adds-only:**
- Your volunteers are less experienced
- You want to manually review deletions
- You prefer a more cautious approach

### Handling Errors

If auto-sync encounters an error:

1. **Email notifications** (if enabled in Config sheet):
   - You'll receive an email with the error
   - Configure: `EnableEmailNotifications = TRUE`
   - Set: `NotificationEmail = your@email.com`

2. **Check the Log sheet:**
   - All auto-sync runs are logged
   - Look for entries starting with "*** Starting scheduled auto-sync..."

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
   - Menu: `Auto-Sync → View Trigger Status`
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
   - Menu: `Auto-Sync → Disable Auto-Sync`
   - Menu: `Auto-Sync → Setup Auto-Sync (Hourly)`

---

## FAQ

### Do volunteers need Google Workspace accounts?

**No!** Volunteers can use free Gmail accounts. Only YOU (the script owner/admin) need a Workspace account.

### Can multiple admins use auto-sync?

The trigger runs with the **script owner's** permissions (whoever deployed it). Other admins can edit sheets, but the sync runs under one account.

### Does auto-sync use quotas?

Yes, but Google's quotas are generous:
- **Trigger quota:** 90 minutes of runtime per day
- **API quotas:** Admin SDK has daily limits

For most NGOs, hourly sync is well within limits. If you hit limits, switch to less frequent syncs (every 4-6 hours).

### Can I see when the next sync will run?

Unfortunately, Google Apps Script doesn't expose this via the UI. But:
- **Hourly triggers:** Run at the top of each hour
- **Daily triggers:** Run at your specified time
- Check the `Last Synced` column to estimate

### What happens if I'm in the middle of editing when sync runs?

No problem! The script:
1. Uses a lock to prevent concurrent runs
2. Reads sheet data at the moment it starts
3. Won't corrupt your edits

Your edits will be picked up in the next sync.

---

## Disabling Auto-Sync

To completely remove auto-sync:

1. Go to **Auto-Sync → 🛑 Disable Auto-Sync**
2. Confirm when prompted
3. The trigger is removed

You can always re-enable it later using Setup Auto-Sync.

---

## Best Practices

### For NGOs with Volunteers:

1. ✅ **Use hourly sync** - Volunteers see changes quickly
2. ✅ **Enable email notifications** - You get alerts on errors
3. ✅ **Train volunteers:**
   - "Edit the sheet, changes apply within an hour"
   - "Check Status column if unsure"
4. ✅ **Run Dry Run Audit weekly** - Verify everything is correct

### For Production Use:

1. ✅ **Start with adds-only** - Never accidentally remove access
2. ✅ **Test with daily sync first** - Verify everything works
3. ✅ **Monitor the Log sheet** - Check for patterns
4. ✅ **Use Config sheet to pause** - Don't delete triggers during testing

---

## Technical Details

### Trigger Lifecycle

When you run "Setup Auto-Sync":

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

---

## Support

If you have questions about auto-sync:

1. Check this guide first
2. Review the Log sheet for errors
3. Run a manual sync to test
4. Open an issue on [GitHub](https://github.com/davidf9999/gdrive_permissions1/issues)

---

## Related Documentation

- [Main README](../README.md) - Initial setup
- [User Guide](./USER_GUIDE.md) - Day-to-day usage
- [Testing Guide](./TESTING.md) - Verify functionality
