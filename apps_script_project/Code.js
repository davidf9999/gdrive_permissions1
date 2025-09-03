/***** CONFIGURATION CONSTANTS *****/
const MANAGED_FOLDERS_SHEET_NAME = 'ManagedFolders';
const ADMINS_SHEET_NAME = 'Admins';
const LOG_SHEET_NAME = 'Log';
const TEST_LOG_SHEET_NAME = 'TestLog';
const USER_GROUPS_SHEET_NAME = 'UserGroups';
const CONFIG_SHEET_NAME = 'Config';

// Column mapping for the ManagedFolders sheet
const FOLDER_NAME_COL = 1;
const FOLDER_ID_COL = 2;
const ROLE_COL = 3;
const USER_SHEET_NAME_COL = 4;
const GROUP_EMAIL_COL = 5;
const LAST_SYNCED_COL = 6;
const STATUS_COL = 7;


/***** MENU & TRIGGERS *****/

/**
 * Adds a custom menu to the spreadsheet UI.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi(); // Declare ui here
  const menu = ui.createMenu('Permissions Manager')
      .addItem('Sync Admins', 'syncAdmins')
      .addItem('Sync User Groups', 'syncUserGroups')
      .addItem('Sync All Folders', 'fullSync')
      .addItem('Sync All', 'fullSync')
      .addSeparator()
      .addSubMenu(ui.createMenu('Testing') // Use ui here
          .addItem('Run Manual Access Test', 'runManualAccessTest')
          .addItem('Run Stress Test', 'runStressTest')
          .addSeparator()
          .addItem('Cleanup Manual Test Data', 'cleanupManualTestData')
          .addItem('Cleanup Stress Test Data', 'cleanupStressTestData'))
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



/**
 * Ensures the control sheets (ManagedFolders, Admins) exist.
 */
function setupControlSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Check for ManagedFolders sheet
  let managedSheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (!managedSheet) {
    managedSheet = ss.insertSheet(MANAGED_FOLDERS_SHEET_NAME, 0);
    const headers = ['FolderName', 'FolderID', 'Role', 'UserSheetName', 'GroupEmail', 'Last Synced', 'Status'];
    managedSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    managedSheet.setFrozenRows(1);
    log_('Created "ManagedFolders" sheet.');
  }

  // Add data validation for the Role column
  const roleRange = managedSheet.getRange('C2:C');
  const existingRule = roleRange.getDataValidation();
  if (!existingRule || existingRule.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
      const rule = SpreadsheetApp.newDataValidation().requireValueInList(['Editor', 'Viewer', 'Commenter'], true).build();
      roleRange.setDataValidation(rule);
  }


  // Check for Admins sheet
  let adminSheet = ss.getSheetByName(ADMINS_SHEET_NAME);
  if (!adminSheet) {
    adminSheet = ss.insertSheet(ADMINS_SHEET_NAME);
    adminSheet.getRange('A1').setValue('Administrator Emails').setFontWeight('bold');
    adminSheet.setFrozenRows(1);
    log_('Created "Admins" sheet.');
  }
  
    // Check for UserGroups sheet
  let userGroupsSheet = ss.getSheetByName(USER_GROUPS_SHEET_NAME);
  if (!userGroupsSheet) {
    userGroupsSheet = ss.insertSheet(USER_GROUPS_SHEET_NAME);
    userGroupsSheet.getRange('A1:D1').setValues([['GroupName', 'GroupEmail', 'Last Synced', 'Status']]).setFontWeight('bold');
    userGroupsSheet.setFrozenRows(1);
    log_('Created "UserGroups" sheet.');
  }
  
  // Check for Config sheet
  let configSheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (!configSheet) {
    configSheet = ss.insertSheet(CONFIG_SHEET_NAME);
    configSheet.getRange('A1:B1').setValues([['Setting', 'Value']]).setFontWeight('bold');
    configSheet.getRange('A2:B2').setValues([['EnableEmailNotifications', 'FALSE']]);
    configSheet.getRange('A3:B3').setValues([['NotificationEmailAddress', '']]);
    configSheet.getRange('A4:B4').setValues([['EnableToasts', 'FALSE']]);
    configSheet.getRange('A5:B5').setValues([['GitHubRepoURL', 'https://github.com/davidf9999/gdrive_permissions1']]);
    configSheet.setFrozenRows(1);
    log_('Created "Config" sheet.');
  }
}

function setupLogSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Check for Log sheet
  let logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!logSheet) {
    logSheet = ss.insertSheet(LOG_SHEET_NAME);
    logSheet.getRange('A1:B1').setValues([['Timestamp', 'Message']]).setFontWeight('bold');
    logSheet.setFrozenRows(1);
  }

  // Check for TestLog sheet
  let testLogSheet = ss.getSheetByName(TEST_LOG_SHEET_NAME);
  if (!testLogSheet) {
    testLogSheet = ss.insertSheet(TEST_LOG_SHEET_NAME);
    testLogSheet.getRange('A1:B1').setValues([['Timestamp', 'Message']]).setFontWeight('bold');
    testLogSheet.setFrozenRows(1);
  }
}


