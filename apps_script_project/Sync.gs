/**
 * Synchronizes the editors of the spreadsheet file with the list in the SheetEditors sheet.
 *
 * @param {Object} options - Options for sync behavior
 * @param {boolean} options.addOnly - If true, only add editors (SAFE operations for AutoSync)
 * @param {boolean} options.silentMode - If true, skip UI dialogs (for background execution)
 * @returns {object} A summary of the changes made, with properties for `added` and `removed` counts.
 */
function syncSheetEditors(options = {}) {
  const addOnly = options && options.addOnly !== undefined ? options.addOnly : false;
  const silentMode = options && options.silentMode !== undefined ? options.silentMode : false;
  const totalSummary = { added: 0, removed: 0, failed: 0 };
  let sheetEditorsSheet;
  try {
    log_('Running Sheet Editors Sync... (addOnly: ' + addOnly + ', silentMode: ' + silentMode + ')');
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    sheetEditorsSheet = spreadsheet.getSheetByName(SHEET_EDITORS_SHEET_NAME);
    if (!sheetEditorsSheet) {
      log_('SheetEditors sheet not found. Skipping sheet editors sync.');
      if (!silentMode) SpreadsheetApp.getUi().alert('SheetEditors sheet not found. Skipping sheet editors sync.');
      return totalSummary;
    }

    // Get admin group email from Config sheet
    let adminGroupEmail = getConfigValue_('AdminGroupEmail', '');
    if (adminGroupEmail) {
      adminGroupEmail = adminGroupEmail.toString().trim().toLowerCase();
    }
    // Validate that adminGroupEmail is a valid email format (contains @ and a domain)
    const emailPattern = /^\S+@\S+\.\S+$/;
    if (!adminGroupEmail || !emailPattern.test(adminGroupEmail)) {
      if (adminGroupEmail) {
        log_('Invalid admin group email in Config: "' + adminGroupEmail + '". Regenerating...', 'WARN');
      }
      adminGroupEmail = generateGroupEmail_(SHEET_EDITORS_GROUP_NAME);
      // Save the generated email to Config immediately
      updateConfigSetting_('AdminGroupEmail', adminGroupEmail);
    }

    // 1. Get desired editors
    const adminData = sheetEditorsSheet.getRange('A2:D' + sheetEditorsSheet.getLastRow()).getValues();
    const adminEmails = adminData.filter(function(row) {
      const email = row[0].toString().trim().toLowerCase();
      const isDisabled = row[3];
      return email && email.length > 0 && !isDisabled;
    }).map(function(row) {
      return row[0].toString().trim().toLowerCase();
    });
    const adminSet = new Set(adminEmails);

    // 2. Get current editors
    const currentEditors = spreadsheet.getEditors()
      .map(function(user) { return user.getEmail().toLowerCase(); });
    const editorSet = new Set(currentEditors);

    // 3. Determine changes
    const owner = spreadsheet.getOwner();
    if (owner) {
      adminSet.add(owner.getEmail().toLowerCase());
    }

    const emailsToAdd = adminEmails.filter(function(email) { return !editorSet.has(email); });
    const emailsToRemove = currentEditors.filter(function(email) { return !adminSet.has(email); });

    // In addOnly mode, skip removals (DESTRUCTIVE operations)
    if (addOnly && emailsToRemove.length > 0) {
      log_('SAFE mode: Skipping ' + emailsToRemove.length + ' sheet editor removal(s). Run "Sync Sheet Editors" manually to process removals.', 'WARN');
      // Continue with additions only
    }

    if (emailsToAdd.length === 0 && (addOnly || emailsToRemove.length === 0)) {
      syncSheetEditorsGroup_(sheetEditorsSheet, adminGroupEmail, { addOnly: addOnly });
      log_('Sheet editor list is already up to date.');
      if (!silentMode) {
        if (SCRIPT_EXECUTION_MODE === 'TEST') {
          showTestMessage_('Sheet Editors Sync', 'Sheet editor list is already up to date. No changes were needed. Editors group synced to ' + adminGroupEmail + '.');
        } else {
          SpreadsheetApp.getUi().alert('Sheet editor list is already up to date. No changes were needed.\nEditors group synced to ' + adminGroupEmail + '.');
        }
      }
      return totalSummary;
    }

    // Build confirmation message
    let confirmationMessage = 'Sheet Editors Sync will make the following changes to the editors of this spreadsheet:\n';
    if (emailsToAdd.length > 0) {
      confirmationMessage += '\nADD:\n';
      emailsToAdd.forEach(function(email) { confirmationMessage += '  - ' + email + '\n'; });
    }
    if (!addOnly && emailsToRemove.length > 0) {
      confirmationMessage += '\nREMOVE:\n';
      emailsToRemove.forEach(function(email) { confirmationMessage += '  - ' + email + '\n'; });
    }

    // In silent mode or addOnly mode with only additions, skip confirmation
    if (!silentMode && !addOnly && emailsToRemove.length > 0) {
      confirmationMessage += '\nAre you sure you want to continue?';
      const response = SpreadsheetApp.getUi().alert('Confirm Sheet Editors Sync', confirmationMessage, SpreadsheetApp.getUi().ButtonSet.YES_NO);

      if (response !== SpreadsheetApp.getUi().Button.YES) {
        if (!silentMode) SpreadsheetApp.getUi().alert('Sheet editors sync cancelled.');
        log_('Sheet editors sync cancelled by user.');
        sheetEditorsSheet.getRange(ADMINS_STATUS_CELL).setValue('CANCELLED');
        return totalSummary;
      }
    } else {
      // Log changes in silent/addOnly mode
      log_('AUTO-SYNC: Processing sheet editor changes without confirmation:');
      log_(confirmationMessage);
    }

    sheetEditorsSheet.getRange(ADMINS_STATUS_CELL).setValue('Processing...');

    // 5. Perform the additions
    if (emailsToAdd.length > 0) {
      log_('Adding ' + emailsToAdd.length + ' editor(s): ' + emailsToAdd.join(', '));
      spreadsheet.addEditors(emailsToAdd);
      totalSummary.added = emailsToAdd.length;
    }

    // Perform removals only if not in addOnly mode
    if (!addOnly && emailsToRemove.length > 0) {
      log_('Removing ' + emailsToRemove.length + ' editor(s): ' + emailsToRemove.join(', '));
      emailsToRemove.forEach(function(email) {
        try {
          spreadsheet.removeEditor(email);
        } catch (e) {
          log_('Failed to remove editor ' + email + ': ' + e.message, 'ERROR');
        }
      });
      totalSummary.removed = emailsToRemove.length;
    }

    syncSheetEditorsGroup_(sheetEditorsSheet, adminGroupEmail, { addOnly: addOnly });

    log_('Sheet editors sync complete. Editors group email: ' + adminGroupEmail + '.');
    if (!silentMode) {
      if (SCRIPT_EXECUTION_MODE === 'TEST') {
        showTestMessage_('Sheet Editors Sync', 'Sheet editors sync complete. Editors group synced to ' + adminGroupEmail + '.');
      } else {
        SpreadsheetApp.getUi().alert('Sheet editors sync complete.\nEditors group synced to ' + adminGroupEmail + '.');
      }
    }

  } catch (e) {
    log_('ERROR in syncSheetEditors: ' + e.toString());
    if (sheetEditorsSheet) {
      try {
        sheetEditorsSheet.getRange(ADMINS_STATUS_CELL).setValue('ERROR: ' + e.message);
      } catch (ignored) {}
    }
    if (!silentMode) SpreadsheetApp.getUi().alert('An error occurred during Sheet Editors sync: ' + e.message);
  }
  return totalSummary;
}

