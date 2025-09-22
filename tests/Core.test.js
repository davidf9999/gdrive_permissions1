const fs = require('fs');
const path = require('path');

// --- Test Configuration ---
const SCRIPT_EXECUTION_MODE = 'TEST';

// --- File Loading and Mocking ---
let codeJsContent = fs.readFileSync(path.resolve(__dirname, '../apps_script_project/Code.js'), 'utf8');
codeJsContent = codeJsContent.replace(/const /g, 'global.');
eval(codeJsContent);
eval(fs.readFileSync(path.resolve(__dirname, '../apps_script_project/Utils.gs'), 'utf8'));
const coreCode = fs.readFileSync(path.resolve(__dirname, '../apps_script_project/Core.gs'), 'utf8');
eval(coreCode);

describe('processRow_', () => {
  let mockSheet, mockGetRange, mockGetValue, mockSetValue, mockGetValues, mockFolder, mockConfigSheet, mockRange;

  beforeEach(() => {
    jest.clearAllMocks();

    // --- Mock GAS Global Objects ---
    global.CacheService = { getScriptCache: jest.fn(() => ({ get: jest.fn(), put: jest.fn() })) };
    global.Utilities = { formatDate: jest.fn(date => date.toISOString()) };
    global.Session = { getActiveUser: jest.fn(() => ({ getEmail: jest.fn(() => 'test.user@example.com') })) };
    global.AdminDirectory = { Groups: { get: jest.fn(), insert: jest.fn() }, Members: { list: jest.fn(() => ({ members: [] })) } };

    // --- Mock DriveApp ---
    mockFolder = {
      getId: jest.fn(() => 'mockFolderId'),
      getName: jest.fn(() => 'mockFolderName'),
      getUrl: jest.fn(() => 'http://mock.folder.url'),
    };
    DriveApp.getFolderById.mockReturnValue(mockFolder);
    DriveApp.getFoldersByName.mockReturnValue({ hasNext: jest.fn(() => false), next: jest.fn() });
    DriveApp.createFolder = jest.fn().mockReturnValue(mockFolder);

    // --- Mock SpreadsheetApp ---
    mockGetValue = jest.fn();
    mockSetValue = jest.fn();
    mockGetValues = jest.fn(() => []);
    mockRange = { getValue: mockGetValue, setValue: mockSetValue, getValues: mockGetValues };
    mockGetRange = jest.fn(() => mockRange);
    mockSheet = {
      getRange: mockGetRange,
      insertSheet: jest.fn(() => mockSheet), // Return itself for chaining
      getSheets: jest.fn(() => []),
      setFrozenRows: jest.fn(),
      appendRow: jest.fn(),
      getLastRow: jest.fn(() => 1),
      deleteRows: jest.fn(),
    };
    mockConfigSheet = {
      getRange: jest.fn(() => mockRange),
      getLastRow: jest.fn().mockReturnValue(2),
    };
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue({
      getSheetByName: jest.fn(name => {
        if (name === global.CONFIG_SHEET_NAME) return mockConfigSheet;
        return mockSheet;
      }),
      getSpreadsheetTimeZone: jest.fn(() => 'UTC'),
    });
  });

  it('should send manual notifications to newly added users when enabled', () => {
    // Arrange
    mockGetValue.mockReturnValue('someValue');
    mockGetValues.mockReturnValue([['new.user@example.com']]);
    AdminDirectory.Members.list.mockReturnValueOnce({ members: [] }); // No initial members

    // Act
    processRow_(2, { addOnly: true });

    // Assert
    expect(MailApp.sendEmail).toHaveBeenCalledTimes(1);
    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'new.user@example.com',
      'Folder shared with you: "mockFolderName"',
      'The folder \'mockFolderName\' has been shared with you. You can access it here: http://mock.folder.url'
    );
  });

  it('should NOT send manual notifications if the setting is FALSE', () => {
    // Arrange
    mockConfigSheet.getRange().getValues.mockReturnValue([['SendShareNotifications', 'FALSE']]);
    mockGetValue.mockReturnValue('someValue');
    mockGetValues.mockReturnValue([['new.user@example.com']]);
    AdminDirectory.Members.list.mockReturnValueOnce({ members: [] });

    // Act
    processRow_(2, { addOnly: true });

    // Assert
    expect(MailApp.sendEmail).not.toHaveBeenCalled();
  });

  it('should call Drive.Permissions.insert with correct parameters', () => {
    // Arrange
    mockGetValue.mockReturnValueOnce('My Folder')
                 .mockReturnValueOnce('folder-id')
                 .mockReturnValueOnce('viewer');

    // Act
    processRow_(2, {});

    // Assert
    expect(Drive.Permissions.insert).toHaveBeenCalledWith(
      { role: 'reader', type: 'group', value: 'my-folder_viewer@example.com' },
      'mockFolderId',
      { sendNotificationEmails: true }
    );
  });
});