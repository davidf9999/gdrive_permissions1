/**
 * @file Audit.gs
 * @description Contains the logic for the Dry Run Audit and Deep Audit features.
 */

/**
 * Validates all user sheets listed in the ManagedFolders sheet.
 * @returns {boolean} True if all user sheets are valid, false otherwise.
 */
function validateUserSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const managedFoldersSheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (!managedFoldersSheet) {
    logAndAudit_('Validation', 'ManagedFolders', 'Sheet not found', 'The ManagedFolders sheet is missing.');
    return false;
  }

  const userSheetNames = managedFoldersSheet.getRange(2, USER_SHEET_NAME_COL, managedFoldersSheet.getLastRow() - 1, 1).getValues().flat();
  let isValid = true;

  // Check for duplicate user sheet names
  const sheetNameCounts = {};
  userSheetNames.forEach(name => {
    if (name) {
      sheetNameCounts[name] = (sheetNameCounts[name] || 0) + 1;
    }
  });

  for (const name in sheetNameCounts) {
    if (sheetNameCounts[name] > 1) {
      logAndAudit_('Validation', name, 'Duplicate user sheet', `The user sheet "${name}" is listed more than once in ManagedFolders.`);
      isValid = false;
    }
  }

  // Check each user sheet for validity
  userSheetNames.forEach(name => {
    if (name) {
      const sheet = ss.getSheetByName(name);
      if (!sheet) {
        logAndAudit_('Validation', name, 'Sheet not found', `The user sheet "${name}" does not exist.`);
        isValid = false;
        } else {
          // Check for duplicate emails only if the header is valid and the sheet has data rows
          if (sheet.getLastRow() > 1) {
            const emails = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat().filter(String);
            const emailCounts = {};
            emails.forEach(email => {
              const lowerEmail = email.trim().toLowerCase();
              if (lowerEmail) {
                emailCounts[lowerEmail] = (emailCounts[lowerEmail] || 0) + 1;
              }
            });

            for (const email in emailCounts) {
              if (emailCounts[email] > 1) {
                logAndAudit_('Validation', name, 'Duplicate email', `The email "${email}" appears ${emailCounts[email]} times in the sheet.`);
                isValid = false;
              }
            }
          }
        }
    }
  });

  return isValid;
}

/**
 * Performs a dry run audit by discovering all manual additions and logging them.
 */
function folderAudit() {
  const ui = SpreadsheetApp.getUi();
  try {
    log_('*** Starting Dry Run Audit...');
const auditSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FOLDER_AUDIT_LOG_SHEET_NAME);
    if (!auditSheet) {
      throw new Error('FolderAuditLog sheet not found. Please run the setup again.');
    }
    auditSheet.getRange(2, 1, auditSheet.getMaxRows() - 1, 5).clearContent();

    // 1. Check for duplicate group emails
    const emailValidation = validateUniqueGroupEmails_();
    if (!emailValidation.valid) {
      emailValidation.errors.forEach(error => {
        logAndAudit_('Configuration', 'Group Emails', 'DUPLICATE EMAIL', error.message);
      });
    }

    // 2. Validate user sheets
    validateUserSheets_();

    // 3. Discover users who should be in groups but aren't
    const discoveryReport = discoverManualAdditions_();
    discoveryReport.forEach(item => {
      item.membersToAdd.forEach(member => {
        logAndAudit_('Manual Addition', item.sheetName, 'User is in Google Group but not in sheet', `Email: ${member.email}, Source: ${member.source}`);
      });
    });

    // 4. Audit for permission mismatches for users who ARE in the sheets
    auditMemberRolesOnFolders_();

    if (discoveryReport.length === 0) {
      log_('Dry Run Audit found no manual additions to groups or folders.');
    }

    log_('*** Dry Run Audit Complete.');
    showToast_('Dry Run Audit Complete.', 'Audit', 5);
    ui.alert('Folder Audit is complete. See the \'FolderAuditLog\' sheet for details.');

  } catch (e) {
    log_('FATAL ERROR in folderAudit: ' + e.toString() + '\n' + e.stack, 'ERROR');
    showToast_('Audit failed with a fatal error.', 'Audit', 5);
    ui.alert('A fatal error occurred during the audit: ' + e.message);
    sendErrorNotification_(e.toString());
  }
}

/**
 * Audits that the group for each managed folder has the correct role, and that each member
 * of the group has the correct effective role.
 */
