/***** CONFIGURATION CONSTANTS *****/
const MANAGED_FOLDERS_SHEET_NAME = 'ManagedFolders';
const ADMINS_SHEET_NAME = 'Admins';
const LOG_SHEET_NAME = 'Log';
const TEST_LOG_SHEET_NAME = 'TestLog';
const USER_GROUPS_SHEET_NAME = 'UserGroups';
const CONFIG_SHEET_NAME = 'Config';
const FOLDER_AUDIT_LOG_SHEET_NAME = 'FoldersAuditLog';
const SYNC_HISTORY_SHEET_NAME = 'SyncHistory';
const DEFAULT_MAX_LOG_LENGTH = 10000;
const AUTO_SYNC_CHANGE_SIGNATURE_KEY = 'AutoSyncChangeSignature';

// Column mapping for the ManagedFolders sheet
const FOLDER_NAME_COL = 1;
const FOLDER_ID_COL = 2;
const ROLE_COL = 3;
const GROUP_EMAIL_COL = 4;        // User-editable: manually specify for Hebrew names
const USER_SHEET_NAME_COL = 5;    // Managed by script
const LAST_SYNCED_COL = 6;         // Managed by script
const STATUS_COL = 7;              // Managed by script
const URL_COL = 8;                 // Managed by script

const ADMINS_LAST_SYNC_CELL = 'B2';
const ADMINS_STATUS_CELL = 'C2';
const ADMINS_GROUP_NAME = 'Admins Control Panel';

// User sheet header constants
const USER_EMAIL_HEADER = 'User Email Address';
const DISABLED_HEADER = 'Disabled';

/***** GLOBAL STATE *****/
let SCRIPT_EXECUTION_MODE = 'DEFAULT'; // Can be 'DEFAULT' or 'TEST'

/***** MENU & TRIGGERS *****/

/**
 * Adds a custom menu to the spreadsheet UI.
 */
function onOpen() {
  const superAdmin = isSuperAdmin_();
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('Permissions Manager');

  if (superAdmin) {
    buildSuperAdminMenu_(menu, ui);
  } else {
    buildRestrictedMenu_();
  }

  menu.addToUi();

  setupControlSheets_();
  setupLogSheets_();
  updateAutoSyncStatusIndicator_();

  if (superAdmin) {
    applyFullView_();
  } else {
    applyRestrictedView_();
    ensureHelpSheetVisible_();
  }
}

function buildSuperAdminMenu_(menu, ui) {
  menu.addSubMenu(createManualSyncMenu_(ui));
  menu.addSeparator();
  menu.addSubMenu(createAutoSyncMenu_(ui));
  menu.addSeparator();
  menu.addSubMenu(createAuditsMenu_(ui));
  menu.addSeparator();
  menu.addSubMenu(createTestingMenu_(ui));
  menu.addSeparator();
  menu.addSubMenu(createLoggingMenu_(ui));
  menu.addSeparator();
  menu.addSubMenu(createAdvancedMenu_(ui));
  menu.addSeparator();
  menu.addSubMenu(createHelpMenu_(ui));
}

function buildRestrictedMenu_() {
  // Restricted users cannot run Apps Script functions, so no menu items are shown.
  // Help documentation is available in the Help sheet instead.
}

function isSuperAdmin_() {
  try {
    const userEmail = getActiveUserEmail_();
    if (!userEmail) {
      log_('Could not resolve active user email. Defaulting to restricted mode.', 'WARN');
      return false;
    }

    const superAdmins = getSuperAdminEmails_();
    if (!superAdmins.length) {
      const ownerEmail = getSpreadsheetOwnerEmail_();
      if (ownerEmail && ownerEmail === userEmail) {
        return true;
      }
      log_('No super admin emails configured. Defaulting to restricted mode for ' + userEmail + '.', 'WARN');
      return false;
    }

    if (superAdmins.indexOf('*') !== -1 || superAdmins.indexOf('all') !== -1) {
      return true;
    }

    const domain = userEmail.indexOf('@') !== -1 ? userEmail.split('@')[1] : '';
    const isSuperAdmin = superAdmins.some(function(entry) {
      if (entry === userEmail) {
        return true;
      }
      if (entry.startsWith('*@') && domain) {
        return userEmail.endsWith(entry.substring(1));
      }
      if (entry.startsWith('@') && domain) {
        return domain === entry.substring(1);
      }
      if (domain && entry === domain) {
        return true;
      }
      return false;
    });
    log_('Super admin check for ' + userEmail + ': ' + (isSuperAdmin ? 'GRANTED' : 'DENIED'), 'DEBUG');
    return isSuperAdmin;
  } catch (e) {
    log_('Could not determine super admin status: ' + e.message, 'WARN');
    return false;
  }
}

