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
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  return sanitizedName + '@' + domain;
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
      acc[row[0]] = row[1];
    }
    return acc;
  }, {});

  cache.put('config', JSON.stringify(config), 300); // Cache for 5 minutes
  return config;
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
  // 1. Write to the Google Sheet log
  const sheetName = (SCRIPT_EXECUTION_MODE === 'TEST') ? TEST_LOG_SHEET_NAME : LOG_SHEET_NAME;
  const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (logSheet) {
    const timestamp = Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    logSheet.appendRow([timestamp, '[' + severity.toUpperCase() + '] ' + message]);
    
    // Trim the log sheet if it's too long
    const maxLength = getMaxLogLength_();
    const lastRow = logSheet.getLastRow();
    const headerRows = 1;
    const rowsToDelete = lastRow - headerRows - maxLength;
    if (rowsToDelete > 0) {
      logSheet.deleteRows(headerRows + 1, rowsToDelete);
    }
  }

  // 2. Write to Google Cloud Logging if enabled
  const config = getConfiguration_();
  const gcpLoggingEnabled = config['EnableGCPLogging'];

  if (gcpLoggingEnabled === true || gcpLoggingEnabled === 'TRUE') {
    const severityUpper = severity.toUpperCase();
    switch (severityUpper) {
      case 'ERROR':
        console.error(message);
        break;
      case 'WARN':
        console.warn(message);
        break;
      case 'INFO':
        console.info(message);
        break;
      default:
        console.log(message);
        break;
    }
  }
}

function clearAllLogs() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('Are you sure you want to clear all logs?', 'This will delete all data in the "Log" and "TestLog" sheets.', ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) {
    return;
  }

  const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOG_SHEET_NAME);
  if (logSheet) {
    logSheet.getRange('A2:B').clearContent();
  }

  const testLogSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TEST_LOG_SHEET_NAME);
  if (testLogSheet) {
    testLogSheet.getRange('A2:B').clearContent();
  }

  ui.alert('Logs cleared.');
}

function sendErrorNotification_(errorMessage) {
  try {
    const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET_NAME);
    if (!configSheet) return;

    const settings = configSheet.getRange('A2:B3').getValues();
    const enableEmailNotifications = settings[0][1];
    const notificationEmailAddress = settings[1][1];

    if (enableEmailNotifications === true && notificationEmailAddress) {
      MailApp.sendEmail(notificationEmailAddress, 'Permissions Manager Script - Fatal Error', errorMessage);
    }
  } catch (e) {
    log_('Failed to send error notification email: ' + e.toString(), 'ERROR');
  }
}
