/**
 * Triggers.gs - Automatic sync scheduling
 */



/**
 * Sets up a time-based trigger for automatic synchronization.
 */
function setupAutoSync() {
  // First, remove any existing triggers to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'autoSync') {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  const interval = getConfigValue_('AutoSyncInterval', 5);
  if (isNaN(interval) || interval < 5) {
    SpreadsheetApp.getUi().alert('Invalid AutoSync Interval. Please set a number greater than or equal to 5 in the Config sheet.');
    return;
  }

  // Create a new time-based trigger
  ScriptApp.newTrigger('autoSync')
    .timeBased()
    .everyMinutes(interval)
    .create();

  log_('AutoSync trigger installed. Will run every ' + interval + ' minutes.', 'INFO');
  updateAutoSyncStatusIndicator_();
  SpreadsheetApp.getUi().alert(
    'AutoSync Enabled',
    'The script will now automatically sync every ' + interval + ' minutes.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Removes all AutoSync triggers.
 */
function removeAutoSync() {
  const triggers = ScriptApp.getProjectTriggers();
  let removedCount = 0;

  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'autoSync') {
      ScriptApp.deleteTrigger(trigger);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    log_('Removed ' + removedCount + ' AutoSync trigger(s).', 'INFO');
    SpreadsheetApp.getUi().alert('AutoSync trigger has been removed.');
  } else {
    SpreadsheetApp.getUi().alert('No AutoSync trigger was found to remove.');
  }

  // Always ensure the status indicators are correct
  updateAutoSyncStatusIndicator_();
}


/**
 * The main AutoSync function that runs on schedule.
 */
function autoSync(options = {}) {
  const silentMode = (options && options.triggerUid) || (options && options.silentMode);
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(10000)) {
    log_('AutoSync skipped: another sync is already in progress.', 'WARN');
    return;
  }

  try {
    const props = PropertiesService.getDocumentProperties();
    const now = Date.now();
    const lastRunRaw = props.getProperty(AUTO_SYNC_LAST_RUN_KEY);
    const intervalMinutes = getConfigValue_('AutoSyncInterval', 5);
    const enforcedIntervalMs = Math.max(5, intervalMinutes) * 60 * 1000;

    if (lastRunRaw) {
      const elapsed = now - Number(lastRunRaw);
      if (!isNaN(elapsed) && elapsed < enforcedIntervalMs) {
        log_('AutoSync skipped: last run was ' + Math.round(elapsed / 1000) + 's ago (interval ' + intervalMinutes + ' mins).', 'DEBUG');
        return { skipped: true, added: 0, removed: 0, failed: 0 };
      }
    }

    props.setProperty(AUTO_SYNC_LAST_RUN_KEY, String(now));

    if (isInEditMode_()) {
      log_('AutoSync skipped: spreadsheet is in Edit Mode.', 'DEBUG');
      return;
    }

    // Detect if changes warrant a sync
    const changeDetection = detectAutoSyncChanges_();

    if (!changeDetection.shouldRun) {
      return { skipped: true, added: 0, removed: 0, failed: 0 };
    }

    // Only log start message if sync will actually run
    log_('*** Starting scheduled AutoSync...');

    // Log reasons for sync
    log_('AutoSync triggered. Reasons:', 'INFO');
    changeDetection.reasons.forEach(function(reason) {
      log_('  - ' + reason, 'INFO');
    });

    // Determine if deletions are allowed
    const allowDeletions = getConfigValue_('AllowAutosyncDeletion', false);

    let syncResult;
    if (allowDeletions) {
      log_('AutoSync with deletions enabled. Performing full sync...');
      syncResult = fullSync({ silentMode: silentMode, skipSetup: true, executionSource: 'AUTO_SYNC' });
    } else {
      log_('AutoSync with deletions disabled. Performing SAFE operations (additions only)...');
      syncResult = syncAdds({ silentMode: silentMode, skipSetup: true, executionSource: 'AUTO_SYNC' });
    }

    // Save snapshot with success/failure status
    if (syncResult && syncResult.failed === 0) {
      changeDetection.snapshot.lastSyncSuccessful = true;
      props.setProperty(AUTO_SYNC_CHANGE_SIGNATURE_KEY, JSON.stringify(changeDetection.snapshot));
      log_('*** Scheduled AutoSync completed successfully.');
    } else {
      changeDetection.snapshot.lastSyncSuccessful = false;
      props.setProperty(AUTO_SYNC_CHANGE_SIGNATURE_KEY, JSON.stringify(changeDetection.snapshot));
      log_('AutoSync did not complete successfully. Will retry on next run.', 'WARN');
    }
    return syncResult;

  } catch (e) {
    const errorMessage = 'FATAL ERROR in autoSync: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    sendErrorNotification_(errorMessage);

    // Mark sync as failed in snapshot so we retry on next run
    try {
      const props = PropertiesService.getDocumentProperties();
      const rawSnapshot = props.getProperty(AUTO_SYNC_CHANGE_SIGNATURE_KEY);
      if (rawSnapshot) {
        const snapshot = JSON.parse(rawSnapshot);
        snapshot.lastSyncSuccessful = false;
        props.setProperty(AUTO_SYNC_CHANGE_SIGNATURE_KEY, JSON.stringify(snapshot));
      }
    } catch (snapErr) {
      log_('Could not update snapshot after error: ' + snapErr.message, 'WARN');
    }
  } finally {
    lock.releaseLock();
  }
}




