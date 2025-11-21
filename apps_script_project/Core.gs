const EMAIL_EXTRACTION_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SINGLE_EMAIL_VALIDATION_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function createSheetLockManager_(enableSheetLocking) {
  const lockingEnabled = enableSheetLocking !== undefined
    ? enableSheetLocking
    : (typeof getConfigValue_ === 'function' ? getConfigValue_('EnableSheetLocking', true) : true);
  const lockedSheets = new Set();

  return {
    isEnabled: lockingEnabled,
    lock(sheet) {
      if (!lockingEnabled || !sheet || lockedSheets.has(sheet)) {
        return;
      }
      lockSheetForEdits_(sheet);
      lockedSheets.add(sheet);
    },
    unlockAll() {
      if (!lockingEnabled) {
        return;
      }
      lockedSheets.forEach(sheet => unlockSheetForEdits_(sheet));
      lockedSheets.clear();
    }
  };
}

/**
 * Processes all folders defined in the ManagedFolders sheet with a batch-oriented approach.
 *
 * This function orchestrates the synchronization process in several phases to maximize efficiency:
 * 1.  **Planning:** Reads the entire sheet and builds a list of "jobs" to be done.
 * 2.  **Folder Sync:** Finds all existing folders in a single batch query, then creates any missing ones.
 * 3.  **Group Sync:** Creates any necessary Google Groups (sequentially, as Admin SDK doesn't support batch creation).
 * 4.  **Permission Sync:** Sets all folder permissions in a single batch API call.
 * 5.  **Membership Sync:** Iterates through the jobs and calls the (already-optimized) `syncGroupMembership_` for each.
 *
 * @param {object} [options={}] - Options for the sync process (e.g., removeOnly, silentMode).
 * @returns {object|undefined} A summary of changes or a plan for deletions.
 */
function processManagedFolders_(options = {}) {
  const returnPlanOnly = options && options.returnPlanOnly !== undefined ? options.returnPlanOnly : false;
  const removeOnly = options && options.removeOnly !== undefined ? options.removeOnly : false;
  const silentMode = options && options.silentMode !== undefined ? options.silentMode : false;
  const totalSummary = { added: 0, removed: 0, failed: 0 };

  log_('*** Starting batch-oriented processing of ManagedFolders sheet...');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (!sheet) {
    if (!silentMode) SpreadsheetApp.getUi().alert(`CRITICAL: Configuration sheet named "${MANAGED_FOLDERS_SHEET_NAME}" not found. Aborting.`);
    return;
  }

  if (!returnPlanOnly && !silentMode) setSheetUiStyles_();

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    log_('No data rows to process in ManagedFolders sheet.');
    return returnPlanOnly ? [] : totalSummary;
  }

  const lockManager = createSheetLockManager_(options.enableSheetLocking);
  const jobs = _buildSyncJobs(sheet, lastRow, options);
  if (jobs.length === 0) {
    log_('No valid jobs to process.');
    return totalSummary;
  }

  try {
    if (lockManager.isEnabled) {
      log_('Locking sheets for sync...', 'INFO');
      lockManager.lock(sheet);
      jobs.forEach(job => lockAssociatedUserSheet_({ spreadsheet: ss }, lockManager, job.existingUserSheetName));
    }

    if (removeOnly || returnPlanOnly) {
      log_('Processing in delete-only or planning mode...');
      jobs.forEach(job => {
        const result = syncGroupMembership_(job.groupEmail, job.userSheetName, options);
        if (result) {
            if (returnPlanOnly) {
                totalSummary.plan = (totalSummary.plan || []).concat(result);
            } else {
                totalSummary.removed += result.removed || 0;
                totalSummary.failed += result.failed || 0;
            }
        }
      });
      log_('Delete-only/planning mode finished.');
      return returnPlanOnly ? totalSummary.plan : totalSummary;
    }

    // --- Full Batch Sync ---
    log_('Step 1/5: Finding existing folders...');
    _batchFindFolders(jobs, sheet);

    log_('Step 2/5: Creating new folders...');
    _sequentiallyCreateFolders(jobs, sheet, silentMode);

    log_('Step 3/5: Creating groups and user sheets...');
    _sequentiallyCreateGroupsAndSheets(jobs, sheet, lockManager);

    log_('Step 4/5: Batch-setting folder permissions...');
    const permSummary = _batchSetPermissions(jobs);
    totalSummary.failed += permSummary.failed; // Add failures from permission setting

    log_('Step 5/5: Syncing group memberships...');
    if (!shouldSkipGroupOps_()) {
        jobs.forEach(job => {
            if (!job.groupEmail || !job.userSheetName) return;
            try {
                showToast_(`Syncing members for ${job.folderName}...`, 'Sync Progress', 10);
                const syncSummary = syncGroupMembership_(job.groupEmail, job.userSheetName, options);
                totalSummary.added += syncSummary.added;
                totalSummary.removed += syncSummary.removed;
                totalSummary.failed += syncSummary.failed;
                sheet.getRange(job.rowIndex, STATUS_COL).setValue('OK');
                sheet.getRange(job.rowIndex, LAST_SYNCED_COL).setValue(formatSpreadsheetTimestamp_(ss));
            } catch (e) {
                log_(`Error syncing members for ${job.folderName}: ${e.message}`, 'ERROR');
                totalSummary.failed++;
                sheet.getRange(job.rowIndex, STATUS_COL).setValue('Error');
            }
        });
    } else {
        log_('Skipping group membership sync (Admin SDK not available).', 'WARN');
        jobs.forEach(job => sheet.getRange(job.rowIndex, STATUS_COL).setValue('SKIPPED (No Admin SDK)'));
    }

    log_('*** Batch-oriented processing finished.');
    return totalSummary;

  } catch (e) {
    log_('FATAL ERROR in processManagedFolders_: ' + e.toString() + ' Stack: ' + e.stack, 'ERROR');
    throw e;
  } finally {
    if (lockManager.isEnabled) {
      log_('Unlocking all sheets.');
      lockManager.unlockAll();
    }
  }
}

