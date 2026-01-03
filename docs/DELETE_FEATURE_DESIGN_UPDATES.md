# Design Document Updates - Approved 2025-11-26

## Summary of Agreed Changes

Based on user review and discussion, the following changes have been approved:

### 1. ✅ Remove AutoSyncMaxDeletions Limit

**Decision**: Remove the deletion count limit entirely.

**Rationale**: Rely on "global mechanisms" for safety:
- `AllowGroupFolderDeletion` master switch
- Super Admin explicit sync execution
- Visual status warnings
- Email notifications
- Audit trail
- Access control

**Changes Required**:
- Remove `AutoSyncMaxDeletions` config setting
- Remove count validation from deletion flow
- Update safety mechanisms section
- Update all references in design doc

### 2. ✅ Google Workspace Required

**Decision**: Explicitly require Google Workspace with Admin SDK.

**Implementation**: Add validation on startup:
```javascript
function validateEnvironment_() {
  if (!isAdminDirectoryAvailable_()) {
    SpreadsheetApp.getUi().alert(
      'Google Workspace Required',
      'This tool requires Google Workspace with Admin SDK enabled.\n\n' +
      'See docs/WORKSPACE_SETUP.md for setup instructions.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return false;
  }
  return true;
}
```

**Changes Required**:
- Add environment check to onOpen()
- Update Section 9.9 title and content
- Add workspace requirement to README/docs

### 3. ✅ Clarify Permission Model

**Updated Persona Table**:

| Persona / Role | What They Configure | Day-to-Day Usage |
|----------------|---------------------|------------------|
| **Workspace Super Admin** | Creates Workspace, enables Admin SDK + Drive APIs, authorizes script | Rarely involved after setup |
| **Super Admin** (Config > SuperAdminEmails) | Runs sync, manages Config, tests | Executes sync operations, monitors logs |
| **Sheet Editor** (spreadsheet collaborator) | Edits ManagedFolders, UserGroups, marks deletions | Updates user lists, cannot run scripts |
| **Managed User** | None (represented in sheets) | Receives folder access after sync |

**Key Points**:
- These are distinct roles (not the same person necessarily)
- One person can have multiple roles (common in small orgs)
- Sheet Editors can edit and mark for deletion, but cannot run scripts
- Super Admins control when changes are applied

**Changes Required**:
- Update ARCHITECTURE_OVERVIEW.md with new table
- Add clarification section to design doc
- Use consistent terminology throughout

### 4. ✅ Add onEdit Warning for Row Deletion

**Implementation**:
```javascript
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const sheetName = sheet.getName();

  if (sheetName !== MANAGED_FOLDERS_SHEET_NAME &&
      sheetName !== USER_GROUPS_SHEET_NAME) {
    return;
  }

  // Detect if user might be deleting rows
  // Show warning about using Delete checkbox instead
  const range = e.range;
  if (range && range.getRow() > 1) {
    const row = range.getRow();
    const data = sheet.getRange(row, 1, 1, 3).getValues()[0];

    // If first columns empty (possible deletion)
    if (!data[0] && !data[1]) {
      SpreadsheetApp.getUi().alert(
        'Use Delete Checkbox',
        'To delete a folder or group, check the "Delete" checkbox and run sync.\n\n' +
        'Manual row deletion creates orphaned resources and will abort sync.',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }
  }
}
```

**Changes Required**:
- Add onEdit trigger
- Update safety mechanisms section
- Document in USER_GUIDE.md

### 5. ✅ Config Setting Updates

| Setting | Default | Change |
|---------|---------|--------|
| `AllowGroupFolderDeletion` | FALSE | No change (agreed) |
| `NotifyOnGroupFolderDeletion` | **TRUE** | Changed from FALSE |
| `AutoSyncMaxDeletions` | ~~10~~ | **REMOVED** |

### 6. ✅ Additional Confirmations

- ✅ Log warning when last folder role deleted
- ✅ Warn about nested group deletion in Status
- ✅ Document recovery process in USER_GUIDE.md
- ✅ Tests bypass delete feature (use direct cleanup)
- ✅ Folders never deleted (permissions only)

