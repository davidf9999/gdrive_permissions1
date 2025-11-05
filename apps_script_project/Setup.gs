/**
 * Migrates old UserGroup sheets to new naming convention (adds "_G" suffix).
 * This ensures compatibility with the new naming scheme where group sheets
 * end with "_G" to distinguish them from folder sheets.
 */
function migrateUserGroupSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userGroupsSheet = ss.getSheetByName(USER_GROUPS_SHEET_NAME);

  if (!userGroupsSheet || userGroupsSheet.getLastRow() < 2) {
    return; // No user groups defined, nothing to migrate
  }

  const groupNames = userGroupsSheet.getRange(2, 1, userGroupsSheet.getLastRow() - 1, 1).getValues();

  for (let i = 0; i < groupNames.length; i++) {
    const groupName = groupNames[i][0];
    if (!groupName || !groupName.toString().trim()) {
      continue;
    }

    const oldSheetName = groupName.toString().trim();
    const newSheetName = oldSheetName + '_G';

    // Check if old sheet exists and new sheet doesn't
    const oldSheet = ss.getSheetByName(oldSheetName);
    const newSheet = ss.getSheetByName(newSheetName);

    if (oldSheet && !newSheet && !oldSheetName.endsWith('_G')) {
      try {
        oldSheet.setName(newSheetName);
        log_('Migrated user group sheet: "' + oldSheetName + '" → "' + newSheetName + '"', 'INFO');
      } catch (e) {
        log_('Failed to migrate sheet "' + oldSheetName + '": ' + e.message, 'WARN');
      }
    }
  }
}

/**
 * Migrates ManagedFolders sheet from old column order to new order.
 * Old: FolderName, FolderID, Role, UserSheetName, GroupEmail, Last Synced, Status
 * New: FolderName, FolderID, Role, GroupEmail, UserSheetName, Last Synced, Status
 * (GroupEmail moved to column 4, UserSheetName moved to column 5)
 */
function migrateManagedFoldersColumns_(sheet) {
  try {
    const headers = sheet.getRange(1, 1, 1, 7).getValues()[0];

    // Check if migration is needed (old order has UserSheetName in col 4, GroupEmail in col 5)
    if (headers[3] === 'UserSheetName' && headers[4] === 'GroupEmail') {
      log_('Migrating ManagedFolders columns from old order to new order...', 'INFO');

      // Get all data
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        // Get columns D and E data (UserSheetName and GroupEmail)
        const userSheetData = sheet.getRange(2, 4, lastRow - 1, 1).getValues();
        const groupEmailData = sheet.getRange(2, 5, lastRow - 1, 1).getValues();

        // Swap them: put GroupEmail in col 4, UserSheetName in col 5
        sheet.getRange(2, 4, lastRow - 1, 1).setValues(groupEmailData);
        sheet.getRange(2, 5, lastRow - 1, 1).setValues(userSheetData);
      }

      // Update headers
      sheet.getRange(1, 4).setValue('GroupEmail');
      sheet.getRange(1, 5).setValue('UserSheetName');

      log_('Successfully migrated ManagedFolders columns. GroupEmail is now column D (4), UserSheetName is column E (5).', 'INFO');
    }
  } catch (e) {
    log_('Failed to migrate ManagedFolders columns: ' + e.message, 'WARN');
  }
}

/**
 * Ensures the control sheets (ManagedFolders, Admins) exist.
 */
