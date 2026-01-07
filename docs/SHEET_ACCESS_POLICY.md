# Sheet Access Policy

This project enforces a centralized access policy for spreadsheet sheets via `getSheetAccessPolicy_()` in `apps_script_project/Utils.gs`.

## Categories

## Structural edit policy

### Goal
Keep approval scope focused on permission deltas (membership and folder-role permissions) while ensuring structural configuration changes are only performed by Super Admins. This prevents non-admin edits from triggering creation/deletion of Google Groups, Drive folders, or control sheets.

### Scope
- **Structural configuration (Super Admin only):**
  - `ManagedFolders` (add/rename/delete folder-role bindings, delete checkbox)
  - `UserGroups` (add/rename/delete groups, delete checkbox)
- **Permission deltas (approval-gated, sheet editors can edit):**
  - Per-folder user sheets (membership add/remove/disable)
  - `SheetEditors_G` (sheet editor membership)

### Rules
1. **Non-super-admin edits to structural sheets are reverted immediately** with a clear toast message.
2. **Super admins retain full control** of structural sheets and deletion checkboxes.
3. **Approval gating remains limited to permission deltas** from membership sheets. Folder-role permission deltas sourced from `ManagedFolders` are auto-applied (logged with `ApprovalsNeeded = 0` and `Status = APPLIED`) to preserve an audit trail without blocking.
4. **Structural actions** (folder/group/sheet create/delete) are logged as auto-applied entries with `__structuralChange = true`.

### 1) Structural configuration (super admins only)
These sheets define which folders and groups exist in the system. Non-super-admin edits are reverted to prevent unintended creation/deletion of external resources.

Included sheets:
- `ManagedFolders`
- `UserGroups`

### 2) Permissions data (editable by sheet editors, optionally approval-gated)
These sheets contain permission inputs and can be edited by sheet editors. When multi-approver gating is enabled (`ApprovalsEnabled = TRUE`), direct edits define desired state and ChangeRequests are created during sync for any detected permission deltas.

Included sheets:
- `SheetEditors_G`
- All user membership sheets created from:
  - Managed folder bindings (`<folder>_<role>`)
  - User groups (`<group>_G`)

### 3) Config (super admins only)
The `Config` sheet is restricted to super admins (and owner). Edits by other users are reverted.

Additional guardrail:
- Changes to `ApprovalsEnabled` or `RequiredApprovals` are blocked while any ChangeRequests are pending to prevent bypassing approvals.

### 4) Read-only system sheets (script-managed)
These sheets are fully managed by Apps Script. Direct edits are reverted.

Included sheets:
- `Status`
- `Log`
- `TestLog`
- `FoldersAuditLog`
- `SyncHistory`
- `ChangeRequests`
- `DeepFolderAuditLog`
- `Help`

## ChangeRequests behavior
- When approvals are required, ChangeRequests are created automatically during sync from permission deltas.
- When approvals are disabled, ChangeRequests are still created as auto-applied audit entries (`ApprovalsNeeded = 0`).
- `Approver_*` columns are allowed for approvals.
- The ChangeRequests sheet is always visible and used as an audit log even when approvals are disabled.
- Manual and AutoSync runs apply approved deltas and skip pending ones.
Note: for external (non-organization) editors, Apps Script may not expose the editor email in edit events, so approver identity is based on the email entered in the sheet.

For more detail on approvals workflow, see `docs/MULTI_APPROVAL_SHEET_ONLY_DESIGN.md`.