/**
 * Helper to get all data from a sheet for hashing, ignoring filters.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The sheet to get data from.
 * @param {number} numCols The number of columns to include.
 * @return {Array<Array<any>>} The data.
 */
function getSheetDataForHashing_(sheet, numCols) {
  if (sheet && sheet.getLastRow() > 1) {
    const allData = sheet.getDataRange().getValues();
    allData.shift(); // Remove header
    return allData.map(function(row) {
      // Ensure row has enough columns to slice, pad with empty strings if not
      const paddedRow = row.concat(Array(Math.max(0, numCols - row.length)).fill(''));
      return paddedRow.slice(0, numCols);
    });
  }
  return [];
}


/**
 * Detects changes in the spreadsheet and managed folders since the last AutoSync run.
 * Returns whether a sync should run and the reasons why.
 */
function detectAutoSyncChanges_() {
  const props = PropertiesService.getDocumentProperties();
  let previousSnapshot = null;

  try {
    const rawSnapshot = props.getProperty(AUTO_SYNC_CHANGE_SIGNATURE_KEY);
    if (rawSnapshot) {
      previousSnapshot = JSON.parse(rawSnapshot);
    }
  } catch (e) {
    log_('Failed to parse previous AutoSync snapshot: ' + e.message, 'WARN');
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  // Compute hash of actual data content in control sheets
  // IMPORTANT: Exclude script-managed columns (Status, Last Synced, URL) to avoid triggering on metadata updates
  let dataHash = '';
  try {
    const managedSheet = spreadsheet.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
    const adminsSheet = spreadsheet.getSheetByName(ADMINS_SHEET_NAME);
    const userGroupsSheet = spreadsheet.getSheetByName(USER_GROUPS_SHEET_NAME);

    let dataString = '';
    
    if (managedSheet) {
      const managedHeaders = getHeaderMap_(managedSheet);
      const userSheetNameCol = resolveColumn_(managedHeaders, 'usersheetname', 5);
      const data = getSheetDataForHashing_(managedSheet, userSheetNameCol);
      dataString += JSON.stringify(data);

      const userSheetNames = data.map(function(row) { return row[userSheetNameCol - 1]; });
      userSheetNames.forEach(function(name) {
        if (name) {
          const userSheet = spreadsheet.getSheetByName(name);
          if (userSheet) {
            const userData = getSheetDataForHashing_(userSheet, 2);
            dataString += JSON.stringify(userData);
          }
        }
      });
    }
    
    if (adminsSheet) {
      const data = getSheetDataForHashing_(adminsSheet, 1);
      dataString += JSON.stringify(data);
    }

    if (userGroupsSheet) {
      const ugHeaders = getHeaderMap_(userGroupsSheet);
      const deleteCol = resolveColumn_(ugHeaders, 'delete', 6);
      const lastRow = userGroupsSheet.getLastRow();

      // Only include user-managed data (GroupName, GroupEmail, Delete flag) to avoid
      // triggering syncs on script-managed columns like Last Synced/Status.
      let filteredData = [];
      if (lastRow > 1) {
        const rawData = userGroupsSheet.getRange(2, 1, lastRow - 1, deleteCol).getValues();
        filteredData = rawData.map(function(row) {
          return [row[0], row[1], row[deleteCol - 1]];
        });
      }

      dataString += JSON.stringify(filteredData);

      const groupNames = filteredData.map(function(row) { return row[0]; });
      groupNames.forEach(function(name) {
        if (name) {
          const groupSheet = spreadsheet.getSheetByName(name + '_G');
          if (groupSheet) {
            const groupData = getSheetDataForHashing_(groupSheet, 2);
            dataString += JSON.stringify(groupData);
          }
        }
      });
    }

    // Compute SHA-256 hash
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, dataString);
    dataHash = Utilities.base64Encode(digest);
  } catch (e) {
    log_('Failed to compute data hash: ' + e.message, 'WARN');
  }

  let shouldRun = false;
  const reasons = [];

  if (!previousSnapshot) {
    shouldRun = true;
    reasons.push('No previous AutoSync snapshot was found.');
  }

  // Check if previous sync failed - if so, retry regardless of changes
  // If lastSyncSuccessful is missing (old snapshot), treat as failed for safety
  if (previousSnapshot && previousSnapshot.hasOwnProperty('lastSyncSuccessful') && previousSnapshot.lastSyncSuccessful !== true) {
    shouldRun = true;
    reasons.push('Previous AutoSync run did not complete successfully or status unknown. Retrying.');
  }

  // Check if actual data in control sheets has changed
  const previousDataHash = previousSnapshot && previousSnapshot.dataHash ? previousSnapshot.dataHash : null;
  if (dataHash && dataHash !== previousDataHash) {
    shouldRun = true;
    reasons.push('Control sheet data has changed.');
    log_('Data hash changed. Old: ' + previousDataHash + ' New: ' + dataHash, 'DEBUG');
  }

  const snapshot = {
    dataHash: dataHash,
    capturedAt: new Date().toISOString()
  };

  return {
    shouldRun,
    reasons,
    snapshot
  };
}

