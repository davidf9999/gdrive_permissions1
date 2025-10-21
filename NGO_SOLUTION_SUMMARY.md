# NGO Solution Summary: Auto-Sync for Volunteer Collaboration

## Your Original Challenge

You asked:
> "I would like to allow others (in addition to me) to not only edit the control sheets, but also to run the scripts, without defining more google workspace users for this, if possible."

**Context:**
- You're developing this for an NGO (volunteering)
- You have 1 Google Workspace admin user (you)
- Most volunteers have free Gmail accounts
- You attempted a webapp-auth approach but found it too complex
- You need a simple solution that "just works"

---

## The Solution: Auto-Sync Triggers ⭐

### What We Built

Instead of trying to give volunteers permission to run scripts (complex OAuth issues), we made the **script run automatically on a schedule**.

**The workflow is now:**
1. Volunteer edits the spreadsheet (adds/removes emails)
2. **Script automatically runs every hour** (or your chosen interval)
3. Changes are applied without any manual triggering
4. Volunteer never interacts with scripts or menus

### Why This Is Better Than Your webapp-auth Attempt

Your `feature/webapp-auth` branch tried to:
- Create a sidebar UI
- Add `isUserAdmin_()` checks
- Deploy as a web app with shared permissions

**Problems with that approach:**
- ❌ Still requires OAuth consent from volunteers
- ❌ Complex deployment model (web app vs container-bound)
- ❌ Volunteers without Workspace accounts can't use Admin SDK
- ❌ Authorization errors are confusing for non-technical users
- ❌ Requires maintaining two UIs (menu + sidebar)

**Advantages of auto-sync:**
- ✅ Zero OAuth for volunteers
- ✅ Works with free Gmail accounts
- ✅ Simple to understand: "Edit sheet, wait 1 hour"
- ✅ Runs with YOUR permissions always
- ✅ One-time setup, works forever
- ✅ Can be disabled/enabled via Config sheet

---

## What's Included in This Branch

### New Files

1. **`apps_script_project/Triggers.gs`** (237 lines)
   - `setupAutoSync()` - Install hourly trigger
   - `setupDailySync()` - Install daily trigger at specific hour
   - `setupCustomIntervalSync()` - Choose 1, 2, 4, 6, 8, or 12 hours
   - `removeAutoSync()` - Disable all triggers
   - `autoSync()` - The actual sync function that runs on schedule
   - `viewTriggerStatus()` - Check if triggers are installed
   - `manualSync()` - Run sync immediately (for admins)

2. **`docs/AUTO_SYNC_GUIDE.md`** (326 lines)
   - Complete guide for NGO administrators
   - Setup instructions
   - Troubleshooting
   - FAQ section
   - Security explanation
   - Best practices

### Modified Files

3. **`apps_script_project/Code.js`**
   - Added "Auto-Sync" submenu with 7 menu items
   - Clean UI with emojis for easy navigation

4. **`apps_script_project/Setup.gs`**
   - Added `EnableAutoSync` config option (default: TRUE)
   - Allows toggling auto-sync without deleting triggers

5. **`README.md`**
   - Added "Optional: Enable Auto-Sync" section
   - Highlights benefits for NGOs
   - Links to comprehensive guide

---

## How to Use This (For You)

### Initial Setup (One Time)

1. **Deploy the code:**
   ```bash
   clasp push
   ```

2. **Open your spreadsheet**

3. **Install the trigger:**
   - Go to: **Permissions Manager → Auto-Sync → ⚡ Setup Auto-Sync (Hourly)**
   - Click OK