function getSuperAdminEmails_() {
  const config = typeof getConfiguration_ === 'function' ? getConfiguration_() : {};
  const rawValue = config['SuperAdminEmails'];
  let values = [];

  if (rawValue === undefined || rawValue === null) {
    values = [];
  } else if (Array.isArray(rawValue)) {
    values = rawValue;
  } else if (typeof rawValue === 'string') {
    values = rawValue.split(/[\n,;]+/);
  } else {
    values = [String(rawValue)];
  }

  const normalized = values
    .map(function(value) { return value.trim().toLowerCase(); })
    .filter(function(value) { return value.length > 0; });

  const ownerEmail = getSpreadsheetOwnerEmail_();
  const ownerTokens = ['owner', 'spreadsheet_owner'];

  const expanded = normalized.reduce(function(acc, value) {
    if (ownerTokens.indexOf(value) !== -1) {
      if (ownerEmail) {
        acc.push(ownerEmail);
      }
      return acc;
    }
    acc.push(value);
    return acc;
  }, []);

  if (!expanded.length && ownerEmail) {
    return [ownerEmail];
  }

  return Array.from(new Set(expanded));
}

function applyRestrictedView_() {
  try {
    const visibilityConfig = getTestSheetVisibilityConfig_();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ss.getSheets().forEach(function(sheet) {
      const name = sheet.getName();
      if (shouldHideSheetForRestrictedView_(name, visibilityConfig) && typeof sheet.hideSheet === 'function') {
        try {
          if (!sheet.isSheetHidden()) {
            sheet.hideSheet();
          }
        } catch (e) {
          log_('Could not hide sheet "' + name + '": ' + e.message, 'WARN');
        }
      }
    });
  } catch (e) {
    log_('Failed to apply restricted view: ' + e.message, 'WARN');
  }
}

function applyFullView_() {
  try {
    const visibilityConfig = getTestSheetVisibilityConfig_();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    log_('applyFullView_: Processing sheets for super admin visibility', 'DEBUG');
    ss.getSheets().forEach(function(sheet) {
      const name = sheet.getName();
      const shouldHide = shouldHideSheetForRestrictedView_(name, visibilityConfig);
      if (shouldHide && typeof sheet.showSheet === 'function') {
        try {
          if (sheet.isSheetHidden()) {
            sheet.showSheet();
            log_('applyFullView_: Showed hidden test sheet: ' + name, 'INFO');
          } else {
            log_('applyFullView_: Test sheet already visible: ' + name, 'DEBUG');
          }
        } catch (e) {
          log_('Could not show sheet "' + name + '": ' + e.message, 'WARN');
        }
      }
    });
  } catch (e) {
    log_('Failed to restore full view: ' + e.message, 'WARN');
  }
}

function getTestSheetVisibilityConfig_() {
  const config = typeof getConfiguration_ === 'function' ? getConfiguration_() : {};
  const manualTestFolderName = config['TestFolderName'] ? String(config['TestFolderName']) : '';

  const exactNames = [TEST_LOG_SHEET_NAME, 'TestCycleA_G', 'TestCycleB_G'];
  const prefixes = ['StressTestFolder_', 'SheetLockingTestSheet_'];

  if (manualTestFolderName) {
    prefixes.push(manualTestFolderName + '_');
  }

  return {
    exactNames: new Set(exactNames),
    prefixes: prefixes
  };
}

function shouldHideSheetForRestrictedView_(sheetName, config) {
  if (config.exactNames.has(sheetName)) {
    return true;
  }

  return config.prefixes.some(function(prefix) {
    return sheetName.indexOf(prefix) === 0;
  });
}

/**
 * Ensures the Help sheet is visible for non-admin users
 */
function ensureHelpSheetVisible_() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const helpSheet = ss.getSheetByName('Help');
    if (helpSheet && helpSheet.isSheetHidden()) {
      helpSheet.showSheet();
    }
  } catch (e) {
    log_('Could not ensure Help sheet visibility: ' + e.message, 'WARN');
  }
}


function getActiveUserEmail_() {
  try {
    const activeUser = Session.getActiveUser();
    if (activeUser) {
      const email = activeUser.getEmail();
      if (email) {
        return email.toLowerCase();
      }
    }
  } catch (e) {
    log_('Failed to read active user email: ' + e.message, 'WARN');
  }
  return '';
}

