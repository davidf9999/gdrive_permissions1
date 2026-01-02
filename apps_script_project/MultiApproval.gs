/**
 * MultiApproval.gs - Sheet-only change request gating
 */

/**
 * Handles edits within the ChangeRequests sheet (simple trigger friendly).
 * Normalizes requester metadata and updates approval counts in-place.
 * @param {Event} e The onEdit event object
 */
function handleChangeRequestEdit_(e) {
  if (!e || !e.range || !e.source) return;

  const sheet = e.source.getActiveSheet();
  if (!sheet || sheet.getName() !== CHANGE_REQUESTS_SHEET_NAME) {
    return;
  }

  const approvalsConfig = getApprovalsConfig_();
  normalizeChangeRequestRow_(sheet, e.range.getRow(), approvalsConfig, e.user);
  tallyChangeRequestApprovals_(sheet, approvalsConfig);
}

/**
 * Computes approval needs, applies expirations, and applies approved changes.
 * Intended to be called from scheduled flows (autoSync/fullSync).
 * @param {Object} options Optional flags (silentMode)
 */
function processChangeRequests_(options = {}) {
  const approvalsConfig = getApprovalsConfig_();
  if (!approvalsConfig.enabled && approvalsConfig.requiredApprovals <= 1) {
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CHANGE_REQUESTS_SHEET_NAME);
  if (!sheet) {
    return;
  }

  sheet.getRange(1, 1).clearNote();
  if (approvalsConfig.enabled && approvalsConfig.availableEditors > 0 && approvalsConfig.requiredApprovals > approvalsConfig.availableEditors) {
    const warning = 'Required approvals (' + approvalsConfig.requiredApprovals + ') exceeds active sheet editors (' + approvalsConfig.availableEditors + ').';
    sheet.getRange(1, 1).setNote(warning);
    log_(warning, 'WARN');
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return;
  }

  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const now = new Date();
  let appliedCount = 0;

  data.forEach(function(row, idx) {
    const rowIndex = idx + 2;
    const status = (row[CHANGE_REQUEST_STATUS_COL - 1] || '').toString().toUpperCase();
    const requestedAtValue = row[CHANGE_REQUEST_REQUESTED_AT_COL - 1];

    // Normalize metadata and approvals on each pass
    normalizeChangeRequestRow_(sheet, rowIndex, approvalsConfig);

    if (isTerminalChangeRequestStatus_(status)) {
      return;
    }

    const requestedAt = requestedAtValue ? new Date(requestedAtValue) : null;
    if (approvalsConfig.expiryHours > 0 && requestedAt && status === CHANGE_REQUEST_STATUS_PENDING) {
      const expiry = new Date(requestedAt.getTime() + approvalsConfig.expiryHours * 60 * 60 * 1000);
      if (now > expiry) {
        sheet.getRange(rowIndex, CHANGE_REQUEST_STATUS_COL).setValue(CHANGE_REQUEST_STATUS_EXPIRED);
        sheet.getRange(rowIndex, CHANGE_REQUEST_DENY_REASON_COL).setValue('Expired after ' + approvalsConfig.expiryHours + ' hours');
        return;
      }
    }

    const approvals = collectApprovalsFromRow_(row, approvalsConfig.requiredApprovals, row[CHANGE_REQUEST_REQUESTED_BY_COL - 1]);
    if (approvals.length >= approvalsConfig.requiredApprovals || approvalsConfig.requiredApprovals <= 1 || !approvalsConfig.enabled) {
      sheet.getRange(rowIndex, CHANGE_REQUEST_STATUS_COL).setValue(CHANGE_REQUEST_STATUS_APPROVED);
    }

    const updatedStatus = sheet.getRange(rowIndex, CHANGE_REQUEST_STATUS_COL).getValue();
    if (updatedStatus === CHANGE_REQUEST_STATUS_APPROVED) {
      const applied = applyApprovedChangeRequest_(sheet, rowIndex, approvalsConfig, options);
      if (applied) {
        appliedCount++;
      }
    }
  });

  if (!options.silentMode && appliedCount > 0) {
    log_('Applied ' + appliedCount + ' approved change request(s).', 'INFO');
  }
}

