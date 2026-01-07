const EMAIL_EXTRACTION_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SINGLE_EMAIL_VALIDATION_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function createSheetLockManager_(enableSheetLocking, executionId) {
  const lockingEnabled = enableSheetLocking !== undefined
    ? enableSheetLocking
    : (typeof getConfigValue_ === 'function' ? getConfigValue_('EnableSheetLocking', true) : true);
  const lockedSheets = new Set();
  const currentExecutionId = executionId;

  return {
    isEnabled: lockingEnabled,
    cleanupStaleLocks(sheets) {
      if (!lockingEnabled) {
        return;
      }
      removeStaleLocks_(sheets, currentExecutionId);
    },
    lock(sheet) {
      if (!lockingEnabled || !sheet || lockedSheets.has(sheet)) {
        return;
      }
      lockSheetForEdits_(sheet, currentExecutionId);
      lockedSheets.add(sheet);
    },
    unlockAll() {
      if (!lockingEnabled) {
        return;
      }
      lockedSheets.forEach(sheet => unlockSheetForEdits_(sheet, currentExecutionId));
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
  const executionSource = options && options.executionSource !== undefined ? options.executionSource : 'MANUAL';
  const totalSummary = { added: 0, removed: 0, failed: 0 };

  log_('*** Starting batch-oriented processing of ManagedFolders sheet...');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (!sheet) {
    if (!silentMode) SpreadsheetApp.getUi().alert(`CRITICAL: Configuration sheet named "${MANAGED_FOLDERS_SHEET_NAME}" not found. Aborting.`);
    return;
  }

  // Get header map for dynamic column resolution
  const headers = getHeaderMap_(sheet);
  const folderNameCol = resolveColumn_(headers, 'foldername', 1);
  const folderIdCol = resolveColumn_(headers, 'folderid', 2);
  const roleCol = resolveColumn_(headers, 'role', 3);
  const groupEmailCol = resolveColumn_(headers, 'groupemail', 4);
  const userSheetNameCol = resolveColumn_(headers, 'usersheetname', 5);
  const lastSyncedCol = resolveColumn_(headers, 'last synced', 6);
  const statusCol = resolveColumn_(headers, 'status', 7);
  const urlCol = resolveColumn_(headers, 'url', 8);

  if (!returnPlanOnly && !silentMode) setSheetUiStyles_(headers);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    log_('No data rows to process in ManagedFolders sheet.');
    return returnPlanOnly ? [] : totalSummary;
  }

  const executionId = new Date().getTime() + '_' + Math.random().toString().substring(2);
  const lockManager = createSheetLockManager_(options.enableSheetLocking, executionId);
  const jobs = _buildSyncJobs(sheet, lastRow, options, headers);

  if (jobs.length === 0) {
    log_('No valid jobs to process.');
    return returnPlanOnly ? [] : totalSummary;
  }

  let jobsToProcess = jobs;
  // NEW: Filter out test-related jobs if this is an AutoSync run
  if (executionSource === 'AUTO_SYNC') {
      const testConfig = getTestConfiguration_(); // Get test config for filtering
      const manualTestFolderName = testConfig.folderName; // Manual test folder name
      const testFolderPrefix = 'StressTestFolder_'; // Prefix for stress test folders

      jobsToProcess = jobs.filter(job => {
          const isTestFolder = job.folderName.startsWith(testFolderPrefix) || job.folderName === manualTestFolderName;
          if (isTestFolder) {
              log_(`Auto-sync skipping test folder: "${job.folderName}" (row ${job.rowIndex})`, 'INFO');
          }
          return !isTestFolder; // Keep only non-test folders
      });
      if (jobs.length !== jobsToProcess.length) {
          log_(`Filtered out ${jobs.length - jobsToProcess.length} test-related jobs. ${jobsToProcess.length} non-test jobs remaining.`, 'INFO');
      }
      if (jobsToProcess.length === 0) {
          log_('No non-test jobs remaining to process after filtering.');
          return returnPlanOnly ? [] : totalSummary;
      }
  }
  
  if (lockManager.isEnabled) {
    const allSheetNamesForSync = [MANAGED_FOLDERS_SHEET_NAME].concat(jobsToProcess.map(j => j.existingUserSheetName).filter(Boolean));
    const sheetObjectsForSync = allSheetNamesForSync.map(name => ss.getSheetByName(name)).filter(Boolean);
    lockManager.cleanupStaleLocks(sheetObjectsForSync);
  }

  try {
    if (lockManager.isEnabled) {
      log_('Locking sheets for sync...', 'INFO');
      lockManager.lock(sheet);
      jobsToProcess.forEach(job => lockAssociatedUserSheet_({ spreadsheet: ss }, lockManager, job.existingUserSheetName));
    }

    if (removeOnly || returnPlanOnly) {
      log_('Processing in delete-only or planning mode...');
      jobsToProcess.forEach(job => {
        const result = syncGroupMembership_(job.existingGroupEmail, job.existingUserSheetName, options);
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
    _batchFindFolders(jobsToProcess, sheet, folderIdCol);

    log_('Step 2/5: Creating new folders...');
    _sequentiallyCreateFolders(jobsToProcess, sheet, silentMode, totalSummary, { folderIdCol, folderNameCol, urlCol, statusCol });

    log_('Step 3/5: Creating groups and user sheets...');
    _sequentiallyCreateGroupsAndSheets(jobsToProcess, sheet, lockManager, totalSummary, { userSheetNameCol, groupEmailCol, statusCol });

    log_('Step 4/5: Batch-setting folder permissions...');
    const permSummary = _batchSetPermissions(jobsToProcess);
    totalSummary.failed += permSummary.failed; // Add failures from permission setting

    log_('Step 5/5: Syncing group memberships...');
    if (!shouldSkipGroupOps_()) {
        jobsToProcess.forEach(job => {
            if (!job.groupEmail || !job.userSheetName) return;
            try {
                showToast_(`Syncing members for ${job.folderName}...`, 'Sync Progress', 10);
                const syncSummary = syncGroupMembership_(job.groupEmail, job.userSheetName, options);
                totalSummary.added += syncSummary.added;
                totalSummary.removed += syncSummary.removed;
                totalSummary.failed += syncSummary.failed;
                sheet.getRange(job.rowIndex, statusCol).setValue('OK');
                sheet.getRange(job.rowIndex, lastSyncedCol).setValue(formatSpreadsheetTimestamp_(ss));
            } catch (e) {
                log_(`Error syncing members for ${job.folderName}: ${e.message}`, 'ERROR');
                totalSummary.failed++;
                sheet.getRange(job.rowIndex, statusCol).setValue('Error');
            }
        });
    } else {
        log_('Skipping group membership sync (Admin SDK not available).', 'WARN');
        jobsToProcess.forEach(job => sheet.getRange(job.rowIndex, statusCol).setValue('SKIPPED (No Admin SDK)'));
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
function _buildSyncJobs(sheet, lastRow, options, headers) {
  const onlySyncPrefixes = options.onlySyncPrefixes;
  const onlySyncRowIndexes = options.onlySyncRowIndexes;
  
  // Resolve columns from headers map
  const folderNameCol = resolveColumn_(headers, 'foldername', 1);
  const folderIdCol = resolveColumn_(headers, 'folderid', 2);
  const roleCol = resolveColumn_(headers, 'role', 3);
  const groupEmailCol = resolveColumn_(headers, 'groupemail', 4);
  const userSheetNameCol = resolveColumn_(headers, 'usersheetname', 5);
  const statusCol = resolveColumn_(headers, 'status', 7);

  log_('Building sync jobs from ManagedFolders sheet...');
  const jobs = [];
  const data = sheet.getRange(2, 1, lastRow - 1, Math.max(...Object.values(headers))).getValues();

  data.forEach((row, i) => {
    const rowIndex = i + 2;
    const folderName = row[folderNameCol - 1];
    const folderId = row[folderIdCol - 1];
    const role = row[roleCol - 1];

    if (!folderName && !folderId) return; // Skip empty rows

    // Filter based on options for testing (e.g., specific prefixes or row indexes for targeted runs)
    if (onlySyncPrefixes && !onlySyncPrefixes.some(prefix => folderName.startsWith(prefix))) {
        return;
    }
    if (onlySyncRowIndexes && !onlySyncRowIndexes.includes(rowIndex)) {
        return;
    }
    
    if (!role) {
        log_(`Skipping row ${rowIndex} due to missing role for folder "${folderName}".`, 'ERROR');
        sheet.getRange(rowIndex, statusCol).setValue('Error: Role is missing');
        return;
    }

    const job = {
      rowIndex: rowIndex,
      folderName: folderName,
      folderId: folderId,
      role: role,
      existingGroupEmail: row[groupEmailCol - 1],
      existingUserSheetName: row[userSheetNameCol - 1],
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
function _batchFindFolders(jobs, sheet, folderIdCol) {
  const folderNamesToFind = jobs
    .filter(j => j.folderName && !j.folderId)
    .map(j => escapeDriveQueryValue_(j.folderName));
  if (folderNamesToFind.length === 0) {
    log_('No folder names to find, all are specified by ID or none exist.');
    return;
  }

  const query = `mimeType = 'application/vnd.google-apps.folder' and trashed = false and (${folderNamesToFind.map(name => `name = '${name}'`).join(' or ')})`;
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
        sheet.getRange(job.rowIndex, folderIdCol).setValue(job.folderId);
      }
    });
  } catch(e) {
    log_('Error during batch folder search: ' + e.message, 'ERROR');
    throw e;
  }
}

function escapeDriveQueryValue_(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ');
}

/**
 * [HELPER] Sequentially creates folders that were not found in the batch find operation.
 */
function _sequentiallyCreateFolders(jobs, sheet, silentMode, totalSummary, colMap) {
    const { folderIdCol, folderNameCol, urlCol, statusCol } = colMap;
    jobs.forEach(job => {
        try {
            if (job.folder) return; // Already found or processed
            const result = getOrCreateFolder_(job.folderName, job.folderId, { silentMode: silentMode });
            job.folder = result.folder;
            job.folderId = result.folder.getId();
            job.folderName = result.folder.getName(); // Update name in case it was corrected
            if (result.wasNewlyCreated) {
              totalSummary.added++;
              logStructuralChangeRequest_(
                MANAGED_FOLDERS_SHEET_NAME,
                'FOLDER|' + job.folderId,
                'ADD',
                {
                  changeType: 'STRUCTURAL_FOLDER_CREATE',
                  folderId: job.folderId,
                  folderName: job.folderName,
                  rowIndex: job.rowIndex
                },
                'SYSTEM'
              );
            }

            // Write updates to sheet immediately
            sheet.getRange(job.rowIndex, folderIdCol).setValue(job.folderId);
            sheet.getRange(job.rowIndex, folderNameCol).setValue(job.folderName);
            sheet.getRange(job.rowIndex, urlCol).setValue(result.folder.getUrl());
        } catch (e) {
            log_(`Failed to get/create folder for row ${job.rowIndex}: ${e.message}`, 'ERROR');
            sheet.getRange(job.rowIndex, statusCol).setValue('Error: Folder creation failed');
            job.error = true; // Mark job as failed
            totalSummary.failed++;
        }
    });
}

/**
 * [HELPER] Sequentially creates groups and user sheets for jobs that need them.
 */
function _sequentiallyCreateGroupsAndSheets(jobs, sheet, lockManager, totalSummary, colMap) {
  const { userSheetNameCol, groupEmailCol, statusCol } = colMap;
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
        sheet.getRange(job.rowIndex, statusCol).setValue('Error: Bad group name');
        job.error = true;
        totalSummary.failed++;
        return;
      }
    }
    job.groupEmail = groupEmail;
    const bindingKey = job.folderId
      ? buildFolderPermissionRowKey_(job.folderId, job.groupEmail, job.role)
      : 'ROW|' + job.rowIndex;

    // Write updates to sheet
    sheet.getRange(job.rowIndex, userSheetNameCol).setValue(job.userSheetName);
    sheet.getRange(job.rowIndex, groupEmailCol).setValue(job.groupEmail);

    // Create resources
    const sheetResult = getOrCreateUserSheet_(job.userSheetName);
    if (sheetResult.wasNewlyCreated) {
      totalSummary.added++;
      logStructuralChangeRequest_(
        MANAGED_FOLDERS_SHEET_NAME,
        bindingKey,
        'ADD',
        {
          changeType: 'STRUCTURAL_USER_SHEET_CREATE',
          folderId: job.folderId || '',
          folderName: job.folderName,
          role: job.role,
          groupEmail: job.groupEmail,
          userSheetName: job.userSheetName
        },
        'SYSTEM'
      );
    }
    const userSheet = sheetResult.sheet;

    if (lockManager.isEnabled) {
      lockManager.lock(userSheet);
    }
    
    const groupResult = getOrCreateGroup_(job.groupEmail, job.userSheetName);
    if (groupResult.wasNewlyCreated) {
      totalSummary.added++;
      logStructuralChangeRequest_(
        MANAGED_FOLDERS_SHEET_NAME,
        bindingKey,
        'ADD',
        {
          changeType: 'STRUCTURAL_GROUP_CREATE',
          folderId: job.folderId || '',
          folderName: job.folderName,
          role: job.role,
          groupEmail: job.groupEmail,
          groupName: job.userSheetName
        },
        'SYSTEM'
      );
    }
  });
}

/**
 * [HELPER] Sets folder permissions for all jobs in a single batch request.
 */
function _batchSetPermissions(jobs) {
    const summary = { failed: 0 };
    if (shouldSkipGroupOps_()) return summary;

    const approvalsConfig = getApprovalsConfig_();
    let changeRequestContext = null;
    ensureChangeRequestsSheet_();
    const changeSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHANGE_REQUESTS_SHEET_NAME);
    if (changeSheet) {
      changeRequestContext = {
        changeSheet: changeSheet,
        columnMap: getChangeRequestsColumnMap_(changeSheet),
        approvalsConfig: approvalsConfig
      };
    }

    const requests = [];
    jobs.forEach(function(job) {
        if (job.error || !job.folderId || !job.groupEmail || !job.role) {
          return;
        }

        const driveApiRole = (job.role.toLowerCase() === 'editor') ? 'writer' : (job.role.toLowerCase() === 'viewer') ? 'reader' : 'commenter';
        const existingPermission = getFolderGroupPermissionInfo_(job.folderId, job.groupEmail);
        if (existingPermission && existingPermission.role === driveApiRole) {
          log_(`Permission "${job.role}" already set for group "${job.groupEmail}" on folder "${job.folderName}". Skipping.`, 'INFO');
          return;
        }

        let action = existingPermission ? 'UPDATE' : 'ADD';
        let requestPath = '';
        let payload = null;
        if (action === 'UPDATE' && existingPermission && existingPermission.id) {
          requestPath = `/drive/v3/files/${job.folderId}/permissions/${existingPermission.id}?supportsAllDrives=true`;
          payload = JSON.stringify({ role: driveApiRole });
        } else {
          action = 'ADD';
          requestPath = `/drive/v3/files/${job.folderId}/permissions?supportsAllDrives=true&sendNotificationEmail=false`;
          payload = JSON.stringify({ type: 'group', role: driveApiRole, emailAddress: job.groupEmail });
        }

        let changeRequestRowIndex = null;
        const targetRowKey = buildFolderPermissionRowKey_(job.folderId, job.groupEmail, job.role);
        const snapshot = {
          changeType: 'FOLDER_PERMISSION',
          folderId: job.folderId,
          folderName: job.folderName,
          groupEmail: job.groupEmail,
          desiredRole: driveApiRole,
          currentRole: existingPermission ? existingPermission.role : null,
          action: action
        };
        const result = ensureChangeRequestForDelta_(MANAGED_FOLDERS_SHEET_NAME, targetRowKey, action, snapshot, 'SYSTEM', Object.assign({}, changeRequestContext || {}, {
          approvalsNeededOverride: 0,
          autoApprove: true
        }));
        if (result.rowIndex > 0) {
          changeRequestRowIndex = result.rowIndex;
        }
        if (result.status !== CHANGE_REQUEST_STATUS_APPROVED) {
          return;
        }

        requests.push({
            method: action === 'UPDATE' ? 'PATCH' : 'POST',
            path: requestPath,
            payload: payload,
            job: job,
            changeRequestRowIndex: changeRequestRowIndex
        });
    });

    if (requests.length === 0) return summary;

    log_(`Sending batch request with ${requests.length} permission operations...`);
    const batchResponse = _executeBatchRequest(requests, 'https://www.googleapis.com/batch/drive/v3');

    batchResponse.forEach((part, i) => {
        const job = requests[i].job;
        const rowIndex = requests[i].changeRequestRowIndex;
        if (part.success) {
            log_(`Successfully set role "${job.role}" for group "${job.groupEmail}" on folder "${job.folderName}"`, 'INFO');
            if (changeRequestContext && rowIndex) {
              markChangeRequestAppliedByRow_(changeRequestContext.changeSheet, rowIndex, changeRequestContext.columnMap);
            }
        } else {
            // Ignore "permission already exists" errors, treat as success
            if (part.body && part.body.includes('duplicate')) {
                 log_(`Permission for group "${job.groupEmail}" on folder "${job.folderName}" already exists. Skipping.`, 'INFO');
                 if (changeRequestContext && rowIndex) {
                   markChangeRequestAppliedByRow_(changeRequestContext.changeSheet, rowIndex, changeRequestContext.columnMap);
                 }
            } else {
                summary.failed++;
                job.error = true;
                log_(`Batch permission failure for group ${job.groupEmail} on folder ${job.folderName}. Status: ${part.status}. Details: ${part.body}`, 'ERROR');
            }
        }
    });
    return summary;
}

function buildFolderPermissionRowKey_(folderId, groupEmail, role) {
  return [folderId || '', (groupEmail || '').toLowerCase(), (role || '').toLowerCase()].join('|');
}

function getFolderGroupPermissionInfo_(folderId, groupEmail) {
  if (!folderId || !groupEmail || typeof Drive === 'undefined') {
    return null;
  }
  try {
    const permissions = Drive.Permissions.list(folderId, {
      fields: 'permissions(id,emailAddress,role,type)'
    }).permissions || [];
    const normalized = groupEmail.toLowerCase();
    const match = permissions.find(function(permission) {
      return permission.type === 'group' &&
        permission.emailAddress &&
        permission.emailAddress.toLowerCase() === normalized;
    });
    if (!match) {
      return null;
    }
    return { id: match.id, role: match.role };
  } catch (e) {
    log_(`Could not inspect permissions for folder ${folderId}: ${e.message}`, 'WARN');
    return null;
  }
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
    requiredSheetNames.add(SHEET_EDITORS_SHEET_NAME);
    requiredSheetNames.add(USER_GROUPS_SHEET_NAME);
    requiredSheetNames.add(CONFIG_SHEET_NAME);
    requiredSheetNames.add(LOG_SHEET_NAME);
    requiredSheetNames.add(TEST_LOG_SHEET_NAME);
    requiredSheetNames.add(FOLDER_AUDIT_LOG_SHEET_NAME);
    requiredSheetNames.add(SYNC_HISTORY_SHEET_NAME);
    requiredSheetNames.add(STATUS_SHEET_NAME);
    requiredSheetNames.add(CHANGE_REQUESTS_SHEET_NAME);
    requiredSheetNames.add('DeepFolderAuditLog');
    requiredSheetNames.add('Help');

    const managedSheet = spreadsheet.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
    if (managedSheet && managedSheet.getLastRow() > 1) {
      const headers = getHeaderMap_(managedSheet);
      const userSheetNameCol = resolveColumn_(headers, 'usersheetname', 5);
      const userSheetNames = managedSheet.getRange(2, userSheetNameCol, managedSheet.getLastRow() - 1, 1).getValues();
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
                if (row[0]) requiredSheetNames.add(getUserGroupSheetName_(row[0]));
            });
        }
    }

    const orphanSheetNames = allSheets
      .filter(function(sheet) {
        const name = sheet.getName();
        if (requiredSheetNames.has(name)) {
          return false;
        }
        if (isTestSheet_(name)) {
          return false;
        }
        if (isSystemSheet_(sheet)) {
          return false;
        }
        return true;
      })
      .map(function(sheet) { return sheet.getName(); });

    if (orphanSheetNames.includes('Sheet1')) {
      const sheet1 = spreadsheet.getSheetByName('Sheet1');
      if (sheet1) {
        log_('Default "Sheet1" found. Deleting it now.', 'INFO');
        spreadsheet.deleteSheet(sheet1);
        return orphanSheetNames.filter(name => name !== 'Sheet1');
      }
    }
    
    return orphanSheetNames;

  } catch (e) {
    log_('Error during orphan sheet check: ' + e.message, 'ERROR');
    return [];
  }
}

