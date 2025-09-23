/**
 * This file contains the logic for the Dry Run Audit feature.
 */

// =========================================================================
//  SECURE WRAPPER (for Web App)
// =========================================================================

function dryRunAudit_secure() {
  if (!isUserAdmin_()) throw new Error('You are not authorized to perform this action.');
  return dryRunAudit_core();
}

// =========================================================================
//  CORE LOGIC FUNCTION (no UI)
// =========================================================================

function dryRunAudit_core() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    throw new Error('An audit or sync is already in progress. Please wait a few minutes and try again.');
  }
  try {
    log_('*** Starting Dry Run Audit...');
    const auditSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DRY_RUN_AUDIT_LOG_SHEET_NAME);
    if (!auditSheet) {
      throw new Error('DryRunAuditLog sheet not found. Please run the setup again.');
    }
    auditSheet.getRange(2, 1, auditSheet.getMaxRows() - 1, 5).clearContent();

    auditManagedFolders_();
    auditAllGroups_();

    log_('*** Dry Run Audit Complete.');
    return 'Dry Run Audit is complete. See the \'DryRunAuditLog\' sheet for details.';
  } catch (e) {
    const errorMessage = 'FATAL ERROR in dryRunAudit: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    sendErrorNotification_(errorMessage);
    throw new Error('A fatal error occurred during the audit: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

// =========================================================================
//  UI-BOUND WRAPPER (original function)
// =========================================================================

function dryRunAudit() {
  try {
    showToast_('Starting Dry Run Audit...', 'Audit', 10);
    const message = dryRunAudit_core();
    showToast_('Dry Run Audit Complete.', 'Audit', 5);
    SpreadsheetApp.getUi().alert(message);
  } catch (e) {
    showToast_('Audit failed with a fatal error.', 'Audit', 5);
    SpreadsheetApp.getUi().alert(e.message);
  }
}

// =========================================================================
//  LOWER-LEVEL FUNCTIONS (unchanged)
// =========================================================================

function auditManagedFolders_() {
  log_('Auditing Managed Folders...');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (!sheet) {
    logAndAudit_('ManagedFolders', 'Sheet', 'Sheet Not Found', 'Cannot audit managed folders.');
    return;
  }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const data = sheet.getRange(2, 1, lastRow - 1, GROUP_EMAIL_COL).getValues();
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const folderName = row[FOLDER_NAME_COL - 1];
    const folderId = row[FOLDER_ID_COL - 1];
    const role = row[ROLE_COL - 1];
    const groupEmail = row[GROUP_EMAIL_COL - 1].toLowerCase();

    if (!folderId) {
      logAndAudit_('ManagedFolders', folderName, 'Missing Folder ID', 'Skipping audit for this folder.');
      continue;
    }
    try {
      const folder = DriveApp.getFolderById(folderId);
      let hasCorrectPermission = false;
      const roleUpper = role.toUpperCase();
      if (roleUpper === 'VIEWER') {
        if (folder.getViewers().map(u => u.getEmail().toLowerCase()).includes(groupEmail)) hasCorrectPermission = true;
      } else if (roleUpper === 'EDITOR') {
        if (folder.getEditors().map(u => u.getEmail().toLowerCase()).includes(groupEmail)) hasCorrectPermission = true;
      } else if (roleUpper === 'COMMENTER') {
        if (folder.getCommenters().map(u => u.getEmail().toLowerCase()).includes(groupEmail)) hasCorrectPermission = true;
      }
      if (!hasCorrectPermission) {
        let actualRole = 'NONE';
        if (folder.getViewers().map(u => u.getEmail().toLowerCase()).includes(groupEmail)) actualRole = 'Viewer';
        if (folder.getCommenters().map(u => u.getEmail().toLowerCase()).includes(groupEmail)) actualRole = 'Commenter';
        if (folder.getEditors().map(u => u.getEmail().toLowerCase()).includes(groupEmail)) actualRole = 'Editor';
        logAndAudit_('Folder Permission', folderName, 'Permission Mismatch', 'Expected: ' + role + ', Actual: ' + actualRole);
      }
    } catch (e) {
      logAndAudit_('Folder', folderName, 'Folder Not Found', 'Could not access folder with ID: ' + folderId);
    }
  }
}

function auditAllGroups_() {
  log_('Auditing All User Groups...');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allGroups = new Map();
  const userGroupsSheet = ss.getSheetByName(USER_GROUPS_SHEET_NAME);
  if (userGroupsSheet && userGroupsSheet.getLastRow() > 1) {
    userGroupsSheet.getRange(2, 1, userGroupsSheet.getLastRow() - 1, 2).getValues().forEach(row => {
      if (row[0] && row[1]) allGroups.set(row[0], row[1]);
    });
  }
  const managedFoldersSheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (managedFoldersSheet && managedFoldersSheet.getLastRow() > 1) {
    managedFoldersSheet.getRange(2, 1, managedFoldersSheet.getLastRow() - 1, GROUP_EMAIL_COL).getValues().forEach(row => {
      if (row[USER_SHEET_NAME_COL - 1] && row[GROUP_EMAIL_COL - 1]) allGroups.set(row[USER_SHEET_NAME_COL - 1], row[GROUP_EMAIL_COL - 1]);
    });
  }
  if (allGroups.size === 0) return;
  allGroups.forEach((groupEmail, groupName) => {
    if (!groupEmail) {
      logAndAudit_('Group Audit', groupName, 'Missing Group Email', 'Skipping membership audit.');
      return;
    }
    auditGroupMembership_(groupName, groupEmail);
  });
}

function auditGroupMembership_(groupName, groupEmail) {
  try {
    const desiredMembers = getDesiredMembers_(groupName);
    const actualMembers = getActualMembers_(groupEmail);
    const desiredSet = new Set(desiredMembers.map(m => m.toLowerCase()));
    const actualSet = new Set(actualMembers.map(m => m.toLowerCase()));
    const missingMembers = desiredMembers.filter(m => !actualSet.has(m.toLowerCase()));
    const extraMembers = actualMembers.filter(m => !desiredSet.has(m.toLowerCase()));
    if (missingMembers.length > 0) logAndAudit_('Group Membership', groupName, 'Missing Members', missingMembers.join(', '));
    if (extraMembers.length > 0) logAndAudit_('Group Membership', groupName, 'Extra Members', extraMembers.join(', '));
  } catch (e) {
    logAndAudit_('Group Membership', groupName, 'Error', e.message);
  }
}

function getDesiredMembers_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('User sheet \'' + sheetName + '\' not found.');
  return sheet.getRange('A2:A' + sheet.getLastRow()).getValues().map(r => r[0].toString().trim().toLowerCase()).filter(e => e && e.includes('@'));
}

function getActualMembers_(groupEmail) {
  assertAdminDirectoryAvailable_();
  const members = [];
  let pageToken;
  try {
    do {
      const resp = AdminDirectory.Members.list(groupEmail, { maxResults: 200, pageToken: pageToken });
      if (resp && resp.members) members.push.apply(members, resp.members.map(m => m.email));
      pageToken = resp ? resp.nextPageToken : null;
    } while (pageToken);
  } catch (e) {
    if (e.message.includes('Resource Not Found: groupKey')) throw new Error('Group ' + groupEmail + ' does not exist.');
    throw e;
  }
  return members;
}

function logAndAudit_(type, identifier, issue, details) {
  const timestamp = Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  const auditSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DRY_RUN_AUDIT_LOG_SHEET_NAME);
  auditSheet.appendRow([timestamp, type, identifier, issue, details]);
  log_('AUDIT [' + type + ' | ' + identifier + ']: ' + issue + ' - ' + details, 'WARN');
}