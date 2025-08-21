/***** CONFIGURATION CONSTANTS *****/
const MANAGED_FOLDERS_SHEET_NAME = 'ManagedFolders';
const ADMINS_SHEET_NAME = 'Admins';

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
  SpreadsheetApp.getUi()
    .createMenu('Permissions Manager')
    .addItem('Sync All Folders Now', 'syncAll')
    .addSeparator()
    .addItem('Run Manual Access Test', 'runManualAccessTest')
    .addSeparator()
    .addItem('Sync Admins', 'syncAdmins')
    .addToUi();
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
    Logger.log('Created "ManagedFolders" sheet.');
  }

  // Check for Admins sheet
  let adminSheet = ss.getSheetByName(ADMINS_SHEET_NAME);
  if (!adminSheet) {
    adminSheet = ss.insertSheet(ADMINS_SHEET_NAME);
    adminSheet.getRange('A1').setValue('Administrator Emails').setFontWeight('bold');
    adminSheet.setFrozenRows(1);
    Logger.log('Created "Admins" sheet.');
  }
}


/***** MAIN SYNC FUNCTIONS *****/

/**
 * Main function to sync all configured folders and groups.
 * This is the primary entry point to be called from the menu.
 */
function syncAll() {
  setupControlSheets_(); // Ensure control sheets exist
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) { // Try to lock for 15 seconds
    SpreadsheetApp.getUi().alert('Sync is already in progress. Please wait a few minutes and try again.');
    return;
  }

  let summaryMessage = 'Sync process complete.';

  try {
    Logger.log('Starting full sync process...');
    
    // 1. Sync Admins first to ensure the sheet itself is secure
    syncAdmins();

    // 2. Process all the configured folders
    processManagedFolders();

    // 3. Check for any orphan sheets
    const orphanSheets = checkForOrphanSheets_();
    if (orphanSheets.length > 0) {
      const orphanMessage = 'Warning: Found orphan sheets that are not in the configuration: ' + orphanSheets.join(', ');
      summaryMessage += '\n' + orphanMessage;
      Logger.log(orphanMessage);
    }

    Logger.log('Full sync process completed.');
    SpreadsheetApp.getUi().alert(summaryMessage + '\nCheck the Status column in the ManagedFolders sheet for details.');

  } catch (e) {
    Logger.log('FATAL ERROR in syncAll: ' + e.toString() + '\n' + e.stack);
    SpreadsheetApp.getUi().alert('A fatal error occurred: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Synchronizes the editors of the spreadsheet file with the list in the Admins sheet.
 */
function syncAdmins() {
  try {
    Logger.log('Running Admin Sync...');
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ADMINS_SHEET_NAME);
    if (!sheet) {
      Logger.log('Admins sheet not found. Skipping admin sync.');
      return;
    }

    // 1. Get the desired list of admins from the sheet
    const adminEmails = sheet.getRange('A2:A').getValues()
      .map(function(row) { return row[0].toString().trim().toLowerCase(); })
      .filter(function(email) { return email.length > 0; });
    const adminSet = new Set(adminEmails);

    // 2. Get the current editors of the spreadsheet file
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const currentEditors = spreadsheet.getEditors()
      .map(function(user) { return user.getEmail().toLowerCase(); });
    const editorSet = new Set(currentEditors);

    // 3. Determine who to add and who to remove
    const owner = spreadsheet.getOwner().getEmail().toLowerCase();
    adminSet.add(owner); // The owner should always be an editor

    const emailsToAdd = adminEmails.filter(function(email) { return !editorSet.has(email); });
    const emailsToRemove = currentEditors.filter(function(email) { return !adminSet.has(email); });

    // 4. Perform the additions and removals
    if (emailsToAdd.length > 0) {
      Logger.log('Adding ' + emailsToAdd.length + ' admin(s): ' + emailsToAdd.join(', '));
      spreadsheet.addEditors(emailsToAdd);
    }

    if (emailsToRemove.length > 0) {
      Logger.log('Removing ' + emailsToRemove.length + ' editor(s): ' + emailsToRemove.join(', '));
      spreadsheet.removeEditors(emailsToRemove);
    }

    Logger.log('Admin sync complete.');

  } catch (e) {
    Logger.log('ERROR in syncAdmins: ' + e.toString());
    // We don't show a UI alert here to avoid interrupting the main sync flow
  }
}


/***** CORE LOGIC *****/

/**
 * Reads the ManagedFolders sheet and processes each row.
 */
function processManagedFolders() {
  Logger.log('Starting processing of ManagedFolders sheet...');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('CRITICAL: Configuration sheet named "' + MANAGED_FOLDERS_SHEET_NAME + '" not found. Aborting.');
    return;
  }

  // Set UI styles first (e.g., grey background, protection)
  setSheetUiStyles();

  const lastRow = sheet.getLastRow();
  // Loop through each row (starting from row 2 to skip header)
  for (let i = 2; i <= lastRow; i++) {
    try {
      processRow(i);
    } catch (e) {
      Logger.log('Error processing row ' + i + ': ' + e.toString());
      // The error should be logged to the status column within processRow
    }
  }
  Logger.log('Finished processing all rows.');
}