function syncSheetEditorsGroup_(sheetEditorsSheet, adminGroupEmail, options = {}) {
  const addOnly = options && options.addOnly !== undefined ? options.addOnly : false;
  const statusCell = sheetEditorsSheet.getRange(ADMINS_STATUS_CELL);
  const lastSyncedCell = sheetEditorsSheet.getRange(ADMINS_LAST_SYNC_CELL);
  statusCell.setValue('Processing group sync...');
  const timestamp = Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  if (shouldSkipGroupOps_()) {
    log_('Admin Directory service not available. Skipping Sheet Editors group sync.', 'WARN');
    statusCell.setValue('SKIPPED (No Admin SDK)');
    lastSyncedCell.setValue(timestamp);
    return null;
  }

  try {
    getOrCreateGroup_(adminGroupEmail, SHEET_EDITORS_GROUP_NAME);
    const summary = syncGroupMembership_(adminGroupEmail, SHEET_EDITORS_SHEET_NAME, { addOnly: addOnly });

    // Update the Config sheet with the admin group email
    updateConfigSetting_('AdminGroupEmail', adminGroupEmail);

    statusCell.setValue('OK');
    lastSyncedCell.setValue(timestamp);
    return summary;
  } catch (e) {
    statusCell.setValue('ERROR: ' + e.message);
    throw e;
  }
}



