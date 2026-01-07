function showToast_(message, title, timeoutSeconds) {
  const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET_NAME);
  if (!configSheet) {
    // If config sheet doesn't exist, show the toast by default
    SpreadsheetApp.getActiveSpreadsheet().toast(message, title, timeoutSeconds);
    return;
  }
  const settings = configSheet.getRange('A2:B').getValues();
  let enableToasts = false; // Default to false
  for (let i = 0; i < settings.length; i++) {
    if (settings[i][0] === 'EnableToasts') {
      enableToasts = settings[i][1];
      break;
    }
  }

  if (enableToasts === true) {
    SpreadsheetApp.getActiveSpreadsheet().toast(message, title, timeoutSeconds);
  }
}

function getHeaderMap_(sheet) {
  if (!sheet) return {};

  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) return {};

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const map = {};
  headers.forEach(function(header, index) {
    const key = String(header || '')
      .trim()
      .toLowerCase();
    if (key) {
      map[key] = index + 1; // 1-based column index
    }
  });

  return map;
}

function requireColumn_(headerMap, headerName, sheetName) {
  const column = resolveColumn_(headerMap, headerName, null);
  if (column) {
    return column;
  }

  const errorMessage = 'Missing required column "' + headerName + '" in sheet "' + sheetName + '".';
  log_(errorMessage, 'ERROR');
  throw new Error(errorMessage);
}

function resolveColumn_(headerMap, headerName, fallback) {
  if (!headerName) return fallback;
  const key = String(headerName)
    .trim()
    .toLowerCase();
  return headerMap[key] || fallback;
}

/**
 * Finds the row number for a given value in a specific column of a sheet.
 * @param {Sheet} sheet The sheet to search.
 * @param {number} col The 1-based column index to search in.
 * @param {string} value The value to find.
 * @return {number} The 1-based row index, or -1 if not found.
 */
function findRowByValue_(sheet, col, value) {
  if (!sheet) return -1;
  const data = sheet.getRange(1, col, sheet.getLastRow(), 1).getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === value) {
      return i + 1; // 1-based row index
    }
  }
  return -1;
}

function generateGroupEmail_(baseName) {
  const domain = Session.getActiveUser().getEmail().split('@')[1];
  if (!domain) {
    throw new Error('Could not determine user domain.');
  }

  const sanitizedName = baseName
    .toLowerCase()
    .replace(/\s+/g, '-')              // Replace spaces with hyphens
    .replace(/[^a-z0-9_-]/g, '')       // Remove invalid characters, preserving underscores
    .replace(/-+/g, '-')               // Collapse consecutive hyphens
    .replace(/^-+|-+$/g, '');          // Remove leading/trailing hyphens

  if (!sanitizedName) {
    throw new Error(
      'Group name "' + baseName + '" contains only non-ASCII characters (e.g., Hebrew, Arabic, Chinese) which cannot be used in email addresses. ' + 
      'Please manually specify a group email in the "GroupEmail" column (Column B) using only ASCII characters (a-z, 0-9, hyphens). ' + 
      'Example: for "' + baseName + '", you could use "coordinators@' + domain + '" or "team-a@' + domain + '".'
    );
  }

  return sanitizedName + '@' + domain;
}

