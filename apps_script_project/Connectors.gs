/**
 * User group connector framework and sample connectors.
 *
 * Connectors populate the <GroupName>_G sheet before membership sync runs so
 * that syncGroupMembership_ can keep working with the normalized two-column
 * layout it expects.
 */

/**
 * Example connector configuration for transposed source data.
 *
 * Update the values and set `enabled` to true to activate.
 */
const TRANSPOSED_CONNECTOR_CONFIG = {
  id: 'TRANSPOSED_COLOR_EXAMPLE',
  enabled: false,
  groupName: 'REPLACE_WITH_GROUP_NAME',
  sourceSpreadsheetId: 'REPLACE_WITH_SPREADSHEET_ID',
  sourceSheetName: 'Sheet1',
  rowLabelColumn: 1, // Column containing the row labels (1-based index)
  fieldLabels: {
    email: 'Email',
    disabled: 'Disabled',
    candidate: 'candidateToBeDisabled'
  },
  candidateEnabledBackgrounds: ['#ffffff', '#fff'],
  createDisabledRowIfMissing: true,
  createCandidateRowIfMissing: true
};

/**
 * Example connector configuration for column-aligned sources that already have
 * an Enabled column the source owner maintains.
 */
const COLUMN_CONNECTOR_CONFIG = {
  id: 'COLUMNAR_SOURCE_EXAMPLE',
  enabled: false,
  groupName: 'REPLACE_WITH_GROUP_NAME',
  sourceSpreadsheetId: 'REPLACE_WITH_SPREADSHEET_ID',
  sourceSheetName: 'Sheet1',
  headerRow: 1,
  emailColumnHeader: 'Email',
  enabledColumnHeader: 'Enabled'
};

/**
 * Example connector configuration for sources where the target _G sheet owns
 * the Disabled flag entirely.
 */
const TARGET_DISABLED_CONNECTOR_CONFIG = {
  id: 'TARGET_DISABLED_OWNER_EXAMPLE',
  enabled: false,
  groupName: 'REPLACE_WITH_GROUP_NAME',
  sourceSpreadsheetId: 'REPLACE_WITH_SPREADSHEET_ID',
  sourceSheetName: 'Sheet1',
  headerRow: 1,
  emailColumnHeader: 'Email'
};

/**
 * Registry of all available connectors. Only connectors with `enabled: true`
 * and a matching group are executed.
 */
const USER_GROUP_CONNECTORS = [
  {
    config: TRANSPOSED_CONNECTOR_CONFIG,
    run: function(context, config) {
      runTransposedConnector_(context, config);
    }
  },
  {
    config: COLUMN_CONNECTOR_CONFIG,
    run: function(context, config) {
      runColumnConnector_(context, config);
    }
  },
  {
    config: TARGET_DISABLED_CONNECTOR_CONFIG,
    run: function(context, config) {
      runTargetManagedDisabledConnector_(context, config);
    }
  }
];

/**
 * Applies the connector mapped to the current group sheet, if any.
 *
 * @param {string} groupName
 * @param {string} groupEmail
 * @param {GoogleAppsScript.Spreadsheet.Sheet} targetSheet
 * @param {Object=} options
 * @returns {boolean} True if a connector ran.
 */
function applyUserGroupConnectorIfConfigured_(groupName, groupEmail, targetSheet, options) {
  if (!targetSheet) {
    return false;
  }
  const connectors = USER_GROUP_CONNECTORS || [];
  for (let i = 0; i < connectors.length; i++) {
    const connector = connectors[i];
    if (!connector) {
      continue;
    }
    const config = connector.config;
    if (!config || config.enabled !== true) {
      continue;
    }
    if (config.groupName && config.groupName !== groupName) {
      continue;
    }
    if (config.groupEmail && config.groupEmail !== groupEmail) {
      continue;
    }
    const connectorId = config.id || 'UNNAMED_CONNECTOR';
    const context = {
      groupName: groupName,
      groupEmail: groupEmail,
      targetSheet: targetSheet,
      targetSpreadsheet: targetSheet.getParent(),
      options: options || {},
      config: config
    };
    log_('Running user group connector "' + connectorId + '" for group "' + groupName + '".');
    connector.run(context, config);
    return true;
  }
  return false;
}

