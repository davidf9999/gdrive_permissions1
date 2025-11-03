// Mocking Google Apps Script's global objects

global.jest = require('jest');

const mockSession = {
  getActiveUser: jest.fn(() => ({
    getEmail: jest.fn(() => 'test.user@example.com'), // Default mock email
  })),
};

const mockLogger = {
  log: jest.fn(),
};

const mockDataValidationBuilder = {
  requireCheckbox: jest.fn().mockReturnThis(),
  build: jest.fn(() => ({}))
};

const mockSpreadsheetApp = {
  getActiveSpreadsheet: jest.fn(() => ({
    getSheetByName: jest.fn(() => ({
      getRange: jest.fn(() => ({
        setDataValidation: jest.fn(),
        getValues: jest.fn(() => [[]]),
        setValue: jest.fn(),
        setValues: jest.fn(),
        setFontWeight: jest.fn(),
      })),
      getLastRow: jest.fn(() => 1),
      setFrozenRows: jest.fn(),
      appendRow: jest.fn(),
      deleteRows: jest.fn(),
    })),
    getSheets: jest.fn(() => ([{
        getRange: jest.fn(() => ({
            setDataValidation: jest.fn(),
            getValues: jest.fn(() => [[]]),
        })),
        getLastRow: jest.fn(() => 1),
    }])),
    insertSheet: jest.fn(() => ({
        getRange: jest.fn(() => ({
            setDataValidation: jest.fn(),
            getValues: jest.fn(() => [[]]),
            setValues: jest.fn(),
            setFontWeight: jest.fn(),
        })),
        getLastRow: jest.fn(() => 1),
        setFrozenRows: jest.fn(),
    }))
  })),
  newDataValidation: jest.fn(() => mockDataValidationBuilder),
  getUi: jest.fn(() => ({
      alert: jest.fn(),
      prompt: jest.fn(),
      ButtonSet: { YES_NO: 'YES_NO', OK: 'OK' },
      Button: { YES: 'YES', NO: 'NO' },
  })),
};

const mockDriveApp = {
  getFolderById: jest.fn(),
  getFoldersByName: jest.fn(),
};

// Assign the mocks to the global object so they are available in tests
global.Session = mockSession;
global.Logger = mockLogger;
global.SpreadsheetApp = mockSpreadsheetApp;
global.DriveApp = mockDriveApp;
