# Executive Summary: Approval Gating Behavior (Current)

## Current Design (as implemented now)

### Per-change approvals
- **Per-change gating**: When `ApprovalsEnabled = TRUE`, sync still runs, but each permission delta is gated by its own ChangeRequest.
- **No per-row flag needed**: The ChangeRequest key `(TargetSheet, TargetRowKey, Action)` is the gating mechanism.
- **Implication**: Every permission delta is either approved and applied, or created as a pending ChangeRequest and skipped.

### How approvals are applied
- `processChangeRequests_()`:
  - Normalizes approvals, handles expiry, and applies **non-permission** ChangeRequests.
  - Does **not** apply permission-delta ChangeRequests.
- Sync:
  - Detects deltas, creates/updates ChangeRequests, and applies only approved deltas.
  - Marks successful permission deltas as `APPLIED`.

### AutoSync vs Manual Sync
Both flows behave the same with approvals enabled:
- Apply approved non-permission ChangeRequests first.
- Run sync and gate each permission delta independently.
- Pending deltas are left in `PENDING`.
- AutoSync also runs when approved permission ChangeRequests are waiting to be applied.

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

This matrix drives delta detection. Each delta becomes its own ChangeRequest when approvals are enabled.

## Summary
- Approvals are **per-change**, not global.
- Permission deltas are **auto-created** during sync and are applied only when approved.
- Manual ChangeRequests remain supported for direct control-sheet updates.