/**
 * Applies an approved change request row to its target sheet.
 * @param {Sheet} changeSheet The ChangeRequests sheet
 * @param {number} rowIndex 1-based row index in ChangeRequests
 * @param {Object} approvalsConfig Cached approvals config
 * @param {Object} options Optional flags
 * @return {boolean} true if applied
 */
function applyApprovedChangeRequest_(changeSheet, rowIndex, approvalsConfig, options = {}) {
  const rowValues = changeSheet.getRange(rowIndex, 1, 1, changeSheet.getLastColumn()).getValues()[0];
  const status = (rowValues[CHANGE_REQUEST_STATUS_COL - 1] || '').toString().toUpperCase();
  if (status !== CHANGE_REQUEST_STATUS_APPROVED) {
    return false;
  }

  const targetSheetName = (rowValues[CHANGE_REQUEST_TARGET_SHEET_COL - 1] || '').toString().trim();
  const action = (rowValues[CHANGE_REQUEST_ACTION_COL - 1] || '').toString().toUpperCase();
  const targetRowKey = rowValues[CHANGE_REQUEST_TARGET_ROW_KEY_COL - 1];
  const snapshotRaw = rowValues[CHANGE_REQUEST_PROPOSED_SNAPSHOT_COL - 1];

  if (!targetSheetName || !action) {
    setChangeRequestFailure_(changeSheet, rowIndex, 'Missing target sheet or action');
    return false;
  }

  const ss = changeSheet.getParent();
  const targetSheet = ss.getSheetByName(targetSheetName);
  if (!targetSheet) {
    setChangeRequestFailure_(changeSheet, rowIndex, 'Target sheet not found: ' + targetSheetName);
    return false;
  }

  const headers = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0];
  const snapshot = parseChangeRequestSnapshot_(snapshotRaw, headers.length, headers);
  if (!snapshot) {
    setChangeRequestFailure_(changeSheet, rowIndex, 'Invalid ProposedRowSnapshot');
    return false;
  }

  try {
    if (action === 'ADD') {
      applyAddChangeRequest_(targetSheet, snapshot);
    } else if (action === 'UPDATE') {
      applyUpdateChangeRequest_(targetSheet, targetRowKey, snapshot);
    } else if (action === 'DELETE') {
      applyDeleteChangeRequest_(targetSheet, targetRowKey, headers);
    } else {
      setChangeRequestFailure_(changeSheet, rowIndex, 'Unsupported action: ' + action);
      return false;
    }
  } catch (err) {
    setChangeRequestFailure_(changeSheet, rowIndex, err.message);
    return false;
  }

  changeSheet.getRange(rowIndex, CHANGE_REQUEST_STATUS_COL).setValue(CHANGE_REQUEST_STATUS_APPLIED);
  changeSheet.getRange(rowIndex, CHANGE_REQUEST_APPLIED_AT_COL).setValue(new Date());
  changeSheet.getRange(rowIndex, CHANGE_REQUEST_DENY_REASON_COL).clearContent();
  log_('Applied change request for ' + targetSheetName + ' [' + action + '] key=' + targetRowKey, 'INFO');
  return true;
}

/**
 * Parses ProposedRowSnapshot input.
 * Supports JSON array, JSON object keyed by headers, or pipe-delimited strings.
 */
function parseChangeRequestSnapshot_(rawSnapshot, headerLength, headers) {
  if (rawSnapshot === null || rawSnapshot === undefined || rawSnapshot === '') {
    return null;
  }

  if (Array.isArray(rawSnapshot)) {
    return normalizeSnapshotArray_(rawSnapshot, headerLength);
  }

  if (typeof rawSnapshot === 'string') {
    const trimmed = rawSnapshot.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return normalizeSnapshotArray_(parsed, headerLength);
      }
      if (parsed && typeof parsed === 'object') {
        return headers.map(function(header) { return parsed[header] !== undefined ? parsed[header] : ''; });
      }
    } catch (e) {
      // Fall back to pipe-delimited values
      if (trimmed.indexOf('|') !== -1) {
        return normalizeSnapshotArray_(trimmed.split('|'), headerLength);
      }
      return null;
    }
  }

  if (typeof rawSnapshot === 'object') {
    return headers.map(function(header) { return rawSnapshot[header] !== undefined ? rawSnapshot[header] : ''; });
  }

  return null;
}