/**
 * [HELPER] Reads the ManagedFolders sheet and builds a list of job objects.
 */
function _buildSyncJobs(sheet, lastRow, options) {
  const silentMode = options.silentMode;
  const onlySyncPrefixes = options.onlySyncPrefixes;
  const onlySyncRowIndexes = options.onlySyncRowIndexes;

  log_('Building sync jobs from ManagedFolders sheet...');
  const jobs = [];
  const data = sheet.getRange(2, 1, lastRow - 1, Math.max(FOLDER_NAME_COL, ROLE_COL, GROUP_EMAIL_COL, USER_SHEET_NAME_COL)).getValues();
  const testConfig = getTestConfiguration_();
  const manualTestFolderName = testConfig.folderName;

  data.forEach((row, i) => {
    const rowIndex = i + 2;
    const folderName = row[FOLDER_NAME_COL - 1];
    const folderId = row[FOLDER_ID_COL - 1];
    const role = row[ROLE_COL - 1];

    if (!folderName && !folderId) return; // Skip empty rows

    // Filter based on options for testing
    if (onlySyncPrefixes && !onlySyncPrefixes.some(prefix => folderName.startsWith(prefix))) {
        return;
    }
    if (onlySyncRowIndexes && !onlySyncRowIndexes.includes(rowIndex)) {
        return;
    }
    
    // Default silent mode behavior for AutoSync
    if (silentMode && !onlySyncPrefixes && !onlySyncRowIndexes) {
      if (folderName.startsWith('StressTestFolder_') || folderName === manualTestFolderName) {
        log_(`Auto-sync skipping test folder: "${folderName}"`, 'INFO');
        return;
      }
    }
    
    if (!role) {
        log_(`Skipping row ${rowIndex} due to missing role for folder "${folderName}".`, 'ERROR');
        sheet.getRange(rowIndex, STATUS_COL).setValue('Error: Role is missing');
        return;
    }

    const job = {
      rowIndex: rowIndex,
      folderName: folderName,
      folderId: folderId,
      role: role,
      existingGroupEmail: row[GROUP_EMAIL_COL - 1],
      existingUserSheetName: row[USER_SHEET_NAME_COL - 1],
      folder: null // To be populated later
    };
    jobs.push(job);
  });
  log_(`Built ${jobs.length} valid sync jobs.`);
  return jobs;
}

