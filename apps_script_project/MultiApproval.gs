/**
 * MultiApproval.gs - Sheet-only change request gating
 */

const CHANGE_REQUESTS_SHEET_NAME = 'ChangeRequests';

// Change request statuses
const CHANGE_REQUEST_STATUS_PENDING = 'PENDING';
const CHANGE_REQUEST_STATUS_APPROVED = 'APPROVED';
const CHANGE_REQUEST_STATUS_DENIED = 'DENIED';
const CHANGE_REQUEST_STATUS_CANCELLED = 'CANCELLED';
const CHANGE_REQUEST_STATUS_APPLIED = 'APPLIED';
const CHANGE_REQUEST_STATUS_EXPIRED = 'EXPIRED';

function getChangeRequestsColumnMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headerMap = getHeaderMap_(sheet);
  const sheetName = sheet.getName();
  const approverCols = findChangeRequestApproverColumns_(headers);
  return {
    headers: headers,
    id: requireColumn_(headerMap, 'requestid', sheetName),
    requestedBy: requireColumn_(headerMap, 'requestedby', sheetName),
    requestedAt: requireColumn_(headerMap, 'requestedat', sheetName),
    targetSheet: requireColumn_(headerMap, 'targetsheet', sheetName),
    targetRowKey: requireColumn_(headerMap, 'targetrowkey', sheetName),
    action: requireColumn_(headerMap, 'action', sheetName),
    proposedSnapshot: requireColumn_(headerMap, 'proposedrowsnapshot', sheetName),
    status: requireColumn_(headerMap, 'status', sheetName),
    approvalsNeeded: requireColumn_(headerMap, 'approvalsneeded', sheetName),
    approverStart: findChangeRequestApproverStartCol_(headers),
    approverCols: approverCols,
    denyReason: resolveColumn_(headerMap, 'denyreason', null),
    appliedAt: resolveColumn_(headerMap, 'appliedat', null)
  };
}

function findChangeRequestApproverStartCol_(headers) {
  for (var i = 0; i < headers.length; i++) {
    var header = headers[i];
    if (!header) continue;
    var headerText = header.toString().trim();
    if (headerText.indexOf('Approver_') === 0) {
      return i + 1;
    }
  }
  return null;
}

function findChangeRequestApproverColumns_(headers) {
  var columns = [];
  for (var i = 0; i < headers.length; i++) {
    var header = headers[i];
    if (!header) continue;
    var headerText = header.toString().trim();
    if (headerText.indexOf('Approver_') === 0) {
      columns.push(i + 1);
    }
  }
  return columns;
}

function ensureChangeRequestApproverColumns_(sheet, requiredApprovals) {
  if (!sheet) return;
  var requiredCount = Math.max(1, parseInt(requiredApprovals, 10) || 1);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var approverCols = findChangeRequestApproverColumns_(headers);
  if (approverCols.length >= requiredCount) {
    return;
  }

  var toAdd = requiredCount - approverCols.length;
  var headerMap = getHeaderMap_(sheet);
  var denyReasonCol = resolveColumn_(headerMap, 'denyreason', null);
  var insertStartCol;
  if (denyReasonCol) {
    sheet.insertColumnsBefore(denyReasonCol, toAdd);
    insertStartCol = denyReasonCol;
  } else {
    var lastCol = sheet.getLastColumn();
    sheet.insertColumnsAfter(lastCol, toAdd);
    insertStartCol = lastCol + 1;
  }

  var newHeaders = [];
  for (var i = 0; i < toAdd; i++) {
    newHeaders.push(['Approver_' + (approverCols.length + i + 1)]);
  }
  sheet.getRange(1, insertStartCol, 1, toAdd).setValues([newHeaders.map(function(row) { return row[0]; })]);
}

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
  const columnMap = getChangeRequestsColumnMap_(sheet);
  if (isChangeRequestApproverEdit_(e, columnMap)) {
    const value = e.range.getValue();
    if (value && !isValidApproverEmail_(value, approvalsConfig)) {
      if (e.oldValue !== undefined) {
        e.range.setValue(e.oldValue);
      } else {
        e.range.clearContent();
      }
      SpreadsheetApp.getActiveSpreadsheet().toast('Approver must be an active Sheet Editor email.', 'Invalid Approver', 8);
      return;
    }
  }
  normalizeChangeRequestRow_(sheet, e.range.getRow(), approvalsConfig, e.user, columnMap);
  tallyChangeRequestApprovals_(sheet, approvalsConfig, columnMap);
}

