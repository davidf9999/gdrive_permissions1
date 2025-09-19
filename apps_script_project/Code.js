/***** CONFIGURATION CONSTANTS *****/
const MANAGED_FOLDERS_SHEET_NAME = 'ManagedFolders';
const ADMINS_SHEET_NAME = 'Admins';
const LOG_SHEET_NAME = 'Log';
const TEST_LOG_SHEET_NAME = 'TestLog';
const USER_GROUPS_SHEET_NAME = 'UserGroups';
const CONFIG_SHEET_NAME = 'Config';
const DRY_RUN_AUDIT_LOG_SHEET_NAME = 'DryRunAuditLog';
const DEFAULT_MAX_LOG_LENGTH = 10000;

// Column mapping for the ManagedFolders sheet
const FOLDER_NAME_COL = 1;
const FOLDER_ID_COL = 2;
const ROLE_COL = 3;
const USER_SHEET_NAME_COL = 4;
const GROUP_EMAIL_COL = 5;
const LAST_SYNCED_COL = 6;
const STATUS_COL = 7;

/***** GLOBAL STATE *****/
let SCRIPT_EXECUTION_MODE = 'DEFAULT'; // Can be 'DEFAULT' or 'TEST'

/***** MENU & TRIGGERS *****/

/**
 * Adds a custom menu to the spreadsheet UI.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi(); // Declare ui here
  const menu = ui.createMenu('Permissions Manager')
      .addItem('Sync Adds', 'syncAdds')
      .addItem('Sync Deletes', 'syncDeletes')
      .addSeparator()
      .addItem('Full Sync (Add & Delete)', 'fullSync')
      .addSeparator()
      .addItem('Dry Run Audit', 'dryRunAudit')
      .addSeparator()
      .addSubMenu(ui.createMenu('Granular Sync')
          .addItem('Sync Admins', 'syncAdmins')
          .addItem('Sync User Groups', 'syncUserGroups')
          .addSeparator()
          .addItem('Sync All Folders - Adds Only', 'syncManagedFoldersAdds')
          .addItem('Sync All Folders - Deletes Only', 'syncManagedFoldersDeletes'))
      .addSeparator()
      .addSubMenu(ui.createMenu('Testing') // Use ui here
          .addItem('Run Manual Access Test', 'runManualAccessTest')
          .addItem('Run Stress Test', 'runStressTest')
          .addItem('Run Add/Delete Separation Test', 'runAddDeleteSeparationTest')
          .addSeparator()
          .addItem('Cleanup Manual Test Data', 'cleanupManualTestData')
          .addItem('Cleanup Stress Test Data', 'cleanupStressTestData')
          .addItem('Cleanup Add/Delete Test Data', 'cleanupAddDeleteSeparationTestData'))
      .addSeparator()
      .addSubMenu(ui.createMenu('Logging') // Use ui here
          .addItem('Clear All Logs', 'clearAllLogs'));

  const helpMenu = ui.createMenu('Help');
  helpMenu.addItem('User Guide', 'openUserGuide');
  helpMenu.addItem('Testing Guide', 'openTestingGuide');
  helpMenu.addItem('README', 'openReadme');
  menu.addSeparator();
  menu.addSubMenu(helpMenu);

  menu.addToUi();

  setupControlSheets_();
  setupLogSheets_();
}