/***** MAIN SYNC FUNCTIONS *****/



/**
 * Synchronizes the editors of the spreadsheet file with the list in the Admins sheet.
 */
function syncAdmins() {
  try {
    log_('Running Admin Sync...');
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ADMINS_SHEET_NAME);
    if (!sheet) {
      log_('Admins sheet not found. Skipping admin sync.');
      return;
    }

    // 1. Get the desired list of admins from the sheet
    const adminEmails = sheet.getRange('A2:A').getValues()
      .map(function(row) { return row[0].toString().trim().toLowerCase(); })
      .filter(function(email) { return email && email.length > 0; });
    const adminSet = new Set(adminEmails);

    // 2. Get the current editors of the spreadsheet file
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const currentEditors = spreadsheet.getEditors()
      .map(function(user) { return user.getEmail().toLowerCase(); });
    const editorSet = new Set(currentEditors);

    // 3. Determine who to add and who to remove
    const owner = spreadsheet.getOwner();
    if (owner) {
        adminSet.add(owner.getEmail().toLowerCase()); // The owner should always be an editor
    }
    
    const emailsToAdd = adminEmails.filter(function(email) { return !editorSet.has(email); });
    const emailsToRemove = currentEditors.filter(function(email) { return !adminSet.has(email); });

    // 4. Perform the additions and removals
    if (emailsToAdd && emailsToAdd.length > 0) {
      log_('Adding ' + emailsToAdd.length + ' admin(s): ' + emailsToAdd.join(', '));
      spreadsheet.addEditors(emailsToAdd);
    }

    if (emailsToRemove && emailsToRemove.length > 0) {
      log_('Removing ' + emailsToRemove.length + ' editor(s): ' + emailsToRemove.join(', '));
      spreadsheet.removeEditors(emailsToRemove);
    }

    log_('Admin sync complete.');

  } catch (e) {
    log_('ERROR in syncAdmins: ' + e.toString());
  }
}

function syncUserGroups() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const userGroupsSheet = ss.getSheetByName(USER_GROUPS_SHEET_NAME);
    if (!userGroupsSheet) {
      SpreadsheetApp.getUi().alert('UserGroups sheet not found.');
      return;
    }

    const lastRow = userGroupsSheet.getLastRow();
    if (lastRow < 2) {
        log_('No data rows to process in UserGroups sheet.');
        return;
    }
    
    const dataRange = userGroupsSheet.getRange(2, 1, lastRow - 1, 4); // Get range for all data rows
    const data = dataRange.getValues();

    for (let i = 0; i < data.length; i++) {
      const rowIndex = i + 2; // Sheet row index (1-based, accounting for header)
      const statusCell = userGroupsSheet.getRange(rowIndex, 4);
      const lastSyncedCell = userGroupsSheet.getRange(rowIndex, 3);
      const groupEmailCell = userGroupsSheet.getRange(rowIndex, 2);

      try {
        let groupName = data[i][0];
        let groupEmail = data[i][1];

        if (!groupName) {
          // Skip empty rows
          continue;
        }
        
        statusCell.setValue('Processing...');
        showToast_('Processing user group: ' + groupName + '...', 'Sync Progress', 10);
        log_('Processing user group: ' + groupName);

        // Generate group email if it doesn't exist
        if (!groupEmail) {
          groupEmail = generateGroupEmail_(groupName);
          groupEmailCell.setValue(groupEmail);
          log_('Generated group email for ' + groupName + ': ' + groupEmail);
        }

        // Now proceed with creating resources and syncing
        getOrCreateUserSheet_(groupName);
        getOrCreateGroup_(groupEmail, groupName);
        syncGroupMembership_(groupEmail, groupName);

        lastSyncedCell.setValue(Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss'));
        statusCell.setValue('OK');
        log_('Successfully synced user group: ' + groupName);

      } catch (e) {
        const errorMessage = 'ERROR: ' + e.message;
        log_('Failed to process user group row ' + rowIndex + '. Error: ' + e.message + ' Stack: ' + e.stack);
        statusCell.setValue(errorMessage);
      }
    }
    SpreadsheetApp.getUi().alert('User groups sync complete.');
  } catch (e) {
    const errorMessage = 'FATAL ERROR in syncUserGroups: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage);
    SpreadsheetApp.getUi().alert('A fatal error occurred during user group sync: ' + e.message);
    sendErrorNotification_(errorMessage);
  }
}

