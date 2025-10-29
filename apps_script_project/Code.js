/***** CONFIGURATION CONSTANTS *****/
const MANAGED_FOLDERS_SHEET_NAME = 'ManagedFolders';
const ADMINS_SHEET_NAME = 'Admins';
const LOG_SHEET_NAME = 'Log';
const TEST_LOG_SHEET_NAME = 'TestLog';
const USER_GROUPS_SHEET_NAME = 'UserGroups';
const CONFIG_SHEET_NAME = 'Config';
const DRY_RUN_AUDIT_LOG_SHEET_NAME = 'FoldersAuditLog';
const DEFAULT_MAX_LOG_LENGTH = 10000;

// Column mapping for the ManagedFolders sheet
const FOLDER_NAME_COL = 1;
const FOLDER_ID_COL = 2;
const ROLE_COL = 3;
const USER_SHEET_NAME_COL = 4;
const GROUP_EMAIL_COL = 5;
const LAST_SYNCED_COL = 6;
const STATUS_COL = 7;

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
  const ui = SpreadsheetApp.getUi(); // Declare ui here
  const menu = ui.createMenu('Permissions Manager')
      .addSubMenu(ui.createMenu('Manual-Sync')
          .addItem('Full Sync (Add & Delete)', 'fullSync')
          .addItem('Sync Adds', 'syncAdds')
          .addItem('Sync Deletes', 'syncDeletes')
          .addSeparator()
          .addSubMenu(ui.createMenu('Granular Sync')
              .addItem('Sync Admins', 'syncAdmins')
              .addItem('Sync User Groups', 'syncUserGroups')
              .addSeparator()
              .addItem('Sync All Folders - Adds Only', 'syncManagedFoldersAdds')
              .addItem('Sync All Folders - Deletes Only', 'syncManagedFoldersDeletes')))
      .addSeparator()
      .addSubMenu(ui.createMenu('Auto-Sync')
          .addItem('⚡ Setup Auto-Sync (Hourly)', 'setupAutoSync')
          .addItem('📅 Setup Daily Sync', 'setupDailySync')
          .addItem('⚙️ Setup Custom Interval', 'setupCustomIntervalSync')
          .addSeparator()
          .addItem('▶️ Run Manual Sync Now', 'manualSync')
          .addSeparator()
          .addItem('📊 View Trigger Status', 'viewTriggerStatus')
          .addItem('🛑 Disable Auto-Sync', 'removeAutoSync')
          .addSeparator()
          .addSubMenu(ui.createMenu('Edit Mode')
              .addItem('🔒 Enter Edit Mode', 'enterEditMode')
              .addItem('🔓 Exit Edit Mode', 'exitEditMode')
              .addSeparator()
              .addItem('📊 View Edit Mode Status', 'viewEditModeStatus')))
      .addSeparator()
      .addSubMenu(ui.createMenu('Audits')
          .addItem('Folders Audit', 'dryRunAudit')
          .addItem('Deep Folder Audit', 'deepAuditFolder'))
      .addSeparator()
      .addSubMenu(ui.createMenu('Testing') // Use ui here
          .addItem('Run All Tests', 'runAllTests')
          .addSeparator()
          .addItem('Run Manual Access Test', 'runManualAccessTest')
          .addItem('Run Stress Test', 'runStressTest')
          .addItem('Run Add/Delete Separation Test', 'runAddDeleteSeparationTest')
          .addSeparator()
          .addItem('Cleanup Manual Test Data', 'cleanupManualTestData')
          .addItem('Cleanup Stress Test Data', 'cleanupStressTestData')
          .addItem('Cleanup Add/Delete Test Data', 'cleanupAddDeleteSeparationTestData')
          .addSeparator()
          .addItem('Clear All Test Data', 'clearAllTestsData'))
      .addSeparator()
      .addSubMenu(ui.createMenu('Logging') // Use ui here
          .addItem('Clear Auxiliary Logs (Keep Main Log)', 'clearAuxiliaryLogs')
          .addItem('Clear All Logs', 'clearAllLogs'));

  const advancedMenu = ui.createMenu('Advanced');
  advancedMenu.addItem('Clear Cache', 'clearCache');

  const helpMenu = ui.createMenu('Help');
  helpMenu.addItem('User Guide', 'openUserGuide');
  helpMenu.addItem('Testing Guide', 'openTestingGuide');
  helpMenu.addItem('README', 'openReadme');

  menu.addSeparator();
  menu.addSubMenu(advancedMenu);
  menu.addSeparator();
  menu.addSubMenu(helpMenu);

  menu.addToUi();

  setupControlSheets_();
  setupLogSheets_();
}
