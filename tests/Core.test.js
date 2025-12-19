const fs = require('fs');
const path = require('path');

// --- Test Configuration ---
const SCRIPT_EXECUTION_MODE = 'TEST';

// --- Helper to load GAS files into global scope ---
function loadGasFileIntoGlobal(filePath) {
  const content = fs.readFileSync(path.resolve(__dirname, filePath), 'utf8');

  // Transform to expose everything in global scope
  // Replace 'function name(' with 'global.name = function('
  let transformed = content.replace(/^function (\w+)\s*\(/gm, 'global.$1 = function $1(');
  // Replace 'const name =' with 'global.name ='
  transformed = transformed.replace(/^const (\w+)\s*=/gm, 'global.$1 =');

  // Evaluate transformed content
  eval(transformed);
}

// --- File Loading and Mocking ---
let codeJsContent = fs.readFileSync(path.resolve(__dirname, '../apps_script_project/Code.js'), 'utf8');
codeJsContent = codeJsContent.replace(/const /g, 'global.');
eval(codeJsContent);

// Load required GAS files
loadGasFileIntoGlobal('../apps_script_project/Utils.gs');
loadGasFileIntoGlobal('../apps_script_project/Core.gs');

describe('_buildSyncJobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.log_ = jest.fn();
  });

  function createSheetWithData(data, statusUpdates) {
    return {
      getRange: jest.fn((row, column, numRows, numCols) => {
        if (numRows && numCols) {
          return {
            getValues: jest.fn(() => data)
          };
        }
        return {
          setValue: jest.fn(value => {
            statusUpdates.push({ row, column, value });
          })
        };
      })
    };
  }

  const headers = {
    foldername: 1,
    folderid: 2,
    role: 3,
    groupemail: 4,
    usersheetname: 5,
    status: 7
  };

  it('builds jobs for valid rows and skips empty rows', () => {
    const statusUpdates = [];
    const data = [
      ['Folder A', 'id-a', 'viewer', 'group-a@example.com', 'Folder A_viewer', '', ''],
      ['', '', '', '', '', '', ''],
      ['Folder B', 'id-b', 'editor', 'group-b@example.com', 'Folder B_editor', '', '']
    ];
    const sheet = createSheetWithData(data, statusUpdates);

    const jobs = _buildSyncJobs(sheet, 4, {}, headers);

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      rowIndex: 2,
      folderName: 'Folder A',
      folderId: 'id-a',
      role: 'viewer',
      existingGroupEmail: 'group-a@example.com',
      existingUserSheetName: 'Folder A_viewer'
    });
    expect(jobs[1]).toMatchObject({
      rowIndex: 4,
      folderName: 'Folder B',
      folderId: 'id-b',
      role: 'editor',
      existingGroupEmail: 'group-b@example.com',
      existingUserSheetName: 'Folder B_editor'
    });
    expect(statusUpdates).toHaveLength(0);
  });

  it('filters jobs by prefix and row indexes when configured', () => {
    const statusUpdates = [];
    const data = [
      ['Alpha Folder', 'id-a', 'viewer', 'group-a@example.com', 'Alpha_viewer', '', ''],
      ['Beta Folder', 'id-b', 'viewer', 'group-b@example.com', 'Beta_viewer', '', '']
    ];
    const sheet = createSheetWithData(data, statusUpdates);

    const jobs = _buildSyncJobs(sheet, 3, { onlySyncPrefixes: ['Alpha'], onlySyncRowIndexes: [2] }, headers);

    expect(jobs).toHaveLength(1);
    expect(jobs[0].folderName).toBe('Alpha Folder');
  });

  it('marks rows missing roles as errors', () => {
    const statusUpdates = [];
    const data = [
      ['Folder Missing Role', 'id-missing', '', 'group-missing@example.com', 'Missing_viewer', '', '']
    ];
    const sheet = createSheetWithData(data, statusUpdates);

    const jobs = _buildSyncJobs(sheet, 2, {}, headers);

    expect(jobs).toHaveLength(0);
    expect(statusUpdates).toEqual([
      { row: 2, column: 7, value: 'Error: Role is missing' }
    ]);
  });
});

describe('syncGroupMembership_', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    global.CacheService = {
      getScriptCache: jest.fn(() => ({
        get: jest.fn(() => null),
        put: jest.fn()
      }))
    };
    global.Utilities = { sleep: jest.fn() };
    global.log_ = jest.fn();
    global.fetchAllGroupMembers_ = jest.fn(() => []);
    global.validateUserSheetEmails_ = jest.fn(() => ({ valid: true, error: null }));
    global._executeMembershipChunkWithRetries_ = jest.fn(() => ({ added: 0, removed: 0, failed: 0 }));
    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn()
    };
  });

  function mockSpreadsheetForUserSheet(userSheetName, values) {
    const mockUserSheet = {
      getLastRow: jest.fn(() => values.length + 1),
      getRange: jest.fn(() => ({
        getValues: jest.fn(() => values)
      }))
    };

    const mockSpreadsheet = {
      getSheetByName: jest.fn(name => (name === userSheetName ? mockUserSheet : null))
    };

    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSpreadsheet);
    return mockUserSheet;
  }

  it('throws when user sheet validation fails', () => {
    mockSpreadsheetForUserSheet('TeamSheet_Editor', [['valid@example.com']]);
    validateUserSheetEmails_.mockReturnValue({ valid: false, error: 'Duplicate emails found' });

    expect(() => syncGroupMembership_('group@example.com', 'TeamSheet_Editor')).toThrow(
      'VALIDATION ERROR in sheet "TeamSheet_Editor": Duplicate emails found'
    );
  });

  it('returns an empty summary when no membership changes are required', () => {
    mockSpreadsheetForUserSheet('TeamSheet_Viewer', [['member@example.com', '']]);
    fetchAllGroupMembers_.mockReturnValue([{ email: 'member@example.com', role: 'MEMBER' }]);

    const summary = syncGroupMembership_('group@example.com', 'TeamSheet_Viewer');

    expect(summary).toEqual({ added: 0, removed: 0, failed: 0 });
    expect(_executeMembershipChunkWithRetries_).not.toHaveBeenCalled();
  });
});