---

## Updated Configuration Settings (Section 6)

### 6.1 New Settings

#### `AllowGroupFolderDeletion`
```javascript
{
  key: 'AllowGroupFolderDeletion',
  section: '--- Sync Behavior ---',
  value: false,
  description: 'Master switch: Enable deletion of groups and folder-role bindings via Delete checkbox. Google Drive folders are never deleted. When disabled, Delete checkboxes are ignored and sync aborts on orphan sheets.'
}
```

#### `NotifyOnGroupFolderDeletion`
```javascript
{
  key: 'NotifyOnGroupFolderDeletion',
  section: '--- Email Notifications ---',
  value: true,  // DEFAULT: Enabled (important for safety)
  description: 'Send email notification when groups or folder-role bindings are deleted during sync. Recommended to keep enabled for audit purposes.'
}
```

### 6.2 ~~Removed Setting~~

~~`AutoSyncMaxDeletions`~~ - **REMOVED**

**Rationale**: Deletion safety provided by:
1. Master switch (`AllowGroupFolderDeletion`)
2. Explicit Super Admin approval (must run sync)
3. Visual warnings (Status column)
4. Email notifications
5. Audit trail (SyncHistory)

No arbitrary numeric limit needed.

---

## Updated Deletion Flow (Section 7.1)

```
fullSync() {
  1. Validate environment (Admin SDK available)
  2. Lock sheets (if enabled)
  3. Validate configuration
  4. Check for circular dependencies
  5. Check for orphan sheets

  6. *** Process Deletion Requests ***
     ↓
     processDeletionRequests_() {
       a. Check if AllowGroupFolderDeletion enabled
       b. If disabled: Update status warnings, skip
       c. If enabled: Process deletions
       d. Delete UserGroups first
       e. Delete ManagedFolders second
       f. Track deletions in summary
     }

  7. Sync SheetEditors_G (existing)
  8. Sync UserGroups (existing)
  9. Sync ManagedFolders (existing)
  10. Unlock sheets
  11. Log sync history
}
```

**Key Change**: No deletion count limit check.

---

## Updated Safety Mechanisms (Section 8)

### 8.1 Multi-Layer Safety (Revised)

```
Layer 1: Environment Validation
  ↓ Google Workspace with Admin SDK required

Layer 2: Master Switch
  ↓ AllowGroupFolderDeletion must be TRUE

Layer 3: Explicit Checkbox
  ↓ User must check Delete ☑ (never automatic)

Layer 4: Row Deletion Protection
  ↓ onEdit warns against manual row deletion

Layer 5: Status Visibility
  ↓ Status shows "PENDING DELETION" before sync

Layer 6: Super Admin Approval
  ↓ Only Super Admins can run sync (applies changes)

Layer 7: Audit Trail
  ↓ All deletions logged to SyncHistory

Layer 8: Email Notification
  ↓ Notify on deletions (default: enabled)
```

**Removed**: Deletion count limit
**Added**: Environment validation, onEdit warning, Super Admin approval

### 8.2 Preventing Accidental Mass Deletion (Revised)

**Scenario**: User accidentally selects entire Delete column and checks all boxes.

**Protections**:
1. **Status warnings**: All rows show "PENDING DELETION" - highly visible
2. **Super Admin approval**: Changes only applied when Super Admin runs sync
3. **Email notification**: Detailed summary sent after deletion
4. **Audit trail**: Full deletion log in SyncHistory
5. **onEdit warning**: Discourage row deletion, guide to checkbox

**Note**: No numeric limit. Trust the multi-layer safety mechanisms and Super Admin judgment.

---

## Updated Section 9.9: Workspace Without Admin SDK

**Original Title**: "Personal Gmail Account (No Admin SDK)"
**New Title**: "Workspace Without Admin SDK"

### Scenario

The spreadsheet is opened in an environment where Admin SDK is not available:
- Personal Google account (no Workspace)
- Workspace where Admin SDK is not enabled
- Script not properly authorized

