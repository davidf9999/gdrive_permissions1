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
  let mockManagedSheet, mockFolder, mockConfigSheet, sheetRegistry, mockSpreadsheet, mockUserSheet, mockUi;
  let currentUserSheetName, currentFolderName, managedRow;

  beforeEach(() => {
    jest.clearAllMocks();

    // --- Mock GAS Global Objects ---
    global.CacheService = { getScriptCache: jest.fn(() => ({ get: jest.fn(), put: jest.fn() })) };
    global.Utilities = { formatDate: jest.fn(date => date.toISOString()), sleep: jest.fn() };
    global.Session = { getActiveUser: jest.fn(() => ({ getEmail: jest.fn(() => 'test.user@example.com') })) };
    global.getConfigValue_ = jest.fn(() => false);
    global.lockSheetForEdits_ = jest.fn();
    global.unlockSheetForEdits_ = jest.fn();
    lockSheetForEdits_ = global.lockSheetForEdits_;
    unlockSheetForEdits_ = global.unlockSheetForEdits_;
    global.AdminDirectory = { Groups: { get: jest.fn(), insert: jest.fn() }, Members: { list: jest.fn(() => ({ members: [] })) } };
    global.DriveApp.Permission = { EDIT: 'EDIT', VIEW: 'VIEW', NONE: 'NONE' };

    // --- Mock DriveApp ---
    currentFolderName = 'mockFolderName';
    mockFolder = {
      getId: jest.fn(() => 'mockFolderId'),
      getName: jest.fn(() => currentFolderName),
      getUrl: jest.fn(() => 'http://mock.folder.url'),
      addEditor: jest.fn(),
      addViewer: jest.fn(),
      addCommenter: jest.fn(),
      setName: jest.fn(newName => { currentFolderName = newName; }),
      getAccess: jest.fn(email => DriveApp.Permission.NONE),
      getEditors: jest.fn(() => []),
      getViewers: jest.fn(() => []),
      getCommenters: jest.fn(() => []),
    };
    DriveApp.getFolderById.mockReturnValue(mockFolder);
    DriveApp.getFoldersByName.mockReturnValue({ hasNext: jest.fn(() => false), next: jest.fn() });
    DriveApp.createFolder = jest.fn().mockReturnValue(mockFolder);

    // --- Mock SpreadsheetApp ---
    managedRow = {
      folderName: 'mockFolderName',
      folderId: 'folder-id',
      role: 'viewer',
      userSheetName: '',
      groupEmail: '',
      status: '',
      url: '',
      lastSynced: ''
    };

    const createCellRange = (key) => ({
      getValue: jest.fn(() => managedRow[key]),
      setValue: jest.fn(value => { managedRow[key] = value; }),
      getValues: jest.fn(() => [[managedRow[key]]]),
      setValues: jest.fn(values => {
        managedRow[key] = Array.isArray(values) && values.length > 0 ? values[0][0] : values;
      })
    });

    mockManagedSheet = {
      getName: jest.fn(() => global.MANAGED_FOLDERS_SHEET_NAME),
      getRange: jest.fn((row, column, numRows, numCols) => {
        if (row === 2 && column === 1 && numRows === 1 && numCols === 2) {
          return {
            getValues: jest.fn(() => [[managedRow.folderName, managedRow.folderId]])
          };
        }
        if (column === global.USER_SHEET_NAME_COL) {
          return createCellRange('userSheetName');
        }
        if (column === global.GROUP_EMAIL_COL) {
          return createCellRange('groupEmail');
        }
        if (column === global.STATUS_COL) {
          return createCellRange('status');
        }
        if (column === global.FOLDER_NAME_COL) {
          return createCellRange('folderName');
        }
        if (column === global.FOLDER_ID_COL) {
          return createCellRange('folderId');
        }
        if (column === global.ROLE_COL) {
          return createCellRange('role');
        }
        if (column === global.URL_COL) {
          return createCellRange('url');
        }
        if (column === global.LAST_SYNCED_COL) {
          return createCellRange('lastSynced');
        }
        return createCellRange('status');
      }),
      insertSheet: jest.fn(() => mockManagedSheet),
      getSheets: jest.fn(() => []),
      setFrozenRows: jest.fn(),
      appendRow: jest.fn(),
      getLastRow: jest.fn(() => 1),
      deleteRows: jest.fn(),
    };

    mockConfigSheet = {
      getRange: jest.fn(() => ({
        getValue: jest.fn(),
        setValue: jest.fn(),
        getValues: jest.fn(() => [[]]),
        setValues: jest.fn()
      })),
      getLastRow: jest.fn().mockReturnValue(2),
    };

    currentUserSheetName = 'mockFolderName_viewer';
    sheetRegistry = new Map();
    const createSheetRange = () => ({
      getValue: jest.fn(),
      setValue: jest.fn(),
      getValues: jest.fn(() => []),
      setValues: jest.fn(),
      setFontWeight: jest.fn(),
      setDataValidation: jest.fn(), // Fix: Add the missing mock function
      getCell: jest.fn(() => ({ setValue: jest.fn() })),
    });

    mockUserSheet = {
      setName: jest.fn(newName => {
        sheetRegistry.delete(currentUserSheetName);
        currentUserSheetName = newName;
        sheetRegistry.set(newName, mockUserSheet);
      }),
      getName: jest.fn(() => currentUserSheetName),
      getLastRow: jest.fn(() => 1),
      getRange: jest.fn(() => createSheetRange()),
      setFrozenRows: jest.fn(),
    };

    sheetRegistry.set(global.MANAGED_FOLDERS_SHEET_NAME, mockManagedSheet);
    sheetRegistry.set(global.CONFIG_SHEET_NAME, mockConfigSheet);
    sheetRegistry.set(currentUserSheetName, mockUserSheet);

    managedRow.userSheetName = currentUserSheetName;

    const getSheetByName = jest.fn(name => sheetRegistry.get(name) || null);
    mockSpreadsheet = {
      getSheetByName: getSheetByName,
      getSpreadsheetTimeZone: jest.fn(() => 'UTC'),
      getSheets: jest.fn(() => Array.from(sheetRegistry.values())),
      insertSheet: jest.fn(name => {
        let sheetName = name;
        const newSheet = {
          setName: jest.fn(newName => {
            sheetRegistry.delete(sheetName);
            sheetName = newName;
            sheetRegistry.set(sheetName, newSheet);
          }),
          getName: jest.fn(() => sheetName),
          getLastRow: jest.fn(() => 1),
          getRange: jest.fn(() => createSheetRange()),
          setFrozenRows: jest.fn(),
        };
        sheetRegistry.set(sheetName, newSheet);
        return newSheet;
      }),
      toast: jest.fn(),
    };

    mockUi = {
      alert: jest.fn(() => 'YES'),
      ButtonSet: { YES_NO: 'YES_NO' },
      Button: { YES: 'YES', NO: 'NO' },
    };

    SpreadsheetApp.getUi = jest.fn(() => mockUi);
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSpreadsheet);
    SpreadsheetApp.getActive = jest.fn(() => ({
      getSpreadsheetTimeZone: jest.fn(() => 'UTC'),
    }));
  });

  it('should call DriveApp.addViewer for viewer role', () => {
    managedRow.userSheetName = '';
    managedRow.groupEmail = '';
    managedRow.role = 'viewer';

    processRow_(2, {});

    expect(mockFolder.addViewer).toHaveBeenCalledWith('mockfoldernameviewer@example.com');
  });

  it('should call DriveApp.addEditor for editor role', () => {
    managedRow.role = 'editor';
    managedRow.userSheetName = '';
    managedRow.groupEmail = '';

    processRow_(2, {});

    expect(mockFolder.addEditor).toHaveBeenCalledWith('mockfoldernameeditor@example.com');
  });

  it('locks and unlocks only the relevant sheets when locking is enabled', () => {
    global.getConfigValue_.mockReturnValue(true);

    processRow_(2, {});

    expect(global.lockSheetForEdits_).toHaveBeenCalledTimes(2);
    expect(global.lockSheetForEdits_.mock.calls).toEqual([
      [mockManagedSheet],
      [mockUserSheet],
    ]);

    expect(global.unlockSheetForEdits_).toHaveBeenCalledTimes(2);
    const unlockedSheets = global.unlockSheetForEdits_.mock.calls.map(call => call[0]);
    expect(unlockedSheets).toEqual(expect.arrayContaining([mockManagedSheet, mockUserSheet]));
  });

  it('renames the folder and existing user sheet when the configured name changes', () => {
    sheetRegistry.delete(currentUserSheetName);
    currentUserSheetName = 'LegacySheet_viewer';
    sheetRegistry.set(currentUserSheetName, mockUserSheet);

    managedRow.folderName = 'New Folder Name';
    managedRow.role = 'viewer';
    managedRow.userSheetName = currentUserSheetName;
    managedRow.groupEmail = 'existing-group@example.com';

    processRow_(2, {});

    expect(mockUi.alert).toHaveBeenCalledWith(
      'Folder name mismatch',
      expect.stringContaining('New Folder Name'),
      mockUi.ButtonSet.YES_NO
    );
    expect(mockFolder.setName).toHaveBeenCalledWith('New Folder Name');
    expect(mockUserSheet.setName).toHaveBeenCalledWith('New Folder Name_viewer');
    expect(mockFolder.addViewer).toHaveBeenCalledWith('existing-group@example.com');
  });

  it('should throw an error for an unsupported role', () => {
    managedRow.role = 'unsupported-role';
    managedRow.userSheetName = '';
    managedRow.groupEmail = '';

    expect(() => processRow_(2, {})).toThrow('Unsupported role: "unsupported-role"');
  });

  it('renames a folder when retrieved by ID with a different name', () => {
    currentFolderName = 'Old Folder Name';

    const folder = getOrCreateFolder_('Renamed Folder', 'folder-id');

    expect(mockFolder.setName).toHaveBeenCalledWith('Renamed Folder');
    expect(folder.getName()).toBe('Renamed Folder');
  });

  it('throws when a folder rename is declined by the user', () => {
    currentFolderName = 'Original Name';
    mockUi.alert.mockReturnValue(mockUi.Button.NO);

    expect(() => getOrCreateFolder_('Desired Name', 'folder-id')).toThrow('Folder name mismatch for ID "folder-id"');
    expect(mockFolder.setName).not.toHaveBeenCalled();
  });
});

