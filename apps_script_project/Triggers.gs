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



// ... (Other functions like calculateDataHash_, detectAutoSyncChanges_, etc. are unchanged)


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
    log_('Could not update AutoSync status indicator: ' + e.message, 'WARN');
  }
}

// ... (The rest of the file is unchanged)
