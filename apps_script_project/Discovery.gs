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
      if (row[0] && row[1]) {
        const sheetName = getUserGroupSheetName_(row[0]);
        allGroups.set(sheetName, { email: row[1], folderId: null });
      }
    });
  }

  const managedFoldersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (managedFoldersSheet && managedFoldersSheet.getLastRow() > 1) {
    const headers = getHeaderMap_(managedFoldersSheet);
    const userSheetNameCol = resolveColumn_(headers, 'usersheetname', 5);
    const groupEmailCol = resolveColumn_(headers, 'groupemail', 4);
    const folderIdCol = resolveColumn_(headers, 'folderid', 2);
    
    const managedFoldersData = managedFoldersSheet.getRange(2, 1, managedFoldersSheet.getLastRow() - 1, Math.max(userSheetNameCol, groupEmailCol, folderIdCol)).getValues();
    managedFoldersData.forEach(row => {
      const userSheetName = row[userSheetNameCol - 1];
      const groupEmail = row[groupEmailCol - 1];
      const folderId = row[folderIdCol - 1];
      if (userSheetName && groupEmail) {
        allGroups.set(userSheetName, { email: groupEmail, folderId: folderId });
      }
    });
  }

  // 2. Iterate through each group and create a discovery report
  allGroups.forEach((groupInfo, sheetName) => {
    const discrepancies = new Map(); // Use a map to avoid duplicate members

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      log_(`Sheet '${sheetName}' not found. Skipping discovery.`, 'WARN');
      return;
    }

    const sheetMembers = new Set();
    if (sheet.getLastRow() > 1) {
      const rawValues = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues(); // Read columns A and B
      rawValues.forEach(row => {
        const email = row[0];
        const isDisabled = row[1];
        if (email && !isUserRowDisabled_(isDisabled)) { // Use isUserRowDisabled_ from Utils.gs
          sheetMembers.add(email.toString().trim().toLowerCase());
        }
      });
    }

    try {
      const groupMembers = new Set(getActualMembers_(groupInfo.email).map(m => m.toLowerCase()));

      // A. Discover members in the group but not in the sheet (Manual Additions)
      groupMembers.forEach(member => {
        if (!sheetMembers.has(member)) {
          discrepancies.set(member, { email: member, source: 'Google Group', issue: 'Manual Addition' });
        }
      });

      // B. Discover members in the sheet but not in the group (Missing Members)
      sheetMembers.forEach(member => {
        if (!groupMembers.has(member)) {
          discrepancies.set(member, { email: member, source: 'Sheet', issue: 'Missing Member' });
        }
      });

      // C. Discover from direct folder permissions (if applicable)
      if (groupInfo.folderId) {
        const folder = DriveApp.getFolderById(groupInfo.folderId);
        const directUsers = getDirectFolderUsers_(folder);
        directUsers.forEach(user => {
          if (user.email !== groupInfo.email && !sheetMembers.has(user.email) && !groupMembers.has(user.email)) {
            discrepancies.set(user.email, { email: user.email, source: 'Direct Folder Access', issue: 'Manual Addition' });
          }
        });
      }

      if (discrepancies.size > 0) {
        report.push({ sheetName: sheetName, discrepancies: Array.from(discrepancies.values()) });
      }

    } catch (e) {
      log_(`Error during discovery for '${sheetName}': ${e.message}`, 'ERROR');
    }
  });

  return report;
}
