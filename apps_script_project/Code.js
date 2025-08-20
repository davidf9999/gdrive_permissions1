/***** CONFIG *****/
const EDITORS_GROUP = 'editors@dfront1.com';
const FOLDER_ID = '1XvRgYKRunn28pWKJdygPeMv7sjhOmeGC';
const SHEET_NAME = 'Sheet1'; // IMPORTANT: Change this to the name of your sheet with the emails
const EMAIL_COLUMN = 1; // Column A

/***** SYNC FUNCTION *****/

/**
 * The main function to sync the sheet to the group.
 * Reads emails from the sheet, compares to the group, and adds/removes members.
 */
function syncGroupFromSheet() {
  const sheetEmails = getEmailsFromSheet_();
  const groupMembers = fetchGroupMembers_();
  const groupEmails = new Set(groupMembers.map(m => m.email));

  // 1. Find users to ADD to the group
  const emailsToAdd = sheetEmails.filter(e => !groupEmails.has(e));
  if (emailsToAdd.length > 0) {
    Logger.log(`Adding ${emailsToAdd.length} member(s): ${emailsToAdd.join(', ')}`)
    emailsToAdd.forEach(email => addMemberToGroup_(email));
  }

  // 2. Find users to REMOVE from the group
  const sheetEmailsSet = new Set(sheetEmails);
  const membersToRemove = groupMembers.filter(m => !sheetEmailsSet.has(m.email) && m.role !== 'OWNER');
  if (membersToRemove.length > 0) {
    Logger.log(`Removing ${membersToRemove.length} member(s): ${membersToRemove.map(m => m.email).join(', ')}`)
    membersToRemove.forEach(member => removeMemberFromGroup_(member.email));
  }

  const message = `Sync complete. Added: ${emailsToAdd.length}. Removed: ${membersToRemove.length}.`;
  Logger.log(message);
  SpreadsheetApp.getUi().alert(message);
}

/***** MENU *****/
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Group Sync Tools')
    .addItem('Sync Sheet to Group', 'syncGroupFromSheet')
    .addSeparator()
    .addItem('Share Folder with Group (Run Once)', 'shareFolderWithGroup')
    .addItem('Show Folder Permissions', 'showPermissions')
    .addToUi();
}

/***** HELPER FUNCTIONS *****/

function getEmailsFromSheet_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error(`Sheet named "${SHEET_NAME}" not found.`);
  }
  // Get all values from the specified column, skipping the header row (A2:A)
  const range = sheet.getRange(2, EMAIL_COLUMN, sheet.getLastRow() - 1, 1);
  return range.getValues()
    .map(row => row[0].toString().trim().toLowerCase())
    .filter(email => email.includes('@')); // Filter out empty rows and ensure it's an email
}

function addMemberToGroup_(email) {
  const member = { email: email, role: 'MEMBER' };
  try {
    AdminDirectory.Members.insert(member, EDITORS_GROUP);
  } catch (e) {
    Logger.log(`Failed to add ${email}. Error: ${e.toString()}`)
  }
}

function removeMemberFromGroup_(email) {
  try {
    AdminDirectory.Members.remove(EDITORS_GROUP, email);
  } catch (e) {
    Logger.log(`Failed to remove ${email}. Error: ${e.toString()}`)
  }
}

function fetchGroupMembers_() {
  const members = [];
  let pageToken;
  do {
    const resp = AdminDirectory.Members.list(EDITORS_GROUP, { pageToken });
    if (resp.members) {
      members.push(...resp.members);
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
    Logger.log(`Successfully shared folder "${folder.getName()}" with group ${EDITORS_GROUP}`);
  } catch (e) {
    Logger.log(`Failed to share folder. Error: ${e.toString()}`);
  }
}

function showPermissions() {
  Logger.log(`Checking permissions for folder ID: ${FOLDER_ID}`);
  try {
    const perms = Drive.Permissions.list(FOLDER_ID, { supportsAllDrives: true, fields: 'permissions(emailAddress,role,type,id)' }).permissions || [];
    Logger.log('--- BEGIN FOLDER PERMISSIONS ---');
    perms.forEach(p => Logger.log(JSON.stringify(p)));
    Logger.log('--- END FOLDER PERMISSIONS ---');
  } catch (e) {
    Logger.log(`Error fetching permissions: ${e.toString()}`);
  }
}