/**
 * [HELPER] Uses Drive API search to find all existing folders in a single API call.
 */
function _batchFindFolders(jobs, sheet) {
  const folderNamesToFind = jobs.filter(j => j.folderName && !j.folderId).map(j => `'${j.folderName.replace(/'/g, "\'" )}'`);
  if (folderNamesToFind.length === 0) {
    log_('No folder names to find, all are specified by ID or none exist.');
    return;
  }

  const query = `mimeType = 'application/vnd.google-apps.folder' and trashed = false and (${folderNamesToFind.map(name => `name = ${name}`).join(' or ')})`;
  const existingFolders = new Map(); // name -> [folder]
  
  try {
    let pageToken = null;
    do {
      const response = Drive.Files.list({
        q: query,
        fields: 'nextPageToken, files(id, name)',
        pageToken: pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });
      response.files.forEach(file => {
        if (!existingFolders.has(file.name)) {
          existingFolders.set(file.name, []);
        }
        existingFolders.get(file.name).push(file);
      });
      pageToken = response.nextPageToken;
    } while (pageToken);

    jobs.forEach(job => {
      if (job.folderName && existingFolders.has(job.folderName)) {
        const found = existingFolders.get(job.folderName);
        if (found.length > 1) {
          throw new Error(`Ambiguous: Multiple folders exist with the name "${job.folderName}". Please specify by ID in row ${job.rowIndex}.`);
        }
        job.folder = found[0];
        job.folderId = found[0].id;
        sheet.getRange(job.rowIndex, FOLDER_ID_COL).setValue(job.folderId);
      }
    });
  } catch(e) {
    log_('Error during batch folder search: ' + e.message, 'ERROR');
    throw e;
  }
}

/**
 * [HELPER] Sequentially creates folders that were not found in the batch find operation.
 */
function _sequentiallyCreateFolders(jobs, sheet, silentMode) {
    jobs.forEach(job => {
        try {
            if (job.folder) return; // Already found or processed
            const folder = getOrCreateFolder_(job.folderName, job.folderId, { silentMode: silentMode });
            job.folder = folder;
            job.folderId = folder.getId();
            job.folderName = folder.getName(); // Update name in case it was corrected

            // Write updates to sheet immediately
            sheet.getRange(job.rowIndex, FOLDER_ID_COL).setValue(job.folderId);
            sheet.getRange(job.rowIndex, FOLDER_NAME_COL).setValue(job.folderName);
            sheet.getRange(job.rowIndex, URL_COL).setValue(folder.getUrl());
        } catch (e) {
            log_(`Failed to get/create folder for row ${job.rowIndex}: ${e.message}`, 'ERROR');
            sheet.getRange(job.rowIndex, STATUS_COL).setValue('Error: Folder creation failed');
            job.error = true; // Mark job as failed
        }
    });
}

/**
 * [HELPER] Sequentially creates groups and user sheets for jobs that need them.
 */
function _sequentiallyCreateGroupsAndSheets(jobs, sheet, lockManager) {
  if (shouldSkipGroupOps_()) {
      log_('Skipping group/sheet creation (Admin SDK not available).', 'WARN');
      return;
  }

  jobs.forEach(job => {
    if (job.error || !job.folder) return; // Skip failed or folder-less jobs

    let userSheetName = `${job.folderName}_${job.role}`;
    if (job.existingUserSheetName && job.existingUserSheetName !== userSheetName) {
      renameSheetIfExists_(job.existingUserSheetName, userSheetName);
    }
    job.userSheetName = userSheetName;

    let groupEmail = job.existingGroupEmail;
    if (!groupEmail) {
      try {
        groupEmail = generateGroupEmail_(userSheetName);
      } catch (e) {
        log_(`Failed to generate group email for row ${job.rowIndex}: ${e.message}`, 'ERROR');
        sheet.getRange(job.rowIndex, STATUS_COL).setValue('Error: Bad group name');
        job.error = true;
        return;
      }
    }
    job.groupEmail = groupEmail;

    // Write updates to sheet
    sheet.getRange(job.rowIndex, USER_SHEET_NAME_COL).setValue(job.userSheetName);
    sheet.getRange(job.rowIndex, GROUP_EMAIL_COL).setValue(job.groupEmail);

    // Create resources
    const userSheet = getOrCreateUserSheet_(job.userSheetName);
    if (lockManager.isEnabled) {
      lockManager.lock(userSheet);
    }
    getOrCreateGroup_(job.groupEmail, job.userSheetName);
  });
}

