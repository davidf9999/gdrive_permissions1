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

const mockSpreadsheetApp = {
  getActiveSpreadsheet: jest.fn(() => ({
    getSheetByName: jest.fn(() => ({
      appendRow: jest.fn(),
      getRange: jest.fn(() => ({
        clearContent: jest.fn(),
      })),
      deleteRows: jest.fn(),
      getLastRow: jest.fn(() => 10), // Mock a default last row for log trimming
      getMaxRows: jest.fn(() => 100), // Mock a default max rows
    })),
    getSpreadsheetTimeZone: jest.fn(() => 'America/New_York'), // Default mock time zone
  })),
  getActive: jest.fn(() => ({
    getSpreadsheetTimeZone: jest.fn(() => 'America/New_York'), // Default mock time zone
  })),
};

const mockDriveApp = {
  getFolderById: jest.fn(),
  getFoldersByName: jest.fn(),
};

// Add Utilities mock
const mockUtilities = {
  formatDate: jest.fn((date, timeZone, format) => {
    // Simple mock for formatDate for testing purposes
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} 00:00:00`;
  }),
};

// Assign the mocks to the global object so they are available in tests
global.Session = mockSession;
global.Logger = mockLogger;
global.SpreadsheetApp = mockSpreadsheetApp;
global.DriveApp = mockDriveApp;
global.Utilities = mockUtilities;

const mockDrive = {
  Permissions: {
    insert: jest.fn(),
  },
};
global.Drive = mockDrive;

const mockMailApp = {
  sendEmail: jest.fn(),
};
global.MailApp = mockMailApp;

global.SCRIPT_EXECUTION_MODE = 'DEFAULT'; // Default value for tests
global.LOG_SHEET_NAME = 'Log';
global.TEST_LOG_SHEET_NAME = 'TestLog';