### Expected Behavior

1. `validateEnvironment_()` runs on `onOpen()`
2. Detects `!isAdminDirectoryAvailable_()`
3. Shows alert:
   ```
   Google Workspace Required

   This tool requires Google Workspace with Admin SDK enabled.

   See docs/WORKSPACE_SETUP.md for setup instructions.
   ```
4. Menu still loads, but sync operations will fail gracefully
5. Log: "Admin SDK not available. This tool requires Google Workspace."

### Why This Matters

Without Admin SDK:
- ❌ Cannot create Google Groups
- ❌ Cannot manage group membership
- ❌ Cannot delete groups
- ❌ Core functionality broken

**This tool requires Google Workspace to function.**

---

## Updated Appendix B: Config Settings Summary

| Setting | Default | Type | Description |
|---------|---------|------|-------------|
| `AllowGroupFolderDeletion` | `false` | boolean | Master switch for deletion feature |
| `NotifyOnGroupFolderDeletion` | `true` | boolean | Email notification on deletions (recommended) |
| `AllowAutosyncDeletion` | `true` | boolean | Allow user deletions from groups (unchanged) |

~~`AutoSyncMaxDeletions`~~ - **REMOVED** (no longer needed)

---

## Updated Success Criteria (Section 16.1)

### Functional Requirements ✅

- [ ] Delete checkbox added to ManagedFolders and UserGroups
- [ ] Config setting `AllowGroupFolderDeletion` controls feature
- [ ] ~~Deletion respects `AutoSyncMaxDeletions` limit~~ **REMOVED**
- [ ] **Environment validation checks for Admin SDK** **ADDED**
- [ ] **onEdit warning for row deletion** **ADDED**
- [ ] All related resources cleaned up (groups, permissions, sheets, rows)
- [ ] Folders never deleted (by design)
- [ ] Status column shows deletion progress
- [ ] SyncHistory tracks deletions
- [ ] Email notifications sent (default: enabled)

---

## Implementation Updates

### Phase 1: Foundation (Updated)

Additional tasks:
- [ ] Add `validateEnvironment_()` function
- [ ] Add onEdit trigger with row deletion warning
- [ ] ~~Add AutoSyncMaxDeletions config~~ **REMOVED**
- [ ] Set `NotifyOnGroupFolderDeletion` default to TRUE

### Phase 2: Core Deletion Logic (Updated)

Changes:
- ~~Count pending deletions~~ **REMOVED**
- ~~Check against limit~~ **REMOVED**
- ~~Abort if limit exceeded~~ **REMOVED**

Simplified flow:
1. Check if `AllowGroupFolderDeletion` enabled
2. If disabled: Update status warnings, return
3. If enabled: Process all marked deletions
4. Track deletions in summary
5. Send notification

---

## Documentation Updates Required

1. **ARCHITECTURE_OVERVIEW.md**:
   - Update "Know who operates what" table
   - Clarify Workspace Super Admin vs Super Admin

2. **USER_GUIDE.md**:
   - Add deletion feature section
   - Explain safety mechanisms
   - Document recovery process
   - Add Google Workspace requirement

3. **AUTO_SYNC_GUIDE.md**:
   - AutoSync and deletions
   - No count limit (trust Super Admin)

4. **WORKSPACE_SETUP.md**:
   - Emphasize Admin SDK requirement
   - Add troubleshooting for missing Admin SDK

5. **DELETE_FEATURE_DESIGN.md** (this document):
   - Update all sections with approved changes
   - Mark as "Approved" instead of "Draft"

---

## Approval Status

**Design Review**: ✅ **APPROVED**
**Approved By**: User (dfront)
**Date**: 2025-11-26
**Implementation Start**: Immediately

**Key Decisions**:
1. ✅ Remove deletion count limit (trust global mechanisms)
2. ✅ Require Google Workspace with Admin SDK
3. ✅ Email notifications default to enabled
4. ✅ Add onEdit warning for row deletion
5. ✅ Clarify permission model (3 distinct roles)

---

**Ready for Implementation** 🚀