function validateUniqueGroupEmails_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const emailMap = new Map(); // email -> [{sheet: string, row: number, context: string}]
  let sheetEditorsGroupEmail = '';

  // 1. Collect emails from UserGroups sheet (including generated ones)
  const userGroupsSheet = spreadsheet.getSheetByName(USER_GROUPS_SHEET_NAME);
  if (userGroupsSheet && userGroupsSheet.getLastRow() > 1) {
    const userGroupHeaders = getHeaderMap_(userGroupsSheet);
    const groupNameCol = requireColumn_(userGroupHeaders, 'GroupName', USER_GROUPS_SHEET_NAME);
    const groupEmailCol = requireColumn_(userGroupHeaders, 'GroupEmail', USER_GROUPS_SHEET_NAME);

    const data = userGroupsSheet
      .getRange(2, 1, userGroupsSheet.getLastRow() - 1, Math.max(groupNameCol, groupEmailCol))
      .getValues();
    for (let i = 0; i < data.length; i++) {
      const groupName = data[i][groupNameCol - 1];
      if (!groupName) continue;

      let groupEmail = data[i][groupEmailCol - 1];
      if (groupName === SHEET_EDITORS_SHEET_NAME) {
        if (!groupEmail) {
          groupEmail = getConfigValue_('SheetEditorsGroupEmail', '') || getConfigValue_('AdminGroupEmail', '');
        }
        if (!groupEmail) {
          try {
            groupEmail = generateGroupEmail_(SHEET_EDITORS_GROUP_NAME);
          } catch (e) {
            // Ignore groups that can't have an email generated; they will be skipped later.
            continue;
          }
        }
      } else if (!groupEmail) {
        try {
          groupEmail = generateGroupEmail_(groupName);
        } catch (e) {
          // Ignore groups that can't have an email generated; they will be skipped later.
          continue;
        }
      }
      
      const email = groupEmail.toString().trim().toLowerCase();
      if (groupName === SHEET_EDITORS_SHEET_NAME) {
        sheetEditorsGroupEmail = email;
      }
      if (!emailMap.has(email)) emailMap.set(email, []);
      emailMap.get(email).push({
        sheet: USER_GROUPS_SHEET_NAME,
        row: i + 2,
        context: `GroupName: "${groupName}"`
      });
    }
  }

  // 2. Collect emails from ManagedFolders sheet (including generated ones)
  const managedSheet = spreadsheet.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (managedSheet && managedSheet.getLastRow() > 1) {
    const managedHeaders = getHeaderMap_(managedSheet);
    const folderNameCol = requireColumn_(managedHeaders, 'FolderName', MANAGED_FOLDERS_SHEET_NAME);
    const roleCol = requireColumn_(managedHeaders, 'Role', MANAGED_FOLDERS_SHEET_NAME);
    const groupEmailCol = requireColumn_(managedHeaders, 'GroupEmail', MANAGED_FOLDERS_SHEET_NAME);

    const data = managedSheet
      .getRange(
        2,
        1,
        managedSheet.getLastRow() - 1,
        Math.max(folderNameCol, roleCol, groupEmailCol)
      )
      .getValues();
    for (let i = 0; i < data.length; i++) {
      const folderName = data[i][folderNameCol - 1];
      const role = data[i][roleCol - 1];
      if (!folderName || !role) continue;

      let groupEmail = data[i][groupEmailCol - 1];
      if (!groupEmail) {
        try {
          const userSheetName = `${folderName}_${role}`;
          groupEmail = generateGroupEmail_(userSheetName);
        } catch (e) {
          // Ignore folders that can't have an email generated.
          continue;
        }
      }

      const email = groupEmail.toString().trim().toLowerCase();
      if (!emailMap.has(email)) emailMap.set(email, []);
      emailMap.get(email).push({
        sheet: MANAGED_FOLDERS_SHEET_NAME,
        row: i + 2,
        context: `Folder: "${folderName}", Role: "${role}"`
      });
    }
  }

  const rawConfigEmail = getConfigValue_('SheetEditorsGroupEmail', '') || getConfigValue_('AdminGroupEmail', '');
  if (rawConfigEmail) {
    const email = String(rawConfigEmail).trim().toLowerCase();
    if (email && email !== sheetEditorsGroupEmail) {
      let configRow = 0;
      const configSheet = spreadsheet.getSheetByName(CONFIG_SHEET_NAME);
      if (configSheet) {
        const foundRow = findRowByValue_(configSheet, 1, 'SheetEditorsGroupEmail');
        if (foundRow > 0) {
          configRow = foundRow;
        }
      }
      if (!emailMap.has(email)) emailMap.set(email, []);
      emailMap.get(email).push({
        sheet: CONFIG_SHEET_NAME,
        row: configRow,
        context: 'SheetEditorsGroupEmail (Config)'
      });
    }
  }

  // 3. Check for duplicates
  const errors = [];
  emailMap.forEach((locations, email) => {
    if (locations.length > 1) {
      const locationStrings = locations.map(loc => `${loc.sheet} (row ${loc.row}, ${loc.context})`);
      errors.push({
        email: email,
        locations: locationStrings,
        message: `Email "${email}" is generated by or present in multiple locations:\n  - ${locationStrings.join('\n  - ')}`
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

function assertAdminDirectoryAvailable_() {
  // Provides a clear message if Admin Directory advanced service/API is not enabled.
  if (typeof AdminDirectory === 'undefined' || typeof AdminDirectory.Groups === 'undefined') {
    const msg = 'Admin Directory service is not available. Enable it in Apps Script (Services > Admin Directory API) and in Google Cloud (APIs & Services > Library > Admin SDK). Requires Google Workspace.';
    log_(msg, 'ERROR');
    throw new Error(msg);
  }
}

function isAdminDirectoryAvailable_() {
  try { 
    return typeof AdminDirectory !== 'undefined' && typeof AdminDirectory.Groups !== 'undefined';
   } catch (e) { 
    return false; 
  }
}

function isPersonalGmail_() {
  try {
    const email = Session.getActiveUser().getEmail();
    const domain = email && email.indexOf('@') !== -1 ? email.split('@')[1].toLowerCase() : '';
    return domain === 'gmail.com' || domain === 'googlemail.com';
  } catch (e) {
    return false;
  }
}

function shouldSkipGroupOps_() {
  // Skip group operations if Admin Directory advanced service is not available.
  // Personal Gmail typically cannot use Admin SDK.
  return !isAdminDirectoryAvailable_();
}

function getConfiguration_() {
  const cache = CacheService.getScriptCache();
  const cachedConfig = cache.get('config');
  if (cachedConfig) {
    return JSON.parse(cachedConfig);
  }

  const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET_NAME);
  if (!configSheet) return {};

  const lastRow = configSheet.getLastRow();
  if (lastRow < 2) return {};

  const data = configSheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const config = data.reduce((acc, row) => {
    if (row[0]) {
      // Filter out spreadsheet errors (#ERROR!, #N/A, #VALUE!, etc.)
      const value = row[1];
      const valueStr = String(value);

      // Check if the value is a spreadsheet error
      if (valueStr.startsWith('#') && (valueStr.includes('ERROR') || valueStr.includes('N/A') || valueStr.includes('VALUE') || valueStr.includes('REF') || valueStr.includes('DIV'))) {
        // Log a warning about the error but don't include it in config
        if (SCRIPT_EXECUTION_MODE === 'TEST') {
          // Only log once during tests to avoid spam
          if (!config['_errorsDetected']) {
            log_('Warning: Config sheet contains formula errors. Please check the Config sheet and fix any cells showing #ERROR! or similar.', 'WARN');
            config['_errorsDetected'] = true;
          }
        }
        // Skip this config value
        return acc;
      }

      acc[row[0]] = value;
    }
    return acc;
  }, {});

  // Remove the temporary error flag before caching
  delete config['_errorsDetected'];

  cache.put('config', JSON.stringify(config), 300); // Cache for 5 minutes
  return config;
}

function getCachedConfigValue_(key) {
  const cache = CacheService.getScriptCache();
  const cachedConfig = cache.get('config');
  if (!cachedConfig) return null;
  try {
    const config = JSON.parse(cachedConfig);
    return config[key];
  } catch (e) {
    return null;
  }
}

/**
 * Gets a configuration value by key with optional default value.
 * Handles boolean strings (ENABLED/DISABLED) and normalizes them to true/false.
 * @param {string} key - The config key to retrieve
 * @param {*} defaultValue - The default value if key is not found
 * @return {*} The config value, normalized if it's a boolean string
 */
function getConfigValue_(key, defaultValue) {
  const config = getConfiguration_();
  if (config[key] !== undefined && config[key] !== null) {
    // Handle boolean strings using common normalization
    if (typeof config[key] === 'string') {
      return normalizeBooleanConfigValue_(config[key]);
    }
    return config[key];
  }
  return defaultValue;
}

function getConfigValueFresh_(key, defaultValue) {
  const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET_NAME);
  if (!configSheet) return defaultValue;
  const lastRow = configSheet.getLastRow();
  if (lastRow < 2) return defaultValue;
  const data = configSheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      const value = data[i][1];
      if (typeof value === 'string') {
        return normalizeBooleanConfigValue_(value);
      }
      return value;
    }
  }
  return defaultValue;
}

/**
 * Normalizes a boolean config value string to a boolean.
 * Handles various formats: 'ENABLED', 'ENABLED ✅', 'DISABLED', 'DISABLED ❌', etc.
 * @param {string|boolean} value - The value to normalize
 * @return {string|boolean} The normalized value (returns boolean for ENABLED/DISABLED, otherwise original)
 */
function normalizeBooleanConfigValue_(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const upperValue = value.toUpperCase().trim();
    if (upperValue.startsWith('ENABLED')) return true;
    if (upperValue.startsWith('DISABLED')) return false;
    if (upperValue === 'TRUE') return true;
    if (upperValue === 'FALSE') return false;
    if (upperValue === 'YES') return true;
    if (upperValue === 'NO') return false;
  }
  return value;
}


function getTestConfiguration_() {
    const config = getConfiguration_();
    const testUserEmail = config['TestUserEmail'];
    const testConfig = {
        folderName: config['TestFolderName'],
        role: config['TestRole'],
        email: testUserEmail,
        cleanup: (config['TestCleanup'] === true || config['TestCleanup'] === 'TRUE'),
        autoConfirm: (config['TestAutoConfirm'] === true || config['TestAutoConfirm'] === 'TRUE'),
        numFolders: parseInt(config['TestNumFolders'], 10),
        numUsers: parseInt(config['TestNumUsers'], 10),
        baseEmail: testUserEmail
    };
    log_('Test Configuration loaded: ' + JSON.stringify(testConfig), 'INFO');
    return testConfig;
}