describe('syncGroupMembership_', () => {
  let originalLog, originalFetchMembers;

  beforeEach(() => {
    jest.clearAllMocks();
    originalLog = log_;
    originalFetchMembers = fetchAllGroupMembers_;
    log_ = jest.fn();
    fetchAllGroupMembers_ = jest.fn(() => []);
  });

  afterEach(() => {
    log_ = originalLog;
    fetchAllGroupMembers_ = originalFetchMembers;
  });

  function mockSpreadsheetForUserSheet(userSheetName, values) {
    const mockUserSheet = {
      getLastRow: jest.fn(() => values.length + 1),
      getRange: jest.fn(() => ({
        getValues: jest.fn(() => values)
      }))
    };

    const mockSpreadsheet = {
      getSheetByName: jest.fn(name => {
        if (name === userSheetName) {
          return mockUserSheet;
        }
        return null;
      }),
      getSpreadsheetTimeZone: jest.fn(() => 'UTC')
    };

    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSpreadsheet);
    return mockUserSheet;
  }

  it('logs an error when a row contains more than one email address', () => {
    const values = [
      ['valid@example.com'],
      ['first@example.com second@example.com'],
      ['']
    ];

    mockSpreadsheetForUserSheet('TeamSheet_Editor', values);

    syncGroupMembership_('group@example.com', 'TeamSheet_Editor', { returnPlanOnly: true });

    expect(fetchAllGroupMembers_).toHaveBeenCalledWith('group@example.com');
    expect(log_).toHaveBeenCalledWith(
      expect.stringContaining('multiple email addresses'),
      'ERROR'
    );
    expect(
      log_.mock.calls.some(call => call[0].includes('Found 1 active emails in sheet "TeamSheet_Editor"'))
    ).toBe(true);
  });

  it('accepts a single valid trimmed email and skips logging errors', () => {
    const values = [
      ['   Valid.User@Example.COM   '],
      ['   ']
    ];

    mockSpreadsheetForUserSheet('TeamSheet_Viewer', values);

    syncGroupMembership_('group@example.com', 'TeamSheet_Viewer', { returnPlanOnly: true });

    expect(
      log_.mock.calls.some(call => call[0].includes('Found 1 active emails in sheet "TeamSheet_Viewer"'))
    ).toBe(true);
    const errorCalls = log_.mock.calls.filter(call => call[1] === 'ERROR');
    expect(errorCalls).toHaveLength(0);
  });

  it('skips disabled rows while keeping the email for auditing', () => {
    const values = [
      ['enabled@example.com', ''],
      ['disabled@example.com', true],
      ['another.disabled@example.com', 'yes']
    ];

    mockSpreadsheetForUserSheet('TeamSheet_Disabled', values);

    syncGroupMembership_('group@example.com', 'TeamSheet_Disabled', { returnPlanOnly: true });

    expect(
      log_.mock.calls.some(call => call[0].includes('Found 1 active emails in sheet "TeamSheet_Disabled" (skipped 2 disabled entries).'))
    ).toBe(true);
  });
});