function syncUserGroups(options = {}) {
  const returnPlanOnly = options && options.returnPlanOnly !== undefined ? options.returnPlanOnly : false;
  const silentMode = options && options.silentMode !== undefined ? options.silentMode : false;
  let deletionPlan = [];
  const totalSummary = { added: 0, removed: 0, failed: 0 };

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const userGroupsSheet = ss.getSheetByName(USER_GROUPS_SHEET_NAME);
    if (!userGroupsSheet) {
      if (!returnPlanOnly && !silentMode) SpreadsheetApp.getUi().alert('UserGroups sheet not found.');
      return returnPlanOnly ? [] : totalSummary;
    }

    const lastRow = userGroupsSheet.getLastRow();
    if (lastRow < 2) {
        log_('No data rows to process in UserGroups sheet.');
        return returnPlanOnly ? [] : totalSummary;
    }
    
    // If Admin SDK is unavailable, we can't create a plan or sync.
    if (shouldSkipGroupOps_()) {
      const skipMessage = 'Admin SDK (Admin Directory) not available. Skipping syncUserGroups.';
      log_(skipMessage, 'WARN');
      if (returnPlanOnly) {
        throw new Error(skipMessage + ' Enable the Admin SDK to plan user group removals.');
      }

      const dataRange = userGroupsSheet.getRange(2, 1, lastRow - 1, 5);
      const data = dataRange.getValues();
      for (let i = 0; i < data.length; i++) {
        const rowIndex = i + 2;
        if (data[i][0]) { // If there's a group name
          userGroupsSheet.getRange(rowIndex, 4).setValue(Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss'));
          userGroupsSheet.getRange(rowIndex, 5).setValue('SKIPPED (No Admin SDK)');
        }
      }
      if (!silentMode) SpreadsheetApp.getUi().alert('User group sync skipped: Admin Directory service not available.');
      return totalSummary;
    }
    
    const dataRange = userGroupsSheet.getRange(2, 1, lastRow - 1, 5);
    const data = dataRange.getValues();

    for (let i = 0; i < data.length; i++) {
      const rowIndex = i + 2;
      try {
        let groupName = data[i][0];
        let groupEmail = data[i][1];

        if (!groupName) {
          continue;
        }
        
        log_('Processing user group: ' + groupName);

        if (!groupEmail) {
          groupEmail = generateGroupEmail_(groupName);
          log_('Generated group email for ' + groupName + ': ' + groupEmail);
        }

        if (returnPlanOnly) {
          const groupSheetName = groupName + '_G';
          const plan = syncGroupMembership_(groupEmail, groupSheetName, options);
          if (plan) {
            deletionPlan.push(plan);
          }
        } else {
          const groupEmailCell = userGroupsSheet.getRange(rowIndex, 2);
          const groupAdminLinkCell = userGroupsSheet.getRange(rowIndex, 3);
          const lastSyncedCell = userGroupsSheet.getRange(rowIndex, 4);
          const statusCell = userGroupsSheet.getRange(rowIndex, 5);

          statusCell.setValue('Processing...');
          if (!silentMode) showToast_('Processing user group: ' + groupName + '...', 'Sync Progress', 10);
          
          if (!data[i][1]) { // If groupEmail was generated, write it to the sheet
            groupEmailCell.setValue(groupEmail);
          }

          const groupSheetName = groupName + '_G';
          getOrCreateUserSheet_(groupSheetName);
          const groupResult = getOrCreateGroup_(groupEmail, groupName);
          const adminLink = 'https://admin.google.com/ac/groups/' + groupResult.group.id + '/members';
          groupAdminLinkCell.setValue(adminLink);

          const summary = syncGroupMembership_(groupEmail, groupSheetName, options);
          if (summary) {
            totalSummary.added += summary.added;
            totalSummary.removed += summary.removed;
            totalSummary.failed += summary.failed;
          }

          lastSyncedCell.setValue(Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss'));
          statusCell.setValue('OK');
          log_('Successfully synced user group: ' + groupName);
        }

      } catch (e) {
        if (!returnPlanOnly) {
          const statusCell = userGroupsSheet.getRange(rowIndex, 5);
          const errorMessage = 'ERROR: ' + e.message;
          log_('Failed to process user group row ' + rowIndex + '. Error: ' + e.message + ' Stack: ' + e.stack, 'ERROR');
          statusCell.setValue(errorMessage);
        } else {
          log_('Error during deletion planning for group ' + (data[i][0] || 'unknown') + '. Error: ' + e.message, 'WARN');
        }
      }
    }

    if (returnPlanOnly) {
      return deletionPlan;
    }

    const summaryMessage = 'User groups sync complete. Total changes: ' + totalSummary.added + ' added, ' + totalSummary.removed + ' removed, ' + totalSummary.failed + ' failed.';
    log_(summaryMessage, 'INFO');
    
    if (SCRIPT_EXECUTION_MODE === 'TEST') {
      showTestMessage_('User Groups Sync', summaryMessage);
    } else if (!silentMode) {
      SpreadsheetApp.getUi().alert(summaryMessage);
    }

  } catch (e) {
    const errorMessage = 'FATAL ERROR in syncUserGroups: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    if (!returnPlanOnly && !silentMode) {
      SpreadsheetApp.getUi().alert('A fatal error occurred during user group sync: ' + e.message);
      sendErrorNotification_(errorMessage);
    } else {
      throw e; // Re-throw for the planner to catch
    }
  }
  return totalSummary;
}

