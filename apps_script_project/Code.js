/***** CONFIGURATION CONSTANTS *****/
const SCRIPT_VERSION = '1.0.0';
const MANAGED_FOLDERS_SHEET_NAME = 'ManagedFolders';
const SHEET_EDITORS_SHEET_NAME = 'SheetEditors';
const ADMINS_SHEET_NAME = SHEET_EDITORS_SHEET_NAME; // Backward compatibility with legacy Admins sheet references
const LOG_SHEET_NAME = 'Log';
const TEST_LOG_SHEET_NAME = 'TestLog';
const USER_GROUPS_SHEET_NAME = 'UserGroups';
const CONFIG_SHEET_NAME = 'Config';
const FOLDER_AUDIT_LOG_SHEET_NAME = 'FoldersAuditLog';
const SYNC_HISTORY_SHEET_NAME = 'SyncHistory';
const DEFAULT_MAX_LOG_LENGTH = 10000;
const AUTO_SYNC_CHANGE_SIGNATURE_KEY = 'AutoSyncChangeSignature';
const AUTO_SYNC_LAST_RUN_KEY = 'AutoSyncLastRunTimestamp';

// Column mapping for the ManagedFolders sheet
const FOLDER_NAME_COL = 1;
const FOLDER_ID_COL = 2;
const ROLE_COL = 3;
const GROUP_EMAIL_COL = 4;        // User-editable: manually specify for Hebrew names
const USER_SHEET_NAME_COL = 5;    // Managed by script
const LAST_SYNCED_COL = 6;         // Managed by script
const STATUS_COL = 7;              // Managed by script
const URL_COL = 8;                 // Managed by script
const DELETE_COL = 9;              // User-editable: mark for deletion

// Column mapping for the UserGroups sheet
const USERGROUPS_DELETE_COL = 6;   // User-editable: mark for deletion

const ADMINS_LAST_SYNC_CELL = 'C2';
const ADMINS_STATUS_CELL = 'D2';
const SHEET_EDITORS_GROUP_NAME = 'sheets-editors';

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
  // Validate environment first (Google Workspace with Admin SDK required)
  if (!validateEnvironment_()) {
    return; // Abort setup if environment is not suitable
  }

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

  if (superAdmin) {
    // updateAutoSyncStatusIndicator_();
    applyFullView_();
  } else {
    applyRestrictedView_();
    ensureHelpSheetVisible_();
  }
}

/**
 * Validates that the environment meets requirements for this tool.
 * Requires Google Workspace with Admin SDK enabled.
 * @return {boolean} True if environment is valid, false otherwise
 */
function validateEnvironment_() {
  if (!isAdminDirectoryAvailable_()) {
    try {
      const ui = SpreadsheetApp.getUi();
      ui.alert(
        'Google Workspace Required',
        'This tool requires Google Workspace with Admin SDK enabled.\n\n' +
        'Without Admin SDK, this tool cannot:\n' +
        '• Create or manage Google Groups\n' +
        '• Manage group membership\n' +
        '• Perform permission synchronization\n\n' +
        'Please see docs/WORKSPACE_SETUP.md for setup instructions.',
        ui.ButtonSet.OK
      );
    } catch (e) {
      // If UI not available, just log
      console.log('Admin SDK not available. This tool requires Google Workspace.');
    }
    return false;
  }
  return true;
}

/**
 * Trigger fired when a Sheet Editor edits a cell in the spreadsheet.
 * Handles multiple edit scenarios:
 * 1. Warns users if they try to delete rows from ManagedFolders or UserGroups
 * 2. Protects Config sheet Description column from edits
 * 3. Prevents edits to read-only Config status indicators
 * @param {Event} e The onEdit event object
 */
