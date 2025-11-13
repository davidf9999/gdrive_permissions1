/**
 * Triggers.gs - Automatic sync scheduling
 */

/**
 * Reads the settings from the Config sheet and applies them by creating or deleting the auto-sync trigger.
 * This is the primary function called from the menu.
 */
function applyAutoSyncSettings() {
  const isEnabled = getConfigValue_('EnableAutoSync', false);
  
  if (isEnabled) {
    setupAutoSync();
  } else {
    removeAutoSync();
  }
}

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

  const interval = getConfigValue_('SyncInterval', 5);
  if (isNaN(interval) || interval < 5) {
    SpreadsheetApp.getUi().alert('Invalid Sync Interval. Please set a number greater than or equal to 5 in the Config sheet.');
    // Revert the visual setting in the sheet, as the action failed
    updateConfigSetting_('EnableAutoSync', 'DISABLED ❌');
    return;
  }

  // Create a new time-based trigger
  ScriptApp.newTrigger('autoSync')
    .timeBased()
    .everyMinutes(interval)
    .create();

  log_('Auto-sync trigger installed. Will run every ' + interval + ' minutes.', 'INFO');
  updateConfigSetting_('Auto-Sync Trigger Status', 'ENABLED');
  SpreadsheetApp.getUi().alert(
    'Auto-Sync Enabled',
    'The script will now automatically sync every ' + interval + ' minutes.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Removes all auto-sync triggers.
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
    log_('Removed ' + removedCount + ' auto-sync trigger(s).', 'INFO');
    SpreadsheetApp.getUi().alert('Auto-sync trigger has been removed.');
  } else {
    SpreadsheetApp.getUi().alert('No auto-sync trigger was found to remove.');
  }
  
  // Always ensure the status indicators are correct
  updateConfigSetting_('Auto-Sync Trigger Status', 'DISABLED');
  updateConfigSetting_('EnableAutoSync', 'DISABLED');
}


/**
 * The main auto-sync function that runs on schedule.
 */
function autoSync(e) {
  const silentMode = e && e.triggerUid ? true : false;
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(10000)) {
    log_('Auto-sync skipped: another sync is already in progress.', 'WARN');
    return;
  }

  try {
    if (isInEditMode_()) {
      log_('Auto-sync skipped: spreadsheet is in Edit Mode.', 'INFO');
      return;
    }

    if (!isAutoSyncEnabled_()) {
      log_('Auto-sync is disabled in Config sheet. Skipping.', 'INFO');
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
 * Helper function to check if auto-sync is enabled.
 */
function isAutoSyncEnabled_() {
  return getConfigValue_('EnableAutoSync', false);
}

// ... (Other functions like calculateDataHash_, detectAutoSyncChanges_, etc. are unchanged)


/**
 * View current trigger status
 */
function viewTriggerStatus() {
  const triggers = ScriptApp.getProjectTriggers();
  const autoSyncTriggers = triggers.filter(t => t.getHandlerFunction() === 'autoSync');
  const isEnabledInConfig = isAutoSyncEnabled_();
  const ui = SpreadsheetApp.getUi();
  let message = '';

  if (autoSyncTriggers.length > 0) {
    message += 'A time-based trigger IS INSTALLED.\n';
    if (isEnabledInConfig) {
      message += 'Status: ENABLED ✅\n\nThe script will run automatically.';
    } else {
      message += 'Status: PAUSED ⏸️\n\nThe trigger is installed but is currently paused because "EnableAutoSync" is DISABLED in the Config sheet. The script will not run.';
    }
  } else {
    message += 'No time-based trigger is installed.\n';
    if (isEnabledInConfig) {
      message += 'Status: MISCONFIGURED ⚠️\n\n"EnableAutoSync" is ENABLED in the Config sheet, but no trigger is installed. Please run "Apply Auto-Sync Settings" from the menu.';
    } else {
      message += 'Status: DISABLED ❌\n\nThe script will not run automatically.';
    }
  }
  
  ui.alert('Auto-Sync Status', message, ui.ButtonSet.OK);
}


/**
 * Updates the visual status indicator in the Config sheet based on the actual trigger state.
 */
function updateAutoSyncStatusIndicator_() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const hasTrigger = triggers.some(t => t.getHandlerFunction() === 'autoSync');
    const isEnabledInConfig = getConfigValue_('EnableAutoSync', false);
    let statusToDisplay;

    if (hasTrigger) {
      if (isEnabledInConfig) {
        statusToDisplay = 'ENABLED';
      } else {
        statusToDisplay = 'PAUSED';
      }
    } else {
      if (isEnabledInConfig) {
        statusToDisplay = 'MISCONFIGURED';
      } else {
        statusToDisplay = 'DISABLED';
      }
    }
    updateConfigSetting_('Auto-Sync Trigger Status', statusToDisplay);
  } catch (e) {
    log_('Could not update Auto-Sync status indicator: ' + e.message, 'WARN');
  }
}

// ... (The rest of the file is unchanged)
