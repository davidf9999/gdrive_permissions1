/**
 * DIAGNOSTIC TOOL: Find and report Config sheet errors
 * Run this function from the Apps Script editor to see exactly what's wrong
 */
function diagnoseConfigErrors() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(CONFIG_SHEET_NAME);

  if (!configSheet) {
    Logger.log('ERROR: Config sheet not found!');
    return;
  }

  Logger.log('===== CONFIG SHEET DIAGNOSTIC =====');
  Logger.log('');

  const lastRow = configSheet.getLastRow();
  const lastCol = configSheet.getLastColumn();

  Logger.log('Sheet dimensions: ' + lastRow + ' rows, ' + lastCol + ' columns');
  Logger.log('');

  const data = configSheet.getRange(1, 1, lastRow, Math.max(lastCol, 3)).getValues();
  const formulas = configSheet.getRange(1, 1, lastRow, Math.max(lastCol, 3)).getFormulas();

  let errorCount = 0;
  let formulaCount = 0;

  Logger.log('Scanning for errors and formulas...');
  Logger.log('');

  for (let i = 0; i < data.length; i++) {
    const rowNum = i + 1;

    for (let j = 0; j < data[i].length; j++) {
      const colLetter = String.fromCharCode(65 + j); // A, B, C, etc.
      const cellRef = colLetter + rowNum;
      const value = data[i][j];
      const formula = formulas[i][j];
      const valueStr = String(value);

      // Check for errors
      if (valueStr.startsWith('#') &&
          (valueStr.includes('ERROR') || valueStr.includes('N/A') ||
           valueStr.includes('VALUE') || valueStr.includes('REF') ||
           valueStr.includes('DIV'))) {
        errorCount++;
        Logger.log('❌ ERROR at ' + cellRef + ': ' + valueStr);
        if (formula) {
          Logger.log('   Formula: ' + formula);
        }
        if (i > 0 && data[i][0]) {
          Logger.log('   Setting name: ' + data[i][0]);
        }
        Logger.log('');
      }

      // Check for formulas in column B (Value column)
      if (j === 1 && formula && rowNum > 1 && !data[i][0].startsWith('---')) {
        formulaCount++;
        Logger.log('⚠️  Formula found at ' + cellRef + ': ' + formula);
        Logger.log('   Current value: ' + valueStr);
        Logger.log('   Setting name: ' + data[i][0]);
        Logger.log('   → RECOMMENDATION: Replace with plain value: "' + valueStr + '"');
        Logger.log('');
      }
    }
  }

  Logger.log('===== SUMMARY =====');
  Logger.log('Errors found: ' + errorCount);
  Logger.log('Formulas in Value column: ' + formulaCount);
  Logger.log('');

  if (errorCount === 0 && formulaCount === 0) {
    Logger.log('✅ No issues found! Your Config sheet looks good.');
  } else {
    Logger.log('===== RECOMMENDED ACTIONS =====');
    if (errorCount > 0) {
      Logger.log('1. Fix or remove the cells showing errors (marked with ❌)');
      Logger.log('   - Click on each error cell to see what\'s wrong');
      Logger.log('   - Usually you can just delete the formula and type a simple value');
    }
    if (formulaCount > 0) {
      Logger.log('2. Replace formulas in the Value column with plain values');
      Logger.log('   - Formulas in Config sheet can cause issues');
      Logger.log('   - Copy the cell value, then Paste Special > Values only');
    }
    Logger.log('');
    Logger.log('3. After fixing, run: Permissions Manager > Advanced > Clear Cache');
  }

  Logger.log('');
  Logger.log('===== DETAILED CONFIG VALUES =====');
  Logger.log('Here are all your current config settings:');
  Logger.log('');

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && !data[i][0].startsWith('---')) {
      const settingName = data[i][0];
      const value = data[i][1];
      const valueStr = String(value);

      if (valueStr.startsWith('#')) {
        Logger.log('❌ ' + settingName + ' = ' + valueStr + ' (ERROR!)');
      } else if (formulas[i][1]) {
        Logger.log('⚠️  ' + settingName + ' = ' + valueStr + ' (formula: ' + formulas[i][1] + ')');
      } else {
        Logger.log('✓ ' + settingName + ' = ' + valueStr);
      }
    }
  }
}

/**
 * AUTOMATIC FIX: Convert all formulas in Config Value column to plain values
 * This will resolve the #ERROR! issues by replacing formulas with their current values
 *
 * Run this from the script editor (not from a menu)
 */
function autoFixConfigFormulas() {
  Logger.log('Starting Config sheet auto-fix...');
  Logger.log('This will convert formulas to values and clear errors.');
  Logger.log('');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(CONFIG_SHEET_NAME);

  if (!configSheet) {
    Logger.log('ERROR: Config sheet not found!');
    return;
  }

  // Create a backup
  const backupSheet = configSheet.copyTo(ss);
  backupSheet.setName('Config_Backup_' + new Date().getTime());
  Logger.log('Created backup sheet: ' + backupSheet.getName());

  const lastRow = configSheet.getLastRow();
  const data = configSheet.getRange(1, 1, lastRow, 3).getValues();
  const formulas = configSheet.getRange(1, 1, lastRow, 3).getFormulas();

  let fixedCount = 0;
  let errorCount = 0;

  for (let i = 1; i < data.length; i++) { // Start from row 2 (index 1)
    const rowNum = i + 1;

    // Check column B (Value column, index 1)
    if (formulas[i][1]) {
      const value = data[i][1];
      const valueStr = String(value);

      // If it's an error, replace with empty string
      if (valueStr.startsWith('#') &&
          (valueStr.includes('ERROR') || valueStr.includes('N/A') ||
           valueStr.includes('VALUE') || valueStr.includes('REF') ||
           valueStr.includes('DIV'))) {
        configSheet.getRange(rowNum, 2).setValue('');
        errorCount++;
        Logger.log('Cleared error in Config row ' + rowNum + ' (' + data[i][0] + '): was ' + valueStr);
      } else {
        // Convert formula to value
        configSheet.getRange(rowNum, 2).setValue(value);
        fixedCount++;
        Logger.log('Converted formula to value in Config row ' + rowNum + ' (' + data[i][0] + '): ' + valueStr);
      }
    } else {
      // Check if cell has error even without formula (can happen with references)
      const value = data[i][1];
      const valueStr = String(value);

      if (valueStr.startsWith('#') &&
          (valueStr.includes('ERROR') || valueStr.includes('N/A') ||
           valueStr.includes('VALUE') || valueStr.includes('REF') ||
           valueStr.includes('DIV'))) {
        configSheet.getRange(rowNum, 2).setValue('');
        errorCount++;
        Logger.log('Cleared error in Config row ' + rowNum + ' (' + data[i][0] + '): was ' + valueStr);
      }
    }
  }

  // Clear the cache
  CacheService.getScriptCache().remove('config');

  Logger.log('');
  Logger.log('===== AUTO-FIX COMPLETE =====');
  Logger.log('Formulas converted to values: ' + fixedCount);
  Logger.log('Errors cleared: ' + errorCount);
  Logger.log('Backup created: ' + backupSheet.getName());
  Logger.log('');
  Logger.log('Cache has been cleared.');
  Logger.log('The #ERROR! logs should no longer appear.');
  Logger.log('');
  Logger.log('You can delete the backup sheet "' + backupSheet.getName() + '" once you verify everything works.');
}
