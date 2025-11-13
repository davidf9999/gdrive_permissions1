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
    buildRestrictedMenu_(menu, ui);
  }

  menu.addToUi();

  setupControlSheets_();
  setupLogSheets_();
  updateAutoSyncStatusIndicator_();

  if (superAdmin) {
    applyFullView_();
    updateControlSheetModeIndicator_('FULL');
  } else {
    applyRestrictedView_();
    updateControlSheetModeIndicator_('RESTRICTED');
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

function buildRestrictedMenu_(menu, ui) {
  menu.addItem('View Mode: Restricted', 'showRestrictedModeInfo_');
  menu.addSeparator();
  menu.addSubMenu(createHelpMenu_(ui));
}

function showRestrictedModeInfo_() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      'Restricted Mode',
      'You have view-only access to control sheets. Contact a listed super admin if you need to run sync, audit, or test actions.',
      ui.ButtonSet.OK
    );
  } catch (e) {
    log_('Unable to show restricted mode dialog: ' + e.message, 'WARN');
  }
}

function createManualSyncMenu_(ui) {
  const granularMenu = ui.createMenu('Granular Sync')
    .addItem('Sync Admins', 'syncAdmins')
    .addItem('Sync User Groups', 'syncUserGroups')
    .addSeparator()
    .addItem('Sync All Folders - Adds Only', 'syncManagedFoldersAdds')
    .addItem('Sync All Folders - Deletes Only', 'syncManagedFoldersDeletes');

  return ui.createMenu('Manual-Sync')
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

  return ui.createMenu('Auto-Sync')
    .addItem('⚡ Setup Auto-Sync', 'setupAutoSync')
    .addSeparator()
    .addItem('▶️ Run Auto-Sync Now', 'runAutoSyncNow')
    .addSeparator()
    .addItem('📊 View Trigger Status', 'viewTriggerStatus')
    .addItem('🛑 Disable Auto-Sync', 'removeAutoSync')
    .addSeparator()
    .addSubMenu(editModeMenu);
}

function createAuditsMenu_(ui) {
  return ui.createMenu('Audits')
    .addItem('Folders Audit', 'foldersAudit')
    .addItem('Deep Folder Audit', 'deepAuditFolder');
}

function createTestingMenu_(ui) {
  return ui.createMenu('Testing')
    .addItem('Run All Tests', 'runAllTests')
    .addSeparator()
    .addItem('Run Manual Access Test', 'runManualAccessTest')
    .addItem('Run Stress Test', 'runStressTest')
    .addItem('Run Add/Delete Separation Test', 'runAddDeleteSeparationTest')
    .addItem('Run Auto-Sync Error Email Test', 'runAutoSyncErrorEmailTest')
    .addItem('Run Email Capability Test', 'runEmailCapabilityTest')
    .addItem('Run Sheet Locking Test', 'runSheetLockingTest_')
    .addItem('Run Circular Dependency Test', 'runCircularDependencyTest_')
    .addSeparator()
    .addItem('Cleanup Manual Test Data', 'cleanupManualTestData')
    .addItem('Cleanup Stress Test Data', 'cleanupStressTestData')
    .addItem('Cleanup Add/Delete Test Data', 'cleanupAddDeleteSeparationTestData')
    .addSeparator()
    .addItem('Clear All Test Data', 'clearAllTestsData');
}

function createLoggingMenu_(ui) {
  return ui.createMenu('Logging')
    .addItem('Clear Auxiliary Logs (Keep Main Log)', 'clearAuxiliaryLogs')
    .addItem('Clear All Logs', 'clearAllLogs');
}

function createAdvancedMenu_(ui) {
  const menu = ui.createMenu('Advanced')
    .addItem('Clear Cache', 'clearCache')
    .addItem('Update User Sheet Headers', 'updateUserSheetHeaders_')
    .addSeparator()
    .addItem('Clean up folder...', 'cleanupFolderByName')
    .addItem('Remove Blank Rows', 'removeBlankRows');

  if (typeof applyConfigValidation_ === 'function') {
    menu.addSeparator();
    menu.addItem('Refresh Config GUI', 'applyConfigValidation_');
  }

  return menu;
}