function getMaxLogLength_() {
  const config = getConfiguration_();
  const maxLogLength = config['MaxLogLength'];
  if (maxLogLength) {
    const value = parseInt(maxLogLength, 10);
    if (!isNaN(value) && value > 0) {
      return value;
    }
  }
  return DEFAULT_MAX_LOG_LENGTH;
}

/**
 * Log level priority mapping (lower number = higher priority)
 * ERROR: Critical errors only
 * WARN: Warnings and errors
 * INFO: Normal operations, warnings, and errors (default)
 * DEBUG: Detailed debugging including routine checks
 */
const LOG_LEVELS = {
  'ERROR': 0,
  'WARN': 1,
  'INFO': 2,
  'DEBUG': 3
};

function log_(message, severity = 'INFO') {
  // Filter out spreadsheet errors to prevent #ERROR! from appearing in logs
  const messageStr = String(message);
  const normalizedMessage = messageStr.replace(/[\n\r\t]/g, '');
  if (normalizedMessage.startsWith('#') && (normalizedMessage.includes('ERROR') || normalizedMessage.includes('N/A') || normalizedMessage.includes('VALUE') || normalizedMessage.includes('REF') || normalizedMessage.includes('DIV'))) {
    // Skip logging spreadsheet errors - they're not useful log messages
    return;
  }

  // Check log level threshold
  const configuredLevel = getConfigValue_('LogLevel', 'INFO').toUpperCase();
  const configuredPriority = LOG_LEVELS[configuredLevel] !== undefined ? LOG_LEVELS[configuredLevel] : LOG_LEVELS['INFO'];
  const messagePriority = LOG_LEVELS[severity.toUpperCase()] !== undefined ? LOG_LEVELS[severity.toUpperCase()] : LOG_LEVELS['INFO'];

  // Only log if message priority is high enough (lower number = higher priority)
  if (messagePriority > configuredPriority) {
    return; // Skip this log message
  }

  const sheetName = (SCRIPT_EXECUTION_MODE === 'TEST') ? TEST_LOG_SHEET_NAME : LOG_SHEET_NAME;
  const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (logSheet) {
    const timestamp = Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    let lastRow = logSheet.getLastRow();

    // Ensure header row exists - check if row 1 is empty or doesn't have the header
    if (lastRow === 0 || logSheet.getRange('A1').getValue() !== 'Timestamp') {
      // Create or recreate the header row
      logSheet.getRange('A1:C1').setValues([['Timestamp', 'Level', 'Message']]).setFontWeight('bold');
      lastRow = 1;
    }

    // Check if row 2 is empty (log was cleared) - if so, reset to row 1
    if (lastRow > 1 && !logSheet.getRange('A2').getValue()) {
      lastRow = 1;
    }

    // Always write to at least row 2 (never overwrite the header)
    const nextRow = Math.max(lastRow + 1, 2);

    // Prevent Google Sheets from interpreting messages starting with = as formulas
    // by prefixing them with a single quote
    let safeMessage = normalizedMessage;
    if (normalizedMessage.startsWith('=') || normalizedMessage.startsWith('+') || normalizedMessage.startsWith('-') || normalizedMessage.startsWith('@')) {
      safeMessage = "'" + normalizedMessage;
    }

    logSheet.getRange(nextRow, 1, 1, 3).setValues([[timestamp, severity.toUpperCase(), safeMessage]]);

    // --- Log Trimming Logic ---
    // Clear the cache for 'config' to ensure getMaxLogLength_ reads the latest value
    CacheService.getScriptCache().remove('config');
    const maxLogLength = getMaxLogLength_();
    const currentRowCount = logSheet.getLastRow();
    // Subtract 1 to account for the header row
    if ((currentRowCount - 1) > maxLogLength) {
      const rowsToDelete = (currentRowCount - 1) - maxLogLength;
      // Delete old rows from the top (starting from row 2)
      logSheet.deleteRows(2, rowsToDelete);
    }
  }
}


function logSyncHistory_(revisionLink, summary, durationSeconds) {
  try {
    const syncHistorySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SYNC_HISTORY_SHEET_NAME);
    if (!syncHistorySheet) {
      log_('SyncHistory sheet not found. Skipping sync history logging.', 'WARN');
      return;
    }

    const timestamp = Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    const added = summary ? summary.added || 0 : 0;
    const removed = summary ? summary.removed || 0 : 0;
    const failed = summary ? summary.failed || 0 : 0;
    const duration = Math.round(durationSeconds || 0);
    const status = failed === 0 ? 'Success' : 'Failed';

    log_('Attempting to log sync history: +' + added + ' -' + removed + ' !' + failed, 'DEBUG');

    if (added === 0 && removed === 0 && failed === 0) {
      log_('No permission changes detected. Skipping SyncHistory entry.', 'INFO');
      return;
    }

  let lastRow = syncHistorySheet.getLastRow();
  const headers = ['Timestamp', 'Status', 'Added', 'Removed', 'Failed', 'Duration (seconds)', 'Revision Link'];
  
  // Ensure header row exists and is up to date
  if (lastRow === 0) {
      syncHistorySheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      syncHistorySheet.setFrozenRows(1);
      lastRow = 1;
  } else {
      const currentHeaders = syncHistorySheet.getRange(1, 1, 1, headers.length).getValues()[0];
      const needsRefresh = headers.some((header, idx) => currentHeaders[idx] !== header);
      if (needsRefresh) {
          syncHistorySheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
          if (syncHistorySheet.getFrozenRows() < 1) {
              syncHistorySheet.setFrozenRows(1);
          }
          lastRow = Math.max(lastRow, 1);
      }
  }

    // Reset lastRow if the sheet was empty or headers were just rewritten
    lastRow = Math.max(lastRow, 1);

    if (lastRow > 1) {
      const hasDataInSecondRow = syncHistorySheet.getRange('A2').getValue();
      if (!hasDataInSecondRow) {
        lastRow = 1;
      }
    }

  const nextRow = Math.max(lastRow + 1, 2);
  const rowValues = [
    timestamp,
    status,
    added,
    removed,
    failed,
    duration,
    revisionLink || '' // Revision Link
  ];

    syncHistorySheet.getRange(nextRow, 1, 1, rowValues.length).setValues([rowValues]);

  // Add note to header for version history navigation
  if (nextRow === 2) { // Add notes only once to the header
    syncHistorySheet.getRange('A1:G1').clearNote();
    syncHistorySheet.getRange('A1').setNote('Timestamp of when the sync operation was logged.');
    syncHistorySheet.getRange('G1').setNote('To view changes for a given sync: Open the spreadsheet, go to File > Version history > See version history, then find the revision matching the Timestamp in this row. Google keeps revisions for 30-100 days.');
  }

    log_('Logged sync history: Status: ' + status + ', Changes: +' + added + ' -' + removed + ' !' + failed + ', Duration: ' + duration + 's', 'INFO');
  } catch (e) {
    log_('ERROR writing to SyncHistory: ' + e.message + '\n' + e.stack, 'ERROR');
  }
}

