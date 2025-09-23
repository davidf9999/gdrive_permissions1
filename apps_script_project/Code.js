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
 * Adds a custom menu to the spreadsheet UI to launch the sidebar.
 */
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Permissions Manager')
      .addItem('Show Controls', 'showSidebar')
      .addToUi();
  
  // Still run setup on open
  setupControlSheets_();
  setupLogSheets_();
}

/**
 * Displays the main sidebar UI.
 */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
      .setTitle('Permissions Manager')
      .setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}