/**
 * Deletes orphan sheets that are not part of the configuration.
 * Shows a confirmation dialog before deleting.
 */
function deleteOrphanSheets() {
  try {
    const orphanSheets = checkForOrphanSheets_();

    if (!orphanSheets || orphanSheets.length === 0) {
      SpreadsheetApp.getUi().alert('No orphan sheets found', 'All sheets are properly configured.', SpreadsheetApp.getUi().ButtonSet.OK);
      log_('No orphan sheets to delete.', 'INFO');
      return;
    }

    const ui = SpreadsheetApp.getUi();
    const sheetList = orphanSheets.join('\n  - ');
    const response = ui.alert(
      'Delete Orphan Sheets?',
      `Found ${orphanSheets.length} orphan sheet(s) that are not in your configuration:\n  - ${sheetList}\n\n` +
      `Do you want to delete these sheets?\n\n` +
      `⚠️ Important: This only deletes the sheets. You may need to manually delete related Google Groups from the Google Workspace Admin console.`,
      ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) {
      log_('User cancelled orphan sheet deletion.', 'INFO');
      return;
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let deletedCount = 0;

    orphanSheets.forEach(sheetName => {
      try {
        const sheet = spreadsheet.getSheetByName(sheetName);
        if (sheet) {
          spreadsheet.deleteSheet(sheet);
          log_(`Deleted orphan sheet: "${sheetName}"`, 'INFO');
          deletedCount++;
        }
      } catch (e) {
        log_(`Failed to delete sheet "${sheetName}": ${e.message}`, 'ERROR');
      }
    });

    ui.alert(
      'Orphan Sheets Deleted',
      `Successfully deleted ${deletedCount} orphan sheet(s).\n\n` +
      `⚠️ Reminder: If these sheets had associated Google Groups, you may need to manually delete them from the Google Workspace Admin console (admin.google.com → Directory → Groups).`,
      ui.ButtonSet.OK
    );
    log_(`Deleted ${deletedCount} orphan sheet(s).`, 'INFO');

  } catch (e) {
    log_('Error during orphan sheet deletion: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Error', 'Failed to delete orphan sheets: ' + e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Main deletion coordinator - processes deletion requests for groups and folders.
 * Called during sync operations to handle resources marked for deletion.
 * @param {Object} options - Options object with silentMode flag
 * @return {Object} Summary of deletions: {userGroupsDeleted, foldersDeleted, errors, skipped}
 */
function processDeletionRequests_(options) {
  options = options || {};
  const silentMode = options.silentMode || false;

  // Check master switch
  const deletionEnabled = getConfigValue_('AllowGroupFolderDeletion', false);
  if (!deletionEnabled) {
    log_('Group/folder deletion disabled in Config. Delete checkboxes will be ignored.', 'INFO');
    updateDeleteStatusWarnings_();
    return { userGroupsDeleted: 0, foldersDeleted: 0, skipped: true, reason: 'disabled' };
  }

  // Initialize summary
  const summary = {
    userGroupsDeleted: 0,
    foldersDeleted: 0,
    errors: []
  };

  log_('Processing deletion requests...', 'INFO');

  // Delete UserGroups first (to avoid orphan references)
  processUserGroupDeletions_(summary);

  // Delete ManagedFolders second
  processManagedFolderDeletions_(summary);

  // Send notification if deletions occurred
  if (summary.userGroupsDeleted > 0 || summary.foldersDeleted > 0) {
    notifyDeletions_(summary);
  }

  log_(`Deletion complete: ${summary.userGroupsDeleted} group(s), ${summary.foldersDeleted} folder-binding(s) deleted.`, 'INFO');

  return summary;
}

/**
 * Processes deletion requests for UserGroups.
 * Deletes Google Groups, user sheets, and removes rows from UserGroups sheet.
 * @param {Object} summary - Summary object to track deletions and errors
 */
function processUserGroupDeletions_(summary) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(USER_GROUPS_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return;

  const headers = getHeaderMap_(sheet);
  const deleteCol = resolveColumn_(headers, 'delete', 6);
  const statusCol = resolveColumn_(headers, 'status', 5);
  
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, deleteCol).getValues();
  const rowsToDelete = [];

  for (let i = data.length - 1; i >= 0; i--) {
    const groupName = data[i][0];
    const groupEmail = data[i][1];
    const deleteFlag = data[i][deleteCol - 1];

    if (!deleteFlag) continue; // Skip unchecked

    const rowNum = i + 2;

    try {
      log_(`Deleting UserGroup: "${groupName}" (${groupEmail})`, 'INFO');
      sheet.getRange(rowNum, statusCol).setValue('🗑️ DELETING...');
      SpreadsheetApp.flush();

      // 1. Delete Google Group
      if (groupEmail && !shouldSkipGroupOps_()) {
        try {
          AdminDirectory.Groups.remove(groupEmail);
          log_(`✓ Deleted Google Group: ${groupEmail}`, 'INFO');
        } catch (e) {
          if (e.message.includes('Resource Not Found') || e.message.includes('notFound')) {
            log_(`Group ${groupEmail} already deleted or doesn't exist.`, 'WARN');
          } else {
            throw e;
          }
        }
      }

      // 2. Delete user sheet (GroupName_G)
      const userSheetName = getUserGroupSheetName_(groupName);
      const userSheet = ss.getSheetByName(userSheetName);
      if (userSheet) {
        ss.deleteSheet(userSheet);
        log_(`✓ Deleted sheet: ${userSheetName}`, 'INFO');
      }

      // 3. Check for nested group usage and log warning
      const nestedInGroups = findGroupsContainingMember_(groupEmail);
      if (nestedInGroups.length > 0) {
        log_(`⚠️ Warning: Group "${groupName}" was nested in other groups: ${nestedInGroups.join(', ')}. Members may have lost indirect access.`, 'WARN');
      }

      // 4. Mark row for deletion
      rowsToDelete.push(rowNum);
      summary.userGroupsDeleted++;

      logStructuralChangeRequest_(
        USER_GROUPS_SHEET_NAME,
        groupName || ('ROW|' + rowNum),
        'DELETE',
        {
          changeType: 'STRUCTURAL_USERGROUP_DELETE',
          groupName: groupName || '',
          groupEmail: groupEmail || '',
          userSheetName: userSheetName
        },
        'SYSTEM'
      );

      log_(`✓ Successfully deleted UserGroup: "${groupName}"`, 'INFO');

    } catch (e) {
      log_(`✗ Failed to delete UserGroup "${groupName}": ${e.message}`, 'ERROR');
      sheet.getRange(rowNum, statusCol).setValue(`❌ Deletion failed: ${e.message}`);
      summary.errors.push({ type: 'UserGroup', name: groupName, error: e.message });
    }
  }

  // Delete rows from bottom to top (preserve row numbers)
  rowsToDelete.forEach(function(rowNum) {
    sheet.deleteRow(rowNum);
  });
}

/**
 * Processes deletion requests for ManagedFolders (folder-role bindings).
 * Removes group from folder permissions, deletes Google Groups, user sheets, and rows.
 * Folders are never deleted (by design).
 * @param {Object} summary - Summary object to track deletions and errors
 */
function processManagedFolderDeletions_(summary) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return;

  const headers = getHeaderMap_(sheet);
  const folderIdCol = resolveColumn_(headers, 'folderid', 2);
  const deleteCol = resolveColumn_(headers, 'delete', 9);
  const folderNameCol = resolveColumn_(headers, 'foldername', 1);
  const roleCol = resolveColumn_(headers, 'role', 3);
  const groupEmailCol = resolveColumn_(headers, 'groupemail', 4);
  const userSheetNameCol = resolveColumn_(headers, 'usersheetname', 5);
  const statusCol = resolveColumn_(headers, 'status', 7);

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, deleteCol).getValues();
  const rowsToDelete = [];

  // Track folders to detect when last binding is deleted
  const folderBindingCounts = {};
  for (let i = 0; i < data.length; i++) {
    const folderId = data[i][folderIdCol - 1];
    const deleteFlag = data[i][deleteCol - 1];
    if (folderId) {
      if (!folderBindingCounts[folderId]) {
        folderBindingCounts[folderId] = { total: 0, toDelete: 0 };
      }
      folderBindingCounts[folderId].total++;
      if (deleteFlag) {
        folderBindingCounts[folderId].toDelete++;
      }
    }
  }

  for (let i = data.length - 1; i >= 0; i--) {
    const folderName = data[i][folderNameCol - 1];
    const folderId = data[i][folderIdCol - 1];
    const role = data[i][roleCol - 1];
    const groupEmail = data[i][groupEmailCol - 1];
    const userSheetName = data[i][userSheetNameCol - 1];
    const deleteFlag = data[i][deleteCol - 1];

    if (!deleteFlag) continue; // Skip unchecked

    const rowNum = i + 2;

    try {
      log_(`Deleting folder-role binding: "${folderName}" (${role})`, 'INFO');
      sheet.getRange(rowNum, statusCol).setValue('🗑️ DELETING...');
      SpreadsheetApp.flush();

      // 1. Remove group from folder permissions
      if (folderId && groupEmail) {
        try {
          const folder = DriveApp.getFolderById(folderId);
          folder.removeEditor(groupEmail);
          folder.removeViewer(groupEmail);
          // Note: removeCommenter not available in Apps Script, handled via removeEditor
          log_(`✓ Removed ${groupEmail} from folder permissions`, 'INFO');
        } catch (e) {
          if (e.message.includes('not found') || e.message.includes('cannot find')) {
            log_(`Folder ${folderId} not found (may be already deleted).`, 'WARN');
          } else {
            throw e;
          }
        }
      }

      // 2. Delete Google Group
      if (groupEmail && !shouldSkipGroupOps_()) {
        try {
          AdminDirectory.Groups.remove(groupEmail);
          log_(`✓ Deleted Google Group: ${groupEmail}`, 'INFO');
        } catch (e) {
          if (e.message.includes('Resource Not Found') || e.message.includes('notFound')) {
            log_(`Group ${groupEmail} already deleted or doesn't exist.`, 'WARN');
          } else {
            throw e;
          }
        }
      }

      // 3. Delete user sheet
      const userSheet = ss.getSheetByName(userSheetName);
      if (userSheet) {
        ss.deleteSheet(userSheet);
        log_(`✓ Deleted sheet: ${userSheetName}`, 'INFO');
      }

      // 4. Check if this is the last binding for this folder
      if (folderId && folderBindingCounts[folderId]) {
        const bindingInfo = folderBindingCounts[folderId];
        if (bindingInfo.toDelete === bindingInfo.total) {
          log_(`ℹ️ All managed access to folder "${folderName}" has been removed. Folder remains in Drive.`, 'INFO');
        }
      }

      // 5. Mark row for deletion
      rowsToDelete.push(rowNum);
      summary.foldersDeleted++;

      logStructuralChangeRequest_(
        MANAGED_FOLDERS_SHEET_NAME,
        folderId && groupEmail && role
          ? buildFolderPermissionRowKey_(folderId, groupEmail, role)
          : ('ROW|' + rowNum),
        'DELETE',
        {
          changeType: 'STRUCTURAL_MANAGED_FOLDER_DELETE',
          folderId: folderId || '',
          folderName: folderName || '',
          role: role || '',
          groupEmail: groupEmail || '',
          userSheetName: userSheetName || ''
        },
        'SYSTEM'
      );

      log_(`✓ Successfully deleted folder-role binding: "${folderName}" (${role})`, 'INFO');

    } catch (e) {
      log_(`✗ Failed to delete folder-role binding "${folderName}" (${role}): ${e.message}`, 'ERROR');
      sheet.getRange(rowNum, statusCol).setValue(`❌ Deletion failed: ${e.message}`);
      summary.errors.push({ type: 'FolderRole', name: `${folderName} (${role})`, error: e.message });
    }
  }

  // Delete rows from bottom to top (preserve row numbers)
  rowsToDelete.forEach(function(rowNum) {
    sheet.deleteRow(rowNum);
  });
}

/**
 * Updates Status column for Delete-marked items when deletion is disabled in config.
 * Shows warning message so users know why deletions aren't happening.
 */
function updateDeleteStatusWarnings_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Update ManagedFolders sheet
  const managedSheet = ss.getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
  if (managedSheet && managedSheet.getLastRow() >= 2) {
    const headers = getHeaderMap_(managedSheet);
    const deleteCol = resolveColumn_(headers, 'delete', 9);
    const statusCol = resolveColumn_(headers, 'status', 7);
    const data = managedSheet.getRange(2, 1, managedSheet.getLastRow() - 1, deleteCol).getValues();
    for (let i = 0; i < data.length; i++) {
      const deleteFlag = data[i][deleteCol - 1];
      if (deleteFlag) {
        managedSheet.getRange(i + 2, statusCol).setValue('⚠️ Deletion disabled in Config');
      }
    }
  }

  // Update UserGroups sheet
  const userGroupsSheet = ss.getSheetByName(USER_GROUPS_SHEET_NAME);
  if (userGroupsSheet && userGroupsSheet.getLastRow() >= 2) {
    const headers = getHeaderMap_(userGroupsSheet);
    const deleteCol = resolveColumn_(headers, 'delete', 6);
    const statusCol = resolveColumn_(headers, 'status', 5);
    const data = userGroupsSheet.getRange(2, 1, userGroupsSheet.getLastRow() - 1, deleteCol).getValues();
    for (let i = 0; i < data.length; i++) {
      const deleteFlag = data[i][deleteCol - 1];
      if (deleteFlag) {
        userGroupsSheet.getRange(i + 2, statusCol).setValue('⚠️ Deletion disabled in Config');
      }
    }
  }
}