/**
 * Processes a single row from the ManagedFolders sheet.
 * @param {number} rowIndex The index of the row to process.
 */
function processRow(rowIndex) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  const statusCell = sheet.getRange(rowIndex, STATUS_COL);
  
  try {
    statusCell.setValue('Processing...');
    
    let folderName = sheet.getRange(rowIndex, FOLDER_NAME_COL).getValue();
    let folderId = sheet.getRange(rowIndex, FOLDER_ID_COL).getValue();
    let role = sheet.getRange(rowIndex, ROLE_COL).getValue();

    // Step 1: Validate initial inputs
    if (!folderName && !folderId) {
      throw new Error('Both FolderName and FolderID are blank.');
    }
    if (!role) {
      throw new Error('Role is not specified.');
    }

    // Step 2: Get or Create the folder
    const folder = getOrCreateFolder(folderName, folderId);
    // Update sheet with correct ID and Name
    sheet.getRange(rowIndex, FOLDER_ID_COL).setValue(folder.getId());
    sheet.getRange(rowIndex, FOLDER_NAME_COL).setValue(folder.getName());

    // Step 3: Deduce and write names
    const userSheetName = folder.getName() + '_' + role;
    const groupEmail = generateGroupEmail(userSheetName);
    sheet.getRange(rowIndex, USER_SHEET_NAME_COL).setValue(userSheetName);
    sheet.getRange(rowIndex, GROUP_EMAIL_COL).setValue(groupEmail);

    // Step 4: Get or Create the supporting assets
    getOrCreateUserSheet(userSheetName);
    getOrCreateGroup(groupEmail, userSheetName); // Assuming group name is based on userSheetName

    // Step 5: Set permissions and sync members
    setFolderPermission(folder.getId(), groupEmail, role);
    syncGroupMembership(groupEmail, userSheetName);

    // Step 6: Finalize status
    sheet.getRange(rowIndex, LAST_SYNCED_COL).setValue(new Date());
    statusCell.setValue('OK');

  } catch (e) {
    Logger.log('Failed to process row ' + rowIndex + '. Error: ' + e.message);
    statusCell.setValue('Error: ' + e.message);
  }
}

/**
 * Checks for sheets that are not part of the main configuration.
 */
function checkForOrphanSheets() {
  try {
    Logger.log('Checking for orphan sheets...');
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const allSheets = spreadsheet.getSheets();
    const allSheetNames = allSheets.map(function(s) { return s.getName(); });

    // 1. Build a set of all required sheet names
    const requiredSheetNames = new Set();
    requiredSheetNames.add(MANAGED_FOLDERS_SHEET_NAME);
    requiredSheetNames.add(ADMINS_SHEET_NAME);

    const managedSheet = spreadsheet.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
    if (managedSheet && managedSheet.getLastRow() > 1) {
      const userSheetNames = managedSheet.getRange(2, USER_SHEET_NAME_COL, managedSheet.getLastRow() - 1, 1).getValues();
      userSheetNames.forEach(function(row) {
        if (row[0]) requiredSheetNames.add(row[0]);
      });
    }

    // 2. Find the difference
    const orphanSheets = allSheetNames.filter(function(name) { return !requiredSheetNames.has(name); });

    // 3. Report if any orphans are found
    if (orphanSheets.length > 0) {
      Logger.log('Found orphan sheets: ' + orphanSheets.join(', '));
      const warningMessage = 'Warning: Found orphan sheets: ' + orphanSheets.join(', ');
      
      // Append the warning to the status of the first data row for visibility
      if (managedSheet && managedSheet.getLastRow() > 1) {
        const statusCell = managedSheet.getRange(2, STATUS_COL);
        const currentStatus = statusCell.getValue();
        statusCell.setValue(currentStatus + ' ' + warningMessage);
        statusCell.setFontColor('#b8860b'); // Dark yellow
      }
    }
  } catch (e) {
    Logger.log('Error during orphan sheet check: ' + e.message);
  }
}


