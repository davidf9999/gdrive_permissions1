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
  updateConfigSetting_('AutoSync Trigger Status', 'ENABLED');
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
  updateConfigSetting_('AutoSync Trigger Status', 'DISABLED');
}


/**
 * The main AutoSync function that runs on schedule.
 */
function autoSync(e) {
  const silentMode = e && e.triggerUid ? true : false;
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(10000)) {
    log_('AutoSync skipped: another sync is already in progress.', 'WARN');
    return;
  }

  try {
    if (isInEditMode_()) {
      log_('AutoSync skipped: spreadsheet is in Edit Mode.', 'INFO');
      return;
    }


    
    // ... (rest of the function is unchanged) 
    
  } catch (e) {
    const errorMessage = 'FATAL ERROR in autoSync: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    sendErrorNotification_(errorMessage);
  } finally {
    lock.releaseLock();
  }
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
  const spreadsheetLastUpdated = spreadsheet.getLastUpdated();

  const folderStates = {};
  const folderIds = new Set();
  let hadFolderErrors = false;

  const managedSheet = spreadsheet.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (managedSheet && managedSheet.getLastRow() > 1) {
    const idValues = managedSheet.getRange(2, FOLDER_ID_COL, managedSheet.getLastRow() - 1, 1).getValues();
    idValues.forEach(row => {
      if (row && row[0]) {
        const id = row[0].toString().trim();
        if (id) {
          folderIds.add(id);
        }
      }
    });
  }

  folderIds.forEach(id => {
    try {
      const folder = DriveApp.getFolderById(id);
      const lastUpdated = folder.getLastUpdated();
      folderStates[id] = lastUpdated ? lastUpdated.getTime() : null;
    } catch (e) {
      hadFolderErrors = true;
      folderStates[id] = previousSnapshot && previousSnapshot.folderStates && previousSnapshot.folderStates.hasOwnProperty(id)
        ? previousSnapshot.folderStates[id]
        : null;
      log_('Change detection: unable to read folder ' + id + ': ' + e.message, 'WARN');
    }
  });

  let shouldRun = false;
  const reasons = [];

  if (!previousSnapshot) {
    shouldRun = true;
    reasons.push('No previous AutoSync snapshot was found.');
  }

  const previousSpreadsheetTimestamp = previousSnapshot && typeof previousSnapshot.spreadsheetLastUpdated === 'number'
    ? previousSnapshot.spreadsheetLastUpdated
    : null;

  if (spreadsheetLastUpdated) {
    const currentSpreadsheetTimestamp = spreadsheetLastUpdated.getTime();
    if (!previousSpreadsheetTimestamp || currentSpreadsheetTimestamp > previousSpreadsheetTimestamp) {
      shouldRun = true;
      reasons.push('Control spreadsheet updated at ' + spreadsheetLastUpdated.toISOString() + '.');
    }
  }

  folderIds.forEach(id => {
    const currentTimestamp = folderStates[id];
    const previousTimestamp = previousSnapshot && previousSnapshot.folderStates
      ? previousSnapshot.folderStates[id]
      : undefined;

    if (typeof previousTimestamp === 'undefined') {
      shouldRun = true;
      reasons.push('New managed folder detected (' + id + ').');
      return;
    }

    if (currentTimestamp === null && previousTimestamp !== null) {
      shouldRun = true;
      reasons.push('Folder ' + id + ' is no longer accessible.');
      return;
    }

    if (currentTimestamp !== null && previousTimestamp === null) {
      shouldRun = true;
      reasons.push('Folder ' + id + ' became accessible again.');
      return;
    }

    if (typeof currentTimestamp === 'number' && typeof previousTimestamp === 'number' && currentTimestamp > previousTimestamp) {
      shouldRun = true;
      reasons.push('Folder ' + id + ' modified at ' + new Date(currentTimestamp).toISOString() + '.');
    }
  });

  if (previousSnapshot && previousSnapshot.folderStates) {
    Object.keys(previousSnapshot.folderStates).forEach(id => {
      if (!folderIds.has(id)) {
        shouldRun = true;
        reasons.push('Managed folder removed from sheet (' + id + ').');
      }
    });
  }

  if (hadFolderErrors) {
    shouldRun = true;
    reasons.push('Encountered errors while inspecting managed folders.');
  }

  const snapshot = {
    spreadsheetLastUpdated: spreadsheetLastUpdated ? spreadsheetLastUpdated.getTime() : null,
    folderStates: folderStates,
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
    // Permission errors are expected when non-admin users open the sheet
    // Just set status to unknown instead of logging a warning
    if (e.message && e.message.indexOf('permissions') > -1) {
      try {
        updateConfigSetting_('AutoSync Trigger Status', 'Unknown (check permissions)');
      } catch (err) {
        // Silently fail if we can't update the setting
      }
    } else {
      log_('Could not update AutoSync status indicator: ' + e.message, 'WARN');
    }
  }
}

// ... (The rest of the file is unchanged)