function getSpreadsheetOwnerEmail_() {
  try {
    const owner = SpreadsheetApp.getActive().getOwner();
    if (owner && typeof owner.getEmail === 'function') {
      const email = owner.getEmail();
      if (email) {
        return email.toLowerCase();
      }
    }
  } catch (e) {
    log_('Failed to read spreadsheet owner email: ' + e.message, 'DEBUG');
  }
  return '';
}

function createManualSyncMenu_(ui) {
  const granularMenu = ui.createMenu('Granular Sync')
    .addItem('Sync Admins', 'syncAdmins')
    .addItem('Sync User Groups', 'syncUserGroups')
    .addSeparator()
    .addItem('Sync All Folders - Adds Only', 'syncManagedFoldersAdds')
    .addItem('Sync All Folders - Deletes Only', 'syncManagedFoldersDeletes');

  return ui.createMenu('ManualSync')
    .addItem('Full Sync (Add & Delete)', 'fullSync')
    .addItem('Sync Adds', 'syncAdds')
    .addItem('Sync Deletes', 'syncDeletes')
    .addSeparator()
    .addSubMenu(granularMenu);
}

function createAutoSyncMenu_(ui) {
  const editModeMenu = ui.createMenu('Edit Mode')
    .addItem('🔒 Enter Edit Mode', 'enterEditMode')
    .addItem('🔓 Exit Edit Mode', 'exitEditMode')
    .addSeparator()
    .addItem('📊 View Edit Mode Status', 'viewEditModeStatus');

  return ui.createMenu('AutoSync')
    .addItem('🚀 Enable/Update AutoSync', 'setupAutoSync')
    .addItem('🛑 Disable AutoSync', 'removeAutoSync')
    .addSeparator()
    .addItem('▶️ Run AutoSync Now', 'runAutoSyncNow')
    .addSeparator()
    .addItem('📊 View Trigger Status', 'viewTriggerStatus')
    .addSeparator()
    .addSubMenu(editModeMenu);
}

function createAuditsMenu_(ui) {
  return ui.createMenu('Audits')
    .addItem('Folders Audit', 'foldersAudit')
    .addItem('Deep Folder Audit', 'deepAuditFolder');
}

function createTestingMenu_(ui) {
  const individualTestsMenu = ui.createMenu('Individual Tests')
    .addItem('Run Manual Access Test', 'runManualAccessTest')
    .addItem('Run Stress Test', 'runStressTest')
    .addItem('Run Add/Delete Separation Test', 'runAddDeleteSeparationTest')
    .addItem('Run AutoSync Error Email Test', 'runAutoSyncErrorEmailTest')
    .addItem('Run Sheet Locking Test', 'runSheetLockingTest_')
    .addItem('Run Circular Dependency Test', 'runCircularDependencyTest_');

  const standaloneTestsMenu = ui.createMenu('Standalone Tests')
    .addItem('Run Email Capability Test', 'runEmailCapabilityTest');

  const cleanupMenu = ui.createMenu('Cleanup')
    .addItem('Cleanup Manual Test Data', 'cleanupManualTestData')
    .addItem('Cleanup Stress Test Data', 'cleanupStressTestData')
    .addItem('Cleanup Add/Delete Test Data', 'cleanupAddDeleteSeparationTestData')
    .addSeparator()
    .addItem('Clear All Test Data', 'clearAllTestsData');

  return ui.createMenu('Testing')
    .addItem('Run All Tests', 'runAllTests')
    .addSeparator()
    .addSubMenu(individualTestsMenu)
    .addSeparator()
    .addSubMenu(standaloneTestsMenu)
    .addSeparator()
    .addSubMenu(cleanupMenu);
}

function createLoggingMenu_(ui) {
  return ui.createMenu('Logging')
    .addItem('Clear Auxiliary Logs (Keep Main Log)', 'clearAuxiliaryLogs')
    .addItem('Clear All Logs', 'clearAllLogs');
}

function createAdvancedMenu_(ui) {
  return ui.createMenu('Advanced')
    .addItem('Clear Cache', 'clearCache')
    .addItem('Update User Sheet Headers', 'updateUserSheetHeaders_')
    .addSeparator()
    .addItem('Clean up folder...', 'cleanupFolderByName')
    .addItem('Remove Blank Rows', 'removeBlankRows')
    .addSeparator()
    .addItem('Refresh Config GUI', 'applyConfigValidation_');
}

function createHelpMenu_(ui) {
  return ui.createMenu('Help')
    .addItem('User Guide', 'openUserGuide')
    .addItem('Testing Guide', 'openTestingGuide')
    .addItem('README', 'openReadme');
}

