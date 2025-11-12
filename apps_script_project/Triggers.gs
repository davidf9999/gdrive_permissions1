/**
 * Triggers.gs - Automatic sync scheduling
 *
 * This file handles automatic, time-based synchronization.
 * Perfect for NGOs where volunteers edit sheets but don't need to manually trigger syncs.
 */

/**
 * Sets up a 5-minute trigger for automatic synchronization.
 * Run this function ONCE from the menu to install the trigger.
 *
 * The trigger will run with the script owner's permissions, so volunteers
 * don't need to authenticate or have Admin SDK access.
 */
function setupAutoSync() {
  // First, remove any existing triggers to avoid duplicates
  removeAutoSync();

  // Create a new time-based trigger that runs every 5 minutes
  ScriptApp.newTrigger('autoSync')
    .timeBased()
    .everyMinutes(5)
    .create();

  log_('Auto-sync trigger installed. Will run every 5 minutes.', 'INFO');
  updateConfigSetting_('AutoSyncStatus', 'ENABLED ✅'); // Update visual indicator directly
  updateConfigSetting_('EnableAutoSync', 'ENABLED');
  SpreadsheetApp.getUi().alert(
    'Auto-Sync Enabled',
    'The script will now automatically sync every 5 minutes. ' +
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
    updateConfigSetting_('AutoSyncStatus', 'DISABLED ❌'); // Update visual indicator directly
    updateConfigSetting_('EnableAutoSync', 'DISABLED');
    SpreadsheetApp.getUi().alert('Auto-sync triggers removed.');
  } else {
    // If no triggers were found, but the Config says it's enabled, we should probably set it to DISABLED.
    // However, the new updateAutoSyncStatusIndicator_ will handle the PAUSED state based on EnableAutoSync.
    updateConfigSetting_('AutoSyncStatus', 'DISABLED ❌'); // Ensure status is correct even if no triggers were found
    updateConfigSetting_('EnableAutoSync', 'DISABLED');
    SpreadsheetApp.getUi().alert('No auto-sync triggers were found.');
  }
}


/**
 * The main auto-sync function that runs on schedule.
 * This performs a full sync (adds and deletes).
 *
 * You can modify this to only run syncAdds if you prefer non-destructive syncs.
 */