/**
 * [HELPER] Sets folder permissions for all jobs in a single batch request.
 */
function _batchSetPermissions(jobs) {
    const summary = { failed: 0 };
    if (shouldSkipGroupOps_()) return summary;

    const requests = jobs.filter(job => !job.error && job.folderId && job.groupEmail && job.role)
        .map(job => {
            const driveApiRole = (job.role.toLowerCase() === 'editor') ? 'writer' : (job.role.toLowerCase() === 'viewer') ? 'reader' : 'commenter';
            return {
                method: 'POST',
                path: `/drive/v3/files/${job.folderId}/permissions?supportsAllDrives=true&sendNotificationEmail=false`,
                payload: JSON.stringify({ type: 'group', role: driveApiRole, emailAddress: job.groupEmail }),
                job: job
            };
        });

    if (requests.length === 0) return summary;

    log_(`Sending batch request with ${requests.length} permission operations...`);
    const batchResponse = _executeBatchRequest(requests, 'https://www.googleapis.com/batch/drive/v3');

    batchResponse.forEach((part, i) => {
        const job = requests[i].job;
        if (part.success) {
            log_(`Successfully set role "${job.role}" for group "${job.groupEmail}" on folder "${job.folderName}"`, 'INFO');
        } else {
            // Ignore "permission already exists" errors, treat as success
            if (part.body && part.body.includes('duplicate')) {
                 log_(`Permission for group "${job.groupEmail}" on folder "${job.folderName}" already exists. Skipping.`, 'INFO');
            } else {
                summary.failed++;
                job.error = true;
                log_(`Batch permission failure for group ${job.groupEmail} on folder ${job.folderName}. Status: ${part.status}. Details: ${part.body}`, 'ERROR');
            }
        }
    });
    return summary;
}

/**
 * [HELPER] Generic function to execute a multipart/mixed batch request.
 * @param {Array<object>} requests - Array of request objects {method, path, payload, ...}.
 * @param {string} batchUrl - The batch endpoint URL.
 * @returns {Array<object>} An array of response objects {success, status, body}.
 */
function _executeBatchRequest(requests, batchUrl) {
    const boundary = 'batch_' + new Date().getTime();
    let requestBody = '';
    requests.forEach((req, i) => {
        requestBody += `--${boundary}\n`;
        requestBody += 'Content-Type: application/http\n';
        requestBody += `Content-ID: item${i}\n\n`;
        requestBody += `${req.method} ${req.path}\n`;
        if (req.payload) {
            requestBody += 'Content-Type: application/json\n\n';
            requestBody += req.payload + '\n';
        } else {
            requestBody += '\n';
        }
    });
    requestBody += `--${boundary}--`;

    const fetchOptions = {
        method: 'POST',
        contentType: `multipart/mixed; boundary=${boundary}`,
        payload: requestBody,
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(batchUrl, fetchOptions);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode < 200 || responseCode >= 300) {
        log_(`Batch request to ${batchUrl} failed with code ${responseCode}: ${responseBody}`, 'ERROR');
        throw new Error(`Batch request failed with response code ${responseCode}`);
    }
    
    const contentTypeHeader = response.getHeaders()['Content-Type'];
    if (!contentTypeHeader || !contentTypeHeader.includes('boundary=')) {
        throw new Error('Invalid batch response: boundary not found in Content-Type header.');
    }
    const responseBoundary = '--' + contentTypeHeader.split('boundary=')[1];
    const parts = responseBody.split(responseBoundary);
    const responses = [];

    for (let i = 1; i < parts.length - 1; i++) {
        const part = parts[i].trim();
        if (!part) continue;
        
        const statusMatch = part.match(/^HTTP\/[12]\.[01] (\d{3})/m);
        const status = statusMatch ? parseInt(statusMatch[1], 10) : 500;
        
        responses.push({
            success: status >= 200 && status < 300,
            status: status,
            body: part
        });
    }
    return responses;
}


