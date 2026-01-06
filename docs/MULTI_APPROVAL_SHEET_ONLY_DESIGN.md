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

## Manual test plan (sheet-only interactions)
These scenarios validate the approval pipeline without Apps Script menus. Reset any banner warnings between runs and ensure installable triggers are enabled (on-change normalization and AutoSync/time-driven processing).

1. **Baseline behavior (feature off)**
   - Set `ApprovalsEnabled = FALSE` and `RequiredApprovals = 1` on Config.
   - Edit a control sheet row directly and run a normal sync.
   - Expect: no `ChangeRequests` interaction; sync behaves as it does today.

2. **Single-approver path (default threshold)**
   - Set `ApprovalsEnabled = TRUE`, `RequiredApprovals = 1`.
   - Add a `PENDING` row in `ChangeRequests` for an `ADD` or `UPDATE` action.
   - Trigger processing (on-change/AutoSync) and confirm the row flips to `APPROVED` then `APPLIED` without extra approvers.
   - Expect: target control sheet reflects the change; `AppliedAt` is set; banner has no warnings.

3. **Happy path with multiple approvers**
   - Set `RequiredApprovals = 2` (or higher, within available editors).
   - Requester adds a `PENDING` row; note `ApprovalsNeeded` is populated and requester email captured.
   - Two distinct sheet editors type their emails into `Approver_*` columns.
   - After trigger run, expect `Status` transitions to `APPROVED`, then `APPLIED`, with both approvers recorded and requester not counted.

4. **Requester cannot self-approve**
   - With `RequiredApprovals > 1`, add a request and have the requester fill the first `Approver_*` cell with their own email.
   - Trigger processing should leave `Status = PENDING` and a banner or note indicating self-approval is ignored.
   - Add a second distinct approver; expect approval proceeds only after sufficient non-requester emails are present.

5. **Insufficient sheet editors warning**
   - Temporarily remove editors from `SheetEditors` so the count is lower than `RequiredApprovals`.
   - Add a `PENDING` request.
   - Expect: processing leaves request pending/blocked, updates the banner row with a warning about unavailable approvers, and does not apply changes.
   - Restore editors and re-run processing; confirm warning clears and the request can advance with valid approvers.

6. **Denial / cancellation flow**
   - Add a `PENDING` request with `RequiredApprovals > 1`.
   - An editor sets `Status = DENIED` (optionally fills `DenyReason`).
   - Expect: row becomes immutable for further approvals; no changes are applied to control sheets; AutoSync skips it and logs denial.
   - Repeat with `Status = CANCELLED` to mirror requester withdrawal.

7. **Expiry handling**
   - Configure `ApprovalExpiryHours` to a small value (e.g., 0.01) for testing.
   - Add a `PENDING` request with no approvers and wait past the threshold, then trigger processing.
   - Expect: `Status` flips to `EXPIRED`, and the request is not applied. Reset expiry to normal after test.

8. **Conflict/validation guardrail**
   - Create two requests targeting the same `TargetRowKey` (one `UPDATE`, one `DELETE`).
   - Approve both and run processing.
   - Expect: the second request should be blocked or marked `DENIED` with a reason indicating conflict or missing key, preventing double-apply.

9. **AutoSync integration**
   - With `ApprovalsEnabled = TRUE`, place at least one approved request and one pending request.
   - Run AutoSync/full sync.
   - Expect: approved request is applied before normal sync steps; pending request remains untouched; logs reflect ordered processing.

10. **Post-apply cleanup**
   - After successful applications, verify that `Status = APPLIED`, `AppliedAt` is populated, and no residual notes exist.
   - Optionally clear old applied/expired rows and confirm banner remains clear.

## Limitations
- Approvals remain asynchronous; changes are applied on sync.
- Free-form `ProposedRowSnapshot` requires care for manual ChangeRequests.
