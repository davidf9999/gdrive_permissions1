/**
 * Synchronizes the editors of the spreadsheet file with the list in the Admins sheet.
 *
 * @param {Object} options - Options for sync behavior
 * @param {boolean} options.addOnly - If true, only add admins (SAFE operations for auto-sync)
 * @param {boolean} options.silentMode - If true, skip UI dialogs (for background execution)
 */
function syncAdmins(options = {}) {
  const { addOnly = false, silentMode = false } = options;
  const ui = SpreadsheetApp.getUi();
  let adminSheet;
  try {
    log_('Running Admin Sync... (addOnly: ' + addOnly + ', silentMode: ' + silentMode + ')');
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    adminSheet = spreadsheet.getSheetByName(ADMINS_SHEET_NAME);
    if (!adminSheet) {
      log_('Admins sheet not found. Skipping admin sync.');
      if (!silentMode) ui.alert('Admins sheet not found. Skipping admin sync.');
      return;
    }

    // Get admin group email from Config sheet
    let adminGroupEmail = getConfigValue_('AdminGroupEmail', '');
    if (adminGroupEmail) {
      adminGroupEmail = adminGroupEmail.toString().trim().toLowerCase();
    }
    // Validate that adminGroupEmail is a valid email format (contains @ and a domain)
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!adminGroupEmail || !emailPattern.test(adminGroupEmail)) {
      if (adminGroupEmail) {
        log_('Invalid admin group email in Config: "' + adminGroupEmail + '". Regenerating...', 'WARN');
      }
      adminGroupEmail = generateGroupEmail_(ADMINS_GROUP_NAME);
      // Save the generated email to Config immediately
      updateConfigSetting_('AdminGroupEmail', adminGroupEmail);
    }

    // 1. Get desired admins
    const adminData = adminSheet.getRange('A2:D' + adminSheet.getLastRow()).getValues();
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
      log_('SAFE mode: Skipping ' + emailsToRemove.length + ' admin removal(s). Run "Sync Admins" manually to process removals.', 'WARN');
      // Continue with additions only
    }

    if (emailsToAdd.length === 0 && (addOnly || emailsToRemove.length === 0)) {
      syncAdminsGroup_(adminSheet, adminGroupEmail, { addOnly: addOnly });
      log_('Admin list is already up to date.');
      if (!silentMode) {
        if (SCRIPT_EXECUTION_MODE === 'TEST') {
          showTestMessage_('Admin Sync', 'Admin list is already up to date. No changes were needed. Admins group synced to ' + adminGroupEmail + '.');
        } else {
          ui.alert('Admin list is already up to date. No changes were needed.\nAdmins group synced to ' + adminGroupEmail + '.');
        }
      }
      return;
    }

    // Build confirmation message
    let confirmationMessage = 'Admin Sync will make the following changes to the editors of this spreadsheet:\n';
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
      const response = ui.alert('Confirm Admin Sync', confirmationMessage, ui.ButtonSet.YES_NO);

      if (response !== ui.Button.YES) {
        if (!silentMode) ui.alert('Admin sync cancelled.');
        log_('Admin sync cancelled by user.');
        adminSheet.getRange(ADMINS_STATUS_CELL).setValue('CANCELLED');
        return;
      }
    } else {
      // Log changes in silent/addOnly mode
      log_('AUTO-SYNC: Processing admin changes without confirmation:');
      log_(confirmationMessage);
    }

    adminSheet.getRange(ADMINS_STATUS_CELL).setValue('Processing...');

    // 5. Perform the additions
    if (emailsToAdd.length > 0) {
      log_('Adding ' + emailsToAdd.length + ' admin(s): ' + emailsToAdd.join(', '));
      spreadsheet.addEditors(emailsToAdd);
    }

    // Perform removals only if not in addOnly mode
    if (!addOnly && emailsToRemove.length > 0) {
      log_('Removing ' + emailsToRemove.length + ' editor(s): ' + emailsToRemove.join(', '));
      spreadsheet.removeEditors(emailsToRemove);
    }

    syncAdminsGroup_(adminSheet, adminGroupEmail, { addOnly: addOnly });

    log_('Admin sync complete. Admins group email: ' + adminGroupEmail + '.');
    if (!silentMode) {
      if (SCRIPT_EXECUTION_MODE === 'TEST') {
        showTestMessage_('Admin Sync', 'Admin sync complete. Admins group synced to ' + adminGroupEmail + '.');
      } else {
        ui.alert('Admin sync complete.\nAdmins group synced to ' + adminGroupEmail + '.');
      }
    }

  } catch (e) {
    log_('ERROR in syncAdmins: ' + e.toString());
    if (adminSheet) {
      try {
        adminSheet.getRange(ADMINS_STATUS_CELL).setValue('ERROR: ' + e.message);
      } catch (ignored) {}
    }
    if (!silentMode) ui.alert('An error occurred during Admin sync: ' + e.message);
  }
}