/**
 * View current trigger status
 */
function viewTriggerStatus() {
  const triggers = ScriptApp.getProjectTriggers();
  const autoSyncTriggers = triggers.filter(t => t.getHandlerFunction() === 'autoSync');
  const ui = SpreadsheetApp.getUi();
  let message = '';

  if (autoSyncTriggers.length > 0) {
    const interval = getConfigValue_('AutoSyncInterval', 5);
    message += `A time-based trigger IS INSTALLED, running every ${interval} minutes.\n`;
    message += 'Status: ENABLED\n\nThe script will run automatically.';
  } else {
    message += 'No time-based trigger is installed.\n';
    message += 'Status: DISABLED\n\nThe script will not run automatically. To enable, use the "Enable/Update AutoSync" menu item.';
  }

  ui.alert('AutoSync Status', message, ui.ButtonSet.OK);
}


/**
 * Updates the visual status indicator in the Config sheet based on the actual trigger state.
 */
function updateAutoSyncStatusIndicator_() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const hasTrigger = triggers.some(t => t.getHandlerFunction() === 'autoSync');
    let statusToDisplay;

    if (hasTrigger) {
      const interval = getConfigValue_('AutoSyncInterval', 5);
      statusToDisplay = `ENABLED (every ${interval} mins)`;
    } else {
      statusToDisplay = 'DISABLED';
    }
    updateConfigSetting_('AutoSync Trigger Status', statusToDisplay);
  } catch (e) {
    if (e.message.includes('sufficient')) { // Catches 'not sufficient permissions'
      updateConfigSetting_('AutoSync Trigger Status', 'AUTH_REQUIRED');
      log_('Could not update AutoSync status indicator due to missing permissions. A super admin can fix this by running an item from the "AutoSync" menu to re-authorize.', 'WARN');
    } else {
      log_('Could not update AutoSync status indicator: ' + e.message, 'WARN');
    }
  }
}

// ... (The rest of the file is unchanged)