function fullSync() {
  setupControlSheets_(); // Ensure control sheets exist
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    SpreadsheetApp.getUi().alert('Sync is already in progress. Please wait a few minutes and try again.');
    return;
  }

  let summaryMessage = 'Sync process complete.';
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    showToast_('Starting full synchronization...', 'Full Sync', -1);
    log_('Starting full synchronization...');

    // 1. Sync Admins
    syncAdmins();

    // 2. Sync User Groups
    syncUserGroups();

    // 3. Process Managed Folders
    processManagedFolders_();

    // Check for any orphan sheets
    const orphanSheets = checkForOrphanSheets_();
    if (orphanSheets && orphanSheets.length > 0) {
      const orphanMessage = 'Warning: Found orphan sheets that are not in the configuration: ' + orphanSheets.join(', ');
      summaryMessage += '\n\n' + orphanMessage;
      log_(orphanMessage);
    }

    showToast_('Full synchronization complete!', 'Full Sync', 5);
    log_('Full synchronization completed.');
    SpreadsheetApp.getUi().alert(summaryMessage + '\n\nCheck the \'Status\' column in the \'ManagedFolders\' sheet for details.');

  } catch (e) {
    const errorMessage = 'FATAL ERROR in fullSync: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage);
    showToast_('Full sync failed with a fatal error.', 'Full Sync', 5);
    SpreadsheetApp.getUi().alert('A fatal error occurred: ' + e.message);
    sendErrorNotification_(errorMessage);
  } finally {
    lock.releaseLock();
  }
}


/***** CORE LOGIC *****/

/**
 * Reads the ManagedFolders sheet and processes each row.
 */
function processManagedFolders_() {
  log_('Starting processing of ManagedFolders sheet...');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('CRITICAL: Configuration sheet named "' + MANAGED_FOLDERS_SHEET_NAME + '" not found. Aborting.');
    return;
  }

  setSheetUiStyles_();

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
      log_('No data rows to process in ManagedFolders sheet.');
      return;
  }

  // Loop through each row (starting from row 2 to skip header)
  for (let i = 2; i <= lastRow; i++) {
    showToast_('Processing row ' + i + ' of ' + lastRow + '...', 'Sync Progress', 10);
    try {
      processRow_(i);
    } catch (e) {
      log_('Error processing row ' + i + ': ' + e.toString());
    }
  }
  log_('Finished processing all rows.');
}

/**
 * Processes a single row from the ManagedFolders sheet.
 * @param {number} rowIndex The index of the row to process.
 */
function processRow_(rowIndex) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  const statusCell = sheet.getRange(rowIndex, STATUS_COL);
  
  try {
    statusCell.setValue('Processing...');
    
    let folderName = sheet.getRange(rowIndex, FOLDER_NAME_COL).getValue();
    let folderId = sheet.getRange(rowIndex, FOLDER_ID_COL).getValue();
    let role = sheet.getRange(rowIndex, ROLE_COL).getValue();

    if (!folderName && !folderId) {
      throw new Error('Both FolderName and FolderID are blank.');
    }
    if (!role) {
      throw new Error('Role is not specified.');
    }

    const folder = getOrCreateFolder_(folderName, folderId);
    sheet.getRange(rowIndex, FOLDER_ID_COL).setValue(folder.getId());
    sheet.getRange(rowIndex, FOLDER_NAME_COL).setValue(folder.getName());

    const userSheetName = folder.getName() + '_' + role;
    const groupEmail = generateGroupEmail_(userSheetName);
    sheet.getRange(rowIndex, USER_SHEET_NAME_COL).setValue(userSheetName);
    sheet.getRange(rowIndex, GROUP_EMAIL_COL).setValue(groupEmail);

    getOrCreateUserSheet_(userSheetName);
    getOrCreateGroup_(groupEmail, userSheetName);

    setFolderPermission_(folder.getId(), groupEmail, role);
    syncGroupMembership_(groupEmail, userSheetName);

    sheet.getRange(rowIndex, LAST_SYNCED_COL).setValue(Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss'));
    statusCell.setValue('OK');

  } catch (e) {
    log_('Failed to process row ' + rowIndex + '. Error: ' + e.message + ' Stack: ' + e.stack);
    statusCell.setValue('Error: ' + e.message);
  }
}

/**
 * Checks for sheets that are not part of the main configuration.
 * @return {Array<string>} A list of orphan sheet names.
 */
