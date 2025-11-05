const EMAIL_EXTRACTION_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SINGLE_EMAIL_VALIDATION_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function processManagedFolders_(options = {}) {
  const { returnPlanOnly = false, silentMode = false } = options;
  let deletionPlan = [];
  const totalSummary = { added: 0, removed: 0, failed: 0 };

  log_('*** Starting processing of ManagedFolders sheet...');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (!sheet) {
    if (!returnPlanOnly && !silentMode) SpreadsheetApp.getUi().alert('CRITICAL: Configuration sheet named "' + MANAGED_FOLDERS_SHEET_NAME + '" not found. Aborting.');
    return returnPlanOnly ? [] : undefined;
  }

  if (!returnPlanOnly && !silentMode) setSheetUiStyles_();

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
      log_('No data rows to process in ManagedFolders sheet.');
      return returnPlanOnly ? [] : totalSummary;
  }

  const dataRange = sheet.getRange(2, 1, lastRow - 1, 2); // Get only FolderName and FolderID
  const folderData = dataRange.getValues();

  for (let i = 0; i < folderData.length; i++) {
    const row = folderData[i];
    const folderName = row[0];
    const folderId = row[1];

    if (!folderName && !folderId) {
      continue; // Skip empty rows
    }

    const rowIndex = i + 2;
    if (!returnPlanOnly && !silentMode) showToast_('Processing row ' + rowIndex + ' of ' + lastRow + '...', 'Sync Progress', 10);
    try {
      const result = processRow_(rowIndex, options);
      if (returnPlanOnly && result) {
        deletionPlan.push(result);
      } else if (!returnPlanOnly && result) {
        totalSummary.added += result.added;
        totalSummary.removed += result.removed;
        totalSummary.failed += result.failed;
      }
    } catch (e) {
      log_('Error processing row ' + rowIndex + ': ' + e.toString(), 'ERROR');
    }
  }
  log_('Finished processing all rows.');

  if (returnPlanOnly) {
    return deletionPlan;
  }
  return totalSummary;
}

function processRow_(rowIndex, options = {}) {
  const { returnPlanOnly = false, removeOnly = false, silentMode = false } = options;
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
        const summary = syncGroupMembership_(groupEmail, userSheetName, options);
        statusCell.setValue('OK (Deletions processed)');
        return summary;
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
    const userSheetCell = sheet.getRange(rowIndex, USER_SHEET_NAME_COL);
    const groupEmailCell = sheet.getRange(rowIndex, GROUP_EMAIL_COL);
    const existingUserSheetName = userSheetCell.getValue();
    let existingGroupEmail = groupEmailCell.getValue();

    if (!folderName && !folderId) throw new Error('Both FolderName and FolderID are blank.');
    if (!role) throw new Error('Role is not specified.');

    const folder = getOrCreateFolder_(folderName, folderId, { silentMode });
    sheet.getRange(rowIndex, FOLDER_ID_COL).setValue(folder.getId());
    sheet.getRange(rowIndex, FOLDER_NAME_COL).setValue(folder.getName());

    let userSheetName = folder.getName() + '_' + role;
    const renameSucceeded = renameSheetIfExists_(existingUserSheetName, userSheetName);
    if (!renameSucceeded && existingUserSheetName) {
      userSheetName = existingUserSheetName;
    }
    userSheetCell.setValue(userSheetName);

    if (existingGroupEmail) {
      existingGroupEmail = existingGroupEmail.toString().trim();
    }
    let groupEmail = existingGroupEmail;
    if (!groupEmail) {
      try {
        groupEmail = generateGroupEmail_(userSheetName);
      } catch (e) {
        // Provide a more specific error for ManagedFolders
        throw new Error(
          'Cannot auto-generate group email for folder "' + folderName + '" with role "' + role + '". ' +
          'The folder name contains non-ASCII characters (e.g., Hebrew, Arabic, Chinese). ' +
          'Please manually specify a group email in the "GroupEmail" column (Column D) of the ManagedFolders sheet. ' +
          'Example: "coordinators-editor@' + Session.getActiveUser().getEmail().split('@')[1] + '"'
        );
      }
    }
    groupEmailCell.setValue(groupEmail);

    getOrCreateUserSheet_(userSheetName);
    
    if (shouldSkipGroupOps_()) {
      log_('Skipping group operations for row ' + rowIndex + ' (Admin SDK not available).', 'WARN');
      sheet.getRange(rowIndex, LAST_SYNCED_COL).setValue(Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss'));
      statusCell.setValue('SKIPPED (No Admin SDK)');
      return null;
    }

    const wasGroupNewlyCreated = getOrCreateGroup_(groupEmail, userSheetName);

    // If the group was just created, pause for 60 seconds to allow it to propagate
    // through Google's systems. This prevents a race condition where Drive tries to send
    // a notification to a group email that isn't fully active yet.
    if (wasGroupNewlyCreated) {
        log_('Pausing for 60 seconds to allow for new group email propagation...');
        Utilities.sleep(60000);
    }

    setFolderPermission_(folder.getId(), groupEmail, role);
    const summary = syncGroupMembership_(groupEmail, userSheetName, options);

    sheet.getRange(rowIndex, LAST_SYNCED_COL).setValue(Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss'));
    statusCell.setValue('OK');
    return summary;

  } catch (e) {
    log_('Failed to process row ' + rowIndex + '. Error: ' + e.message + ' Stack: ' + e.stack, 'ERROR');
    statusCell.setValue('Error: ' + e.message);
    throw e;
  }
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
    requiredSheetNames.add(DRY_RUN_AUDIT_LOG_SHEET_NAME);
    requiredSheetNames.add('DeepFolderAuditLog');

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
                if (row[0]) requiredSheetNames.add(row[0] + '_G');
            });
        }
    }

    return allSheetNames.filter(function(name) { return !requiredSheetNames.has(name); });

  } catch (e) {
    log_('Error during orphan sheet check: ' + e.message, 'ERROR');
    return [];
  }
}

