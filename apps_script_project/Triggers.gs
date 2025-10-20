/**
 * Triggers.gs - Automatic sync scheduling
 *
 * This file handles automatic, time-based synchronization.
 * Perfect for NGOs where volunteers edit sheets but don't need to manually trigger syncs.
 */

/**
 * Sets up an hourly trigger for automatic synchronization.
 * Run this function ONCE from the menu to install the trigger.
 *
 * The trigger will run with the script owner's permissions, so volunteers
 * don't need to authenticate or have Admin SDK access.
 */
function setupAutoSync() {
  // First, remove any existing triggers to avoid duplicates
  removeAutoSync();

  // Create a new time-based trigger that runs every hour
  ScriptApp.newTrigger('autoSync')
    .timeBased()
    .everyHours(1) // Change this to suit your needs
    .create();

  log_('Auto-sync trigger installed. Will run every hour.', 'INFO');
  SpreadsheetApp.getUi().alert(
    'Auto-Sync Enabled',
    'The script will now automatically sync every hour. ' +
    'Volunteers can edit the sheets, and changes will be applied automatically.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Removes all auto-sync triggers.
 * Run this if you want to disable automatic synchronization.
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
    SpreadsheetApp.getUi().alert('Auto-sync triggers removed.');
  } else {
    SpreadsheetApp.getUi().alert('No auto-sync triggers were found.');
  }
}

/**
 * The main auto-sync function that runs on schedule.
 * This performs a full sync (adds and deletes).
 *
 * You can modify this to only run syncAdds if you prefer non-destructive syncs.
 */
function autoSync() {
  const lock = LockService.getScriptLock();

  // Try to acquire lock. If another sync is running, skip this execution.
  if (!lock.tryLock(10000)) {
    log_('Auto-sync skipped: another sync is already in progress.', 'WARN');
    return;
  }

  try {
    log_('*** Starting scheduled auto-sync...');

    // Check if auto-sync is enabled in Config sheet
    if (!isAutoSyncEnabled_()) {
      log_('Auto-sync is disabled in Config sheet. Skipping.', 'INFO');
      return;
    }

    // Perform the sync
    // Option 1: Full sync (adds and deletes)
    fullSync();

    // Option 2: Only adds (safer, never removes access)
    // syncAdds();

    log_('*** Scheduled auto-sync completed successfully.');

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
 * Reads from the Config sheet.
 * @return {boolean} True if enabled, false otherwise
 */
function isAutoSyncEnabled_() {
  try {
    const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET_NAME);
    if (!configSheet) {
      return false; // If no config sheet, assume disabled
    }

    // Look for "EnableAutoSync" setting
    const data = configSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === 'EnableAutoSync') {
        return data[i][1] === true || data[i][1] === 'TRUE' || data[i][1] === 'true';
      }
    }

    // Default to true if setting not found (for backwards compatibility)
    return true;

  } catch (e) {
    log_('Error checking auto-sync status: ' + e.message, 'ERROR');
    return false;
  }
}

/**
 * Setup daily sync at a specific time (alternative to hourly)
 * Run this instead of setupAutoSync() if you prefer daily syncs
 */
function setupDailySync() {
  removeAutoSync(); // Remove existing triggers

  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Setup Daily Sync',
    'At what hour should the sync run? (0-23, e.g., 2 for 2 AM)',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const hour = parseInt(response.getResponseText());
  if (isNaN(hour) || hour < 0 || hour > 23) {
    ui.alert('Invalid hour. Please enter a number between 0 and 23.');
    return;
  }

  // Run every day at specified hour
  ScriptApp.newTrigger('autoSync')
    .timeBased()
    .atHour(hour)
    .everyDays(1)
    .create();

  log_('Daily auto-sync trigger installed for ' + hour + ':00.', 'INFO');
  ui.alert('Daily sync enabled at ' + hour + ':00 (server time)');
}

/**
 * Setup custom interval sync
 */
function setupCustomIntervalSync() {
  removeAutoSync(); // Remove existing triggers

  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Setup Custom Interval',
    'How many hours between syncs? (1, 2, 4, 6, 8, or 12)',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const hours = parseInt(response.getResponseText());
  const validIntervals = [1, 2, 4, 6, 8, 12];

  if (!validIntervals.includes(hours)) {
    ui.alert('Invalid interval. Please choose: 1, 2, 4, 6, 8, or 12 hours.');
    return;
  }

  ScriptApp.newTrigger('autoSync')
    .timeBased()
    .everyHours(hours)
    .create();

  log_('Auto-sync trigger installed for every ' + hours + ' hour(s).', 'INFO');
  ui.alert('Auto-sync enabled every ' + hours + ' hour(s)');
}

/**
 * Menu item for admins to manually trigger a sync (still useful for immediate updates)
 */
function manualSync() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Manual Sync',
    'Do you want to run a sync now? (This will run immediately, not waiting for the scheduled time)',
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    try {
      autoSync();
      ui.alert('Manual sync completed. Check the Log sheet for details.');
    } catch (e) {
      ui.alert('Sync failed: ' + e.message);
    }
  }
}

/**
 * View current trigger status
 */
function viewTriggerStatus() {
  const triggers = ScriptApp.getProjectTriggers();
  const autoSyncTriggers = triggers.filter(t => t.getHandlerFunction() === 'autoSync');

  const ui = SpreadsheetApp.getUi();

  if (autoSyncTriggers.length === 0) {
    ui.alert('Auto-Sync Status', 'No auto-sync triggers are currently installed.\n\nUse "Setup Auto-Sync" to enable automatic syncing.', ui.ButtonSet.OK);
  } else {
    let message = 'Auto-sync is ENABLED\n\n';
    message += 'Trigger details:\n';

    autoSyncTriggers.forEach((trigger, index) => {
      const eventType = trigger.getEventType().toString();
      message += '\nTrigger ' + (index + 1) + ':\n';
      message += '  Type: Time-based\n';

      // Try to get more details about the trigger
      try {
        message += '  Event: ' + eventType + '\n';
      } catch (e) {
        // Some trigger details may not be accessible
      }
    });

    message += '\nEnabled in Config sheet: ' + (isAutoSyncEnabled_() ? 'YES' : 'NO');

    ui.alert('Auto-Sync Status', message, ui.ButtonSet.OK);
  }
}
