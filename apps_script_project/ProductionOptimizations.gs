/**
 * PRODUCTION CODE OPTIMIZATIONS
 * Safe performance improvements for non-test sync operations
 */

/**
 * Cache folder lookups during a sync session to avoid repeated Drive API calls
 */
const _folderCache = {};

/**
 * Get folder by ID with caching
 * @param {string} folderId - The folder ID
 * @returns {Folder} The folder object
 */
function getCachedFolder_(folderId) {
  if (!_folderCache[folderId]) {
    _folderCache[folderId] = DriveApp.getFolderById(folderId);
  }
  return _folderCache[folderId];
}

/**
 * Clear the folder cache (call at start of each sync)
 */
function clearFolderCache_() {
  for (let key in _folderCache) {
    delete _folderCache[key];
  }
}

/**
 * Optimized version: Read all user sheets at once instead of one at a time
 * @param {Array<string>} sheetNames - Array of sheet names to read
 * @returns {Object} Map of sheetName -> array of email addresses
 */
function batchReadUserSheets_(sheetNames) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = {};

  sheetNames.forEach(function(sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      const emails = [];

      // Skip header row
      for (let i = 1; i < data.length; i++) {
        const email = data[i][0]; // Column A
        const disabled = data[i][1]; // Column B (Disabled checkbox)

        if (email && !disabled) {
          emails.push(String(email).toLowerCase().trim());
        }
      }

      result[sheetName] = emails;
    }
  });

  return result;
}

/**
 * Check if group membership has changed before syncing
 * Returns true if sync is needed, false if unchanged
 * @param {string} groupEmail - The group email
 * @param {Array<string>} expectedMembers - Array of expected email addresses
 * @returns {boolean} True if sync is needed
 */
function isGroupSyncNeeded_(groupEmail, expectedMembers) {
  try {
    const currentMembers = fetchAllGroupMembers_(groupEmail);
    const currentEmails = currentMembers.map(m => m.email.toLowerCase()).sort();
    const expectedEmailsSorted = expectedMembers.map(e => e.toLowerCase()).sort();

    // Quick check: different lengths = definitely needs sync
    if (currentEmails.length !== expectedEmailsSorted.length) {
      return true;
    }

    // Deep check: compare sorted arrays
    for (let i = 0; i < currentEmails.length; i++) {
      if (currentEmails[i] !== expectedEmailsSorted[i]) {
        return true;
      }
    }

    // No changes detected
    return false;
  } catch (e) {
    // On error, assume sync is needed
    log_('Could not check if sync needed for ' + groupEmail + ': ' + e.message, 'WARN');
    return true;
  }
}

/**
 * Optimized full sync that uses caching and batch operations
 * Drop-in replacement for fullSync() with better performance
 */
function fullSyncOptimized() {
  log_('Running OPTIMIZED full sync...', 'INFO');
  clearFolderCache_(); // Clear cache at start

  const startTime = new Date();

  // Run syncs
  syncAdmins();
  syncUserGroups();

  // Process folders with optimizations
  const summary = processManagedFoldersOptimized_();

  const duration = ((new Date() - startTime) / 1000).toFixed(2);
  log_('Optimized sync completed in ' + duration + ' seconds. Summary: ' +
       summary.added + ' added, ' + summary.removed + ' removed, ' +
       summary.failed + ' failed', 'INFO');

  return summary;
}

/**
 * Optimized version of processManagedFolders_
 * Uses batch sheet reads and group change detection
 */
function processManagedFoldersOptimized_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  const totalSummary = { added: 0, removed: 0, failed: 0 };

  if (!sheet) {
    log_('ManagedFolders sheet not found', 'ERROR');
    return totalSummary;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    log_('No folders to process');
    return totalSummary;
  }

  // Read all folder data at once
  const allData = sheet.getRange(2, 1, lastRow - 1, STATUS_COL).getValues();

  // Collect all user sheet names
  const userSheetNames = [];
  allData.forEach(function(row) {
    const userSheetName = row[USER_SHEET_NAME_COL - 1];
    if (userSheetName) {
      userSheetNames.push(userSheetName);
    }
  });

  // Batch read all user sheets at once
  log_('Batch reading ' + userSheetNames.length + ' user sheets...', 'INFO');
  const userSheetData = batchReadUserSheets_(userSheetNames);

  // Process each folder
  for (let i = 0; i < allData.length; i++) {
    const rowIndex = i + 2;
    const row = allData[i];

    const folderName = row[FOLDER_NAME_COL - 1];
    const groupEmail = row[GROUP_EMAIL_COL - 1];
    const userSheetName = row[USER_SHEET_NAME_COL - 1];

    if (!folderName) continue;

    try {
      // Check if sync is needed for this group
      const expectedMembers = userSheetData[userSheetName] || [];

      if (groupEmail && isGroupSyncNeeded_(groupEmail, expectedMembers)) {
        log_('Syncing ' + folderName + ' (changes detected)', 'INFO');
        const result = processRow_(rowIndex);
        if (result) {
          totalSummary.added += result.added;
          totalSummary.removed += result.removed;
          totalSummary.failed += result.failed;
        }
      } else {
        log_('Skipping ' + folderName + ' (no changes)', 'INFO');
        sheet.getRange(rowIndex, STATUS_COL).setValue('OK (unchanged)');
      }
    } catch (e) {
      log_('Error processing row ' + rowIndex + ': ' + e.message, 'ERROR');
      totalSummary.failed++;
    }
  }

  return totalSummary;
}

/**
 * Estimate: How much time would be saved?
 *
 * For a typical setup with 10 folders, 5 unchanged:
 * - Old: 10 folder syncs × 3 seconds = 30 seconds
 * - New: 5 folder syncs × 3 seconds = 15 seconds (50% faster)
 *
 * The more folders you have, the bigger the savings!
 */
