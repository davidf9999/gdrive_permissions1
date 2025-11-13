/**
 * Normalizes a boolean config value by removing emojis and extra whitespace.
 * Converts 'ENABLED ✅' to 'ENABLED', 'DISABLED ❌' to 'DISABLED', etc.
 * @param {*} value - The value to normalize
 * @return {*} The normalized value
 */
function normalizeBooleanValue_(value) {
  if (typeof value !== 'string') {
    return value;
  }
  const upperValue = value.toUpperCase().trim();
  if (upperValue.startsWith('ENABLED')) {
    return 'ENABLED';
  }
  if (upperValue.startsWith('DISABLED')) {
    return 'DISABLED';
  }
  return value;
}

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
    const headers = ['FolderName', 'FolderID', 'Role', 'GroupEmail', 'UserSheetName', 'Last Synced', 'Status', 'URL'];
    managedSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    managedSheet.setFrozenRows(1);
    log_('Created "ManagedFolders" sheet.');
  } else {
    // Migrate old column order if needed
    migrateManagedFoldersColumns_(managedSheet);
    
    // Ensure the URL column exists for older setups
    const headerRange = managedSheet.getRange(1, 1, 1, managedSheet.getLastColumn());
    const headers = headerRange.getValues()[0];
    if (headers.indexOf('URL') === -1) {
      const newHeaderCol = headers.length + 1;
      managedSheet.getRange(1, newHeaderCol).setValue('URL').setFontWeight('bold');
      log_('Added missing "URL" column to ManagedFolders sheet.');
    }
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
    adminSheet.getRange('D1').clearDataValidations().clearNote();
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
  let currentUserEmail = '';
  try {
    currentUserEmail = Session.getEffectiveUser().getEmail();
  } catch (e) {
    currentUserEmail = '';
  }

  const defaultConfig = {
    '--- Status ---': {
      'AutoSync Trigger Status': { value: 'DISABLED', description: 'A visual indicator of the AutoSync trigger status. (Read-only)' },
      'ControlSheetMode': { value: currentUserEmail ? 'FULL - ' + currentUserEmail : 'FULL', description: 'Indicates whether the last viewer had full or restricted access. Automatically updated on open.' }
    },
    '--- Access Control ---': {
      'SuperAdminEmails': { value: currentUserEmail, description: 'Comma-separated list of super admin email addresses. Super admins see the full menu and test sheets.' }
    },
    '--- Sync Behavior ---': {
      'EnableSheetLocking': { value: 'ENABLED', description: 'Set to DISABLED to disable the sheet locking mechanism during sync operations. This is not recommended as it can lead to data inconsistencies if sheets are edited during a sync.' },
      'AutoSyncInterval': { value: 5, description: 'The interval in minutes for the AutoSync trigger. Minimum is 5 minutes. Use the "Enable/Update AutoSync" menu item to apply a new interval.' },
      'AllowAutosyncDeletion': { value: 'ENABLED', description: 'Set to ENABLED to allow AutoSync to automatically delete users. WARNING: This is a powerful feature. If a user is accidentally removed from a sheet, their access will be revoked on the next sync.' },
      'AutoSyncMaxDeletions': { value: 10, description: 'The maximum number of deletions allowed in a single AutoSync run. If exceeded, deletions will be paused and manual intervention required.' },
    },
    '--- Email Notifications ---': {
      'EnableEmailNotifications': { value: 'DISABLED', description: 'Set to ENABLED to receive emails for errors and other notifications.' },
      'NotificationEmail': { value: '', description: 'The email address to send notifications to. Defaults to the script owner if left blank.' },
      'NotifyOnSyncSuccess': { value: 'DISABLED', description: 'Set to ENABLED to receive a summary email after each successful AutoSync.' },
      'NotifyDeletionsPending': { value: 'ENABLED', description: 'Set to ENABLED to receive an email alert when an AutoSync detects that a user needs to be manually removed. (This is ignored if AllowAutosyncDeletion is TRUE).' },
    },
    '--- Auditing & Limits ---': {
        'MaxLogLength': { value: DEFAULT_MAX_LOG_LENGTH, description: 'The maximum number of rows to keep in the Log and TestLog sheets.' },
        'MaxFileSizeMB': { value: 100, description: 'The maximum file size in MB for the spreadsheet. If exceeded, AutoSync will be aborted and an alert sent. This prevents uncontrolled growth of version history.' },
        '_SyncHistory': { value: 'Always enabled', description: 'Sync history is automatically tracked in the SyncHistory sheet with revision links (30-100 days retention).' },
        'EnableGCPLogging': { value: 'DISABLED', description: 'For advanced users. Set to ENABLED to send logs to Google Cloud Logging for better monitoring.' },
    },
    '--- General ---': {
        'AdminGroupEmail': { value: '', description: 'The email address for the Google Group containing all Admins (editors of this sheet). Auto-generates if blank.' },
        'EnableToasts': { value: 'DISABLED', description: 'Set to ENABLED to show small pop-up progress messages in the corner of the screen during syncs.' },
        'GitHubRepoURL': { value: 'https://github.com/davidf9999/gdrive_permissions1', description: 'The URL to the GitHub repository for this project. Used in the Help menu.' },
    },
    '--- Testing ---': {
      'ShowTestPrompts': { value: 'DISABLED', description: 'For developers. Set to ENABLED to show UI alerts during automated testing.' },
      'TestFolderName': { value: 'Test Folder', description: 'The base name for the folder created during the Manual Access Test.' },
      'TestRole': { value: 'Viewer', description: 'The permission role to test with during the Manual Access Test.' },
      'TestEmail': { value: 'example@gmail.com', description: 'A test email address to use for the Manual Access Test.' },
      'TestCleanup': { value: 'ENABLED', description: 'Set to ENABLED to automatically clean up resources created during tests.' },
      'TestAutoConfirm': { value: 'DISABLED', description: 'For developers. Set to ENABLED to automatically skip confirmation prompts during tests.' },
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
            // Filter out spreadsheet errors (#ERROR!, #N/A, etc.)
            const value = row[1];
            const valueStr = String(value);
            if (!valueStr.startsWith('#') || (!valueStr.includes('ERROR') && !valueStr.includes('N/A') && !valueStr.includes('VALUE') && !valueStr.includes('REF') && !valueStr.includes('DIV'))) {
                // Normalize boolean values by removing emojis
                const normalizedValue = normalizeBooleanValue_(value);
                existingSettings.set(row[0], normalizedValue);
            } else {
                log_('Warning: Skipping Config setting "' + row[0] + '" due to formula error: ' + valueStr, 'WARN');
            }
        }
    });

    // Clear the sheet content and data validations
    const clearRange = configSheet.getRange(2, 1, configSheet.getMaxRows() - 1, 3);
    clearRange.clearContent();
    clearRange.clearDataValidations();

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
  }
  applyConfigValidation_();
}

