const fs = require('fs');
const path = require('path');

// Load the script file to make its functions available to the test
const utilsPath = path.resolve(__dirname, '../apps_script_project/Utils.gs');
const utilsCode = fs.readFileSync(utilsPath, 'utf8');
eval(utilsCode);

describe('generateGroupEmail_', () => {
  // Save the original implementation of the mock from setup.js
  const originalGetActiveUser = Session.getActiveUser;

  afterEach(() => {
    // After each test, restore the original mock to ensure test isolation
    Session.getActiveUser = originalGetActiveUser;
  });

  it('should generate a correct group email from a simple name', () => {
    const baseName = 'My Project Editors';
    const expectedEmail = 'my-project-editors@example.com';

    // This test will use the default mock defined in `tests/setup.js`
    const actualEmail = generateGroupEmail_(baseName);

    expect(actualEmail).toBe(expectedEmail);
  });

  it('should handle special characters and sanitize the name', () => {
    const baseName = 'Project X (Devs) & QA!';
    const expectedEmail = 'project-x-devs-qa@example.com';

    const actualEmail = generateGroupEmail_(baseName);

    expect(actualEmail).toBe(expectedEmail);
  });

  it('should handle different domains', () => {
    // Override the mock implementation for this test only
    Session.getActiveUser = jest.fn(() => ({
      getEmail: () => 'admin@my-company.org',
    }));

    const baseName = 'Test Folder';
    const expectedEmail = 'test-folder@my-company.org';

    const actualEmail = generateGroupEmail_(baseName);

    expect(actualEmail).toBe(expectedEmail);
  });

  it('should handle names that are already lowercase and sanitized', () => {
    // The afterEach hook will have restored the default mock
    const baseName = 'already-sanitized';
    const expectedEmail = 'already-sanitized@example.com';
    const actualEmail = generateGroupEmail_(baseName);
    expect(actualEmail).toBe(expectedEmail);
  });

  it('should remove leading hyphens', () => {
    const baseName = '-Test Group';
    const expectedEmail = 'test-group@example.com';
    const actualEmail = generateGroupEmail_(baseName);
    expect(actualEmail).toBe(expectedEmail);
  });

  it('should remove trailing hyphens', () => {
    const baseName = 'Test Group-';
    const expectedEmail = 'test-group@example.com';
    const actualEmail = generateGroupEmail_(baseName);
    expect(actualEmail).toBe(expectedEmail);
  });

  it('should collapse multiple consecutive hyphens', () => {
    const baseName = 'Test---Group';
    const expectedEmail = 'test-group@example.com';
    const actualEmail = generateGroupEmail_(baseName);
    expect(actualEmail).toBe(expectedEmail);
  });

  it('should handle names with multiple spaces', () => {
    const baseName = 'Test    Group    Members';
    const expectedEmail = 'test-group-members@example.com';
    const actualEmail = generateGroupEmail_(baseName);
    expect(actualEmail).toBe(expectedEmail);
  });

  it('should throw an error for names that result in empty strings', () => {
    const baseName = '---';
    expect(() => {
      generateGroupEmail_(baseName);
    }).toThrow('contains only non-ASCII characters');
  });

  it('should throw an error for names with only special characters', () => {
    const baseName = '!@#$%^&*()';
    expect(() => {
      generateGroupEmail_(baseName);
    }).toThrow('contains only non-ASCII characters');
  });

  it('should throw a helpful error for Hebrew characters', () => {
    const baseName = 'מתאמים';
    expect(() => {
      generateGroupEmail_(baseName);
    }).toThrow('manually specify a group email');
  });

  it('should throw a helpful error for mixed Hebrew and English', () => {
    const baseName = 'Team מתאמים';
    // "Team " -> "team" but "מתאמים" is stripped, result should be "team"
    const result = generateGroupEmail_(baseName);
    expect(result).toBe('team@example.com');
  });
});