4. **Authorize the script:**
   - First time only, Google will ask for permissions
   - Grant access (you're authorizing YOUR account)

That's it! The script now runs every hour.

### Training Your Volunteers

Tell them:

> "To grant someone access to a folder:
> 1. Find the folder in the ManagedFolders sheet
> 2. Look at the 'UserSheetName' column (e.g., 'ProjectA_Editor')
> 3. Go to that sheet
> 4. Add the person's email address in column A
> 5. Wait up to 1 hour - they'll automatically get access
> 6. Check the 'Status' column to confirm it worked"

**That's it!** No mention of syncs, menus, or scripts.

---

## Configuration Options

### Sync Frequency

Choose what works for your NGO:

**Hourly (Default)**
- Best for: Active organizations with frequent changes
- Changes apply: Within 60 minutes
- Setup: `Auto-Sync → ⚡ Setup Auto-Sync (Hourly)`

**Daily**
- Best for: Low-activity organizations
- Changes apply: Once per day at your chosen hour
- Setup: `Auto-Sync → 📅 Setup Daily Sync`
- You'll be prompted for the hour (0-23)

**Custom Interval**
- Best for: Specific needs (e.g., every 4 hours)
- Changes apply: At your chosen interval
- Setup: `Auto-Sync → ⚙️ Setup Custom Interval`
- Choose from: 1, 2, 4, 6, 8, or 12 hours

### Temporarily Disable

To pause auto-sync without deleting the trigger:

1. Open the **Config** sheet
2. Change `EnableAutoSync` from `TRUE` to `FALSE`
3. Script will skip the next run
4. Change back to `TRUE` when ready

This is useful during:
- Major reorganizations
- Testing new configurations
- Troubleshooting issues

### Permanently Disable

To completely remove auto-sync:

1. **Permissions Manager → Auto-Sync → 🛑 Disable Auto-Sync**
2. Trigger is deleted
3. Can be re-installed anytime

---

## What Happens Behind the Scenes

### The Trigger Lifecycle

1. **You run "Setup Auto-Sync"**
   - Script calls `ScriptApp.newTrigger('autoSync').timeBased().everyHours(1).create()`
   - Google's servers store this trigger

2. **Every hour (or your interval):**
   - Google's servers call the `autoSync()` function
   - Function runs with YOUR credentials (the script owner)
   - No volunteer authentication needed

3. **The autoSync() function:**
   ```javascript
   function autoSync() {
     // Acquire lock (prevent concurrent runs)
     // Check if enabled in Config sheet
     // Run fullSync() or syncAdds()
     // Log results
     // Release lock
   }
   ```

4. **Volunteers see:**
   - Updated `Last Synced` timestamp
   - Updated `Status` column
   - Their changes in Google Drive

### Security Model

**Who can:**
- ✅ **Edit sheets:** Anyone with spreadsheet edit access
- ✅ **Trigger syncs manually:** Only you (via menu)
- ✅ **Automatic syncs:** Run as you, triggered by Google

**Authentication flow:**
- Your volunteers: **No authentication needed**
- You (one time): Authorize script to use Admin SDK
- Triggers: Run with your existing authorization

This is why it works with free Gmail accounts!

---

## Troubleshooting

### Check if Triggers Are Running

**Method 1: Menu**
- **Auto-Sync → 📊 View Trigger Status**
- Should say "Auto-sync is ENABLED"

**Method 2: Apps Script Console**
1. **Extensions → Apps Script**
2. Click the clock icon (⏰ Triggers) in left sidebar
3. Should see: `autoSync` with time-based trigger

**Method 3: Execution Log**
1. **Extensions → Apps Script**
2. Click "Executions" in left sidebar
3. Look for recent `autoSync` runs

### Common Issues

**"Auto-sync skipped: another sync is already in progress"**
- Normal if previous sync is still running
- Large syncs can take several minutes
- Next run will work fine

**"Auto-sync is disabled in Config sheet"**
- Check Config sheet
- Change `EnableAutoSync` to `TRUE`

**Trigger not running at all**
- Verify trigger exists (see methods above)
- Check if you hit daily quota (unlikely)
- Re-install trigger: Disable → Setup again

---

## Comparison: Before vs After

### Before (Manual Syncing)

**Admin workflow:**
1. Edit sheet
2. Go to Permissions Manager menu
3. Click Full Sync
4. Wait for completion
5. Check Status column

**Volunteer workflow:**
1. Edit sheet
2. Tell admin "I made changes"
3. Wait for admin to run sync
4. Hope admin remembered

**Problems:**
- Requires admin intervention
- Delays in applying changes
- Volunteers can't trigger syncs themselves
- Confusion about when changes apply

### After (Auto-Sync)

**Admin workflow:**
1. *(One-time)* Setup auto-sync
2. That's it!

**Volunteer workflow:**
1. Edit sheet
2. Wait up to 1 hour
3. Changes automatically applied

**Benefits:**
- ✅ No admin intervention needed
- ✅ Predictable timing (every hour)
- ✅ Volunteers are self-sufficient
- ✅ Clear expectations

---

## Advanced: Alternative Approaches You Considered

### 1. Web App Deployment (Your feature/webapp-auth)

**What it tried to do:**
- Deploy script as a web app
- Add authorization checks
- Allow volunteers to trigger via sidebar

**Why it's complex:**
- Requires `AuthMode.USER` for user-specific auth
- Each user needs to authorize
- Non-Workspace users can't use Admin SDK
- Deployment URL management
- CORS issues with external domains

**When to use it:**
- If you need real-time, on-demand syncs
- If volunteers have Workspace accounts
- If you have time to manage OAuth flows

### 2. On-Edit Triggers

**What it would do:**
- Run sync automatically when sheet is edited
- Immediate changes (no 1-hour delay)

**Why we didn't implement:**
- ❌ Can cause too many syncs (one per edit)
- ❌ Quota issues with frequent edits
- ❌ No debouncing (hard to implement)
- ❌ Confusing logs (many partial syncs)

**Possible future enhancement:**
- Add debouncing (wait 5 mins after last edit)
- Only trigger on specific sheets
- Included as commented code in Triggers.gs

### 3. Google Groups for Script Access

**What it would do:**
- Add volunteers to a Google Group
- Grant group script execution permissions

**Why it doesn't work:**
- ❌ Still requires individual OAuth per user
- ❌ Doesn't solve Admin SDK permission issue
- ❌ Free Gmail users still can't access Workspace APIs

---

## Next Steps

### For Your NGO

1. **Test the implementation:**
   - Push this branch to your Apps Script project
   - Set up auto-sync
   - Have a volunteer make a test edit
   - Verify it syncs within an hour

2. **Train your volunteers:**
   - Share the workflow (edit sheet, wait 1 hour)
   - Show them the Status column
   - Explain the Log sheet for troubleshooting

3. **Monitor for a week:**
   - Check the Log sheet daily
   - Verify syncs are running
   - Adjust interval if needed

4. **Optional: Enable notifications:**
   - Config sheet: `EnableEmailNotifications = TRUE`
   - Config sheet: `NotificationEmailAddress = your@email.com`
   - You'll get alerts if syncs fail

### For the Open Source Project

1. **Merge this branch:**
   ```bash
   git checkout main
   git merge feature/auto-sync-triggers
   ```

2. **Update CLAUDE.md** (optional):
   - Add section about auto-sync architecture
   - Explain trigger-based approach

3. **Consider adding:**
   - Tests for trigger functions (harder to mock)
   - Dashboard showing trigger history
   - Slack/Teams notifications for syncs

---

## FAQ

### Do I need to keep my computer on?

**No!** Triggers run on Google's servers, not your computer. Once installed, they work 24/7 regardless of whether you're online.

### Can volunteers still use the manual sync menu?

The menu will still be visible, but if volunteers click it, they may get authorization errors (since they don't have Workspace accounts).

**Recommendation:** Just tell volunteers to ignore the menu. Only you (the admin) should use it.

### What if I need an immediate sync?

You can run: **Auto-Sync → ▶️ Run Manual Sync Now**

This runs the sync immediately instead of waiting for the next scheduled time.

### Does this use more quota than manual syncing?

No! It's the same operations, just triggered automatically instead of manually. In fact, it may use LESS quota because:
- Volunteers don't make failed attempts to run scripts
- One sync per hour is predictable (vs. multiple manual runs)

### Can I have different sync schedules for different sheets?

Not currently. All sheets sync together on the same schedule. This is intentional - partial syncs can cause confusion.

If you need this, you could:
- Maintain separate spreadsheets
- Each with its own sync trigger

### What happens if sync fails?

1. **Error is logged** in the Log sheet
2. **Email sent** (if notifications enabled)
3. **Next trigger still runs** (doesn't stop future syncs)
4. **You can investigate** and fix the issue
5. **Next sync will retry** automatically

---

## Conclusion

This auto-sync solution is **perfect for your NGO use case** because:

1. ✅ **Simple for volunteers** - Just edit sheets, no technical knowledge needed
2. ✅ **Works with free Gmail** - No Workspace licenses required
3. ✅ **No OAuth complexity** - Runs with your credentials
4. ✅ **Reliable** - Google's trigger infrastructure is very stable
5. ✅ **Configurable** - Choose frequency that fits your needs
6. ✅ **Transparent** - Log sheet shows all activity

It's **much simpler** than your webapp-auth attempt and solves the same problem more elegantly.

---

## Files to Review

After pushing this branch:

1. **Test in your NGO spreadsheet:**
   - Deploy with `clasp push`
   - Run setup from menu
   - Have volunteer make test edit
   - Wait for auto-sync

2. **Share with volunteers:**
   - Send them the relevant section of AUTO_SYNC_GUIDE.md
   - Or write your own simple instructions based on this

3. **Monitor:**
   - Check Log sheet after first few syncs
   - Verify everything works as expected

Good luck with your NGO project! This should solve your volunteer collaboration challenge elegantly. 🎉