function clearAllLogs() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('Are you sure you want to clear all logs?', 'This will delete all data in the "Log", "TestLog", "FoldersAuditLog", and "DeepFolderAuditLog" sheets.', ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) {
    return;
  }

  const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOG_SHEET_NAME);
  if (logSheet) {
    logSheet.getRange('A2:C').clearContent();
  }

  const testLogSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TEST_LOG_SHEET_NAME);
  if (testLogSheet) {
    testLogSheet.getRange('A2:C').clearContent();
  }

  const foldersAuditLogSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('FoldersAuditLog');
  if (foldersAuditLogSheet) {
    foldersAuditLogSheet.clear();
    setupFolderAuditLogSheet_(foldersAuditLogSheet);
  }

  const deepFolderAuditLogSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DeepFolderAuditLog');
  if (deepFolderAuditLogSheet) {
    deepFolderAuditLogSheet.clear();
    setupDeepAuditLogSheet_(deepFolderAuditLogSheet);
  }

}

function clearAuxiliaryLogs() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Clear auxiliary logs?',
    'This will clear "TestLog", "FoldersAuditLog", and "DeepFolderAuditLog" sheets.\n\nThe main "Log" sheet will be preserved.',
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) {
    return;
  }

  const testLogSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TEST_LOG_SHEET_NAME);
  if (testLogSheet) {
    testLogSheet.getRange('A2:C').clearContent();
  }

  const foldersAuditLogSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('FoldersAuditLog');
  if (foldersAuditLogSheet) {
    foldersAuditLogSheet.clear();
    setupFolderAuditLogSheet_(foldersAuditLogSheet);
  }

  const deepFolderAuditLogSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DeepFolderAuditLog');
  if (deepFolderAuditLogSheet) {
    deepFolderAuditLogSheet.clear();
    setupDeepAuditLogSheet_(deepFolderAuditLogSheet);
  }

  ui.alert('Auxiliary logs have been cleared.\n\nThe main "Log" sheet has been preserved.');
}

function getSheetEditorNotificationEmails_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EDITORS_SHEET_NAME);
  if (!sheet) {
    return [];
  }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }
  const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  return data.reduce((emails, row) => {
    const email = String(row[0] || '').trim().toLowerCase();
    const disabled = row[1] === true || String(row[1]).toUpperCase() === 'TRUE';
    if (email && !disabled) {
      emails.push(email);
    }
    return emails;
  }, []);
}

function sendErrorNotification_(errorMessage) {
  try {
    const enableEmailNotifications = getConfigValue_('EnableEmailNotifications', true);
    if (enableEmailNotifications !== true) {
      return;
    }

    const adminEmail = getConfigValue_('NotificationEmail', '') || getSpreadsheetOwnerEmail_();
    const recipients = [];
    if (adminEmail) {
      recipients.push(adminEmail);
    }

    const notifySheetEditors = getConfigValue_('NotifySheetEditorsOnErrors', false);
    if (notifySheetEditors === true) {
      recipients.push.apply(recipients, getSheetEditorNotificationEmails_());
    }

    const uniqueRecipients = Array.from(new Set(recipients.filter(Boolean)));
    if (uniqueRecipients.length > 0) {
      MailApp.sendEmail(uniqueRecipients.join(','), 'Permissions Manager Script - Fatal Error', errorMessage);
    } else {
      log_('No recipients configured for error notifications.', 'WARN');
    }
  } catch (e) {
    log_('Failed to send error notification email: ' + e.toString(), 'ERROR');
  }
}

function showTestMessage_(title, message) {
    const config = getConfiguration_();
    const showPrompts = config['ShowTestPrompts'];

    if (showPrompts === true || showPrompts === 'TRUE') {
        SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
    } else {
        log_(`Test Message: ${title} - ${message}`, 'INFO');
    }
}

function showTestConfirm_(title, message, defaultButton) {
  const config = getConfiguration_();
  const autoConfirm = config['TestAutoConfirm'];
  const showPrompts = config['ShowTestPrompts'];

  if (autoConfirm === true || autoConfirm === 'TRUE') {
    log_(`Auto-confirming test prompt: ${title} - ${message}`, 'INFO');
    return defaultButton || SpreadsheetApp.getUi().Button.YES;
  }
  
  if (showPrompts === true || showPrompts === 'TRUE') {
    const ui = SpreadsheetApp.getUi();
    return ui.alert(title, message, ui.ButtonSet.YES_NO);
  } else {
    log_(`Test "Confirm" Message Silently Skipped (due to ShowTestPrompts=false): ${title} - ${message}`, 'INFO');
    return defaultButton || SpreadsheetApp.getUi().Button.YES;
  }
}

/**
 * Updates a setting in the Config sheet
 * @param {string} settingName - The name of the setting to update
 * @param {string|boolean} value - The value to set
 */
function updateConfigSetting_(settingName, value) {
  const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET_NAME);
  if (!configSheet) {
    log_('Config sheet not found. Cannot update setting: ' + settingName, 'WARN');
    return;
  }

  const settingsRange = configSheet.getRange('A:A');
  const settings = settingsRange.getValues().flat();
  const rowIndex = settings.indexOf(settingName);

  if (rowIndex !== -1) {
    // Setting exists, update it
    configSheet.getRange(rowIndex + 1, 2).setValue(value);
  } else {
    // Setting doesn't exist, add it
    const lastRow = settings.filter(String).length;
    configSheet.getRange(lastRow + 1, 1, 1, 2).setValues([[settingName, value]]);
  }

  // Clear the cache so the new value is picked up
  CacheService.getScriptCache().remove('config');
}

function markSystemSheet_(sheet) {
  if (!sheet) {
    return;
  }
  try {
    const existing = sheet.getDeveloperMetadata().some(function(metadata) {
      return metadata.getKey() === 'SystemSheet';
    });
    if (!existing) {
      sheet.addDeveloperMetadata('SystemSheet', 'true', SpreadsheetApp.DeveloperMetadataVisibility.DOCUMENT);
    }
  } catch (e) {
    log_('Failed to mark system sheet "' + sheet.getName() + '": ' + e.message, 'WARN');
  }
}

function isSystemSheet_(sheet) {
  if (!sheet) {
    return false;
  }
  try {
    return sheet.getDeveloperMetadata().some(function(metadata) {
      return metadata.getKey() === 'SystemSheet' && metadata.getValue() === 'true';
    });
  } catch (e) {
    return false;
  }
}

