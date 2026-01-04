# Executive Summary: Approval Gating Behavior, Expectations, and Options

## Current Design (as implemented now)

### Global vs. per-line approvals
- **Global gating**: When `ApprovalsEnabled = TRUE`, the system is intended to **route all permission changes through ChangeRequests**.
- **No per-row flag**: There is **no per-row field** in permission sheets that indicates whether a specific row should bypass approvals.
- **Implication**: Any permission change should be staged in `ChangeRequests` and applied only after approvals. Direct sync should not apply permission changes when approvals are on.

### How approvals are applied
- Approved ChangeRequests are applied by `processChangeRequests_()` and then set to `APPLIED`.
- Pending ChangeRequests are left in `PENDING` status until enough approvers are present.

### AutoSync vs Manual Sync (current intent)
- **AutoSync** should always:
  - Apply approved ChangeRequests first.
  - Continue with normal sync if approvals are disabled.
- **Manual sync** should:
  - Apply approved ChangeRequests.
  - Avoid applying direct permission changes when approvals are enabled.

This makes manual sync and AutoSync **consistent** with approvals: both should avoid direct permission changes when approvals are enabled.

## Your Expectation (as understood)

- When approvals are enabled, **only changes represented in ChangeRequests** should be held for approval.
- Other permission changes (that are not in ChangeRequests) should be applied immediately via AutoSync/manual sync.
- In other words: **approval gating should be atomic per permission row**, not global.

## Why this expectation conflicts with the current implementation

The system **cannot safely know** whether a change should be gated unless it has an explicit policy marker.

- ChangeRequests are **staged changes**, not a policy for whether a row should be gated.
- If approvals are enabled and we allow direct sync for rows that don’t appear in ChangeRequests, **any edit can bypass approvals** unless there is a rule that explicitly says “this row requires approval.”

Therefore, **without a per-row flag**, any direct sync while approvals are enabled is a potential bypass.

## Change-Need Matrix (One User in One Group)

Definitions:
- Sheet? = user appears in group sheet
- Disabled? = user row marked Disabled
- In Group? = actual Google Group membership

```
Sheet?  Disabled?  In Group?   Desired Outcome     Change Needed?
No      N/A        No          No access           No
No      N/A        Yes         Remove from group   Yes (REMOVE)

Yes     No         No          Add to group        Yes (ADD)
Yes     No         Yes         Keep access         No

Yes     Yes        No          No access           No
Yes     Yes        Yes         Remove from group   Yes (REMOVE)
```

This matrix **detects when a change is needed**, but it does **not** indicate whether that change should be approval-gated. That requires a policy flag or rule.

## Options to Align Behavior with Your Expectation

### Option A: Strict global approvals (simple, safe)
- All permission changes are staged via ChangeRequests.
- Direct syncs do not apply permission changes while approvals are enabled.
- Pros: No bypass possible.
- Cons: Pending approval blocks *all* permission changes.

### Option B: Per-row approvals (recommended for atomic behavior)
- Add a `RequireApproval` checkbox column to permission input sheets.
- Rule:
  - `RequireApproval = TRUE` -> ChangeRequest required.
  - `RequireApproval = FALSE` -> apply directly.
- Pros: Unapproved changes don’t block unrelated changes.
- Cons: Requires new column on relevant sheets and logic updates.

## Manual sync vs AutoSync (behavioral difference)

From an approvals standpoint:
- **Manual sync** is a privileged, user-initiated operation; if it applies direct permission changes while approvals are enabled, it can bypass approvals.
- **AutoSync** is scheduled; it should be safe by default and avoid bypassing approvals.

Therefore, if approvals are global:
- Both manual sync and AutoSync must skip direct permission changes.

If approvals are per-row:
- Both manual sync and AutoSync can apply non-gated changes and stage gated ones.

## Summary

- The current system is designed for **global approvals** when approvals are enabled.
- Your expectation is for **atomic approvals per row**, which requires a **per-row policy flag**.
- Without a per-row marker, allowing direct sync while approvals are enabled introduces approval bypass risk.
- To achieve your goal, implement a `RequireApproval` flag (or similar) on permission sheets.

