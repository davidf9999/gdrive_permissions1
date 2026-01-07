# Change Requests & Permission Change Logging

This guide consolidates how permission changes are approved and how the `ChangeRequests` sheet captures audit history for those changes.

## What the ChangeRequests sheet is for
The `ChangeRequests` sheet is the single source of truth for **approval gating** and **audit logging** of permission changes. It is always visible and retains a row for every permission delta the system detects, even when approvals are disabled.

## Sources of ChangeRequests
ChangeRequests are created from two sources:

1. **Permission deltas (auto-created)**
   - Created during sync when desired state differs from actual state.
   - Applied by sync after approval (or immediately when approvals are disabled).
   - Each delta is independent and has its own ChangeRequest row.

2. **Manual ChangeRequests (optional)**
   - Entered directly for control-sheet row changes (ADD/UPDATE/DELETE).
   - Applied by `processChangeRequests_()` once approved.

## Approvals & application flow
1. `processChangeRequests_()` normalizes approvals, expires stale requests, and applies **manual** ChangeRequests.
2. Sync detects permission deltas and creates/updates ChangeRequests.
3. Approved permission deltas are applied immediately; pending ones are skipped.
4. Applied rows are marked `APPLIED` with an `AppliedAt` timestamp.

### Per-change gating (key behavior)
Approvals gate **each permission change**, not the entire sync. The ChangeRequest key `(TargetSheet, TargetRowKey, Action)` defines a unique change:
- `APPROVED` → apply the change.
- `PENDING` → skip the change until approved.
- Terminal statuses (`APPLIED`, `DENIED`, `EXPIRED`) → skip.

## ChangeRequests sheet fields (key columns)

| Column | Purpose |
| --- | --- |
| `RequestId` | Unique ID. |
| `RequestedBy` | Email of requester. |
| `RequestedAt` | Timestamp. |
| `TargetSheet` | Name of control sheet. |
| `TargetRowKey` | Identifier for the target row or permission delta. |
| `Action` | `ADD`, `UPDATE`, `DELETE`, or `REMOVE`. |
| `ProposedRowSnapshot` | Serialized values (JSON or pipe-separated). |
| `Status` | `PENDING`, `APPROVED`, `DENIED`, `APPLIED`, `EXPIRED`. Auto-managed (read-only). |
| `ApprovalsNeeded` | Total approvals required (not remaining). |
| `Approver_1..N` | Approver emails (max 3). |
| `DenyReason` | Any text here auto-denies and clears approvers. |
| `AppliedAt` | Timestamp when applied. |

## Configuration inputs
From the `Config` sheet:
- `ApprovalsEnabled` (boolean) – toggles approvals on/off.
- `RequiredApprovals` (number) – minimum distinct approvers. Max 3 and cannot exceed active Sheet Editors.
- `ApprovalExpiryHours` (number, optional) – auto-expire stale requests.

Guardrail: changes to `ApprovalsEnabled` or `RequiredApprovals` are blocked while any ChangeRequests are pending.

## Audit logging behavior
- **Approvals enabled**: permission deltas create `PENDING` rows and apply only after approval.
- **Approvals disabled**: permission deltas still create ChangeRequests, auto-applied with `ApprovalsNeeded = 0`.
- The `ChangeRequests` sheet is always visible and is treated as an audit log.

## Status rules (auto-managed)
- `PENDING`: default until enough approvers are listed.
- `APPROVED`: set automatically when required approver count is met.
- `DENIED`: set automatically when `DenyReason` is non-empty (clears approvers).
- `APPLIED`: set by the system after the change executes.
- `EXPIRED`: set by the system when the request times out.

## AutoSync interactions
AutoSync runs when there are approved ChangeRequests waiting to apply, so approved permission deltas do not sit idle.

## UX and safety notes
- Protect header and computed columns in the `ChangeRequests` sheet.
- Approver entries must be valid emails present in `SheetEditors_G`.
- Self-approval is ignored when `RequestedBy` matches an approver.