function getSheetAccessPolicy_(sheetName) {
  if (!sheetName) {
    return { category: 'other' };
  }

  if (sheetName === CONFIG_SHEET_NAME) {
    return { category: 'config' };
  }

  if (sheetName === CHANGE_REQUESTS_SHEET_NAME) {
    return { category: 'change-requests' };
  }

  if (isReadOnlySystemSheetName_(sheetName)) {
    return { category: 'read-only' };
  }

  if (isStructuralControlSheetName_(sheetName)) {
    return { category: 'structural' };
  }

  if (isPermissionDataSheetName_(sheetName)) {
    return { category: 'permissions' };
  }

  return { category: 'other' };
}

function isReadOnlySystemSheetName_(sheetName) {
  const readOnlyNames = [
    STATUS_SHEET_NAME,
    LOG_SHEET_NAME,
    TEST_LOG_SHEET_NAME,
    FOLDER_AUDIT_LOG_SHEET_NAME,
    SYNC_HISTORY_SHEET_NAME,
    CHANGE_REQUESTS_SHEET_NAME,
    'DeepFolderAuditLog',
    'Help'
  ];
  return readOnlyNames.indexOf(sheetName) !== -1;
}

function isStructuralControlSheetName_(sheetName) {
  return sheetName === MANAGED_FOLDERS_SHEET_NAME || sheetName === USER_GROUPS_SHEET_NAME;
}

function isPermissionDataSheetName_(sheetName) {
  const permissionSheets = getPermissionDataSheetNames_();
  return permissionSheets.has(sheetName);
}

function getPermissionDataSheetNames_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const names = new Set([
    MANAGED_FOLDERS_SHEET_NAME,
    USER_GROUPS_SHEET_NAME,
    SHEET_EDITORS_SHEET_NAME
  ]);

  const managedSheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (managedSheet && managedSheet.getLastRow() > 1) {
    const headers = getHeaderMap_(managedSheet);
    const userSheetNameCol = resolveColumn_(headers, 'usersheetname', 5);
    if (userSheetNameCol) {
      const userSheetNames = managedSheet.getRange(2, userSheetNameCol, managedSheet.getLastRow() - 1, 1).getValues();
      userSheetNames.forEach(function(row) {
        if (row[0]) names.add(row[0].toString().trim());
      });
    }
  }

  const userGroupsSheet = ss.getSheetByName(USER_GROUPS_SHEET_NAME);
  if (userGroupsSheet && userGroupsSheet.getLastRow() > 1) {
    const groupNames = userGroupsSheet.getRange(2, 1, userGroupsSheet.getLastRow() - 1, 1).getValues();
    groupNames.forEach(function(row) {
      if (row[0]) names.add(getUserGroupSheetName_(row[0].toString()));
    });
  }

  return names;
}

function updateStatusSetting_(settingName, value) {
  const statusSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STATUS_SHEET_NAME);
  if (!statusSheet) {
    log_('Status sheet not found. Cannot update setting: ' + settingName, 'WARN');
    return;
  }

  const settings = statusSheet.getRange('A:A').getValues().flat();
  const rowIndex = settings.indexOf(settingName);

  if (rowIndex !== -1) {
    statusSheet.getRange(rowIndex + 1, 2).setValue(value);
  } else {
    const lastRow = statusSheet.getLastRow();
    statusSheet.getRange(lastRow + 1, 1, 1, 2).setValues([[settingName, value]]);
  }
}

function getStatusSettingValue_(statusSheet, settingName) {
  if (!statusSheet) {
    return '';
  }
  const settings = statusSheet.getRange('A:A').getValues().flat();
  const rowIndex = settings.indexOf(settingName);
  if (rowIndex === -1) {
    return '';
  }
  return statusSheet.getRange(rowIndex + 1, 2).getValue();
}

function formatSyncSummary_(summary) {
  if (!summary) {
    return '';
  }
  const added = summary.added || 0;
  const removed = summary.removed || 0;
  const failed = summary.failed || 0;
  return 'Added: ' + added + ', Removed: ' + removed + ', Failed: ' + failed;
}

function updateSyncStatusPanel_(statusSheet, status) {
  if (!statusSheet) {
    return;
  }

  const normalizedStatus = status || 'Unknown';
  let label = 'SYNC STATUS UNKNOWN';
  let background = '#DADCE0';
  let fontColor = '#000000';

  if (normalizedStatus === 'Success') {
    label = 'SYNC OK';
    background = '#00B050';
    fontColor = '#FFFFFF';
  } else if (normalizedStatus === 'Failed') {
    label = 'SYNC ERROR';
    background = '#D93025';
    fontColor = '#FFFFFF';
  } else if (normalizedStatus === 'Running') {
    label = 'SYNC RUNNING';
    background = '#F9AB00';
    fontColor = '#000000';
  } else if (normalizedStatus === 'Skipped') {
    label = 'SYNC SKIPPED';
    background = '#9AA0A6';
    fontColor = '#FFFFFF';
  }

  const panelRange = statusSheet.getRange('E2:F3');
  statusSheet.getRange('E2:H6').setBackground(null).setFontColor(null);
  panelRange.setValue(label)
    .setBackground(background)
    .setFontColor(fontColor)
    .setFontWeight('bold')
    .setFontSize(12);
}

function updateSyncStatus_(status, options = {}) {
  if (SCRIPT_EXECUTION_MODE === 'TEST' && options.source === 'AutoSync') {
    return;
  }

  const statusSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STATUS_SHEET_NAME);
  if (!statusSheet) {
    return;
  }

  const timestamp = Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  const normalizedStatus = status || 'Unknown';

  updateStatusSetting_('Last Sync Status', normalizedStatus);
  updateStatusSetting_('Last Sync Attempt', timestamp);
  if (normalizedStatus === 'Success') {
    updateStatusSetting_('Last Successful Sync', timestamp);
  }

  if (options.durationSeconds !== undefined) {
    updateStatusSetting_('Last Sync Duration (seconds)', Math.round(options.durationSeconds));
  }

  if (options.summary) {
    updateStatusSetting_('Last Sync Summary', formatSyncSummary_(options.summary));
  }

  if (options.source) {
    updateStatusSetting_('Last Sync Source', options.source);
  }

  if (options.errorMessage) {
    updateStatusSetting_('Last Sync Error', options.errorMessage);
  } else if (normalizedStatus === 'Success' || normalizedStatus === 'Skipped') {
    updateStatusSetting_('Last Sync Error', '');
  }

  let panelStatus = normalizedStatus;
  if (normalizedStatus === 'Skipped') {
    const lastSuccessfulSync = getStatusSettingValue_(statusSheet, 'Last Successful Sync');
    if (lastSuccessfulSync) {
      panelStatus = 'Success';
    }
  }
  updateSyncStatusPanel_(statusSheet, panelStatus);
}

/**
 * Validates that a user sheet has no duplicate email addresses (case-insensitive)
 * @param {string} sheetName - The name of the user sheet to validate
 * @returns {Object} - { valid: boolean, duplicates: [{email, rows}], error: string }
 */
