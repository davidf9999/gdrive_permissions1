# Edit Mode Guide

## Overview

**Edit Mode** allows you to temporarily suspend automatic syncs while making bulk changes to the control sheets. This prevents AutoSync from running in the middle of your edits, which could cause:

- Partial syncs with incomplete data
- Confusion about what's been applied
- Unnecessary API calls
- Potential errors from inconsistent state

Think of Edit Mode like "putting the system on pause" while you work.

---

## When to Use Edit Mode

### ✅ Use Edit Mode When:

1. **Making bulk changes**
   - Adding/removing many folders at once
   - Reorganizing the ManagedFolders sheet
   - Bulk updating user lists

2. **Testing configurations**
   - Trying out new folder structures
   - Testing permission models
   - Experimenting before applying

3. **Troubleshooting**
   - Investigating issues
   - Cleaning up orphan sheets
   - Fixing configuration errors

4. **Training/demonstrations**
   - Showing someone how the system works
   - Creating test scenarios
   - Taking screenshots

5. **Long editing sessions**
   - Working on sheets for more than an hour
   - Want to review everything before applying
   - Making changes across multiple sheets

### ❌ Don't Need Edit Mode When:

- Making a single quick change (adding 1-2 users)
- Just viewing/reading the sheets
- Running manual syncs yourself (they override the schedule anyway)

---

## How to Use Edit Mode

### Entering Edit Mode

1. Open your Permission Manager spreadsheet
2. Go to **Permissions Manager → Edit Mode → 🔒 Enter Edit Mode**
3. Click OK to confirm
4. You'll see:
   - A yellow banner sheet appears (⚠️ EDIT MODE ACTIVE)
   - Auto-sync is now suspended
   - Confirmation dialog

### While in Edit Mode

**What you can do:**
- ✅ Edit any sheets freely
- ✅ Add/remove rows
- ✅ Reorganize content
- ✅ Run manual syncs if you want (via menu)
- ✅ View logs and status
- ✅ Take your time - no rush!

**What happens automatically:**
- ⏸️ Auto-sync triggers skip execution
- 📝 Each skip is logged: "Auto-sync skipped: spreadsheet is in Edit Mode"
- 🟡 Yellow banner remains visible as a reminder
- ⏱️ System tracks how long you've been in Edit Mode

### Exiting Edit Mode

**When you're done editing:**

1. Go to **Permissions Manager → Edit Mode → 🔓 Exit Edit Mode**
2. Confirm when prompted
3. You'll see:
   - Yellow banner disappears
   - Auto-sync resumes normal schedule
   - Summary showing duration

**Important:** Remember to exit Edit Mode! If you forget:
- Auto-sync will stay suspended indefinitely
- The yellow banner will remind you
- Check status: **Edit Mode → 📊 View Edit Mode Status**

---

## Visual Indicator

### The Yellow Banner

When Edit Mode is active, a new sheet appears at the very first position:

```
Sheet: ⚠️ EDIT MODE ACTIVE

┌─────────────────────────────────────────┐
│  ⚠️  EDIT MODE ACTIVE  ⚠️                │
│                                          │
│  Auto-sync is currently SUSPENDED       │
│  while you make changes.                │
│                                          │
│  Enabled at: 2025-10-20 14:30:00       │
│  Enabled by: admin@example.com          │
│                                          │
│  When done editing, use:                │
│  Permissions Manager → Edit Mode →      │
│  Exit Edit Mode                         │
└─────────────────────────────────────────┘
```

**Banner features:**
- 🟡 Light yellow background (hard to miss!)
- 📍 Always appears first in the sheet list
- 🔒 Protected (read-only, warning if you try to edit)
- 📋 Shows who enabled it and when
- 🔄 Updates timestamp when you open the sheet

---

## Checking Edit Mode Status

At any time, check if Edit Mode is active:

**Via Menu:**
**Permissions Manager → Edit Mode → 📊 View Edit Mode Status**

**Via Banner:**
Look for the yellow banner sheet at the beginning

**Via Logs:**
Check the Log sheet for entries like:
- `🔒 EDIT MODE ENABLED by user@example.com`
- `Auto-sync skipped: spreadsheet is in Edit Mode`
- `🔓 EDIT MODE DISABLED by user@example.com (duration: 2 hours 15 minutes)`

---

## How Edit Mode Works Internally

### Priority Order

When AutoSync trigger fires, it checks in this order:

1. **Is another sync already running?**
   - Yes → Skip this trigger (normal behavior)
   - No → Continue checking

2. **Is Edit Mode active?** ⭐ NEW
   - Yes → Skip and log: "spreadsheet is in Edit Mode"
   - No → Continue checking

