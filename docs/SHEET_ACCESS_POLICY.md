# Sheet Access Policy

This project enforces a centralized access policy for spreadsheet sheets via `getSheetAccessPolicy_()` in `apps_script_project/Utils.gs`.

## Categories

### 1) Permissions data (editable by sheet editors, optionally approval-gated)
These sheets contain permission inputs and can be edited by sheet editors. When multi-approver gating is enabled (`ApprovalsEnabled = TRUE`), direct edits define desired state and ChangeRequests are created during sync for any detected permission deltas.

Included sheets:
- `ManagedFolders`
- `UserGroups`
- `SheetEditors_G`
- All user membership sheets created from:
  - Managed folder bindings (`<folder>_<role>`)
  - User groups (`<group>_G`)

### 2) Config (super admins only)
The `Config` sheet is restricted to super admins (and owner). Edits by other users are reverted.

Additional guardrail:
- Changes to `ApprovalsEnabled` or `RequiredApprovals` are blocked while any ChangeRequests are pending to prevent bypassing approvals.

### 3) Read-only system sheets (script-managed)
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
- `Approver_*` columns are allowed for approvals.
- The ChangeRequests sheet is hidden when approvals are disabled.
- Manual and AutoSync runs apply approved deltas and skip pending ones.
Note: for external (non-organization) editors, Apps Script may not expose the editor email in edit events, so approver identity is based on the email entered in the sheet.

For more detail on approvals workflow, see `docs/MULTI_APPROVAL_SHEET_ONLY_DESIGN.md`.
