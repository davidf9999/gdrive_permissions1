function processManagedFolders_(options = {}) {
  const { returnPlanOnly = false } = options;
  let deletionPlan = [];

  log_('*** Starting processing of ManagedFolders sheet...');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (!sheet) {
    if (!returnPlanOnly) SpreadsheetApp.getUi().alert('CRITICAL: Configuration sheet named "' + MANAGED_FOLDERS_SHEET_NAME + '" not found. Aborting.');
    return returnPlanOnly ? [] : undefined;
  }

  if (!returnPlanOnly) setSheetUiStyles_();

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
      log_('No data rows to process in ManagedFolders sheet.');
      return returnPlanOnly ? [] : undefined;
  }

  for (let i = 2; i <= lastRow; i++) {
    if (!returnPlanOnly) showToast_('Processing row ' + i + ' of ' + lastRow + '...', 'Sync Progress', 10);
    try {
      const plan = processRow_(i, options);
      if (plan) {
        deletionPlan.push(plan);
      }
    } catch (e) {
      log_('Error processing row ' + i + ': ' + e.toString(), 'ERROR');
    }
  }
  log_('Finished processing all rows.');

  if (returnPlanOnly) {
    return deletionPlan;
  }
}

function processRow_(rowIndex, options = {}) {
  const { returnPlanOnly = false, removeOnly = false } = options;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  const statusCell = sheet.getRange(rowIndex, STATUS_COL);

  try {
    // Handle planning mode separately
    if (returnPlanOnly) {
      const groupEmail = sheet.getRange(rowIndex, GROUP_EMAIL_COL).getValue();
      const userSheetName = sheet.getRange(rowIndex, USER_SHEET_NAME_COL).getValue();
      if (groupEmail && userSheetName && !shouldSkipGroupOps_()) {
        return syncGroupMembership_(groupEmail, userSheetName, options);
      }
      return null; // Cannot create a plan if group info isn't already populated.
    }

    // Handle delete-only execution mode
    if (removeOnly) {
      statusCell.setValue('Processing Deletions...');
      const groupEmail = sheet.getRange(rowIndex, GROUP_EMAIL_COL).getValue();
      const userSheetName = sheet.getRange(rowIndex, USER_SHEET_NAME_COL).getValue();
      if (groupEmail && userSheetName && !shouldSkipGroupOps_()) {
        syncGroupMembership_(groupEmail, userSheetName, options);
        statusCell.setValue('OK (Deletions processed)');
      } else {
        log_('Skipping row ' + rowIndex + ' for deletions: missing group info or Admin SDK.', 'WARN');
        statusCell.setValue('SKIPPED');
      }
      return null;
    }

    // --- Full Sync (Add/Update) Execution Logic ---
    statusCell.setValue('Processing...');
    
    let folderName = sheet.getRange(rowIndex, FOLDER_NAME_COL).getValue();
    let folderId = sheet.getRange(rowIndex, FOLDER_ID_COL).getValue();
    let role = sheet.getRange(rowIndex, ROLE_COL).getValue();

    if (!folderName && !folderId) throw new Error('Both FolderName and FolderID are blank.');
    if (!role) throw new Error('Role is not specified.');

    const folder = getOrCreateFolder_(folderName, folderId);
    sheet.getRange(rowIndex, FOLDER_ID_COL).setValue(folder.getId());
    sheet.getRange(rowIndex, FOLDER_NAME_COL).setValue(folder.getName());

    const userSheetName = folder.getName() + '_' + role;
    const groupEmail = generateGroupEmail_(userSheetName);
    sheet.getRange(rowIndex, USER_SHEET_NAME_COL).setValue(userSheetName);
    sheet.getRange(rowIndex, GROUP_EMAIL_COL).setValue(groupEmail);

    getOrCreateUserSheet_(userSheetName);
    
    if (shouldSkipGroupOps_()) {
      log_('Skipping group operations for row ' + rowIndex + ' (Admin SDK not available).', 'WARN');
      sheet.getRange(rowIndex, LAST_SYNCED_COL).setValue(Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss'));
      statusCell.setValue('SKIPPED (No Admin SDK)');
      return null;
    }

    getOrCreateGroup_(groupEmail, userSheetName);
    setFolderPermission_(folder.getId(), groupEmail, role);
    syncGroupMembership_(groupEmail, userSheetName, options);

    sheet.getRange(rowIndex, LAST_SYNCED_COL).setValue(Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss'));
    statusCell.setValue('OK');

  } catch (e) {
    log_('Failed to process row ' + rowIndex + '. Error: ' + e.message + ' Stack: ' + e.stack, 'ERROR');
    statusCell.setValue('Error: ' + e.message);
  }
  return null;
}


/**
 * Checks for sheets that are not part of the main configuration.
 * @return {Array<string>} A list of orphan sheet names.
 */
function checkForOrphanSheets_() {
  try {
    log_('Checking for orphan sheets...');
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const allSheets = spreadsheet.getSheets();
    const allSheetNames = allSheets.map(function(s) { return s.getName(); });

    const requiredSheetNames = new Set();
    requiredSheetNames.add(MANAGED_FOLDERS_SHEET_NAME);
    requiredSheetNames.add(ADMINS_SHEET_NAME);
    requiredSheetNames.add(USER_GROUPS_SHEET_NAME);
    requiredSheetNames.add(CONFIG_SHEET_NAME);
    requiredSheetNames.add(LOG_SHEET_NAME);
    requiredSheetNames.add(TEST_LOG_SHEET_NAME);

    const managedSheet = spreadsheet.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
    if (managedSheet && managedSheet.getLastRow() > 1) {
      const userSheetNames = managedSheet.getRange(2, USER_SHEET_NAME_COL, managedSheet.getLastRow() - 1, 1).getValues();
      if (userSheetNames) {
          userSheetNames.forEach(function(row) {
            if (row[0]) requiredSheetNames.add(row[0]);
          });
      }
    }
    
    const userGroupsSheet = spreadsheet.getSheetByName(USER_GROUPS_SHEET_NAME);
    if (userGroupsSheet && userGroupsSheet.getLastRow() > 1) {
        const groupSheetNames = userGroupsSheet.getRange(2, 1, userGroupsSheet.getLastRow() - 1, 1).getValues();
        if (groupSheetNames) {
            groupSheetNames.forEach(function(row) {
                if (row[0]) requiredSheetNames.add(row[0]);
            });
        }
    }

    return allSheetNames.filter(function(name) { return !requiredSheetNames.has(name); });

  } catch (e) {
    log_('Error during orphan sheet check: ' + e.message, 'ERROR');
    return [];
  }
}

function getOrCreateFolder_(folderName, folderId) {
  if (folderId) {
    try {
      const folder = DriveApp.getFolderById(folderId);
      if (folderName && folder.getName() !== folderName) {
        throw new Error('Mismatch: Provided FolderID points to "' + folder.getName() + '"');
      }
      log_('Successfully found folder "' + folder.getName() + '" by ID.');
      return folder;
    } catch (e) {
      log_('Could not retrieve folder by ID ' + folderId + '. Will try searching by name.', 'WARN');
    }
  }

  if (!folderName) {
    throw new Error('Cannot find or create folder without a name or a valid ID.');
  }

  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    const foundFolder = folders.next();
    if (folders.hasNext()) {
      throw new Error('Ambiguous: Multiple folders exist with the name "' + folderName + '". Please specify by ID.');
    }
    log_('Successfully found folder "' + folderName + '" by name.');
    return foundFolder;
  } else {
    log_('No folder found with name "' + folderName + '". Creating it now...');
    const newFolder = DriveApp.createFolder(folderName);
    log_('Successfully created folder "' + folderName + '"');
    return newFolder;
  }
}

function getOrCreateGroup_(groupEmail, groupName) {
  assertAdminDirectoryAvailable_();
  try {
    AdminDirectory.Groups.get(groupEmail);
    log_('Found existing group: ' + groupEmail);
    return;
  } catch (e) {
    log_('Group "' + groupEmail + '" not found. Will attempt to create it.');
  }

  try {
    const newGroup = {
      email: groupEmail,
      name: groupName,
      description: 'Managed by Google Sheets script. Folder: ' + groupName.split('_')[0]
    };
    AdminDirectory.Groups.insert(newGroup);
    log_('Successfully created group: ' + groupEmail);
  } catch (e) {
    log_('Failed to create group ' + groupEmail + '. Error: ' + e.toString(), 'ERROR');
    throw new Error('Could not create group: ' + e.message);
  }
}

function getOrCreateUserSheet_(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (sheet) {
    return sheet;
  } else {
    log_('User sheet "' + sheetName + '" not found. Creating it...');
    sheet = spreadsheet.insertSheet(sheetName, spreadsheet.getSheets().length);
    
    const header = sheet.getRange('A1');
    header.setValue('User Email Address');
    header.setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    log_('Successfully created user sheet: "' + sheetName + '"');
    return sheet;
  }
}

function syncGroupMembership_(groupEmail, userSheetName, options = {}) {
  const { addOnly = false, removeOnly = false, returnPlanOnly = false } = options;
  log_('*** Starting membership sync for group "' + groupEmail + '" from sheet "' + userSheetName + '"');
  
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(userSheetName);
    if (!sheet) {
      throw new Error('User sheet "' + userSheetName + '" not found.');
    }
    const sheetEmails = sheet.getRange('A2:A' + sheet.getLastRow()).getValues()
      .map(function(row) { return row[0].toString().trim().toLowerCase(); })
      .filter(function(email) { return email && email.includes('@'); });
    const sheetSet = new Set(sheetEmails);
    log_('Found ' + sheetSet.size + ' emails in sheet "' + userSheetName + '"');

    const groupMembers = fetchAllGroupMembers_(groupEmail);
    const groupEmails = groupMembers.map(function(m) { return m.email.toLowerCase(); });
    const groupSet = new Set(groupEmails);
    log_('Found ' + groupSet.size + ' members in group "' + groupEmail + '"');

    const emailsToAdd = sheetEmails.filter(function(email) { return !groupSet.has(email); });
    const membersToRemove = groupMembers.filter(function(m) {
      return !sheetSet.has(m.email.toLowerCase()) && m.role !== 'OWNER';
    });
    const emailsToRemove = membersToRemove.map(function(m) { return m.email; });

    if (returnPlanOnly && removeOnly && emailsToRemove.length > 0) {
      return {
        groupEmail: groupEmail,
        groupName: userSheetName, 
        usersToRemove: emailsToRemove
      };
    }
    if (returnPlanOnly) {
        return null;
    }

    if (emailsToAdd.length === 0 && emailsToRemove.length === 0) {
      log_('No membership changes required for group "' + groupEmail + '". Sync complete.');
      return;
    }

    const batchRequests = [];
    const boundary = 'batch_' + new Date().getTime();

    // Create requests for adding members
    if (!removeOnly && emailsToAdd.length > 0) {
      emailsToAdd.forEach(function(email) {
        const payload = { email: email, role: 'MEMBER' };
        batchRequests.push({
          method: 'POST',
          path: '/admin/directory/v1/groups/' + groupEmail + '/members',
          payload: JSON.stringify(payload)
        });
      });
    }

    // Create requests for removing members
    if (!addOnly && emailsToRemove.length > 0) {
      emailsToRemove.forEach(function(email) {
        batchRequests.push({
          method: 'DELETE',
          path: '/admin/directory/v1/groups/' + groupEmail + '/members/' + email
        });
      });
    }

    if (batchRequests.length === 0) {
      log_('No changes to apply in this mode.');
      return;
    }

    // Build the multipart request body
    let requestBody = '';
    batchRequests.forEach(function(request, i) {
      requestBody += '--' + boundary + '\n';
      requestBody += 'Content-Type: application/http\n';
      requestBody += 'Content-ID: item' + i + '\n\n';
      requestBody += request.method + ' ' + request.path + '\n';
      if (request.payload) {
        requestBody += 'Content-Type: application/json\n\n';
        requestBody += request.payload + '\n';
      } else {
        requestBody += '\n';
      }
    });
    requestBody += '--' + boundary + '--';

    const fetchOptions = {
      method: 'POST',
      contentType: 'multipart/mixed; boundary=' + boundary,
      payload: requestBody,
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
      },
      muteHttpExceptions: true // Important to parse the response manually
    };

    log_('Sending batch request with ' + batchRequests.length + ' operations for ' + groupEmail);
    const response = UrlFetchApp.fetch('https://www.googleapis.com/batch/admin/directory_v1', fetchOptions);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode >= 200 && responseCode < 300) {
      log_('Batch request processed for group ' + groupEmail + '. Parsing individual responses...');
      const contentTypeHeader = response.getHeaders()['Content-Type'];
      if (!contentTypeHeader || !contentTypeHeader.includes('boundary=')) {
          throw new Error('Invalid batch response: boundary not found in Content-Type header.');
      }
      const responseBoundary = '--' + contentTypeHeader.split('boundary=')[1];
      const parts = responseBody.split(responseBoundary);
      
      let successCount = 0;
      let failureCount = 0;

      // Start from index 1, end before the last part which is the closing boundary
      for (let i = 1; i < parts.length - 1; i++) {
        const part = parts[i].trim();
        if (!part) continue;

                const statusMatch = part.match(/^HTTP\/[12]\.[01] (\d{3})/m);
        if (statusMatch) {
            const statusCode = parseInt(statusMatch[1], 10);
            if (statusCode >= 200 && statusCode < 300) {
                successCount++;
            } else {
                failureCount++;
                log_('A batch operation failed for group ' + groupEmail + '. Status: ' + statusCode + '. Details: ' + part, 'ERROR');
            }
        } else {
            failureCount++;
            log_('Could not parse status for a batch operation part for group ' + groupEmail + '. Part: ' + part, 'ERROR');
        }
      }
      log_('Batch processing summary for ' + groupEmail + ': ' + successCount + ' successful, ' + failureCount + ' failed.');
      if(failureCount > 0) {
        log_('WARNING: ' + failureCount + ' membership operations failed to sync for group ' + groupEmail + '. See logs for details.', 'WARN');
      }

    } else {
      log_('ERROR: Batch request failed for group ' + groupEmail + ' with code ' + responseCode, 'ERROR');
      log_('Response body: ' + responseBody, 'ERROR');
      throw new Error('Batch membership update failed with response code ' + responseCode);
    }

    log_('Membership sync complete for group "' + groupEmail + '"');

  } catch (e) {
    log_('FATAL ERROR in syncGroupMembership for group ' + groupEmail + '. Error: ' + e.toString() + ' Stack: ' + e.stack, 'ERROR');
    throw e;
  }
}

