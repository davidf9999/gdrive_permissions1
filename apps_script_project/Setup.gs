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
  let configSheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (!configSheet) {
    configSheet = ss.insertSheet(CONFIG_SHEET_NAME);
    configSheet.getRange('A1:B1').setValues([['Setting', 'Value']]).setFontWeight('bold');
    configSheet.getRange('A2:B2').setValues([['EnableEmailNotifications', 'FALSE']]);
    configSheet.getRange('A3:B3').setValues([['NotificationEmailAddress', '']]);
    configSheet.getRange('A4:B4').setValues([['EnableToasts', 'FALSE']]);
    configSheet.getRange('A5:B5').setValues([['GitHubRepoURL', 'https://github.com/davidf9999/gdrive_permissions1']]);
    configSheet.getRange('A6:B6').setValues([['MaxLogLength', DEFAULT_MAX_LOG_LENGTH]]);
    configSheet.getRange('A7:B7').setValues([['EnableGCPLogging', 'FALSE']]);
    configSheet.getRange('A8:B8').setValues([['ShowTestPrompts', 'FALSE']]);
    configSheet.getRange('A9:B9').setValues([['TestFolderName', 'Test Folder']]);
    configSheet.getRange('A10:B10').setValues([['TestRole', 'Viewer']]);
    configSheet.getRange('A11:B11').setValues([['TestEmail', 'example@gmail.com']]);
    configSheet.setFrozenRows(1);
    log_('Created "Config" sheet.');
  }

  if (configSheet) {
    const settings = configSheet.getRange('A:A').getValues().flat();
    if (settings.indexOf('MaxLogLength') === -1) {
      const lastRow = configSheet.getLastRow() + 1;
      configSheet.getRange(lastRow, 1, 1, 2).setValues([['MaxLogLength', DEFAULT_MAX_LOG_LENGTH]]);
      log_('Added "MaxLogLength" setting with default ' + DEFAULT_MAX_LOG_LENGTH + '.');
    }
    if (settings.indexOf('EnableGCPLogging') === -1) {
      const lastRow = configSheet.getLastRow() + 1;
      configSheet.getRange(lastRow, 1, 1, 2).setValues([['EnableGCPLogging', 'FALSE']]);
      log_('Added "EnableGCPLogging" setting with default FALSE.');
    }
    if (settings.indexOf('EnableAutoSync') === -1) {
      const lastRow = configSheet.getLastRow() + 1;
      configSheet.getRange(lastRow, 1, 1, 2).setValues([['EnableAutoSync', 'TRUE']]);
      log_('Added "EnableAutoSync" setting with default TRUE.');
    }
    if (settings.indexOf('ShowTestPrompts') === -1) {
      const lastRow = configSheet.getLastRow() + 1;
      configSheet.getRange(lastRow, 1, 1, 2).setValues([['ShowTestPrompts', 'FALSE']]);
      log_('Added "ShowTestPrompts" setting with default FALSE.');
    }
    if (settings.indexOf('TestFolderName') === -1) {
      const lastRow = configSheet.getLastRow() + 1;
      configSheet.getRange(lastRow, 1, 1, 2).setValues([['TestFolderName', 'Test Folder']]);
      log_('Added "TestFolderName" setting with default value.');
    }
    if (settings.indexOf('TestRole') === -1) {
      const lastRow = configSheet.getLastRow() + 1;
      configSheet.getRange(lastRow, 1, 1, 2).setValues([['TestRole', 'Viewer']]);
      log_('Added "TestRole" setting with default value.');
    }
    if (settings.indexOf('TestEmail') === -1) {
      const lastRow = configSheet.getLastRow() + 1;
      configSheet.getRange(lastRow, 1, 1, 2).setValues([['TestEmail', 'example@gmail.com']]);
      log_('Added "TestEmail" setting with default value.');
    }
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
    const headers = ['Timestamp', 'Type', 'Identifier', 'Issue', 'Details'];
    auditLogSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    auditLogSheet.setFrozenRows(1);
  }
}
