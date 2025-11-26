# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2024-01-01
- Initial public documentation and Apps Script release.

## [Unreleased] - 2025-01-XX

### Added
- **Explicit Group and Folder-Role Deletion Feature**: New Delete checkbox in ManagedFolders (Column I) and UserGroups (Column F) sheets allows explicit deletion of groups and folder-role bindings.
  - Delete Google Groups from Google Workspace
  - Delete user sheets from spreadsheet
  - Remove folder permissions (group removed from folder)
  - Remove control sheet rows after deletion
  - Google Drive folders are NEVER deleted (asymmetric design - folders auto-created but never deleted)
- **New Config Settings**:
  - `AllowGroupFolderDeletion` (default: FALSE): Master switch to enable/disable deletion feature
  - `NotifyOnGroupFolderDeletion` (default: TRUE): Send email notifications when deletions occur
- **Schema Changes**:
  - ManagedFolders: Added Delete checkbox column (Column I)
  - UserGroups: Added Delete checkbox column (Column F)
  - Both columns include checkbox validation
- **New Core Functions**:
  - `processDeletionRequests_()`: Main deletion coordinator
  - `processUserGroupDeletions_()`: Handles UserGroup deletion with nested group detection
  - `processManagedFolderDeletions_()`: Handles folder-role deletion with last-binding detection
  - `updateDeleteStatusWarnings_()`: Updates status when deletion disabled
  - `findGroupsContainingMember_()`: Detects nested group usage
  - `notifyDeletions_()`: Sends email notifications for deletions
- **Safety Mechanisms**:
  - Master switch (AllowGroupFolderDeletion)
  - Explicit checkbox requirement (no accidental deletions)
  - Status visibility (shows warnings when disabled)
  - Email notifications (optional audit trail)
  - Nested group warnings (detects group usage in other groups)
  - Last folder-binding detection (warns when removing last role)
  - `onEdit()` trigger warns against manual row deletion
  - Idempotent deletion handling (gracefully handles already-deleted groups)
- **Integration with Sync Flow**:
  - Deletions processed during Full Sync
  - Deletions happen AFTER validation, BEFORE regular sync operations
  - AutoSync supports deletion feature (if AllowGroupFolderDeletion enabled)
  - Deletion counts included in sync summary messages
- **Test Suite**: Four comprehensive test functions in Tests.gs:
  - `runUserGroupDeletionTest()`: Tests basic UserGroup deletion
  - `runFolderRoleDeletionTest()`: Tests folder-role deletion (verifies folder NOT deleted)
  - `runDeletionDisabledTest()`: Tests config disabled scenario
  - `runIdempotentDeletionTest()`: Tests graceful handling of already-deleted resources
  - `runAllDeletionTests()`: Test suite runner
- **Documentation**:
  - USER_GUIDE.md: New comprehensive section "Deleting Groups and Folder-Role Bindings"
  - USER_GUIDE.md: Updated ManagedFolders and UserGroups column descriptions
  - AUTO_SYNC_GUIDE.md: New section explaining deletion behavior with AutoSync
  - TESTING.md: New section "Deletion Feature Tests" with detailed test documentation
  - docs/DELETE_FEATURE_DESIGN.md: Complete 46-page design specification
  - docs/DELETE_FEATURE_DESIGN_UPDATES.md: Summary of approved design changes

### Changed
- **Sync Flow**: Full Sync now processes deletions before regular sync operations
- **Email Notifications**: Deletion notifications use separate config setting from user deletion notifications

### Removed
- **Config Setting**: Removed `AutoSyncMaxDeletions` (previously used to limit automatic deletions; now relying on multi-layer safety mechanisms without numeric limits)

### Fixed
- **Orphan Sheet Handling**: System now handles detection and cleanup of orphan sheets more robustly

## Template for future releases
- `## [X.Y.Z] - YYYY-MM-DD`
  - Added
  - Changed
  - Fixed
  - Removed