function validateUserSheetEmails_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    return {
      valid: false,
      duplicates: [],
      error: 'Sheet "' + sheetName + '" not found'
    };
  }

  const emailRange = sheet.getRange('A2:A');
  const emails = emailRange.getValues();

  const emailMap = new Map(); // email -> [row numbers]
  const duplicates = [];

  for (let i = 0; i < emails.length; i++) {
    const rawEmail = emails[i][0];
    if (!rawEmail) continue; // Skip empty cells

    const email = rawEmail.toString().trim().toLowerCase();
    if (!email) continue; // Skip whitespace-only cells

    const rowNum = i + 2; // +2 for header row and 0-index

    if (emailMap.has(email)) {
      emailMap.get(email).push(rowNum);
    } else {
      emailMap.set(email, [rowNum]);
    }
  }

  // Find duplicates
  emailMap.forEach(function(rows, email) {
    if (rows.length > 1) {
      duplicates.push({ email: email, rows: rows });
    }
  });

  if (duplicates.length > 0) {
    const errorMsg = duplicates.map(function(d) {
      return '"' + d.email + '" appears in rows ' + d.rows.join(', ');
    }).join('; ');

    return {
      valid: false,
      duplicates: duplicates,
      error: 'Duplicate emails found: ' + errorMsg
    };
  }

  return { valid: true, duplicates: [], error: null };
}



function getDirectFileUsers_(file, groupEmailToExclude) {
  const users = [];
  const owner = file.getOwner() ? file.getOwner().getEmail().toLowerCase() : null;
  const groupEmailToExcludeLower = groupEmailToExclude ? groupEmailToExclude.toLowerCase() : null;

  file.getViewers().forEach(u => {
    const email = u.getEmail().toLowerCase();
    if (email !== owner && email !== groupEmailToExcludeLower) users.push({ email: email, role: 'Viewer' });
  });

  // The getCommenters() method only exists on the File object, not the Folder object.
  if (file.getMimeType() !== MimeType.GOOGLE_DRIVE_FOLDER && typeof file.getCommenters === 'function') {
    file.getCommenters().forEach(u => {
      const email = u.getEmail().toLowerCase();
      if (email !== owner && email !== groupEmailToExcludeLower) users.push({ email: email, role: 'Commenter' });
    });
  }

  file.getEditors().forEach(u => {
    const email = u.getEmail().toLowerCase();
    if (email !== owner && email !== groupEmailToExcludeLower) users.push({ email: email, role: 'Editor' });
  });

  return users;
}

function getDirectFolderUsers_(folder, groupEmailToExclude) {
  const users = [];
  const owner = folder.getOwner() ? folder.getOwner().getEmail().toLowerCase() : null;
  const groupEmailToExcludeLower = groupEmailToExclude ? groupEmailToExclude.toLowerCase() : null;

  folder.getViewers().forEach(u => {
    const email = u.getEmail().toLowerCase();
    if (email !== owner && email !== groupEmailToExcludeLower) users.push({ email: email, role: 'Viewer' });
  });

  folder.getEditors().forEach(u => {
    const email = u.getEmail().toLowerCase();
    if (email !== owner && email !== groupEmailToExcludeLower) users.push({ email: email, role: 'Editor' });
  });

  return users;
}

function getActualMembers_(groupEmail) {
  if (shouldSkipGroupOps_()) {
    log_('Admin SDK not available, cannot get actual group members for ' + groupEmail, 'WARN');
    return [];
  }
  
  try {
    const members = [];
    let pageToken;
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
    return members;
  } catch (e) {
    if (e.message.includes('Resource Not Found: groupKey')) {
      log_('Group ' + groupEmail + ' does not exist. Returning empty list of members.', 'WARN');
    } else {
      log_('Could not retrieve members for group ' + groupEmail + '. Error: ' + e.message, 'WARN');
    }
    return [];
  }
}

/**
 * Clears the script's cache.
 */
function clearCache() {
  const ui = SpreadsheetApp.getUi();
  try {
    CacheService.getScriptCache().removeAll(['config']);
    log_('Script cache has been cleared.');
    ui.alert('The script cache has been cleared.');
  } catch (e) {
    log_('Error clearing cache: ' + e.toString(), 'ERROR');
    ui.alert('An error occurred while clearing the cache: ' + e.message);
  }
}

function getAdminEmails_() {
  const adminSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EDITORS_SHEET_NAME);
  if (!adminSheet) {
    return [];
  }
  const adminData = adminSheet.getRange('A2:D' + adminSheet.getLastRow()).getValues();
  const adminEmails = adminData.filter(function(row) {
    const email = row[0].toString().trim().toLowerCase();
    const isDisabled = row[3];
    return email && email.length > 0 && !isDisabled;
  }).map(function(row) {
    return row[0].toString().trim().toLowerCase();
  });
  
  const owner = SpreadsheetApp.getActiveSpreadsheet().getOwner();
  if (owner) {
      adminEmails.push(owner.getEmail().toLowerCase());
  }
  
  return [...new Set(adminEmails)]; // Return unique emails
}

const SYNC_LOCK_DESCRIPTION_PREFIX = 'Sync Lock by execution: ';
const SYNC_LOCK_TIMESTAMP_MARKER = 'ts=';
const SYNC_LOCK_STALE_THRESHOLD_MS = 10 * 60 * 1000;

function buildSyncLockDescription_(executionId, timestampMs) {
  return `${SYNC_LOCK_DESCRIPTION_PREFIX}${executionId} | ${SYNC_LOCK_TIMESTAMP_MARKER}${timestampMs}`;
}

function parseSyncLockDescription_(description) {
  if (!description || !description.startsWith(SYNC_LOCK_DESCRIPTION_PREFIX)) {
    return null;
  }
  const details = description.substring(SYNC_LOCK_DESCRIPTION_PREFIX.length);
  const parts = details.split(' | ');
  const executionId = parts[0];
  let timestampMs = null;
  if (parts.length > 1 && parts[1].indexOf(SYNC_LOCK_TIMESTAMP_MARKER) === 0) {
    const parsed = Number(parts[1].substring(SYNC_LOCK_TIMESTAMP_MARKER.length));
    if (!isNaN(parsed)) {
      timestampMs = parsed;
    }
  }
  return { executionId: executionId, timestampMs: timestampMs };
}