function syncAdds(options = {}) {
  const silentMode = options && options.silentMode !== undefined ? options.silentMode : false;
  const skipSetup = options && options.skipSetup !== undefined ? options.skipSetup : false;

  if (!skipSetup) {
    setupControlSheets_();
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    if (!silentMode) SpreadsheetApp.getUi().alert('Sync is already in progress. Please wait a few minutes and try again.');
    return;
  }

  const totalSummary = { added: 0, removed: 0, failed: 0 };
  const startTime = new Date();

  try {
    validateManagedFolders_();
    if (!silentMode) showToast_('Adding users to groups...', 'Add Users', -1);
    log_('*** Starting user addition synchronization...');

    const orphanSheets = checkForOrphanSheets_();
    if (orphanSheets && orphanSheets.length > 0) {
      const errorMessage = 'SYNC ABORTED: Found orphan sheets that are not in the configuration: ' +
                           orphanSheets.join(', ') +
                           '.\n\n' +
                           'To resolve this:\n' +
                           '1. Go to: Permissions Manager → Advanced → Delete Orphan Sheets\n' +
                           '2. Or add these sheets to ManagedFolders/UserGroups configuration\n\n' +
                           'Note: You may also need to manually delete related Google Groups from the Google Workspace Admin console.';
      log_(errorMessage, 'ERROR');
      if (!silentMode) {
        SpreadsheetApp.getUi().alert(errorMessage);
      }
      throw new Error('Orphan sheets found. Sync aborted.');
    }

    // 1. Sync Sheet Editors (SAFE mode: additions only, silent for AutoSync)
    const adminSummary = syncSheetEditors({ addOnly: true, silentMode: true });
    if (adminSummary) {
      totalSummary.added += adminSummary.added;
      totalSummary.failed += adminSummary.failed;
    }

    // 2. Sync User Groups (creates groups, adds members)
    const userGroupsSummary = syncUserGroups({ addOnly: true, silentMode: silentMode });
    if (userGroupsSummary) {
      totalSummary.added += userGroupsSummary.added;
      totalSummary.failed += userGroupsSummary.failed;
    }

    // 3. Process Managed Folders (creates folders, permissions, adds members)
    const managedFoldersSummary = processManagedFolders_({
      addOnly: true,
      silentMode: silentMode,
      executionSource: options.executionSource
    });
    if (managedFoldersSummary) {
      totalSummary.added += managedFoldersSummary.added;
      totalSummary.failed += managedFoldersSummary.failed;
    }

    const summaryMessage = 'User addition complete. Total changes: ' + totalSummary.added + ' added, ' + totalSummary.failed + ' failed.';
    log_(summaryMessage, 'INFO');

    // Log to SyncHistory
    const endTime = new Date();
    const durationSeconds = (endTime - startTime) / 1000;
    logSyncHistory_(null, totalSummary, durationSeconds);

    // Clear the infinite toast
    if (!silentMode) showToast_('User addition complete!', 'Add Users', 5);

    if (SCRIPT_EXECUTION_MODE === 'TEST') {
      showTestMessage_('Add Users', summaryMessage);
    } else if (!silentMode) {
      SpreadsheetApp.getUi().alert(summaryMessage + '\n\nCheck the \'Status\' column in the sheets for details.');
    }

    return totalSummary;

  } catch (e) {
    const errorMessage = 'FATAL ERROR in syncAdds: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    if (!silentMode) showToast_('User addition failed with a fatal error.', 'Add Users', 5);
    if (!silentMode) SpreadsheetApp.getUi().alert('A fatal error occurred during user addition: ' + e.message);
    sendErrorNotification_(errorMessage);
  } finally {
    lock.releaseLock();
    hideSyncInProgress_();
  }
}

