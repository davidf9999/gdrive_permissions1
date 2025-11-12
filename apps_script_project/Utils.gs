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

function generateGroupEmail_(baseName) {
  const domain = Session.getActiveUser().getEmail().split('@')[1];
  if (!domain) {
    throw new Error('Could not determine user domain.');
  }

  const sanitizedName = baseName
    .toLowerCase()
    .replace(/\s+/g, '-')              // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '')        // Remove invalid characters
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
  const emailMap = new Map(); // email -> [{sheet: sheetName, row: rowNum, context: description}]
  const errors = [];

  // Collect emails from UserGroups sheet
  const userGroupsSheet = spreadsheet.getSheetByName(USER_GROUPS_SHEET_NAME);
  if (userGroupsSheet && userGroupsSheet.getLastRow() > 1) {
    const data = userGroupsSheet.getRange(2, 1, userGroupsSheet.getLastRow() - 1, 2).getValues();
    for (let i = 0; i < data.length; i++) {
      const groupName = data[i][0];
      const groupEmail = data[i][1];
      if (groupEmail && groupEmail.toString().trim()) {
        const email = groupEmail.toString().trim().toLowerCase();
        if (!emailMap.has(email)) {
          emailMap.set(email, []);
        }
        emailMap.get(email).push({
          sheet: 'UserGroups',
          row: i + 2,
          context: 'Group: ' + groupName
        });
      }
    }
  }

  // Collect emails from ManagedFolders sheet
  const managedSheet = spreadsheet.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (managedSheet && managedSheet.getLastRow() > 1) {
    const data = managedSheet.getRange(2, 1, managedSheet.getLastRow() - 1, GROUP_EMAIL_COL).getValues();
    for (let i = 0; i < data.length; i++) {
      const folderName = data[i][FOLDER_NAME_COL - 1];
      const role = data[i][ROLE_COL - 1];
      const groupEmail = data[i][GROUP_EMAIL_COL - 1];
      if (groupEmail && groupEmail.toString().trim()) {
        const email = groupEmail.toString().trim().toLowerCase();
        if (!emailMap.has(email)) {
          emailMap.set(email, []);
        }
        emailMap.get(email).push({
          sheet: 'ManagedFolders',
          row: i + 2,
          context: 'Folder: ' + folderName + ', Role: ' + role
        });
      }
    }
  }

  // Check for duplicates
  emailMap.forEach((locations, email) => {
    if (locations.length > 1) {
      const locationStrings = locations.map(loc =>
        loc.sheet + ' row ' + loc.row + ' (' + loc.context + ')'
      );
      errors.push({
        email: email,
        locations: locationStrings,
        message: 'Duplicate group email "' + email + '" found in: ' + locationStrings.join('; ')
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
  if (typeof AdminDirectory === 'undefined') {
    const msg = 'Admin Directory service is not available. Enable it in Apps Script (Services > Admin Directory API) and in Google Cloud (APIs & Services > Library > Admin SDK). Requires Google Workspace.';
    log_(msg, 'ERROR');
    throw new Error(msg);
  }
}

function isAdminDirectoryAvailable_() {
  try { return typeof AdminDirectory !== 'undefined'; } catch (e) { return false; }
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


function getTestConfiguration_() {
    const config = getConfiguration_();
    const testConfig = {
        folderName: config['TestFolderName'],
        role: config['TestRole'],
        email: config['TestEmail'],
        cleanup: (config['TestCleanup'] === true || config['TestCleanup'] === 'TRUE'),
        autoConfirm: (config['TestAutoConfirm'] === true || config['TestAutoConfirm'] === 'TRUE'),
        numFolders: parseInt(config['TestNumFolders'], 10),
        numUsers: parseInt(config['TestNumUsers'], 10),
        baseEmail: config['TestBaseEmail']
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

function log_(message, severity = 'INFO') {
  // Filter out spreadsheet errors to prevent #ERROR! from appearing in logs
  const messageStr = String(message);
  if (messageStr.startsWith('#') && (messageStr.includes('ERROR') || messageStr.includes('N/A') || messageStr.includes('VALUE') || messageStr.includes('REF') || messageStr.includes('DIV'))) {
    // Skip logging spreadsheet errors - they're not useful log messages
    return;
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
    logSheet.getRange(nextRow, 1, 1, 3).setValues([[timestamp, severity.toUpperCase(), messageStr]]);

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


function logSyncHistory_(revisionId, revisionLink, summary, durationSeconds) {
  const syncHistorySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SYNC_HISTORY_SHEET_NAME);
  if (!syncHistorySheet) {
    log_('SyncHistory sheet not found. Skipping sync history logging.', 'WARN');
    return;
  }

  const timestamp = Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  const added = summary ? summary.added || 0 : 0;
  const removed = summary ? summary.removed || 0 : 0;
  const failed = summary ? summary.failed || 0 : 0;

  if (added === 0 && removed === 0 && failed === 0) {
    log_('No permission changes detected. Skipping SyncHistory entry.', 'INFO');
    return;
  }

  let lastRow = syncHistorySheet.getLastRow();
  const headers = ['Timestamp', 'Revision ID', 'Added', 'Removed', 'Failed', 'Duration (seconds)', 'Revision Link'];

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

  // Check if row 2 is empty (history was cleared) - if so, reset to row 1
  if (lastRow > 1 && !syncHistorySheet.getRange('A2').getValue()) {
    lastRow = 1;
  }

  const nextRow = Math.max(lastRow + 1, 2);

  // Create instructions for viewing revision history
  // Note: Google Sheets doesn't provide direct URLs to specific revisions
  const rowValues = [
    timestamp,
    revisionId || 'N/A',
    added,
    removed,
    failed,
    durationSeconds || 0,
    ''
  ];

  syncHistorySheet.getRange(nextRow, 1, 1, rowValues.length).setValues([rowValues]);

  // Refresh header notes so guidance stays aligned with the new column order
  syncHistorySheet.getRange('A1:G1').clearNote();
  syncHistorySheet.getRange('A1').setNote('Timestamp when the sync completed. Use this to find the corresponding revision in version history.');
  syncHistorySheet.getRange('B1').setNote('Google\'s internal revision ID (for reference only - cannot be used to link directly).');
  syncHistorySheet.getRange('G1').setNote('To view this version: Open the spreadsheet, go to File > Version history > See version history, then find the revision matching the timestamp in column A. Google keeps revisions for 30-100 days.');

  log_('Logged sync history: Revision ' + (revisionId || 'N/A') + ', Changes: +' + added + ' -' + removed + ' !' + failed, 'INFO');
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

  ui.alert('All logs have been cleared.');
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

function sendErrorNotification_(errorMessage) {
  try {
    const enableEmailNotifications = getConfigValue_('EnableEmailNotifications', false);
    const adminEmail = getConfigValue_('NotificationEmail', null);

    if (enableEmailNotifications === true && adminEmail) {
      MailApp.sendEmail(adminEmail, 'Permissions Manager Script - Fatal Error', errorMessage);
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
  const adminSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ADMINS_SHEET_NAME);
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

function lockSheetForEdits_(sheet) {
  if (!sheet) return;
  try {
    const protection = sheet.protect().setDescription('Locked for script execution');
    const me = Session.getEffectiveUser();
    protection.addEditor(me);
    protection.removeEditors(protection.getEditors().filter(editor => editor.getEmail() !== me.getEmail()));
    if (protection.canDomainEdit()) {
      protection.setDomainEdit(false);
    }
    log_(`Sheet "${sheet.getName()}" locked for sync.`, 'INFO');
  } catch (e) {
    log_(`Could not lock sheet "${sheet.getName()}": ${e.message}`, 'WARN');
  }
}

function unlockSheetForEdits_(sheet) {
  if (!sheet) return;
  try {
    const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    protections.forEach(protection => {
      if (protection.getDescription() === 'Locked for script execution') {
        protection.remove();
        log_(`Sheet "${sheet.getName()}" unlocked.`, 'INFO');
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

function showSyncInProgress_() {
  const enableSheetLocking = getConfigValue_('EnableSheetLocking', true);
  let message = 'A synchronization script is running. Please avoid making changes to the sheet.';
  if (enableSheetLocking) {
    message = 'A synchronization script is running. The sheet is temporarily locked to prevent data corruption. Please wait a moment.';
  }
  showToast_(message, 'Sync in Progress', 30); // Increase duration to 30 seconds
}

function hideSyncInProgress_() {
  // A simple toast to indicate completion, or just let the next UI action override it.
  // For now, we'll just let it disappear or be replaced.
}

function validateGroupNesting_() {
  log_('Validating group nesting for circular dependencies...');
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const groupSheets = spreadsheet.getSheets().filter(s => s.getName().endsWith('_G'));
  const adminSheet = spreadsheet.getSheetByName(ADMINS_SHEET_NAME);
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
    if (sheetName === ADMINS_SHEET_NAME) {
      parentGroupEmail = getConfigValue_('AdminGroupEmail');
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

    // Find child groups within this sheet
    const memberEmails = sheet.getRange('A2:A').getValues().flat().filter(String);
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
    
    // Check UserGroups sheet
    const userGroupsSheet = spreadsheet.getSheetByName(USER_GROUPS_SHEET_NAME);
    if (userGroupsSheet) {
        const data = userGroupsSheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
            if (data[i][0] === groupName && data[i][1]) {
                return data[i][1];
            }
        }
    }

    // Check ManagedFolders sheet
    const managedFoldersSheet = spreadsheet.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
    if (managedFoldersSheet) {
        const data = managedFoldersSheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
            const currentSheetName = data[i][USER_SHEET_NAME_COL - 1];
            if (currentSheetName && currentSheetName.slice(0, -2) === groupName && data[i][GROUP_EMAIL_COL - 1]) {
                 return data[i][GROUP_EMAIL_COL - 1];
            }
        }
    }
    
    return null;
}