/***** HELPER FUNCTIONS - TO BE IMPLEMENTED *****/

// Placeholder functions for various tasks.
// These will be implemented in subsequent steps.

function getOrCreateFolder(folderName, folderId) {
  // 1. If an ID is provided, try it first.
  if (folderId) {
    try {
      const folder = DriveApp.getFolderById(folderId);
      // Verify that the name matches, if a name was also provided.
      if (folderName && folder.getName() !== folderName) {
        throw new Error('Mismatch: Provided FolderID points to "' + folder.getName() + '"');
      }
      Logger.log('Successfully found folder "' + folder.getName() + '" by ID.');
      return folder;
    } catch (e) {
      Logger.log('Could not retrieve folder by ID ' + folderId + '. It may be deleted or access is denied. Will try searching by name.');
    }
  }

  // 2. If no valid ID was provided, search by name.
  if (!folderName) {
    throw new Error('Cannot find or create folder without a name or a valid ID.');
  }

  const folders = DriveApp.getFoldersByName(folderName);
  let foundFolder = null;

  if (folders.hasNext()) {
    foundFolder = folders.next();
    if (folders.hasNext()) {
      // If there is more than one folder with the same name, it's ambiguous.
      throw new Error('Ambiguous: Multiple folders exist with the name "' + folderName + '". Please specify by ID.');
    }
    Logger.log('Successfully found folder "' + folderName + '" by name.');
    return foundFolder;
  } else {
    // 3. If no folder was found, create it.
    Logger.log('No folder found with name "' + folderName + '". Creating it now...');
    const newFolder = DriveApp.createFolder(folderName);
    Logger.log('Successfully created folder "' + folderName + '".');
    return newFolder;
  }
}

function getOrCreateGroup(groupEmail, groupName) {
  try {
    // 1. Check if the group already exists
    AdminDirectory.Groups.get(groupEmail);
    Logger.log('Found existing group: ' + groupEmail);
    return;
  } catch (e) {
    // This error is expected if the group doesn't exist.
    Logger.log('Group "' + groupEmail + '" not found. Will attempt to create it.');
  }

  // 2. If the group doesn't exist, create it.
  try {
    const newGroup = {
      email: groupEmail,
      name: groupName,
      description: 'Managed by Google Sheets script. Folder: ' + groupName.split('_')[0]
    };
    AdminDirectory.Groups.insert(newGroup);
    Logger.log('Successfully created group: ' + groupEmail);
  } catch (e) {
    Logger.log('Failed to create group ' + groupEmail + '. Error: ' + e.toString());
    throw new Error('Could not create group: ' + e.message);
  }
}

function getOrCreateUserSheet(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (sheet) {
    Logger.log('Found existing user sheet: "' + sheetName + '"');
    return sheet;
  } else {
    Logger.log('User sheet "' + sheetName + '" not found. Creating it...');
    sheet = spreadsheet.insertSheet(sheetName);
    
    // Set up the header
    const header = sheet.getRange('A1');
    header.setValue('User Email Address');
    header.setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    Logger.log('Successfully created user sheet: "' + sheetName + '"');
    return sheet;
  }
}

