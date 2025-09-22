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
      addEditor: jest.fn(),
      addViewer: jest.fn(),
      addCommenter: jest.fn(),
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
      insertSheet: jest.fn(() => mockSheet),
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

    SpreadsheetApp.getActive = jest.fn(() => ({
      getSpreadsheetTimeZone: jest.fn(() => 'UTC'),
    }));
  });

  it('should call DriveApp.addViewer for viewer role', () => {
    // Arrange
    mockGetValue.mockReturnValueOnce('My Folder')
                 .mockReturnValueOnce('folder-id')
                 .mockReturnValueOnce('viewer');

    // Act
    processRow_(2, {});

    // Assert
    expect(mockFolder.addViewer).toHaveBeenCalledWith('mockfoldernameviewer@example.com');
  });

  it('should call DriveApp.addEditor for editor role', () => {
    // Arrange
    mockGetValue.mockReturnValueOnce('My Folder')
                 .mockReturnValueOnce('folder-id')
                 .mockReturnValueOnce('editor');

    // Act
    processRow_(2, {});

    // Assert
    expect(mockFolder.addEditor).toHaveBeenCalledWith('mockfoldernameeditor@example.com');
  });

  it('should throw an error for an unsupported role', () => {
    // Arrange
    mockGetValue.mockReturnValueOnce('My Folder')
                 .mockReturnValueOnce('folder-id')
                 .mockReturnValueOnce('unsupported-role');

    // Act & Assert
    expect(() => processRow_(2, {})).toThrow('Unsupported role: "unsupported-role"');
  });
});