function getOrCreateFolder_(folderName, folderId, options = {}) {
  const { silentMode = false } = options;
  if (folderId) {
    try {
      const folder = DriveApp.getFolderById(folderId);
      if (folderName && folder.getName() !== folderName) {
        const originalName = folder.getName();
        let response = silentMode ? SpreadsheetApp.getUi().Button.NO : null;
        if (!silentMode) {
            const ui = SpreadsheetApp.getUi();
            const message =
            'The Drive folder with ID "' +
            folderId +
            '" is currently named "' +
            originalName +
            '", but the ManagedFolders sheet expects "' +
            folderName +
            '". Rename the Drive folder to match the sheet?';
            response = ui.alert('Folder name mismatch', message, ui.ButtonSet.YES_NO);
        }

        if (response === SpreadsheetApp.getUi().Button.YES) {
          try {
            folder.setName(folderName);
            log_('Renamed folder "' + originalName + '" to "' + folderName + '" to match configuration after confirmation.');
          } catch (renameError) {
            log_('Failed to rename folder "' + originalName + '" to "' + folderName + '": ' + renameError.toString(), 'ERROR');
            const renameFailureError = new Error('Could not rename folder "' + originalName + '" to "' + folderName + '": ' + renameError.message);
            renameFailureError.code = 'FOLDER_RENAME_FAILED';
            throw renameFailureError;
          }
        } else {
          const warningMessage =
            'Folder name mismatch for ID "' +
            folderId +
            '". Expected "' +
            folderName +
            '", but found "' +
            originalName +
            '". Update the ManagedFolders sheet or rename the Drive folder manually.';
          log_(warningMessage, 'WARN');
          const renameDeclinedError = new Error(warningMessage);
          renameDeclinedError.code = 'FOLDER_RENAME_DECLINED';
          throw renameDeclinedError;
        }
      }
      log_('Successfully found folder "' + folder.getName() + '" by ID.');
      return folder;
    } catch (e) {
      if (e && (e.code === 'FOLDER_RENAME_DECLINED' || e.code === 'FOLDER_RENAME_FAILED')) {
        throw e;
      }
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
    return false; // Group already existed
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
    return true; // Group was newly created
  } catch (e) {
    log_('Failed to create group ' + groupEmail + '. Error: ' + e.toString(), 'ERROR');
    throw new Error('Could not create group: ' + e.message);
  }
}

function getOrCreateUserSheet_(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (sheet) {
    ensureUserSheetHeaders_(sheet);

    // Validate for duplicate emails if sheet already exists and has data
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const validation = validateUserSheetEmails_(sheetName);
      if (!validation.valid) {
        const errorMsg = 'VALIDATION ERROR in existing sheet "' + sheetName + '": ' + validation.error;
        log_(errorMsg, 'ERROR');
        throw new Error(errorMsg);
      }
    }

    return sheet;
  } else {
    log_('User sheet "' + sheetName + '" not found. Creating it...');
    sheet = spreadsheet.insertSheet(sheetName, spreadsheet.getSheets().length);

    const headerRange = sheet.getRange(1, 1, 1, 2);
    headerRange.setValues([[USER_EMAIL_HEADER, DISABLED_HEADER]]);
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);

    // Add data validation to Disabled column (checkbox)
    const disabledRange = sheet.getRange('B2:B');
    const rule = SpreadsheetApp.newDataValidation()
      .requireCheckbox()
      .build();
    disabledRange.setDataValidation(rule);

    log_('Successfully created user sheet: "' + sheetName + '"');
    return sheet;
  }
}