function auditMemberRolesOnFolders_() {
  const managedFoldersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (!managedFoldersSheet || managedFoldersSheet.getLastRow() < 2) {
    return;
  }

  const managedFoldersData = managedFoldersSheet.getRange(2, 1, managedFoldersSheet.getLastRow() - 1, GROUP_EMAIL_COL).getValues();
  managedFoldersData.forEach(row => {
    const folderName = row[FOLDER_NAME_COL - 1];
    const folderId = row[FOLDER_ID_COL - 1];
    const expectedRole = row[ROLE_COL - 1];
    const groupEmail = row[GROUP_EMAIL_COL - 1].toLowerCase();
    const userSheetName = row[USER_SHEET_NAME_COL - 1];

    if (!folderId || !groupEmail || !expectedRole || !userSheetName) return;

    const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(userSheetName);
    if (!userSheet) return;

    const sheetMembers = new Set(
      userSheet.getLastRow() > 1
        ? userSheet.getRange('A2:A' + userSheet.getLastRow()).getValues().map(r => r[0].toString().trim().toLowerCase()).filter(e => e)
        : []
    );

    if (sheetMembers.size === 0) return; // Skip if sheet is empty

    try {
      const folder = DriveApp.getFolderById(folderId);
      const viewers = folder.getViewers().map(u => u.getEmail().toLowerCase());
      const editors = folder.getEditors().map(u => u.getEmail().toLowerCase());

      sheetMembers.forEach(memberEmail => {
        const member = memberEmail.toLowerCase();
        let actualRole = 'NONE';
        if (editors.includes(member)) {
          actualRole = 'EDITOR';
        } else if (viewers.includes(member)) {
          actualRole = 'VIEWER';
        }

        if (actualRole.toUpperCase() !== expectedRole.toUpperCase()) {
          logAndAudit_('Role Mismatch', folderName, `User has incorrect role`, `Email: ${member}, Expected: ${expectedRole}, Actual: ${actualRole}`);
        }
      });

    } catch (e) {
      logAndAudit_('Folder Audit', folderName, 'Folder Not Found or Access Error', 'Could not access folder with ID: ' + folderId + ' or its members. Error: ' + e.message);
    }
  });
}


function auditGroupRoleOnFolder_(folder, folderName, expectedRole, groupEmail) {
    let hasCorrectPermission = false;
    let actualRole = 'NONE';
    const viewers = folder.getViewers().map(u => u.getEmail().toLowerCase());
    const editors = folder.getEditors().map(u => u.getEmail().toLowerCase());

    if (viewers.includes(groupEmail)) actualRole = 'Viewer';
    if (editors.includes(groupEmail)) actualRole = 'Editor';

    if (expectedRole.toUpperCase() === 'COMMENTER') {
        logAndAudit_('Folder Permission', folderName, 'Invalid Role for Folder', 'The role \'Commenter\' is not applicable to folders, only files. Please use \'Viewer\' or \'Editor\'.');
        return;
    }

    if (actualRole.toUpperCase() === expectedRole.toUpperCase()) {
        hasCorrectPermission = true;
    }

    if (!hasCorrectPermission) {
        logAndAudit_('Folder Permission', folderName, 'Permission Mismatch', 'Expected: ' + expectedRole + ', Actual: ' + actualRole);
    }
}