function syncDeletes() {
  const ui = SpreadsheetApp.getUi();
  
  // --- Phase 1: Planning ---
  log_('*** Starting user removal planning phase...');
  showToast_('Planning user removals...', 'Remove Users', 10);
  
  let deletionPlan = [];
  try {
    const planOptions = { removeOnly: true, returnPlanOnly: true };
    const groupDeletions = syncUserGroups(planOptions);
    const folderDeletions = processManagedFolders_(planOptions);
    deletionPlan = (groupDeletions || []).concat(folderDeletions || []);
  } catch (e) {
    const errorMessage = 'FATAL ERROR during user removal planning: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    showToast_('User removal planning failed with a fatal error.', 'Remove Users', 5);
    ui.alert('A fatal error occurred during the user removal planning phase: ' + e.message);
    sendErrorNotification_(errorMessage);
    return;
  }

  if (deletionPlan.length === 0) {
    log_('No user removals are pending.');
    ui.alert('No pending user removals found.');
    return;
  }

  // --- Phase 2: Confirmation ---
  let confirmationMessage = 'This will remove the following users from groups:\n';
  deletionPlan.forEach(plan => {
    confirmationMessage += '\nFrom Group \'' + plan.groupName + '\':\n';
    plan.usersToRemove.forEach(user => {
      confirmationMessage += '  - ' + user + '\n';
    });
  });
  confirmationMessage += '\nAre you sure you want to continue?';

  const response = ui.alert(
    'Confirm User Removal',
    confirmationMessage,
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    ui.alert('User removal cancelled.');
    return;
  }

  // --- Re-run Phase 1: Planning (after user confirmation) ---
  // This ensures the removal plan is based on the most up-to-date sheet data
  // in case the user made changes during the confirmation dialog.
  log_('*** Re-running user removal planning phase after user confirmation...');
  showToast_('Re-planning user removals...', 'Remove Users', 10);
  
  deletionPlan = []; // Clear previous plan
  try {
    const planOptions = { removeOnly: true, returnPlanOnly: true };
    const groupDeletions = syncUserGroups(planOptions);
    const folderDeletions = processManagedFolders_(planOptions);
    deletionPlan = (groupDeletions || []).concat(folderDeletions || []);
  } catch (e) {
    const errorMessage = 'FATAL ERROR during re-planning user removal after confirmation: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    showToast_('User removal re-planning failed with a fatal error.', 'Remove Users', 5);
    ui.alert('A fatal error occurred during the user removal re-planning phase: ' + e.message);
    sendErrorNotification_(errorMessage);
    return;
  }

  if (deletionPlan.length === 0) {
    log_('No user removals are pending after re-planning. This might happen if changes were reverted.');
    ui.alert('No pending user removals found after re-planning. Operation cancelled.');
    return;
  }

  // --- Phase 3: Execution ---
  setupControlSheets_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    ui.alert('Sync is already in progress. Please wait a few minutes and try again.');
    return;
  }

  const totalSummary = { added: 0, removed: 0, failed: 0 };

  try {
    showToast_('Removing users from groups...', 'Remove Users', -1);
    log_('*** Starting user removal synchronization...');

    const execOptions = { removeOnly: true };
    const userGroupsSummary = syncUserGroups(execOptions);
    if (userGroupsSummary) {
      totalSummary.removed += userGroupsSummary.removed;
      totalSummary.failed += userGroupsSummary.failed;
    }

    const managedFoldersSummary = processManagedFolders_(execOptions);
    if (managedFoldersSummary) {
      totalSummary.removed += managedFoldersSummary.removed;
      totalSummary.failed += managedFoldersSummary.failed;
    }

    const summaryMessage = 'User removal complete. Total changes: ' + totalSummary.removed + ' removed, ' + totalSummary.failed + ' failed.';
    log_(summaryMessage, 'INFO');

    showToast_('User removal complete!', 'Remove Users', 5);
    ui.alert(summaryMessage + '\n\nCheck the \'Status\' column in the sheets for details.');

  } catch (e) {
    const errorMessage = 'FATAL ERROR in syncDeletes: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    showToast_('Delete-only sync failed with a fatal error.', 'Sync Deletes', 5);
    ui.alert('A fatal error occurred during delete-only sync: ' + e.message);
    sendErrorNotification_(errorMessage);
  } finally {
    lock.releaseLock();
    hideSyncInProgress_();
  }
}