function onEdit(e) {
  if (!e || !e.source) return;

  const sheet = e.source.getActiveSheet();
  const sheetName = sheet.getName();
  const range = e.range;
  const oldValue = e.oldValue;

  // --- Handle ManagedFolders and UserGroups row deletion warning ---
  if (sheetName === MANAGED_FOLDERS_SHEET_NAME || sheetName === USER_GROUPS_SHEET_NAME) {
    if (!range || range.getRow() <= 1) {
      return; // Skip header row
    }

    // Check if user might be deleting a row (first 3 columns are empty)
    const row = range.getRow();
    const firstCols = sheet.getRange(row, 1, 1, 3).getValues()[0];

    // If first columns are empty, might be a deleted row
    if (!firstCols[0] && !firstCols[1] && !firstCols[2]) {
      try {
        SpreadsheetApp.getUi().alert(
          'Use Delete Checkbox Instead',
          'To delete a folder or group, please check the "Delete" checkbox in the last column and run sync.\n\n' +
          'Why? Manual row deletion:\n' +
          '• Leaves orphaned resources (groups, sheets)\n' +
          '• Causes sync to abort with errors\n' +
          '• Bypasses safety mechanisms\n\n' +
          'The Delete checkbox ensures proper cleanup of all related resources.',
          SpreadsheetApp.getUi().ButtonSet.OK
        );
      } catch (alertError) {
        // If alert fails, just log
        log_('Warning: A Sheet Editor may be deleting rows in ' + sheetName + '. Use Delete checkbox instead.', 'WARN');
      }
    }
    return;
  }

  // --- Handle Config sheet protection ---
  if (sheetName === CONFIG_SHEET_NAME) {
    const editedRow = range.getRow();
    const editedCol = range.getColumn();
    const headerMap = getHeaderMap_(sheet);
    const descriptionCol = resolveColumn_(headerMap, 'Description', 3);
    const valueCol = resolveColumn_(headerMap, 'Value', 2);
    const settingCol = resolveColumn_(headerMap, 'Setting', 1);

    // Protect Description Column (column 3)
    if (editedCol === descriptionCol) {
      range.setValue(oldValue);
      SpreadsheetApp.getActiveSpreadsheet().toast('The description column is not editable.', 'Edit Reverted', 10);
      return;
    }

    // Exit if more than one cell is edited at once
    if (range.getNumRows() > 1 || range.getNumColumns() > 1) {
      return;
    }

    // Only act on edits in the "Value" column (column B/2)
    if (editedCol !== valueCol) {
      return;
    }

    const settingCell = sheet.getRange(editedRow, settingCol);
    const valueCell = sheet.getRange(editedRow, valueCol);
    const settingName = settingCell.getValue();

    // Handle Read-Only Status Indicator
    if (settingName === 'AutoSync Trigger Status') {
      // Revert the change and inform the user
      valueCell.setValue(oldValue);
      SpreadsheetApp.getActiveSpreadsheet().toast('This is a read-only status indicator.', 'Edit Reverted', 10);
      return;
    }
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
    const isSuperAdmin = superAdmins.some(function (entry) {
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
    .map(function (value) { return value.trim().toLowerCase(); })
    .filter(function (value) { return value.length > 0; });

  const ownerEmail = getSpreadsheetOwnerEmail_();
  const ownerTokens = ['owner', 'spreadsheet_owner'];

  const expanded = normalized.reduce(function (acc, value) {
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
    ss.getSheets().forEach(function (sheet) {
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
    ss.getSheets().forEach(function (sheet) {
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

  return config.prefixes.some(function (prefix) {
    return sheetName.indexOf(prefix) === 0;
  });
}

/**
 * Ensures the Help sheet is visible for Sheet Editors
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
    .addItem('Sync Sheet Editors', 'syncSheetEditors')
    .addItem('Sync User Groups', 'syncUserGroups')
    .addSeparator()
    .addItem('Sync All Folders - Add/Enable Users', 'syncManagedFoldersAdds')
    .addItem('Sync All Folders - Remove/Disable Users', 'syncManagedFoldersDeletes');

  return ui.createMenu('ManualSync')
    .addItem('Full Sync', 'fullSync')
    .addItem('Sync Groups - Add/Enable Users', 'syncAdds')
    .addItem('Sync Groups - Remove/Disable Users', 'syncDeletes')
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
  const individualTestsMenu = ui.createMenu('Individual Tests Of All Tests')
    .addItem('Run Manual Access Test', 'runManualAccessTest')
    .addItem('Run Stress Test', 'runStressTest')
    .addItem('Run Add/Delete Separation Test', 'runAddDeleteSeparationTest')
    .addItem('Run AutoSync Error Email Test', 'runAutoSyncErrorEmailTest')
    .addItem('Run Sheet Locking Test', 'runSheetLockingTest_')
    .addItem('Run Circular Dependency Test', 'runCircularDependencyTest_')
    .addSeparator()
    .addItem('Run UserGroup Deletion Test', 'runUserGroupDeletionTest')
    .addItem('Run Folder-Role Deletion Test', 'runFolderRoleDeletionTest')
    .addItem('Run Deletion Disabled Test', 'runDeletionDisabledTest')
    .addItem('Run Idempotent Deletion Test', 'runIdempotentDeletionTest')
    .addItem('Run All Deletion Tests', 'runAllDeletionTests');

  const standaloneTestsMenu = ui.createMenu('Standalone Tests')
    .addItem('Run Email Capability Test', 'runEmailCapabilityTest');

  const cleanupMenu = ui.createMenu('Cleanup')
    .addItem('Cleanup Manual Test Data', 'cleanupManualTestData')
    .addItem('Cleanup Stress Test Data', 'cleanupStressTestData')
    .addItem('Cleanup Add/Delete Test Data', 'cleanupAddDeleteSeparationTestData')
    .addItem('Cleanup Deletion Test Data', 'cleanupDeletionTestData')
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
    .addItem('Delete Orphan Sheets', 'deleteOrphanSheets')
    .addItem('Clean up folder...', 'cleanupFolderByName')
    .addItem('Remove Blank Rows', 'removeBlankRows')
    .addSeparator()
    .addItem('Refresh Config GUI', 'applyConfigValidation_');
}

function createHelpMenu_(ui) {
  return ui.createMenu('Help')
    .addItem('User Guide', 'openUserGuide')
    .addItem('Testing Guide', 'openTestingGuide')
    .addItem('README', 'openReadme')
    .addItem('All Documentation', 'openAllDocumentation')
    .addSeparator()
    .addItem('View Version', 'showVersion_');
}

function showVersion_() {
  SpreadsheetApp.getUi().alert('Permissions Manager Version', SCRIPT_VERSION, SpreadsheetApp.getUi().ButtonSet.OK);
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
    return superAdmins.some(function (entry) {
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
    .map(function (value) { return value.trim().toLowerCase(); })
    .filter(function (value) { return value.length > 0; });

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
    return Array.from(new Set(fallbacks.filter(function (email) { return email && email.length > 0; })));
  }

  return Array.from(new Set(normalized));
}