function syncAdminsGroup_(adminSheet, adminGroupEmail, options = {}) {
  const { addOnly = false } = options;
  const statusCell = adminSheet.getRange(ADMINS_STATUS_CELL);
  const lastSyncedCell = adminSheet.getRange(ADMINS_LAST_SYNC_CELL);
  statusCell.setValue('Processing group sync...');
  const timestamp = Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  if (shouldSkipGroupOps_()) {
    log_('Admin Directory service not available. Skipping Admins group sync.', 'WARN');
    statusCell.setValue('SKIPPED (No Admin SDK)');
    lastSyncedCell.setValue(timestamp);
    return;
  }

  try {
    getOrCreateGroup_(adminGroupEmail, ADMINS_GROUP_NAME);
    syncGroupMembership_(adminGroupEmail, ADMINS_SHEET_NAME, { addOnly: addOnly });

    // Update the Config sheet with the admin group email
    updateConfigSetting_('AdminGroupEmail', adminGroupEmail);

    statusCell.setValue('OK');
    lastSyncedCell.setValue(timestamp);
  } catch (e) {
    statusCell.setValue('ERROR: ' + e.message);
    throw e;
  }
}



function syncUserGroups(options = {}) {
  const { returnPlanOnly = false } = options;
  let deletionPlan = [];

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const userGroupsSheet = ss.getSheetByName(USER_GROUPS_SHEET_NAME);
    if (!userGroupsSheet) {
      if (!returnPlanOnly) SpreadsheetApp.getUi().alert('UserGroups sheet not found.');
      return returnPlanOnly ? [] : undefined;
    }

    const lastRow = userGroupsSheet.getLastRow();
    if (lastRow < 2) {
        log_('No data rows to process in UserGroups sheet.');
        return returnPlanOnly ? [] : undefined;
    }
    
    // If Admin SDK is unavailable, we can't create a plan or sync.
    if (shouldSkipGroupOps_()) {
      log_('Admin SDK (Admin Directory) not available. Skipping syncUserGroups.', 'WARN');
      if (!returnPlanOnly) {
          const dataRange = userGroupsSheet.getRange(2, 1, lastRow - 1, 4); 
          const data = dataRange.getValues();
          for (let i = 0; i < data.length; i++) {
            const rowIndex = i + 2;
            if (data[i][0]) { // If there's a group name
              userGroupsSheet.getRange(rowIndex, 3).setValue(Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss'));
              userGroupsSheet.getRange(rowIndex, 4).setValue('SKIPPED (No Admin SDK)');
            }
          }
          SpreadsheetApp.getUi().alert('User group sync skipped: Admin Directory service not available.');
      }
      return returnPlanOnly ? [] : undefined;
    }
    
    const dataRange = userGroupsSheet.getRange(2, 1, lastRow - 1, 4);
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
          const plan = syncGroupMembership_(groupEmail, groupName, options);
          if (plan) {
            deletionPlan.push(plan);
          }
        } else {
          const statusCell = userGroupsSheet.getRange(rowIndex, 4);
          const lastSyncedCell = userGroupsSheet.getRange(rowIndex, 3);
          const groupEmailCell = userGroupsSheet.getRange(rowIndex, 2);

          statusCell.setValue('Processing...');
          showToast_('Processing user group: ' + groupName + '...', 'Sync Progress', 10);
          
          if (!data[i][1]) { // If groupEmail was generated, write it to the sheet
            groupEmailCell.setValue(groupEmail);
          }

          const groupSheetName = groupName + '_G';
          getOrCreateUserSheet_(groupSheetName);
          getOrCreateGroup_(groupEmail, groupName);
          syncGroupMembership_(groupEmail, groupSheetName, options);

          lastSyncedCell.setValue(Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss'));
          statusCell.setValue('OK');
          log_('Successfully synced user group: ' + groupName);
        }

      } catch (e) {
        if (!returnPlanOnly) {
          const statusCell = userGroupsSheet.getRange(rowIndex, 4);
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
    
    if (SCRIPT_EXECUTION_MODE === 'TEST') {
      showTestMessage_('User Groups Sync', 'User groups sync complete.');
    } else {
      SpreadsheetApp.getUi().alert('User groups sync complete.');
    }

  } catch (e) {
    const errorMessage = 'FATAL ERROR in syncUserGroups: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    if (!returnPlanOnly) {
      SpreadsheetApp.getUi().alert('A fatal error occurred during user group sync: ' + e.message);
      sendErrorNotification_(errorMessage);
    } else {
      throw e; // Re-throw for the planner to catch
    }
  }
}

