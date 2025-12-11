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
      SheetEditorsGroupEmail: 'sheet-editors@test.com',
      MembershipBatchSize: 10,
    });
    global.log_ = jest.fn();
    global.isUserRowDisabled_ = jest.fn((val) => val === true);

    // Mock config-related functions
    global.getConfigValue_ = jest.fn((key, defaultValue) => {
      const config = {
        SheetEditorsGroupEmail: 'sheet-editors@test.com',
        MembershipBatchSize: 10,
      };
      return config[key] !== undefined ? config[key] : defaultValue;
    });
    global.generateGroupEmail_ = jest.fn((name) => `${name}@test.com`);
    global.updateConfigSetting_ = jest.fn();
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
    // This also serves to reset the mock implementation for each test.
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
      Members: {
        list: jest.fn(),
        remove: jest.fn(),
        insert: jest.fn(),
      }
    };
    global.Utilities = {
        sleep: jest.fn(),
        formatDate: jest.fn(() => '2025-01-01 00:00:00'),
    };
    global._executeBatchRequest = jest.fn((requests) => {
        return requests.map(req => ({ success: true, status: 200, body: `{"message": "success for ${req.operation}"}` }));
    });
    global.AdminDirectory.Members.remove = jest.fn(); // Ensure this is mocked if called directly
    global.AdminDirectory.Members.insert = jest.fn(); // Ensure this is mocked
    global.fetchAllGroupMembers_ = jest.fn().mockReturnValue([]);
    global.getOrCreateGroup_ = jest.fn((email, name) => ({ group: { id: 'group-id' }, wasNewlyCreated: false }));
    global.SCRIPT_EXECUTION_MODE = 'TEST';
    global.showTestMessage_ = jest.fn();

  });

  it('should remove a disabled user from the Sheet Editors group (Full Sync mode)', () => {
    const disabledUserEmail = 'disabled.user@test.com';
    const activeUserEmail = 'active.user@test.com';

    const mockSheetEditorsSheet = {
      getName: () => 'SheetEditors',
      getRange: jest.fn(() => ({
          setValue: jest.fn(),
          getValues: jest.fn().mockReturnValue([
            [activeUserEmail, '', '', '', false], // Active user
            [disabledUserEmail, '', '', '', true], // Disabled user
          ]),
          clearDataValidations: jest.fn(),
          clearNote: jest.fn(),
          setDataValidation: jest.fn(),
      })),
      getLastRow: () => 3,
      setValue: jest.fn(),
    };
    global.SpreadsheetApp.getSheetByName.mockReturnValue(mockSheetEditorsSheet);

    // Mock the spreadsheet as having both users as editors initially
    global.SpreadsheetApp.getEditors.mockReturnValue([
        { getEmail: () => activeUserEmail },
        { getEmail: () => disabledUserEmail },
    ]);
     global.SpreadsheetApp.getOwner.mockReturnValue({ getEmail: () => 'owner@test.com' });

    // Mock the Google Group as currently having both users
    global.fetchAllGroupMembers_.mockReturnValue([
        { email: activeUserEmail, role: 'MEMBER' },
        { email: disabledUserEmail, role: 'MEMBER' },
    ]);

    // --- WHEN ---
    // Run without addOnly option (default is false, allowing removals)
    global.syncSheetEditors();

    // --- THEN ---
    // Inspect the log calls to see membersToRemove
    const logCalls = global.log_.mock.calls;
    const membersToRemoveLog = logCalls.find(call => call[0].includes('SheetEditors Group Sync: Removing') && call[0].includes('members...'));
    expect(membersToRemoveLog).toBeDefined();

    // Check which users were passed to the membership removal process
    const membershipCalls = global._executeMembershipChunkWithRetries_.mock.calls;
    expect(membershipCalls.length).toBeGreaterThan(0); // Expect at least one call

    // Find the removal call (DELETE operations)
    const removalCall = membershipCalls.find(call =>
        call[0] && call[0].some(req => req.method === 'DELETE')
    );

    expect(removalCall).toBeDefined();

    const removalRequests = removalCall[0];
    const removedEmails = removalRequests.map(req => req.email);

    expect(removedEmails).toContain(disabledUserEmail);
    expect(removedEmails).not.toContain(activeUserEmail);

    // Also check that the disabled user is removed from the spreadsheet editors
    expect(global.SpreadsheetApp.removeEditor).toHaveBeenCalledWith(disabledUserEmail);
    expect(global.SpreadsheetApp.removeEditor).not.toHaveBeenCalledWith(activeUserEmail);
  });

  it('should NOT remove a disabled user in AutoSync mode (addOnly: true)', () => {
    const disabledUserEmail = 'disabled.user@test.com';
    const activeUserEmail = 'active.user@test.com';
    const newUserEmail = 'new.user@test.com';

    const mockSheetEditorsSheet = {
      getName: () => 'SheetEditors',
      getRange: jest.fn(() => ({
          setValue: jest.fn(),
          getValues: jest.fn().mockReturnValue([
            [activeUserEmail, '', '', '', false], // Active user
            [newUserEmail, '', '', '', false], // New user to add
            [disabledUserEmail, '', '', '', true], // Disabled user (should NOT be removed in addOnly mode)
          ]),
          clearDataValidations: jest.fn(),
          clearNote: jest.fn(),
          setDataValidation: jest.fn(),
      })),
      getLastRow: () => 4,
      setValue: jest.fn(),
    };
    global.SpreadsheetApp.getSheetByName.mockReturnValue(mockSheetEditorsSheet);

    // Mock the spreadsheet as having active and disabled users as editors
    global.SpreadsheetApp.getEditors.mockReturnValue([
        { getEmail: () => activeUserEmail },
        { getEmail: () => disabledUserEmail },
    ]);
    global.SpreadsheetApp.getOwner.mockReturnValue({ getEmail: () => 'owner@test.com' });

    // Mock the Google Group as currently having active and disabled users
    global.fetchAllGroupMembers_.mockReturnValue([
        { email: activeUserEmail, role: 'MEMBER' },
        { email: disabledUserEmail, role: 'MEMBER' },
    ]);

    // --- WHEN ---
    // Run with addOnly: true (AutoSync mode) and silentMode: true
    global.syncSheetEditors({ addOnly: true, silentMode: true });

    // --- THEN ---
    // Verify that the disabled user removal log was NOT written
    const logCalls = global.log_.mock.calls;
    const membersToRemoveLog = logCalls.find(call => call[0].includes('SheetEditors Group Sync: Removing'));
    expect(membersToRemoveLog).toBeUndefined(); // Should NOT find removal log in addOnly mode

    // Verify SAFE mode warning was logged for spreadsheet editor removals
    const safeModeLogs = logCalls.filter(call => call[0].includes('SAFE mode: Skipping'));
    expect(safeModeLogs.length).toBeGreaterThan(0);

    // Check that new user was added to the group
    const membershipCalls = global._executeMembershipChunkWithRetries_.mock.calls;
    const addCalls = membershipCalls.filter(call =>
        call[0] && call[0].some(req => req.method === 'POST' && req.email === newUserEmail)
    );
    expect(addCalls.length).toBeGreaterThan(0);

    // Verify that NO DELETE operations were performed
    const deleteCalls = membershipCalls.filter(call =>
        call[0] && call[0].some(req => req.method === 'DELETE')
    );
    expect(deleteCalls.length).toBe(0); // No removals in addOnly mode

    // Verify that the disabled user was NOT removed from spreadsheet editors
    expect(global.SpreadsheetApp.removeEditor).not.toHaveBeenCalledWith(disabledUserEmail);

    // Verify that the new user WAS added to spreadsheet editors
    expect(global.SpreadsheetApp.addEditors).toHaveBeenCalled();
  });
});