function syncGroupMembership(groupEmail, userSheetName) {
  Logger.log('Starting membership sync for group "' + groupEmail + '" from sheet "' + userSheetName + '"');
  
  try {
    // 1. Get emails from the specified user sheet
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(userSheetName);
    if (!sheet) {
      throw new Error('User sheet "' + userSheetName + '" not found.');
    }
    const sheetEmails = sheet.getRange('A2:A' + sheet.getLastRow()).getValues()
      .map(function(row) { return row[0].toString().trim().toLowerCase(); })
      .filter(function(email) { return email.includes('@'); });
    const sheetSet = new Set(sheetEmails);
    Logger.log('Found ' + sheetSet.size + ' emails in sheet "' + userSheetName + '"');

    // 2. Get current group members
    const groupMembers = fetchAllGroupMembers_(groupEmail);
    const groupEmails = groupMembers.map(function(m) { return m.email.toLowerCase(); });
    const groupSet = new Set(groupEmails);
    Logger.log('Found ' + groupSet.size + ' members in group "' + groupEmail + '"');

    // 3. Determine who to add and remove
    const emailsToAdd = sheetEmails.filter(function(email) { return !groupSet.has(email); });
    const membersToRemove = groupMembers.filter(function(m) { 
      return !sheetSet.has(m.email.toLowerCase()) && m.role !== 'OWNER';
    });
    const emailsToRemove = membersToRemove.map(function(m) { return m.email; });

    // 4. Execute additions
    if (emailsToAdd.length > 0) {
      Logger.log('Adding ' + emailsToAdd.length + ' member(s) to ' + groupEmail + ': ' + emailsToAdd.join(', '));
      emailsToAdd.forEach(function(email) {
        try {
          AdminDirectory.Members.insert({ email: email, role: 'MEMBER' }, groupEmail);
        } catch (e) {
          Logger.log('Failed to add member ' + email + ' to group ' + groupEmail + '. Error: ' + e.message);
        }
      });
    }

    // 5. Execute removals
    if (emailsToRemove.length > 0) {
      Logger.log('Removing ' + emailsToRemove.length + ' member(s) from ' + groupEmail + ': ' + emailsToRemove.join(', '));
      emailsToRemove.forEach(function(email) {
        try {
          AdminDirectory.Members.remove(groupEmail, email);
        } catch (e) {
          Logger.log('Failed to remove member ' + email + ' from group ' + groupEmail + '. Error: ' + e.message);
        }
      });
    }

    Logger.log('Membership sync complete for group "' + groupEmail + '"');

  } catch (e) {
    Logger.log('FATAL ERROR in syncGroupMembership for group ' + groupEmail + '. Error: ' + e.toString());
    throw e; // Re-throw to be caught by processRow
  }
}

/**
 * Helper to fetch all members of a group, handling pagination.
 * @param {string} groupEmail The email of the group.
 * @return {Array} An array of member objects.
 */
function fetchAllGroupMembers_(groupEmail) {
  const members = [];
  let pageToken;
  do {
    const resp = AdminDirectory.Members.list(groupEmail, { 
      maxResults: 200,
      pageToken: pageToken 
    });
    if (resp.members) {
      members.push.apply(members, resp.members);
    }
    pageToken = resp.nextPageToken;
  } while (pageToken);
  return members;
}

function setFolderPermission(folderId, groupEmail, role) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const roleLower = role.toLowerCase();

    // Grant the new permission. Drive handles upgrades (e.g., viewer to editor) gracefully.
    // For downgrades, the old permission might need to be removed first, but for simplicity,
    // we will ensure the target permission is set.
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
    Logger.log('Successfully set role "' + role + '" for group "' + groupEmail + '" on folder "' + folder.getName() + '"');

  } catch (e) {
    Logger.log('Failed to set permission for group ' + groupEmail + ' on folder ' + folderId + '. Error: ' + e.toString());
    throw new Error('Could not set folder permission: ' + e.message);
  }
}

function setSheetUiStyles() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) return; // No data to style

    // Set column widths and formats
    sheet.setColumnWidth(LAST_SYNCED_COL, 150);
    sheet.getRange(2, LAST_SYNCED_COL, sheet.getLastRow() - 1, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sheet.setColumnWidth(STATUS_COL, 400);

    // Define the range for script-managed columns
    const range = sheet.getRange(2, USER_SHEET_NAME_COL, sheet.getLastRow() - 1, 4);
    
    // Set background color
    range.setBackground('#f3f3f3');

    // Set protection
    const protection = range.protect().setDescription('These columns are managed by the script.');
    protection.setWarningOnly(true);
    
  } catch (e) {
    Logger.log('Could not apply UI styles. Error: ' + e.message);
  }
}


/***** HELPER FUNCTIONS - UTILITIES *****/

/***** DEVELOPER-ONLY TEST FUNCTIONS *****/

/**
 * A guided, end-to-end test to manually verify the entire workflow.
 */