function fullSync(options = {}) {
  const silentMode = options && options.silentMode !== undefined ? options.silentMode : false;
  const skipSetup = options && options.skipSetup !== undefined ? options.skipSetup : false;

  log_('Running script version 2.0');

  if (!skipSetup) {
    setupControlSheets_(); // Ensure control sheets exist
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    if (!silentMode) SpreadsheetApp.getUi().alert('Sync is already in progress. Please wait a few minutes and try again.');
    return;
  }

  const totalSummary = { added: 0, removed: 0, failed: 0 };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const startTime = new Date();

  try {
    if (!silentMode) showToast_('Starting full synchronization...', 'Full Sync', -1);
    log_('*** Starting full synchronization...');

    // --- PRE-SYNC CHECKS ---
    validateManagedFolders_();
    const enableCircularCheck = getConfigValue_('EnableCircularDependencyCheck', true);
    if (enableCircularCheck === true) {
      validateGroupNesting_(); // Check for circular dependencies
    } else {
      log_('Circular dependency check is disabled in Config.', 'INFO');
    }

    const orphanSheets = checkForOrphanSheets_();
    if (orphanSheets && orphanSheets.length > 0) {
      const errorMessage = 'SYNC ABORTED: Found orphan sheets that are not in the configuration: ' +
                           orphanSheets.join(', ') +
                           '.\n\n' +
                           'To resolve this:\n' +
                           '1. Go to: Permissions Manager → Advanced → Delete Orphan Sheets\n' +
                           '2. Or add these sheets to ManagedFolders/UserGroups configuration\n\n' +
                           'Note: You may also need to manually delete related Google Groups from the Google Workspace Admin console.';
      log_(errorMessage, 'ERROR');
      if (!silentMode) {
        SpreadsheetApp.getUi().alert(errorMessage);
      }
      throw new Error('Orphan sheets found. Sync aborted.');
    }

    // Validate unique group emails before starting
    const validation = validateUniqueGroupEmails_();
    if (!validation.valid) {
      const errorDetails = validation.errors.map(e => e.message).join('\n\n');
      const errorMessage = 'VALIDATION ERROR: Duplicate group emails detected!\n\n' + errorDetails +
        '\n\nEach group must have a unique email address. Please fix these duplicates and try again.';
      log_(errorMessage, 'ERROR');
      if (!silentMode) SpreadsheetApp.getUi().alert(errorMessage);
      throw new Error('Duplicate group emails detected. Sync aborted.');
    }

    // --- PROCESS DELETION REQUESTS ---
    // Process groups and folders marked for deletion BEFORE regular sync
    const deletionSummary = processDeletionRequests_(options);
    if (deletionSummary && !deletionSummary.skipped) {
      log_(`Deletions processed: ${deletionSummary.userGroupsDeleted} group(s), ${deletionSummary.foldersDeleted} folder-binding(s)`, 'INFO');
      // Track deletions separately (not in totalSummary which is for user additions/removals)
    }

    // 1. Sync Sheet Editors (run silently - fullSync will show final summary)
    const adminSummary = syncSheetEditors(Object.assign({}, options, { silentMode: true }));
    if (adminSummary) {
      totalSummary.added += adminSummary.added;
      totalSummary.removed += adminSummary.removed;
      totalSummary.failed += adminSummary.failed;
    }

    // 2. Sync User Groups (run silently - fullSync will show final summary)
    const userGroupsSummary = syncUserGroups(Object.assign({}, options, { silentMode: true }));
    if (userGroupsSummary) {
      totalSummary.added += userGroupsSummary.added;
      totalSummary.removed += userGroupsSummary.removed;
      totalSummary.failed += userGroupsSummary.failed;
    }

    // 3. Process Managed Folders (run silently - fullSync will show final summary)
    const managedFoldersSummary = processManagedFolders_(Object.assign({}, options, { silentMode: true }));
    if (managedFoldersSummary) {
      totalSummary.added += managedFoldersSummary.added;
      totalSummary.removed += managedFoldersSummary.removed;
      totalSummary.failed += managedFoldersSummary.failed;
    }

    // Build summary message including deletions if any
    let summaryMessage = 'Full synchronization completed. Total changes: ' + totalSummary.added + ' added, ' + totalSummary.removed + ' removed, ' + totalSummary.failed + ' failed.';
    if (deletionSummary && !deletionSummary.skipped) {
      const totalDeleted = deletionSummary.userGroupsDeleted + deletionSummary.foldersDeleted;
      if (totalDeleted > 0) {
        summaryMessage += '\nDeletions: ' + deletionSummary.userGroupsDeleted + ' group(s), ' + deletionSummary.foldersDeleted + ' folder-binding(s).';
      }
    }
    log_(summaryMessage, 'INFO');

    // Log to SyncHistory
    const endTime = new Date();
    const durationSeconds = (endTime - startTime) / 1000;
    logSyncHistory_(null, totalSummary, durationSeconds);

    // Clear the infinite toast
    if (!silentMode) showToast_('Full sync complete!', 'Full Sync', 5);

    if (SCRIPT_EXECUTION_MODE === 'TEST') {
      showTestMessage_('Full Sync', summaryMessage + '\n\nCheck the \'Status\' column in the \'ManagedFolders\' sheet for details.');
    } else if (!silentMode) {
      SpreadsheetApp.getUi().alert(summaryMessage + '\n\nCheck the \'Status\' column in the \'ManagedFolders\' sheet for details.');
    }

    return totalSummary;

  } catch (e) {
    const errorMessage = 'FATAL ERROR in fullSync: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    if (!silentMode) showToast_('Full sync failed with a fatal error.', 'Full Sync', 5);
    if (!silentMode) SpreadsheetApp.getUi().alert('A fatal error occurred: ' + e.message);
    sendErrorNotification_(errorMessage);
  } finally {
    lock.releaseLock();
    hideSyncInProgress_();
  }
}