function checkForOrphanSheets_() {
  try {
    log_('Checking for orphan sheets...');
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const allSheets = spreadsheet.getSheets();
    const allSheetNames = allSheets.map(function(s) { return s.getName(); });

    const requiredSheetNames = new Set();
    requiredSheetNames.add(MANAGED_FOLDERS_SHEET_NAME);
    requiredSheetNames.add(ADMINS_SHEET_NAME);
    requiredSheetNames.add(USER_GROUPS_SHEET_NAME);
    requiredSheetNames.add(CONFIG_SHEET_NAME);
    requiredSheetNames.add(LOG_SHEET_NAME);
    requiredSheetNames.add(TEST_LOG_SHEET_NAME);

    const managedSheet = spreadsheet.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
    if (managedSheet && managedSheet.getLastRow() > 1) {
      const userSheetNames = managedSheet.getRange(2, USER_SHEET_NAME_COL, managedSheet.getLastRow() - 1, 1).getValues();
      if (userSheetNames) {
          userSheetNames.forEach(function(row) {
            if (row[0]) requiredSheetNames.add(row[0]);
          });
      }
    }
    
    const userGroupsSheet = spreadsheet.getSheetByName(USER_GROUPS_SHEET_NAME);
    if (userGroupsSheet && userGroupsSheet.getLastRow() > 1) {
        const groupSheetNames = userGroupsSheet.getRange(2, 1, userGroupsSheet.getLastRow() - 1, 1).getValues();
        if (groupSheetNames) {
            groupSheetNames.forEach(function(row) {
                if (row[0]) requiredSheetNames.add(row[0]);
            });
        }
    }

    return allSheetNames.filter(function(name) { return !requiredSheetNames.has(name); });

  } catch (e) {
    log_('Error during orphan sheet check: ' + e.message);
    return [];
  }
}


/***** HELPER FUNCTIONS *****/

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

function getOrCreateFolder_(folderName, folderId) {
  if (folderId) {
    try {
      const folder = DriveApp.getFolderById(folderId);
      if (folderName && folder.getName() !== folderName) {
        throw new Error('Mismatch: Provided FolderID points to "' + folder.getName() + '"');
      }
      log_('Successfully found folder "' + folder.getName() + '" by ID.');
      return folder;
    } catch (e) {
      log_('Could not retrieve folder by ID ' + folderId + '. Will try searching by name.');
    }
  }

  if (!folderName) {
    throw new Error('Cannot find or create folder without a name or a valid ID.');
  }

  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    const foundFolder = folders.next();
    if (folders.hasNext()) {
      throw new Error('Ambiguous: Multiple folders exist with the name "' + folderName + '". Please specify by ID.');
    }
    log_('Successfully found folder "' + folderName + '" by name.');
    return foundFolder;
  } else {
    log_('No folder found with name "' + folderName + '". Creating it now...');
    const newFolder = DriveApp.createFolder(folderName);
    log_('Successfully created folder "' + folderName + '"');
    return newFolder;
  }
}

function getOrCreateGroup_(groupEmail, groupName) {
  try {
    AdminDirectory.Groups.get(groupEmail);
    log_('Found existing group: ' + groupEmail);
    return;
  } catch (e) {
    log_('Group "' + groupEmail + '" not found. Will attempt to create it.');
  }

  try {
    const newGroup = {
      email: groupEmail,
      name: groupName,
      description: 'Managed by Google Sheets script. Folder: ' + groupName.split('_')[0]
    };
    AdminDirectory.Groups.insert(newGroup);
    log_('Successfully created group: ' + groupEmail);
  } catch (e) {
    log_('Failed to create group ' + groupEmail + '. Error: ' + e.toString());
    throw new Error('Could not create group: ' + e.message);
  }
}

function getOrCreateUserSheet_(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (sheet) {
    return sheet;
  } else {
    log_('User sheet "' + sheetName + '" not found. Creating it...');
    sheet = spreadsheet.insertSheet(sheetName);
    
    const header = sheet.getRange('A1');
    header.setValue('User Email Address');
    header.setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    log_('Successfully created user sheet: "' + sheetName + '"');
    return sheet;
  }
}