function runManualAccessTest() {
  const ui = SpreadsheetApp.getUi();
  
  // --- Step 1: Get test parameters ---
  const folderName = ui.prompt('Test - Step 1/4: Folder Name', 'Enter a name for a new test folder to be created.', ui.ButtonSet.OK_CANCEL);
  if (folderName.getSelectedButton() !== ui.Button.OK || !folderName.getResponseText()) return ui.alert('Test cancelled.');
  const testFolderName = folderName.getResponseText();

  const role = ui.prompt('Test - Step 2/4: Role', 'Enter the role to test (e.g., Editor, Viewer).', ui.ButtonSet.OK_CANCEL);
  if (role.getSelectedButton() !== ui.Button.OK || !role.getResponseText()) return ui.alert('Test cancelled.');
  const testRole = role.getResponseText();

  const email = ui.prompt('Test - Step 3/4: Test Email', 'Enter a REAL email address you can access for testing (e.g., a personal Gmail).', ui.ButtonSet.OK_CANCEL);
  if (email.getSelectedButton() !== ui.Button.OK || !email.getResponseText()) return ui.alert('Test cancelled.');
  const testEmail = email.getResponseText().trim().toLowerCase();

  // --- Step 2: Add config and run sync ---
  ui.alert('Step 4/4: Initial Setup', 'The script will now add this configuration to the ManagedFolders sheet and run the sync to create the folder, group, and user sheet. Click OK to proceed.', ui.ButtonSet.OK);
  
  const managedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  const testRowIndex = managedSheet.getLastRow() + 1;
  managedSheet.getRange(testRowIndex, FOLDER_NAME_COL).setValue(testFolderName);
  managedSheet.getRange(testRowIndex, ROLE_COL).setValue(testRole);
  
  syncAll(); // First sync to create everything

  // --- Step 3: Add user and grant access ---
  const userSheetName = managedSheet.getRange(testRowIndex, USER_SHEET_NAME_COL).getValue();
  const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(userSheetName);
  if (!userSheet) return ui.alert('Test failed: Could not find the created user sheet: ' + userSheetName);
  
  userSheet.getRange('A2').setValue(testEmail);
  ui.alert('Granting Access', 'The test email has been added to the \'' + userSheetName + '\' sheet. The script will now sync again to grant folder access.', ui.ButtonSet.OK);
  syncAll(); // Second sync to add the user

  // --- Step 4: Manual Verification (Gained Access) ---
  const folderId = managedSheet.getRange(testRowIndex, FOLDER_ID_COL).getValue();
  const folderUrl = DriveApp.getFolderById(folderId).getUrl();
  const verification1 = ui.alert('Verify Access', 'Please open an Incognito Window, log in as ' + testEmail + ', and try to open this link:\n\n' + folderUrl + '\n\nDid you get access?', ui.ButtonSet.YES_NO);

  if (verification1 !== ui.Button.YES) {
    ui.alert('Test aborted. Please review the logs and configuration.');
    return;
  }

  // --- Step 5: Remove user and revoke access ---
  userSheet.getRange('A2').clearContent();
  ui.alert('Revoking Access', 'The test email has been removed from the sheet. The script will now sync again to revoke folder access.', ui.ButtonSet.OK);
  syncAll(); // Third sync to remove the user

  // --- Step 6: Manual Verification (Revoked Access) ---
  const verification2 = ui.alert('Verify Revoked Access', 'Please go back to your Incognito Window and refresh the folder page. You should see a \'permission denied\' error.\n\nWas access revoked?', ui.ButtonSet.YES_NO);

  if (verification2 === ui.Button.YES) {
    ui.alert('Test Complete: SUCCESS!', 'The user was successfully granted and revoked access.', ui.ButtonSet.OK);
  } else {
    ui.alert('Test Complete: FAILURE!', 'Access was not revoked as expected. This may be due to Google Drive permission propagation delays. Please wait a few minutes and check again.', ui.ButtonSet.OK);
  }

  // --- Step 7: Cleanup ---
  const cleanup = ui.alert('Cleanup', 'Do you want to remove the test row from ManagedFolders and delete the test user sheet (\'' + userSheetName + '\')?', ui.ButtonSet.YES_NO);
  if (cleanup === ui.Button.YES) {
    managedSheet.deleteRow(testRowIndex);
    SpreadsheetApp.getActiveSpreadsheet().deleteSheet(userSheet);
    ui.alert('Cleanup complete.');
  }
}


/**
 * Generates a standardized group email address from a base name.


/**
 * Generates a standardized group email address from a base name.
 * @param {string} baseName The base name, like 'FolderName_Role'.
 * @return {string} The generated email address.
 */
function generateGroupEmail(baseName) {
  const domain = Session.getActiveUser().getEmail().split('@')[1];
  if (!domain) {
    throw new Error('Could not determine user domain.');
  }
  
  const sanitizedName = baseName
    .toLowerCase()
    .replace(/\s+/g, '-')       // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, ''); // Remove invalid characters

  return sanitizedName + '@' + domain;
}
