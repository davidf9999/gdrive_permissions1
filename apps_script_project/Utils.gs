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

    // Always write to at least row 2 (never overwrite the header)
    const nextRow = Math.max(lastRow + 1, 2);
    logSheet.getRange(nextRow, 1, 1, 3).setValues([[timestamp, severity.toUpperCase(), messageStr]]);
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
    setupDryRunAuditLogSheet_(foldersAuditLogSheet);
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
    setupDryRunAuditLogSheet_(foldersAuditLogSheet);
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
    log_('Updated Config setting "' + settingName + '" to: ' + value, 'INFO');
  } else {
    // Setting doesn't exist, add it
    const lastRow = settings.filter(String).length;
    configSheet.getRange(lastRow + 1, 1, 1, 2).setValues([[settingName, value]]);
    log_('Added new Config setting "' + settingName + '" with value: ' + value, 'INFO');
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

function getDirectFolderUsers_(folder) {
  const users = [];
  const owner = folder.getOwner() ? folder.getOwner().getEmail().toLowerCase() : null;

  folder.getViewers().forEach(u => {
    const email = u.getEmail().toLowerCase();
    if (email !== owner) users.push({ email: email, role: 'Viewer' });
  });

  folder.getEditors().forEach(u => {
    const email = u.getEmail().toLowerCase();
    if (email !== owner) users.push({ email: email, role: 'Editor' });
  });

  return users;
}

function getDirectFileUsers_(file) {
  const users = [];
  const owner = file.getOwner() ? file.getOwner().getEmail().toLowerCase() : null;

  file.getViewers().forEach(u => {
    const email = u.getEmail().toLowerCase();
    if (email !== owner) users.push({ email: email, role: 'Viewer' });
  });

  // The getCommenters() method only exists on the File object, not the Folder object.
  if (file.getMimeType() !== MimeType.GOOGLE_DRIVE_FOLDER && typeof file.getCommenters === 'function') {
    file.getCommenters().forEach(u => {
      const email = u.getEmail().toLowerCase();
      if (email !== owner) users.push({ email: email, role: 'Commenter' });
    });
  }

  file.getEditors().forEach(u => {
    const email = u.getEmail().toLowerCase();
    if (email !== owner) users.push({ email: email, role: 'Editor' });
  });

  return users;
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