function syncGroupMembership_(groupEmail, userSheetName) {
  log_('Starting membership sync for group "' + groupEmail + '" from sheet "' + userSheetName + '"');
  
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(userSheetName);
    if (!sheet) {
      throw new Error('User sheet "' + userSheetName + '" not found.');
    }
    const sheetEmails = sheet.getRange('A2:A' + sheet.getLastRow()).getValues()
      .map(function(row) { return row[0].toString().trim().toLowerCase(); })
      .filter(function(email) { return email && email.includes('@'); });
    const sheetSet = new Set(sheetEmails);
    log_('Found ' + sheetSet.size + ' emails in sheet "' + userSheetName + '"');

    const groupMembers = fetchAllGroupMembers_(groupEmail);
    const groupEmails = groupMembers.map(function(m) { return m.email.toLowerCase(); });
    const groupSet = new Set(groupEmails);
    log_('Found ' + groupSet.size + ' members in group "' + groupEmail + '"');

    const emailsToAdd = sheetEmails.filter(function(email) { return !groupSet.has(email); });
    const membersToRemove = groupMembers.filter(function(m) { 
      return !sheetSet.has(m.email.toLowerCase()) && m.role !== 'OWNER';
    });
    const emailsToRemove = membersToRemove.map(function(m) { return m.email; });

    if (emailsToAdd && emailsToAdd.length > 0) {
      log_('Adding ' + emailsToAdd.length + ' member(s) to ' + groupEmail);
      emailsToAdd.forEach(function(email) {
        try {
          Utilities.sleep(100); // Avoid hitting rate limits
          AdminDirectory.Members.insert({ email: email, role: 'MEMBER' }, groupEmail);
        } catch (e) {
          log_('Failed to add member ' + email + ' to group ' + groupEmail + '. Error: ' + e.message);
        }
      });
    }

    if (emailsToRemove && emailsToRemove.length > 0) {
      log_('Removing ' + emailsToRemove.length + ' member(s) from ' + groupEmail);
      emailsToRemove.forEach(function(email) {
        try {
          Utilities.sleep(100); // Avoid hitting rate limits
          AdminDirectory.Members.remove(groupEmail, email);
        } catch (e) {
          log_('Failed to remove member ' + email + ' from group ' + groupEmail + '. Error: ' + e.message);
        }
      });
    }

    log_('Membership sync complete for group "' + groupEmail + '"');

  } catch (e) {
    log_('FATAL ERROR in syncGroupMembership for group ' + groupEmail + '. Error: ' + e.toString());
    throw e;
  }
}

function fetchAllGroupMembers_(groupEmail) {
  const members = [];
  let pageToken;
  try {
      do {
        const resp = AdminDirectory.Members.list(groupEmail, { 
          maxResults: 200,
          pageToken: pageToken 
        });
        if (resp && resp.members) {
          members.push.apply(members, resp.members);
        }
        pageToken = resp ? resp.nextPageToken : null;
      } while (pageToken);
  } catch(e) {
      if (e.message.includes('Resource Not Found: groupKey')) {
          log_('Group ' + groupEmail + ' does not exist yet, returning no members.');
          return [];
      }
      throw e;
  }
  return members;
}

function setFolderPermission_(folderId, groupEmail, role) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const roleLower = role.toLowerCase();

    switch (roleLower) {
      case 'editor':
        folder.addEditor(groupEmail);
        break;
      case 'viewer':
        folder.addViewer(groupEmail);
        break;
      case 'commenter':
        folder.addCommenter(groupEmail);
        break;
      default:
        throw new Error('Unsupported role: "' + role + '"');
    }
    log_('Successfully set role "' + role + '" for group "' + groupEmail + '" on folder "' + folder.getName() + '"');

  } catch (e) {
    log_('Failed to set permission for group ' + groupEmail + ' on folder ' + folderId + '. Error: ' + e.toString());
    throw new Error('Could not set folder permission: ' + e.message);
  }
}