3. **Is AutoSync enabled in Config sheet?**
   - Yes → Run the sync
   - No → Skip and log: "disabled in Config sheet"

### Storage

Edit Mode uses **Document Properties** to store state:
- `EditMode`: "true" or not set
- `EditModeTimestamp`: ISO timestamp when enabled
- `EditModeUser`: Email of who enabled it

**Why Document Properties?**
- Persists across sessions (doesn't disappear when you close the sheet)
- Specific to this spreadsheet (doesn't affect other projects)
- Survives script edits and redeployments
- Accessible from any trigger or function

---

## Workflow Examples

### Example 1: Reorganizing Folders

**Scenario:** You need to rename 20 folders and update their configurations.

```
1. Enter Edit Mode
   └─> Permissions Manager → Edit Mode → Enter Edit Mode

2. Make changes:
   └─> Rename folders in ManagedFolders sheet
   └─> Update UserSheetName column
   └─> Modify role assignments
   └─> Add new folders

3. Review your changes:
   └─> Read through everything
   └─> Run Folders Audit if desired
   └─> Maybe test with manual sync on one folder

4. Exit Edit Mode
   └─> Permissions Manager → Edit Mode → Exit Edit Mode
   └─> Auto-sync resumes and applies changes at next schedule
```

### Example 2: Training a New Admin

**Scenario:** Teaching a colleague how the system works.

```
1. Enter Edit Mode
   └─> "Let's pause the automatic syncs while I show you..."

2. Demonstrate the sheets:
   └─> Show ManagedFolders configuration
   └─> Explain user sheets
   └─> Walk through a complete workflow
   └─> Create test entries

3. Clean up test data:
   └─> Delete test rows
   └─> Restore original state

4. Exit Edit Mode
   └─> "Now let's let the system resume normal operations"
```

### Example 3: Troubleshooting Errors

**Scenario:** Several folders showing "Error" status, need to investigate.

```
1. Enter Edit Mode
   └─> Don't want AutoSync retrying while investigating

2. Investigate:
   └─> Check Log sheet for error details
   └─> Verify FolderIDs are correct
   └─> Check group emails are valid
   └─> Look for orphan sheets

3. Fix issues:
   └─> Correct folder IDs
   └─> Fix email addresses
   └─> Remove orphan entries

4. Test fix manually (optional):
   └─> Run manual sync on one problematic row
   └─> Verify it succeeds

5. Exit Edit Mode
   └─> Let AutoSync handle the remaining folders
```

---

## What Happens if You Forget to Exit?

Don't worry! There are multiple safeguards:

1. **Visual Reminder**
   - The yellow banner stays visible
   - Hard to miss when you open the spreadsheet

2. **Log Entries**
   - Every skipped AutoSync is logged
   - Reviewing logs will show "spreadsheet is in Edit Mode"

3. **Status Check**
   - Use **View Edit Mode Status** anytime
   - Shows how long it's been enabled

4. **Multiple Admins**
   - Any admin can exit Edit Mode
   - Doesn't have to be the person who enabled it

5. **No Permanent Damage**
   - Auto-sync just waits patiently
   - When you exit, next trigger will run normally
   - No data is lost or corrupted

**Recommendation:** At the end of your work session, always:
- Check for the yellow banner
- Run **View Edit Mode Status** if unsure
- Exit if active

---

## Edit Mode vs Config Sheet Disable

You have two ways to pause AutoSync. What's the difference?

| Feature | Edit Mode | Config Sheet (`EnableAutoSync = FALSE`) |
|---------|-----------|----------------------------------------|
| **Purpose** | Temporary pause during active editing | Long-term disable |
| **Visual indicator** | 🟡 Yellow banner | None |
| **Tracks who/when** | ✅ Yes (shows user & timestamp) | ❌ No |
| **Intent** | "I'm working, please wait" | "Disable this feature" |
| **Typical duration** | Minutes to hours | Days to weeks |
| **Best for** | Bulk edits, troubleshooting | Testing, maintenance mode |

**Use Edit Mode when:** You're actively working and plan to resume AutoSync soon.

**Use Config Sheet when:** You want to disable AutoSync for an extended period or permanently.

---

## Frequently Asked Questions

### Can non-admin users use Edit Mode?

Edit Mode is a menu item, so technically anyone with menu access can use it. However:
- **Best practice:** Only admins should use Edit Mode
- **Why:** Non-admin users don't run syncs anyway (AutoSync does it)
- **Protection:** You could restrict menu access if needed

### Does Edit Mode affect manual syncs?

**No!** You can still run manual syncs while in Edit Mode via:
- Permissions Manager → ManualSync → Full Sync
- Permissions Manager → ManualSync → Add/Enable Users in Groups
- etc.

Edit Mode only suspends **automatic** syncs, not manual ones.

### What if two admins both try to edit?

Edit Mode is **per-spreadsheet**, not per-user:
- Only one Edit Mode state exists
- If already in Edit Mode, entering again shows current status
- Any admin can exit it (doesn't have to be who enabled it)
- The system tracks the original enabler for logging

**Best practice:** Coordinate with other admins before entering Edit Mode.

### Does Edit Mode persist if I close the spreadsheet?

**Yes!** Edit Mode state is saved in Document Properties:
- Survives closing/reopening the sheet
- Survives days/weeks (until you exit)
- Survives script redeployments

This is intentional - you might want to pause AutoSync overnight while planning changes.

### Can I see edit mode history?

Check the **Log** sheet for entries:
- `🔒 EDIT MODE ENABLED by user@example.com`
- `🔓 EDIT MODE DISABLED by user@example.com (duration: 2 hours 15 minutes)`

These show the complete history of Edit Mode usage.

### What if I'm in Edit Mode and the 5-minute trigger fires?

The trigger will:
1. Check Edit Mode status
2. See it's active
3. Log: "Auto-sync skipped: spreadsheet is in Edit Mode"
4. Exit immediately (no sync performed)
5. Try again at next scheduled time

This happens silently - you won't see any dialogs or interruptions.

---

## Tips and Best Practices

### ✅ Do:

1. **Enter Edit Mode for bulk operations**
   - Better safe than sorry
   - Prevents confusion about what's been synced

2. **Check status before big changes**
   - Run **View Edit Mode Status** first
   - Make sure you know the current state

3. **Exit when done**
   - Don't leave it enabled indefinitely
   - Auto-sync is there to help!

4. **Use manual sync to test**
   - While in Edit Mode, test a single change
   - Verify it works before exiting

5. **Coordinate with team**
   - Tell other admins when you're using Edit Mode
   - Prevents confusion

### ❌ Don't:

1. **Don't delete the yellow banner manually**
   - It's protected, but you could override
   - Use Exit Edit Mode instead

2. **Don't forget to exit**
   - Auto-sync won't resume until you exit
   - Check at end of session

3. **Don't use for single-row changes**
   - Overkill for quick edits
   - Auto-sync can handle that

4. **Don't panic if you forget to exit**
   - No data loss
   - Just exit when you notice

---

## Troubleshooting

### "I can't enter Edit Mode"

**Possible causes:**
1. **Already in Edit Mode**
   - Check for yellow banner
   - Run **View Edit Mode Status**
   - Exit first, then re-enter if needed

2. **Script error**
   - Check Log sheet for errors
   - Try refreshing the page
   - Redeploy script if needed

### "Banner sheet disappeared but I'm still in Edit Mode"

If someone manually deleted the banner:

1. Run **View Edit Mode Status**
   - Will show true status
2. If in Edit Mode, just exit normally
   - **Exit Edit Mode** will clean up
3. Banner will be removed properly

### "Auto-sync ran even though I'm in Edit Mode"

Check the Log sheet for the actual message:
- If it says "skipped: spreadsheet is in Edit Mode" → Working correctly
- If it says sync completed → Edit Mode wasn't actually enabled

Run **View Edit Mode Status** to verify current state.

---

## Technical Implementation

For developers working on the codebase:

### Key Functions

**EditMode.gs:**
- `enterEditMode()` - Enable Edit Mode
- `exitEditMode()` - Disable Edit Mode
- `viewEditModeStatus()` - Check current status
- `isInEditMode_()` - Boolean check (used by triggers)
- `addEditModeBanner_()` - Create visual indicator
- `removeEditModeBanner_()` - Remove visual indicator

**Triggers.gs:**
Modified `autoSync()` to check Edit Mode:
```javascript
if (isInEditMode_()) {
  log_('Auto-sync skipped: spreadsheet is in Edit Mode.', 'INFO');
  return;
}
```

### Storage Schema

Document Properties:
```javascript
{
  'EditMode': 'true',  // string, not boolean
  'EditModeTimestamp': '2025-10-20T14:30:00.000Z',  // ISO format
  'EditModeUser': 'admin@example.com'
}
```

---

## Summary

Edit Mode is a simple but powerful feature that gives you control over when syncs happen:

- 🔒 **Enter** when making bulk changes
- ⏸️ **Pauses** AutoSync while you work
- 🟡 **Shows** clear visual indicator
- 🔓 **Exit** when done to resume automation

Think of it as a "Work in Progress" sign for your spreadsheet!