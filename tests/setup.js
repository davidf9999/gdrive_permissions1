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
    getSheetByName: jest.fn(),
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