function setSheetUiStyles_() {
  try {
    const managedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
    if (managedSheet && managedSheet.getLastRow() >= 2) {
        const range = managedSheet.getRange(2, USER_SHEET_NAME_COL, managedSheet.getLastRow() - 1, 4);
        range.setBackground('#f3f3f3');
        const protection = range.protect().setDescription('These columns are managed by the script.');
        protection.setWarningOnly(true);
    }

    const userGroupsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USER_GROUPS_SHEET_NAME);
    if (userGroupsSheet && userGroupsSheet.getLastRow() >= 2) {
      const range = userGroupsSheet.getRange(2, 2, userGroupsSheet.getLastRow() - 1, 3);
      range.setBackground('#f3f3f3');
      const protection = range.protect().setDescription('These columns are managed by the script.');
      protection.setWarningOnly(true);
    }
  } catch (e) {
    log_('Could not apply UI styles. Error: ' + e.message);
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


/***** DEVELOPER-ONLY TEST FUNCTIONS *****/

function runManualAccessTest() {
  const ui = SpreadsheetApp.getUi();
  
  const folderName = ui.prompt('Test - Step 1/4: Folder Name', 'Enter a name for a new test folder to be created.', ui.ButtonSet.OK_CANCEL);
  if (folderName.getSelectedButton() !== ui.Button.OK || !folderName.getResponseText()) return ui.alert('Test cancelled.');
  const testFolderName = folderName.getResponseText();

  const role = ui.prompt('Test - Step 2/4: Role', 'Enter the role to test (e.g., Editor, Viewer).', ui.ButtonSet.OK_CANCEL);
  if (role.getSelectedButton() !== ui.Button.OK || !role.getResponseText()) return ui.alert('Test cancelled.');
  const testRole = role.getResponseText();

  const email = ui.prompt('Test - Step 3/4: Test Email', 'Enter a REAL email address you can access for testing (e.g., a personal Gmail).', ui.ButtonSet.OK_CANCEL);
  if (email.getSelectedButton() !== ui.Button.OK || !email.getResponseText()) return ui.alert('Test cancelled.');
  const testEmail = email.getResponseText().trim().toLowerCase();

  ui.alert('Step 4/4: Initial Setup', 'The script will now add this configuration to the ManagedFolders sheet and run the sync to create the folder, group, and user sheet. Click OK to proceed.', ui.ButtonSet.OK);
  
  const managedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  const testRowIndex = managedSheet.getLastRow() + 1;
  managedSheet.getRange(testRowIndex, FOLDER_NAME_COL).setValue(testFolderName);
  managedSheet.getRange(testRowIndex, ROLE_COL).setValue(testRole);
  
  fullSync(); // Changed from syncAll()

  const userSheetName = managedSheet.getRange(testRowIndex, USER_SHEET_NAME_COL).getValue();
  const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(userSheetName);
  if (!userSheet) return ui.alert('Test failed: Could not find the created user sheet: ' + userSheetName);
  
  userSheet.getRange('A2').setValue(testEmail);
  ui.alert('Granting Access', 'The test email has been added to the ' + userSheetName + ' sheet. The script will now sync again to grant folder access.', ui.ButtonSet.OK);
  fullSync(); // Changed from syncAll()

  const folderId = managedSheet.getRange(testRowIndex, FOLDER_ID_COL).getValue();
  const folderUrl = DriveApp.getFolderById(folderId).getUrl();
  const verification1 = ui.alert('Verify Access', 'Please open an Incognito Window, log in as ' + testEmail + ', and try to open this link:\n\n' + folderUrl + '\n\nDid you get access?', ui.ButtonSet.YES_NO);

  if (verification1 !== ui.Button.YES) {
    ui.alert('Test aborted. Please review the logs and configuration.');
    return;
  }

  userSheet.getRange('A2').clearContent();
  ui.alert('Revoking Access', 'The test email has been removed from the sheet. The script will now sync again to revoke folder access.', ui.ButtonSet.OK);
  fullSync(); // Changed from syncAll()

  const verification2 = ui.alert('Verify Revoked Access', 'Please go back to your Incognito Window and refresh the folder page. You should see a \'permission denied\' error.\n\nWas access revoked?', ui.ButtonSet.YES_NO);

  if (verification2 === ui.Button.YES) {
    ui.alert('Test Complete: SUCCESS!', 'The user was successfully granted and revoked access.', ui.ButtonSet.OK);
  } else {
    ui.alert('Test Complete: FAILURE!', 'Access was not revoked as expected. This may be due to Google Drive permission propagation delays. Please wait a few minutes and check again.', ui.ButtonSet.OK);
  }

  const cleanup = ui.alert('Cleanup', 'Do you want to remove the test row from ManagedFolders and delete the test user sheet (' + userSheetName + ')?', ui.ButtonSet.YES_NO);
  if (cleanup === ui.Button.YES) {
    managedSheet.deleteRow(testRowIndex);
    SpreadsheetApp.getActiveSpreadsheet().deleteSheet(userSheet);
    ui.alert('Cleanup complete.');
  }
}

/***** STRESS TEST FUNCTIONS *****/

/**
 * A function to test the script's performance with many folders and users.
 */
function runStressTest() {
  const ui = SpreadsheetApp.getUi();

  // --- Step 1: Get Test Parameters ---
  const numFoldersStr = ui.prompt('Stress Test - Step 1/4', 'Enter the number of temporary folders to create (e.g., 10).', ui.ButtonSet.OK_CANCEL);
  if (numFoldersStr.getSelectedButton() !== ui.Button.OK || !numFoldersStr.getResponseText()) return ui.alert('Test cancelled.');
  const numFolders = parseInt(numFoldersStr.getResponseText(), 10);

  const numUsersStr = ui.prompt('Stress Test - Step 2/4', 'Enter the number of test users to create PER FOLDER (e.g., 200).', ui.ButtonSet.OK_CANCEL);
  if (numUsersStr.getSelectedButton() !== ui.Button.OK || !numUsersStr.getResponseText()) return ui.alert('Test cancelled.');
  const numUsers = parseInt(numUsersStr.getResponseText(), 10);

  const baseEmailStr = ui.prompt('Stress Test - Step 3/4', 'Enter a base email address to generate test users (e.g., your.name@gmail.com).', ui.ButtonSet.OK_CANCEL);
  if (baseEmailStr.getSelectedButton() !== ui.Button.OK || !baseEmailStr.getResponseText()) return ui.alert('Test cancelled.');
  const baseEmail = baseEmailStr.getResponseText().trim();
  const emailParts = baseEmail.split('@');
  if (emailParts.length !== 2) return ui.alert('Invalid email address.');

  ui.alert('Stress Test - Step 4/4', 
           'The script will now create ' + numFolders + ' test folders and prepare ' + numUsers + ' users for each.\n\nThis will take several steps. Please be patient.', 
           ui.ButtonSet.OK);

  // --- Step 2: Setup Test Data ---
  const testRunId = new Date().getTime(); // Unique ID for this test run
  const folderNames = [];
  for (let i = 1; i <= numFolders; i++) {
    folderNames.push('StressTestFolder_' + testRunId + '_' + i);
  }

  const userEmails = [];
  for (let i = 1; i <= numUsers; i++) {
    userEmails.push(emailParts[0] + '+testuser' + testRunId + i + '@' + emailParts[1]);
  }

  const managedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  const startRow = managedSheet.getLastRow() + 1;
  const newConfig = folderNames.map(name => [name, '', 'Editor']);
  managedSheet.getRange(startRow, 1, newConfig.length, 3).setValues(newConfig);
  SpreadsheetApp.flush();
  
  // --- Step 3: Initial Sync to Create Infrastructure ---
  ui.alert('Setup Phase 1 Complete', 'Test folders have been added to the sheet. The script will now run a sync to create the necessary folders, groups, and user sheets.', ui.ButtonSet.OK);
  fullSync();

  // --- Step 4: Populate User Sheets ---
  ui.alert('Setup Phase 2 Complete', 'The script will now populate all of the new user sheets with the test user emails.', ui.ButtonSet.OK);
  const userSheetNames = managedSheet.getRange(startRow, USER_SHEET_NAME_COL, numFolders, 1).getValues().flat();
  const userEmailsForSheet = userEmails.map(e => [e]); // Format for setting range values

  userSheetNames.forEach(function(sheetName) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (sheet) {
      sheet.getRange(2, 1, userEmailsForSheet.length, 1).setValues(userEmailsForSheet);
    }
  });

  // --- Step 5: Run the Main Stress Test Sync ---
  ui.alert('Setup Complete. Starting Stress Test', 'All test data is in place. The script will now run the main sync and time its execution.', ui.ButtonSet.OK);
  const startTime = new Date();
  fullSync();
  const endTime = new Date();
  const durationSeconds = (endTime.getTime() - startTime.getTime()) / 1000;

  ui.alert('Stress Test Complete!', 'The sync process finished in ' + durationSeconds + ' seconds.', ui.ButtonSet.OK);

  // --- Step 6: Cleanup ---
  const cleanup = ui.alert('Cleanup', 'Do you want to remove all test data (folders, groups, sheets, and configuration rows)?', ui.ButtonSet.YES_NO);
  if (cleanup === ui.Button.YES) {
    ui.alert('Cleanup in Progress', 'This may take a few moments. Please wait for the confirmation alert.', ui.ButtonSet.OK);
    const groupEmails = managedSheet.getRange(startRow, GROUP_EMAIL_COL, numFolders, 1).getValues().flat();
    const folderIds = managedSheet.getRange(startRow, FOLDER_ID_COL, numFolders, 1).getValues().flat();

    // Delete rows from sheet first
    managedSheet.deleteRows(startRow, numFolders);

    userSheetNames.forEach(function(sheetName) {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
      if (sheet) SpreadsheetApp.getActiveSpreadsheet().deleteSheet(sheet);
    });

    groupEmails.forEach(function(groupEmail) { 
      try { AdminDirectory.Groups.remove(groupEmail); } catch (e) { logTest_('Could not remove group ' + groupEmail + ': ' + e.message); }
    });

    folderIds.forEach(function(folderId) { 
      try { DriveApp.getFolderById(folderId).setTrashed(true); } catch (e) { logTest_('Could not trash folder ' + folderId + ': ' + e.message); }
    });

    ui.alert('Cleanup Complete!');
  }
}