function getOrCreateFolder_(folderName, folderId, options = {}) {
  const silentMode = options && options.silentMode !== undefined ? options.silentMode : false;
  let wasNewlyCreated = false;

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
      return { folder: folder, wasNewlyCreated: false };
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
    return { folder: foundFolder, wasNewlyCreated: false };
  } else {
    log_('No folder found with name "' + folderName + '". Creating it now...');
    const newFolder = DriveApp.createFolder(folderName);
    log_('Successfully created folder "' + folderName + '"');
    wasNewlyCreated = true;
    return { folder: newFolder, wasNewlyCreated: wasNewlyCreated };
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
      if (createError.message.includes('API has not been used')) {
        const projectId = getProjectIdFromError_(createError.message) || '[Project ID not found]';
        const enableUrl = `https://console.developers.google.com/apis/api/admin.googleapis.com/overview?project=${projectId}`;
        const friendlyError = `The Admin SDK API is not enabled for GCP project "${projectId}". Please enable it here: ${enableUrl} - then wait a few minutes and retry.`;
        log_(`Failed to create group ${groupEmail}. Error: ${friendlyError}`, 'ERROR');
        throw new Error(friendlyError);
      }
      log_('Failed to create group ' + groupEmail + '. Error: ' + createError.toString(), 'ERROR');
      throw new Error('Could not create group: ' + createError.message);
    }
  }

  return { group: group, wasNewlyCreated: wasNewlyCreated };
}