/**
 * Computes approval needs, applies expirations, and applies approved changes.
 * Intended to be called from scheduled flows (autoSync/fullSync).
 * @param {Object} options Optional flags (silentMode)
 */
function processChangeRequests_(options = {}) {
  const approvalsConfig = getApprovalsConfig_();
  if (!approvalsConfig.enabled) {
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

  const columnMap = getChangeRequestsColumnMap_(sheet);
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const now = new Date();
  let appliedCount = 0;

  data.forEach(function(row, idx) {
    const rowIndex = idx + 2;
    const status = (row[columnMap.status - 1] || '').toString().toUpperCase();
    const requestedAtValue = row[columnMap.requestedAt - 1];

    // Normalize metadata and approvals on each pass
    normalizeChangeRequestRow_(sheet, rowIndex, approvalsConfig, null, columnMap);

    if (isTerminalChangeRequestStatus_(status)) {
      return;
    }

    const requestedAt = requestedAtValue ? new Date(requestedAtValue) : null;
    if (approvalsConfig.expiryHours > 0 && requestedAt && status === CHANGE_REQUEST_STATUS_PENDING) {
      const expiry = new Date(requestedAt.getTime() + approvalsConfig.expiryHours * 60 * 60 * 1000);
      if (now > expiry) {
        sheet.getRange(rowIndex, columnMap.status).setValue(CHANGE_REQUEST_STATUS_EXPIRED);
        if (columnMap.denyReason) {
          sheet.getRange(rowIndex, columnMap.denyReason).setValue('Expired after ' + approvalsConfig.expiryHours + ' hours');
        }
        return;
      }
    }

    const approvals = collectApprovalsFromRow_(row, approvalsConfig.requiredApprovals, row[columnMap.requestedBy - 1], columnMap, approvalsConfig.activeEditorsSet);
    if (approvals.length >= approvalsConfig.requiredApprovals) {
      sheet.getRange(rowIndex, columnMap.status).setValue(CHANGE_REQUEST_STATUS_APPROVED);
    }

    const updatedStatus = sheet.getRange(rowIndex, columnMap.status).getValue();
    if (updatedStatus === CHANGE_REQUEST_STATUS_APPROVED) {
      const snapshotRaw = row[columnMap.proposedSnapshot - 1];
      if (isPermissionDeltaSnapshot_(snapshotRaw)) {
        return;
      }
      const applied = applyApprovedChangeRequest_(sheet, rowIndex, approvalsConfig, options, columnMap);
      if (applied) {
        appliedCount++;
      }
    }
  });

  if (!options.silentMode && appliedCount > 0) {
    log_('Applied ' + appliedCount + ' approved change request(s).', 'INFO');
  }
}

function buildPermissionDeltaSnapshot_(payload) {
  const snapshot = payload && typeof payload === 'object' ? Object.assign({}, payload) : {};
  snapshot.__permissionDelta = true;
  return JSON.stringify(snapshot);
}

function isPermissionDeltaSnapshot_(snapshotRaw) {
  if (!snapshotRaw || typeof snapshotRaw !== 'string') {
    return false;
  }
  try {
    const parsed = JSON.parse(snapshotRaw);
    return parsed && parsed.__permissionDelta === true;
  } catch (e) {
    return false;
  }
}

function ensureChangeRequestForDelta_(targetSheetName, targetRowKey, action, deltaSnapshot, requestedBy, options) {
  const approvalsConfig = options && options.approvalsConfig ? options.approvalsConfig : getApprovalsConfig_();
  if (!approvalsConfig.enabled) {
    return { status: CHANGE_REQUEST_STATUS_APPROVED, rowIndex: -1, created: false };
  }
  if (!targetSheetName || !targetRowKey || !action) {
    log_('Skipped ChangeRequest creation: missing targetSheetName/targetRowKey/action.', 'WARN');
    return { status: CHANGE_REQUEST_STATUS_DENIED, rowIndex: -1, created: false };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let changeSheet = options && options.changeSheet ? options.changeSheet : ss.getSheetByName(CHANGE_REQUESTS_SHEET_NAME);
  if (!changeSheet) {
    ensureChangeRequestsSheet_();
    changeSheet = ss.getSheetByName(CHANGE_REQUESTS_SHEET_NAME);
  }
  if (!changeSheet) {
    return { status: CHANGE_REQUEST_STATUS_DENIED, rowIndex: -1, created: false };
  }

  const columnMap = options && options.columnMap ? options.columnMap : getChangeRequestsColumnMap_(changeSheet);
  const snapshotRaw = buildPermissionDeltaSnapshot_(deltaSnapshot);
  const existingRow = findExistingChangeRequestRow_(changeSheet, targetSheetName, targetRowKey, action, columnMap);
  const now = new Date();

  if (existingRow > 0) {
    const existingStatus = (changeSheet.getRange(existingRow, columnMap.status).getValue() || '').toString().toUpperCase() || CHANGE_REQUEST_STATUS_PENDING;
    const existingSnapshot = changeSheet.getRange(existingRow, columnMap.proposedSnapshot).getValue();
    if (existingSnapshot !== snapshotRaw) {
      changeSheet.getRange(existingRow, columnMap.proposedSnapshot).setValue(snapshotRaw);
      changeSheet.getRange(existingRow, columnMap.requestedAt).setValue(now);
      if (requestedBy) {
        changeSheet.getRange(existingRow, columnMap.requestedBy).setValue(requestedBy);
      }
      changeSheet.getRange(existingRow, columnMap.status).setValue(CHANGE_REQUEST_STATUS_PENDING);
      changeSheet.getRange(existingRow, columnMap.approvalsNeeded).setValue(approvalsConfig.requiredApprovals);
      if (columnMap.denyReason) {
        changeSheet.getRange(existingRow, columnMap.denyReason).clearContent();
      }
      if (columnMap.appliedAt) {
        changeSheet.getRange(existingRow, columnMap.appliedAt).clearContent();
      }
      if (columnMap.approverCols && columnMap.approverCols.length) {
        columnMap.approverCols.forEach(function(colIndex) {
          changeSheet.getRange(existingRow, colIndex).clearContent();
        });
      }
      return { status: CHANGE_REQUEST_STATUS_PENDING, rowIndex: existingRow, created: false };
    }
    return { status: existingStatus, rowIndex: existingRow, created: false };
  }

  const newRow = [];
  newRow[columnMap.id - 1] = '';
  newRow[columnMap.requestedBy - 1] = requestedBy || '';
  newRow[columnMap.requestedAt - 1] = now;
  newRow[columnMap.targetSheet - 1] = targetSheetName;
  newRow[columnMap.targetRowKey - 1] = targetRowKey;
  newRow[columnMap.action - 1] = action;
  newRow[columnMap.proposedSnapshot - 1] = snapshotRaw;
  newRow[columnMap.status - 1] = CHANGE_REQUEST_STATUS_PENDING;
  newRow[columnMap.approvalsNeeded - 1] = approvalsConfig.requiredApprovals;
  changeSheet.appendRow(newRow);
  const appendedRowIndex = changeSheet.getLastRow();
  normalizeChangeRequestRow_(changeSheet, appendedRowIndex, approvalsConfig, null, columnMap);
  return { status: CHANGE_REQUEST_STATUS_PENDING, rowIndex: appendedRowIndex, created: true };
}

function markChangeRequestAppliedByRow_(changeSheet, rowIndex, columnMap) {
  if (!changeSheet || !rowIndex || rowIndex < 2) return false;
  const resolvedColumnMap = columnMap || getChangeRequestsColumnMap_(changeSheet);
  changeSheet.getRange(rowIndex, resolvedColumnMap.status).setValue(CHANGE_REQUEST_STATUS_APPLIED);
  if (resolvedColumnMap.appliedAt) {
    changeSheet.getRange(rowIndex, resolvedColumnMap.appliedAt).setValue(new Date());
  }
  if (resolvedColumnMap.denyReason) {
    changeSheet.getRange(rowIndex, resolvedColumnMap.denyReason).clearContent();
  }
  return true;
}

/**
 * Applies an approved change request row to its target sheet.
 * @param {Sheet} changeSheet The ChangeRequests sheet
 * @param {number} rowIndex 1-based row index in ChangeRequests
 * @param {Object} approvalsConfig Cached approvals config
 * @param {Object} options Optional flags
 * @return {boolean} true if applied
 */
function applyApprovedChangeRequest_(changeSheet, rowIndex, approvalsConfig, options = {}, columnMap) {
  const resolvedColumnMap = columnMap || getChangeRequestsColumnMap_(changeSheet);
  const rowValues = changeSheet.getRange(rowIndex, 1, 1, changeSheet.getLastColumn()).getValues()[0];
  const status = (rowValues[resolvedColumnMap.status - 1] || '').toString().toUpperCase();
  if (status !== CHANGE_REQUEST_STATUS_APPROVED) {
    return false;
  }

  const targetSheetName = (rowValues[resolvedColumnMap.targetSheet - 1] || '').toString().trim();
  const action = (rowValues[resolvedColumnMap.action - 1] || '').toString().toUpperCase();
  const targetRowKey = rowValues[resolvedColumnMap.targetRowKey - 1];
  const snapshotRaw = rowValues[resolvedColumnMap.proposedSnapshot - 1];

  if (!targetSheetName || !action) {
    setChangeRequestFailure_(changeSheet, rowIndex, 'Missing target sheet or action', resolvedColumnMap);
    return false;
  }

  const ss = changeSheet.getParent();
  const targetSheet = ss.getSheetByName(targetSheetName);
  if (!targetSheet) {
    setChangeRequestFailure_(changeSheet, rowIndex, 'Target sheet not found: ' + targetSheetName, resolvedColumnMap);
    return false;
  }

  const headers = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0];
  const snapshot = parseChangeRequestSnapshot_(snapshotRaw, headers.length, headers);
  if (!snapshot) {
    setChangeRequestFailure_(changeSheet, rowIndex, 'Invalid ProposedRowSnapshot', resolvedColumnMap);
    return false;
  }

  try {
    const columnMap = buildColumnIndexMap_(headers);
    const targetKeyColumn = resolveTargetKeyColumn_(targetSheetName, headers, columnMap);

    if (action === 'ADD') {
      applyAddChangeRequest_(targetSheet, snapshot);
    } else if (action === 'UPDATE') {
      applyUpdateChangeRequest_(targetSheet, targetRowKey, snapshot, targetKeyColumn);
    } else if (action === 'DELETE') {
      applyDeleteChangeRequest_(targetSheet, targetRowKey, headers, targetKeyColumn, columnMap);
    } else {
      setChangeRequestFailure_(changeSheet, rowIndex, 'Unsupported action: ' + action, resolvedColumnMap);
      return false;
    }
  } catch (err) {
    setChangeRequestFailure_(changeSheet, rowIndex, err.message, resolvedColumnMap);
    return false;
  }

  changeSheet.getRange(rowIndex, resolvedColumnMap.status).setValue(CHANGE_REQUEST_STATUS_APPLIED);
  if (resolvedColumnMap.appliedAt) {
    changeSheet.getRange(rowIndex, resolvedColumnMap.appliedAt).setValue(new Date());
  }
  if (resolvedColumnMap.denyReason) {
    changeSheet.getRange(rowIndex, resolvedColumnMap.denyReason).clearContent();
  }
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

function buildColumnIndexMap_(headers) {
  var map = {};
  headers.forEach(function(header, idx) {
    var key = header !== undefined && header !== null ? header.toString().trim() : '';
    if (key) {
      map[key] = idx + 1;
    }
  });
  return map;
}

function resolveTargetKeyColumn_(targetSheetName, headers, columnMap) {
  if (targetSheetName === MANAGED_FOLDERS_SHEET_NAME) {
    var folderIdIndex = columnMap['FolderID'];
    if (!folderIdIndex) {
      throw new Error('FolderID column not found in ManagedFolders sheet');
    }
    return { name: 'FolderID', index: folderIdIndex };
  }

  for (var i = 0; i < headers.length; i++) {
    var header = headers[i];
    if (header !== undefined && header !== null && header !== '') {
      return { name: header.toString(), index: i + 1 };
    }
  }

  throw new Error('No headers found for target sheet ' + targetSheetName);
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

function applyUpdateChangeRequest_(targetSheet, targetRowKey, snapshot, targetKeyColumn) {
  if (targetRowKey === undefined || targetRowKey === null || targetRowKey === '') {
    throw new Error('Missing TargetRowKey for UPDATE');
  }
  const dataRange = targetSheet.getDataRange();
  const values = dataRange.getValues();
  var matchedIndexes = [];
  for (var i = 1; i < values.length; i++) {
    if (values[i][targetKeyColumn.index - 1] == targetRowKey) {
      matchedIndexes.push(i);
    }
  }

  if (matchedIndexes.length === 0) {
    throw new Error('TargetRowKey not found in column ' + targetKeyColumn.name + ' for UPDATE: ' + targetRowKey);
  }
  if (matchedIndexes.length > 1) {
    throw new Error('Multiple rows matched TargetRowKey in column ' + targetKeyColumn.name + ' for UPDATE: ' + targetRowKey);
  }

  targetSheet.getRange(matchedIndexes[0] + 1, 1, 1, snapshot.length).setValues([snapshot]);
}

function applyDeleteChangeRequest_(targetSheet, targetRowKey, headers, targetKeyColumn, columnMap) {
  if (targetRowKey === undefined || targetRowKey === null || targetRowKey === '') {
    throw new Error('Missing TargetRowKey for DELETE');
  }

  var deleteColumnIndex = columnMap['Delete'] || columnMap['Deleted'];

  const dataRange = targetSheet.getDataRange();
  const values = dataRange.getValues();
  var matchedIndexes = [];
  for (var i = 1; i < values.length; i++) {
    if (values[i][targetKeyColumn.index - 1] == targetRowKey) {
      matchedIndexes.push(i);
    }
  }

  if (matchedIndexes.length === 0) {
    throw new Error('TargetRowKey not found in column ' + targetKeyColumn.name + ' for DELETE: ' + targetRowKey);
  }
  if (matchedIndexes.length > 1) {
    throw new Error('Multiple rows matched TargetRowKey in column ' + targetKeyColumn.name + ' for DELETE: ' + targetRowKey);
  }

  if (deleteColumnIndex !== undefined && deleteColumnIndex !== null) {
    targetSheet.getRange(matchedIndexes[0] + 1, deleteColumnIndex).setValue(true);
  } else {
    targetSheet.deleteRow(matchedIndexes[0] + 1);
  }
}

function setChangeRequestFailure_(sheet, rowIndex, reason, columnMap) {
  const resolvedColumnMap = columnMap || getChangeRequestsColumnMap_(sheet);
  sheet.getRange(rowIndex, resolvedColumnMap.status).setValue(CHANGE_REQUEST_STATUS_DENIED);
  if (resolvedColumnMap.denyReason) {
    sheet.getRange(rowIndex, resolvedColumnMap.denyReason).setValue(reason);
  }
  log_('Denied change request row ' + rowIndex + ': ' + reason, 'WARN');
}

function isTerminalChangeRequestStatus_(status) {
  return status === CHANGE_REQUEST_STATUS_APPLIED || status === CHANGE_REQUEST_STATUS_DENIED ||
    status === CHANGE_REQUEST_STATUS_CANCELLED || status === CHANGE_REQUEST_STATUS_EXPIRED;
}

function isChangeRequestApproverEdit_(event, columnMap) {
  if (!event || !event.range || !columnMap || !columnMap.approverCols) return false;
  const column = event.range.getColumn();
  return columnMap.approverCols.indexOf(column) !== -1;
}

function isValidApproverEmail_(email, approvalsConfig) {
  if (!email) return false;
  const normalized = email.toString().trim().toLowerCase();
  if (!normalized) return false;
  if (SINGLE_EMAIL_VALIDATION_REGEX && !SINGLE_EMAIL_VALIDATION_REGEX.test(normalized)) {
    return false;
  }
  if (!approvalsConfig || !approvalsConfig.activeEditorsSet) {
    return true;
  }
  return approvalsConfig.activeEditorsSet.has(normalized);
}

function normalizeChangeRequestRow_(sheet, rowIndex, approvalsConfig, eventUser, columnMap) {
  const resolvedColumnMap = columnMap || getChangeRequestsColumnMap_(sheet);
  const lastColumn = sheet.getLastColumn();
  const rowRange = sheet.getRange(rowIndex, 1, 1, lastColumn);
  const rowValues = rowRange.getValues()[0];
  const updates = [];
  const requestedBy = rowValues[resolvedColumnMap.requestedBy - 1] || (eventUser && eventUser.getEmail && eventUser.getEmail());
  const status = (rowValues[resolvedColumnMap.status - 1] || '').toString().toUpperCase() || CHANGE_REQUEST_STATUS_PENDING;

  if (!rowValues[resolvedColumnMap.id - 1]) {
    updates.push({ col: resolvedColumnMap.id, value: 'CR-' + new Date().getTime() + '-' + Math.floor(Math.random() * 1000) });
  }
  if (requestedBy) {
    updates.push({ col: resolvedColumnMap.requestedBy, value: requestedBy });
  }
  if (!rowValues[resolvedColumnMap.requestedAt - 1]) {
    updates.push({ col: resolvedColumnMap.requestedAt, value: new Date() });
  }
  if (!rowValues[resolvedColumnMap.status - 1]) {
    updates.push({ col: resolvedColumnMap.status, value: status });
  }

  const approvalsNeeded = approvalsConfig && approvalsConfig.requiredApprovals ? approvalsConfig.requiredApprovals : 1;
  updates.push({ col: resolvedColumnMap.approvalsNeeded, value: approvalsNeeded });

  if (updates.length > 0) {
    updates.forEach(function(update) {
      sheet.getRange(rowIndex, update.col).setValue(update.value);
    });
  }
}

function tallyChangeRequestApprovals_(sheet, approvalsConfig, columnMap) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const resolvedColumnMap = columnMap || getChangeRequestsColumnMap_(sheet);
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  data.forEach(function(row, idx) {
    const rowIndex = idx + 2;
    const status = (row[resolvedColumnMap.status - 1] || '').toString().toUpperCase();
    if (isTerminalChangeRequestStatus_(status)) return;

    const approvals = collectApprovalsFromRow_(row, approvalsConfig.requiredApprovals, row[resolvedColumnMap.requestedBy - 1], resolvedColumnMap, approvalsConfig.activeEditorsSet);
    const invalidApprovers = collectInvalidApproversFromRow_(row, resolvedColumnMap, approvalsConfig);
    if (approvals.length >= approvalsConfig.requiredApprovals) {
      sheet.getRange(rowIndex, resolvedColumnMap.status).setValue(CHANGE_REQUEST_STATUS_APPROVED);
    } else {
      sheet.getRange(rowIndex, resolvedColumnMap.status).setValue(CHANGE_REQUEST_STATUS_PENDING);
    }
    const statusCell = sheet.getRange(rowIndex, resolvedColumnMap.status);
    if (invalidApprovers.length > 0) {
      statusCell.setNote('Invalid approver(s): ' + invalidApprovers.join(', ') + '. Approvers must be active Sheet Editors.');
    } else if (statusCell.getNote()) {
      statusCell.clearNote();
    }
  });
}

function collectApprovalsFromRow_(rowValues, approvalsRequired, requestedBy, columnMap, allowedApproversSet) {
  const approvals = [];
  const lowerRequestedBy = requestedBy ? requestedBy.toString().toLowerCase() : '';
  if (!columnMap || !columnMap.approverCols || !columnMap.approverCols.length) return approvals;
  for (var i = 0; i < columnMap.approverCols.length; i++) {
    var colIndex = columnMap.approverCols[i];
    if (!colIndex) continue;
    var email = rowValues[colIndex - 1];
    if (!email) continue;
    const normalized = email.toString().trim().toLowerCase();
    if (!normalized) continue;
    if (SINGLE_EMAIL_VALIDATION_REGEX && !SINGLE_EMAIL_VALIDATION_REGEX.test(normalized)) {
      continue;
    }
    if (allowedApproversSet && !allowedApproversSet.has(normalized)) {
      continue;
    }
    if (normalized === lowerRequestedBy) {
      continue; // no self-approval
    }
    if (approvals.indexOf(normalized) === -1) {
      approvals.push(normalized);
    }
  }
  return approvals;
}

function collectInvalidApproversFromRow_(rowValues, columnMap, approvalsConfig) {
  const invalid = [];
  if (!columnMap || !columnMap.approverCols || !columnMap.approverCols.length) return invalid;
  for (var i = 0; i < columnMap.approverCols.length; i++) {
    var colIndex = columnMap.approverCols[i];
    if (!colIndex) continue;
    var email = rowValues[colIndex - 1];
    if (!email) continue;
    if (!isValidApproverEmail_(email, approvalsConfig)) {
      invalid.push(email.toString().trim());
    }
  }
  return invalid;
}

function getApprovalsConfig_() {
  const enabled = getConfigValueFresh_('ApprovalsEnabled', false) === true;
  const requiredApprovalsRaw = getConfigValueFresh_('RequiredApprovals', 1);
  const requiredApprovals = Math.min(3, Math.max(1, parseInt(requiredApprovalsRaw, 10) || 1));
  const expiryHoursRaw = getConfigValueFresh_('ApprovalExpiryHours', 0);
  const expiryHours = Math.max(0, parseInt(expiryHoursRaw, 10) || 0);
  const activeEditors = getActiveSheetEditorEmails_();
  const activeEditorsSet = new Set(activeEditors.map(function(email) {
    return email.toString().trim().toLowerCase();
  }));
  return {
    enabled: enabled,
    requiredApprovals: requiredApprovals,
    expiryHours: expiryHours,
    availableEditors: activeEditors.length,
    activeEditors: activeEditors,
    activeEditorsSet: activeEditorsSet
  };
}

function shouldGatePermissionEdits_() {
  const approvalsConfig = getApprovalsConfig_();
  return approvalsConfig.enabled === true;
}

function isChangeRequestEditableRange_(sheet, range) {
  if (!sheet || !range) return false;
  if (range.getRow() <= 1) return false;
  if (range.getNumRows() > 1 || range.getNumColumns() > 1) return false;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const header = headers[range.getColumn() - 1];
  const headerName = header ? header.toString().trim() : '';
  if (!headerName) return false;

  if (headerName.indexOf('Approver_') === 0) return true;
  if (headerName === 'Status' || headerName === 'DenyReason') return true;
  return false;
}

function queueChangeRequestFromEdit_(sheet, range, eventUser, rowValuesOverride) {
  if (!sheet || !range) return false;
  if (!shouldGatePermissionEdits_()) return false;

  const rowIndex = range.getRow();
  if (rowIndex <= 1) return false;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowValues = rowValuesOverride || sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const columnMap = buildColumnIndexMap_(headers);
  const targetKeyColumn = resolveTargetKeyColumn_(sheet.getName(), headers, columnMap);
  const targetRowKey = rowValues[targetKeyColumn.index - 1];
  if (!targetRowKey) {
    log_('Skipped change request: missing TargetRowKey for ' + sheet.getName() + ' row ' + rowIndex, 'WARN');
    return false;
  }

  const requestedBy = eventUser && eventUser.getEmail ? eventUser.getEmail() : '';
  const snapshotRaw = JSON.stringify(rowValues);
  return upsertChangeRequest_(sheet.getName(), targetRowKey, 'UPDATE', snapshotRaw, requestedBy);
}

function upsertChangeRequest_(targetSheetName, targetRowKey, action, snapshotRaw, requestedBy) {
  const approvalsConfig = getApprovalsConfig_();
  if (!approvalsConfig.enabled) return false;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let changeSheet = ss.getSheetByName(CHANGE_REQUESTS_SHEET_NAME);
  if (!changeSheet) {
    ensureChangeRequestsSheet_();
    changeSheet = ss.getSheetByName(CHANGE_REQUESTS_SHEET_NAME);
  }
  if (!changeSheet) return false;

  const columnMap = getChangeRequestsColumnMap_(changeSheet);
  const existingRow = findExistingChangeRequestRow_(changeSheet, targetSheetName, targetRowKey, action, columnMap);
  const now = new Date();

  if (existingRow > 0) {
    changeSheet.getRange(existingRow, columnMap.proposedSnapshot).setValue(snapshotRaw);
    changeSheet.getRange(existingRow, columnMap.requestedAt).setValue(now);
    if (requestedBy) {
      changeSheet.getRange(existingRow, columnMap.requestedBy).setValue(requestedBy);
    }
    changeSheet.getRange(existingRow, columnMap.status).setValue(CHANGE_REQUEST_STATUS_PENDING);
    changeSheet.getRange(existingRow, columnMap.approvalsNeeded).setValue(approvalsConfig.requiredApprovals);
    if (columnMap.denyReason) {
      changeSheet.getRange(existingRow, columnMap.denyReason).clearContent();
    }
    if (columnMap.appliedAt) {
      changeSheet.getRange(existingRow, columnMap.appliedAt).clearContent();
    }
    if (columnMap.approverCols && columnMap.approverCols.length) {
      columnMap.approverCols.forEach(function(colIndex) {
        changeSheet.getRange(existingRow, colIndex).clearContent();
      });
    }
  } else {
    const newRow = [];
    newRow[columnMap.id - 1] = '';
    newRow[columnMap.requestedBy - 1] = requestedBy || '';
    newRow[columnMap.requestedAt - 1] = now;
    newRow[columnMap.targetSheet - 1] = targetSheetName;
    newRow[columnMap.targetRowKey - 1] = targetRowKey;
    newRow[columnMap.action - 1] = action;
    newRow[columnMap.proposedSnapshot - 1] = snapshotRaw;
    newRow[columnMap.status - 1] = CHANGE_REQUEST_STATUS_PENDING;
    newRow[columnMap.approvalsNeeded - 1] = approvalsConfig.requiredApprovals;
    changeSheet.appendRow(newRow);
    const appendedRowIndex = changeSheet.getLastRow();
    normalizeChangeRequestRow_(changeSheet, appendedRowIndex, approvalsConfig, null, columnMap);
  }

  log_('Queued change request for ' + targetSheetName + ' key=' + targetRowKey, 'INFO');
  return true;
}

function findExistingChangeRequestRow_(changeSheet, targetSheetName, targetRowKey, action, columnMap) {
  const lastRow = changeSheet.getLastRow();
  if (lastRow < 2) return -1;

  const resolvedColumnMap = columnMap || getChangeRequestsColumnMap_(changeSheet);
  const data = changeSheet.getRange(2, 1, lastRow - 1, changeSheet.getLastColumn()).getValues();
  for (var i = 0; i < data.length; i++) {
    const row = data[i];
    const status = (row[resolvedColumnMap.status - 1] || '').toString().toUpperCase();
    if (isTerminalChangeRequestStatus_(status)) {
      continue;
    }
    const sheetName = (row[resolvedColumnMap.targetSheet - 1] || '').toString();
    const rowKey = row[resolvedColumnMap.targetRowKey - 1];
    const rowAction = (row[resolvedColumnMap.action - 1] || '').toString().toUpperCase();
    if (sheetName === targetSheetName && rowKey == targetRowKey && rowAction === action) {
      return i + 2;
    }
  }
  return -1;
}

function countPendingChangeRequests_(options) {
  const approvalsConfig = getApprovalsConfig_();
  const ignoreEnabled = options && options.ignoreEnabled === true;
  if (!approvalsConfig.enabled && !ignoreEnabled) return 0;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const changeSheet = ss.getSheetByName(CHANGE_REQUESTS_SHEET_NAME);
  if (!changeSheet) return 0;
  const lastRow = changeSheet.getLastRow();
  if (lastRow < 2) return 0;

  const columnMap = getChangeRequestsColumnMap_(changeSheet);
  const data = changeSheet.getRange(2, columnMap.status, lastRow - 1, 1).getValues();
  let pending = 0;
  data.forEach(function(row) {
    const status = (row[0] || '').toString().toUpperCase();
    if (status === CHANGE_REQUEST_STATUS_PENDING) {
      pending++;
    }
  });
  log_('Approvals pending count: enabled=' + approvalsConfig.enabled + ', required=' + approvalsConfig.requiredApprovals + ', pending=' + pending + ', ignoreEnabled=' + ignoreEnabled, 'DEBUG');
  return pending;
}

function getActiveSheetEditorEmails_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetEditorsSheet = ss.getSheetByName(SHEET_EDITORS_SHEET_NAME);
  if (!sheetEditorsSheet) return [];
  const lastRow = sheetEditorsSheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheetEditorsSheet.getRange(2, 1, Math.max(1, lastRow - 1), 5).getValues();
  return data.filter(function(row) {
    const email = row[0];
    const disabled = row[4];
    return email && !isUserRowDisabled_(disabled);
  }).map(function(row) {
    return row[0].toString().trim().toLowerCase();
  });
}