function fetchAllGroupMembers_(groupEmail) {
  assertAdminDirectoryAvailable_();
  const members = [];
  let pageToken;
  try {
      do {
        const resp = AdminDirectory.Members.list(groupEmail, { 
          maxResults: 200,
          pageToken: pageToken 
        });
        if (resp && resp.members) {
          members.push.apply(members, resp.members);
        }
        pageToken = resp ? resp.nextPageToken : null;
      } while (pageToken);
  } catch(e) {
      if (e.message.includes('Resource Not Found: groupKey')) {
          log_('Group ' + groupEmail + ' does not exist yet, returning no members.', 'WARN');
          return [];
      }
      throw e;
  }
  return members;
}

function setFolderPermission_(folderId, groupEmail, role) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const roleLower = role.toLowerCase();

    switch (roleLower) {
      case 'editor':
        folder.addEditor(groupEmail);
        break;
      case 'viewer':
        folder.addViewer(groupEmail);
        break;
      case 'commenter':
        folder.addCommenter(groupEmail);
        break;
      default:
        throw new Error('Unsupported role: "' + role + '"');
    }
    log_('Successfully set role "' + role + '" for group "' + groupEmail + '" on folder "' + folder.getName() + '"');

  } catch (e) {
    log_('Failed to set permission for group ' + groupEmail + ' on folder ' + folderId + '. Error: ' + e.toString(), 'ERROR');
    throw new Error('Could not set folder permission: ' + e.message);
  }
}

function setSheetUiStyles_() {
  try {
    const managedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
    if (managedSheet && managedSheet.getLastRow() >= 2) {
        const range = managedSheet.getRange(2, USER_SHEET_NAME_COL, managedSheet.getLastRow() - 1, 4);
        range.setBackground('#f3f3f3');
        const protection = range.protect().setDescription('These columns are managed by the script.');
        protection.setWarningOnly(true);
    }

    const userGroupsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USER_GROUPS_SHEET_NAME);
    if (userGroupsSheet && userGroupsSheet.getLastRow() >= 2) {
      const range = userGroupsSheet.getRange(2, 2, userGroupsSheet.getLastRow() - 1, 3);
      range.setBackground('#f3f3f3');
      const protection = range.protect().setDescription('These columns are managed by the script.');
      protection.setWarningOnly(true);
    }
  } catch (e) {
    log_('Could not apply UI styles. Error: ' + e.message, 'WARN');
  }
}