function syncAdds() {
  setupControlSheets_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    SpreadsheetApp.getUi().alert('Sync is already in progress. Please wait a few minutes and try again.');
    return;
  }

  try {
    showToast_('Starting non-destructive sync (adds only)...', 'Sync Adds', -1);
    log_('*** Starting non-destructive synchronization (adds only)...');

    // 1. Sync Admins (SAFE mode: additions only, silent for auto-sync)
    syncAdmins({ addOnly: true, silentMode: true });

    // 2. Sync User Groups (creates groups, adds members)
    syncUserGroups({ addOnly: true });

    // 3. Process Managed Folders (creates folders, permissions, adds members)
    processManagedFolders_({ addOnly: true });

    showToast_('Add-only sync complete!', 'Sync Adds', 5);
    log_('Add-only synchronization completed.');
    if (SCRIPT_EXECUTION_MODE === 'TEST') {
      showTestMessage_('Add-only Sync', 'Non-destructive sync (adds only) is complete.');
    } else {
      SpreadsheetApp.getUi().alert('Non-destructive sync (adds only) is complete.\n\nCheck the \'Status\' column in the sheets for details.');
    }

  } catch (e) {
    const errorMessage = 'FATAL ERROR in syncAdds: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    showToast_('Add-only sync failed with a fatal error.', 'Sync Adds', 5);
    SpreadsheetApp.getUi().alert('A fatal error occurred during add-only sync: ' + e.message);
    sendErrorNotification_(errorMessage);
  } finally {
    lock.releaseLock();
  }
}

function syncDeletes() {
  const ui = SpreadsheetApp.getUi();
  
  // --- Phase 1: Planning ---
  log_('*** Starting deletion planning phase...');
  showToast_('Planning deletions...', 'Sync Deletes', 10);
  
  let deletionPlan = [];
  try {
    const planOptions = { removeOnly: true, returnPlanOnly: true };
    const groupDeletions = syncUserGroups(planOptions);
    const folderDeletions = processManagedFolders_(planOptions);
    deletionPlan = (groupDeletions || []).concat(folderDeletions || []);
  } catch (e) {
    const errorMessage = 'FATAL ERROR during deletion planning: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    showToast_('Deletion planning failed with a fatal error.', 'Sync Deletes', 5);
    ui.alert('A fatal error occurred during the deletion planning phase: ' + e.message);
    sendErrorNotification_(errorMessage);
    return;
  }

  if (deletionPlan.length === 0) {
    log_('No deletions are pending.');
    ui.alert('No pending deletions found.');
    return;
  }

  // --- Phase 2: Confirmation ---
  let confirmationMessage = 'This will process deletions and remove the following users from groups:\n';
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

  // --- Phase 3: Execution ---
  setupControlSheets_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    ui.alert('Sync is already in progress. Please wait a few minutes and try again.');
    return;
  }

  try {
    showToast_('Starting destructive sync (deletes only)...', 'Sync Deletes', -1);
    log_('*** Starting destructive synchronization (deletes only)...');

    const execOptions = { removeOnly: true };
    syncUserGroups(execOptions);
    processManagedFolders_(execOptions);

    showToast_('Delete-only sync complete!', 'Sync Deletes', 5);
    log_('Delete-only synchronization completed.');
    ui.alert('Destructive sync (deletes only) is complete.\n\nCheck the \'Status\' column in the sheets for details.');

  } catch (e) {
    const errorMessage = 'FATAL ERROR in syncDeletes: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    showToast_('Delete-only sync failed with a fatal error.', 'Sync Deletes', 5);
    ui.alert('A fatal error occurred during delete-only sync: ' + e.message);
    sendErrorNotification_(errorMessage);
  } finally {
    lock.releaseLock();
  }
}

