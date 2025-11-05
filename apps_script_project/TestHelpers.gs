/**
 * TEST HELPER FUNCTIONS
 * Optimized versions of sync functions that only process test resources
 */

/**
 * Fast sync for a specific folder by row index - only processes that one row
 * This avoids the overhead of processing all folders
 * @param {number} rowIndex - The row index in ManagedFolders sheet (1-based)
 * @param {boolean} addOnly - If true, only add users, don't remove
 * @returns {string} Status: 'OK' or error message
 */
function syncSingleFolder_(rowIndex, addOnly = false) {
  const managedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);

  try {
    // Get just this one row
    const rowData = managedSheet.getRange(rowIndex, 1, 1, STATUS_COL).getValues()[0];

    const folderName = rowData[FOLDER_NAME_COL - 1];
    const folderId = rowData[FOLDER_ID_COL - 1];
    const role = rowData[ROLE_COL - 1];
    let groupEmail = rowData[GROUP_EMAIL_COL - 1];
    let userSheetName = rowData[USER_SHEET_NAME_COL - 1];

    log_('Fast sync for single folder: ' + folderName + ' (row ' + rowIndex + ')');

    // Process this single row using existing logic
    // processRow_ returns a summary object { added, removed, failed } and writes status to the sheet
    const result = processRow_(rowIndex, { addOnly: addOnly });

    // Read the status from the sheet (processRow_ writes it there)
    const status = managedSheet.getRange(rowIndex, STATUS_COL).getValue();

    return status;

  } catch (e) {
    log_('Error in syncSingleFolder_ for row ' + rowIndex + ': ' + e.message, 'ERROR');
    managedSheet.getRange(rowIndex, STATUS_COL).setValue('ERROR: ' + e.message);
    return 'ERROR: ' + e.message;
  }
}

/**
 * Lightweight test sync - only processes rows that match test patterns
 * Skips admin sync, user group sync, and production folders
 * @param {Array<string>} testPatterns - Array of folder name patterns to process (e.g., ['Test Folder', 'StressTestFolder_'])
 * @param {boolean} addOnly - If true, only add users, don't remove
 * @returns {Object} Summary with counts
 */
function testOnlySync_(testPatterns, addOnly = false) {
  log_('Starting test-only sync for patterns: ' + testPatterns.join(', '));
  const startTime = new Date();

  const managedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  const data = managedSheet.getDataRange().getValues();

  let processedCount = 0;
  let errorCount = 0;

  // Skip header row, start from row 2
  for (let i = 1; i < data.length; i++) {
    const folderName = data[i][FOLDER_NAME_COL - 1];

    // Check if this folder matches any test pattern
    const isTestFolder = testPatterns.some(pattern =>
      folderName && folderName.indexOf(pattern) !== -1
    );

    if (isTestFolder) {
      log_('Processing test folder: ' + folderName);
      const rowIndex = i + 1; // Convert to 1-based row number

      try {
        // processRow_ returns a summary object { added, removed, failed } and writes status to the sheet
        const result = processRow_(rowIndex, { addOnly: addOnly });

        // Read the status from the sheet (processRow_ writes it there)
        const status = managedSheet.getRange(rowIndex, STATUS_COL).getValue();

        if (status !== 'OK' && !status.startsWith('OK')) {
          errorCount++;
        }
        processedCount++;
      } catch (e) {
        log_('Error processing test folder ' + folderName + ': ' + e.message, 'ERROR');
        errorCount++;
        processedCount++;
      }
    } else {
      // Skip non-test folders
      log_('Skipping production folder: ' + folderName, 'DEBUG');
    }
  }

  const duration = ((new Date() - startTime) / 1000).toFixed(2);
  log_('Test-only sync complete. Processed: ' + processedCount + ', Errors: ' + errorCount + ', Duration: ' + duration + 's');

  return {
    processed: processedCount,
    errors: errorCount,
    duration: duration
  };
}

/**
 * Direct folder permission check without full sync
 * Faster way to verify a user has access to a folder
 * @param {string} folderId - The folder ID
 * @param {string} email - The user email to check
 * @returns {boolean} True if user has access
 */
function checkUserHasAccess_(folderId, email) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const permissions = folder.getViewers().concat(folder.getEditors());
    return permissions.some(user => user.getEmail().toLowerCase() === email.toLowerCase());
  } catch (e) {
    log_('Error checking access: ' + e.message, 'WARN');
    return false;
  }
}

/**
 * Direct group membership check without full sync
 * @param {string} groupEmail - The group email
 * @param {string} userEmail - The user email to check
 * @returns {boolean} True if user is in group
 */
function checkUserInGroup_(groupEmail, userEmail) {
  try {
    const members = fetchAllGroupMembers_(groupEmail);
    return members.some(member => member.email.toLowerCase() === userEmail.toLowerCase());
  } catch (e) {
    log_('Error checking group membership: ' + e.message, 'WARN');
    return false;
  }
}

/**
 * Gets test row indices based on folder name patterns
 * @param {Array<string>} patterns - Folder name patterns to match
 * @returns {Array<number>} Array of row indices (1-based)
 */
function getTestRowIndices_(patterns) {
  const managedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  const data = managedSheet.getDataRange().getValues();
  const indices = [];

  for (let i = 1; i < data.length; i++) {
    const folderName = data[i][FOLDER_NAME_COL - 1];
    const isTestFolder = patterns.some(pattern =>
      folderName && folderName.indexOf(pattern) !== -1
    );
    if (isTestFolder) {
      indices.push(i + 1); // 1-based row number
    }
  }

  return indices;
}
