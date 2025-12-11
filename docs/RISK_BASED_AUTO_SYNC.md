# Risk-Based AutoSync Strategy

## Executive Summary

This document analyzes the risk levels of different permission management operations and defines a strategy for safe automated synchronization in the Google Drive Permission Manager.

### The Core Problem

**Background triggers cannot display UI dialogs for user confirmation**, causing operations that require user interaction to fail silently when run automatically. Additionally, different operations have vastly different risk profiles when executed incorrectly:

- **Adding permissions incorrectly**: Low risk (over-permissioning, easily noticed and fixed)
- **Removing permissions incorrectly**: High risk (blocks legitimate users, causes business disruption)

### Key Issues Identified

1. **`syncSheetEditors()`** (Sync.gs:64-71) requires confirmation before adding/removing spreadsheet editors
2. **`syncDeletes()`** (Sync.gs:315-324) requires confirmation before removing users from groups
3. **`fullSync()`** (currently called by `autoSync()`) internally calls `syncDeletes()`, which fails in background execution
4. All operations are currently treated equally, regardless of their risk profile

---

## Risk Level Framework

### Simplified Risk Model

The system uses **three risk levels** based on consequence of error and reversibility:

| Risk Level | Operations | Impact if Wrong | AutoSync Treatment | Admin Action |
|:-----------|:-----------|:----------------|:--------------------|:-------------|
| **SAFE**<br>*(Additive)* | • Add users to groups<br>• Create folders & share with groups<br>• Add spreadsheet editors<br>• Create Google Groups<br>• All `syncAdds()` operations including sheet editors | Users get unintended access (easily reverted and detected) | ✅ **Automatic**<br>Runs every 5 minutes with post-notification email | Review summary email; revert if needed |
| **DESTRUCTIVE**<br>*(Reversible Removals)* | • Remove users from groups<br>• Remove spreadsheet editors<br>• Revoke folder permissions<br>• All `syncDeletes()` operations | Users lose access they need, work blocked, requires restoration | 🛑 **Manual Only**<br>Notifies admin, does NOT execute | Run "Remove/Disable Users from Groups" manually after review |
| **CRITICAL**<br>*(Irreversible)* | • `mergeSync()` - Approve manual changes<br>• Delete Google Groups (permanent)<br>• Delete Drive folders (data loss)<br>• Domain-wide bulk changes | Permanent data loss or inadvertent approval of unauthorized access | 🚫 **Always Manual**<br>Never automated, requires human judgment | Run manually with full context |

### Why This Model is Safe

**Key Design Principle**: The distinction between SAFE and DESTRUCTIVE is based on **user impact**, not privilege level.

**Why Sheet Editor Additions are SAFE**:
- Adding wrong editor = Reversible (remove from SheetEditors sheet, sync again)
- Detected quickly (admin email notification immediately after)
- Low blast radius (one person, not mass-change)
- Same recovery path as any wrong permission grant

**Why Deletions are DESTRUCTIVE**:
- Removing legitimate user = Immediate work stoppage
- Hard to detect (user discovers when they try to access)
- High blast radius (affects user productivity immediately)
- Complex recovery (identify who needs access, restore, notify)

### Risk Classification Rationale

**Why is deletion more risky than addition?**

| Scenario | Adding Permissions (Wrong) | Deleting Permissions (Wrong) |
|:---------|:---------------------------|:-----------------------------|
| **User Impact** | User has access they shouldn't (may not even notice) | User loses access they need (immediate work stoppage) |
| **Detection Time** | May go unnoticed for long periods | Detected immediately when user tries to access |
| **Business Impact** | Security risk (contained, no data loss) | Productivity loss, missed deadlines, potential data loss |
| **Reversibility** | Easy to remove excess permissions | May be hard to identify who should have access |
| **User Perception** | Rarely noticed by affected user | User frustration, support tickets, escalations |
| **Remediation** | Simple: remove the incorrect permission | Complex: determine correct permissions, notify user, restore access |

---

## Implementation Strategy

### Phase 1: Fix Current AutoSync Failure

**Current Issue**: `autoSync()` → `fullSync()` → `syncDeletes()` → fails on UI confirmation dialog

**Solution**: Modify `autoSync()` to only call risk-appropriate operations based on configuration.

**Default Behavior**:
- Auto-sync runs **SAFE operations only** (all additions including sheet editors)
- Detects pending DESTRUCTIVE/CRITICAL operations
- Sends email notifications for operations requiring manual execution

### Phase 2: Configuration Settings

Add these settings to the **Config sheet**:

| Setting Name | Default Value | Description |
|:-------------|:--------------|:------------|
| `EnableAutoSync` | `TRUE` | Master switch: enable/disable automatic synchronization |
| `NotifyAfterSync` | `TRUE` | Send email summary after each AutoSync completion |
| `NotifyDeletionsPending` | `TRUE` | Send email when deletions detected (require manual action) |
| `AutoSyncMaxDeletions` | `10` | Safety limit: if deletions exceed this, notify admin but don't allow manual sync without review |
| `MaxFileSizeMB` | `100` | Safety limit: if the total spreadsheet file size exceeds this limit in MB, AutoSync is aborted to prevent uncontrolled file history growth. |
| `_SyncHistory` | Always enabled | (Informational only) Sync history is automatically tracked in the SyncHistory sheet with revision links for auditing (30-100 days retention). |

**No Complex Modes**: Behavior is simple and predictable:
- ✅ Auto-sync always runs **SAFE** operations (all additions)
- 🛑 **DESTRUCTIVE** operations always require manual execution
- 🚫 **CRITICAL** operations always require manual execution with full context

### Phase 3: AutoSync Behavior

**Single, Simple Behavior**:
1. **Automatic**: All SAFE operations (additive) run on schedule
2. **Detect & Notify**: Check for pending DESTRUCTIVE operations, email admin
3. **Never Execute**: DESTRUCTIVE and CRITICAL operations never run automatically

**Implementation**:
```
autoSync() executes:
  → syncAdds() including sheet editor additions (SAFE)
  → checkPendingDeletions() and notify if found (DESTRUCTIVE)
  → sendSummaryEmail() with results
```

No modes, no configuration complexity, predictable behavior.

### Phase 4: Notification System

**Two Simple Email Types**:

#### A. Summary Email (After Every AutoSync)

Sent after each successful AutoSync:
- **Subject**: "✅ AutoSync Completed"
- **Content**:
  - Users added (including any new sheet editors)
  - Folders shared
  - Groups created
  - Errors/warnings
  - **Pending deletions requiring manual action**

#### B. Action Required Email (When Deletions Pending)

Sent when DESTRUCTIVE operations detected:
- **Subject**: "⚠️ Manual Action Required: Permission Deletions Pending"
- **Content**: Summary of pending deletions with step-by-step instructions
- **Action**: Admin must run "Remove/Disable Users from Groups" (under ManualSync menu) manually

### Phase 5: Sync History & Audit Trail

**Automatic Audit Trail**: Every AutoSync is automatically logged in the `SyncHistory` sheet.