function getProjectIdFromError_(errorMessage) {
    const match = errorMessage.match(/project (\d+)/);
    return match ? match[1] : null;
}


function getOrCreateUserSheet_(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);
  let wasNewlyCreated = false;

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

    return { sheet: sheet, wasNewlyCreated: false };
  } else {
    log_('User sheet "' + sheetName + '" not found. Creating it...');
    sheet = spreadsheet.insertSheet(sheetName, spreadsheet.getSheets().length);
    wasNewlyCreated = true;

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
    return { sheet: sheet, wasNewlyCreated: wasNewlyCreated };
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

function _executeMembershipChunkWithRetries_(requests, groupEmail, config) {
  const summary = { added: 0, removed: 0, failed: 0, appliedEmails: [], failedEmails: [] };
  if (!requests || requests.length === 0) {
    return summary;
  }

  const MAX_RETRIES = config.RetryMaxRetries || 5;
  const INITIAL_DELAY_MS = config.RetryInitialDelayMs || 1000;
  let retries = 0;
  let requestsToProcess = requests;

  while (requestsToProcess.length > 0 && retries < MAX_RETRIES) {
    const batchResponses = _executeBatchRequest(requestsToProcess, 'https://www.googleapis.com/batch/admin/directory_v1');
    const failedRequests = [];

    batchResponses.forEach((part, i) => {
      const originalRequest = requestsToProcess[i];
      if (part.success) {
        if (originalRequest.operation === 'add') summary.added++;
        if (originalRequest.operation === 'remove') summary.removed++;
        summary.appliedEmails.push(originalRequest.email);
      } else {
        // Handle idempotent cases (desired state already achieved)
        if (originalRequest.operation === 'add' && part.status === 409 && part.body.includes('Member already exists')) {
          // For add: if member already exists, treat as success (desired state achieved)
          summary.added++;
          summary.appliedEmails.push(originalRequest.email);
          log_(`Member ${originalRequest.email} already exists in group ${groupEmail}. Treating as success.`, 'INFO');
        } else if (originalRequest.operation === 'remove' && (part.status === 404 || (part.status === 400 && part.body.includes('Resource Not Found')))) {
          // For remove: if member not found, treat as success (desired state achieved)
          summary.removed++;
          summary.appliedEmails.push(originalRequest.email);
          log_(`Member ${originalRequest.email} not found in group ${groupEmail}. Treating as success.`, 'INFO');
        } else if (part.status === 403 && part.body.includes('quotaExceeded')) {
          // Only retry on "quotaExceeded" errors
          failedRequests.push(originalRequest);
        } else {
          // All other errors are permanent failures
          summary.failed++;
          summary.failedEmails.push(originalRequest.email);
          log_(`A batch operation permanently failed for group ${groupEmail} on user ${originalRequest.email}. Status: ${part.status}. Details: ${part.body}`, 'ERROR');
        }
      }
    });

    if (failedRequests.length > 0) {
      requestsToProcess = failedRequests;
      retries++;
      if (retries < MAX_RETRIES) {
        const MAX_SLEEP_MS = 300000; // 5 minutes, the maximum allowed by Apps Script
        let delay = INITIAL_DELAY_MS * Math.pow(2, retries - 1) + Math.random() * 1000;
        delay = Math.min(delay, MAX_SLEEP_MS); // Cap the delay at the maximum allowed
        log_(`Rate limit hit for ${groupEmail}. Retrying ${failedRequests.length} failed operations in ${Math.round(delay / 1000)}s... (Attempt ${retries}/${MAX_RETRIES})`, 'WARN');
        Utilities.sleep(delay);
      } else {
        summary.failed += failedRequests.length;
        failedRequests.forEach(function(request) {
          summary.failedEmails.push(request.email);
        });
        log_(`Max retries reached for ${groupEmail}. ${failedRequests.length} operations could not be completed.`, 'ERROR');
      }
    } else {
      requestsToProcess = []; // Success, exit the loop
    }
  }
  return summary;
}


function syncGroupMembership_(groupEmail, userSheetName, options = {}) {
  const config = getConfiguration_();
  const addOnly = options && options.addOnly !== undefined ? options.addOnly : false;
  const removeOnly = options && options.removeOnly !== undefined ? options.removeOnly : false;
  const returnPlanOnly = options && options.returnPlanOnly !== undefined ? options.returnPlanOnly : false;
  const approvalsConfig = getApprovalsConfig_();
  const approvalsEnabled = approvalsConfig.enabled && !returnPlanOnly;
  const shouldLogPermissionChanges = !returnPlanOnly;
  const changeRequestContext = shouldLogPermissionChanges ? {} : null;
  
  const MEMBERSHIP_BATCH_SIZE = config.MembershipBatchSize || 15;
  const INTER_BATCH_DELAY_MS = 1000;

  log_('*** Starting membership sync for group "' + groupEmail + '" from sheet "' + userSheetName + '"');
  const totalSummary = { added: 0, removed: 0, failed: 0 };

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(userSheetName);
    if (!sheet) {
      throw new Error('User sheet "' + userSheetName + '" not found.');
    }

    const validation = validateUserSheetEmails_(userSheetName);
    if (!validation.valid) {
      throw new Error('VALIDATION ERROR in sheet "' + userSheetName + '": ' + validation.error);
    }

    const lastRow = sheet.getLastRow();
    const sheetEmails = [];
    if (lastRow >= 2) {
      const rawValues = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
      rawValues.forEach(function(row, index) {
        const rawValue = row[0];
        const disabledValue = row[1];
        if (!rawValue || !rawValue.toString().trim()) return;

        EMAIL_EXTRACTION_REGEX.lastIndex = 0;
        const matches = rawValue.toString().trim().match(EMAIL_EXTRACTION_REGEX) || [];
        
        if (matches.length === 1 && SINGLE_EMAIL_VALIDATION_REGEX.test(matches[0])) {
          if (!isUserRowDisabled_(disabledValue)) {
            sheetEmails.push(matches[0].toLowerCase());
          }
        }
      });
    }
    
    const sheetSet = new Set(sheetEmails);
    log_(`Found ${sheetSet.size} active emails in sheet "${userSheetName}".`);

    const groupMembers = fetchAllGroupMembers_(groupEmail);
    const groupEmails = groupMembers.map(m => m.email.toLowerCase());
    const groupSet = new Set(groupEmails);
    log_(`Found ${groupSet.size} members in group "${groupEmail}".`);

    const emailsToAdd = sheetEmails.filter(email => !groupSet.has(email));
    const membersToRemove = groupMembers.filter(m => !sheetSet.has(m.email.toLowerCase()) && m.role !== 'OWNER');
    const emailsToRemove = membersToRemove.map(m => m.email);

    if (returnPlanOnly) {
      return (removeOnly && emailsToRemove.length > 0) ? { groupEmail, groupName: userSheetName, usersToRemove: emailsToRemove } : null;
    }

    if (shouldLogPermissionChanges) {
      ensureChangeRequestsSheet_();
      const changeSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHANGE_REQUESTS_SHEET_NAME);
      if (changeSheet) {
        changeRequestContext.changeSheet = changeSheet;
        changeRequestContext.columnMap = getChangeRequestsColumnMap_(changeSheet);
        changeRequestContext.approvalsConfig = approvalsConfig;
      }
    }

    if (emailsToAdd.length === 0 && emailsToRemove.length === 0) {
      log_(`No membership changes required for group "${groupEmail}". Sync complete.`);
      return totalSummary;
    }

    const addRequestRowsByEmail = {};
    const removeRequestRowsByEmail = {};
    let approvedAdds = removeOnly ? [] : emailsToAdd;
    let approvedRemoves = addOnly ? [] : emailsToRemove;

    if (approvalsEnabled) {
      if (!removeOnly) {
        approvedAdds = [];
        emailsToAdd.forEach(function(email) {
          const snapshot = {
            changeType: 'GROUP_MEMBERSHIP',
            groupEmail: groupEmail,
            userSheetName: userSheetName,
            email: email,
            action: 'ADD'
          };
          const result = ensureChangeRequestForDelta_(userSheetName, email, 'ADD', snapshot, 'SYSTEM', changeRequestContext);
          if (result.rowIndex > 0) {
            addRequestRowsByEmail[email] = result.rowIndex;
          }
          if (result.status === CHANGE_REQUEST_STATUS_APPROVED) {
            approvedAdds.push(email);
          }
        });
      }

      if (!addOnly) {
        approvedRemoves = [];
        emailsToRemove.forEach(function(email) {
          const snapshot = {
            changeType: 'GROUP_MEMBERSHIP',
            groupEmail: groupEmail,
            userSheetName: userSheetName,
            email: email,
            action: 'REMOVE'
          };
          const result = ensureChangeRequestForDelta_(userSheetName, email, 'REMOVE', snapshot, 'SYSTEM', changeRequestContext);
          if (result.rowIndex > 0) {
            removeRequestRowsByEmail[email] = result.rowIndex;
          }
          if (result.status === CHANGE_REQUEST_STATUS_APPROVED) {
            approvedRemoves.push(email);
          }
        });
      }
    } else if (shouldLogPermissionChanges) {
      if (!removeOnly) {
        emailsToAdd.forEach(function(email) {
          const snapshot = {
            changeType: 'GROUP_MEMBERSHIP',
            groupEmail: groupEmail,
            userSheetName: userSheetName,
            email: email,
            action: 'ADD'
          };
          const result = ensureChangeRequestForDelta_(userSheetName, email, 'ADD', snapshot, 'SYSTEM', Object.assign({}, changeRequestContext, {
            approvalsNeededOverride: 0,
            autoApprove: true
          }));
          if (result.rowIndex > 0) {
            addRequestRowsByEmail[email] = result.rowIndex;
          }
        });
      }

      if (!addOnly) {
        emailsToRemove.forEach(function(email) {
          const snapshot = {
            changeType: 'GROUP_MEMBERSHIP',
            groupEmail: groupEmail,
            userSheetName: userSheetName,
            email: email,
            action: 'REMOVE'
          };
          const result = ensureChangeRequestForDelta_(userSheetName, email, 'REMOVE', snapshot, 'SYSTEM', Object.assign({}, changeRequestContext, {
            approvalsNeededOverride: 0,
            autoApprove: true
          }));
          if (result.rowIndex > 0) {
            removeRequestRowsByEmail[email] = result.rowIndex;
          }
        });
      }
    }

    // Process additions in chunks
    if (!removeOnly && approvedAdds.length > 0) {
      log_(`Processing ${approvedAdds.length} additions in chunks of ${MEMBERSHIP_BATCH_SIZE}...`);
      for (let i = 0; i < approvedAdds.length; i += MEMBERSHIP_BATCH_SIZE) {
        const chunk = approvedAdds.slice(i, i + MEMBERSHIP_BATCH_SIZE);
        const requests = chunk.map(email => ({
          method: 'POST',
          path: `/admin/directory/v1/groups/${groupEmail}/members`,
          payload: JSON.stringify({ email: email, role: 'MEMBER' }),
          operation: 'add',
          email: email
        }));
        
        log_(`  - Adding chunk ${i / MEMBERSHIP_BATCH_SIZE + 1}: ${chunk.length} users...`);
        const chunkSummary = _executeMembershipChunkWithRetries_(requests, groupEmail, config);
        totalSummary.added += chunkSummary.added;
        totalSummary.failed += chunkSummary.failed;
        if (changeRequestContext && changeRequestContext.changeSheet) {
          chunkSummary.appliedEmails.forEach(function(email) {
            const rowIndex = addRequestRowsByEmail[email];
            if (rowIndex) {
              markChangeRequestAppliedByRow_(changeRequestContext.changeSheet, rowIndex, changeRequestContext.columnMap);
            }
          });
        }
        
        if (i + MEMBERSHIP_BATCH_SIZE < approvedAdds.length) {
          Utilities.sleep(INTER_BATCH_DELAY_MS);
        }
      }
    }

    // Process removals in chunks
    if (!addOnly && approvedRemoves.length > 0) {
      log_(`Processing ${approvedRemoves.length} removals in chunks of ${MEMBERSHIP_BATCH_SIZE}...`);
      for (let i = 0; i < approvedRemoves.length; i += MEMBERSHIP_BATCH_SIZE) {
        const chunk = approvedRemoves.slice(i, i + MEMBERSHIP_BATCH_SIZE);
        const requests = chunk.map(email => ({
          method: 'DELETE',
          path: `/admin/directory/v1/groups/${groupEmail}/members/${email}`,
          operation: 'remove',
          email: email
        }));

        log_(`  - Removing chunk ${i / MEMBERSHIP_BATCH_SIZE + 1}: ${chunk.length} users...`);
        const chunkSummary = _executeMembershipChunkWithRetries_(requests, groupEmail, config);
        totalSummary.removed += chunkSummary.removed;
        totalSummary.failed += chunkSummary.failed;
        if (changeRequestContext && changeRequestContext.changeSheet) {
          chunkSummary.appliedEmails.forEach(function(email) {
            const rowIndex = removeRequestRowsByEmail[email];
            if (rowIndex) {
              markChangeRequestAppliedByRow_(changeRequestContext.changeSheet, rowIndex, changeRequestContext.columnMap);
            }
          });
        }

        if (i + MEMBERSHIP_BATCH_SIZE < approvedRemoves.length) {
          Utilities.sleep(INTER_BATCH_DELAY_MS);
        }
      }
    }

    log_(`Batch processing summary for ${groupEmail}: ${totalSummary.added} added, ${totalSummary.removed} removed, ${totalSummary.failed} failed.`, 'INFO');
    if (totalSummary.failed > 0) {
      log_(`WARNING: ${totalSummary.failed} membership operations failed to sync for group ${groupEmail}. See logs for details.`, 'WARN');
    }

    log_(`Membership sync complete for group "${groupEmail}".`);
    return totalSummary;

  } catch (e) {
    log_(`FATAL ERROR in syncGroupMembership for group ${groupEmail}. Error: ${e.toString()} Stack: ${e.stack}`, 'ERROR');
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
  const config = getConfiguration_();
  const MAX_RETRIES = config.RetryMaxRetries || 5;
  const INITIAL_DELAY_MS = config.RetryInitialDelayMs || 1000;

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
        const MAX_SLEEP_MS = 300000; // 5 minutes, the maximum allowed by Apps Script
        let delay = INITIAL_DELAY_MS * Math.pow(2, i);
        delay = Math.min(delay, MAX_SLEEP_MS); // Cap the delay at the maximum allowed
        log_(`Failed to set permission for group ${groupEmail} on folder ${folderId}. Retrying in ${delay / 1000} seconds... (Attempt ${i + 1}/${MAX_RETRIES})`, 'WARN');
        Utilities.sleep(delay);
      } else {
        log_(`Failed to set permission for group ${groupEmail} on folder ${folderId} after ${MAX_RETRIES} attempts. Error: ${e.toString()}`, 'ERROR');
        throw new Error(`Could not set folder permission: ${e.message}`);
      }
    }
  }
}

