const fs = require('fs');
const path = require('path');

// Mocks are defined in setup.js and attached to the global object.
// We don't need to import them directly here.

describe('SheetEditors Sync', () => {
  beforeAll(() => {
    const loadGasFileAsGlobal = (filePath) => {
      let content = fs.readFileSync(path.resolve(__dirname, filePath), 'utf8');
      content = content.replace(/function\s+([a-zA-Z0-9_]+)\s*\(/g, 'global.$1 = function $1(');
      content = content.replace(/const\s+([a-zA-Z0-9_]+)\s*=/g, 'global.$1 =');
      eval(content);
    };

    // Load all script files needed for this test.
    loadGasFileAsGlobal('../apps_script_project/Code.js');
    loadGasFileAsGlobal('../apps_script_project/Utils.gs');
    loadGasFileAsGlobal('../apps_script_project/Core.gs');
    loadGasFileAsGlobal('../apps_script_project/Sync.gs');
  });

  beforeEach(() => {
    // Reset mocks before each test for isolation
    jest.clearAllMocks();

    // Mock getConfiguration to return necessary values for this test
    global.getConfiguration_ = jest.fn().mockReturnValue({
      MembershipBatchSize: 10,
    });
    global.log_ = jest.fn();
    global.isUserRowDisabled_ = jest.fn((val) => val === true);

    // This is a simplified mock. The refactored function doesn't use getConfigValue_ for the email anymore.
    global.getConfigValue_ = jest.fn((key, defaultValue) => {
      const config = { MembershipBatchSize: 10 };
      return config[key] !== undefined ? config[key] : defaultValue;
    });
    global.generateGroupEmail_ = jest.fn((name) => `${name}@test.com`);
    global.shouldSkipGroupOps_ = jest.fn().mockReturnValue(false);
    global._executeMembershipChunkWithRetries_ = jest.fn((requests) => {
      const summary = { added: 0, removed: 0, failed: 0 };
      requests.forEach(req => {
        if (req.operation === 'add') summary.added++;
        if (req.operation === 'remove') summary.removed++;
      });
      return summary;
    });

    // Since setup.js creates general mocks, we specify behavior here.
    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn().mockReturnThis(),
      getSheetByName: jest.fn(),
      getEditors: jest.fn().mockReturnValue([]),
      getOwner: jest.fn().mockReturnValue(null),
      addEditors: jest.fn(),
      removeEditor: jest.fn(),
      getUi: jest.fn(() => ({
        alert: jest.fn(),
      })),
      getActive: jest.fn(() => ({
        getSpreadsheetTimeZone: jest.fn(() => 'America/New_York'),
      })),
    };
    global.AdminDirectory = {
      Members: { list: jest.fn(), remove: jest.fn(), insert: jest.fn() }
    };
    global.Utilities = {
        sleep: jest.fn(),
        formatDate: jest.fn(() => new Date()),
    };
    global.fetchAllGroupMembers_ = jest.fn().mockReturnValue([]);
    global.getOrCreateGroup_ = jest.fn((email, name) => ({ group: { id: 'group-id' }, wasNewlyCreated: false }));
    global.SCRIPT_EXECUTION_MODE = 'TEST';
    global.showTestMessage_ = jest.fn();
  });

  // Helper to create the specific mocks for UserGroups and SheetEditors_G sheets
  const setupSheetMocks = (sheetEditorsData, userGroupsRowData) => {
    const mockSheetEditorsSheet = {
      getName: () => global.SHEET_EDITORS_SHEET_NAME,
      getRange: jest.fn().mockImplementation((range) => {
        // This mock is for the SheetEditors_G sheet, which is simple.
        // It's just reading a list of users.
        return { getValues: jest.fn().mockReturnValue(sheetEditorsData) };
      }),
      getLastRow: () => sheetEditorsData.length + 1,
    };

    const mockUserGroupsSheet = {
      getName: () => global.USER_GROUPS_SHEET_NAME,
      getRange: jest.fn().mockImplementation((row, col, numRows, numCols) => {
        // Handle A1 notation calls by converting them (simplified)
        if (typeof row === 'string') {
          if (row === 'A:A') {
             return { getValues: () => [['GroupName'], [userGroupsRowData.groupName]] };
          }
           return { getValue: jest.fn(), setValue: jest.fn(), getValues: jest.fn(() => [[]]) };
        }

        // Handle getHeaderMap_ call: getRange(1, 1, 1, lastColumn)
        if (row === 1 && col === 1 && numRows === 1) {
          return { getValues: jest.fn().mockReturnValue([['GroupName', 'GroupEmail', 'Group Admin Link', 'Last Synced', 'Status', 'Delete']]) };
        }
        
        // Handle findRowByValue_ call: getRange(1, col, lastRow, 1)
        if (col === 1 && numRows > 1 && numCols === 1) {
          return { getValues: jest.fn().mockReturnValue([['GroupName'], [userGroupsRowData.groupName]]) };
        }

        // Handle specific cell writes/reads based on the refactored syncSheetEditors
        if (row === userGroupsRowData.row) {
            if (col === userGroupsRowData.statusCol) return { setValue: userGroupsRowData.statusCellMock };
            if (col === userGroupsRowData.lastSyncedCol) return { setValue: userGroupsRowData.lastSyncedCellMock };
            if (col === userGroupsRowData.adminLinkCol) return { setValue: userGroupsRowData.groupLinkCellMock };
            if (col === userGroupsRowData.groupEmailCol) return { getValue: userGroupsRowData.groupEmailCellMock.getValue, setValue: userGroupsRowData.groupEmailCellMock.setValue };
        }

        // Default fallback for any other call
        return { getValue: jest.fn(), setValue: jest.fn(), getValues: jest.fn(() => [[]]) };
      }),
      getLastColumn: () => 6, // Mock the number of columns
      getLastRow: () => 2,
    };
    
    global.SpreadsheetApp.getSheetByName.mockImplementation(sheetName => {
      if (sheetName === global.SHEET_EDITORS_SHEET_NAME) return mockSheetEditorsSheet;
      if (sheetName === global.USER_GROUPS_SHEET_NAME) return mockUserGroupsSheet;
      return null;
    });
  };

  it('should remove a disabled user from the Sheet Editors group (Full Sync mode)', () => {
    const disabledUserEmail = 'disabled.user@test.com';
    const activeUserEmail = 'active.user@test.com';

    // --- GIVEN ---
    const sheetEditorsData = [
        [activeUserEmail, false], // Active user
        [disabledUserEmail, true], // Disabled user
    ];
    // These column numbers match the header map that will be generated by getHeaderMap_
    const userGroupsMocks = {
        row: 2,
        groupName: global.SHEET_EDITORS_SHEET_NAME,
        groupEmailCol: 2,
        adminLinkCol: 3,
        lastSyncedCol: 4,
        statusCol: 5,
        statusCellMock: jest.fn(),
        lastSyncedCellMock: jest.fn(),
        groupLinkCellMock: jest.fn(),
        groupEmailCellMock: {
            getValue: jest.fn().mockReturnValue('sheet-editors@test.com'),
            setValue: jest.fn(),
        },
    };
    setupSheetMocks(sheetEditorsData, userGroupsMocks);

    global.SpreadsheetApp.getEditors.mockReturnValue([
        { getEmail: () => activeUserEmail }, { getEmail: () => disabledUserEmail },
    ]);
    global.SpreadsheetApp.getOwner.mockReturnValue({ getEmail: () => 'owner@test.com' });
    global.fetchAllGroupMembers_.mockReturnValue([
        { email: activeUserEmail, role: 'MEMBER' }, { email: disabledUserEmail, role: 'MEMBER' },
    ]);

    // --- WHEN ---
    global.syncSheetEditors();

    // --- THEN ---
    const membershipCalls = global._executeMembershipChunkWithRetries_.mock.calls;
    const removalCall = membershipCalls.find(call => call[0] && call[0].some(req => req.method === 'DELETE'));
    expect(removalCall).toBeDefined();
    const removedEmails = removalCall[0].map(req => req.email);
    expect(removedEmails).toContain(disabledUserEmail);
    expect(removedEmails).not.toContain(activeUserEmail);

    expect(global.SpreadsheetApp.removeEditor).toHaveBeenCalledWith(disabledUserEmail);
    expect(global.SpreadsheetApp.removeEditor).not.toHaveBeenCalledWith(activeUserEmail);

    // Verify status is written to the UserGroups sheet mock
    expect(userGroupsMocks.statusCellMock).toHaveBeenCalledWith('OK');
    expect(userGroupsMocks.lastSyncedCellMock).toHaveBeenCalled();
  });

  it('should NOT remove a disabled user in AutoSync mode (addOnly: true)', () => {
    const disabledUserEmail = 'disabled.user@test.com';
    const activeUserEmail = 'active.user@test.com';
    const newUserEmail = 'new.user@test.com';

    // --- GIVEN ---
    const sheetEditorsData = [
        [activeUserEmail, false],
        [newUserEmail, false],
        [disabledUserEmail, true],
    ];
     const userGroupsMocks = {
        row: 2,
        groupName: global.SHEET_EDITORS_SHEET_NAME,
        groupEmailCol: 2,
        adminLinkCol: 3,
        lastSyncedCol: 4,
        statusCol: 5,
        statusCellMock: jest.fn(),
        lastSyncedCellMock: jest.fn(),
        groupLinkCellMock: jest.fn(),
        groupEmailCellMock: {
            getValue: jest.fn().mockReturnValue('sheet-editors@test.com'),
            setValue: jest.fn(),
        },
    };
    setupSheetMocks(sheetEditorsData, userGroupsMocks);

    global.SpreadsheetApp.getEditors.mockReturnValue([
        { getEmail: () => activeUserEmail }, { getEmail: () => disabledUserEmail },
    ]);
    global.SpreadsheetApp.getOwner.mockReturnValue({ getEmail: () => 'owner@test.com' });
    global.fetchAllGroupMembers_.mockReturnValue([
        { email: activeUserEmail, role: 'MEMBER' }, { email: disabledUserEmail, role: 'MEMBER' },
    ]);

    // --- WHEN ---
    global.syncSheetEditors({ addOnly: true, silentMode: true });

    // --- THEN ---
    const logCalls = global.log_.mock.calls;
    const membersToRemoveLog = logCalls.find(call => call[0].includes('SheetEditors Group Sync: Removing'));
    expect(membersToRemoveLog).toBeUndefined();

    const membershipCalls = global._executeMembershipChunkWithRetries_.mock.calls;
    const addCalls = membershipCalls.filter(call => call[0] && call[0].some(req => req.method === 'POST' && req.email === newUserEmail));
    expect(addCalls.length).toBeGreaterThan(0);

    const deleteCalls = membershipCalls.filter(call => call[0] && call[0].some(req => req.method === 'DELETE'));
    expect(deleteCalls.length).toBe(0);

    expect(global.SpreadsheetApp.removeEditor).not.toHaveBeenCalledWith(disabledUserEmail);
    expect(global.SpreadsheetApp.addEditors).toHaveBeenCalled();
  });
});
