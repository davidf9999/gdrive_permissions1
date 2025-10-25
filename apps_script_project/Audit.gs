function dryRunAudit() {
  const ui = SpreadsheetApp.getUi();
  try {
    log_('*** Starting Dry Run Audit...');
    showToast_('Starting Dry Run Audit...', 'Audit', 10);

    const auditSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DRY_RUN_AUDIT_LOG_SHEET_NAME);
    if (!auditSheet) {
      throw new Error('DryRunAuditLog sheet not found. Please run the setup again.');
    }
    auditSheet.getRange(2, 1, auditSheet.getMaxRows() - 1, 5).clearContent();

    // Audit Folders
    auditManagedFolders_();

    // Audit Groups
    auditAllGroups_();

    log_('*** Dry Run Audit Complete.');
    showToast_('Dry Run Audit Complete.', 'Audit', 5);
    ui.alert('Dry Run Audit is complete. See the \'DryRunAuditLog\' sheet for details.');

  } catch (e) {
    log_('FATAL ERROR in dryRunAudit: ' + e.toString() + '\n' + e.stack, 'ERROR');
    showToast_('Audit failed with a fatal error.', 'Audit', 5);
    ui.alert('A fatal error occurred during the audit: ' + e.message);
    sendErrorNotification_(e.toString());
  }
}

function auditManagedFolders_() {
  log_('Auditing Managed Folders...');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (!sheet) {
    logAndAudit_('ManagedFolders', 'Sheet', 'Sheet Not Found', 'Cannot audit managed folders.');
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    log_('No managed folders to audit.');
    return;
  }

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

      // Check if the group is in the correct permission list
      if (roleUpper === 'VIEWER') {
        const viewers = folder.getViewers().map(u => u.getEmail().toLowerCase());
        if (viewers.includes(groupEmail)) {
          hasCorrectPermission = true;
        }
      } else if (roleUpper === 'EDITOR') {
        const editors = folder.getEditors().map(u => u.getEmail().toLowerCase());
        if (editors.includes(groupEmail)) {
          hasCorrectPermission = true;
        }
      } else if (roleUpper === 'COMMENTER') {
        const commenters = folder.getCommenters().map(u => u.getEmail().toLowerCase());
        if (commenters.includes(groupEmail)) {
          hasCorrectPermission = true;
        }
      }

      if (!hasCorrectPermission) {
        // If the permission is wrong, figure out what the actual role is for better logging.
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
  const allGroups = new Map(); // Use a map to store groupName -> groupEmail to handle duplicates

  // 1. Get groups from UserGroups sheet
  const userGroupsSheet = ss.getSheetByName(USER_GROUPS_SHEET_NAME);
  if (userGroupsSheet && userGroupsSheet.getLastRow() > 1) {
    const userGroupsData = userGroupsSheet.getRange(2, 1, userGroupsSheet.getLastRow() - 1, 2).getValues();
    userGroupsData.forEach(row => {
      const groupName = row[0];
      const groupEmail = row[1];
      if (groupName && groupEmail) {
        allGroups.set(groupName, groupEmail);
      }
    });
  } else {
    log_('No groups to audit in UserGroups sheet or sheet not found.');
  }

  // 2. Get groups from ManagedFolders sheet
  const managedFoldersSheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (managedFoldersSheet && managedFoldersSheet.getLastRow() > 1) {
    const managedFoldersData = managedFoldersSheet.getRange(2, 1, managedFoldersSheet.getLastRow() - 1, GROUP_EMAIL_COL).getValues();
    managedFoldersData.forEach(row => {
      const groupName = row[USER_SHEET_NAME_COL - 1];
      const groupEmail = row[GROUP_EMAIL_COL - 1];
      if (groupName && groupEmail) {
        allGroups.set(groupName, groupEmail);
      }
    });
  } else {
    log_('No groups to audit in ManagedFolders sheet or sheet not found.');
  }

  if (allGroups.size === 0) {
    log_('No groups found to audit in any sheet.');
    return;
  }

  log_(`Found ${allGroups.size} total unique groups to audit.`);

  // 3. Audit each group
  allGroups.forEach((groupEmail, groupName) => {
    if (!groupEmail) {
      logAndAudit_('Group Audit', groupName, 'Missing Group Email', 'Skipping membership audit for this group.');
      return;
    }
    auditGroupMembership_(groupName, groupEmail);
  });
}

function auditGroupMembership_(groupName, groupEmail) {
  try {
    // Validate for duplicate emails before auditing
    const validation = validateUserSheetEmails_(groupName);
    if (!validation.valid) {
      logAndAudit_('Group Membership', groupName, 'VALIDATION ERROR', validation.error);
      return; // Stop processing this group
    }

    const desiredMembers = getDesiredMembers_(groupName);
    const actualMembers = getActualMembers_(groupEmail);

    const desiredSet = new Set(desiredMembers.map(m => m.toLowerCase()));
    const actualSet = new Set(actualMembers.map(m => m.toLowerCase()));

    const missingMembers = desiredMembers.filter(m => !actualSet.has(m.toLowerCase()));
    const extraMembers = actualMembers.filter(m => !desiredSet.has(m.toLowerCase()));

    if (missingMembers.length > 0) {
      logAndAudit_('Group Membership', groupName, 'Missing Members', missingMembers.join(', '));
    }

    if (extraMembers.length > 0) {
      logAndAudit_('Group Membership', groupName, 'Extra Members', extraMembers.join(', '));
    }

  } catch (e) {
    logAndAudit_('Group Membership', groupName, 'Error', e.message);
  }
}

function getDesiredMembers_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('User sheet \'' + sheetName + '\' not found.');
  }
  return sheet.getRange('A2:A' + sheet.getLastRow()).getValues()
    .map(row => row[0].toString().trim().toLowerCase())
    .filter(email => email && email.includes('@'));
}

