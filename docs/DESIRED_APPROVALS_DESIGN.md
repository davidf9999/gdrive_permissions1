# Desired Approvals Design: Per-Change Atomic Gating

## Executive Summary of Desired Design

### Core Concept
**Approvals gate individual permission changes, not the entire sync operation.** Each detected permission delta (difference between desired state and actual state) should:

1. **Create/update a ChangeRequest** if one does not exist for that specific change
2. **Apply the change** if its ChangeRequest has been approved
3. **Skip the change** if its ChangeRequest is still pending approval
4. **Continue processing other changes** independently

### Key Principles

#### 1. Desired State vs. Actual State
- **Desired state** is defined by the sheets (permission rows)
  - Row exists + not disabled → user/group SHOULD be in workspace group
  - Row does not exist OR is disabled → user/group SHOULD NOT be in workspace group

- **Actual state** is the current Google Workspace group membership
  - User/group is or is not in the workspace group

#### 2. Delta Detection
For each "permission atom" (folder:group:member OR group:member):
```
IF (desired_state != actual_state) THEN
  change_needed = TRUE
  change_type = ADD or REMOVE
END IF
```

#### 3. ChangeRequest as Atomic Gate
Each detected change gets its own ChangeRequest:
- **ChangeRequest Key**: `(TargetSheet, TargetRowKey, Action)` uniquely identifies a change
- If ChangeRequest already exists for this key:
  - Status = APPROVED → apply the change
  - Status = PENDING → skip this change (wait for approval)
  - Status = APPLIED/DENIED/etc → skip (terminal state)
- If ChangeRequest does not exist:
  - Create it with Status = PENDING
  - Skip applying the change (wait for approval)

#### 4. Independent Change Processing
**Critical**: Approved changes can be applied immediately without waiting for all changes to be approved. Each change is independent.

Example scenario:
- Change A: Add Bob to Group X → APPROVED → **Applied immediately**
- Change B: Add Alice to Group Y → PENDING → **Skipped, waits**
- Change C: Remove Carol from Group Z → APPROVED → **Applied immediately**

### Benefits of This Design
1. **No blocking**: Approved changes do not wait for unrelated pending approvals
2. **Granular control**: Each permission change can be reviewed independently
3. **Efficient**: Work proceeds on approved items while others await review
4. **Clear audit trail**: Each change has its own approval record

---

## Current Implementation (Per-Change Atomic Gating)

### How Approvals Work Now
The system implements **per-change gating** during sync:

1. `processChangeRequests_()` runs first to normalize approvals and apply any **non-permission** ChangeRequests.
2. Sync proceeds with delta detection even when approvals are enabled.
3. Each detected permission delta creates (or updates) a ChangeRequest and is **only applied when approved**.
4. Approved deltas are applied immediately and their ChangeRequests are marked `APPLIED`.

### ChangeRequest Sources
There are two ChangeRequest sources in the current design:

1. **Permission deltas (auto-created)**  
   - Created during sync when desired state differs from actual state.
   - Stored with a permission-delta snapshot marker so `processChangeRequests_()` does not apply them directly.
   - Applied only by sync after approval.

2. **Manual ChangeRequests (sheet edits)**  
   - Still supported for direct sheet changes (ADD/UPDATE/DELETE rows).
   - Applied by `processChangeRequests_()` once approved.

### TargetRowKey Conventions (Current)
ChangeRequest uniqueness is `(TargetSheet, TargetRowKey, Action)`. Keys follow:

- **Group membership**: `TargetSheet = user sheet name`, `TargetRowKey = user email`
- **Folder permissions**: `TargetSheet = ManagedFolders`, `TargetRowKey = folderId|groupEmail|role`
- **Sheet editors**:
  - File editors: `TargetRowKey = FILE_EDITOR|email`
  - Group members: `TargetRowKey = GROUP_MEMBER|email`

### Sheet Edit Behavior
- Permission sheet edits are **no longer reverted**.
- Edits represent **desired state**, and approvals are enforced during sync.

---

## Operational Flow
1. `processChangeRequests_()` normalizes approvals and applies non-permission ChangeRequests.
2. Sync detects permission deltas and creates/updates ChangeRequests.
3. Approved deltas are applied, and their rows are marked `APPLIED`.

---

## Testing
1. **Approvals disabled**: sync applies immediately; ChangeRequests are still created as auto-applied audit entries (`ApprovalsNeeded = 0`).
2. **Approvals enabled**:
   - Make sheet edits to create deltas.
   - Run sync to auto-create ChangeRequests.
   - Approve some rows; only approved deltas apply.
   - Pending deltas remain unapplied.
