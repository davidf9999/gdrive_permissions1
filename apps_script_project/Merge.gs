/**
 * @file Merge.gs
 * @description Contains the logic for the Merge Sync feature, which reconciles manual
 * permission changes with the control sheet.
 */

/**
 * Performs a reconciliation sync across all managed folders and user groups.
 * This function will fetch all members from the live Google Groups, merge them with the
 * members listed in the sheets, and add any manually added members back to the sheet.
 * This is the primary method for an admin to approve and document manual permission changes.
 */
function mergeSync() {
  const ui = SpreadsheetApp.getUi();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    ui.alert('Sync is already in progress. Please wait a few minutes and try again.');
    return;
  }

  try {
    log_('*** Starting Merge & Reconcile Sync...');
    showToast_('Starting Merge & Reconcile...', 'Merge Sync', -1);

    // Reconcile User Groups first
    const userGroupsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USER_GROUPS_SHEET_NAME);
    if (userGroupsSheet && userGroupsSheet.getLastRow() > 1) {
      const userGroupsData = userGroupsSheet.getRange(2, 1, userGroupsSheet.getLastRow() - 1, 2).getValues();
      userGroupsData.forEach(row => {
        const groupName = row[0];
        const groupEmail = row[1];
        if (groupName && groupEmail) {
          reconcileMembership_(groupName, groupEmail);
        }
      });
    }

    // Reconcile Managed Folders
    const managedFoldersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
    if (managedFoldersSheet && managedFoldersSheet.getLastRow() > 1) {
      const managedFoldersData = managedFoldersSheet.getRange(2, 1, managedFoldersSheet.getLastRow() - 1, GROUP_EMAIL_COL).getValues();
      managedFoldersData.forEach(row => {
        const groupName = row[USER_SHEET_NAME_COL - 1];
        const groupEmail = row[GROUP_EMAIL_COL - 1];
        if (groupName && groupEmail) {
          reconcileMembership_(groupName, groupEmail);
        }
      });
    }

    log_('*** Merge & Reconcile Sync Complete.');
    showToast_('Merge & Reconcile Complete.', 'Merge Sync', 5);
    ui.alert('Merge & Reconcile sync is complete. Manually added members have been added to the sheets.');

  } catch (e) {
    const errorMessage = 'FATAL ERROR in mergeSync: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    showToast_('Merge sync failed with a fatal error.', 'Merge Sync', 5);
    ui.alert('A fatal error occurred during the merge sync: ' + e.message);
    sendErrorNotification_(errorMessage);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Reconciles the membership of a single group. It gets the members from the sheet and the
 * live Google Group, merges them, and writes any new members back to the sheet.
 *
 * @param {string} sheetName The name of the user sheet that defines the desired members.
 * @param {string} groupEmail The email address of the Google Group.
 */
function reconcileMembership_(sheetName, groupEmail) {
  log_('Reconciling membership for group ' + groupEmail + ' with sheet ' + sheetName);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    log_('User sheet "' + sheetName + '" not found. Skipping reconciliation.', 'WARN');
    return;
  }

  try {
    // 1. Get members from the sheet
    let sheetMembers = new Set();
    if (sheet.getLastRow() > 1) {
      sheetMembers = new Set(
        sheet.getRange('A2:A' + sheet.getLastRow()).getValues()
          .map(row => row[0].toString().trim().toLowerCase())
          .filter(email => email && email.includes('@'))
      );
    }

    // 2. Get members from the Google Group
    const groupMembers = new Set(
      fetchAllGroupMembers_(groupEmail)
        .map(member => member.email.toLowerCase())
    );

    // 3. Find manually added members (in group but not in sheet)
    const manuallyAddedMembers = getManuallyAddedMembers_(sheetMembers, groupMembers);

    // 4. If there are new members, add them to the sheet
    if (manuallyAddedMembers.length > 0) {
      log_('Found ' + manuallyAddedMembers.length + ' manually added members in ' + groupEmail + '. Adding them to sheet "' + sheetName + '".');
      const newValues = manuallyAddedMembers.map(member => [member]);
      sheet.getRange(sheet.getLastRow() + 1, 1, newValues.length, 1).setValues(newValues);
    }

  } catch (e) {
    log_('Error during reconciliation for group ' + groupEmail + ': ' + e.message, 'ERROR');
    // Continue to the next group
  }
}

function getManuallyAddedMembers_(sheetMembers, groupMembers) {
  const manuallyAddedMembers = [];
  groupMembers.forEach(member => {
    if (!sheetMembers.has(member)) {
      manuallyAddedMembers.push(member);
    }
  });
  return manuallyAddedMembers;
}

// Export for testing
if (typeof module !== 'undefined') {
  module.exports = { reconcileMembership_, getManuallyAddedMembers_ };
}
