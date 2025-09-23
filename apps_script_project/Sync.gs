/**
 * This file contains the core synchronization functions, their UI-bound wrappers,
 * and their secure, server-side wrappers for the Web App.
 */

// =========================================================================
//  SECURE WRAPPERS (for Web App)
// =========================================================================

function syncAdds_secure() {
  if (!isUserAdmin_()) throw new Error('You are not authorized to perform this action.');
  return syncAdds_core();
}

function syncDeletes_secure() {
  if (!isUserAdmin_()) throw new Error('You are not authorized to perform this action.');
  // In the web app, we assume the client has provided confirmation.
  return syncDeletes_core(true);
}

function fullSync_secure() {
  if (!isUserAdmin_()) throw new Error('You are not authorized to perform this action.');
  return fullSync_core();
}

function syncAdmins_secure() {
  if (!isUserAdmin_()) throw new Error('You are not authorized to perform this action.');
  return syncAdmins_core(true);
}

// =========================================================================
//  CORE LOGIC FUNCTIONS (no UI)
// =========================================================================

function syncAdds_core() {
  setupControlSheets_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    throw new Error('Sync is already in progress. Please wait a few minutes and try again.');
  }
  try {
    log_('*** Starting non-destructive synchronization (adds only)...');
    syncUserGroups({ addOnly: true });
    processManagedFolders_({ addOnly: true });
    log_('Add-only synchronization completed.');
    return 'Non-destructive sync (adds only) is complete. Check the Status columns for details.';
  } catch (e) {
    const errorMessage = 'FATAL ERROR in syncAdds: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    sendErrorNotification_(errorMessage);
    throw new Error('A fatal error occurred during add-only sync: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

function syncDeletes_core(confirm) {
  if (!confirm) {
    throw new Error('Destructive sync requires confirmation.');
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    throw new Error('Sync is already in progress. Please wait a few minutes and try again.');
  }
  try {
    log_('*** Starting destructive synchronization (deletes only)...');
    const execOptions = { removeOnly: true };
    syncUserGroups(execOptions);
    processManagedFolders_(execOptions);
    log_('Delete-only synchronization completed.');
    return 'Destructive sync (deletes only) is complete. Check the Status column for details.';
  } catch (e) {
    const errorMessage = 'FATAL ERROR in syncDeletes: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    sendErrorNotification_(errorMessage);
    throw new Error('A fatal error occurred during delete-only sync: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

function fullSync_core() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    throw new Error('Sync is already in progress. Please wait a few minutes and try again.');
  }
  let summaryMessage = 'Sync process complete.';
  try {
    log_('*** Starting full synchronization...');
    syncUserGroups();
    processManagedFolders_();
    const orphanSheets = checkForOrphanSheets_();
    if (orphanSheets && orphanSheets.length > 0) {
      summaryMessage += '\n\nWarning: Found orphan sheets: ' + orphanSheets.join(', ');
    }
    log_('Full synchronization completed.');
    return summaryMessage + '\n\nCheck the \'Status\' column for details.';
  } catch (e) {
    const errorMessage = 'FATAL ERROR in fullSync: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    sendErrorNotification_(errorMessage);
    throw new Error('A fatal error occurred: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

function syncAdmins_core(confirm) {
  if (!confirm) {
    throw new Error('Admin sync requires confirmation.');
  }
  log_('*** Starting Admin Sync...');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const runningUser = Session.getEffectiveUser().getEmail();

  // Part 1: Sync Spreadsheet Editors (Original Logic)
  log_('Step 1: Syncing spreadsheet editors...');
  const adminsSheet = ss.getSheetByName(ADMINS_SHEET_NAME);
  if (!adminsSheet) {
    throw new Error('Admins sheet not found. Skipping admin sync.');
  }
  const adminEmails = adminsSheet.getRange('A2:A').getValues().map(r => r[0].toString().trim().toLowerCase()).filter(e => e);
  const adminSet = new Set(adminEmails);
  const owner = ss.getOwner();
  if (owner) {
    adminSet.add(owner.getEmail().toLowerCase());
  }
  
  const currentEditors = ss.getEditors().map(u => u.getEmail().toLowerCase());
  const editorSet = new Set(currentEditors);

  const emailsToAddAsEditor = adminEmails.filter(email => !editorSet.has(email));
  const emailsToRemoveAsEditor = currentEditors.filter(email => !adminSet.has(email) && (!owner || email !== owner.getEmail().toLowerCase()));

  if (emailsToAddAsEditor.length > 0) {
    ss.addEditors(emailsToAddAsEditor);
    log_('Added ' + emailsToAddAsEditor.length + ' spreadsheet editors.');
  }
  if (emailsToRemoveAsEditor.length > 0) {
    emailsToRemoveAsEditor.forEach(email => {
      ss.removeEditor(email);
    });
    log_('Removed ' + emailsToRemoveAsEditor.length + ' spreadsheet editors.');
  }
  log_('Spreadsheet editor sync complete.');

  // Part 2: Grant Permissions to Managed Folders and Groups
  log_('Step 2: Provisioning Drive and Group permissions for admins...');

  // Get all managed folders
  const foldersSheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  const folderIds = foldersSheet ? foldersSheet.getRange('B2:B').getValues().map(r => r[0]).filter(id => id) : [];
  log_('Found ' + folderIds.length + ' managed folders to process.');

  // Get all managed groups
  const groupsSheet = ss.getSheetByName(USER_GROUPS_SHEET_NAME);
  const groupEmails = groupsSheet ? groupsSheet.getRange('B2:B').getValues().map(r => r[0]).filter(email => email) : [];
  log_('Found ' + groupEmails.length + ' managed groups to process.');

  adminEmails.forEach(adminEmail => {
    if (adminEmail === runningUser) {
      log_('Skipping permission grants for the user running the script (' + adminEmail + ').');
      return;
    }
    log_('Processing permissions for admin: ' + adminEmail);

    // Grant Drive Folder permissions
    folderIds.forEach(folderId => {
      try {
        const folder = DriveApp.getFolderById(folderId);
        folder.addEditor(adminEmail);
        log_('Successfully granted Editor access to folder "' + folder.getName() + '" for ' + adminEmail);
      } catch (e) {
        log_('Could not grant Editor access to folder ID ' + folderId + ' for ' + adminEmail + '. Reason: ' + e.message, 'ERROR');
      }
    });

    // Grant Group Manager permissions
    if (!shouldSkipGroupOps_()) {
      groupEmails.forEach(groupEmail => {
        try {
          let member = AdminDirectory.Members.get(groupEmail, adminEmail);
          if (member.role !== 'MANAGER' && member.role !== 'OWNER') {
            member.role = 'MANAGER';
            AdminDirectory.Members.update(member, groupEmail, adminEmail);
            log_('Successfully promoted ' + adminEmail + ' to MANAGER in group ' + groupEmail);
          } else {
            log_('User ' + adminEmail + ' is already a ' + member.role + ' in group ' + groupEmail);
          }
        } catch (e) {
          if (e.message.includes('Resource Not Found: memberKey')) {
            // User is not in the group, add them as a Manager
            try {
              const newMember = { email: adminEmail, role: 'MANAGER' };
              AdminDirectory.Members.insert(newMember, groupEmail);
              log_('Successfully added ' + adminEmail + ' as MANAGER to group ' + groupEmail);
            } catch (e2) {
              log_('Could not add ' + adminEmail + ' as MANAGER to group ' + groupEmail + '. Reason: ' + e2.message, 'ERROR');
            }
          } else {
            log_('Could not update role for ' + adminEmail + ' in group ' + groupEmail + '. Reason: ' + e.message, 'ERROR');
          }
        }
      });
    } else {
      log_('Admin SDK not available, skipping group permission provisioning.', 'WARN');
    }
  });

  log_('*** Admin Sync Finished ***');
  return 'Admin sync complete. Check logs for details on permission provisioning.';
}

// =========================================================================
//  UI-BOUND WRAPPERS (original functions)
// =========================================================================

function syncAdds() {
  try {
    showToast_('Starting non-destructive sync (adds only)...', 'Sync Adds', -1);
    const message = syncAdds_core();
    showToast_('Add-only sync complete!', 'Sync Adds', 5);
    SpreadsheetApp.getUi().alert(message);
  } catch (e) {
    showToast_('Add-only sync failed.', 'Sync Adds', 5);
    SpreadsheetApp.getUi().alert(e.message);
  }
}

function syncDeletes() {
  const ui = SpreadsheetApp.getUi();
  log_('*** Starting deletion planning phase...');
  showToast_('Planning deletions...', 'Sync Deletes', 10);
  let deletionPlan = [];
  try {
    deletionPlan = (syncUserGroups({ removeOnly: true, returnPlanOnly: true }) || []).concat(processManagedFolders_({ removeOnly: true, returnPlanOnly: true }) || []);
  } catch (e) {
    ui.alert('A fatal error occurred during the deletion planning phase: ' + e.message);
    return;
  }
  if (deletionPlan.length === 0) {
    ui.alert('No pending deletions found.');
    return;
  }
  let confirmationMessage = 'This will process deletions and remove users.'; // Simplified message
  const response = ui.alert('Confirm Destructive Sync', confirmationMessage, ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) {
    ui.alert('Delete sync cancelled.');
    return;
  }
  try {
    const message = syncDeletes_core(true);
    showToast_('Delete-only sync complete!', 'Sync Deletes', 5);
    ui.alert(message);
  } catch (e) {
    showToast_('Delete-only sync failed.', 'Sync Deletes', 5);
    ui.alert(e.message);
  }
}

function fullSync() {
  try {
    showToast_('Starting full synchronization...', 'Full Sync', -1);
    const message = fullSync_core();
    showToast_('Full synchronization complete!', 'Full Sync', 5);
    SpreadsheetApp.getUi().alert(message);
  } catch (e) {
    showToast_('Full sync failed.', 'Full Sync', 5);
    SpreadsheetApp.getUi().alert(e.message);
  }
}

function syncAdmins() {
  const ui = SpreadsheetApp.getUi();
  try {
    const response = ui.alert('Confirm Admin Sync', 'This will sync the editors of this sheet. Continue?', ui.ButtonSet.YES_NO);
    if (response !== ui.Button.YES) {
      ui.alert('Admin sync cancelled.');
      return;
    }
    const message = syncAdmins_core(true);
    ui.alert(message);
  } catch (e) {
    ui.alert('An error occurred during Admin sync: ' + e.message);
  }
}

// =========================================================================
//  LOWER-LEVEL FUNCTIONS (mostly unchanged)
// =========================================================================

function syncUserGroups(options = {}) {
  // This function is complex and has its own UI/logging, 
  // so we leave it as is for now.
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
    
    if (shouldSkipGroupOps_()) {
      log_('Admin SDK (Admin Directory) not available. Skipping syncUserGroups.', 'WARN');
      if (!returnPlanOnly) {
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
        if (!groupName) continue;
        let groupEmail = data[i][1] || generateGroupEmail_(groupName);
        
        if (returnPlanOnly) {
          const plan = syncGroupMembership_(groupEmail, groupName, options);
          if (plan) deletionPlan.push(plan);
        } else {
          const statusCell = userGroupsSheet.getRange(rowIndex, 4);
          statusCell.setValue('Processing...');
          userGroupsSheet.getRange(rowIndex, 2).setValue(groupEmail);
          getOrCreateUserSheet_(groupName);
          getOrCreateGroup_(groupEmail, groupName);
          syncGroupMembership_(groupEmail, groupName, options);
          userGroupsSheet.getRange(rowIndex, 3).setValue(new Date());
          statusCell.setValue('OK');
        }
      } catch (e) {
        if (!returnPlanOnly) {
          userGroupsSheet.getRange(rowIndex, 4).setValue('ERROR: ' + e.message);
        }
        log_('Error in syncUserGroups row ' + rowIndex + ': ' + e.message, 'ERROR');
      }
    }

    if (returnPlanOnly) {
      return deletionPlan;
    }
    
    if (!options.suppressSummary) {
        SpreadsheetApp.getUi().alert('User groups sync complete.');
    }

  } catch (e) {
    const errorMessage = 'FATAL ERROR in syncUserGroups: ' + e.toString() + '\n' + e.stack;
    log_(errorMessage, 'ERROR');
    if (!returnPlanOnly) {
      SpreadsheetApp.getUi().alert('A fatal error occurred during user group sync: ' + e.message);
      sendErrorNotification_(errorMessage);
    } else {
      throw e;
    }
  }
}

function syncManagedFoldersAdds() {
  // This is now a legacy function, replaced by the new UI.
  // It can be removed later.
}

function syncManagedFoldersDeletes() {
  // This is now a legacy function, replaced by the new UI.
  // It can be removed later.
}