function runTransposedConnector_(context, config) {
  validateConnectorConfig_(config, ['sourceSpreadsheetId', 'sourceSheetName', 'fieldLabels', 'fieldLabels.email']);
  const sourceSpreadsheet = SpreadsheetApp.openById(config.sourceSpreadsheetId);
  const sourceSheet = sourceSpreadsheet.getSheetByName(config.sourceSheetName);
  if (!sourceSheet) {
    throw new Error('Transposed connector could not find sheet "' + config.sourceSheetName + '" in source spreadsheet.');
  }
  const labelColumn = config.rowLabelColumn || 1;
  const labelColumnIndex = labelColumn - 1;
  const lastRow = sourceSheet.getLastRow();
  const lastColumn = sourceSheet.getLastColumn();
  if (lastRow === 0 || lastColumn <= labelColumnIndex) {
    log_('Transposed connector found no data to import for group "' + context.groupName + '".', 'WARN');
    clearTargetSheet_(context.targetSheet);
    return;
  }
  let valuesRange = sourceSheet.getRange(1, 1, lastRow, lastColumn);
  let values = valuesRange.getValues();
  let backgrounds = valuesRange.getBackgrounds();

  let rowLookup = buildRowLookupByLabel_(values, labelColumnIndex);
  const emailLabel = config.fieldLabels.email;
  let emailRowIndex = rowLookup[emailLabel];
  if (emailRowIndex === undefined) {
    throw new Error('Transposed connector requires a row labeled "' + emailLabel + '" to locate email addresses.');
  }

  const disabledLabel = config.fieldLabels.disabled;
  const candidateLabel = config.fieldLabels.candidate;
  let disabledRowIndex = disabledLabel ? rowLookup[disabledLabel] : undefined;
  let candidateRowIndex = candidateLabel ? rowLookup[candidateLabel] : undefined;
  let disabledRowWasCreated = false;
  let candidateRowWasCreated = false;

  if (disabledLabel && disabledRowIndex === undefined && config.createDisabledRowIfMissing) {
    disabledRowIndex = appendLabeledRow_(sourceSheet, disabledLabel, labelColumn, lastColumn);
    disabledRowWasCreated = true;
    valuesRange = sourceSheet.getRange(1, 1, sourceSheet.getLastRow(), sourceSheet.getLastColumn());
    values = valuesRange.getValues();
    backgrounds = valuesRange.getBackgrounds();
    rowLookup = buildRowLookupByLabel_(values, labelColumnIndex);
  }

  if (candidateLabel && candidateRowIndex === undefined && config.createCandidateRowIfMissing) {
    candidateRowIndex = appendLabeledRow_(sourceSheet, candidateLabel, labelColumn, lastColumn);
    candidateRowWasCreated = true;
    valuesRange = sourceSheet.getRange(1, 1, sourceSheet.getLastRow(), sourceSheet.getLastColumn());
    values = valuesRange.getValues();
    backgrounds = valuesRange.getBackgrounds();
    rowLookup = buildRowLookupByLabel_(values, labelColumnIndex);
  }

  emailRowIndex = rowLookup[emailLabel];
  disabledRowIndex = disabledLabel ? rowLookup[disabledLabel] : undefined;
  candidateRowIndex = candidateLabel ? rowLookup[candidateLabel] : undefined;

  const dataStartColumn = labelColumnIndex + 1;
  const totalColumns = sourceSheet.getLastColumn();
  const disabledRowValues = disabledRowIndex !== undefined ? values[disabledRowIndex] : null;
  const candidateBackgroundRow = candidateRowIndex !== undefined ? backgrounds[candidateRowIndex] : null;
  const newDisabledRowValues = disabledRowIndex !== undefined ? values[disabledRowIndex].slice() : null;

  const rows = [];
  const candidateRowValuesToWrite = candidateRowWasCreated && candidateRowIndex !== undefined
    ? values[candidateRowIndex].slice()
    : null;
  for (let col = dataStartColumn; col < totalColumns; col++) {
    const rawEmail = values[emailRowIndex][col];
    if (!rawEmail) {
      continue;
    }
    const email = rawEmail.toString().trim();
    if (!email) {
      continue;
    }
    let disabled = false;
    if (disabledRowValues) {
      disabled = isUserRowDisabled_(disabledRowValues[col]);
    } else if (candidateBackgroundRow) {
      const color = candidateBackgroundRow[col];
      disabled = !isColorInWhitelist_(color, config.candidateEnabledBackgrounds || []);
    }
    if (disabledRowWasCreated && newDisabledRowValues) {
      const defaultValue = disabled ? 'TRUE' : 'FALSE';
      if (newDisabledRowValues[col] !== defaultValue) {
        newDisabledRowValues[col] = defaultValue;
      }
    }
    if (candidateRowValuesToWrite) {
      candidateRowValuesToWrite[col] = disabled ? 'TRUE' : 'FALSE';
    }
    rows.push([email.toLowerCase(), disabled]);
  }

  if (disabledRowWasCreated && newDisabledRowValues) {
    newDisabledRowValues[labelColumnIndex] = disabledLabel;
    sourceSheet.getRange(disabledRowIndex + 1, 1, 1, totalColumns).setValues([newDisabledRowValues]);
  }

  if (candidateRowWasCreated && candidateLabel && candidateRowValuesToWrite) {
    candidateRowValuesToWrite[labelColumnIndex] = candidateLabel;
    sourceSheet.getRange(candidateRowIndex + 1, 1, 1, totalColumns).setValues([candidateRowValuesToWrite]);
  }

  clearTargetSheet_(context.targetSheet);
  writeRowsToTargetSheet_(context.targetSheet, rows);
}