function normalizeSnapshotArray_(arr, headerLength) {
  const snapshot = new Array(headerLength).fill('');
  for (var i = 0; i < snapshot.length && i < arr.length; i++) {
    snapshot[i] = arr[i];
  }
  return snapshot;
}

function applyAddChangeRequest_(targetSheet, snapshot) {
  targetSheet.appendRow(snapshot);
}

function applyUpdateChangeRequest_(targetSheet, targetRowKey, snapshot) {
  if (targetRowKey === undefined || targetRowKey === null || targetRowKey === '') {
    throw new Error('Missing TargetRowKey for UPDATE');
  }
  const dataRange = targetSheet.getDataRange();
  const values = dataRange.getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] == targetRowKey) {
      targetSheet.getRange(i + 1, 1, 1, snapshot.length).setValues([snapshot]);
      return;
    }
  }
  throw new Error('TargetRowKey not found for UPDATE: ' + targetRowKey);
}

function applyDeleteChangeRequest_(targetSheet, targetRowKey, headers) {
  if (targetRowKey === undefined || targetRowKey === null || targetRowKey === '') {
    throw new Error('Missing TargetRowKey for DELETE');
  }

  var deleteColumnIndex = headers.indexOf('Delete');
  if (deleteColumnIndex === -1) {
    deleteColumnIndex = headers.indexOf('Deleted');
  }

  const dataRange = targetSheet.getDataRange();
  const values = dataRange.getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] == targetRowKey) {
      if (deleteColumnIndex !== -1) {
        targetSheet.getRange(i + 1, deleteColumnIndex + 1).setValue(true);
      } else {
        targetSheet.deleteRow(i + 1);
      }
      return;
    }
  }
  throw new Error('TargetRowKey not found for DELETE: ' + targetRowKey);
}

function setChangeRequestFailure_(sheet, rowIndex, reason) {
  sheet.getRange(rowIndex, CHANGE_REQUEST_STATUS_COL).setValue(CHANGE_REQUEST_STATUS_DENIED);
  sheet.getRange(rowIndex, CHANGE_REQUEST_DENY_REASON_COL).setValue(reason);
  log_('Denied change request row ' + rowIndex + ': ' + reason, 'WARN');
}

function isTerminalChangeRequestStatus_(status) {
  return status === CHANGE_REQUEST_STATUS_APPLIED || status === CHANGE_REQUEST_STATUS_DENIED ||
    status === CHANGE_REQUEST_STATUS_CANCELLED || status === CHANGE_REQUEST_STATUS_EXPIRED;
}

function normalizeChangeRequestRow_(sheet, rowIndex, approvalsConfig, eventUser) {
  const lastColumn = sheet.getLastColumn();
  const rowRange = sheet.getRange(rowIndex, 1, 1, lastColumn);
  const rowValues = rowRange.getValues()[0];
  const updates = [];
  const requestedBy = rowValues[CHANGE_REQUEST_REQUESTED_BY_COL - 1] || (eventUser && eventUser.getEmail && eventUser.getEmail());
  const status = (rowValues[CHANGE_REQUEST_STATUS_COL - 1] || '').toString().toUpperCase() || CHANGE_REQUEST_STATUS_PENDING;

  if (!rowValues[CHANGE_REQUEST_ID_COL - 1]) {
    updates.push({ col: CHANGE_REQUEST_ID_COL, value: 'CR-' + new Date().getTime() + '-' + Math.floor(Math.random() * 1000) });
  }
  if (requestedBy) {
    updates.push({ col: CHANGE_REQUEST_REQUESTED_BY_COL, value: requestedBy });
  }
  if (!rowValues[CHANGE_REQUEST_REQUESTED_AT_COL - 1]) {
    updates.push({ col: CHANGE_REQUEST_REQUESTED_AT_COL, value: new Date() });
  }
  if (!rowValues[CHANGE_REQUEST_STATUS_COL - 1]) {
    updates.push({ col: CHANGE_REQUEST_STATUS_COL, value: status });
  }

  const approvalsNeeded = approvalsConfig && approvalsConfig.requiredApprovals ? approvalsConfig.requiredApprovals : 1;
  updates.push({ col: CHANGE_REQUEST_APPROVALS_NEEDED_COL, value: approvalsNeeded });

  if (updates.length > 0) {
    updates.forEach(function(update) {
      sheet.getRange(rowIndex, update.col).setValue(update.value);
    });
  }
}