function syncManagedFoldersAdds() {
  setupControlSheets_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    SpreadsheetApp.getUi().alert('Sync is already in progress. Please wait a few minutes and try again.');
    return;
  }

  try {
    showToast_('Starting folder-only sync (adds only)...', 'Sync Folders - Adds', -1);
    log_('*** Starting Managed Folders only synchronization (adds only)...');

    const summary = processManagedFolders_({ addOnly: true });
    const summaryMessage = 'Folder-only sync (adds) complete. Total changes: ' + summary.added + ' added, ' + summary.failed + ' failed.';
    log_(summaryMessage, 'INFO');

    showToast_('Folder-only sync (adds) complete!', 'Sync Folders - Adds', 5);
    SpreadsheetApp.getUi().alert(summaryMessage + '\n\nCheck the \'Status\' column in the \'ManagedFolders\' sheet for details.');

  } catch (e) {
    const errorMessage = 'FATAL ERROR in syncManagedFoldersAdds: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    showToast_('Folder-only sync (adds) failed with a fatal error.', 'Sync Folders - Adds', 5);
    SpreadsheetApp.getUi().alert('A fatal error occurred during folder-only sync (adds): ' + e.message);
    sendErrorNotification_(errorMessage);
  } finally {
    lock.releaseLock();
    hideSyncInProgress_();
  }
}