function deepAuditFolder() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Enter the ID of the managed folder to deep audit:', ui.ButtonSet.OK_CANCEL);

  if (response.getSelectedButton() !== ui.Button.OK || !response.getResponseText()) {
    return;
  }

  const folderId = response.getResponseText().trim();
  const managedFolderInfo = getManagedFolderInfoById_(folderId);

  if (!managedFolderInfo) {
    ui.alert('Error', `Folder ID '${folderId}' is not a managed folder. Please enter an ID from the 'ManagedFolders' sheet.`, ui.ButtonSet.OK);
    return;
  }

  const { folderName, groupEmail, userSheetName, expectedRole } = managedFolderInfo;

  try {
    log_(`*** Starting Deep Audit for folder: ${folderName} (${folderId})`);
    showToast_(`Starting Deep Audit for ${folderName}...`, 'Deep Audit', -1);

    const deepAuditSheet = setupDeepAuditLogSheet_();
    deepAuditSheet.clearContents();
    const headers = ['Timestamp', 'Type', 'Identifier', 'Issue', 'Details'];
    deepAuditSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    deepAuditSheet.setFrozenRows(1);

    const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(userSheetName);
    const sheetMembers = new Set(
      userSheet && userSheet.getLastRow() > 1
        ? userSheet.getRange('A2:A' + userSheet.getLastRow()).getValues().map(r => r[0].toString().trim().toLowerCase()).filter(e => e)
        : []
    );

    const groupMembers = new Set(getActualMembers_(groupEmail).map(m => m.toLowerCase()));
    const hierarchy = getFolderHierarchy_(DriveApp.getFolderById(folderId));

    hierarchy.forEach(item => {
      // 1. Check for unauthorized direct access
      let directUsers;
      if (typeof item.item.getMimeType === 'function') {
        directUsers = getDirectFileUsers_(item.item, groupEmail);
      } else {
        directUsers = getDirectFolderUsers_(item.item, groupEmail);
      }

      directUsers.forEach(user => {
        if (!isGroup_(user.email) && !groupMembers.has(user.email)) {
          logToDeepAudit_('Direct File Access', item.path, 'User has direct access but is not in group', `Email: ${user.email}, Role: ${user.role}`);
        }
      });

      // 2. Check for role mismatches for sheet members
      if (sheetMembers.size > 0) {
        const viewers = item.item.getViewers().map(u => u.getEmail().toLowerCase());
        const editors = item.item.getEditors().map(u => u.getEmail().toLowerCase());

        sheetMembers.forEach(memberEmail => {
          const member = memberEmail.toLowerCase();
          let actualRole = 'NONE';
          if (editors.includes(member)) {
            actualRole = 'EDITOR';
          } else if (viewers.includes(member)) {
            actualRole = 'VIEWER';
          }

          if (actualRole.toUpperCase() !== expectedRole.toUpperCase()) {
            logToDeepAudit_('Role Mismatch', item.path, 'User has incorrect role', `Email: ${member}, Expected: ${expectedRole}, Actual: ${actualRole}`);
          }
        });
      }
    });

    log_(`*** Deep Audit Complete for folder: ${folderName}`);
    showToast_('Deep Audit Complete.', 'Deep Audit', 5);
    ui.alert(`Deep Audit for '${folderName}' is complete. See the 'DeepFolderAuditLog' sheet for details.`);

  } catch (e) {
    log_(`FATAL ERROR in deepAuditFolder for ${folderName}: ` + e.toString() + '\n' + e.stack, 'ERROR');
    showToast_('Deep Audit failed.', 'Deep Audit', 5);
    ui.alert(`An error occurred during the deep audit for '${folderName}': ` + e.message);
  }
}

function logToDeepAudit_(type, identifier, issue, details) {
  const timestamp = Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  const auditSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DeepFolderAuditLog');
  auditSheet.appendRow([timestamp, type, identifier, issue, details]);
  log_('DEEP AUDIT [' + type + ' | ' + identifier + ']: ' + issue + ' - ' + details, 'WARN');
}

function getFolderHierarchy_(folder, path = '') {
  const currentPath = path + '/' + folder.getName();
  let hierarchy = [{ item: folder, path: currentPath }];

  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    hierarchy.push({ item: file, path: currentPath + '/' + file.getName() });
  }

  const subFolders = folder.getFolders();
  while (subFolders.hasNext()) {
    const subFolder = subFolders.next();
    hierarchy = hierarchy.concat(getFolderHierarchy_(subFolder, currentPath));
  }

  return hierarchy;
}

function getManagedFolderInfoById_(folderId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (!sheet) return null;
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, GROUP_EMAIL_COL).getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][FOLDER_ID_COL - 1] === folderId) {
      return {
        folderName: data[i][FOLDER_NAME_COL - 1],
        groupEmail: data[i][GROUP_EMAIL_COL - 1].toLowerCase(),
        userSheetName: data[i][USER_SHEET_NAME_COL - 1],
        expectedRole: data[i][ROLE_COL - 1]
      };
    }
  }
  return null;
}

function logAndAudit_(type, identifier, issue, details) {
  const timestamp = Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  const auditSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FOLDER_AUDIT_LOG_SHEET_NAME);
  auditSheet.appendRow([timestamp, type, identifier, issue, details]);
  log_('AUDIT [' + type + ' | ' + identifier + ']: ' + issue + ' - ' + details, 'WARN');
}

/**
 * Clears all content from the FolderAuditLog sheet.
 */
function clearFolderAuditLog() {
  const ui = SpreadsheetApp.getUi();
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FOLDER_AUDIT_LOG_SHEET_NAME);
    if (sheet) {
      sheet.clear();
      setupFolderAuditLogSheet_(sheet); // Re-add header
      log_('FolderAuditLog sheet has been cleared.');
      ui.alert('The Dry Run Audit Log has been cleared.');
    } else {
      ui.alert('FolderAuditLog sheet not found.');
    }
  } catch (e) {
    log_('Error clearing FolderAuditLog sheet: ' + e.toString(), 'ERROR');
    ui.alert('An error occurred while clearing the audit log: ' + e.message);
  }
}
