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
  const existingRule = roleRange.getDataValidation();
  if (!existingRule || existingRule.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
      const rule = SpreadsheetApp.newDataValidation().requireValueInList(['Editor', 'Viewer', 'Commenter'], true).build();
      roleRange.setDataValidation(rule);
  }


  // Check for Admins sheet
  let adminSheet = ss.getSheetByName(ADMINS_SHEET_NAME);
  const adminHeaders = ['Administrator Emails', 'Last Synced', 'Status'];
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
  
    // Check for UserGroups sheet
  let userGroupsSheet = ss.getSheetByName(USER_GROUPS_SHEET_NAME);
  if (!userGroupsSheet) {
    userGroupsSheet = ss.insertSheet(USER_GROUPS_SHEET_NAME);
    userGroupsSheet.getRange('A1:D1').setValues([['GroupName', 'GroupEmail', 'Last Synced', 'Status']]).setFontWeight('bold');
    userGroupsSheet.setFrozenRows(1);
    log_('Created "UserGroups" sheet.');
  }
  
  // Check for Config sheet
  const defaultConfig = {
    'EnableEmailNotifications': 'FALSE',
    'NotificationEmailAddress': '',
    'AdminGroupEmail': '',
    'EnableToasts': 'FALSE',
    'GitHubRepoURL': 'https://github.com/davidf9999/gdrive_permissions1',
    'MaxLogLength': DEFAULT_MAX_LOG_LENGTH,
    'EnableGCPLogging': 'FALSE',
    'ShowTestPrompts': 'FALSE',
    'TestFolderName': 'Test Folder',
    'TestRole': 'Viewer',
    'TestEmail': 'example@gmail.com',
    'EnableAutoSync': 'TRUE',
    'NotifyAfterSync': 'TRUE',
    'NotifyDeletionsPending': 'TRUE',
    'NotificationEmail': '',
    'AutoSyncMaxDeletions': 10,
    'TestCleanup': 'TRUE',
    'TestAutoConfirm': 'FALSE',
    'TestNumFolders': '10',
    'TestNumUsers': '200',
    'TestBaseEmail': 'example@gmail.com'
  };

  let configSheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (!configSheet) {
    configSheet = ss.insertSheet(CONFIG_SHEET_NAME);
    configSheet.getRange('A1:B1').setValues([['Setting', 'Value']]).setFontWeight('bold');
    const newSettings = Object.entries(defaultConfig);
    configSheet.getRange(2, 1, newSettings.length, 2).setValues(newSettings);
    configSheet.setFrozenRows(1);
    log_('Created "Config" sheet.');
  } else {
    const settingsRange = configSheet.getRange('A:A');
    const settings = settingsRange.getValues().flat();

    Object.entries(defaultConfig).forEach(([key, value]) => {
      if (settings.indexOf(key) === -1) {
        const lastRow = configSheet.getLastRow() + 1;
        // Handle dynamic default values
        let finalValue = value;
        if (key === 'NotificationEmail' && !value) {
          finalValue = Session.getEffectiveUser().getEmail();
        }
        configSheet.getRange(lastRow, 1, 1, 2).setValues([[key, finalValue]]);
        log_(`Added missing "${key}" setting with default value.`);
      }
    });
  }
}

function setupLogSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Check for Log sheet
  let logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!logSheet) {
    logSheet = ss.insertSheet(LOG_SHEET_NAME);
    logSheet.getRange('A1:B1').setValues([['Timestamp', 'Message']]).setFontWeight('bold');
    logSheet.setFrozenRows(1);
  }

  // Check for TestLog sheet
  let testLogSheet = ss.getSheetByName(TEST_LOG_SHEET_NAME);
  if (!testLogSheet) {
    testLogSheet = ss.insertSheet(TEST_LOG_SHEET_NAME);
    testLogSheet.getRange('A1:B1').setValues([['Timestamp', 'Message']]).setFontWeight('bold');
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