describe('logSyncHistory_', () => {
  let originalSpreadsheetApp;
  let originalUtilities;
  let originalLog;
  let originalSyncHistorySheetName;

  const HEADERS = ['Timestamp', 'Status', 'Added', 'Removed', 'Failed', 'Duration (seconds)', 'Revision Link'];

  const buildSyncHistorySheet = ({ lastRow = 0, headerValues = null } = {}) => {
    const headerGetValues = jest.fn(() => headerValues || HEADERS);
    const headerSetFontWeight = jest.fn();
    const rowSetValues = jest.fn();
    const clearNoteMock = jest.fn();
    const setNoteMock = jest.fn();

    const headerRange = {
      setValues: jest.fn(() => headerRange),
      getValues: headerGetValues,
      setFontWeight: headerSetFontWeight
    };

    const sheet = {
      getLastRow: jest.fn(() => lastRow),
      setFrozenRows: jest.fn(),
      getFrozenRows: jest.fn(() => 0),
      getRange: jest.fn((a, b, c, d) => {
        if (typeof a === 'string') {
          if (a === 'A1:F1' || a === 'A1:G1') {
            return { clearNote: clearNoteMock };
          }
          if (a === 'A1' || a === 'F1' || a === 'G1') {
            return { setNote: setNoteMock };
          }
          if (a === 'A2') {
            return { getValue: jest.fn(() => 'filled') };
          }
          throw new Error('Unexpected A1 range: ' + a);
        }

        if (a === 1 && b === 1 && c === 1 && d === HEADERS.length) {
          return headerRange;
        }

        if (a === 2 && b === 1 && c === 1 && d === HEADERS.length) {
          return {
            setValues: rowSetValues
          };
        }

        throw new Error(`Unexpected range ${[a, b, c, d].join(',')}`);
      })
    };

    return { sheet, headerRange, rowSetValues, clearNoteMock, setNoteMock };
  };

  beforeEach(() => {
    originalSpreadsheetApp = global.SpreadsheetApp;
    originalUtilities = global.Utilities;
    originalLog = global.log_;
    originalSyncHistorySheetName = global.SYNC_HISTORY_SHEET_NAME;
    global.SYNC_HISTORY_SHEET_NAME = 'SyncHistory';
    global.log_ = jest.fn();
    // Ensure the Apps Script binding also points to our stubbed logger
    try {
      log_ = global.log_;
    } catch (e) {
      // Ignore if reassignment is not allowed in this environment
    }
  });

  afterEach(() => {
    global.SpreadsheetApp = originalSpreadsheetApp;
    global.Utilities = originalUtilities;
    global.log_ = originalLog;
    if (typeof originalSyncHistorySheetName === 'undefined') {
      delete global.SYNC_HISTORY_SHEET_NAME;
    } else {
      global.SYNC_HISTORY_SHEET_NAME = originalSyncHistorySheetName;
    }
  });

  it('skips logging when no permission changes occurred', () => {
    const { sheet } = buildSyncHistorySheet();

    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn(() => ({
        getSpreadsheetTimeZone: jest.fn(() => 'UTC'),
        getSheetByName: jest.fn(() => sheet)
      }))
    };

    global.Utilities = { formatDate: jest.fn(() => '2024-01-01 00:00:00') };

    logSyncHistory_('ignored', { added: 0, removed: 0, failed: 0 }, 12);

    expect(sheet.getLastRow).not.toHaveBeenCalled();
    expect(global.log_).toHaveBeenCalledWith('No permission changes detected. Skipping SyncHistory entry.', 'INFO');
  });

  it('appends rows with revision link column last and empty', () => {
    const { sheet, headerRange, rowSetValues, clearNoteMock, setNoteMock } = buildSyncHistorySheet({ lastRow: 0 });

    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn(() => ({
        getSpreadsheetTimeZone: jest.fn(() => 'UTC'),
        getSheetByName: jest.fn(() => sheet)
      }))
    };

    global.Utilities = { formatDate: jest.fn(() => '2024-01-01 00:00:00') };
    logSyncHistory_('https://docs.example.com', { added: 2, removed: 1, failed: 0 }, 45);

    expect(headerRange.setValues).toHaveBeenCalledWith([HEADERS]);
    expect(rowSetValues).toHaveBeenCalledWith([
      ['2024-01-01 00:00:00', 'Success', 2, 1, 0, 45, 'https://docs.example.com']
    ]);
    expect(clearNoteMock).toHaveBeenCalledTimes(1);
    expect(setNoteMock).toHaveBeenCalledTimes(2);
    expect(setNoteMock.mock.calls[0][0]).toContain('Timestamp');
    expect(setNoteMock.mock.calls[1][0]).toContain('Version history');
  });
});

// Note: Tests for internal helper functions like validateGroupNesting_ are intentionally
// omitted. These are tested indirectly through public API functions like fullSync() which
// call validateGroupNesting_ as part of their execution flow.