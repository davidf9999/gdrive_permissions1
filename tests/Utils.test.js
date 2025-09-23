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
    const expectedEmail = 'project-x-devs--qa@example.com';

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
});

describe('isUserAdmin_', () => {
  let mockCache, mockSheet, mockGetValues, mockGetEmail;

  beforeEach(() => {
    // Reset mocks for each test
    jest.clearAllMocks();

    // Setup mock for CacheService
    mockCache = {
      get: jest.fn(),
      put: jest.fn(),
    };
    global.CacheService = {
      getScriptCache: jest.fn(() => mockCache),
    };

    // Setup mock for SpreadsheetApp and its chained calls
    mockGetValues = jest.fn().mockReturnValue([]);
    const mockRange = { getValues: mockGetValues };
    mockSheet = {
      getLastRow: jest.fn().mockReturnValue(1),
      getRange: jest.fn(() => mockRange),
    };
    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn(() => ({
        getSheetByName: jest.fn().mockReturnValue(mockSheet),
        getOwner: jest.fn(() => ({
          getEmail: jest.fn().mockReturnValue('owner@example.com'),
        })),
      })),
    };
    
    // Setup mock for Session
    mockGetEmail = jest.fn().mockReturnValue('test.user@example.com');
    global.Session = {
        getActiveUser: jest.fn(() => ({
            getEmail: mockGetEmail
        }))
    };

    // Setup mock for constants and other globals
    global.ADMINS_SHEET_NAME = 'Admins';
    global.log_ = jest.fn(); // Mock the logger to avoid side effects
  });

  it('should return true if the active user is the owner', () => {
    mockGetEmail.mockReturnValue('owner@example.com');
    expect(isUserAdmin_()).toBe(true);
  });

  it('should return true if the user is in the Admins sheet', () => {
    mockSheet.getLastRow.mockReturnValue(2);
    mockGetValues.mockReturnValue([['test.user@example.com']]);
    expect(isUserAdmin_()).toBe(true);
  });

  it('should return false if the user is not in the Admins sheet', () => {
    mockSheet.getLastRow.mockReturnValue(2);
    mockGetValues.mockReturnValue([['another.user@example.com']]);
    expect(isUserAdmin_()).toBe(false);
  });

  it('should return false if the Admins sheet does not exist', () => {
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName.mockReturnValue(null);
    expect(isUserAdmin_()).toBe(false);
  });

  it('should use the cache on the second call', () => {
    // First call - should read from sheet
    mockSheet.getLastRow.mockReturnValue(2);
    mockGetValues.mockReturnValue([['test.user@example.com']]);
    isUserAdmin_();

    // Reset the mock for getSheetByName before the second call
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName.mockClear();

    // Second call - should read from cache
    mockCache.get.mockReturnValue(JSON.stringify(['test.user@example.com']));
    isUserAdmin_();

    // getSheetByName should NOT have been called on the second run
    expect(SpreadsheetApp.getActiveSpreadsheet().getSheetByName).not.toHaveBeenCalled();
  });
  
  it('should handle case-insensitivity', () => {
    Session.getActiveUser().getEmail.mockReturnValue('TEST.USER@EXAMPLE.COM');
    mockSheet.getLastRow.mockReturnValue(2);
    mockGetValues.mockReturnValue([['test.user@example.com']]);
    expect(isUserAdmin_()).toBe(true);
  });
});
