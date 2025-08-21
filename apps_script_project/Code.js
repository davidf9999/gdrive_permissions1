/***** CONFIG *****/
const EDITORS_GROUP = 'editors@dfront1.com';
const FOLDER_ID = '1XvRgYKRunn28pWKJdygPeMv7sjhOmeGC';
const SHEET_NAME = 'Sheet1'; // IMPORTANT: Change this to the name of your sheet with the emails
const EMAIL_COLUMN = 1; // Column A

/***** SYNC FUNCTION *****/

function syncGroupFromSheet(options) {
  var options = options || {}; // ES5-compatible default parameter
  const ui = SpreadsheetApp.getUi();
  const showAlerts = options.showAlerts !== false; // Default to true

  try {
    Logger.log('Starting group sync...');
    const sheetEmails = getEmailsFromSheet_();
    Logger.log('Found ' + sheetEmails.length + ' emails in the sheet: ' + sheetEmails.join(', '));

    const groupMembers = fetchGroupMembers_();
    const groupEmails = new Set(groupMembers.map(function(m) {return m.email.toLowerCase()}));
    Logger.log('Found ' + groupEmails.size + ' members in the group: ' + Array.from(groupEmails).join(', '));

    // 1. Find users to ADD to the group
    const emailsToAdd = sheetEmails.filter(function(e) {return !groupEmails.has(e)});
    if (emailsToAdd.length > 0) {
      Logger.log('Adding ' + emailsToAdd.length + ' member(s): ' + emailsToAdd.join(', '));
      emailsToAdd.forEach(function(email) {addMemberToGroup_(email)});
    }

    // 2. Find users to REMOVE from the group
    const sheetEmailsSet = new Set(sheetEmails);
    const membersToRemove = groupMembers.filter(function(m) {return !sheetEmailsSet.has(m.email.toLowerCase()) && m.role !== 'OWNER'});
    const emailsToRemove = membersToRemove.map(function(m) {return m.email});
    if (emailsToRemove.length > 0) {
      Logger.log('Removing ' + emailsToRemove.length + ' member(s): ' + emailsToRemove.join(', '));
      emailsToRemove.forEach(function(email) {removeMemberFromGroup_(email)});
    }

    // 3. Build and display a summary report
    if (showAlerts) {
      let summary = 'Group Sync Report:\n\n';
      summary += 'Folder: ' + DriveApp.getFolderById(FOLDER_ID).getName() + '\n';
      summary += 'Group: ' + EDITORS_GROUP + '\n\n';

      if (emailsToAdd.length === 0 && emailsToRemove.length === 0) {
        summary += 'No changes. The group is already in sync with the sheet.';
      } else {
        summary += 'Added (' + emailsToAdd.length + '):\n' + (emailsToAdd.join('\n') || 'None') + '\n\n';
        summary += 'Removed (' + emailsToRemove.length + '):\n' + (emailsToRemove.join('\n') || 'None') + '\n';
      }
      
      Logger.log('Sync complete. Displaying summary alert.');
      ui.alert('Sync Complete!', summary, ui.ButtonSet.OK);
    } else {
      Logger.log('Sync complete. Alerts suppressed.');
    }
    
    return { added: emailsToAdd, removed: emailsToRemove };

  } catch (e) {
    Logger.log('ERROR in syncGroupFromSheet: ' + e.toString() + '\n' + e.stack);
    if (showAlerts) {
      ui.alert('An error occurred during the sync: ' + e.message);
    }
    // Re-throw the error so test functions know something went wrong.
    throw e;
  }
}


/***** MENU *****/
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Group Sync Tools')
    .addItem('Sync Sheet to Group', 'syncGroupFromSheet')
    .addItem('Show Group Members', 'showGroupMembers')
    .addSeparator()
    .addItem('Share Folder with Group (Run Once)', 'shareFolderWithGroup')
    .addItem('Show Folder Permissions', 'showPermissions')
    .addToUi();
}

/***** PUBLIC FUNCTIONS *****/

function showGroupMembers() {
  const ui = SpreadsheetApp.getUi();
  try {
    const members = fetchGroupMembers_();
    let memberList = 'Total Members: ' + members.length + '\n\n';
    
    members.sort(function(a, b) {
      if (a.role < b.role) return 1;
      if (a.role > b.role) return -1;
      if (a.email < b.email) return -1;
      if (a.email > b.email) return 1;
      return 0;
    });

    memberList += members.map(function(m) {return '• ' + m.email + ' (' + m.role + ')'}).join('\n');

    ui.alert('Members of ' + EDITORS_GROUP, memberList, ui.ButtonSet.OK);
  } catch (e) {
    Logger.log('ERROR in showGroupMembers: ' + e.toString());
    ui.alert('Could not retrieve group members: ' + e.message);
  }
}

/***** DEVELOPER-ONLY TEST FUNCTIONS *****/
// To run these, open the Apps Script editor and select the function from the dropdown menu.

/**
 * A guided test to manually verify a real user can gain and lose access.
 */
