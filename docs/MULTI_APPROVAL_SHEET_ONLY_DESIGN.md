# Sheet-First Multi-Approver Workflow (Current)

## Goals and constraints
- Deliver optional multi-approver gating for permission changes without relying on custom menus.
- Approvals are captured and managed via the `ChangeRequests` sheet.
- Default behavior remains unchanged when approvals are disabled.
See `docs/SHEET_ACCESS_POLICY.md` for the centralized sheet access policy.

## Core sheet surfaces
### Config sheet additions
- `ApprovalsEnabled` (boolean) – turns the feature on/off. Default: `FALSE`.
- `RequiredApprovals` (number) – minimum distinct approvers for each request. Default: `1`. Maximum: `3`, and cannot exceed active Sheet Editors.
- `ApprovalExpiryHours` (number, optional) – auto-expire stale requests (e.g., 72 hours).
Note: changes to `ApprovalsEnabled` or `RequiredApprovals` are blocked while any ChangeRequests are pending.

### ChangeRequests sheet
The table used to review and approve changes. Rows come from:

1. **Permission deltas (auto-created)**  
   - Created during sync when desired state differs from actual state.
   - These rows are approved in the sheet, but applied by sync.

2. **Manual ChangeRequests (optional)**  
   - Manually entered for control-sheet row changes (ADD/UPDATE/DELETE).
   - Applied by `processChangeRequests_()` once approved.

Columns:

| Column | Purpose |
| --- | --- |
| `RequestId` | Unique ID. |
| `RequestedBy` | Email of requester. |
| `RequestedAt` | Timestamp. |
| `TargetSheet` | Name of control sheet. |
| `TargetRowKey` | Identifier for the target row or permission delta. |
| `Action` | `ADD`, `UPDATE`, `DELETE`, or `REMOVE`. |
| `ProposedRowSnapshot` | Serialized values (JSON or pipe-separated). |
| `Status` | `PENDING`, `APPROVED`, `DENIED`, `CANCELLED`, `APPLIED`, `EXPIRED`. |
| `ApprovalsNeeded` | Total approvals required (not remaining). |
| `Approver_1..N` | Approver emails. |
| `DenyReason` | Free text when denied/cancelled. |
| `AppliedAt` | Timestamp when applied. |

Note: when `ApprovalsEnabled = FALSE`, the `ChangeRequests` sheet may be hidden. Approver columns expand to match `RequiredApprovals`.

### Optional views
- **ChangeQueue**: filtered view of `PENDING`/`APPROVED` rows.
- **Health banner row**: warning note for invalid approval settings.

## End-to-end workflow
1. **Request capture**
   - Permission sheet edits define desired state.
   - Sync detects deltas and auto-creates ChangeRequests for each permission delta.
   - Manual ChangeRequests can be entered for direct sheet-row changes.

2. **Approval / denial via cells**
   - Approvers enter their emails in `Approver_*` columns.
   - Approvers must be valid emails and present in `SheetEditors_G`; invalid entries are rejected.
   - The script tallies unique approvers. When the count meets `ApprovalsNeeded`, it flips `Status` to `APPROVED`.
   - To deny, an editor sets `Status = DENIED` or `CANCELLED` and can add a `DenyReason`.

3. **Applying approved changes**
   - `processChangeRequests_()` applies **manual** ChangeRequests once approved.
   - Sync applies **permission-delta** ChangeRequests once approved and marks them `APPLIED`.
   - Pending rows are left untouched.

4. **Expiry and cleanup**
   - A scheduled trigger checks `RequestedAt` + `ApprovalExpiryHours`; if exceeded and still pending, set `Status = EXPIRED`.

## Safeguards and UX notes
- **Protected ranges**: Protect headers and computed columns in `ChangeRequests`.
- **Color cues**: Conditional formatting for `PENDING` (yellow), `APPROVED` (green), `DENIED/EXPIRED` (red/grey).
- **No self-approval**: The script ignores `Approver_*` entries matching `RequestedBy`.
- **Conflict avoidance**: `TargetSheet + TargetRowKey + Action` prevents duplicate pending requests for the same delta.

## Manual test plan (sheet-first)
1. **Baseline behavior (feature off)**
   - Set `ApprovalsEnabled = FALSE`.
   - Edit a permission sheet and run sync.
   - Expect: no ChangeRequests created; changes apply immediately.

2. **Auto-created requests**
   - Set `ApprovalsEnabled = TRUE`, `RequiredApprovals = 1`.
   - Edit a permission sheet and run sync.
   - Expect: a `PENDING` ChangeRequest appears for each delta.

3. **Approved delta applies**
   - Approve one pending row.
   - Run sync again.
   - Expect: the approved delta is applied and marked `APPLIED`.

4. **Pending delta does not apply**
   - Leave a ChangeRequest `PENDING`.
   - Run sync.
   - Expect: the change is not applied.

5. **Manual ChangeRequest path**
   - Create a manual `ADD/UPDATE/DELETE` ChangeRequest.
   - Approve it and run `processChangeRequests_()`.
   - Expect: the target control sheet is updated and the row is marked `APPLIED`.

## Limitations
- Approvals remain asynchronous; changes are applied on sync.
- Free-form `ProposedRowSnapshot` requires care for manual ChangeRequests.