**What's Tracked**:
- Timestamp of each sync
- Revision ID (Google's internal identifier)
- Clickable link to version history
- Changes summary (added/removed/failed counts)
- Sync duration

**How to Use**:
1. Open the `SyncHistory` sheet
2. Find the sync you want to review by timestamp
3. Click "View History" to open Google's version history panel
4. Match the timestamp to find the exact revision
5. Click to view the spreadsheet state at that moment

**Retention**: Google automatically keeps revisions for 30-100 days. No manual maintenance required.

**Benefits**:
- ✅ Complete audit trail of all sync operations
- ✅ View historical state of permissions at any point
- ✅ Track changes over time
- ✅ No configuration needed - always enabled

**That's it.** No pre-execution emails, no cancellation mechanisms, no complexity.

---

## User/Admin Workflows

### Workflow for Standard Users

1. **Add users**: Edit permission sheets, add email addresses to group sheets
   - **Result**: Auto-sync grants access within 5 minutes (no admin action needed)

2. **Remove users**: Delete email addresses from group sheets
   - **Result**: Auto-sync detects change, notifies admin (admin must approve deletion)

3. **Check status**: View "Status" column in sheets
   - `OK` = Synced successfully
   - `Pending deletion - admin approval needed` = Waiting for admin

### Workflow for Admins

| Scenario | What Happens Automatically | Admin Action Required |
|:---------|:---------------------------|:---------------------|
| **Users added to sheets** | Auto-sync grants access within 5 minutes | ✅ None (review summary email periodically) |
| **Users removed from sheets** | Auto-sync detects, sends "Action Required" email | ⚠️ Check email → Run "Remove/Disable Users from Groups" manually → Review → Confirm |
| **Sheet Editor list changed in SheetEditors sheet** | Auto-sync detects, sends "Action Required" email | ⚠️ Check email → Run "Sync Sheet Editors" manually → Review → Confirm |
| **Manual changes in Google Groups** | Auto-sync continues normal operations | ⚠️ Run "Merge & Reconcile" to document manual changes |
| **Auto-sync error occurs** | Error email sent with details | ⚠️ Check logs, fix issue, optionally run manual sync |
| **Edit Mode enabled** | Auto-sync suspended (skips all operations) | ✅ None (resume when Edit Mode disabled) |

### Admin Email Examples

#### Example 1: Summary Email (Routine)
```
Subject: ✅ AutoSync Completed Successfully

Summary:
- 5 users added to groups
- 2 new folders shared
- 0 errors

No manual actions required at this time.

Last sync: 2025-10-21 14:00:00
Next sync: 2025-10-21 15:00:00
```

#### Example 2: Action Required Email (Deletions Pending)
```
Subject: ⚠️ Manual Action Required: 3 Permission Deletions Pending

Auto-sync detected users removed from permission sheets.
The following deletions require manual approval:

From Group 'ProjectX-Editors':
  - john.doe@example.com
  - jane.smith@example.com

From Group 'ProjectY-Viewers':
  - bob.jones@example.com

To execute these deletions:
1. Open the control spreadsheet
2. Go to: Permissions Manager → ManualSync → Remove/Disable Users from Groups
3. Review the deletion list carefully
4. Confirm to proceed

Note: Deletions will NOT execute automatically.
```

---

## Safety Features

### Built-In Safeguards

1. **Fail-Safe Defaults**
   - Auto-sync only performs low-risk additive operations by default
   - Destructive operations always require explicit manual execution

2. **Email Notifications**
   - Admin receives summary of all AutoSync actions
   - Proactive alerts for pending manual actions
   - Error notifications for failures

3. **Audit Trail**
   - All operations logged with timestamps, risk levels, and outcomes
   - Deletion operations logged separately for potential rollback

4. **Manual Override**
   - Edit Mode disables all AutoSync (for bulk editing)
   - Admin can disable AutoSync via Config sheet

5. **Deletion Limits**
   - Configurable threshold (default: 10 deletions)
   - Auto-abort if deletions exceed limit (prevents mass-removal mistakes)
   - Admin must review and increase limit or run deletions in batches

6. **Lock Mechanism**
   - Prevents concurrent syncs that could cause race conditions
   - Auto-sync skips execution if another sync is running

7. **Edit Mode Detection**
   - Auto-sync automatically skips when spreadsheet is in Edit Mode
   - Prevents conflicts during bulk administrative changes

### Risk Mitigation Matrix

| Risk | Without AutoSync | With Simplified AutoSync | Mitigation |
|:-----|:------------------|:--------------------------|:-----------|
| **Accidental deletion of legitimate user** | Admin must remember to run sync | Admin must explicitly approve deletions | DESTRUCTIVE: Email notification + manual approval |
| **Wrong editor added to control spreadsheet** | Admin must remember to run sync | Automatic execution with notification | SAFE: Post-notification + easy reversal |
| **Mass deletion due to sheet corruption** | Admin would catch during manual review | Safety limit prevents execution | `AutoSyncMaxDeletions` threshold blocks sync |
| **Auto-sync runs during bulk editing** | N/A | Edit Mode suspends AutoSync | Edit Mode detection |
| **Forgetting to grant access to new users** | Users must request access | Auto-sync grants within 5 minutes | SAFE: Automatic execution |

---

## Migration Path

### For Existing Deployments

**Current State**: Auto-sync calls `fullSync()` which includes deletions (fails silently)

**Migration Steps**:
1. Update `autoSync()` function to call `syncAdds()` instead of `fullSync()`
2. Add new Config sheet settings with safe defaults
3. Add notification helper functions for pending deletions
4. Update admin documentation

**Backward Compatibility**:
- New behavior is safer than current implementation
- Existing manual sync menu items unchanged
- No changes to sheet structure or user workflows
- Admin can disable AutoSync if desired (`EnableAutoSync: FALSE`)

### Recommended Default Configuration

For new deployments, use these settings:

```
Config Sheet Settings:
- EnableAutoSync: TRUE
- NotifyAfterSync: TRUE
- NotifyDeletionsPending: TRUE
- AutoSyncMaxDeletions: 10
```

This simple configuration provides:
- ✅ Automatic permission grants including sheet editors (low friction)
- ✅ Manual approval required for all deletions (high safety)
- ✅ Admin visibility of all changes (summary emails)
- ✅ Protection against mass-deletion mistakes (safety threshold)

---

## Conclusion

By classifying operations by **consequence of error** rather than just technical complexity, we can safely automate low-risk additive operations while requiring explicit manual approval for high-risk destructive operations. This approach:

1. **Reduces admin burden**: Routine permission grants happen automatically
2. **Maintains safety**: Deletions always require manual review and confirmation
3. **Increases visibility**: Admins receive clear notifications of pending actions
4. **Prevents silent failures**: Background triggers never attempt to show UI dialogs
5. **Provides flexibility**: Configurable risk levels for different organizational needs

**Key Principle**: *Fail open on additions (users complain and you fix), fail safe on deletions (prevent users from losing access).*

This simplified three-level model strikes the optimal balance between automation convenience and operational safety, while being easy to understand and implement.