function cleanupStressTestData() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('Are you sure you want to delete all stress test data?', 'This will delete all folders, groups, and sheets with the "StressTestFolder_" prefix.', ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) {
    return;
  }

  ui.alert('Cleanup in Progress', 'This may take a few moments. Please wait for the confirmation alert.', ui.ButtonSet.OK);

  // Clean up sheets
  const allSheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  allSheets.forEach(function(sheet) {
    if (sheet.getName().startsWith('StressTestFolder_')) {
      SpreadsheetApp.getActiveSpreadsheet().deleteSheet(sheet);
    }
  });

  // Clean up groups
  let pageToken;
  let allGroups = [];
  do {
    const result = AdminDirectory.Groups.list({
      customer: 'my_customer',
      maxResults: 200,
      pageToken: pageToken
    });
    allGroups = allGroups.concat(result.groups);
    pageToken = result.nextPageToken;
  } while (pageToken);

  allGroups.forEach(function(group) {
    if (group.name.startsWith('StressTestFolder_')) {
      try {
        AdminDirectory.Groups.remove(group.email);
      } catch (e) {
        logTest_('Could not remove group ' + group.email + ': ' + e.message);
      }
    }
  });

  // Clean up folders
  const folders = DriveApp.getFolders();
  while (folders.hasNext()) {
    const folder = folders.next();
    if (folder.getName().startsWith('StressTestFolder_')) {
      try {
        folder.setTrashed(true);
      } catch (e) {
        logTest_('Could not trash folder ' + folder.getId() + ': ' + e.message);
      }
    }
  }

  ui.alert('Cleanup Complete!');
}