function removeStaleLocks_(sheets, currentExecutionId) {
  if (!sheets || sheets.length === 0) {
    return;
  }
  log_('Checking for stale sheet locks from previous runs...');
  let staleLocksRemoved = 0;
  const now = Date.now();

  sheets.forEach(sheet => {
    if (!sheet) return;
    try {
      const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
      protections.forEach(protection => {
        const description = protection.getDescription();
        const metadata = parseSyncLockDescription_(description);
        if (!metadata) return;
        if (metadata.executionId === currentExecutionId) {
          if (!metadata.timestampMs) {
            protection.setDescription(buildSyncLockDescription_(metadata.executionId, now));
          }
          return;
        }
        if (!metadata.timestampMs) {
          protection.setDescription(buildSyncLockDescription_(metadata.executionId, now));
          return;
        }
        if (now - metadata.timestampMs >= SYNC_LOCK_STALE_THRESHOLD_MS) {
          log_(`Found stale lock on sheet "${sheet.getName()}" from a previous execution. Removing...`, 'WARN');
          protection.remove();
          staleLocksRemoved++;
        }
      });
    } catch (e) {
      log_(`Could not check/remove stale locks on sheet "${sheet.getName()}": ${e.message}`, 'WARN');
    }
  });

  if (staleLocksRemoved > 0) {
    log_(`Removed ${staleLocksRemoved} stale lock(s).`, 'INFO');
  }
}

function lockSheetForEdits_(sheet, executionId) {
  if (!sheet || !executionId) return;
  try {
    const protection = sheet.protect().setDescription(buildSyncLockDescription_(executionId, Date.now()));
    const me = Session.getEffectiveUser();
    protection.addEditor(me);
    protection.removeEditors(protection.getEditors().filter(editor => editor.getEmail() !== me.getEmail()));
    if (protection.canDomainEdit()) {
      protection.setDomainEdit(false);
    }
    log_(`Sheet "${sheet.getName()}" locked for sync execution: ${executionId}.`, 'INFO');
  } catch (e) {
    log_(`Could not lock sheet "${sheet.getName()}": ${e.message}`, 'WARN');
  }
}

function unlockSheetForEdits_(sheet, executionId) {
  if (!sheet || !executionId) return;
  try {
    const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    protections.forEach(protection => {
      const metadata = parseSyncLockDescription_(protection.getDescription());
      if (metadata && metadata.executionId === executionId) {
        protection.remove();
        log_(`Sheet "${sheet.getName()}" unlocked for execution: ${executionId}.`, 'INFO');
      }
    });
  } catch (e) {
    log_(`Could not unlock sheet "${sheet.getName()}": ${e.message}`, 'WARN');
  }
}

function isGroup_(email) {
  try {
    AdminDirectory.Groups.get(email);
    return true;
  } catch (e) {
    return false;
  }
}

function showSyncInProgress_(silentMode) {
  // Don't show toast in silent mode (e.g., auto sync)
  if (silentMode) return;

  const enableSheetLocking = getConfiguration_()['EnableSheetLocking'];
  let message = 'A synchronization script is running. Please avoid making changes to the sheet.';
  if (enableSheetLocking) {
    message = 'A synchronization script is running. The sheet is temporarily locked to prevent data corruption. Please wait a moment.';
  }
  // Avoid using Spreadsheet toast here; the host sometimes leaves behind a persistent
  // "Working" overlay even after the script finishes. Instead, surface the message in
  // logs only. Sheet locking (if enabled) still provides a visual indicator through the
  // lock icon.
  log_(message, 'INFO');
}

function hideSyncInProgress_(silentMode) {
  if (silentMode) return;
  // Try to force the host UI to refresh without showing a toast or modal that can
  // leave behind the "Working" overlay. A tiny sidebar that immediately closes
  // tends to nudge the Sheets client to repaint.
  try {
    const ui = SpreadsheetApp.getUi();
    const sidebarHtml = HtmlService.createHtmlOutput(
      '<script>setTimeout(function(){google.script.host.close();}, 50);</script>'
    )
      .setWidth(10)
      .setHeight(10);
    ui.showSidebar(sidebarHtml);
    SpreadsheetApp.flush();
    Utilities.sleep(150);

    // On some clients the transient sidebar is not enough. Briefly showing a
    // tiny modal (that immediately closes) plus a short-lived blank toast gives
    // Sheets an extra repaint signal and clears the stuck "Working" label.
    const modalHtml = HtmlService.createHtmlOutput(
      '<script>setTimeout(function(){google.script.host.close();}, 50);</script>'
    )
      .setWidth(10)
      .setHeight(10);
    ui.showModalDialog(modalHtml, ' ');
    SpreadsheetApp.flush();
    Utilities.sleep(75);

    SpreadsheetApp.getActiveSpreadsheet().toast(' ', ' ', 1);
  } catch (e) {
    log_('Unable to refresh UI after sync: ' + e.message, 'WARN');
  }
}

function validateGroupNesting_() {
  log_('Validating group nesting for circular dependencies...');
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const groupSheets = spreadsheet.getSheets().filter(s => s.getName().endsWith('_G'));
  const adminSheet = spreadsheet.getSheetByName(SHEET_EDITORS_SHEET_NAME);
  if (adminSheet) {
    groupSheets.push(adminSheet);
  }

  const allGroupEmails = new Set();
  const dependencyGraph = new Map();

  // --- 1. Build the dependency graph ---
  groupSheets.forEach(sheet => {
    const sheetName = sheet.getName();
    let parentGroupEmail;

    // Determine the parent group's email
    if (sheetName === SHEET_EDITORS_SHEET_NAME) {
      parentGroupEmail = getConfigValue_('SheetEditorsGroupEmail', '') || getConfigValue_('AdminGroupEmail', '');
      if (!parentGroupEmail) {
        try {
          parentGroupEmail = generateGroupEmail_(SHEET_EDITORS_GROUP_NAME);
          log_('Generated Sheet Editors group email for nesting validation: ' + parentGroupEmail, 'INFO');
        } catch (e) {
          log_('Unable to generate Sheet Editors group email for nesting validation: ' + e.message, 'WARN');
        }
      }
    } else {
      const groupName = sheetName.slice(0, -2); // Remove '_G'
      // Find this group's email in UserGroups or ManagedFolders
      parentGroupEmail = findGroupEmailByName_(groupName);
    }

    if (!parentGroupEmail) {
      log_(`Could not determine parent group email for sheet "${sheetName}". Skipping for cycle detection.`, 'WARN');
      return;
    }
    
    parentGroupEmail = parentGroupEmail.toLowerCase();
    allGroupEmails.add(parentGroupEmail);

    if (!dependencyGraph.has(parentGroupEmail)) {
      dependencyGraph.set(parentGroupEmail, []);
    }

    // Find child groups within this sheet (only read actual data rows)
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return; // No data in this sheet
    }
    const memberEmails = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().filter(String);
    memberEmails.forEach(email => {
      const childEmail = email.toString().trim().toLowerCase();
      if (childEmail && childEmail.includes('@')) {
        // For simplicity, we'll consider any valid email a potential group.
        // A more robust check could use AdminDirectory.Groups.get, but that's slow.
        dependencyGraph.get(parentGroupEmail).push(childEmail);
      }
    });
  });

  // --- 2. Perform DFS to detect cycles ---
  const whiteSet = new Set(allGroupEmails); // Nodes not yet visited
  const graySet = new Set();  // Nodes currently in recursion stack
  const blackSet = new Set(); // Nodes completely visited

  function dfs(node, path) {
    whiteSet.delete(node);
    graySet.add(node);
    path.push(node);

    const children = dependencyGraph.get(node) || [];
    for (const child of children) {
      if (graySet.has(child)) {
        // Cycle detected
        path.push(child);
        throw new Error('Circular dependency detected! Sync aborted. Cycle: ' + path.join(' -> '));
      }
      if (whiteSet.has(child)) {
        dfs(child, path);
      }
    }

    graySet.delete(node);
    blackSet.add(node);
    path.pop();
  }

  while (whiteSet.size > 0) {
    const startNode = whiteSet.values().next().value;
    dfs(startNode, []);
  }

  log_('Group nesting validation passed. No circular dependencies found.');
  return true;
}