function runManualAccessTest() {
  const ui = SpreadsheetApp.getUi();
  
  // --- Get Test Email ---
  const emailPrompt = ui.prompt(
    'Manual Access Test - Step 1: Enter Email',
    'Please enter a REAL email address you can access for testing (e.g., a personal Gmail).',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (emailPrompt.getSelectedButton() !== ui.Button.OK || !emailPrompt.getResponseText()) {
    ui.alert('Test cancelled.');
    return;
  }
  const testEmail = emailPrompt.getResponseText().trim().toLowerCase();
  const folderUrl = DriveApp.getFolderById(FOLDER_ID).getUrl();

  // --- Part 1: Test Addition ---
  const addPrompt = 'Step 2: Add this email to the sheet:\n\n' + testEmail + '\n\nThen press OK.';
  if (ui.alert(addPrompt, ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;
  
  SpreadsheetApp.flush();
  syncGroupFromSheet({ showAlerts: true }); // Show the regular summary
  Utilities.sleep(3000);

  const wasAdded = fetchGroupMembers_().some(function(m) {return m.email.toLowerCase() === testEmail});
  if (!wasAdded) {
    ui.alert('Test Failed: ' + testEmail + ' was not found in the group after sync. Check logs.');
    return;
  }

  const manualCheck1 = 'Step 3: Verify Access\n\n' + testEmail + ' has been added to the group.\n\nPlease open an Incognito Window, log in as ' + testEmail + ', and try to open this link:\n\n' + folderUrl + '\n\nDid you get access?';
  if (ui.alert(manualCheck1, ui.ButtonSet.YES_NO) !== ui.Button.YES) {
     ui.alert('Please re-run the test or check your domain sharing policies and group settings.');
     return;
  }
  
  // --- Part 2: Test Removal ---
  const removePrompt = 'Step 4: Remove this email from the sheet:\n\n' + testEmail + '\n\nThen press OK.';
  if (ui.alert(removePrompt, ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;

  SpreadsheetApp.flush();
  syncGroupFromSheet({ showAlerts: true });
  Utilities.sleep(3000);

  const wasRemoved = !fetchGroupMembers_().some(function(m) {return m.email.toLowerCase() === testEmail});
  if (!wasRemoved) {
    ui.alert('Test Failed: ' + testEmail + ' was not removed from the group after sync. Check logs.');
    return;
  }

  const manualCheck2 = 'Step 5: Verify Access is Revoked\n\n' + testEmail + ' has been removed.\n\nPlease go back to your Incognito Window and refresh the folder page. You should see a \"permission denied\" error.\n\nWas access revoked?';
  const finalButton = ui.alert(manualCheck2, ui.ButtonSet.YES_NO);

  if (finalButton === ui.Button.YES) {
    ui.alert('Test Complete: SUCCESS!', 'The user was successfully granted and revoked access.', ui.ButtonSet.OK);
  } else {
    ui.alert('Test Complete: FAILURE!', 'Access was not revoked as expected. This may be due to Google Drive permission propagation delays. Please wait a few minutes and check again.', ui.ButtonSet.OK);
  }
}


/***** HELPER FUNCTIONS *****/

function getEmailsFromSheet_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error('Sheet named "' + SHEET_NAME + '" not found.');
  }
  // Get all values from the specified column, skipping the header row (A2:A)
  const range = sheet.getRange(2, EMAIL_COLUMN, sheet.getLastRow() - 1, 1);
  return range.getValues()
    .map(function(row) {return row[0].toString().trim().toLowerCase()})
    .filter(function(email) {return email.indexOf('@') > -1}); // Filter out empty rows and ensure it's an email
}

function addMemberToGroup_(email) {
  const member = { email: email, role: 'MEMBER' };
  try {
    AdminDirectory.Members.insert(member, EDITORS_GROUP);
  } catch (e) {
    Logger.log('Failed to add ' + email + '. Error: ' + e.toString())
  }
}

function removeMemberFromGroup_(email) {
  try {
    AdminDirectory.Members.remove(EDITORS_GROUP, email);
  } catch (e) {
    Logger.log('Failed to remove ' + email + '. Error: ' + e.toString())
  }
}

function fetchGroupMembers_() {
  const members = [];
  let pageToken;
  do {
    const resp = AdminDirectory.Members.list(EDITORS_GROUP, { pageToken: pageToken });
    if (resp.members) {
      members.push.apply(members, resp.members);
    }
    pageToken = resp.nextPageToken;
  } while (pageToken);
  return members;
}

/***** ONE-TIME SETUP & DEBUGGING *****/

function shareFolderWithGroup() {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    folder.addEditor(EDITORS_GROUP);
    Logger.log('Successfully shared folder "' + folder.getName() + '" with group ' + EDITORS_GROUP);
  } catch (e) {
    Logger.log('Failed to share folder. Error: ' + e.toString());
  }
}

function showPermissions() {
  Logger.log('Checking permissions for folder ID: ' + FOLDER_ID);
  try {
    const perms = Drive.Permissions.list(FOLDER_ID, { supportsAllDrives: true, fields: 'permissions(emailAddress,role,type,id)' }).permissions || [];
    Logger.log('--- BEGIN FOLDER PERMISSIONS ---');
    perms.forEach(function(p) {Logger.log(JSON.stringify(p))});
    Logger.log('--- END FOLDER PERMISSIONS ---');
  } catch (e) {
    Logger.log('Error fetching permissions: ' + e.toString());
  }
}