function runColumnConnector_(context, config) {
  validateConnectorConfig_(config, ['sourceSpreadsheetId', 'sourceSheetName', 'emailColumnHeader', 'enabledColumnHeader']);
  const sourceSpreadsheet = SpreadsheetApp.openById(config.sourceSpreadsheetId);
  const sourceSheet = sourceSpreadsheet.getSheetByName(config.sourceSheetName);
  if (!sourceSheet) {
    throw new Error('Column connector could not find sheet "' + config.sourceSheetName + '".');
  }
  const headerRow = config.headerRow || 1;
  const lastColumn = sourceSheet.getLastColumn();
  if (lastColumn === 0) {
    clearTargetSheet_(context.targetSheet);
    return;
  }
  const headerValues = sourceSheet.getRange(headerRow, 1, 1, lastColumn).getValues()[0];
  const emailIndex = headerValues.findIndex(function(value) {
    return value && value.toString().trim() === config.emailColumnHeader;
  });
  const enabledIndex = headerValues.findIndex(function(value) {
    return value && value.toString().trim() === config.enabledColumnHeader;
  });
  if (emailIndex === -1) {
    throw new Error('Column connector requires a column named "' + config.emailColumnHeader + '".');
  }
  if (enabledIndex === -1) {
    throw new Error('Column connector requires a column named "' + config.enabledColumnHeader + '".');
  }
  const lastRow = sourceSheet.getLastRow();
  if (lastRow <= headerRow) {
    clearTargetSheet_(context.targetSheet);
    return;
  }
  const dataRange = sourceSheet.getRange(headerRow + 1, 1, lastRow - headerRow, lastColumn);
  const dataValues = dataRange.getValues();
  const rows = [];
  dataValues.forEach(function(row) {
    const emailValue = row[emailIndex];
    if (!emailValue) {
      return;
    }
    const email = emailValue.toString().trim();
    if (!email) {
      return;
    }
    const enabledValue = row[enabledIndex];
    const disabled = !isTruthy_(enabledValue);
    rows.push([email.toLowerCase(), disabled]);
  });
  clearTargetSheet_(context.targetSheet);
  writeRowsToTargetSheet_(context.targetSheet, rows);
}