function ensureUserSheetHeaders_(sheet) {
  try {
    const headerRange = sheet.getRange(1, 1, 1, 2);
    const headerValues = headerRange.getValues();
    const currentHeaders = headerValues && headerValues.length > 0 ? headerValues[0] : [];
    let headersUpdated = false;

    if (!currentHeaders[0]) {
      headerRange.getCell(1, 1).setValue(USER_EMAIL_HEADER);
      headersUpdated = true;
    }

    if (!currentHeaders[1]) {
      headerRange.getCell(1, 2).setValue(DISABLED_HEADER);
      headersUpdated = true;
    }

    if (headersUpdated) {
      log_('Updated headers on user sheet "' + sheet.getName() + '" to include the Disabled column.');
    }

    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);

    // Ensure data validation on Disabled column (checkbox)
    const disabledRange = sheet.getRange('B2:B');
    const existingRule = disabledRange.getDataValidation();
    if (!existingRule || existingRule.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.CHECKBOX) {
      const rule = SpreadsheetApp.newDataValidation()
        .requireCheckbox()
        .build();
      disabledRange.setDataValidation(rule);
    }
  } catch (e) {
    log_('Failed to ensure headers for sheet "' + sheet.getName() + '": ' + e.toString(), 'WARN');
  }
}

function isUserRowDisabled_(value) {
  if (value === true) {
    return true;
  }
  if (value === false || value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  const normalized = value.toString().trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return normalized === 'true' || normalized === 'yes' || normalized === 'y' || normalized === '1' || normalized === 'disabled';
}

function renameSheetIfExists_(oldName, newName) {
  if (!oldName || oldName === newName) {
    return true;
  }

  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheetToRename = spreadsheet.getSheetByName(oldName);
    if (!sheetToRename) {
      log_('Sheet "' + oldName + '" was not found when attempting to rename it to "' + newName + '".', 'WARN');
      return false;
    }

    const conflictingSheet = spreadsheet.getSheetByName(newName);
    if (conflictingSheet && conflictingSheet !== sheetToRename) {
      log_('A sheet named "' + newName + '" already exists. Skipping rename of "' + oldName + '".', 'WARN');
      return false;
    }

    sheetToRename.setName(newName);
    log_('Renamed sheet "' + oldName + '" to "' + newName + '".');
    return true;
  } catch (e) {
    log_('Failed to rename sheet "' + oldName + '" to "' + newName + '": ' + e.toString(), 'ERROR');
    return false;
  }
}