function getActualMembers_(groupEmail) {
  assertAdminDirectoryAvailable_();
  const members = [];
  let pageToken;
  try {
    do {
      const resp = AdminDirectory.Members.list(groupEmail, {
        maxResults: 200,
        pageToken: pageToken
      });
      if (resp && resp.members) {
        members.push.apply(members, resp.members.map(m => m.email));
      }
      pageToken = resp ? resp.nextPageToken : null;
    } while (pageToken);
  } catch (e) {
    if (e.message.includes('Resource Not Found: groupKey')) {
      throw new Error('Group ' + groupEmail + ' does not exist.');
    }
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

/**
 * Validates all user sheets for duplicate emails and displays a summary
 */
function validateAllUserSheets() {
  const ui = SpreadsheetApp.getUi();
  try {
    log_('*** Starting Validate All User Sheets...');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const allUserSheets = [];
    const validationResults = [];

    // 1. Collect all user sheets from UserGroups
    const userGroupsSheet = ss.getSheetByName(USER_GROUPS_SHEET_NAME);
    if (userGroupsSheet && userGroupsSheet.getLastRow() > 1) {
      const userGroupsData = userGroupsSheet.getRange(2, 1, userGroupsSheet.getLastRow() - 1, 1).getValues();
      userGroupsData.forEach(row => {
        const sheetName = row[0];
        if (sheetName) allUserSheets.push(sheetName);
      });
    }

    // 2. Collect all user sheets from ManagedFolders
    const managedFoldersSheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
    if (managedFoldersSheet && managedFoldersSheet.getLastRow() > 1) {
      const managedData = managedFoldersSheet.getRange(2, USER_SHEET_NAME_COL, managedFoldersSheet.getLastRow() - 1, 1).getValues();
      managedData.forEach(row => {
        const sheetName = row[0];
        if (sheetName && !allUserSheets.includes(sheetName)) {
          allUserSheets.push(sheetName);
        }
      });
    }

    // 3. Add Admins sheet
    allUserSheets.push(ADMINS_SHEET_NAME);

    if (allUserSheets.length === 0) {
      ui.alert('Validation Complete', 'No user sheets found to validate.', ui.ButtonSet.OK);
      return;
    }

    log_('Validating ' + allUserSheets.length + ' user sheets...');

    // 4. Validate each sheet
    let errorCount = 0;
    allUserSheets.forEach(sheetName => {
      const validation = validateUserSheetEmails_(sheetName);
      if (!validation.valid) {
        errorCount++;
        validationResults.push('❌ ' + sheetName + ': ' + validation.error);
        log_('VALIDATION ERROR in "' + sheetName + '": ' + validation.error, 'ERROR');
      } else {
        validationResults.push('✓ ' + sheetName + ': OK');
        log_('Validation passed for "' + sheetName + '"', 'INFO');
      }
    });

    // 5. Display results
    const summary = 'Validated ' + allUserSheets.length + ' user sheets.\n\n' +
                    'Sheets with errors: ' + errorCount + '\n' +
                    'Sheets without errors: ' + (allUserSheets.length - errorCount) + '\n\n' +
                    'Details:\n' + validationResults.join('\n');

    if (errorCount > 0) {
      ui.alert('Validation Complete - Errors Found', summary, ui.ButtonSet.OK);
    } else {
      ui.alert('Validation Complete - All OK!', summary, ui.ButtonSet.OK);
    }

    log_('*** Validate All User Sheets Complete. Errors found: ' + errorCount);

  } catch (e) {
    log_('ERROR in validateAllUserSheets: ' + e.toString(), 'ERROR');
    ui.alert('Validation Error', 'An error occurred during validation: ' + e.message, ui.ButtonSet.OK);
  }
}