function lockAssociatedUserSheet_(context, lockManager, sheetName) {
  if (!lockManager.isEnabled || !sheetName) {
    return;
  }

  const userSheet = context.spreadsheet.getSheetByName(sheetName);
  if (userSheet) {
    lockManager.lock(userSheet);
  }
}

function formatSpreadsheetTimestamp_(spreadsheet) {
  return Utilities.formatDate(new Date(), spreadsheet.getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

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
    requiredSheetNames.add(FOLDER_AUDIT_LOG_SHEET_NAME);
    requiredSheetNames.add(SYNC_HISTORY_SHEET_NAME);
    requiredSheetNames.add('DeepFolderAuditLog');
    requiredSheetNames.add('Help');

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

    return allSheetNames.filter(function(name) {
        return !requiredSheetNames.has(name) && !isTestSheet_(name);
    });

  } catch (e) {
    log_('Error during orphan sheet check: ' + e.message, 'ERROR');
    return [];
  }
}

function getOrCreateFolder_(folderName, folderId, options = {}) {
  const silentMode = options && options.silentMode !== undefined ? options.silentMode : false;
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
            folderName + '" Rename the Drive folder to match the sheet?';
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
            originalName + '" Update the ManagedFolders sheet or rename the Drive folder manually.';
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
  let group;
  let wasNewlyCreated = false;

  try {
    group = AdminDirectory.Groups.get(groupEmail);
    log_('Found existing group: ' + groupEmail);
    wasNewlyCreated = false;
  } catch (e) {
    log_('Group "' + groupEmail + '" not found. Will attempt to create it.');

    try {
      const newGroup = {
        email: groupEmail,
        name: groupName,
        description: 'Managed by Google Sheets script. Folder: ' + groupName.split('_')[0]
      };
      group = AdminDirectory.Groups.insert(newGroup);
      log_('Successfully created group: ' + groupEmail);
      wasNewlyCreated = true;
    } catch (createError) {
      log_('Failed to create group ' + groupEmail + '. Error: ' + createError.toString(), 'ERROR');
      throw new Error('Could not create group: ' + createError.message);
    }
  }

  return { group: group, wasNewlyCreated: wasNewlyCreated };
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
    sheet.getRange('B1').clearDataValidations().clearNote();
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
  const addOnly = options && options.addOnly !== undefined ? options.addOnly : false;
  const removeOnly = options && options.removeOnly !== undefined ? options.removeOnly : false;
  const returnPlanOnly = options && options.returnPlanOnly !== undefined ? options.returnPlanOnly : false;
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

    let requestsToProcess = [];
    if (!removeOnly) {
        emailsToAdd.forEach(function(email) {
            requestsToProcess.push({
                method: 'POST',
                path: `/admin/directory/v1/groups/${groupEmail}/members`,
                payload: JSON.stringify({ email: email, role: 'MEMBER' }),
                operation: 'add',
                email: email
            });
        });
    }
    if (!addOnly) {
        emailsToRemove.forEach(function(email) {
            requestsToProcess.push({
                method: 'DELETE',
                path: `/admin/directory/v1/groups/${groupEmail}/members/${email}`,
                operation: 'remove',
                email: email
            });
        });
    }
    
    if (requestsToProcess.length === 0) {
      log_('No changes to apply in this mode.');
      return summary;
    }

    log_(`Starting to process ${requestsToProcess.length} membership changes for ${groupEmail}.`);

    let retries = 0;
    const MAX_RETRIES = 5;
    const INITIAL_DELAY_MS = 1000;

    while (requestsToProcess.length > 0 && retries < MAX_RETRIES) {
        const batchResponses = _executeBatchRequest(requestsToProcess, 'https://www.googleapis.com/batch/admin/directory_v1');
        const failedRequests = [];

        batchResponses.forEach((part, i) => {
            const originalRequest = requestsToProcess[i];
            if (part.success) {
                if (originalRequest.operation === 'add') summary.added++;
                if (originalRequest.operation === 'remove') summary.removed++;
            } else {
                if (part.status === 403 && part.body.includes('quotaExceeded')) {
                    failedRequests.push(originalRequest);
                } else {
                    summary.failed++;
                    log_(`A batch operation permanently failed for group ${groupEmail} on user ${originalRequest.email}. Status: ${part.status}. Details: ${part.body}`, 'ERROR');
                }
            }
        });

        if (failedRequests.length > 0) {
            requestsToProcess = failedRequests;
            retries++;
            if (retries < MAX_RETRIES) {
                const delay = INITIAL_DELAY_MS * Math.pow(2, retries - 1) + Math.random() * 1000;
                log_(`Rate limit hit for ${groupEmail}. Retrying ${failedRequests.length} failed operations in ${Math.round(delay / 1000)}s...`, 'WARN');
                Utilities.sleep(delay);
            } else {
                summary.failed += failedRequests.length;
                log_(`Max retries reached for ${groupEmail}. ${failedRequests.length} operations could not be completed.`, 'ERROR');
            }
        } else {
            requestsToProcess = [];
        }
    }

    log_('Batch processing summary for ' + groupEmail + ': ' + summary.added + ' added, ' + summary.removed + ' removed, ' + summary.failed + ' failed.', 'INFO');
    if(summary.failed > 0) {
      log_('WARNING: ' + summary.failed + ' membership operations failed to sync for group ' + groupEmail + '. See logs for details.', 'WARN');
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
  const MAX_RETRIES = 5;
  const INITIAL_DELAY_MS = 5000; // 5 seconds

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const folder = DriveApp.getFolderById(folderId);
      const folderName = folder.getName();
      const roleLower = role.toLowerCase();
      const groupEmailLower = groupEmail.toLowerCase();

      // Check if Drive API v3 is available
      const driveApiAvailable = typeof Drive !== 'undefined';

      if (driveApiAvailable) {
        // PREFERRED: Use Drive API v3 with sendNotificationEmail: false
        const driveApiRole = (roleLower === 'editor') ? 'writer' : (roleLower === 'viewer') ? 'reader' : 'commenter';

        // Check if permission already exists with the correct role
        try {
          const existingPermissions = Drive.Permissions.list(folderId, {
            fields: 'permissions(id,emailAddress,role,type)'
          }).permissions || [];

          const existingPermission = existingPermissions.find(function(perm) {
            return perm.emailAddress && perm.emailAddress.toLowerCase() === groupEmailLower && perm.type === 'group';
          });

          if (existingPermission) {
            if (existingPermission.role === driveApiRole) {
              log_('Permission "' + role + '" for group "' + groupEmail + '" on folder "' + folderName + '" already exists. Skipping.');
              return;
            } else {
              // Permission exists but with different role - update it
              log_('Updating permission for group "' + groupEmail + '" on folder "' + folderName + '" from "' + existingPermission.role + '" to "' + driveApiRole + '"');
              Drive.Permissions.update(
                { role: driveApiRole },
                folderId,
                existingPermission.id,
                { sendNotificationEmail: false, supportsAllDrives: true }
              );
              log_('Successfully updated role "' + role + '" for group "' + groupEmail + '" on folder "' + folderName + '"');
              return;
            }
          }
        } catch (checkError) {
          log_('Could not check existing permissions (will attempt to create): ' + checkError.message, 'WARN');
        }

        // Permission doesn't exist - create it WITHOUT sending notification email
        log_('Creating new permission "' + role + '" for group "' + groupEmail + '" on folder "' + folderName + '"');
        Drive.Permissions.create(
          {
            type: 'group',
            role: driveApiRole,
            emailAddress: groupEmail
          },
          folderId,
          {
            sendNotificationEmail: false,  // KEY: Don't send emails!
            supportsAllDrives: true
          }
        );
        log_('Successfully set role "' + role + '" for group "' + groupEmail + '" on folder "' + folderName + '"');

      } else {
        // FALLBACK: Use DriveApp methods (will send notification emails!)
        log_('⚠️ Drive API v3 not available - using DriveApp (WILL SEND NOTIFICATION EMAILS)', 'WARN');
        log_('⚠️ To stop email spam: Add Drive API v3 in Apps Script (+ next to Services)', 'WARN');

        const access = folder.getAccess(groupEmail);

        if (roleLower === 'editor' && access === DriveApp.Permission.EDIT) {
          log_('Permission "editor" for group "' + groupEmail + '" on folder "' + folderName + '" already exists. Skipping.');
          return;
        }
        if (roleLower === 'viewer' && access === DriveApp.Permission.VIEW) {
          log_('Permission "viewer" for group "' + groupEmail + '" on folder "' + folderName + '" already exists. Skipping.');
          return;
        }
        if (roleLower === 'commenter') {
          const commenters = folder.getCommenters().map(user => user.getEmail().toLowerCase());
          if (commenters.indexOf(groupEmailLower) !== -1) {
            const editors = folder.getEditors().map(user => user.getEmail().toLowerCase());
            if(editors.indexOf(groupEmailLower) === -1) {
              log_('Permission "commenter" for group "' + groupEmail + '" on folder "' + folderName + '" already exists. Skipping.');
              return;
            }
          }
        }

        // Set permission using DriveApp (will send email!)
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
        log_('Successfully set role "' + role + '" for group "' + groupEmail + '" on folder "' + folderName + '" (notification email sent)');
      }
      return; // Success, exit the loop
    } catch (e) {
      if (i < MAX_RETRIES - 1) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, i);
        log_(`Failed to set permission for group ${groupEmail} on folder ${folderId}. Retrying in ${delay / 1000} seconds... (Attempt ${i + 1}/${MAX_RETRIES})`, 'WARN');
        Utilities.sleep(delay);
      } else {
        log_(`Failed to set permission for group ${groupEmail} on folder ${folderId} after ${MAX_RETRIES} attempts. Error: ${e.toString()}`, 'ERROR');
        throw new Error(`Could not set folder permission: ${e.message}`);
      }
    }
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
        const clearBgRange = managedSheet.getRange(2, 1, managedSheet.getLastRow() - 1, 8);
        clearBgRange.setBackground(null);

        // Now apply new protection and styling to columns 5-8 only
        const range = managedSheet.getRange(2, USER_SHEET_NAME_COL, managedSheet.getLastRow() - 1, 4);
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
          sheetName !== FOLDER_AUDIT_LOG_SHEET_NAME &&
          sheetName !== SYNC_HISTORY_SHEET_NAME &&
          sheetName !== 'DeepFolderAuditLog') {

        ensureUserSheetHeaders_(sheet);
      }
    });
  } catch (e) {
    log_('Could not update user sheet headers. Error: ' + e.message, 'WARN');
  }
}

function validateManagedFolders_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (!sheet) {
    return; // Sheet doesn't exist, so nothing to validate.
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return; // No data rows to validate.
  }

  const data = sheet.getRange(2, 1, lastRow - 1, ROLE_COL).getValues();
  const errors = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const folderName = row[FOLDER_NAME_COL - 1];
    const folderId = row[FOLDER_ID_COL - 1];
    const role = row[ROLE_COL - 1];

    if ((folderName || folderId) && !role) {
      errors.push(`Row ${i + 2}: Role is not specified.`);
    }
  }

  if (errors.length > 0) {
    throw new Error('Validation failed for ManagedFolders sheet:\n' + errors.join('\n'));
  }
}