function syncGroupMembership_(groupEmail, userSheetName, options = {}) {
  const { addOnly = false, removeOnly = false, returnPlanOnly = false } = options;
  log_('*** Starting membership sync for group "' + groupEmail + '" from sheet "' + userSheetName + '"');
  const summary = { added: 0, removed: 0, failed: 0 };

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(userSheetName);
    if (!sheet) {
      throw new Error('User sheet "' + userSheetName + '" not found.');
    }

    // Validate for duplicate emails (case-insensitive)
    const validation = validateUserSheetEmails_(userSheetName);
    if (!validation.valid) {
      const errorMsg = 'VALIDATION ERROR in sheet "' + userSheetName + '": ' + validation.error;
      log_(errorMsg, 'ERROR');
      throw new Error(errorMsg);
    }

    const lastRow = sheet.getLastRow();
    const sheetEmails = [];
    let disabledCount = 0;
    if (lastRow >= 2) {
      const rawValues = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
      rawValues.forEach(function(row, index) {
        const rawValue = row[0];
        const disabledValue = row[1];
        if (rawValue === null || rawValue === undefined) {
          return;
        }

        const cellText = rawValue.toString().trim();
        if (!cellText) {
          return;
        }

        EMAIL_EXTRACTION_REGEX.lastIndex = 0;
        const matches = cellText.match(EMAIL_EXTRACTION_REGEX) || [];
        const sheetRowNumber = index + 2;

        if (matches.length === 0) {
          return; // No email found; ignore silently per requirements.
        }

        if (matches.length > 1) {
          log_('Row ' + sheetRowNumber + ' in sheet "' + userSheetName + '" contains multiple email addresses ("' + cellText + '"). Each row must contain exactly one email. Skipping this entry.', 'ERROR');
          return;
        }

        if (!SINGLE_EMAIL_VALIDATION_REGEX.test(cellText)) {
          log_('Row ' + sheetRowNumber + ' in sheet "' + userSheetName + '" must contain a single valid email address, but found "' + cellText + '". Skipping this entry.', 'ERROR');
          return;
        }

        if (isUserRowDisabled_(disabledValue)) {
          disabledCount++;
          return;
        }

        sheetEmails.push(matches[0].toLowerCase());
      });
    }
    const sheetSet = new Set(sheetEmails);
    if (disabledCount > 0) {
      log_('Found ' + sheetSet.size + ' active emails in sheet "' + userSheetName + '" (skipped ' + disabledCount + ' disabled entr' +
          (disabledCount === 1 ? 'y' : 'ies') + ').');
    } else {
      log_('Found ' + sheetSet.size + ' active emails in sheet "' + userSheetName + '"');
    }

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
      return summary;
    }

    const batchRequests = [];
    const boundary = 'batch_' + new Date().getTime();

    // Create requests for adding members
    if (!removeOnly && emailsToAdd.length > 0) {
      emailsToAdd.forEach(function(email) {
        log_('Adding user "' + email + '" to group "' + groupEmail + '"', 'INFO');
        const payload = { email: email, role: 'MEMBER' };
        batchRequests.push({
          method: 'POST',
          path: '/admin/directory/v1/groups/' + groupEmail + '/members',
          payload: JSON.stringify(payload),
          operation: 'add'
        });
      });
    }

    // Create requests for removing members
    if (!addOnly && emailsToRemove.length > 0) {
      emailsToRemove.forEach(function(email) {
        log_('Removing user "' + email + '" from group "' + groupEmail + '"', 'INFO');
        batchRequests.push({
          method: 'DELETE',
          path: '/admin/directory/v1/groups/' + groupEmail + '/members/' + email,
          operation: 'remove'
        });
      });
    }

    if (batchRequests.length === 0) {
      log_('No changes to apply in this mode.');
      return summary;
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
      
      // Start from index 1, end before the last part which is the closing boundary
      for (let i = 1; i < parts.length - 1; i++) {
        const part = parts[i].trim();
        if (!part) continue;

        const statusMatch = part.match(/^HTTP\/[12]\.[01] (\d{3})/m);
        const operation = batchRequests[i-1].operation; // Get operation from original request

        if (statusMatch) {
            const statusCode = parseInt(statusMatch[1], 10);
            if (statusCode >= 200 && statusCode < 300) {
                if (operation === 'add') summary.added++;
                if (operation === 'remove') summary.removed++;
            } else {
                summary.failed++;
                log_('A batch operation failed for group ' + groupEmail + '. Status: ' + statusCode + '. Details: ' + part, 'ERROR');
            }
        } else {
            summary.failed++;
            log_('Could not parse status for a batch operation part for group ' + groupEmail + '. Part: ' + part, 'ERROR');
        }
      }
      log_('Batch processing summary for ' + groupEmail + ': ' + summary.added + ' added, ' + summary.removed + ' removed, ' + summary.failed + ' failed.');
      if(summary.failed > 0) {
        log_('WARNING: ' + summary.failed + ' membership operations failed to sync for group ' + groupEmail + '. See logs for details.', 'WARN');
      }

    } else {
      summary.failed = batchRequests.length;
      log_('ERROR: Batch request failed for group ' + groupEmail + ' with code ' + responseCode, 'ERROR');
      log_('Response body: ' + responseBody, 'ERROR');
      throw new Error('Batch membership update failed with response code ' + responseCode);
    }

    log_('Membership sync complete for group "' + groupEmail + '"');
    return summary;

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
    const groupEmailLower = groupEmail.toLowerCase();
    const access = folder.getAccess(groupEmail);

    if (roleLower === 'editor' && access === DriveApp.Permission.EDIT) {
        log_('Permission "editor" for group "' + groupEmail + '" on folder "' + folder.getName() + '" already exists. Skipping.');
        return;
    }
    if (roleLower === 'viewer' && access === DriveApp.Permission.VIEW) {
        log_('Permission "viewer" for group "' + groupEmail + '" on folder "' + folder.getName() + '" already exists. Skipping.');
        return;
    }
    // getAccess does not support 'commenter' role. So we check it manually.
    if (roleLower === 'commenter') {
        const commenters = folder.getCommenters().map(user => user.getEmail().toLowerCase());
        if (commenters.indexOf(groupEmailLower) !== -1) {
            // If the user is a commenter, are they also an editor?
            const editors = folder.getEditors().map(user => user.getEmail().toLowerCase());
            if(editors.indexOf(groupEmailLower) === -1) {
                log_('Permission "commenter" for group "' + groupEmail + '" on folder "' + folder.getName() + '" already exists. Skipping.');
                return;
            }
        }
    }

    // If we are here, we need to set the permission.
    // The `add` methods handle downgrades, so we don't need to remove.
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
        // First, remove ALL existing protections from the data range
        const protections = managedSheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
        protections.forEach(function(protection) {
          if (protection.getRange().getRow() >= 2) { // Only remove protections from data rows, not header
            protection.remove();
          }
        });

        // Clear old background colors from columns that might have been protected before
        const clearBgRange = managedSheet.getRange(2, 1, managedSheet.getLastRow() - 1, 7);
        clearBgRange.setBackground(null);

        // Now apply new protection and styling to columns 5-7 only
        const range = managedSheet.getRange(2, USER_SHEET_NAME_COL, managedSheet.getLastRow() - 1, 3);
        range.setBackground('#f3f3f3');
        const protection = range.protect().setDescription('These columns are managed by the script.');
        protection.setWarningOnly(true);
    }

    const userGroupsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USER_GROUPS_SHEET_NAME);
    if (userGroupsSheet && userGroupsSheet.getLastRow() >= 2) {
      // Remove existing protections
      const protections = userGroupsSheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
      protections.forEach(function(protection) {
        if (protection.getRange().getRow() >= 2) {
          protection.remove();
        }
      });

      // Clear old backgrounds
      const clearBgRange = userGroupsSheet.getRange(2, 1, userGroupsSheet.getLastRow() - 1, 4);
      clearBgRange.setBackground(null);

      // Apply new protection and styling
      const range = userGroupsSheet.getRange(2, 2, userGroupsSheet.getLastRow() - 1, 3);
      range.setBackground('#f3f3f3');
      const protection = range.protect().setDescription('These columns are managed by the script.');
      protection.setWarningOnly(true);
    }

    // Apply Disabled dropdown to all user sheets
    updateUserSheetHeaders_();
  } catch (e) {
    log_('Could not apply UI styles. Error: ' + e.message, 'WARN');
  }
}