function fullSync() {
  setupControlSheets_(); // Ensure control sheets exist
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    SpreadsheetApp.getUi().alert('Sync is already in progress. Please wait a few minutes and try again.');
    return;
  }

  let summaryMessage = 'Sync process complete.';
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    showToast_('Starting full synchronization...', 'Full Sync', -1);
    log_('*** Starting full synchronization...');

    // Validate unique group emails before starting
    const validation = validateUniqueGroupEmails_();
    if (!validation.valid) {
      const errorDetails = validation.errors.map(e => e.message).join('\n\n');
      const errorMessage = 'VALIDATION ERROR: Duplicate group emails detected!\n\n' + errorDetails +
        '\n\nEach group must have a unique email address. Please fix these duplicates and try again.';
      log_(errorMessage, 'ERROR');
      SpreadsheetApp.getUi().alert(errorMessage);
      throw new Error('Duplicate group emails detected. Sync aborted.');
    }

    // 1. Sync Admins
    syncAdmins();

    // 2. Sync User Groups
    syncUserGroups();

    // 3. Process Managed Folders
    processManagedFolders_();

    // Check for any orphan sheets
    const orphanSheets = checkForOrphanSheets_();
    if (orphanSheets && orphanSheets.length > 0) {
      const orphanMessage = 'Warning: Found orphan sheets that are not in the configuration: ' + orphanSheets.join(', ');
      summaryMessage += '\n\n' + orphanMessage;
      log_(orphanMessage, 'WARN');
    }

    showToast_('Full synchronization complete!', 'Full Sync', 5);
    log_('Full synchronization completed.');
    if (SCRIPT_EXECUTION_MODE === 'TEST') {
      showTestMessage_('Full Sync', summaryMessage + '\n\nCheck the \'Status\' column in the \'ManagedFolders\' sheet for details.');
    } else {
      SpreadsheetApp.getUi().alert(summaryMessage + '\n\nCheck the \'Status\' column in the \'ManagedFolders\' sheet for details.');
    }

  } catch (e) {
    const errorMessage = 'FATAL ERROR in fullSync: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    showToast_('Full sync failed with a fatal error.', 'Full Sync', 5);
    SpreadsheetApp.getUi().alert('A fatal error occurred: ' + e.message);
    sendErrorNotification_(errorMessage);
  } finally {
    lock.releaseLock();
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

    processManagedFolders_({ addOnly: true });

    showToast_('Folder-only sync (adds) complete!', 'Sync Folders - Adds', 5);
    log_('Managed Folders only synchronization (adds) completed.');
    SpreadsheetApp.getUi().alert('Folder-only sync (adds only) is complete.\n\nCheck the \'Status\' column in the \'ManagedFolders\' sheet for details.');

  } catch (e) {
    const errorMessage = 'FATAL ERROR in syncManagedFoldersAdds: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    showToast_('Folder-only sync (adds) failed with a fatal error.', 'Sync Folders - Adds', 5);
    SpreadsheetApp.getUi().alert('A fatal error occurred during folder-only sync (adds): ' + e.message);
    sendErrorNotification_(errorMessage);
  } finally {
    lock.releaseLock();
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
    'Confirm Destructive Folder Sync',
    confirmationMessage,
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    ui.alert('Delete sync cancelled.');
    return;
  }

  // --- Phase 3: Execution ---
  setupControlSheets_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    ui.alert('Sync is already in progress. Please wait a few minutes and try again.');
    return;
  }

  try {
    showToast_('Starting folder-only sync (deletes only)...', 'Sync Folders - Deletes', -1);
    log_('*** Starting Managed Folders only synchronization (deletes only)...');

    processManagedFolders_({ removeOnly: true });

    showToast_('Folder-only sync (deletes) complete!', 'Sync Folders - Deletes', 5);
    log_('Managed Folders only synchronization (deletes) completed.');
    ui.alert('Destructive folder-only sync (deletes only) is complete.\n\nCheck the \'Status\' column in the \'ManagedFolders\' sheet for details.');

  } catch (e) {
    const errorMessage = 'FATAL ERROR in syncManagedFoldersDeletes: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    showToast_('Folder-only sync (deletes) failed with a fatal error.', 'Sync Folders - Deletes', 5);
    ui.alert('A fatal error occurred during folder-only sync (deletes): ' + e.message);
    sendErrorNotification_(errorMessage);
  } finally {
    lock.releaseLock();
  }
}