function findGroupEmailByName_(groupName) {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    // Check UserGroups sheet (only read actual data rows)
    const userGroupsSheet = spreadsheet.getSheetByName(USER_GROUPS_SHEET_NAME);
    if (userGroupsSheet && userGroupsSheet.getLastRow() > 1) {
        const data = userGroupsSheet.getRange(2, 1, userGroupsSheet.getLastRow() - 1, 2).getValues();
        for (let i = 0; i < data.length; i++) {
            if (data[i][0] === groupName && data[i][1]) {
                return data[i][1];
            }
        }
    }

    // Check ManagedFolders sheet (only read actual data rows)
    const managedFoldersSheet = spreadsheet.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
    if (managedFoldersSheet && managedFoldersSheet.getLastRow() > 1) {
      const managedHeaders = getHeaderMap_(managedFoldersSheet);
      const userSheetNameCol = resolveColumn_(managedHeaders, 'UserSheetName', null);
      const managedGroupEmailCol = resolveColumn_(managedHeaders, 'GroupEmail', null);

      if (userSheetNameCol && managedGroupEmailCol) {
        const data = managedFoldersSheet
          .getRange(
            2,
            1,
            managedFoldersSheet.getLastRow() - 1,
            Math.max(userSheetNameCol, managedGroupEmailCol)
          )
          .getValues();
        for (let i = 0; i < data.length; i++) {
          const currentSheetName = data[i][userSheetNameCol - 1];
          if (currentSheetName && currentSheetName.slice(0, -2) === groupName && data[i][managedGroupEmailCol - 1]) {
            return data[i][managedGroupEmailCol - 1];
          }
        }
      }
    }

    return null;
}

function getUserGroupSheetName_(groupName) {
  if (!groupName) {
    return '';
  }

  const trimmedName = groupName.toString().trim();
  if (!trimmedName) {
    return '';
  }

  return trimmedName.endsWith('_G') ? trimmedName : trimmedName + '_G';
}

/**
 * Finds all groups that contain a specific member (for detecting nested groups).
 * Used to warn when deleting a group that is nested in other groups.
 * @param {string} memberEmail - Email address to search for
 * @return {Array<string>} Array of group names that contain this member
 */
function findGroupsContainingMember_(memberEmail) {
  if (!memberEmail) return [];

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const groupsContainingMember = [];

  // Check all user sheets (including group sheets ending in _G)
  const allSheets = spreadsheet.getSheets();
  allSheets.forEach(function(sheet) {
    const sheetName = sheet.getName();

    // Skip system sheets
    if (sheetName === MANAGED_FOLDERS_SHEET_NAME ||
        sheetName === USER_GROUPS_SHEET_NAME ||
        sheetName === SHEET_EDITORS_SHEET_NAME ||
        sheetName === CONFIG_SHEET_NAME ||
        sheetName === LOG_SHEET_NAME ||
        sheetName === TEST_LOG_SHEET_NAME ||
        sheetName === FOLDER_AUDIT_LOG_SHEET_NAME ||
        sheetName === SYNC_HISTORY_SHEET_NAME ||
        sheetName === 'DeepFolderAuditLog' ||
        sheetName === 'Help') {
      return;
    }

    // Check if this sheet contains the member
    if (sheet.getLastRow() < 2) return;

    const emails = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    const found = emails.some(function(row) {
      return row[0] && row[0].toString().trim().toLowerCase() === memberEmail.toLowerCase();
    });

    if (found) {
      // Remove _G suffix if present for cleaner display
      const displayName = sheetName.endsWith('_G') ? sheetName.slice(0, -2) : sheetName;
      groupsContainingMember.push(displayName);
    }
  });

  return groupsContainingMember;
}

/**
 * Sends email notification about deleted groups and folders.
 * @param {Object} summary - Deletion summary with counts and errors
 */
function notifyDeletions_(summary) {
  const config = getConfiguration_();
  const notifyEnabled = getConfigValue_('NotifyOnGroupFolderDeletion', true);
  const emailNotificationsEnabled = getConfigValue_('EnableEmailNotifications', false);

  if (!notifyEnabled || !emailNotificationsEnabled) {
    return; // Notifications disabled
  }

  const recipientEmail = config['NotificationEmail'] || Session.getEffectiveUser().getEmail();
  if (!recipientEmail) {
    log_('Cannot send deletion notification: no recipient email configured', 'WARN');
    return;
  }

  const totalDeleted = summary.userGroupsDeleted + summary.foldersDeleted;
  const subject = `[Permissions Manager] ${totalDeleted} Resource(s) Deleted`;

  let body = 'The following resources were deleted during sync:\n\n';
  body += '='.repeat(60) + '\n\n';

  if (summary.userGroupsDeleted > 0) {
    body += `✓ User Groups Deleted: ${summary.userGroupsDeleted}\n`;
  }

  if (summary.foldersDeleted > 0) {
    body += `✓ Folder-Role Bindings Deleted: ${summary.foldersDeleted}\n`;
  }

  body += '\n';

  if (summary.errors && summary.errors.length > 0) {
    body += '⚠️ ERRORS ENCOUNTERED:\n\n';
    summary.errors.forEach(function(error) {
      body += `  • ${error.type}: "${error.name}"\n`;
      body += `    Error: ${error.error}\n\n`;
    });
  }

  body += '='.repeat(60) + '\n\n';
  body += 'Details:\n\n';
  body += '• Google Groups: Deleted from Google Workspace\n';
  body += '• Folder Permissions: Group access removed\n';
  body += '• User Sheets: Deleted from spreadsheet\n';
  body += '• Configuration Rows: Removed\n';
  body += '• Folders: NOT deleted (remain in Drive)\n\n';

  body += 'To review:\n';
  body += `• Check SyncHistory sheet for full details\n`;
  body += `• Check Log sheet for operation logs\n\n`;

  body += 'Note: This is an automated notification from the Google Drive Permissions Manager.\n';

  try {
    MailApp.sendEmail(recipientEmail, subject, body);
    log_(`Deletion notification sent to ${recipientEmail}`, 'INFO');
  } catch (e) {
    log_(`Failed to send deletion notification: ${e.message}`, 'ERROR');
  }
}
