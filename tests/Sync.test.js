const fs = require('fs');
const path = require('path');

describe('syncAdminsGroup_', () => {
  let adminSheet;
  let statusRange;
  let lastSyncedRange;
  let activeSpreadsheet;

  beforeEach(() => {
    jest.clearAllMocks();

    activeSpreadsheet = {
      getSpreadsheetTimeZone: jest.fn(() => 'UTC'),
      getSheetByName: jest.fn(() => null)
    };
    global.Utilities = { formatDate: jest.fn(() => '2024-01-01 00:00:00') };
    global.SpreadsheetApp = {
      getActive: jest.fn(() => activeSpreadsheet),
      getActiveSpreadsheet: jest.fn(() => activeSpreadsheet),
      getUi: jest.fn()
    };
    global.SCRIPT_EXECUTION_MODE = 'TEST';
    global.CacheService = { getScriptCache: jest.fn(() => ({ get: jest.fn(), put: jest.fn() })) };
    global.Session = { getActiveUser: jest.fn(() => ({ getEmail: jest.fn(() => 'test.user@example.com') })) };
    global.DriveApp = { getFolderById: jest.fn(), getFoldersByName: jest.fn(), createFolder: jest.fn() };
    global.UrlFetchApp = { fetch: jest.fn() };

    let codeJsContent = fs.readFileSync(path.resolve(__dirname, '../apps_script_project/Code.js'), 'utf8');
    codeJsContent = codeJsContent.replace(/const /g, 'global.');
    eval(codeJsContent);
    eval(fs.readFileSync(path.resolve(__dirname, '../apps_script_project/Utils.gs'), 'utf8'));
    eval(fs.readFileSync(path.resolve(__dirname, '../apps_script_project/Core.gs'), 'utf8'));
    let syncCode = fs.readFileSync(path.resolve(__dirname, '../apps_script_project/Sync.gs'), 'utf8');
    syncCode = syncCode.replace('function syncAdminsGroup_', 'global.syncAdminsGroup_ = function syncAdminsGroup_');
    eval(syncCode);

    global.shouldSkipGroupOps_ = jest.fn(() => false);
    global.getOrCreateGroup_ = jest.fn();
    global.syncGroupMembership_ = jest.fn();
    global.log_ = jest.fn();
    eval('shouldSkipGroupOps_ = global.shouldSkipGroupOps_;');
    eval('getOrCreateGroup_ = global.getOrCreateGroup_;');
    eval('syncGroupMembership_ = global.syncGroupMembership_;');
    eval('log_ = global.log_;');

    statusRange = { setValue: jest.fn() };
    lastSyncedRange = { setValue: jest.fn() };
    adminSheet = {
      getRange: jest.fn(range => {
        if (range === global.ADMINS_STATUS_CELL) return statusRange;
        if (range === global.ADMINS_LAST_SYNC_CELL) return lastSyncedRange;
        throw new Error('Unexpected range: ' + range);
      })
    };
  });

  it('skips group sync when Admin Directory is unavailable', () => {
    global.shouldSkipGroupOps_.mockReturnValue(true);

    global.syncAdminsGroup_(adminSheet, 'admins@example.com');

    expect(global.shouldSkipGroupOps_).toHaveBeenCalled();
    expect(statusRange.setValue).toHaveBeenNthCalledWith(1, 'Processing group sync...');
    expect(statusRange.setValue).toHaveBeenNthCalledWith(2, 'SKIPPED (No Admin SDK)');
    expect(lastSyncedRange.setValue).toHaveBeenCalledWith('2024-01-01 00:00:00');
    expect(global.getOrCreateGroup_).not.toHaveBeenCalled();
    expect(global.syncGroupMembership_).not.toHaveBeenCalled();
  });

  it('creates and syncs the Admins group', () => {
    global.syncAdminsGroup_(adminSheet, 'admins@example.com');

    expect(global.shouldSkipGroupOps_).toHaveBeenCalled();
    expect(global.getOrCreateGroup_).toHaveBeenCalledWith('admins@example.com', global.ADMINS_GROUP_NAME);
    expect(global.syncGroupMembership_).toHaveBeenCalledWith('admins@example.com', global.ADMINS_SHEET_NAME, { addOnly: false });
    expect(statusRange.setValue).toHaveBeenNthCalledWith(2, 'OK');
    expect(lastSyncedRange.setValue).toHaveBeenCalledWith('2024-01-01 00:00:00');
  });

  it('records errors from group sync', () => {
    global.syncGroupMembership_.mockImplementation(() => { throw new Error('boom'); });

    expect(() => global.syncAdminsGroup_(adminSheet, 'admins@example.com')).toThrow('boom');
    expect(statusRange.setValue).toHaveBeenNthCalledWith(2, 'ERROR: boom');
    expect(lastSyncedRange.setValue).not.toHaveBeenCalled();
  });
});
