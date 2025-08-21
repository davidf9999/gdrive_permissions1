

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
  syncAll();

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
  syncAll();
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
      try { AdminDirectory.Groups.remove(groupEmail); } catch (e) { Logger.log('Could not remove group ' + groupEmail + ': ' + e.message); }
    });

    folderIds.forEach(function(folderId) {
      try { DriveApp.getFolderById(folderId).setTrashed(true); } catch (e) { Logger.log('Could not trash folder ' + folderId + ': ' + e.message); }
    });

    ui.alert('Cleanup Complete!');
  }
}