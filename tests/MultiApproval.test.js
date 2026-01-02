const fs = require('fs');
const path = require('path');

function loadGasFileIntoGlobal(filePath) {
  const content = fs.readFileSync(path.resolve(__dirname, filePath), 'utf8');
  let transformed = content.replace(/^function (\w+)\s*\(/gm, 'global.$1 = function $1(');
  transformed = transformed.replace(/^const (\w+)\s*=/gm, 'global.$1 =');
  eval(transformed);
}

function createMockSheet(name, data) {
  const sheet = {
    _name: name,
    data: data,
    notes: {},
    parent: null,
    getName() {
      return this._name;
    },
    setName(newName) {
      this._name = newName;
    },
    setParent(parent) {
      this.parent = parent;
    },
    getParent() {
      return this.parent;
    },
    getLastRow() {
      return this.data.length;
    },
    getLastColumn() {
      return this.data[0] ? this.data[0].length : 0;
    },
    getRange(row, col, numRows = 1, numCols = 1) {
      const sheetRef = this;
      return {
        getValue() {
          return this.getValues()[0][0];
        },
        getValues() {
          const values = [];
          for (let r = 0; r < numRows; r++) {
            const sourceRow = sheetRef.data[row - 1 + r] || [];
            const rowValues = [];
            for (let c = 0; c < numCols; c++) {
              rowValues.push(sourceRow[col - 1 + c]);
            }
            values.push(rowValues);
          }
          return values;
        },
        setValue(value) {
          if (numRows !== 1 || numCols !== 1) {
            throw new Error('setValue only supports single cells in this mock');
          }
          if (!sheetRef.data[row - 1]) {
            sheetRef.data[row - 1] = [];
          }
          sheetRef.data[row - 1][col - 1] = value;
        },
        setValues(values) {
          for (let r = 0; r < numRows; r++) {
            if (!sheetRef.data[row - 1 + r]) {
              sheetRef.data[row - 1 + r] = [];
            }
            for (let c = 0; c < numCols; c++) {
              sheetRef.data[row - 1 + r][col - 1 + c] = values[r][c];
            }
          }
        },
        clearContent() {
          for (let r = 0; r < numRows; r++) {
            for (let c = 0; c < numCols; c++) {
              if (sheetRef.data[row - 1 + r]) {
                sheetRef.data[row - 1 + r][col - 1 + c] = '';
              }
            }
          }
        },
        setNote(note) {
          sheetRef.notes[row + ',' + col] = note;
        },
      };
    },
    getDataRange() {
      const sheetRef = this;
      return {
        getValues() {
          return sheetRef.data;
        },
      };
    },
    appendRow(row) {
      this.data.push(row);
    },
    deleteRow(index) {
      this.data.splice(index - 1, 1);
    },
  };
  return sheet;
}

function createMockSpreadsheet(sheets) {
  const sheetMap = new Map();
  sheets.forEach((sheet) => {
    sheet.setParent(spreadsheet);
  });

  function spreadsheet() {}
  spreadsheet.getSheetByName = jest.fn((name) => sheetMap.get(name) || null);
  spreadsheet.insertSheet = jest.fn((name) => {
    const newSheet = createMockSheet(name, [[]]);
    newSheet.setParent(spreadsheet);
    sheetMap.set(name, newSheet);
    return newSheet;
  });
  spreadsheet.getSheets = jest.fn(() => Array.from(sheetMap.values()));

  sheets.forEach((sheet) => {
    sheetMap.set(sheet.getName(), sheet);
    sheet.setParent(spreadsheet);
  });

  return spreadsheet;
}

beforeAll(() => {
  loadGasFileIntoGlobal('../apps_script_project/Code.js');
  loadGasFileIntoGlobal('../apps_script_project/MultiApproval.gs');
});

beforeEach(() => {
  jest.clearAllMocks();
  global.log_ = jest.fn();
  global.getConfigValue_ = jest.fn();
  global.isUserRowDisabled_ = jest.fn(() => false);
});

describe('collectApprovalsFromRow_', () => {
  it('excludes requester from approvals when more than one approval is required', () => {
    const row = new Array(CHANGE_REQUEST_APPLIED_AT_COL).fill('');
    row[CHANGE_REQUEST_REQUESTED_BY_COL - 1] = 'requester@example.com';
    row[CHANGE_REQUEST_FIRST_APPROVER_COL - 1] = 'requester@example.com';
    row[CHANGE_REQUEST_FIRST_APPROVER_COL] = 'approver@example.com';

    const approvals = collectApprovalsFromRow_(row, 2, 'requester@example.com');

    expect(approvals).toEqual(['approver@example.com']);
  });
});

describe('processChangeRequests_', () => {
  it('applies approved requests when threshold is met', () => {
    const changeRequestsData = [
      ['ID', 'RequestedBy', 'RequestedAt', 'TargetSheet', 'TargetRowKey', 'Action', 'ProposedRowSnapshot', 'Status', 'ApprovalsNeeded', 'Approver1', 'Approver2', 'Extra', 'DenyReason', 'AppliedAt'],
      ['CR-1', 'requester@example.com', new Date('2024-01-01'), 'ManagedFolders', 1, 'UPDATE', JSON.stringify(['1', 'Updated Name', '']), 'PENDING', 2, 'approver1@example.com', 'approver2@example.com', '', '', ''],
    ];
    const targetSheetData = [
      ['ID', 'Name', 'Delete'],
      [1, 'Original Name', false],
    ];

    const changeSheet = createMockSheet(CHANGE_REQUESTS_SHEET_NAME, changeRequestsData);
    const targetSheet = createMockSheet('ManagedFolders', targetSheetData);
    const spreadsheet = createMockSpreadsheet([changeSheet, targetSheet]);

    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn(() => spreadsheet),
    };

    jest.spyOn(global, 'getApprovalsConfig_').mockReturnValue({
      enabled: true,
      requiredApprovals: 2,
      expiryHours: 0,
      availableEditors: 3,
    });

    processChangeRequests_({ silentMode: true });

    expect(targetSheet.data[1][1]).toBe('Updated Name');
    expect(changeSheet.data[1][CHANGE_REQUEST_STATUS_COL - 1]).toBe(CHANGE_REQUEST_STATUS_APPLIED);
    expect(changeSheet.data[1][CHANGE_REQUEST_APPLIED_AT_COL - 1]).toBeInstanceOf(Date);
  });

  it('stops when required approvals exceed available editors', () => {
    const changeRequestsData = [
      ['ID', 'RequestedBy', 'RequestedAt', 'TargetSheet', 'TargetRowKey', 'Action', 'ProposedRowSnapshot', 'Status', 'ApprovalsNeeded', 'Approver1', 'Approver2', 'Extra', 'DenyReason', 'AppliedAt'],
      ['CR-1', 'requester@example.com', new Date('2024-01-01'), 'ManagedFolders', 1, 'UPDATE', JSON.stringify(['1', 'Updated Name', '']), 'PENDING', 5, 'approver1@example.com', '', '', '', ''],
    ];
    const targetSheetData = [
      ['ID', 'Name', 'Delete'],
      [1, 'Original Name', false],
    ];

    const changeSheet = createMockSheet(CHANGE_REQUESTS_SHEET_NAME, changeRequestsData);
    const targetSheet = createMockSheet('ManagedFolders', targetSheetData);
    const spreadsheet = createMockSpreadsheet([changeSheet, targetSheet]);

    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn(() => spreadsheet),
    };

    jest.spyOn(global, 'getApprovalsConfig_').mockReturnValue({
      enabled: true,
      requiredApprovals: 5,
      expiryHours: 0,
      availableEditors: 2,
    });

    processChangeRequests_({ silentMode: true });

    expect(changeSheet.notes['1,1']).toContain('exceeds active sheet editors');
    expect(changeSheet.data[1][CHANGE_REQUEST_STATUS_COL - 1]).toBe('PENDING');
    expect(targetSheet.data[1][1]).toBe('Original Name');
  });
});