function getAllManagedSheetNames_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const managedSheetNames = new Set();

  // From ManagedFolders
  const managedFoldersSheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (managedFoldersSheet && managedFoldersSheet.getLastRow() > 1) {
    const userSheetNames = managedFoldersSheet.getRange(2, USER_SHEET_NAME_COL, managedFoldersSheet.getLastRow() - 1, 1).getValues();
    userSheetNames.forEach(function(row) {
      if (row[0]) {
        managedSheetNames.add(row[0]);
      }
    });
  }

  // From UserGroups
  const userGroupsSheet = ss.getSheetByName(USER_GROUPS_SHEET_NAME);
  if (userGroupsSheet && userGroupsSheet.getLastRow() > 1) {
    const groupNames = userGroupsSheet.getRange(2, 1, userGroupsSheet.getLastRow() - 1, 1).getValues();
    groupNames.forEach(function(row) {
      if (row[0]) {
        managedSheetNames.add(row[0] + '_G');
      }
    });
  }

  return managedSheetNames;
}

/**
 * Ensures the "Disabled" column with checkbox validation exists on all user sheets.
 */
function updateUserSheetHeaders_() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const allSheets = spreadsheet.getSheets();
    const managedSheetNames = getAllManagedSheetNames_();

    allSheets.forEach(function(sheet) {
      const sheetName = sheet.getName();
      // Only process user sheets (not control sheets)
      if (managedSheetNames.has(sheetName) &&
          sheetName !== MANAGED_FOLDERS_SHEET_NAME &&
          sheetName !== ADMINS_SHEET_NAME &&
          sheetName !== USER_GROUPS_SHEET_NAME &&
          sheetName !== CONFIG_SHEET_NAME &&
          sheetName !== LOG_SHEET_NAME &&
          sheetName !== TEST_LOG_SHEET_NAME &&
          sheetName !== DRY_RUN_AUDIT_LOG_SHEET_NAME &&
          sheetName !== 'DeepFolderAuditLog') {

        ensureUserSheetHeaders_(sheet);
      }
    });
  } catch (e) {
    log_('Could not update user sheet headers. Error: ' + e.message, 'WARN');
  }
}

// Export for testing
if (typeof module !== 'undefined') {
  module.exports = { fetchAllGroupMembers_ };
}