function autoSync(e) {
  // When run by a real trigger, the event object 'e' will have a triggerUid.
  // When run manually from the menu, 'e' will be undefined.
  // This allows us to run silently for triggers, but show UI for manual runs.
  const silentMode = e && e.triggerUid ? true : false;

  const lock = LockService.getScriptLock();

  // Try to acquire lock. If another sync is running, skip this execution.
  if (!lock.tryLock(10000)) {
    log_('Auto-sync skipped: another sync is already in progress.', 'WARN');
    return;
  }

  let changeDetection = null;
  let detectionSnapshot = null;
  let snapshotShouldUpdate = false;

  try {
    showSyncInProgress_();
    // Check if in Edit Mode (takes precedence)
    if (isInEditMode_()) {
      log_('Auto-sync skipped: spreadsheet is in Edit Mode.', 'INFO');
      return;
    }

    // Check if auto-sync is enabled in Config sheet
    if (!isAutoSyncEnabled_()) {
      log_('Auto-sync is disabled in Config sheet. Skipping.', 'INFO');
      return;
    }

    try {
      changeDetection = detectAutoSyncChanges_();
      if (changeDetection && changeDetection.snapshot) {
        detectionSnapshot = changeDetection.snapshot;
      }
    } catch (detectionError) {
      log_('Auto-sync change detection failed: ' + detectionError.message, 'WARN');
      changeDetection = null; // Fallback to always run
    }

    if (silentMode && changeDetection && !changeDetection.shouldRun) {
      return;
    }

    if (!silentMode && changeDetection && !changeDetection.shouldRun) {
      log_('Manual sync requested — proceeding even though no changes were detected.', 'INFO');
    }

    if (changeDetection && changeDetection.reasons && changeDetection.reasons.length > 0) {
      log_('Auto-sync proceeding due to detected changes: ' + changeDetection.reasons.join('; '), 'INFO');
    }

    const startTime = new Date();
    snapshotShouldUpdate = true;
    log_('*** Starting scheduled auto-sync...');

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const spreadsheetId = spreadsheet.getId();
    const spreadsheetFile = DriveApp.getFileById(spreadsheetId);

    // Check file size first
    const maxFileSizeMB = getConfigValue_('MaxFileSizeMB', 100);
    const fileSize = spreadsheetFile.getSize();
    const fileSizeMB = fileSize / (1024 * 1024);

    if (fileSizeMB > maxFileSizeMB) {
      const errorMsg = `CRITICAL: Spreadsheet file size (${fileSizeMB.toFixed(2)} MB) exceeds the configured limit of ${maxFileSizeMB} MB. Auto-sync aborted. Please manually delete old versions from File > Version history.`;
      log_(errorMsg, 'ERROR');
      sendAdminNotification_('File Size Limit Exceeded - Manual Action Required', errorMsg);
      return; // Abort sync
    }

    const allowDeletions = getConfigValue_('AllowAutosyncDeletion', false);
    let syncSummary = { added: 0, removed: 0, failed: 0 };

    if (allowDeletions) {
        log_('Auto-sync with deletions enabled. Performing full sync...');
        const result = fullSync({ silentMode: true, excludeAdminsFromDeletion: true });
        if (result) syncSummary = result;
    } else {
        // RISK-BASED AUTO-SYNC IMPLEMENTATION
        // Auto-sync only performs SAFE operations (all additions including admins)
        // DESTRUCTIVE operations (deletions) require manual execution

        log_('Performing SAFE operations (additions only)...');
        const result = syncAdds({ silentMode: silentMode }); // Includes admin additions, user groups, and folder permissions
        if (result) syncSummary = result;

        // Check for pending DESTRUCTIVE operations and notify admin
        checkAndNotifyPendingDeletions_();
    }

    // Get revision info for sync history tracking
    let revisionLink = null;
    let revisionId = null;
    // spreadsheetId is already declared above at line 84

    try {
      // List all revisions using Drive API v3 REST endpoint
      const listUrl = `https://www.googleapis.com/drive/v3/files/${spreadsheetId}/revisions`;
      const listOptions = {
        method: 'get',
        headers: {
          Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
        },
        muteHttpExceptions: true
      };

      const listResponse = UrlFetchApp.fetch(listUrl, listOptions);
      const listData = JSON.parse(listResponse.getContentText());

      if (listData.revisions && listData.revisions.length > 0) {
        const latestRevision = listData.revisions[listData.revisions.length - 1];
        revisionId = latestRevision.id;

        // Link to version history page (Google Sheets doesn't support direct revision links via API)
        revisionLink = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/revisions`;
        log_(`Captured revision info for sync history: revision ${revisionId}`, 'INFO');
      } else {
        log_('No revisions found for sync history. This is normal for newly created files.', 'INFO');
      }
    } catch (e) {
      log_(`Could not retrieve revision info for sync history: ${e.toString()}`, 'WARN');
    }

    if (getConfigValue_('NotifyOnSyncSuccess', false)) {
      sendAutoSyncSummary_(revisionLink);
    }

    // Log sync history
    const endTime = new Date();
    const durationSeconds = Math.round((endTime - startTime) / 1000);
    logSyncHistory_(revisionId, revisionLink, syncSummary, durationSeconds);

    if (detectionSnapshot) {
      detectionSnapshot.capturedAt = new Date().toISOString();
    }

    // Check if there were any failures during sync
    if (syncSummary && syncSummary.failed > 0) {
      const errorMessage = `Auto-sync completed with ${syncSummary.failed} failure(s). Added: ${syncSummary.added}, Removed: ${syncSummary.removed}. Check the Log and ManagedFolders sheets for details.`;
      log_(errorMessage, 'ERROR');
      sendErrorNotification_(errorMessage);
    } else {
      log_('*** Scheduled auto-sync completed successfully.');
    }

  } catch (e) {
    const errorMessage = 'FATAL ERROR in autoSync: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    sendErrorNotification_(errorMessage);
  } finally {
    if (snapshotShouldUpdate) {
      let snapshotToPersist = detectionSnapshot ? detectionSnapshot : null;
      if (!snapshotToPersist) {
        try {
          const fallbackDetection = detectAutoSyncChanges_();
          snapshotToPersist = fallbackDetection && fallbackDetection.snapshot ? fallbackDetection.snapshot : null;
        } catch (fallbackError) {
          log_('Auto-sync snapshot fallback failed: ' + fallbackError.message, 'WARN');
        }
      }

      if (snapshotToPersist) {
        recordAutoSyncSnapshot_(snapshotToPersist);
      }
    }
    lock.releaseLock();
    hideSyncInProgress_();
  }
}

/**
 * Helper function to check if auto-sync is enabled.
 * Reads from the Config sheet.
 * @return {boolean} True if enabled, false otherwise
 */
function isAutoSyncEnabled_() {
  // Default to true for backward compatibility if setting is not found
  return getConfigValue_('EnableAutoSync', true);
}

function calculateDataHash_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let content = '';

  // 1. Get all managed sheet names
  const managedSheetNames = getAllManagedSheetNames_(); // From Core.gs
  managedSheetNames.add(ADMINS_SHEET_NAME);
  managedSheetNames.add(USER_GROUPS_SHEET_NAME);
  managedSheetNames.add(MANAGED_FOLDERS_SHEET_NAME);

  const sheetNamesToHash = Array.from(managedSheetNames);
  sheetNamesToHash.sort(); // Sort for consistent order

  // 2. Read content from each sheet, being specific about columns
  for (const sheetName of sheetNamesToHash) {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet && sheet.getLastRow() > 0) {
      let data;
      // Be specific about which columns to hash to avoid script-modified columns
      if (sheetName === MANAGED_FOLDERS_SHEET_NAME) {
        // Hash FolderName, FolderID, Role, and user-set GroupEmail (Cols A-D)
        const lastRow = sheet.getLastRow();
        if (lastRow > 0) {
          data = sheet.getRange(1, 1, lastRow, 4).getValues();
        } else {
          data = [];
        }
      } else if (sheetName === USER_GROUPS_SHEET_NAME) {
        // Hash GroupName and user-set GroupEmail (Cols A-B)
        const lastRow = sheet.getLastRow();
        if (lastRow > 0) {
          data = sheet.getRange(1, 1, lastRow, 2).getValues();
        } else {
          data = [];
        }
      } else if (sheetName === ADMINS_SHEET_NAME) {
        // Hash only User Email and Disabled columns (A and D)
        const lastRow = sheet.getLastRow();
        if (lastRow > 0) {
            const allData = sheet.getRange(1, 1, lastRow, 4).getValues();
            data = allData.map(row => [row[0], row[3]]); // New array with just cols A and D
        } else {
            data = [];
        }
      } else {
        // For all other (user permission) sheets, the whole content is user-managed
        data = sheet.getDataRange().getValues();
      }

      // Normalize checkbox values (true/false) to string representations
      const normalizedData = data.map(row =>
        row.map(cell => {
          if (cell === true) return 'TRUE';
          if (cell === false) return 'FALSE';
          return cell;
        })
      );
      content += sheetName + '::' + JSON.stringify(normalizedData) + '||';
    }
  }

  // 3. Compute hash
  if (content) {
    const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, content);
    return Utilities.base64Encode(hash);
  }

  return null;
}

function detectAutoSyncChanges_() {
  const props = PropertiesService.getDocumentProperties();
  let previousSnapshot = null;

  try {
    const rawSnapshot = props.getProperty(AUTO_SYNC_CHANGE_SIGNATURE_KEY);
    if (rawSnapshot) {
      previousSnapshot = JSON.parse(rawSnapshot);
    }
  } catch (e) {
    log_('Failed to parse previous auto-sync snapshot: ' + e.message, 'WARN');
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const currentDataHash = calculateDataHash_();

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
    reasons.push('No previous auto-sync snapshot was found.');
  }

  // Reason 1: Data in sheets has changed
  const previousDataHash = previousSnapshot ? previousSnapshot.dataHash : null;
  if (currentDataHash !== previousDataHash) {
    shouldRun = true;
    reasons.push('Sheet data has changed.');
    if (previousDataHash) {
        log_(`Data hash mismatch. Previous: ${previousDataHash}, Current: ${currentDataHash}`, 'INFO');
    }
  }

  // Reason 2: Managed folders have been modified
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

  // Reason 3: List of managed folders has changed
  if (previousSnapshot && previousSnapshot.folderStates) {
    Object.keys(previousSnapshot.folderStates).forEach(id => {
      if (!folderIds.has(id)) {
        shouldRun = true;
        reasons.push('Managed folder removed from sheet (' + id + ').');
      }
    });
  }

  // Reason 4: Errors during folder inspection
  if (hadFolderErrors) {
    shouldRun = true;
    reasons.push('Encountered errors while inspecting managed folders.');
  }

  const snapshot = {
    dataHash: currentDataHash,
    folderStates: folderStates,
    capturedAt: new Date().toISOString()
  };

  return {
    shouldRun,
    reasons,
    snapshot
  };
}

function recordAutoSyncSnapshot_(snapshot) {
  if (!snapshot) {
    return;
  }

  try {
    const props = PropertiesService.getDocumentProperties();
    props.setProperty(AUTO_SYNC_CHANGE_SIGNATURE_KEY, JSON.stringify(snapshot));
  } catch (e) {
    log_('Failed to persist auto-sync snapshot: ' + e.message, 'WARN');
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
function runAutoSyncNow() {
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

/**
 * Checks for pending DESTRUCTIVE operations (deletions) and notifies admin.
 * Called by autoSync() to alert admins when manual action is required.
 */
function checkAndNotifyPendingDeletions_() {
  try {
    // Check if notification is enabled
    if (!getConfigValue_('NotifyDeletionsPending', true)) {
      return;
    }

    log_('Checking for pending deletions...');

    // Build deletion plan without executing
    const planOptions = { removeOnly: true, returnPlanOnly: true };
    let deletionPlan = [];

    try {
      const groupDeletions = syncUserGroups(planOptions) || [];
      const folderDeletions = processManagedFolders_(planOptions) || [];
      deletionPlan = groupDeletions.concat(folderDeletions);
    } catch (e) {
      log_('Error during deletion planning: ' + e.message, 'WARN');
      return;
    }

    if (deletionPlan.length === 0) {
      log_('No pending deletions found.');
      return;
    }

    // Build notification message
    const totalDeletions = deletionPlan.reduce((sum, plan) => sum + (plan.usersToRemove ? plan.usersToRemove.length : 0), 0);
    log_('Found ' + totalDeletions + ' pending deletions across ' + deletionPlan.length + ' group(s).', 'WARN');

    let message = '⚠️ MANUAL ACTION REQUIRED: Permission Deletions Pending\n\n';
    message += 'Auto-sync detected users removed from permission sheets.\n';
    message += 'The following deletions require manual approval:\n\n';

    deletionPlan.forEach(plan => {
      if (plan.usersToRemove && plan.usersToRemove.length > 0) {
        message += 'From Group "' + plan.groupName + '":\n';
        plan.usersToRemove.forEach(user => {
          message += '  - ' + user + '\n';
        });
        message += '\n';
      }
    });

    message += 'To execute these deletions:\n';
    message += '1. Open the control spreadsheet\n';
    message += '2. Go to: Permissions Manager → Sync Deletes\n';
    message += '3. Review the deletion list carefully\n';
    message += '4. Confirm to proceed\n\n';
    message += 'Note: Deletions will NOT execute automatically.\n';

    sendAdminNotification_('⚠️ Manual Action Required: ' + totalDeletions + ' Permission Deletions Pending', message);
    log_('Admin notified of pending deletions via email.', 'INFO');

  } catch (e) {
    log_('Error in checkAndNotifyPendingDeletions_: ' + e.message, 'ERROR');
  }
}

/**
 * Sends a summary email after auto-sync completion.
 * Includes statistics about what was synced and any pending manual actions.
 */
function sendAutoSyncSummary_(revisionLink) {
  try {
    // Check if notification is enabled
    if (!getConfigValue_('NotifyAfterSync', true)) {
      return;
    }

    log_('Sending auto-sync summary email...');

    const timestamp = Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss');

    let message = '✅ Auto-Sync Completed Successfully\n\n';
    message += 'Timestamp: ' + timestamp + '\n\n';
    message += 'SAFE operations completed:\n';
    message += '- User groups synced (additions)\n';
    message += '- Folder permissions synced (additions)\n';
    message += '- Admin list synced (additions)\n\n';
    message += 'Check the Log sheet for detailed results.\n\n';
    message += '---\n';
    message += 'Spreadsheet: ' + SpreadsheetApp.getActiveSpreadsheet().getName() + '\n';
    if (revisionLink) {
      message += 'Link to synced version: ' + revisionLink + '\n';
    } else {
      message += 'URL: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl() + '\n';
    }

    sendAdminNotification_('✅ Auto-Sync Completed - ' + timestamp, message);
    log_('Auto-sync summary email sent.', 'INFO');

  } catch (e) {
    log_('Error in sendAutoSyncSummary_: ' + e.message, 'WARN');
  }
}

/**
 * Sends a notification email to admin(s).
 * Reads email address from Config sheet.
 *
 * @param {string} subject - Email subject
 * @param {string} message - Email body
 */
function sendAdminNotification_(subject, message) {
  try {
    const adminEmail = getConfigValue_('NotificationEmail', Session.getEffectiveUser().getEmail());

    if (!adminEmail) {
      log_('No admin email configured for notifications.', 'WARN');
      return;
    }

    MailApp.sendEmail({
      to: adminEmail,
      subject: '[Drive Permission Manager] ' + subject,
      body: message
    });

    log_('Notification email sent to: ' + adminEmail);

  } catch (e) {
    log_('Failed to send admin notification: ' + e.message, 'ERROR');
  }
}

/**
 * Helper function to get a value from the Config sheet.
 *
 * @param {string} key - The setting name to look up
 * @param {*} defaultValue - Default value if not found
 * @return {*} The value from Config sheet, or defaultValue if not found
 */
function getConfigValue_(key, defaultValue) {
  try {
    const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET_NAME);
    if (!configSheet) {
      return defaultValue;
    }

    const data = configSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        const value = data[i][1];
        // Handle boolean strings
        if (value === 'TRUE' || value === true || (typeof value === 'string' && value.toUpperCase() === 'ENABLED')) return true;
        if (value === 'FALSE' || value === false || (typeof value === 'string' && value.toUpperCase() === 'DISABLED')) return false;
        return value !== '' ? value : defaultValue;
      }
    }

    return defaultValue;

  } catch (e) {
    log_('Error reading config value for ' + key + ': ' + e.message, 'WARN');
    return defaultValue;
  }
}



function updateAutoSyncStatusIndicator_() {
  try {
    const isEnabledInConfig = isAutoSyncEnabled_();
    let statusToDisplay = 'N/A'; // Default if no trigger has ever been set

    // Read the current AutoSyncStatus from the Config sheet
    const currentAutoSyncStatus = getConfigValue_('AutoSyncStatus', 'N/A');

    if (isEnabledInConfig) {
      // If enabled in config, and it's not already ENABLED, set it to ENABLED
      if (currentAutoSyncStatus !== 'ENABLED ✅') {
        statusToDisplay = 'ENABLED ✅';
      } else {
        statusToDisplay = currentAutoSyncStatus; // Keep current if already enabled
      }
    } else {
      // If disabled in config, set to PAUSED
      statusToDisplay = 'PAUSED ⏸️';
    }

    updateConfigSetting_('AutoSyncStatus', statusToDisplay);
  } catch (e) {
    // This is a non-critical UI feature, so don't throw an error, just log it.
    log_('Could not update Auto-Sync status indicator: ' + e.message, 'WARN');
  }
}