function setupControlSheets_() {
  migrateUserGroupSheets_(); // Run migration first
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Check for ManagedFolders sheet
  let managedSheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (!managedSheet) {
    managedSheet = ss.insertSheet(MANAGED_FOLDERS_SHEET_NAME, 0);
    const headers = ['FolderName', 'FolderID', 'Role', 'GroupEmail', 'UserSheetName', 'Last Synced', 'Status'];
    managedSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    managedSheet.setFrozenRows(1);
    log_('Created "ManagedFolders" sheet.');
  } else {
    // Migrate old column order if needed
    migrateManagedFoldersColumns_(managedSheet);
  }

  // Add data validation for the Role column
  const roleRange = managedSheet.getRange('C2:C');
  const existingRoleRule = roleRange.getDataValidation();
  if (!existingRoleRule || existingRoleRule.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
      const rule = SpreadsheetApp.newDataValidation().requireValueInList(['Editor', 'Viewer', 'Commenter'], true).build();
      roleRange.setDataValidation(rule);
  }

  // Check for Admins sheet
  let adminSheet = ss.getSheetByName(ADMINS_SHEET_NAME);
  const adminHeaders = ['Administrator Emails', 'Last Synced', 'Status', 'Disabled'];
  if (!adminSheet) {
    adminSheet = ss.insertSheet(ADMINS_SHEET_NAME);
    adminSheet.getRange(1, 1, 1, adminHeaders.length).setValues([adminHeaders]).setFontWeight('bold');
    adminSheet.setFrozenRows(1);
    log_('Created "Admins" sheet.');
  } else {
    // Update headers (this will migrate old 4-column format to new 3-column format)
    const existingHeaders = adminSheet.getRange(1, 1, 1, 4).getValues()[0];

    // If old format detected (has 'Admins Group Email' in column B), migrate the data
    if (existingHeaders[1] === 'Admins Group Email') {
      log_('Migrating Admins sheet from old 4-column format to new 3-column format...', 'WARN');
      // Delete column B (the old Admins Group Email column)
      adminSheet.deleteColumn(2);
    }

    // Set the new headers
    adminSheet.getRange(1, 1, 1, adminHeaders.length).setValues([adminHeaders]).setFontWeight('bold');
    adminSheet.setFrozenRows(1);
  }
  
  // Add checkbox validation for the Disabled column
  const adminDisabledRange = adminSheet.getRange('D2:D');
  const existingAdminDisabledRule = adminDisabledRange.getDataValidation();
  if (!existingAdminDisabledRule || existingAdminDisabledRule.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.CHECKBOX) {
    const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
    adminDisabledRange.setDataValidation(rule);
  }

    // Check for UserGroups sheet
  let userGroupsSheet = ss.getSheetByName(USER_GROUPS_SHEET_NAME);
  if (!userGroupsSheet) {
    userGroupsSheet = ss.insertSheet(USER_GROUPS_SHEET_NAME);
    log_('Created "UserGroups" sheet.');
  }
  userGroupsSheet.getRange('A1:E1').setValues([['GroupName', 'GroupEmail', 'Group Admin Link', 'Last Synced', 'Status']]).setFontWeight('bold');
  userGroupsSheet.setFrozenRows(1);
  
  // Check for Config sheet
  const defaultConfig = {
    '--- Sync Behavior ---': {
      'EnableAutoSync': { value: 'TRUE', description: 'Set to FALSE to temporarily pause the hourly/daily auto-sync trigger without having to delete it.' },
      'AllowAutosyncDeletion': { value: 'TRUE', description: 'Set to TRUE to allow auto-sync to automatically delete users. WARNING: This is a powerful feature. If a user is accidentally removed from a sheet, their access will be revoked on the next sync.' },
      'AutoSyncMaxDeletions': { value: 10, description: 'The maximum number of deletions allowed in a single auto-sync run. If exceeded, deletions will be paused and manual intervention required.' },
    },
    '--- Email Notifications ---': {
      'EnableEmailNotifications': { value: 'FALSE', description: 'Set to TRUE to receive emails for errors and other notifications.' },
      'NotificationEmail': { value: '', description: 'The email address to send notifications to. Defaults to the script owner if left blank.' },
      'NotifyAfterSync': { value: 'TRUE', description: 'Set to TRUE to receive a summary email after each successful auto-sync.' },
      'NotifyDeletionsPending': { value: 'TRUE', description: 'Set to TRUE to receive an email alert when an auto-sync detects that a user needs to be manually removed. (This is ignored if AllowAutosyncDeletion is TRUE).' },
    },
    '--- Auditing & Limits ---': {
        'MaxLogLength': { value: DEFAULT_MAX_LOG_LENGTH, description: 'The maximum number of rows to keep in the Log and TestLog sheets.' },
        'MaxFileSizeMB': { value: 100, description: 'The maximum file size in MB for the spreadsheet. If exceeded, auto-sync will be aborted and an alert sent. This prevents uncontrolled growth of version history.' },
        'EnableNamedVersions': { value: true, description: 'Set to TRUE to create a named version of the spreadsheet after each auto-sync for auditing purposes.' },
        'EnableGCPLogging': { value: 'FALSE', description: 'For advanced users. Set to TRUE to send logs to Google Cloud Logging for better monitoring.' },
    },
    '--- General ---': {
        'AdminGroupEmail': { value: '', description: 'The email address for the Google Group containing all Admins (editors of this sheet). Auto-generates if blank.' },
        'EnableToasts': { value: 'FALSE', description: 'Set to TRUE to show small pop-up progress messages in the corner of the screen during syncs.' },
        'GitHubRepoURL': { value: 'https://github.com/davidf9999/gdrive_permissions1', description: 'The URL to the GitHub repository for this project. Used in the Help menu.' },
    },
    '--- Testing ---': {
      'ShowTestPrompts': { value: 'FALSE', description: 'For developers. Set to TRUE to show UI alerts during automated testing.' },
      'TestFolderName': { value: 'Test Folder', description: 'The base name for the folder created during the Manual Access Test.' },
      'TestRole': { value: 'Viewer', description: 'The permission role to test with during the Manual Access Test.' },
      'TestEmail': { value: 'example@gmail.com', description: 'A test email address to use for the Manual Access Test.' },
      'TestCleanup': { value: 'TRUE', description: 'Set to TRUE to automatically clean up resources created during tests.' },
      'TestAutoConfirm': { value: 'FALSE', description: 'For developers. Set to TRUE to automatically skip confirmation prompts during tests.' },
      'TestNumFolders': { value: '10', description: 'The number of folders to create during the Stress Test.' },
      'TestNumUsers': { value: '200', description: 'The number of users to create per folder during the Stress Test.' },
      'TestBaseEmail': { value: 'example@gmail.com', description: 'The base email address used to generate unique users for the Stress Test.' },
    }
  };

  let configSheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (!configSheet) {
    configSheet = ss.insertSheet(CONFIG_SHEET_NAME);
    // Create a new sheet with headers and all default settings
    configSheet.getRange('A1:C1').setValues([['Setting', 'Value', 'Description']]).setFontWeight('bold');
    const newSettings = [];
    for (const groupName in defaultConfig) {
        newSettings.push([groupName, '', '']);
        for (const key in defaultConfig[groupName]) {
            let finalValue = defaultConfig[groupName][key].value;
            if (key === 'NotificationEmail' && !finalValue) {
                finalValue = Session.getEffectiveUser().getEmail();
            }
            newSettings.push([key, finalValue, defaultConfig[groupName][key].description]);
        }
    }
    configSheet.getRange(2, 1, newSettings.length, 3).setValues(newSettings);
    configSheet.setFrozenRows(1);
    log_('Created "Config" sheet with default settings and descriptions.');
  } else {
    // Update an existing sheet, preserving values but re-ordering and adding new settings
    const existingData = configSheet.getDataRange().getValues();
    const existingSettings = new Map();
    existingData.forEach(row => {
        if (row[0] && !row[0].startsWith('---')) {
            existingSettings.set(row[0], row[1]);
        }
    });

    // Clear the sheet
    configSheet.getRange(2, 1, configSheet.getMaxRows() - 1, 3).clearContent();

    const newSettings = [];
    for (const groupName in defaultConfig) {
        newSettings.push([groupName, '', '']);
        for (const key in defaultConfig[groupName]) {
            let finalValue = existingSettings.has(key) ? existingSettings.get(key) : defaultConfig[groupName][key].value;
            if (key === 'NotificationEmail' && !finalValue) {
                finalValue = Session.getEffectiveUser().getEmail();
            }
            newSettings.push([key, finalValue, defaultConfig[groupName][key].description]);
        }
    }
    configSheet.getRange(2, 1, newSettings.length, 3).setValues(newSettings);
    log_('Re-organized and updated "Config" sheet.');
  }
}

function setupLogSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Check for Log sheet
  let logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!logSheet) {
    logSheet = ss.insertSheet(LOG_SHEET_NAME);
    logSheet.getRange('A1:C1').setValues([['Timestamp', 'Level', 'Message']]).setFontWeight('bold');
    logSheet.setFrozenRows(1);
  }

  // Check for TestLog sheet
  let testLogSheet = ss.getSheetByName(TEST_LOG_SHEET_NAME);
  if (!testLogSheet) {
    testLogSheet = ss.insertSheet(TEST_LOG_SHEET_NAME);
    testLogSheet.getRange('A1:C1').setValues([['Timestamp', 'Level', 'Message']]).setFontWeight('bold');
    testLogSheet.setFrozenRows(1);
  }

  // Check for DryRunAuditLog sheet
  let auditLogSheet = ss.getSheetByName(DRY_RUN_AUDIT_LOG_SHEET_NAME);
  if (!auditLogSheet) {
    auditLogSheet = ss.insertSheet(DRY_RUN_AUDIT_LOG_SHEET_NAME);
    setupDryRunAuditLogSheet_(auditLogSheet);
  }

  // Check for DeepAuditLog sheet
  setupDeepAuditLogSheet_();
}

function setupDeepAuditLogSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('DeepFolderAuditLog');
  if (!sheet) {
    const dryRunAuditSheet = ss.getSheetByName(DRY_RUN_AUDIT_LOG_SHEET_NAME);
    const index = dryRunAuditSheet ? dryRunAuditSheet.getIndex() + 1 : ss.getSheets().length + 1;
    sheet = ss.insertSheet('DeepFolderAuditLog', index);
    const headers = ['Timestamp', 'Type', 'Identifier', 'Issue', 'Details'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    log_('Created "DeepFolderAuditLog" sheet.');
  }
  return sheet;
}

function setupDryRunAuditLogSheet_(sheet) {
    const headers = ['Timestamp', 'Type', 'Identifier', 'Issue', 'Details'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
}