function runTargetManagedDisabledConnector_(context, config) {
  validateConnectorConfig_(config, ['sourceSpreadsheetId', 'sourceSheetName', 'emailColumnHeader']);
  const sourceSpreadsheet = SpreadsheetApp.openById(config.sourceSpreadsheetId);
  const sourceSheet = sourceSpreadsheet.getSheetByName(config.sourceSheetName);
  if (!sourceSheet) {
    throw new Error('Target-managed connector could not find sheet "' + config.sourceSheetName + '".');
  }
  const headerRow = config.headerRow || 1;
  const lastColumn = sourceSheet.getLastColumn();
  if (lastColumn === 0) {
    clearTargetSheet_(context.targetSheet);
    return;
  }
  const headerValues = sourceSheet.getRange(headerRow, 1, 1, lastColumn).getValues()[0];
  const emailIndex = headerValues.findIndex(function(value) {
    return value && value.toString().trim() === config.emailColumnHeader;
  });
  if (emailIndex === -1) {
    throw new Error('Target-managed connector requires a column named "' + config.emailColumnHeader + '".');
  }
  const lastRow = sourceSheet.getLastRow();
  if (lastRow <= headerRow) {
    clearTargetSheet_(context.targetSheet);
    return;
  }
  const dataRange = sourceSheet.getRange(headerRow + 1, 1, lastRow - headerRow, lastColumn);
  const dataValues = dataRange.getValues();
  const existingDisabled = readExistingDisabledMap_(context.targetSheet);
  const rows = [];
  dataValues.forEach(function(row) {
    const emailValue = row[emailIndex];
    if (!emailValue) {
      return;
    }
    const email = emailValue.toString().trim();
    if (!email) {
      return;
    }
    const key = email.toLowerCase();
    const disabled = Object.prototype.hasOwnProperty.call(existingDisabled, key) ? existingDisabled[key] : false;
    rows.push([key, disabled]);
  });
  clearTargetSheet_(context.targetSheet);
  writeRowsToTargetSheet_(context.targetSheet, rows);
}

function validateConnectorConfig_(config, requiredKeys) {
  if (!config) {
    throw new Error('Connector configuration is not defined.');
  }
  const configId = config.id || 'UNNAMED_CONNECTOR';
  if (config.enabled !== true) {
    throw new Error('Connector "' + configId + '" is disabled. Enable it before running.');
  }
  for (let i = 0; i < requiredKeys.length; i++) {
    const key = requiredKeys[i];
    const value = resolveConfigValue_(config, key);
    if (value === null || value === undefined || value === '') {
      throw new Error('Connector "' + configId + '" is missing required config value: ' + key);
    }
    if (typeof value === 'string' && value.indexOf('REPLACE_WITH') !== -1) {
      throw new Error('Connector "' + configId + '" still uses the placeholder value for: ' + key);
    }
  }
}

function resolveConfigValue_(config, path) {
  const segments = path.split('.');
  let current = config;
  for (let i = 0; i < segments.length; i++) {
    if (!current) {
      return null;
    }
    current = current[segments[i]];
  }
  return current;
}

function buildRowLookupByLabel_(values, labelColumnIndex) {
  const lookup = {};
  for (let i = 0; i < values.length; i++) {
    const cellValue = values[i][labelColumnIndex];
    if (!cellValue) {
      continue;
    }
    const label = cellValue.toString().trim();
    if (label) {
      lookup[label] = i;
    }
  }
  return lookup;
}

function appendLabeledRow_(sheet, label, labelColumn, totalColumns) {
  const newRowIndex = sheet.getLastRow() + 1;
  sheet.getRange(newRowIndex, labelColumn).setValue(label);
  const firstDataColumn = labelColumn + 1;
  const remainingColumns = Math.max(totalColumns - labelColumn, 0);
  if (remainingColumns > 0) {
    sheet.getRange(newRowIndex, firstDataColumn, 1, remainingColumns).clearContent();
  }
  return newRowIndex - 1; // Convert to zero-based index
}

function clearTargetSheet_(sheet) {
  if (!sheet) {
    return;
  }
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 2).clearContent();
  }
}

function writeRowsToTargetSheet_(sheet, rows) {
  if (!sheet) {
    return;
  }
  if (!rows || rows.length === 0) {
    return;
  }
  sheet.getRange(2, 1, rows.length, 2).setValues(rows);
}

function isColorInWhitelist_(color, whitelist) {
  if (!color) {
    return false;
  }
  if (!whitelist || whitelist.length === 0) {
    return false;
  }
  const normalized = color.toString().trim().toLowerCase();
  for (let i = 0; i < whitelist.length; i++) {
    if (normalized === whitelist[i].toString().trim().toLowerCase()) {
      return true;
    }
  }
  return false;
}

function isTruthy_(value) {
  if (value === true) {
    return true;
  }
  if (value === false || value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  const normalized = value.toString().trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return normalized === 'true' || normalized === 'yes' || normalized === 'y' || normalized === '1' || normalized === 'enabled';
}

function readExistingDisabledMap_(sheet) {
  const map = {};
  if (!sheet) {
    return map;
  }
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return map;
  }
  const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  data.forEach(function(row) {
    const email = row[0];
    if (!email) {
      return;
    }
    map[email.toString().trim().toLowerCase()] = isUserRowDisabled_(row[1]);
  });
  return map;
}