function cleanupManualTestData() {
  const ui = SpreadsheetApp.getUi();
  const folderNamePrompt = ui.prompt('Enter the name of the manual test folder to clean up:');
  if (folderNamePrompt.getSelectedButton() !== ui.Button.OK || !folderNamePrompt.getResponseText()) {
    return;
  }
  const folderName = folderNamePrompt.getResponseText();

  const managedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  const data = managedSheet.getDataRange().getValues();
  let rowIndexToDelete = -1;
  let folderId, groupEmail, userSheetName;

  for (let i = 1; i < data.length; i++) {
    if (data[i][FOLDER_NAME_COL - 1] === folderName) {
      rowIndexToDelete = i + 1;
      folderId = data[i][FOLDER_ID_COL - 1];
      groupEmail = data[i][GROUP_EMAIL_COL - 1];
      userSheetName = data[i][USER_SHEET_NAME_COL - 1];
      break;
    }
  }

  if (rowIndexToDelete === -1) {
    ui.alert('Folder not found in the ManagedFolders sheet.');
    return;
  }

  const response = ui.alert('Are you sure you want to delete the test data for folder "' + folderName + '"?', 'This will delete the folder, group, and sheet.', ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) {
    return;
  }

  ui.alert('Cleanup in Progress', 'This may take a few moments. Please wait for the confirmation alert.', ui.ButtonSet.OK);

  // Delete folder
  if (folderId) {
    try {
      DriveApp.getFolderById(folderId).setTrashed(true);
    } catch (e) {
      logTest_('Could not trash folder ' + folderId + ': ' + e.message);
    }
  }

  // Delete group
  if (groupEmail) {
    try {
      AdminDirectory.Groups.remove(groupEmail);
    } catch (e) {
      logTest_('Could not remove group ' + groupEmail + ': ' + e.message);
    }
  }

  // Delete sheet
  if (userSheetName) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(userSheetName);
    if (sheet) {
      SpreadsheetApp.getActiveSpreadsheet().deleteSheet(sheet);
    }
  }

  // Delete row
  managedSheet.deleteRow(rowIndexToDelete);

  ui.alert('Cleanup Complete!');
}

function log_(message) {
  const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOG_SHEET_NAME);
  if (logSheet) {
    logSheet.appendRow([new Date(), message]);
  }
}

function logTest_(message) {
  const testLogSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TEST_LOG_SHEET_NAME);
  if (testLogSheet) {
    testLogSheet.appendRow([new Date(), message]);
  }
}

function clearLogs() {
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
    log_('Failed to send error notification email: ' + e.toString());
  }
}

function getGitHubRepoUrl_() {
    const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET_NAME);
    if (configSheet) {
        const settings = configSheet.getRange('A2:B').getValues();
        for (let i = 0; i < settings.length; i++) {
            if (settings[i][0] === 'GitHubRepoURL') {
                return settings[i][1];
            }
        }
    }
    return null;
}

function openUserGuide() {
    const repoUrl = getGitHubRepoUrl_();
    if (repoUrl) {
        openUrl(repoUrl + '/blob/main/docs/USER_GUIDE.md');
    }
}

function openTestingGuide() {
    const repoUrl = getGitHubRepoUrl_();
    if (repoUrl) {
        openUrl(repoUrl + '/blob/main/TESTING.md');
    }
}

function openReadme() {
    const repoUrl = getGitHubRepoUrl_();
    if (repoUrl) {
        openUrl(repoUrl + '/blob/main/README.md');
    }
}

function openUrl(url) {
  log_('Attempting to open URL: ' + url);
  const html = '<html><body><a href="' + url + '" target="_blank">Click here to open the documentation</a><br/><br/><input type="button" value="Close" onclick="google.script.host.close()" /></body></html>';
  const ui = HtmlService.createHtmlOutput(html).setTitle('Open Documentation').setWidth(300);
  SpreadsheetApp.getUi().showSidebar(ui);
}