function syncManagedFoldersDeletes() {
  const ui = SpreadsheetApp.getUi();
  
  // --- Phase 1: Planning ---
  log_('*** Starting folder deletion planning phase...');
  showToast_('Planning folder deletions...', 'Sync Deletes', 10);
  
  let deletionPlan = [];
  try {
    const planOptions = { removeOnly: true, returnPlanOnly: true };
    deletionPlan = processManagedFolders_(planOptions) || [];
  } catch (e) {
    const errorMessage = 'FATAL ERROR during folder deletion planning: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    showToast_('Deletion planning failed with a fatal error.', 'Sync Deletes', 5);
    ui.alert('A fatal error occurred during the deletion planning phase: ' + e.message);
    sendErrorNotification_(errorMessage);
    return;
  }

  if (deletionPlan.length === 0) {
    log_('No folder deletions are pending.');
    ui.alert('No pending folder deletions found.');
    return;
  }

  // --- Phase 2: Confirmation ---
  let confirmationMessage = 'This will process deletions for Managed Folders and remove the following users:\n';
  deletionPlan.forEach(plan => {
    confirmationMessage += '\nFrom Group \'' + plan.groupName + '\':\n';
    plan.usersToRemove.forEach(user => {
      confirmationMessage += '  - ' + user + '\n';
    });
  });
  confirmationMessage += '\nAre you sure you want to continue?';

  const response = ui.alert(
    'Confirm Destructive Sync',
    confirmationMessage,
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    ui.alert('Delete sync cancelled.');
    return;
  }

  // --- Re-run Phase 1: Planning (after user confirmation) ---
  // This ensures the deletion plan is based on the most up-to-date sheet data
  // in case the user made changes during the confirmation dialog.
  log_('*** Re-running folder deletion planning phase after user confirmation...');
  showToast_('Re-planning folder deletions...', 'Sync Deletes', 10);
  
  deletionPlan = []; // Clear previous plan
  try {
    const planOptions = { removeOnly: true, returnPlanOnly: true };
    deletionPlan = processManagedFolders_(planOptions) || [];
  } catch (e) {
    const errorMessage = 'FATAL ERROR during re-planning folder deletion after confirmation: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    showToast_('Folder deletion re-planning failed with a fatal error.', 'Sync Deletes', 5);
    ui.alert('A fatal error occurred during the folder deletion re-planning phase: ' + e.message);
    sendErrorNotification_(errorMessage);
    return;
  }

  if (deletionPlan.length === 0) {
    log_('No folder deletions are pending after re-planning. This might happen if changes were reverted.');
    ui.alert('No pending folder deletions found after re-planning. Sync cancelled.');
    return;
  }

  // --- Phase 3: Execution ---
  setupControlSheets_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    ui.alert('Sync is already in progress. Please wait a few minutes and try again.');
    return;
  }

  const totalSummary = { added: 0, removed: 0, failed: 0 };

  try {
    showToast_('Starting destructive sync (deletes only)...', 'Sync Deletes', -1);
    log_('*** Starting destructive synchronization (deletes only)...');

    const execOptions = { removeOnly: true };
    const userGroupsSummary = syncUserGroups(execOptions);
    if (userGroupsSummary) {
      totalSummary.removed += userGroupsSummary.removed;
      totalSummary.failed += userGroupsSummary.failed;
    }

    const managedFoldersSummary = processManagedFolders_(execOptions);
    if (managedFoldersSummary) {
      totalSummary.removed += managedFoldersSummary.removed;
      totalSummary.failed += managedFoldersSummary.failed;
    }

    const summaryMessage = 'Destructive folder-only sync (deletes only) is complete. Total changes: ' + totalSummary.removed + ' removed, ' + totalSummary.failed + ' failed.';
    log_(summaryMessage, 'INFO');

    showToast_('Folder-only sync (deletes) complete!', 'Sync Folders - Deletes', 5);
    ui.alert(summaryMessage + '\n\nCheck the \'Status\' column in the \'ManagedFolders\' sheet for details.');

  } catch (e) {
    const errorMessage = 'FATAL ERROR in syncManagedFoldersDeletes: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    showToast_('Folder-only sync (deletes) failed with a fatal error.', 'Sync Folders - Deletes', 5);
    ui.alert('A fatal error occurred during folder-only sync (deletes): ' + e.message);
    sendErrorNotification_(errorMessage);
  } finally {
    lock.releaseLock();
    hideSyncInProgress_();
  }
}

function getAllManagedSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = new Set();

  // Add main control sheets
  sheets.add(ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME));
  sheets.add(ss.getSheetByName(USER_GROUPS_SHEET_NAME));
  sheets.add(ss.getSheetByName(SHEET_EDITORS_SHEET_NAME));

  // Add user sheets from ManagedFolders
  const managedFoldersSheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (managedFoldersSheet && managedFoldersSheet.getLastRow() > 1) {
    const userSheetNames = managedFoldersSheet.getRange(2, USER_SHEET_NAME_COL, managedFoldersSheet.getLastRow() - 1, 1).getValues().flat();
    userSheetNames.forEach(name => {
      if (name) sheets.add(ss.getSheetByName(name));
    });
  }

  // Add user sheets from UserGroups
  const userGroupsSheet = ss.getSheetByName(USER_GROUPS_SHEET_NAME);
  if (userGroupsSheet && userGroupsSheet.getLastRow() > 1) {
    const groupNames = userGroupsSheet.getRange(2, 1, userGroupsSheet.getLastRow() - 1, 1).getValues().flat();
    groupNames.forEach(name => {
      if (name) sheets.add(ss.getSheetByName(name + '_G'));
    });
  }

  return Array.from(sheets).filter(Boolean); // Return a filtered array of sheet objects
}