function setSheetUiStyles_(headers) {
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
        const urlCol = resolveColumn_(headers, 'url', 8);
        const clearBgRange = managedSheet.getRange(2, 1, managedSheet.getLastRow() - 1, urlCol);
        clearBgRange.setBackground(null);

        // Now apply new protection and styling to columns 5-8 only
        const userSheetNameCol = resolveColumn_(headers, 'usersheetname', 5);
        const range = managedSheet.getRange(2, userSheetNameCol, managedSheet.getLastRow() - 1, 4);
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
      const clearBgRange = userGroupsSheet.getRange(2, 1, userGroupsSheet.getLastRow() - 1, 5);
      clearBgRange.setBackground(null);

      // Apply new protection and styling
      const range = userGroupsSheet.getRange(2, 3, userGroupsSheet.getLastRow() - 1, 3);
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
    const headers = getHeaderMap_(managedFoldersSheet);
    const userSheetNameCol = resolveColumn_(headers, 'usersheetname', 5);
    const userSheetNames = managedFoldersSheet.getRange(2, userSheetNameCol, managedFoldersSheet.getLastRow() - 1, 1).getValues();
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
        managedSheetNames.add(getUserGroupSheetName_(row[0]));
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
          sheetName !== SHEET_EDITORS_SHEET_NAME &&
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
  
  const headers = getHeaderMap_(sheet);
  const folderNameCol = resolveColumn_(headers, 'foldername', 1);
  const folderIdCol = resolveColumn_(headers, 'folderid', 2);
  const roleCol = resolveColumn_(headers, 'role', 3);

  const data = sheet.getRange(2, 1, lastRow - 1, Math.max(folderNameCol, folderIdCol, roleCol)).getValues();
  const errors = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const folderName = row[folderNameCol - 1];
    const folderId = row[folderIdCol - 1];
    const role = row[roleCol - 1];

    if ((folderName || folderId) && !role) {
      errors.push(`Row ${i + 2}: Role is not specified.`);
    }
  }

  if (errors.length > 0) {
    throw new Error('Validation failed for ManagedFolders sheet:\n' + errors.join('\n'));
  }
}
