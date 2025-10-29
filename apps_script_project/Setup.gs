/**
 * Ensures the control sheets (ManagedFolders, Admins) exist.
 */
function setupControlSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Check for ManagedFolders sheet
  let managedSheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (!managedSheet) {
    managedSheet = ss.insertSheet(MANAGED_FOLDERS_SHEET_NAME, 0);
    const headers = ['FolderName', 'FolderID', 'Role', 'UserSheetName', 'GroupEmail', 'Last Synced', 'Status'];
    managedSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    managedSheet.setFrozenRows(1);
    log_('Created "ManagedFolders" sheet.');
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
  const adminHeaders = ['Administrator Emails', 'Admins Group Email', 'Last Synced', 'Status'];
  if (!adminSheet) {
    adminSheet = ss.insertSheet(ADMINS_SHEET_NAME);
    adminSheet.getRange(1, 1, 1, adminHeaders.length).setValues([adminHeaders]).setFontWeight('bold');
    adminSheet.setFrozenRows(1);
    log_('Created "Admins" sheet.');
  } else {
    const existingHeaders = adminSheet.getRange(1, 1, 1, adminHeaders.length).getValues()[0];
    for (let i = 0; i < adminHeaders.length; i++) {
      const headerCell = adminSheet.getRange(1, i + 1);
      if (existingHeaders[i] !== adminHeaders[i]) {
        headerCell.setValue(adminHeaders[i]);
      }
      headerCell.setFontWeight('bold');
    }
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
  let sheet = ss.getSheetByName('DeepAuditLog');
  if (!sheet) {
    sheet = ss.insertSheet('DeepAuditLog');
    const headers = ['Timestamp', 'Type', 'Identifier', 'Issue', 'Details'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    log_('Created "DeepAuditLog" sheet.');
  }
  return sheet;
}

function setupDryRunAuditLogSheet_(sheet) {
    const headers = ['Timestamp', 'Type', 'Identifier', 'Issue', 'Details'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
}