/**
 * Wrapper function to run AutoSync manually from menu
 */
function runAutoSyncNow() {
  const summary = autoSync({ silentMode: true });
  if (summary && summary.skipped) {
    const summaryMessage = 'AutoSync skipped: No changes detected since last run.';
    SpreadsheetApp.getUi().alert(summaryMessage);
  } else if (summary) {
    const summaryMessage = 'Manual AutoSync complete. Total changes: ' + summary.added + ' added, ' + summary.removed + ' removed, ' + summary.failed + ' failed.';
    log_(summaryMessage, 'INFO');
    SpreadsheetApp.getUi().alert(summaryMessage);
  } else {
    log_('Manual AutoSync did not complete successfully. Check logs for details.', 'WARN');
    SpreadsheetApp.getUi().alert('Manual AutoSync did not complete successfully. Check logs for details.');
  }
}

function onEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  const oldValue = e.oldValue;

  // Exit if the edited sheet is not the Config sheet
  if (sheet.getName() !== CONFIG_SHEET_NAME) {
    return;
  }

  const editedRow = range.getRow();
  const editedCol = range.getColumn();
  
  // --- Protect Description Column ---
  if (editedCol === 3) {
    range.setValue(oldValue);
    SpreadsheetApp.getActiveSpreadsheet().toast('The description column is not editable.', 'Edit Reverted', 10);
    return;
  }

  // Exit if more than one cell is edited at once
  if (range.getNumRows() > 1 || range.getNumColumns() > 1) {
    return;
  }

  const settingCell = sheet.getRange(editedRow, 1);
  const valueCell = sheet.getRange(editedRow, 2);

  // Only act on edits in the "Value" column (column B)
  if (editedCol !== 2) {
    return;
  }

  const settingName = settingCell.getValue();

  // --- Handle Read-Only Status Indicator ---
  if (settingName === 'AutoSync Trigger Status') {
    // Revert the change and inform the user
    valueCell.setValue(oldValue);
    SpreadsheetApp.getActiveSpreadsheet().toast('This is a read-only status indicator.', 'Edit Reverted', 10);
    return;
  }
}



function getActiveUserEmail_() {
  try {
    const activeUser = Session.getActiveUser();
    if (activeUser) {
      const email = activeUser.getEmail();
      if (email) {
        return email.toLowerCase();
      }
    }
  } catch (e) {
    log_('Failed to read active user email: ' + e.message, 'WARN');
  }
  return '';
}

function isSuperAdmin_() {
  try {
    const userEmail = getActiveUserEmail_();
    if (!userEmail) {
      log_('Could not resolve active user email. Defaulting to restricted mode.', 'WARN');
      return false;
    }

    const superAdmins = getSuperAdminEmails_();
    if (!superAdmins.length) {
      return true;
    }

    if (superAdmins.indexOf('*') !== -1 || superAdmins.indexOf('all') !== -1) {
      return true;
    }

    const domain = userEmail.indexOf('@') !== -1 ? userEmail.split('@')[1] : '';
    return superAdmins.some(function(entry) {
      if (entry === userEmail) {
        return true;
      }
      if (entry.startsWith('*@') && domain) {
        return userEmail.endsWith(entry.substring(1));
      }
      if (entry.startsWith('@') && domain) {
        return domain === entry.substring(1);
      }
      if (domain && entry === domain) {
        return true;
      }
      return false;
    });
  } catch (e) {
    log_('Could not determine super admin status: ' + e.message, 'WARN');
    return true;
  }
}

function getSuperAdminEmails_() {
  const config = typeof getConfiguration_ === 'function' ? getConfiguration_() : {};
  const rawValue = config['SuperAdminEmails'];
  let values = [];

  if (rawValue === undefined || rawValue === null) {
    values = [];
  } else if (Array.isArray(rawValue)) {
    values = rawValue;
  } else if (typeof rawValue === 'string') {
    values = rawValue.split(/[\n,;]+/);
  } else {
    values = [String(rawValue)];
  }

  const normalized = values
    .map(function(value) { return value.trim().toLowerCase(); })
    .filter(function(value) { return value.length > 0; });

  if (normalized.length === 0) {
    const fallbacks = [];
    try {
      const owner = SpreadsheetApp.getActive().getOwner();
      if (owner && owner.getEmail()) {
        fallbacks.push(owner.getEmail().toLowerCase());
      }
    } catch (e) {
      // Ignore
    }
    return Array.from(new Set(fallbacks.filter(function(email) { return email && email.length > 0; })));
  }

  return Array.from(new Set(normalized));
}