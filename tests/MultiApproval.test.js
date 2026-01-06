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
        clearNote() {
          delete sheetRef.notes[row + ',' + col];
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
  loadGasFileIntoGlobal('../apps_script_project/Utils.gs');
  loadGasFileIntoGlobal('../apps_script_project/Core.gs');
  loadGasFileIntoGlobal('../apps_script_project/MultiApproval.gs');
});

beforeEach(() => {
  jest.clearAllMocks();
  global.log_ = jest.fn();
  global.getConfigValue_ = jest.fn();
  global.isUserRowDisabled_ = jest.fn(() => false);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('collectApprovalsFromRow_', () => {
  it('excludes requester from approvals when more than one approval is required', () => {
    const headers = [
      'RequestId',
      'RequestedBy',
      'RequestedAt',
      'TargetSheet',
      'TargetRowKey',
      'Action',
      'ProposedRowSnapshot',
      'Status',
      'ApprovalsNeeded',
      'Approver_1',
      'Approver_2',
      'DenyReason',
      'AppliedAt'
    ];
    const columnMap = getChangeRequestsColumnMap_(
      createMockSheet(CHANGE_REQUESTS_SHEET_NAME, [headers])
    );
    const row = new Array(headers.length).fill('');
    row[columnMap.requestedBy - 1] = 'requester@example.com';
    row[columnMap.approverCols[0] - 1] = 'requester@example.com';
    row[columnMap.approverCols[1] - 1] = 'approver@example.com';

    const approvals = collectApprovalsFromRow_(row, 2, 'requester@example.com', columnMap);

    expect(approvals).toEqual(['approver@example.com']);
  });
});

describe('processChangeRequests_', () => {
  it('applies approved requests when threshold is met', () => {
    const changeRequestsData = [
      ['RequestId', 'RequestedBy', 'RequestedAt', 'TargetSheet', 'TargetRowKey', 'Action', 'ProposedRowSnapshot', 'Status', 'ApprovalsNeeded', 'Approver_1', 'Approver_2', 'Extra', 'DenyReason', 'AppliedAt'],
      ['CR-1', 'requester@example.com', new Date('2024-01-01'), 'ManagedFolders', 'folder-1', 'UPDATE', JSON.stringify(['Updated Name', 'folder-1', false]), 'PENDING', 2, 'approver1@example.com', 'approver2@example.com', '', '', ''],
    ];
    const targetSheetData = [
      ['Name', 'FolderID', 'Delete'],
      ['Original Name', 'folder-1', false],
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
    const columnMap = getChangeRequestsColumnMap_(changeSheet);

    expect(targetSheet.data[1][0]).toBe('Updated Name');
    expect(changeSheet.data[1][columnMap.status - 1]).toBe(CHANGE_REQUEST_STATUS_APPLIED);
    expect(changeSheet.data[1][columnMap.appliedAt - 1]).toBeInstanceOf(Date);
  });

  it('does not auto-approve or apply when approvals are disabled', () => {
    const changeRequestsData = [
      ['RequestId', 'RequestedBy', 'RequestedAt', 'TargetSheet', 'TargetRowKey', 'Action', 'ProposedRowSnapshot', 'Status', 'ApprovalsNeeded', 'Approver_1', 'Approver_2', 'Extra', 'DenyReason', 'AppliedAt'],
      ['CR-1', 'requester@example.com', new Date('2024-01-01'), 'ManagedFolders', 'folder-1', 'UPDATE', JSON.stringify(['Updated Name', 'folder-1', false]), 'PENDING', 2, 'approver1@example.com', 'approver2@example.com', '', '', ''],
    ];
    const targetSheetData = [
      ['Name', 'FolderID', 'Delete'],
      ['Original Name', 'folder-1', false],
    ];

    const changeSheet = createMockSheet(CHANGE_REQUESTS_SHEET_NAME, changeRequestsData);
    const targetSheet = createMockSheet('ManagedFolders', targetSheetData);
    const spreadsheet = createMockSpreadsheet([changeSheet, targetSheet]);

    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn(() => spreadsheet),
    };

    jest.spyOn(global, 'getApprovalsConfig_').mockReturnValue({
      enabled: false,
      requiredApprovals: 2,
      expiryHours: 0,
      availableEditors: 3,
    });

    processChangeRequests_({ silentMode: true });
    const columnMap = getChangeRequestsColumnMap_(changeSheet);

    expect(changeSheet.data[1][columnMap.status - 1]).toBe('PENDING');
    expect(changeSheet.data[1][columnMap.appliedAt - 1]).toBe('');
    expect(targetSheet.data[1][0]).toBe('Original Name');
  });

  it('denies requests when multiple rows match the target key column', () => {
    const changeRequestsData = [
      ['RequestId', 'RequestedBy', 'RequestedAt', 'TargetSheet', 'TargetRowKey', 'Action', 'ProposedRowSnapshot', 'Status', 'ApprovalsNeeded', 'Approver_1', 'Approver_2', 'Extra', 'DenyReason', 'AppliedAt'],
      ['CR-1', 'requester@example.com', new Date('2024-01-01'), 'ManagedFolders', 'folder-dup', 'UPDATE', JSON.stringify(['Updated Name', 'folder-dup', false]), 'PENDING', 2, 'approver1@example.com', 'approver2@example.com', '', '', ''],
    ];
    const targetSheetData = [
      ['Name', 'FolderID', 'Delete'],
      ['Original Name', 'folder-dup', false],
      ['Another Name', 'folder-dup', false],
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
    const columnMap = getChangeRequestsColumnMap_(changeSheet);

    expect(changeSheet.data[1][columnMap.status - 1]).toBe(CHANGE_REQUEST_STATUS_DENIED);
    expect(changeSheet.data[1][columnMap.denyReason - 1]).toContain('Multiple rows matched');
  });

  it('stops when required approvals exceed available editors', () => {
    const changeRequestsData = [
      ['RequestId', 'RequestedBy', 'RequestedAt', 'TargetSheet', 'TargetRowKey', 'Action', 'ProposedRowSnapshot', 'Status', 'ApprovalsNeeded', 'Approver_1', 'Approver_2', 'Extra', 'DenyReason', 'AppliedAt'],
      ['CR-1', 'requester@example.com', new Date('2024-01-01'), 'ManagedFolders', 'folder-1', 'UPDATE', JSON.stringify(['Updated Name', 'folder-1', false]), 'PENDING', 5, 'approver1@example.com', '', '', '', ''],
    ];
    const targetSheetData = [
      ['Name', 'FolderID', 'Delete'],
      ['Original Name', 'folder-1', false],
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
    const columnMap = getChangeRequestsColumnMap_(changeSheet);

    expect(changeSheet.notes['1,1']).toContain('exceeds active sheet editors');
    expect(changeSheet.data[1][columnMap.status - 1]).toBe('PENDING');
    expect(targetSheet.data[1][0]).toBe('Original Name');
  });

  it('expires pending requests after configured hours', () => {
    const now = new Date('2024-01-02T00:00:00Z');
    jest.useFakeTimers().setSystemTime(now);

    const changeRequestsData = [
      ['RequestId', 'RequestedBy', 'RequestedAt', 'TargetSheet', 'TargetRowKey', 'Action', 'ProposedRowSnapshot', 'Status', 'ApprovalsNeeded', 'Approver_1', 'Approver_2', 'Extra', 'DenyReason', 'AppliedAt'],
      ['CR-1', 'requester@example.com', new Date('2024-01-01T00:00:00Z'), 'ManagedFolders', 'folder-1', 'UPDATE', JSON.stringify(['Updated Name', 'folder-1', false]), 'PENDING', 2, '', '', '', '', ''],
    ];

    const targetSheetData = [
      ['Name', 'FolderID', 'Delete'],
      ['Original Name', 'folder-1', false],
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
      expiryHours: 1,
      availableEditors: 3,
    });

    processChangeRequests_({ silentMode: true });
    const columnMap = getChangeRequestsColumnMap_(changeSheet);

    expect(changeSheet.data[1][columnMap.status - 1]).toBe(CHANGE_REQUEST_STATUS_EXPIRED);
    expect(changeSheet.data[1][columnMap.denyReason - 1]).toContain('Expired');
    expect(targetSheet.data[1][0]).toBe('Original Name');
  });
});

describe('getActiveSheetEditorEmails_', () => {
  it('returns an empty list when there are no editor rows', () => {
    const sheetEditorsData = [
      ['Email', 'Name', 'Role', 'Notes', 'Disabled'],
    ];

    const sheetEditorsSheet = createMockSheet(SHEET_EDITORS_SHEET_NAME, sheetEditorsData);
    const spreadsheet = createMockSpreadsheet([sheetEditorsSheet]);

    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn(() => spreadsheet),
    };

    expect(getActiveSheetEditorEmails_()).toEqual([]);
  });
});
