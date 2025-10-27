/**
 * @file Discovery.gs
 * @description Contains the centralized logic for discovering manual permission changes.
 */

/**
 * Discovers all manually added members, both from Google Groups and direct folder access.
 * This is the single source of truth for both the Dry Run Audit and Merge & Reconcile features.
 * @returns {Array<Object>} A discovery report. Each object contains a sheetName and a list of membersToAdd.
 */
function discoverManualAdditions_() {
  const report = [];
  const allGroups = new Map();

  // 1. Collect all groups from UserGroups and ManagedFolders sheets
  const userGroupsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USER_GROUPS_SHEET_NAME);
  if (userGroupsSheet && userGroupsSheet.getLastRow() > 1) {
    const userGroupsData = userGroupsSheet.getRange(2, 1, userGroupsSheet.getLastRow() - 1, 2).getValues();
    userGroupsData.forEach(row => {
      if (row[0] && row[1]) allGroups.set(row[0], { email: row[1], folderId: null });
    });
  }

  const managedFoldersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (managedFoldersSheet && managedFoldersSheet.getLastRow() > 1) {
    const managedFoldersData = managedFoldersSheet.getRange(2, 1, managedFoldersSheet.getLastRow() - 1, GROUP_EMAIL_COL).getValues();
    managedFoldersData.forEach(row => {
      if (row[USER_SHEET_NAME_COL - 1] && row[GROUP_EMAIL_COL - 1]) {
        allGroups.set(row[USER_SHEET_NAME_COL - 1], { email: row[GROUP_EMAIL_COL - 1], folderId: row[FOLDER_ID_COL - 1] });
      }
    });
  }

  // 2. Iterate through each group and create a discovery report
  allGroups.forEach((groupInfo, sheetName) => {
    const membersToAdd = new Map(); // Use a map to avoid duplicate members

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      log_(`Sheet '${sheetName}' not found. Skipping discovery.`, 'WARN');
      return;
    }

    const sheetMembers = new Set(
      sheet.getLastRow() > 1
        ? sheet.getRange('A2:A' + sheet.getLastRow()).getValues().map(r => r[0].toString().trim().toLowerCase()).filter(e => e)
        : []
    );

    try {
      // A. Discover from Google Group members
      const groupMembers = new Set(getActualMembers_(groupInfo.email).map(m => m.toLowerCase()));
      groupMembers.forEach(member => {
        if (!sheetMembers.has(member)) {
          membersToAdd.set(member, { email: member, source: 'Google Group' });
        }
      });

      // B. Discover from direct folder permissions (if applicable)
      if (groupInfo.folderId) {
        const folder = DriveApp.getFolderById(groupInfo.folderId);
        const directUsers = getDirectFolderUsers_(folder);
        directUsers.forEach(user => {
          if (user.email !== groupInfo.email && !sheetMembers.has(user.email) && !groupMembers.has(user.email)) {
            membersToAdd.set(user.email, { email: user.email, source: 'Direct Folder Access' });
          }
        });
      }

      if (membersToAdd.size > 0) {
        report.push({ sheetName: sheetName, membersToAdd: Array.from(membersToAdd.values()) });
      }

    } catch (e) {
      log_(`Error during discovery for '${sheetName}': ${e.message}`, 'ERROR');
    }
  });

  return report;
}
