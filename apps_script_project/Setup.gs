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
 * Ensures the control sheets (ManagedFolders, SheetEditors) exist.
 */
function setupControlSheets_() {
  migrateUserGroupSheets_(); // Run migration first
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Check for ManagedFolders sheet
  let managedSheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (!managedSheet) {
    managedSheet = ss.insertSheet(MANAGED_FOLDERS_SHEET_NAME, 0);
    const headers = ['FolderName', 'FolderID', 'Role', 'GroupEmail', 'UserSheetName', 'Last Synced', 'Status', 'URL', 'Delete'];
    managedSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    managedSheet.setFrozenRows(1);
    log_('Created "ManagedFolders" sheet.');
  } else {
    // Migrate old column order if needed
    migrateManagedFoldersColumns_(managedSheet);

    // Ensure the URL column exists for older setups
    let headerRange = managedSheet.getRange(1, 1, 1, managedSheet.getLastColumn());
    let headers = headerRange.getValues()[0];
    if (headers.indexOf('URL') === -1) {
      const newHeaderCol = headers.length + 1;
      managedSheet.getRange(1, newHeaderCol).setValue('URL').setFontWeight('bold');
      log_('Added missing "URL" column to ManagedFolders sheet.');
    }

    // Ensure the Delete column exists
    headerRange = managedSheet.getRange(1, 1, 1, managedSheet.getLastColumn());
    headers = headerRange.getValues()[0];
    if (headers.indexOf('Delete') === -1) {
      const newHeaderCol = headers.length + 1;
      managedSheet.getRange(1, newHeaderCol).setValue('Delete').setFontWeight('bold');
      log_('Added "Delete" column to ManagedFolders sheet.');
    }
  }

  // Add data validation for the Role column
  const roleRange = managedSheet.getRange('C2:C');
  const existingRoleRule = roleRange.getDataValidation();
  if (!existingRoleRule || existingRoleRule.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
      const rule = SpreadsheetApp.newDataValidation().requireValueInList(['Editor', 'Viewer', 'Commenter'], true).build();
      roleRange.setDataValidation(rule);
  }

  // Add checkbox validation for the Delete column (column I)
  const deleteRange = managedSheet.getRange('I2:I');
  const existingDeleteRule = deleteRange.getDataValidation();
  if (!existingDeleteRule || existingDeleteRule.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.CHECKBOX) {
    const checkboxRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
    deleteRange.setDataValidation(checkboxRule);
  }

  // Check for SheetEditors sheet
  let sheetEditorsSheet = ss.getSheetByName(SHEET_EDITORS_SHEET_NAME);
  const sheetEditorsHeaders = ['Sheet Editor Emails', 'Last Synced', 'Status', 'Disabled'];
  if (!sheetEditorsSheet) {
    sheetEditorsSheet = ss.insertSheet(SHEET_EDITORS_SHEET_NAME);
    sheetEditorsSheet.getRange(1, 1, 1, sheetEditorsHeaders.length).setValues([sheetEditorsHeaders]).setFontWeight('bold');
    sheetEditorsSheet.setFrozenRows(1);
    log_('Created "SheetEditors" sheet.');
  } else {
    // Update headers (this will migrate old 4-column format to new 3-column format)
    const existingHeaders = sheetEditorsSheet.getRange(1, 1, 1, 4).getValues()[0];

    // If old format detected (has 'Admins Group Email' in column B), migrate the data
    if (existingHeaders[1] === 'Admins Group Email') {
      log_('Migrating SheetEditors sheet from old 4-column format to new 3-column format...', 'WARN');
      // Delete column B (the old Admins Group Email column)
      sheetEditorsSheet.deleteColumn(2);
    }

    // Set the new headers
    sheetEditorsSheet.getRange(1, 1, 1, sheetEditorsHeaders.length).setValues([sheetEditorsHeaders]).setFontWeight('bold');
    sheetEditorsSheet.getRange('D1').clearDataValidations().clearNote();
    sheetEditorsSheet.setFrozenRows(1);
  }
  
  // Add checkbox validation for the Disabled column
  const adminDisabledRange = sheetEditorsSheet.getRange('D2:D');
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

  // Update headers (adding Delete column if needed)
  const userGroupsHeaderRange = userGroupsSheet.getRange(1, 1, 1, Math.max(6, userGroupsSheet.getLastColumn()));
  const userGroupsHeaders = userGroupsHeaderRange.getValues()[0];
  if (userGroupsHeaders.length < 6 || userGroupsHeaders[5] !== 'Delete') {
    userGroupsSheet.getRange('A1:F1').setValues([['GroupName', 'GroupEmail', 'Group Admin Link', 'Last Synced', 'Status', 'Delete']]).setFontWeight('bold');
    log_('Updated UserGroups headers with Delete column.');
  }
  userGroupsSheet.setFrozenRows(1);

  // Add checkbox validation for the Delete column (column F)
  const userGroupsDeleteRange = userGroupsSheet.getRange('F2:F');
  const existingUserGroupsDeleteRule = userGroupsDeleteRange.getDataValidation();
  if (!existingUserGroupsDeleteRule || existingUserGroupsDeleteRule.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.CHECKBOX) {
    const checkboxRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
    userGroupsDeleteRange.setDataValidation(checkboxRule);
  }
  
  // Check for Config sheet
  let currentUserEmail = '';
  try {
    currentUserEmail = Session.getEffectiveUser().getEmail();
  } catch (e) {
    currentUserEmail = '';
  }

  const defaultConfig = {
    '--- Status ---': {
      'ScriptVersion': { value: '', description: 'The current version of the installed script. (Read-only)' },
      'AutoSync Trigger Status': { value: 'DISABLED', description: 'A visual indicator of the AutoSync trigger status. (Read-only)' }
    },
    '--- Access Control ---': {
      'SuperAdminEmails': { value: currentUserEmail, description: 'Comma-separated list of super admin email addresses. Super admins see the full menu and test sheets.' }
    },
    '--- Sync Behavior ---': {
      'EnableSheetLocking': { value: true, description: 'Check to enable the sheet locking mechanism during sync operations. This is recommended to prevent data inconsistencies.' },
      'EnableCircularDependencyCheck': { value: true, description: 'Check to enable circular dependency validation during sync. This prevents infinite loops when groups contain each other.' },
      'AutoSyncInterval': { value: 5, description: 'The interval in minutes for the AutoSync trigger. Minimum is 5 minutes. Use the "Enable/Update AutoSync" menu item to apply a new interval.' },
      'AllowAutosyncDeletion': { value: true, description: 'Check to allow AutoSync to automatically remove users from groups. WARNING: If a user is accidentally removed from a sheet, their access will be revoked on the next sync.' },
      'AllowGroupFolderDeletion': { value: false, description: 'Master switch: Enable deletion of groups and folder-role bindings via Delete checkbox. Google Drive folders are never deleted. When disabled, Delete checkboxes are ignored and sync aborts on orphan sheets.' },
      'RetryMaxRetries': { value: 5, description: 'The maximum number of times to retry a failed API call (e.g., due to rate limiting).'},
      'RetryInitialDelayMs': { value: 1000, description: 'The initial time in milliseconds to wait before the first retry. This delay doubles with each subsequent retry (exponential backoff).'},
      'MembershipBatchSize': { value: 10, description: 'The number of users to process in a single batch for group membership changes. Helps avoid API rate limits.'},
    },
    '--- Email Notifications ---': {
      'EnableEmailNotifications': { value: false, description: 'Check to receive emails for errors and other notifications.' },
      'NotificationEmail': { value: '', description: 'The email address to send notifications to. Defaults to the script owner if left blank.' },
      'NotifyOnSyncSuccess': { value: false, description: 'Check to receive a summary email after each successful AutoSync.' },
      'NotifyDeletionsPending': { value: true, description: 'Check to receive an email alert when an AutoSync detects that a user needs to be manually removed. (This is ignored if AllowAutosyncDeletion is checked).' },
      'NotifyOnGroupFolderDeletion': { value: true, description: 'Send email notification when groups or folder-role bindings are deleted during sync. Recommended to keep enabled for audit purposes.' },
    },
    '--- Auditing & Limits ---': {
        'LogLevel': { value: 'INFO', description: 'Controls log verbosity. ERROR: critical errors only. WARN: warnings and errors. INFO: normal operations (default). DEBUG: detailed debugging including routine AutoSync checks.' },
        'MaxLogLength': { value: DEFAULT_MAX_LOG_LENGTH, description: 'The maximum number of rows to keep in the Log and TestLog sheets.' },
        'MaxFileSizeMB': { value: 100, description: 'The maximum file size in MB for the spreadsheet. If exceeded, AutoSync will be aborted and an alert sent. This prevents uncontrolled growth of version history.' },
        '_SyncHistory': { value: 'Always enabled', description: 'Sync history is automatically tracked in the SyncHistory sheet with revision links (30-100 days retention).' },
        'EnableGCPLogging': { value: false, description: 'For advanced users. Check to send logs to Google Cloud Logging for better monitoring.' },
    },
    '--- General ---': {
        'AdminGroupEmail': { value: '', description: 'The email address for the Google Group containing all Sheet Editors. Auto-generates if blank.' },
        'EnableToasts': { value: false, description: 'Check to show small, non-pausing progress messages in the corner of the screen during syncs. These do not affect timeouts.' },
        'GitHubRepoURL': { value: 'https://github.com/davidf9999/gdrive_permissions1', description: 'The URL to the GitHub repository for this project. Used in the Help menu.' },
    }
  };

  if (TEST_FEATURES_ENABLED === true) {
    defaultConfig['--- Testing ---'] = {
        'ShowTestPrompts': { value: true, description: 'Set to FALSE to run tests without UI prompts that pause the script. Required for fully automated test runs.'},
        'TestAutoConfirm': { value: false, description: 'For automated testing only. Set to TRUE to automatically answer "Yes" to all test verification prompts.' },
        'TestCleanup': { value: false, description: 'Set to TRUE to automatically delete all folders, groups, and sheets created by a test. If FALSE, you will be prompted manually.' },
        'TestUserEmail': { value: currentUserEmail, description: 'The email of a real user IN YOUR WORKSPACE DOMAIN (e.g., your-name@your-domain.com) to be used for all tests. For the stress test, aliases will be generated from this email.' },
        'TestFolderName': { value: 'ManualAccessTestFolder', description: 'The name of the folder to be created during the Manual Access Test.' },
        'TestRole': { value: 'Editor', description: 'The role to be tested during the Manual Access Test.' },
        'TestNumFolders': { value: 2, description: 'The number of folders to create during the Stress Test. Total API calls are TestNumFolders * TestNumUsers. High numbers can cause API rate-limiting errors.' },
        'TestNumUsers': { value: 5, description: 'The number of users to create PER FOLDER during the Stress Test. Total API calls are TestNumFolders * TestNumUsers. High numbers can cause API rate-limiting errors.' }
    };
  }

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
            if (key === 'ScriptVersion') {
              finalValue = SCRIPT_VERSION;
            } else if (key === 'NotificationEmail' && !finalValue) {
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
            let finalValue;
            if (key === 'ScriptVersion') {
              finalValue = SCRIPT_VERSION;
            } else {
              finalValue = existingSettings.has(key) ? existingSettings.get(key) : defaultConfig[groupName][key].value;
            }
            
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
    'EnableSheetLocking', 'AllowAutosyncDeletion', 'AllowGroupFolderDeletion', 'EnableCircularDependencyCheck',
    'EnableEmailNotifications', 'NotifyOnSyncSuccess', 'NotifyDeletionsPending', 'NotifyOnGroupFolderDeletion',
    'EnableGCPLogging', 'EnableToasts', 'ShowTestPrompts', 'TestCleanup', 'TestAutoConfirm'
  ];

  // Add dropdown validation for LogLevel
  const allSettings = configSheet.getDataRange().getValues();
  for (let i = 0; i < allSettings.length; i++) {
    if (allSettings[i][0] === 'LogLevel') {
      const logLevelCell = configSheet.getRange(i + 1, 2); // Column B
      const logLevelRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['ERROR', 'WARN', 'INFO', 'DEBUG'], true)
        .setAllowInvalid(false)
        .setHelpText('Select logging verbosity: ERROR (critical only), WARN (warnings+errors), INFO (normal operations), DEBUG (detailed including routine checks)')
        .build();
      logLevelCell.setDataValidation(logLevelRule);
      break;
    }
  }

  const data = configSheet.getDataRange().getValues();

  // First, clear all data validations from the Value column (column B)
  const lastRow = data.length;
  if (lastRow > 1) {
    configSheet.getRange(2, 2, lastRow - 1, 1).clearDataValidations();
  }

  // Then, apply checkbox validation only to boolean settings
  const rule = SpreadsheetApp.newDataValidation()
    .requireCheckbox()
    .setAllowInvalid(false)
    .build();

  for (let i = 1; i < data.length; i++) {
    const key = data[i][0];
    if (booleanSettings.includes(key)) {
      const cell = configSheet.getRange(i + 1, 2);
      cell.setDataValidation(rule);
    }
  }
  log_('Applied checkbox validation rules to Config sheet.');
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
    ['All Documentation:', repoUrl + '/blob/main/docs/'],
    ['', ''],
    ['📧 NEED HELP?', ''],
    ['', ''],
    [adminContactInfo, ''],
    ['', ''],
    ['ℹ️ ABOUT ACCESS LEVELS', ''],
    ['', ''],
    ['Super Admins: Full access to all sync operations, testing, and settings.', ''],
    ['Non-Admins: View-only access to configuration sheets. Super admins manage operations.', ''],
    ['', ''],
    ['Note: This Help sheet is automatically created when the spreadsheet is opened.', '']
  ];

  // Write content
  helpSheet.getRange(1, 1, content.length, 2).setValues(content);

  // Format the sheet
  helpSheet.getRange('A1:B1').setFontWeight('bold').setFontSize(14).setBackground('#4285f4').setFontColor('#ffffff');
  helpSheet.getRange('A13:B13').setFontWeight('bold').setFontSize(12).setBackground('#fbbc04').setFontColor('#000000');
  helpSheet.getRange('A17:B17').setFontWeight('bold').setFontSize(12).setBackground('#34a853').setFontColor('#ffffff');

  // Make URL cells clickable
  for (let i = 6; i <= 10; i++) {
    const cell = helpSheet.getRange(i, 2);
    const url = cell.getValue();
    if (url && url.startsWith('http')) {
      const richText = SpreadsheetApp.newRichTextValue()
        .setText(url)
        .setLinkUrl(url)
        .setTextStyle(SpreadsheetApp.newTextStyle().setForegroundColor('#1155cc').setUnderline(true).build())
        .build();
      cell.setRichTextValue(richText);
    }
  }

  // Set column widths
  helpSheet.setColumnWidth(1, 500);
  helpSheet.setColumnWidth(2, 500);

  // Note: Help sheet is not protected - all users can view and edit it
  log_('Created or updated Help sheet.');
}

function setupSyncHistorySheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SYNC_HISTORY_SHEET_NAME);
  const newHeaders = ['Timestamp', 'Added', 'Removed', 'Failed', 'Duration (seconds)'];

  if (!sheet) {
    const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
    const index = logSheet ? logSheet.getIndex() + 1 : ss.getSheets().length + 1;
    sheet = ss.insertSheet(SYNC_HISTORY_SHEET_NAME, index);
    sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    log_('Created "' + SYNC_HISTORY_SHEET_NAME + '" sheet.');
  } else {
    // Migrate old format (7 columns with Revision ID) to new format (5 columns)
    const lastRow = sheet.getLastRow();
    if (lastRow > 0) {
      const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

      // Check if this is the old format with Revision ID columns
      if (currentHeaders.length >= 7 &&
          (currentHeaders[1] === 'Revision ID' || currentHeaders[2] === 'Revision Link')) {
        log_('Migrating SyncHistory from old format (7 cols) to new format (5 cols)...', 'INFO');

        // Old format: Timestamp, Revision ID, Revision Link, Added, Removed, Failed, Duration
        // New format: Timestamp, Added, Removed, Failed, Duration
        // Mapping: [0, 3, 4, 5, 6] from old -> [0, 1, 2, 3, 4] in new

        if (lastRow > 1) {
          const oldData = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
          const newData = oldData.map(function(row) {
            return [
              row[0],  // Timestamp
              row[3],  // Added (was col 4)
              row[4],  // Removed (was col 5)
              row[5],  // Failed (was col 6)
              Math.round(row[6] || 0)  // Duration - convert to integer if float
            ];
          });

          // Clear old data
          sheet.getRange(2, 1, lastRow - 1, 7).clearContent();

          // Write new data
          sheet.getRange(2, 1, newData.length, newHeaders.length).setValues(newData);
        }

        // Delete old columns (6 and 7)
        if (sheet.getLastColumn() > 5) {
          sheet.deleteColumns(6, sheet.getLastColumn() - 5);
        }

        // Update headers
        sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]).setFontWeight('bold');
        log_('SyncHistory migration completed. Removed Revision ID/Link columns.', 'INFO');
      }
    }
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