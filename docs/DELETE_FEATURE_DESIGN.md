# Design Document: Group and Folder-Role Deletion Feature

**Status**: 🟡 Draft - Awaiting Review
**Author**: Claude Code
**Date**: 2025-11-26
**Version**: 1.0

---

## Executive Summary

This document proposes adding explicit deletion capability for Google Groups and Folder-Role bindings via a new "Delete" checkbox column in the `ManagedFolders` and `UserGroups` sheets. This feature enables safe, controlled cleanup of managed resources during AutoSync, while maintaining the current safety mechanisms and never deleting Google Drive folders.

**Key Principle**: Explicit deletion via checkbox, never implicit deletion via row removal.

---

## Table of Contents

1. [Background & Motivation](#1-background--motivation)
2. [Current System Behavior](#2-current-system-behavior)
3. [Design Goals](#3-design-goals)
4. [Proposed Solution](#4-proposed-solution)
5. [Schema Changes](#5-schema-changes)
6. [Configuration Settings](#6-configuration-settings)
7. [Deletion Flow](#7-deletion-flow)
8. [Safety Mechanisms](#8-safety-mechanisms)
9. [Edge Cases & Handling](#9-edge-cases--handling)
10. [Impact Analysis](#10-impact-analysis)
11. [Testing Strategy](#11-testing-strategy)
12. [Documentation Updates](#12-documentation-updates)
13. [Implementation Phases](#13-implementation-phases)
14. [Risks & Mitigations](#14-risks--mitigations)
15. [Open Questions](#15-open-questions)

---

## 1. Background & Motivation

### Current Problem

When users want to stop managing a folder or group, they face two problematic options:

**Option A: Delete the row from the sheet**
- ❌ Creates orphan sheets (e.g., `FolderName_Editor`)
- ❌ Orphan Google Groups remain active
- ❌ Folder permissions remain (group still has access)
- ❌ Sync aborts with error: "Found orphan sheets"
- ⚠️ Requires manual cleanup via Advanced menu

**Option B: Manual cleanup**
- ❌ Requires super admin privileges
- ❌ Multi-step process (delete group, remove permissions, delete sheet, remove row)
- ❌ Error-prone
- ❌ No audit trail

### Desired Behavior

Users should be able to explicitly mark groups and folder-role bindings for deletion, and have AutoSync safely clean up all related resources:
- Google Groups
- Folder permissions
- User sheets
- Configuration rows

**Important**: Google Drive folders themselves are never deleted (by design).

---

## 2. Current System Behavior

### Resource Lifecycle (Current)

| Resource | Created By | Deleted By | Notes |
|----------|------------|------------|-------|
| **Google Drive Folders** | Script (auto) | ❌ Never | Created if FolderID missing |
| **Google Groups** | Script (auto) | ❌ Manual only | Created on first sync |
| **Folder Permissions** | Script (auto) | ❌ Manual only | Group added to folder ACL |
| **User Sheets** | Script (auto) | ❌ Manual only | Created for each folder-role |
| **Sheet Rows** | User (manual) | User (manual) | Causes orphan if deleted |

### Deletion Asymmetry

**Problem**: System has asymmetric resource management:
- ✅ **Creation**: Automatic and easy (add row → sync creates everything)
- ❌ **Deletion**: Manual and complex (requires cleanup script)

This asymmetry makes the system harder to use and maintain.

---

## 3. Design Goals

### Primary Goals

1. **Explicit Deletion**: Users explicitly mark resources for deletion (never implicit)
2. **Safety First**: Multiple safety mechanisms prevent accidental mass deletion
3. **Complete Cleanup**: Delete all related resources (groups, permissions, sheets, rows)
4. **Audit Trail**: Log all deletions for accountability
5. **Folder Preservation**: Never delete Google Drive folders

### Non-Goals

- ❌ Automatic deletion based on usage patterns
- ❌ Folder lifecycle management (creation is OK, deletion never)
- ❌ Immediate deletion (always wait for next sync)
- ❌ Undo/restore functionality (rely on Google Workspace recovery)

### Design Principles

1. **Explicit > Implicit**: Checkbox required, never auto-detect
2. **Safe > Convenient**: Multiple confirmations and limits
3. **Consistent > Complex**: Same pattern for groups and folders
4. **Logged > Silent**: All deletions tracked and notified

---

## 4. Proposed Solution

### High-Level Approach

Add a **"Delete" checkbox column** to `ManagedFolders` and `UserGroups` sheets. When checked, the next AutoSync will:

1. Verify deletion is allowed (config setting)
2. Count total deletions (respect limit)
3. Delete Google Groups
4. Remove folder permissions
5. Delete user sheets
6. Update Status column
7. Remove rows from configuration sheets
8. Log to SyncHistory
9. Send email notification

### User Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Sheet Editor marks resource for deletion                 │
│    → Checks "Delete ☑" checkbox in ManagedFolders/UserGroups│
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Status column updates to "⏳ PENDING DELETION"            │
│    (or "⚠️ Deletion disabled" if config off)                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Super Admin runs sync (or AutoSync triggers)             │
│    → Sync validates deletion is allowed                     │
│    → Counts deletions vs limit                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Deletion engine processes marked resources               │
│    → UserGroups first (avoid orphan refs)                   │
│    → ManagedFolders second                                  │
│    → Status: "🗑️ DELETING..."                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Cleanup actions performed                                │
│    → Delete Google Group                                    │
│    → Remove group from folder permissions                   │
│    → Delete user sheet                                      │
│    → Log to SyncHistory                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Row removed from configuration sheet                     │
│    → Email notification sent                                │
│    → Sync continues with normal operations                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Schema Changes

### 5.1 ManagedFolders Sheet

**Current Columns (8):**
```
A: FolderName
B: FolderID
C: Role
D: GroupEmail
E: UserSheetName
F: Last Synced
G: Status
H: URL
```

**Proposed Columns (9):**
```
A: FolderName
B: FolderID
C: Role
D: GroupEmail
E: UserSheetName
F: Last Synced
G: Status
H: URL
I: Delete ☐          ← NEW
```

**Column Specifications:**
- **Type**: Checkbox (data validation)
- **Default**: Unchecked (false)
- **Editable**: Yes (by Sheet Editors)
- **Script-managed**: No (user sets, script reads)

### 5.2 UserGroups Sheet

**Current Columns (5):**
```
A: GroupName
B: GroupEmail
C: Group Admin Link
D: Last Synced
E: Status
```

**Proposed Columns (6):**
```
A: GroupName
B: GroupEmail
C: Group Admin Link
D: Last Synced
E: Status
F: Delete ☐          ← NEW
```

**Column Specifications:**
- **Type**: Checkbox (data validation)
- **Default**: Unchecked (false)
- **Editable**: Yes (by Sheet Editors)
- **Script-managed**: No (user sets, script reads)

### 5.3 Migration Strategy

**For Existing Sheets:**
```javascript
function migrateDeleteColumns_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Migrate ManagedFolders
  const managedSheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (managedSheet) {
    const headers = managedSheet.getRange(1, 1, 1, managedSheet.getLastColumn()).getValues()[0];
    if (headers.indexOf('Delete') === -1) {
      // Add Delete column (col I)
      const newCol = managedSheet.getLastColumn() + 1;
      managedSheet.getRange(1, newCol).setValue('Delete').setFontWeight('bold');

      // Add checkbox validation
      const deleteRange = managedSheet.getRange(`${columnToLetter(newCol)}2:${columnToLetter(newCol)}`);
      const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
      deleteRange.setDataValidation(rule);

      log_('Added Delete column to ManagedFolders sheet.', 'INFO');
    }
  }

  // Migrate UserGroups
  const userGroupsSheet = ss.getSheetByName(USER_GROUPS_SHEET_NAME);
  if (userGroupsSheet) {
    const headers = userGroupsSheet.getRange(1, 1, 1, userGroupsSheet.getLastColumn()).getValues()[0];
    if (headers.indexOf('Delete') === -1) {
      // Add Delete column (col F)
      const newCol = userGroupsSheet.getLastColumn() + 1;
      userGroupsSheet.getRange(1, newCol).setValue('Delete').setFontWeight('bold');

      // Add checkbox validation
      const deleteRange = userGroupsSheet.getRange(`${columnToLetter(newCol)}2:${columnToLetter(newCol)}`);
      const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
      deleteRange.setDataValidation(rule);

      log_('Added Delete column to UserGroups sheet.', 'INFO');
    }
  }
}
```

**Migration Timing**: Run automatically in `setupControlSheets_()` during `onOpen()`.

---

## 6. Configuration Settings

### 6.1 New Settings

#### `AllowGroupFolderDeletion`
```javascript
{
  key: 'AllowGroupFolderDeletion',
  section: '--- Sync Behavior ---',
  value: false,  // DEFAULT: Disabled for safety
  description: 'Master switch: Enable deletion of groups and folder-role bindings via Delete checkbox. Folders in Drive are never deleted. When disabled, Delete checkboxes are ignored and sync aborts on orphan sheets.'
}
```

**Rationale for default=false:**
- New installations start in safe mode
- Users must consciously enable deletion
- Prevents accidents during initial setup
- Can be enabled after users understand the system

#### `NotifyOnGroupFolderDeletion`
```javascript
{
  key: 'NotifyOnGroupFolderDeletion',
  section: '--- Email Notifications ---',
  value: true,  // DEFAULT: Enabled
  description: 'Send email notification when groups or folder-role bindings are deleted during sync. Separate from user deletion notifications.'
}
```

### 6.2 Modified Settings

#### `AutoSyncMaxDeletions` (Updated Description)
```javascript
{
  key: 'AutoSyncMaxDeletions',
  section: '--- Sync Behavior ---',
  value: 10,
  description: 'Maximum deletions (users + groups + folder-bindings) per sync. Safety limit to prevent mass deletions. Deletions beyond this limit are paused and require manual intervention.'
}
```

**Change**: Now counts ALL deletion types, not just user deletions.

### 6.3 Interaction Matrix

| `AllowGroupFolderDeletion` | `AllowAutosyncDeletion` | User Deletion | Group/Folder Deletion |
|----------------------------|------------------------|---------------|----------------------|
| FALSE | FALSE | ⚠️ Requires manual intervention | ❌ Ignored, status warning |
| FALSE | TRUE | ✅ Automatic | ❌ Ignored, status warning |
| TRUE | FALSE | ⚠️ Requires manual intervention | ✅ Automatic |
| TRUE | TRUE | ✅ Automatic | ✅ Automatic |

**Key Point**: These settings are independent. You can enable group/folder deletion while keeping user deletion manual, or vice versa.

---

## 7. Deletion Flow

### 7.1 Overall Sync Flow (Modified)

```
fullSync() {
  1. Lock sheets (if enabled)
  2. Validate configuration
  3. Check for circular dependencies
  4. Check for orphan sheets

  5. *** NEW: Process Deletion Requests ***
     ↓
     processDeletionRequests_() {
       a. Check if AllowGroupFolderDeletion enabled
       b. Count total pending deletions
       c. Respect AutoSyncMaxDeletions limit
       d. Delete UserGroups first
       e. Delete ManagedFolders second
       f. Track deletions in summary
     }

  6. Sync SheetEditors_G (existing)
  7. Sync UserGroups (existing)
  8. Sync ManagedFolders (existing)
  9. Unlock sheets
  10. Log sync history
}
```

### 7.2 Deletion Engine Detail

#### Stage 1: Validation & Counting

```javascript
function processDeletionRequests_(options = {}) {
  const silentMode = options.silentMode || false;

  // Check master switch
  const deletionEnabled = getConfigValue_('AllowGroupFolderDeletion', false);
  if (!deletionEnabled) {
    log_('Group/folder deletion disabled in Config. Delete checkboxes will be ignored.', 'INFO');
    updateDeleteStatusWarnings_(); // Set Status to "⚠️ Deletion disabled"
    return { userGroupsDeleted: 0, foldersDeleted: 0, skipped: true };
  }

  // Count pending deletions
  const userGroupDeletions = countPendingUserGroupDeletions_();
  const folderDeletions = countPendingFolderDeletions_();
  const totalDeletions = userGroupDeletions + folderDeletions;

  log_(`Found ${totalDeletions} pending deletions (${userGroupDeletions} groups, ${folderDeletions} folder-bindings)`, 'INFO');

  // Check limit
  const maxDeletions = getConfigValue_('AutoSyncMaxDeletions', 10);
  if (totalDeletions > maxDeletions) {
    const msg = `Deletion limit exceeded: ${totalDeletions} pending, max ${maxDeletions}. Please review and reduce marked deletions.`;
    log_(msg, 'WARN');
    if (!silentMode) {
      SpreadsheetApp.getUi().alert('Deletion Limit Exceeded', msg, SpreadsheetApp.getUi().ButtonSet.OK);
    }
    return { userGroupsDeleted: 0, foldersDeleted: 0, skipped: true, reason: 'limit_exceeded' };
  }

  // Proceed with deletions
  const summary = {
    userGroupsDeleted: 0,
    foldersDeleted: 0,
    errors: []
  };

  // Delete UserGroups first (avoid orphan references)
  processUserGroupDeletions_(summary);

  // Delete ManagedFolders second
  processManagedFolderDeletions_(summary);

  // Send notification
  if (summary.userGroupsDeleted > 0 || summary.foldersDeleted > 0) {
    notifyDeletions_(summary);
  }

  return summary;
}
```

#### Stage 2: UserGroup Deletion

```javascript
function processUserGroupDeletions_(summary) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(USER_GROUPS_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return;

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();
  const rowsToDelete = [];

  for (let i = data.length - 1; i >= 0; i--) {
    const groupName = data[i][0];
    const groupEmail = data[i][1];
    const deleteFlag = data[i][5]; // Column F

    if (!deleteFlag) continue; // Skip unchecked

    const rowNum = i + 2;

    try {
      log_(`Deleting UserGroup: "${groupName}" (${groupEmail})`, 'INFO');
      sheet.getRange(rowNum, 5).setValue('🗑️ DELETING...'); // Status column
      SpreadsheetApp.flush();

      // 1. Delete Google Group
      if (groupEmail && !shouldSkipGroupOps_()) {
        try {
          AdminDirectory.Groups.remove(groupEmail);
          log_(`✓ Deleted Google Group: ${groupEmail}`, 'INFO');
        } catch (e) {
          if (e.message.includes('Resource Not Found')) {
            log_(`Group ${groupEmail} already deleted or doesn't exist.`, 'WARN');
          } else {
            throw e;
          }
        }
      }

      // 2. Delete user sheet (GroupName_G)
      const userSheetName = groupName + '_G';
      const userSheet = ss.getSheetByName(userSheetName);
      if (userSheet) {
        ss.deleteSheet(userSheet);
        log_(`✓ Deleted sheet: ${userSheetName}`, 'INFO');
      }

      // 3. Mark row for deletion
      rowsToDelete.push(rowNum);
      summary.userGroupsDeleted++;

      log_(`✓ Successfully deleted UserGroup: "${groupName}"`, 'INFO');

    } catch (e) {
      log_(`✗ Failed to delete UserGroup "${groupName}": ${e.message}`, 'ERROR');
      sheet.getRange(rowNum, 5).setValue(`❌ Deletion failed: ${e.message}`);
      summary.errors.push({ type: 'UserGroup', name: groupName, error: e.message });
    }
  }

  // Delete rows from bottom to top (preserve row numbers)
  rowsToDelete.forEach(rowNum => {
    sheet.deleteRow(rowNum);
  });
}
```

#### Stage 3: ManagedFolder Deletion

```javascript
function processManagedFolderDeletions_(summary) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return;

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
  const rowsToDelete = [];

  for (let i = data.length - 1; i >= 0; i--) {
    const folderName = data[i][0];
    const folderId = data[i][1];
    const role = data[i][2];
    const groupEmail = data[i][3];
    const userSheetName = data[i][4];
    const deleteFlag = data[i][8]; // Column I

    if (!deleteFlag) continue; // Skip unchecked

    const rowNum = i + 2;

    try {
      log_(`Deleting folder-role binding: "${folderName}" (${role})`, 'INFO');
      sheet.getRange(rowNum, 7).setValue('🗑️ DELETING...'); // Status column
      SpreadsheetApp.flush();

      // 1. Remove group from folder permissions
      if (folderId && groupEmail) {
        try {
          const folder = DriveApp.getFolderById(folderId);
          folder.removeEditor(groupEmail);
          folder.removeViewer(groupEmail);
          // Note: removeCommenter not available in Apps Script, handled via removeEditor
          log_(`✓ Removed ${groupEmail} from folder permissions`, 'INFO');
        } catch (e) {
          if (e.message.includes('not found')) {
            log_(`Folder ${folderId} not found (may be already deleted).`, 'WARN');
          } else {
            throw e;
          }
        }
      }

      // 2. Delete Google Group
      if (groupEmail && !shouldSkipGroupOps_()) {
        try {
          AdminDirectory.Groups.remove(groupEmail);
          log_(`✓ Deleted Google Group: ${groupEmail}`, 'INFO');
        } catch (e) {
          if (e.message.includes('Resource Not Found')) {
            log_(`Group ${groupEmail} already deleted or doesn't exist.`, 'WARN');
          } else {
            throw e;
          }
        }
      }

      // 3. Delete user sheet
      const userSheet = ss.getSheetByName(userSheetName);
      if (userSheet) {
        ss.deleteSheet(userSheet);
        log_(`✓ Deleted sheet: ${userSheetName}`, 'INFO');
      }

      // 4. Mark row for deletion
      rowsToDelete.push(rowNum);
      summary.foldersDeleted++;

      log_(`✓ Successfully deleted folder-role binding: "${folderName}" (${role})`, 'INFO');

      // 5. Check if this was the last binding for this folder
      const remainingBindings = data.filter((row, idx) =>
        row[1] === folderId && idx !== i && !row[8] // Same folder, not deleted
      ).length;

      if (remainingBindings === 0) {
        log_(`ℹ️ All managed access to folder "${folderName}" has been removed. Folder remains in Drive.`, 'INFO');
      }

    } catch (e) {
      log_(`✗ Failed to delete folder-role binding "${folderName}" (${role}): ${e.message}`, 'ERROR');
      sheet.getRange(rowNum, 7).setValue(`❌ Deletion failed: ${e.message}`);
      summary.errors.push({ type: 'FolderRole', name: `${folderName} (${role})`, error: e.message });
    }
  }

  // Delete rows from bottom to top (preserve row numbers)
  rowsToDelete.forEach(rowNum => {
    sheet.deleteRow(rowNum);
  });
}
```

### 7.3 Status Column Updates

| Stage | Status Value | When |
|-------|-------------|------|
| Before sync | `⏳ PENDING DELETION` | Delete checked, config enabled |
| Before sync | `⚠️ Deletion disabled in Config` | Delete checked, config disabled |
| During sync | `🗑️ DELETING...` | Deletion in progress |
| After success | (Row removed) | Deletion completed |
| After failure | `❌ Deletion failed: [reason]` | Error occurred |

---

## 8. Safety Mechanisms

### 8.1 Multi-Layer Safety

```
Layer 1: Master Switch
  ↓ AllowGroupFolderDeletion must be TRUE

Layer 2: Explicit Checkbox
  ↓ User must check Delete ☑ (never automatic)

Layer 3: Count Limit
  ↓ Total deletions ≤ AutoSyncMaxDeletions

Layer 4: Status Visibility
  ↓ Status shows "PENDING DELETION" before sync

Layer 5: Audit Trail
  ↓ All deletions logged to SyncHistory

Layer 6: Email Notification
  ↓ Notify on deletions (if enabled)
```

### 8.2 Preventing Accidental Mass Deletion

**Scenario**: User accidentally selects entire Delete column and checks all boxes.

**Protections**:
1. **Count limit**: `AutoSyncMaxDeletions` (default: 10) will block sync
2. **Status warnings**: All rows show "PENDING DELETION" - visually alarming
3. **Sync abort**: "Deletion limit exceeded: 50 pending, max 10"
4. **Manual review required**: User must uncheck boxes or increase limit

### 8.3 Preventing Orphan Row Deletion

**Current behavior**: Deleting a row from ManagedFolders/UserGroups causes sync abort (orphan sheet detected).

**New behavior**: Same! Row deletion still causes sync abort.

**Rationale**:
- Forces users to use Delete checkbox (explicit intent)
- Prevents accidents (row deletion is easy to do by mistake)
- Maintains backward compatibility (existing safety mechanism)

---

## 9. Edge Cases & Handling

### 9.1 Multiple Roles for Same Folder

**Scenario**:
```
ManagedFolders:
ProjectAlpha | folder123 | Editor    | alpha-editor@   | ProjectAlpha_Editor   | Delete ☑
ProjectAlpha | folder123 | Viewer    | alpha-viewer@   | ProjectAlpha_Viewer   | Delete ☐
ProjectAlpha | folder123 | Commenter | alpha-comment@  | ProjectAlpha_Commenter| Delete ☐
```

**Expected Behavior**:
1. Delete `alpha-editor` group ✓
2. Remove `alpha-editor` from folder permissions ✓
3. Delete `ProjectAlpha_Editor` sheet ✓
4. Remove first row ✓
5. **Do NOT delete folder** (other roles still active) ✓
6. Log: "Deleted Editor role for ProjectAlpha. 2 other role(s) remain."

**Implementation**: No special handling needed - each row is independent.

### 9.2 Group Used in Multiple Folders

**Scenario**: UserGroup "Engineering" is member of:
- `ProjectAlpha_Editor` group
- `ProjectBeta_Viewer` group

User marks "Engineering" for deletion.

**Expected Behavior**:
1. Delete "Engineering" group ✓
2. Delete "Engineering_G" sheet ✓
3. Members of "Engineering" lose access to all folders where it was nested ✓
4. Log warning: "Deleting nested group may affect other folder permissions"

**Implementation**: Add nested group detection and warning in Status column.

### 9.3 Folder Doesn't Exist

**Scenario**: FolderID points to deleted or inaccessible folder.

**Expected Behavior**:
1. Attempt to remove permissions: Catch "not found" error, log warning
2. Continue with group deletion ✓
3. Delete sheet ✓
4. Remove row ✓
5. Log: "Folder not found (may be already deleted). Cleaned up group and sheet."

**Implementation**: Try-catch around `DriveApp.getFolderById()`.

### 9.4 Group Already Deleted

**Scenario**: Google Group was manually deleted via admin.google.com.

**Expected Behavior**:
1. Attempt group deletion: Catch "Resource Not Found" error
2. Log warning: "Group already deleted"
3. Continue with permission removal and sheet deletion ✓
4. Remove row ✓

**Implementation**: Try-catch around `AdminDirectory.Groups.remove()`.

### 9.5 Sheet Doesn't Exist

**Scenario**: User sheet was manually deleted.

**Expected Behavior**:
1. Check if sheet exists: `getSheetByName()` returns null
2. Log info: "Sheet already deleted"
3. Continue with group and permission deletion ✓
4. Remove row ✓

**Implementation**: Check `if (sheet)` before `deleteSheet()`.

### 9.6 Deletion Limit Reached Mid-Process

**Scenario**: 15 deletions pending, limit is 10.

**Expected Behavior**:
1. Count all deletions upfront (before starting)
2. Abort entire deletion process if limit exceeded
3. Update all pending deletions' Status to: "⚠️ Deletion limit exceeded (15 > 10)"
4. Log: "Deletion limit exceeded. Please review marked items."
5. User must either:
   - Uncheck some Delete boxes
   - Or increase `AutoSyncMaxDeletions` in Config

**Implementation**: Count in `processDeletionRequests_()` before calling deletion functions.

### 9.7 Config Disabled Mid-Sync

**Scenario**: User disables `AllowGroupFolderDeletion` while sync is running.

**Expected Behavior**:
- Config is cached at sync start
- Sync completes with cached config
- Next sync will read new config value

**Implementation**: Config cached via `getConfiguration_()` at sync start.

### 9.8 Non-Admin Running Sync

**Scenario**: Non-super-admin user opens spreadsheet.

**Expected Behavior**:
- User can check Delete boxes (they're sheet editors)
- Status shows "PENDING DELETION"
- User cannot run sync (menu not visible)
- Super admin runs sync later
- Deletions are processed

**Implementation**: No special handling needed - existing permission system works.

### 9.9 Personal Gmail Account (No Admin SDK)

**Scenario**: User with personal Gmail (no Workspace) tries to use deletion.

**Expected Behavior**:
1. `shouldSkipGroupOps_()` returns true
2. Group deletion step is skipped
3. Permission removal is skipped (no groups to remove)
4. Sheet deletion still works
5. Row removal still works
6. Log: "Admin SDK not available. Skipped group operations."

**Implementation**: Existing `shouldSkipGroupOps_()` check wraps group operations.

---

## 10. Impact Analysis

### 10.1 Files Modified

| File | Changes | Risk Level |
|------|---------|-----------|
| **Setup.gs** | Add columns, config settings, migration | 🟡 Medium |
| **Sync.gs** | Add deletion flow to `fullSync()` | 🔴 High |
| **Core.gs** | Add deletion functions | 🟡 Medium |
| **Utils.gs** | Helper functions (counting, status updates) | 🟢 Low |
| **Code.js** | Update constants (column indices) | 🟢 Low |
| **Tests.gs** | New test functions | 🟢 Low |

### 10.2 Backward Compatibility

**Existing Installations**:
- ✅ Migration runs on next `onOpen()`
- ✅ New columns added automatically
- ✅ Config settings added with safe defaults
- ✅ Existing behavior unchanged (config defaults to FALSE)
- ✅ No breaking changes

**Upgrade Path**:
1. User updates code (via clasp push or manual copy)
2. User opens spreadsheet
3. `onOpen()` runs, calls `migrateDeleteColumns_()`
4. Delete columns added, config settings added
5. Feature available but disabled
6. User enables `AllowGroupFolderDeletion` when ready

### 10.3 Performance Impact

**Additional Operations Per Sync**:
- ➕ Count pending deletions: ~10ms (one-time per sync)
- ➕ Update status columns: ~50ms (only for marked rows)
- ➕ Deletion operations: ~500ms per deletion (API calls)

**Example**: 5 deletions = ~2.5 seconds added to sync time.

**Verdict**: Minimal impact, acceptable.

### 10.4 API Quota Impact

**New API Calls Per Deletion**:
- AdminDirectory.Groups.remove: 1 call
- DriveApp.getFolderById: 1 call
- folder.removeEditor/Viewer: 1-2 calls

**Total per deletion**: ~3-4 API calls

**Quota Limits** (Google Workspace):
- Admin SDK: 1500 requests/minute
- Drive API: 1000 requests/100 seconds

**Verdict**: With `AutoSyncMaxDeletions=10`, max 40 API calls per sync. Well within limits.

---

## 11. Testing Strategy

### 11.1 Unit Tests

#### Test 1: Basic UserGroup Deletion
```javascript
function testUserGroupDeletion() {
  // Setup: Create test group
  // Action: Check Delete, run sync
  // Verify:
  //   - Google Group deleted
  //   - Sheet deleted
  //   - Row removed
  //   - Logged to SyncHistory
}
```

#### Test 2: Basic Folder-Role Deletion
```javascript
function testFolderRoleDeletion() {
  // Setup: Create test folder with role
  // Action: Check Delete, run sync
  // Verify:
  //   - Group removed from folder permissions
  //   - Google Group deleted
  //   - Sheet deleted
  //   - Row removed
  //   - Folder still exists
}
```

#### Test 3: Deletion Disabled in Config
```javascript
function testDeletionDisabled() {
  // Setup: Set AllowGroupFolderDeletion=false
  // Action: Check Delete, run sync
  // Verify:
  //   - Deletions skipped
  //   - Status shows "⚠️ Deletion disabled"
  //   - Resources still exist
}
```

#### Test 4: Deletion Limit Exceeded
```javascript
function testDeletionLimitExceeded() {
  // Setup: Mark 15 items for deletion, limit=10
  // Action: Run sync
  // Verify:
  //   - Sync aborts deletion
  //   - Status shows "⚠️ Deletion limit exceeded"
  //   - No deletions performed
}
```

#### Test 5: Multiple Roles for Same Folder
```javascript
function testMultipleFolderRoles() {
  // Setup: Same folder with Editor, Viewer roles
  // Action: Delete only Editor
  // Verify:
  //   - Editor group deleted
  //   - Viewer group still exists
  //   - Folder still exists with Viewer access
}
```

#### Test 6: Nested Group Deletion
```javascript
function testNestedGroupDeletion() {
  // Setup: Group A contains Group B, Group B has folder access
  // Action: Delete Group A
  // Verify:
  //   - Group A deleted
  //   - Members of A lose indirect access to folders
}
```

#### Test 7: Already Deleted Resources
```javascript
function testIdempotentDeletion() {
  // Setup: Manually delete group via admin.google.com
  // Action: Check Delete, run sync
  // Verify:
  //   - No errors thrown
  //   - Sheet and row still cleaned up
  //   - Logged as warning
}
```

#### Test 8: Email Notification
```javascript
function testDeletionNotification() {
  // Setup: Enable NotifyOnGroupFolderDeletion
  // Action: Delete group
  // Verify:
  //   - Email sent to NotificationEmail
  //   - Email contains deletion summary
}
```

### 11.2 Integration Tests

#### Test 9: Full Sync with Deletions
```javascript
function testFullSyncWithDeletions() {
  // Setup: Mix of additions, updates, deletions
  // Action: Run fullSync
  // Verify:
  //   - Deletions processed first
  //   - Additions/updates processed second
  //   - SyncHistory shows all operations
}
```

#### Test 10: AutoSync with Deletions
```javascript
function testAutoSyncWithDeletions() {
  // Setup: Schedule AutoSync, mark item for deletion
  // Action: Trigger AutoSync
  // Verify:
  //   - Deletion processed automatically
  //   - No manual intervention needed
}
```

### 11.3 Manual Test Checklist

- [ ] Create folder-role binding, mark for deletion, verify cleanup
- [ ] Create user group, mark for deletion, verify cleanup
- [ ] Mark 15 items with limit=10, verify abort
- [ ] Disable config, verify deletions ignored
- [ ] Delete group manually, then sync, verify graceful handling
- [ ] Delete last role for folder, verify folder remains
- [ ] Check Status column updates at each stage
- [ ] Verify email notification received
- [ ] Verify SyncHistory entry created
- [ ] Test on personal Gmail (no Admin SDK)

---

## 12. Documentation Updates

### 12.1 USER_GUIDE.md

**New Section**: "Deleting Groups and Folder Access"

```markdown
## Deleting Groups and Folder Access

### Overview

To stop managing a group or folder-role binding, use the Delete checkbox:

1. ✅ Explicit and safe
2. ✅ Cleans up all related resources
3. ✅ Audit trail in logs
4. ❌ Never deletes Google Drive folders

### How to Delete a Folder-Role Binding

1. Open the `ManagedFolders` sheet
2. Find the row for the folder and role you want to delete
3. Check the `Delete ☑` checkbox (Column I)
4. The Status column will show `⏳ PENDING DELETION`
5. Run a sync (or wait for AutoSync)
6. The system will:
   - Remove the group from folder permissions
   - Delete the Google Group
   - Delete the user sheet
   - Remove the row
   - **Folder remains in Drive** (unchanged)

### How to Delete a User Group

1. Open the `UserGroups` sheet
2. Find the row for the group you want to delete
3. Check the `Delete ☑` checkbox (Column F)
4. The Status column will show `⏳ PENDING DELETION`
5. Run a sync (or wait for AutoSync)
6. The system will:
   - Delete the Google Group
   - Delete the group sheet
   - Remove the row

### Configuration

The deletion feature must be enabled in `Config`:

- **AllowGroupFolderDeletion**: Master switch (default: OFF)
- **AutoSyncMaxDeletions**: Max deletions per sync (default: 10)
- **NotifyOnGroupFolderDeletion**: Email notifications (default: ON)

### Safety Mechanisms

- **Deletion limit**: Max 10 deletions per sync (configurable)
- **Explicit intent**: Must check Delete checkbox (never automatic)
- **Orphan protection**: Deleting rows still aborts sync (forces checkbox use)
- **Audit trail**: All deletions logged to SyncHistory
- **Email alerts**: Receive notification when deletions occur

### ⚠️ Important Notes

- **Folders are never deleted**: Only permissions are removed
- **No undo**: Deleted groups cannot be restored automatically
- **Nested groups**: Deleting a parent group affects nested permissions
- **Multiple roles**: Each folder-role binding is independent
```

### 12.2 AUTO_SYNC_GUIDE.md

**New Section**: "AutoSync and Deletions"

```markdown
## AutoSync and Deletions

### How Deletions Work with AutoSync

AutoSync can automatically process deletion requests if enabled:

1. Sheet Editors mark items for deletion (check Delete box)
2. AutoSync runs on schedule
3. Deletion requests are processed automatically
4. Email notification sent (if enabled)

### Configuration

```
AllowGroupFolderDeletion: true   ← Enable deletion feature
AutoSyncMaxDeletions: 10         ← Safety limit
NotifyOnGroupFolderDeletion: true ← Email alerts
```

### Safety with AutoSync

AutoSync respects all safety mechanisms:
- Deletion count limit
- Status visibility (shows PENDING before deletion)
- Email notifications
- Audit trail in SyncHistory

### Recommended Settings

For production use:
- Keep `AutoSyncMaxDeletions` low (5-10)
- Enable `NotifyOnGroupFolderDeletion`
- Review SyncHistory regularly
```

### 12.3 TESTING.md

**New Section**: "Testing Deletion Feature"

```markdown
## Testing Group and Folder Deletion

### Test: Basic Folder-Role Deletion

1. Create test folder: "DeleteTest"
2. Add row to ManagedFolders with role "Editor"
3. Run sync (creates group and sheet)
4. Check Delete box for this row
5. Run sync again
6. Verify:
   - Group deleted from Google Workspace
   - Group removed from folder permissions
   - Sheet "DeleteTest_Editor" deleted
   - Row removed from ManagedFolders
   - Folder still exists in Drive

### Test: Deletion Safety Limits

1. Create 15 test folder-role bindings
2. Check Delete for all 15
3. Set `AutoSyncMaxDeletions` to 10
4. Run sync
5. Verify:
   - Sync aborts with "Deletion limit exceeded"
   - Status shows warning on all rows
   - No deletions performed

[... additional test scenarios ...]
```

---

## 13. Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal**: Schema and configuration ready

- [ ] Add `AllowGroupFolderDeletion` config setting
- [ ] Add `NotifyOnGroupFolderDeletion` config setting
- [ ] Update `AutoSyncMaxDeletions` description
- [ ] Add Delete column to ManagedFolders (column I)
- [ ] Add Delete column to UserGroups (column F)
- [ ] Add checkbox validation
- [ ] Create migration function `migrateDeleteColumns_()`
- [ ] Update column constants in Code.js
- [ ] Test migration on fresh sheet

**Deliverable**: Updated Setup.gs, migration working

### Phase 2: Core Deletion Logic (Week 1-2)
**Goal**: Deletion engine functional

- [ ] Create `processDeletionRequests_()` main function
- [ ] Create `processUserGroupDeletions_()`
- [ ] Create `processManagedFolderDeletions_()`
- [ ] Create helper functions:
  - [ ] `countPendingUserGroupDeletions_()`
  - [ ] `countPendingFolderDeletions_()`
  - [ ] `updateDeleteStatusWarnings_()`
  - [ ] `notifyDeletions_(summary)`
- [ ] Handle edge cases (already deleted, not found, etc.)
- [ ] Add status column updates

**Deliverable**: Deletion functions in Core.gs/Utils.gs

### Phase 3: Integration (Week 2)
**Goal**: Deletion integrated into sync flow

- [ ] Integrate into `fullSync()` in Sync.gs
- [ ] Add deletion tracking to SyncHistory
- [ ] Update sync summary to include deletions
- [ ] Test with manual sync
- [ ] Test with AutoSync
- [ ] Verify orphan sheet detection still works

**Deliverable**: Working end-to-end deletion in sync

### Phase 4: Testing (Week 2-3)
**Goal**: Comprehensive test coverage

- [ ] Write unit tests (8 tests planned)
- [ ] Write integration tests (2 tests planned)
- [ ] Manual testing checklist (10 scenarios)
- [ ] Test on personal Gmail (no Admin SDK)
- [ ] Test migration on old sheet
- [ ] Stress test with high deletion counts
- [ ] Test concurrent edits

**Deliverable**: Passing test suite, verified edge cases

### Phase 5: Documentation (Week 3)
**Goal**: Complete documentation

- [ ] Update USER_GUIDE.md
- [ ] Update AUTO_SYNC_GUIDE.md
- [ ] Update TESTING.md
- [ ] Add inline code comments
- [ ] Update CHANGELOG.md
- [ ] Create demo video/screenshots (optional)

**Deliverable**: Updated docs, ready for users

### Phase 6: Release (Week 3)
**Goal**: Production-ready feature

- [ ] Code review
- [ ] Final testing on staging
- [ ] Deploy to production
- [ ] Monitor logs for issues
- [ ] Gather user feedback

**Deliverable**: Feature live in production

---

## 14. Risks & Mitigations

### 14.1 High Risk: Accidental Mass Deletion

**Risk**: User accidentally marks many items for deletion.

**Mitigations**:
1. ✅ Deletion count limit (`AutoSyncMaxDeletions`)
2. ✅ Status column shows "PENDING DELETION" (visual warning)
3. ✅ Email notification on deletions
4. ✅ Audit trail in SyncHistory
5. ✅ Config disabled by default (must opt-in)

**Residual Risk**: 🟡 Medium → Low after mitigations

### 14.2 Medium Risk: Deleting Wrong Item

**Risk**: User checks wrong Delete box, item gets deleted.

**Mitigations**:
1. ✅ Status shows "PENDING DELETION" before sync (chance to review)
2. ✅ Email notification with deletion details
3. ✅ Google Workspace retains deleted groups for ~30 days (recovery possible)
4. ⚠️ No built-in undo (rely on Google's recovery)

**Residual Risk**: 🟡 Medium (unavoidable, user error)

**Recommendation**: Document recovery process in USER_GUIDE.md

### 14.3 Medium Risk: Deletion During Active Use

**Risk**: User deletes group while members are actively using shared folders.

**Mitigations**:
1. ✅ Folder permissions removed immediately (expected)
2. ✅ Users lose access (expected behavior)
3. ⚠️ No warning if folder is "in use"

**Residual Risk**: 🟡 Medium (by design, intentional deletion)

**Recommendation**: Document best practices (announce before deleting shared access)

### 14.4 Low Risk: Partial Deletion Failure

**Risk**: Some deletion steps succeed, others fail (e.g., group deleted but sheet remains).

**Mitigations**:
1. ✅ Try-catch around each deletion step
2. ✅ Continue cleanup even if step fails
3. ✅ Log specific failures
4. ✅ Status shows specific error message
5. ✅ Manual cleanup still possible via orphan sheet tool

**Residual Risk**: 🟢 Low

### 14.5 Low Risk: Sync Performance Degradation

**Risk**: Deletion processing slows down sync significantly.

**Mitigations**:
1. ✅ Deletion count limit (max 10 by default)
2. ✅ Deletions processed before main sync (parallelizable)
3. ✅ API quota well within limits

**Residual Risk**: 🟢 Low

### 14.6 Low Risk: Config Migration Failure

**Risk**: Old installations fail to migrate properly.

**Mitigations**:
1. ✅ Migration in `setupControlSheets_()` (runs on every open)
2. ✅ Idempotent migration (safe to run multiple times)
3. ✅ Default to safe values (config=false)
4. ✅ Extensive testing on old sheets

**Residual Risk**: 🟢 Low

---

## 15. Open Questions

### 15.1 For Review

1. **Config Default**: Should `AllowGroupFolderDeletion` default to FALSE (conservative) or TRUE (convenient)?
   - **Recommendation**: FALSE (safety first, explicit opt-in)

2. **Deletion Count**: Should `AutoSyncMaxDeletions` count only users, or users + groups + folders?
   - **Recommendation**: Count all types (comprehensive safety)

3. **Email Notification**: Separate config `NotifyOnGroupFolderDeletion` or reuse existing `NotifyDeletionsPending`?
   - **Recommendation**: Separate config (different contexts)

4. **Last Folder Role**: When deleting the last role for a folder, should we log a special warning?
   - **Recommendation**: Yes, log info message (helpful context)

5. **Nested Group Warning**: Should we detect nested groups and warn before deletion?
   - **Recommendation**: Yes, add warning in Status column if nested

6. **Recovery Documentation**: Should we document Google Workspace group recovery process?
   - **Recommendation**: Yes, add section to USER_GUIDE.md

### 15.2 Future Enhancements (Out of Scope)

- Soft delete / trash (keep in sheet but mark deleted)
- Undo functionality (restore recently deleted)
- Bulk deletion UI (select multiple, confirm once)
- Deletion schedule (delete at specific time)
- Conditional deletion (if unused for N days)

---

## 16. Success Criteria

### 16.1 Functional Requirements ✅

- [ ] Delete checkbox added to ManagedFolders and UserGroups
- [ ] Config setting `AllowGroupFolderDeletion` controls feature
- [ ] Deletion respects `AutoSyncMaxDeletions` limit
- [ ] All related resources cleaned up (groups, permissions, sheets, rows)
- [ ] Folders never deleted (by design)
- [ ] Status column shows deletion progress
- [ ] SyncHistory tracks deletions
- [ ] Email notifications sent (if enabled)

### 16.2 Non-Functional Requirements ✅

- [ ] Backward compatible (safe migration)
- [ ] Performance impact < 5 seconds for max deletions
- [ ] API quota impact < 10% of limits
- [ ] Comprehensive test coverage (10+ tests)
- [ ] Complete documentation
- [ ] Zero data loss bugs in production

### 16.3 User Experience ✅

- [ ] Clear, obvious workflow (check box, run sync)
- [ ] Visual feedback at each stage (Status column)
- [ ] Errors handled gracefully (partial failures OK)
- [ ] Recovery guidance documented

---

## Appendix A: Related Files

### Files to Create/Modify

```
apps_script_project/
├── Setup.gs           [MODIFY] Schema migration, config settings
├── Sync.gs            [MODIFY] Integrate deletion into fullSync()
├── Core.gs            [MODIFY] Add deletion functions
├── Utils.gs           [MODIFY] Add helper functions
├── Code.js            [MODIFY] Update column constants
└── Tests.gs           [MODIFY] Add new test functions

docs/
├── USER_GUIDE.md      [MODIFY] Add deletion section
├── AUTO_SYNC_GUIDE.md [MODIFY] Add AutoSync deletion section
├── TESTING.md         [MODIFY] Add deletion tests
└── DELETE_FEATURE_DESIGN.md [NEW] This document
```

---

## Appendix B: Config Settings Summary

| Setting | Default | Type | Description |
|---------|---------|------|-------------|
| `AllowGroupFolderDeletion` | `false` | boolean | Master switch for deletion feature |
| `AutoSyncMaxDeletions` | `10` | number | Max deletions per sync (all types) |
| `NotifyOnGroupFolderDeletion` | `true` | boolean | Email notification on deletions |
| `AllowAutosyncDeletion` | `true` | boolean | Allow user deletions (unchanged) |

---

## Appendix C: Status Column Messages

| Message | Meaning |
|---------|---------|
| `⏳ PENDING DELETION` | Delete checked, config enabled, waiting for sync |
| `⚠️ Deletion disabled in Config` | Delete checked, but config disabled |
| `🗑️ DELETING...` | Deletion in progress |
| `❌ Deletion failed: [reason]` | Error occurred during deletion |
| `⚠️ Deletion limit exceeded` | Too many deletions marked |
| `ℹ️ Last role for this folder removed` | Informational (folder still exists) |

---

## Approval

**Design Review**: ☐ Pending
**Approved By**: ________________
**Date**: ________________
**Implementation Start**: ________________

---

**End of Design Document**