function createHelpMenu_(ui) {
  return ui.createMenu('Help')
    .addItem('User Guide', 'openUserGuide')
    .addItem('Testing Guide', 'openTestingGuide')
    .addItem('README', 'openReadme');
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
    ss.getSheets().forEach(function(sheet) {
      const name = sheet.getName();
      if (shouldHideSheetForRestrictedView_(name, visibilityConfig) && typeof sheet.showSheet === 'function') {
        try {
          if (sheet.isSheetHidden()) {
            sheet.showSheet();
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
function detectAutoSyncChangesCore_() {
  const props = PropertiesService.getDocumentProperties();
  let previousSnapshot = null;

  try {
    const rawSnapshot = props.getProperty(AUTO_SYNC_CHANGE_SIGNATURE_KEY);
    if (rawSnapshot) {
      previousSnapshot = JSON.parse(rawSnapshot);
    }
  } catch (e) {
    log_('Failed to parse previous auto-sync snapshot: ' + e.message, 'WARN');
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const currentDataHash = typeof calculateDataHash_ === 'function' ? calculateDataHash_() : null;

  const folderStates = {};
  const folderIds = new Set();
  let hadFolderErrors = false;

  const managedSheet = spreadsheet.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (managedSheet && managedSheet.getLastRow() > 1) {
    const idValues = managedSheet.getRange(2, FOLDER_ID_COL, managedSheet.getLastRow() - 1, 1).getValues();
    idValues.forEach(function(row) {
      if (row && row[0]) {
        const id = row[0].toString().trim();
        if (id) {
          folderIds.add(id);
        }
      }
    });
  }

  folderIds.forEach(function(id) {
    try {
      const folder = DriveApp.getFolderById(id);
      const lastUpdated = folder.getLastUpdated();
      folderStates[id] = lastUpdated ? lastUpdated.getTime() : null;
    } catch (e) {
      hadFolderErrors = true;
      folderStates[id] = previousSnapshot && previousSnapshot.folderStates && previousSnapshot.folderStates.hasOwnProperty(id)
        ? previousSnapshot.folderStates[id]
        : null;
      log_('Change detection: unable to read folder ' + id + ': ' + e.message, 'WARN');
    }
  });

  let shouldRun = false;
  const reasons = [];

  if (!previousSnapshot) {
    shouldRun = true;
    reasons.push('No previous auto-sync snapshot was found.');
  }

  const previousDataHash = previousSnapshot ? previousSnapshot.dataHash : null;
  if (currentDataHash !== previousDataHash) {
    shouldRun = true;
    reasons.push('Sheet data has changed.');
    if (previousDataHash) {
      log_('Data hash mismatch. Previous: ' + previousDataHash + ', Current: ' + currentDataHash, 'INFO');
    }
  }

  folderIds.forEach(function(id) {
    const currentTimestamp = folderStates[id];
    const previousTimestamp = previousSnapshot && previousSnapshot.folderStates
      ? previousSnapshot.folderStates[id]
      : undefined;

    if (typeof previousTimestamp === 'undefined') {
      shouldRun = true;
      reasons.push('New managed folder detected (' + id + ').');
      return;
    }

    if (currentTimestamp === null && previousTimestamp !== null) {
      shouldRun = true;
      reasons.push('Folder ' + id + ' is no longer accessible.');
      return;
    }

    if (currentTimestamp !== null && previousTimestamp === null) {
      shouldRun = true;
      reasons.push('Folder ' + id + ' became accessible again.');
      return;
    }

    if (currentTimestamp !== previousTimestamp) {
      shouldRun = true;
      reasons.push('Folder ' + id + ' modified at ' + new Date(currentTimestamp).toISOString() + '.');
    }
  });

  if (previousSnapshot && previousSnapshot.folderStates) {
    Object.keys(previousSnapshot.folderStates).forEach(function(id) {
      if (!folderIds.has(id)) {
        shouldRun = true;
        reasons.push('Managed folder removed (' + id + ').');
      }
    });
  }

  let spreadsheetTimestamp = null;
  try {
    const spreadsheetFile = DriveApp.getFileById(spreadsheet.getId());
    const lastUpdated = spreadsheetFile.getLastUpdated();
    spreadsheetTimestamp = lastUpdated ? lastUpdated.getTime() : null;
  } catch (e) {
    spreadsheetTimestamp = previousSnapshot && previousSnapshot.spreadsheetLastUpdated
      ? previousSnapshot.spreadsheetLastUpdated
      : null;
    log_('Change detection: unable to read spreadsheet metadata: ' + e.message, 'WARN');
  }

  if (previousSnapshot && previousSnapshot.spreadsheetLastUpdated !== spreadsheetTimestamp) {
    shouldRun = true;
    reasons.push('Spreadsheet metadata changed.');
  }

  if (hadFolderErrors && previousSnapshot) {
    const missingFolders = Object.keys(previousSnapshot.folderStates || {}).filter(function(id) {
      return !folderStates.hasOwnProperty(id);
    });
    if (missingFolders.length) {
      shouldRun = true;
      reasons.push('Some folders could not be checked for changes (' + missingFolders.join(', ') + ').');
    }
  }

  const snapshot = {
    dataHash: currentDataHash,
    folderStates: folderStates,
    spreadsheetLastUpdated: spreadsheetTimestamp,
    capturedAt: new Date().toISOString()
  };

  try {
    props.setProperty(AUTO_SYNC_CHANGE_SIGNATURE_KEY, JSON.stringify(snapshot));
  } catch (e) {
    log_('Failed to store auto-sync snapshot: ' + e.message, 'WARN');
  }

  return {
    shouldRun: shouldRun,
    reasons: reasons,
    snapshot: snapshot
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

function updateControlSheetModeIndicator_(mode) {
  if (typeof updateConfigSetting_ !== 'function') {
    return;
  }

  let email = '';
  try {
    email = getActiveUserEmail_();
  } catch (e) {
    email = '';
  }

  const value = email ? mode + ' - ' + email : mode;

  try {
    updateConfigSetting_('ControlSheetMode', value);
  } catch (e) {
    log_('Could not update ControlSheetMode indicator: ' + e.message, 'WARN');
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
