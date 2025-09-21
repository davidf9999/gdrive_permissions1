const fs = require('fs');
const path = require('path');

// Define script execution mode for testing
const SCRIPT_EXECUTION_MODE = 'TEST';
const TEST_LOG_SHEET_NAME = 'TestLog';
const LOG_SHEET_NAME = 'Log';
const CONFIG_SHEET_NAME = 'Config';
const DEFAULT_MAX_LOG_LENGTH = 1000;


// Load the script files to make their functions available to the test
const corePath = path.resolve(__dirname, '../apps_script_project/Core.gs');
const coreCode = fs.readFileSync(corePath, 'utf8');
eval(coreCode);

const utilsPath = path.resolve(__dirname, '../apps_script_project/Utils.gs');
const utilsCode = fs.readFileSync(utilsPath, 'utf8');
eval(utilsCode);

describe('setFolderPermission_', () => {
  let mockFolder;
  let mockGetSheetByName;
  let mockGetRange;
  let mockGetValues;
  let mockLogSheet;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock global objects
    global.CacheService = {
      getScriptCache: jest.fn(() => ({
        get: jest.fn(),
        put: jest.fn(),
      })),
    };
    global.Utilities = {
      formatDate: jest.fn(),
    };
    global.Session = {
      getActiveUser: jest.fn(() => ({
        getEmail: jest.fn(() => 'test@example.com'),
      })),
    };

    // Mock the folder object and its methods
    mockFolder = {
      addEditor: jest.fn(),
      addViewer: jest.fn(),
      addCommenter: jest.fn(),
      getName: () => 'Mock Folder',
    };
    DriveApp.getFolderById.mockReturnValue(mockFolder);

    // Mock the SpreadsheetApp chain to control config sheet values
    mockGetValues = jest.fn().mockReturnValue([]);
    mockGetRange = jest.fn(() => ({ getValues: mockGetValues }));
    mockLogSheet = {
      appendRow: jest.fn(),
      getLastRow: jest.fn().mockReturnValue(1),
      deleteRows: jest.fn(),
    };
    mockGetSheetByName = jest.fn((sheetName) => {
      if (sheetName === TEST_LOG_SHEET_NAME) {
        return mockLogSheet;
      }
      if (sheetName === CONFIG_SHEET_NAME) {
        return {
          getRange: mockGetRange,
          getLastRow: jest.fn().mockReturnValue(2),
        };
      }
      return {
        getRange: mockGetRange,
      };
    });
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue({
      getSheetByName: mockGetSheetByName,
    });
  });

  it('should send notifications by default if setting is TRUE', () => {
    mockGetValues.mockReturnValue([['SendShareNotifications', 'TRUE']]);

    setFolderPermission_('folderId', 'group@example.com', 'editor');
    expect(mockFolder.addEditor).toHaveBeenCalledWith('group@example.com', true);
  });

  it('should not send notifications if setting is FALSE', () => {
    mockGetValues.mockReturnValue([['SendShareNotifications', 'FALSE']]);

    setFolderPermission_('folderId', 'group@example.com', 'viewer');
    expect(mockFolder.addViewer).toHaveBeenCalledWith('group@example.com', false);
  });

  it('should send notifications if setting is missing', () => {
    mockGetValues.mockReturnValue([]); // No setting found

    setFolderPermission_('folderId', 'group@example.com', 'commenter');
    expect(mockFolder.addCommenter).toHaveBeenCalledWith('group@example.com', true);
  });

  it('should handle unsupported roles', () => {
    expect(() => {
      setFolderPermission_('folderId', 'group@example.com', 'unsupported');
    }).toThrow('Unsupported role: "unsupported"');
  });
});