function tallyChangeRequestApprovals_(sheet, approvalsConfig) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  data.forEach(function(row, idx) {
    const rowIndex = idx + 2;
    const status = (row[CHANGE_REQUEST_STATUS_COL - 1] || '').toString().toUpperCase();
    if (isTerminalChangeRequestStatus_(status)) return;

    const approvals = collectApprovalsFromRow_(row, approvalsConfig.requiredApprovals, row[CHANGE_REQUEST_REQUESTED_BY_COL - 1]);
    if (approvals.length >= approvalsConfig.requiredApprovals || approvalsConfig.requiredApprovals <= 1 || !approvalsConfig.enabled) {
      sheet.getRange(rowIndex, CHANGE_REQUEST_STATUS_COL).setValue(CHANGE_REQUEST_STATUS_APPROVED);
    } else {
      sheet.getRange(rowIndex, CHANGE_REQUEST_STATUS_COL).setValue(CHANGE_REQUEST_STATUS_PENDING);
    }
  });
}

function collectApprovalsFromRow_(rowValues, approvalsRequired, requestedBy) {
  const approvals = [];
  const lowerRequestedBy = requestedBy ? requestedBy.toString().toLowerCase() : '';
  for (var i = CHANGE_REQUEST_FIRST_APPROVER_COL - 1; i < rowValues.length; i++) {
    if (i === CHANGE_REQUEST_DENY_REASON_COL - 1 || i === CHANGE_REQUEST_APPLIED_AT_COL - 1) continue;
    const email = rowValues[i];
    if (!email) continue;
    const normalized = email.toString().trim().toLowerCase();
    if (!normalized) continue;
    if (approvalsRequired > 1 && normalized === lowerRequestedBy) {
      continue; // no self-approval when multiple approvals required
    }
    if (approvals.indexOf(normalized) === -1) {
      approvals.push(normalized);
    }
  }
  return approvals;
}

function getApprovalsConfig_() {
  const enabled = getConfigValue_('ApprovalsEnabled', false) === true;
  const requiredApprovalsRaw = getConfigValue_('RequiredApprovals', 1);
  const requiredApprovals = Math.max(1, parseInt(requiredApprovalsRaw, 10) || 1);
  const expiryHoursRaw = getConfigValue_('ApprovalExpiryHours', 0);
  const expiryHours = Math.max(0, parseInt(expiryHoursRaw, 10) || 0);
  const activeEditors = getActiveSheetEditorEmails_();
  return {
    enabled: enabled,
    requiredApprovals: requiredApprovals,
    expiryHours: expiryHours,
    availableEditors: activeEditors.length
  };
}

function getActiveSheetEditorEmails_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetEditorsSheet = ss.getSheetByName(SHEET_EDITORS_SHEET_NAME);
  if (!sheetEditorsSheet) return [];
  const data = sheetEditorsSheet.getRange(2, 1, Math.max(0, sheetEditorsSheet.getLastRow() - 1), 5).getValues();
  return data.filter(function(row) {
    const email = row[0];
    const disabled = row[4];
    return email && !isUserRowDisabled_(disabled);
  }).map(function(row) {
    return row[0].toString().trim().toLowerCase();
  });
}