function applyConfigValidation_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (!configSheet) return;

  const booleanSettings = [
    'EnableSheetLocking', 'AllowAutosyncDeletion',
    'EnableEmailNotifications', 'NotifyOnSyncSuccess', 'NotifyDeletionsPending',
    'EnableGCPLogging', 'EnableToasts', 'ShowTestPrompts', 'TestCleanup', 'TestAutoConfirm'
  ];

  const data = configSheet.getDataRange().getValues();

  // First, clear all data validations from the Value column (column B)
  const lastRow = data.length;
  if (lastRow > 1) {
    configSheet.getRange(2, 2, lastRow - 1, 1).clearDataValidations();
  }

  // Then, apply ENABLED/DISABLED validation only to boolean settings
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['ENABLED', 'DISABLED'])
    .setAllowInvalid(false)
    .build();

  for (let i = 1; i < data.length; i++) {
    const key = data[i][0];
    if (booleanSettings.includes(key)) {
      const cell = configSheet.getRange(i + 1, 2);
      cell.setDataValidation(rule);
    }
  }
  log_('Applied ENABLED/DISABLED validation rules to Config sheet.');
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

  // Check for FolderAuditLog sheet
  let auditLogSheet = ss.getSheetByName(FOLDER_AUDIT_LOG_SHEET_NAME);
  if (!auditLogSheet) {
    auditLogSheet = ss.insertSheet(FOLDER_AUDIT_LOG_SHEET_NAME);
    setupFolderAuditLogSheet_(auditLogSheet);
  }

  // Check for DeepAuditLog sheet
  setupDeepAuditLogSheet_();

  // Check for SyncHistory sheet
  setupSyncHistorySheet_();

  // Check for Help sheet
  setupHelpSheet_();
}

function setupHelpSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let helpSheet = ss.getSheetByName('Help');

  if (!helpSheet) {
    helpSheet = ss.insertSheet('Help');
  }

  // Clear existing content
  helpSheet.clear();

  // Get GitHub repo URL from config
  const config = typeof getConfiguration_ === 'function' ? getConfiguration_() : {};
  const repoUrl = config['GitHubRepoURL'] || 'https://github.com/davidf9999/gdrive_permissions1';

  // Get super admin emails for contact info
  const superAdmins = typeof getSuperAdminEmails_ === 'function' ? getSuperAdminEmails_() : [];
  const adminContactInfo = superAdmins.length > 0
    ? 'Contact any of these super admins for help:\n' + superAdmins.join('\n')
    : 'Contact the spreadsheet owner for help.';

  // Create help content
  const content = [
    ['📚 HELP & DOCUMENTATION', ''],
    ['', ''],
    ['Welcome to the Google Drive Permissions Manager!', ''],
    ['', ''],
    ['For detailed documentation, visit:', ''],
    ['User Guide:', repoUrl + '/blob/main/docs/USER_GUIDE.md'],
    ['Testing Guide:', repoUrl + '/blob/main/docs/TESTING.md'],
    ['AutoSync Guide:', repoUrl + '/blob/main/docs/AUTO_SYNC_GUIDE.md'],
    ['Edit Mode Guide:', repoUrl + '/blob/main/docs/EDIT_MODE_GUIDE.md'],
    ['Main README:', repoUrl + '/blob/main/README.md'],
    ['', ''],
    ['📧 NEED HELP?', ''],
    ['', ''],
    [adminContactInfo, ''],
    ['', ''],
    ['⚠️ NOTE FOR NON-ADMIN USERS', ''],
    ['', ''],
    ['If you see only a "Permissions Manager" menu with no items,', ''],
    ['you have view-only access. This is intentional.', ''],
    ['Super admins manage sync operations and settings.', '']
  ];

  // Write content
  helpSheet.getRange(1, 1, content.length, 2).setValues(content);

  // Format the sheet
  helpSheet.getRange('A1:B1').setFontWeight('bold').setFontSize(14).setBackground('#4285f4').setFontColor('#ffffff');
  helpSheet.getRange('A13:B13').setFontWeight('bold').setFontSize(12).setBackground('#fbbc04').setFontColor('#000000');
  helpSheet.getRange('A17:B17').setFontWeight('bold').setFontSize(12).setBackground('#ea4335').setFontColor('#ffffff');

  // Make URL cells clickable
  for (let i = 6; i <= 10; i++) {
    const cell = helpSheet.getRange(i, 2);
    const url = cell.getValue();
    if (url && url.startsWith('http')) {
      cell.setFontColor('#1155cc').setFontUnderline(true);
    }
  }

  // Set column widths
  helpSheet.setColumnWidth(1, 500);
  helpSheet.setColumnWidth(2, 500);

  // Protect the sheet so non-admins can't modify it
  try {
    const protection = helpSheet.protect();
    protection.setDescription('Help sheet (view-only for non-admins)');
    protection.setWarningOnly(false);

    // Allow editors (super admins) to edit
    const me = Session.getEffectiveUser();
    protection.addEditor(me);
    protection.removeEditors(protection.getEditors());
    protection.addEditor(me);
  } catch (e) {
    log_('Could not protect Help sheet: ' + e.message, 'WARN');
  }

  log_('Created or updated Help sheet.');
}

function setupSyncHistorySheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SYNC_HISTORY_SHEET_NAME);
  if (!sheet) {
    const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
    const index = logSheet ? logSheet.getIndex() + 1 : ss.getSheets().length + 1;
    sheet = ss.insertSheet(SYNC_HISTORY_SHEET_NAME, index);
    const headers = ['Timestamp', 'Revision ID', 'How to View', 'Added', 'Removed', 'Failed', 'Duration (seconds)'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(3, 400); // Make "How to View" column wider
    log_('Created "' + SYNC_HISTORY_SHEET_NAME + '" sheet.');
  }
  return sheet;
}

function setupDeepAuditLogSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('DeepFolderAuditLog');
  if (!sheet) {
    const folderAuditSheet = ss.getSheetByName(FOLDER_AUDIT_LOG_SHEET_NAME);
    const index = folderAuditSheet ? folderAuditSheet.getIndex() + 1 : ss.getSheets().length + 1;
    sheet = ss.insertSheet('DeepFolderAuditLog', index);
    const headers = ['Timestamp', 'Type', 'Identifier', 'Issue', 'Details'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    log_('Created "DeepFolderAuditLog" sheet.');
  }
  return sheet;
}

function setupFolderAuditLogSheet_(sheet) {
    const headers = ['Timestamp', 'Type', 'Identifier', 'Issue', 'Details'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
}
