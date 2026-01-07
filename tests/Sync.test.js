const fs = require('fs');
const path = require('path');

// --- Helper to load GAS files into global scope ---
function loadGasFileIntoGlobal(filePath) {
  const content = fs.readFileSync(path.resolve(__dirname, filePath), 'utf8');

  // Transform to expose everything in global scope
  // Replace 'function name(' with 'global.name = function ('
  let transformed = content.replace(/^function (\w+)\s*\(/gm, 'global.$1 = function $1(');
  // Replace 'const name =' with 'global.name ='
  transformed = transformed.replace(/^const (\w+)\s*=/gm, 'global.$1 =');

  // Evaluate transformed content
  eval(transformed);
}

// Load required GAS files
// This should load `Code.js`, `Utils.gs`, `Core.gs` and `Sync.gs`
let codeJsContent = fs.readFileSync(path.resolve(__dirname, '../apps_script_project/Code.js'), 'utf8');
codeJsContent = codeJsContent.replace(/const /g, 'global.');
eval(codeJsContent);

loadGasFileIntoGlobal('../apps_script_project/Utils.gs');
loadGasFileIntoGlobal('../apps_script_project/Core.gs');
loadGasFileIntoGlobal('../apps_script_project/Sync.gs');


describe('syncDeletes', () => {
  let mockUi;
  let mockSpreadsheet;
  let alertSpy;
  let toastSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock SpreadsheetApp UI
    mockUi = {
      alert: jest.fn(),
      ButtonSet: {
        YES_NO: 'YES_NO'
      },
      Button: {
        YES: 'YES',
        NO: 'NO'
      },
    };

    mockSpreadsheet = {
      getUi: jest.fn(() => mockUi),
      toast: jest.fn(),
    };

    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn(() => mockSpreadsheet),
      getUi: jest.fn(() => mockUi),
    };

    // Mock other global functions and constants
    global.log_ = jest.fn();
    global.showToast_ = jest.fn();
    global.sendErrorNotification_ = jest.fn();
    global.updateSyncStatus_ = jest.fn();
    global.processChangeRequests_ = jest.fn();
    global.setupControlSheets_ = jest.fn();
    global.hideSyncInProgress_ = jest.fn();

    // Mock LockService
    global.LockService = {
      getScriptLock: jest.fn(() => ({
        tryLock: jest.fn(() => true), // Lock successfully acquired
        releaseLock: jest.fn(),
      })),
    };

    // Mock the core functions that `syncDeletes` calls
    global.syncUserGroups = jest.fn();
    global.processManagedFolders_ = jest.fn();

    // Spies
    alertSpy = jest.spyOn(mockUi, 'alert');
    toastSpy = jest.spyOn(mockSpreadsheet, 'toast');
  });

  it('should not proceed if user cancels the deletion confirmation', () => {
    // Mock planning phase to return some items for deletion
    global.syncUserGroups.mockReturnValueOnce([{ groupName: 'group1', usersToRemove: ['user1@example.com'] }]);
    global.processManagedFolders_.mockReturnValueOnce([]);

    // Mock user cancelling the alert
    alertSpy.mockReturnValueOnce(mockUi.Button.NO);

    syncDeletes();

    expect(global.log_).toHaveBeenCalledWith('*** Starting user removal planning phase...');
    expect(global.syncUserGroups).toHaveBeenCalledWith({ removeOnly: true, returnPlanOnly: true });
    expect(global.processManagedFolders_).toHaveBeenCalledWith({ removeOnly: true, returnPlanOnly: true });
    expect(alertSpy).toHaveBeenCalledWith(
      'Confirm User Removal',
      expect.stringContaining('This will remove the following users from groups:'),
      mockUi.ButtonSet.YES_NO
    );
    expect(alertSpy).toHaveBeenCalledWith('User removal cancelled.');
    expect(global.setupControlSheets_).not.toHaveBeenCalled(); // Should not proceed to execution
  });

  it('should successfully execute deletions after user confirmation', () => {
    // Mock planning phase to return some items for deletion
    global.syncUserGroups.mockReturnValueOnce([{ groupName: 'group1', usersToRemove: ['user1@example.com'] }]);
    global.processManagedFolders_.mockReturnValueOnce([]);

    // Mock user confirming the alert
    alertSpy.mockReturnValueOnce(mockUi.Button.YES);

    // Mock re-planning phase to return the same items
    global.syncUserGroups.mockReturnValueOnce([{ groupName: 'group1', usersToRemove: ['user1@example.com'] }]);
    global.processManagedFolders_.mockReturnValueOnce([]);

    // Mock execution phase summaries
    global.syncUserGroups.mockReturnValueOnce({ added: 0, removed: 1, failed: 0 });
    global.processManagedFolders_.mockReturnValueOnce({ added: 0, removed: 0, failed: 0 });


    syncDeletes();

    // Planning phase assertions
    expect(global.log_).toHaveBeenCalledWith('*** Starting user removal planning phase...');
    expect(global.syncUserGroups).toHaveBeenCalledWith({ removeOnly: true, returnPlanOnly: true });
    expect(global.processManagedFolders_).toHaveBeenCalledWith({ removeOnly: true, returnPlanOnly: true });
    expect(alertSpy).toHaveBeenCalledWith(
      'Confirm User Removal',
      expect.stringContaining('This will remove the following users from groups:'),
      mockUi.ButtonSet.YES_NO
    );

    // Re-planning phase assertions
    expect(global.log_).toHaveBeenCalledWith('*** Re-running user removal planning phase after user confirmation...');
    expect(global.syncUserGroups).toHaveBeenCalledWith({ removeOnly: true, returnPlanOnly: true });
    expect(global.processManagedFolders_).toHaveBeenCalledWith({ removeOnly: true, returnPlanOnly: true });

    // Execution phase assertions
    expect(global.setupControlSheets_).toHaveBeenCalled();
    expect(global.log_).toHaveBeenCalledWith('*** Starting user removal synchronization...');
    expect(global.syncUserGroups).toHaveBeenCalledWith({ removeOnly: true });
    expect(global.processManagedFolders_).toHaveBeenCalledWith({ removeOnly: true });
    expect(global.showToast_).toHaveBeenCalledWith(expect.stringContaining('User removal complete!'), 'Remove Users', 5);
    expect(alertSpy).toHaveBeenCalledWith(
      'User removal complete. Total changes: 1 removed, 0 failed.\n\nCheck the \'Status\' column in the sheets for details.'
    );
    expect(global.updateSyncStatus_).toHaveBeenCalledWith(
      'Success',
      expect.objectContaining({
        summary: { added: 0, removed: 1, failed: 0 },
        source: 'Manual'
      })
    );
  });

  it('should handle no pending removals gracefully', () => {
    // Mock planning phase to return no items for deletion
    global.syncUserGroups.mockReturnValueOnce([]);
    global.processManagedFolders_.mockReturnValueOnce([]);

    syncDeletes();

    expect(global.log_).toHaveBeenCalledWith('No user removals are pending.');
    expect(alertSpy).toHaveBeenCalledWith('No pending user removals found.');
    expect(global.setupControlSheets_).not.toHaveBeenCalled(); // Should not proceed to execution
  });

  it('should handle errors during the planning phase', () => {
    global.syncUserGroups.mockImplementationOnce(() => {
      throw new Error('Planning error in user groups');
    });

    syncDeletes();

    expect(global.log_).toHaveBeenCalledWith(expect.stringContaining('FATAL ERROR during user removal planning: Error: Planning error in user groups'), 'ERROR');
    expect(global.showToast_).toHaveBeenCalledWith('User removal planning failed with a fatal error.', 'Remove Users', 5);
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('A fatal error occurred during the user removal planning phase: Planning error in user groups'));
    expect(global.sendErrorNotification_).toHaveBeenCalled();
    expect(global.updateSyncStatus_).toHaveBeenCalledWith('Failed', expect.any(Object));
  });

  it('should handle errors during the execution phase', () => {
    // Mock planning phase to return some items for deletion
    global.syncUserGroups.mockReturnValueOnce([{ groupName: 'group1', usersToRemove: ['user1@example.com'] }]);
    global.processManagedFolders_.mockReturnValueOnce([]);

    // Mock user confirming the alert
    alertSpy.mockReturnValueOnce(mockUi.Button.YES);

    // Mock re-planning phase to return the same items
    global.syncUserGroups.mockReturnValueOnce([{ groupName: 'group1', usersToRemove: ['user1@example.com'] }]);
    global.processManagedFolders_.mockReturnValueOnce([]);

    // Mock execution phase to throw an error
    global.syncUserGroups.mockImplementationOnce(() => {
      throw new Error('Execution error in user groups');
    });

    syncDeletes();

    expect(global.log_).toHaveBeenCalledWith(expect.stringContaining('FATAL ERROR in syncDeletes: Error: Execution error in user groups'), 'ERROR');
    expect(global.showToast_).toHaveBeenCalledWith('Delete-only sync failed with a fatal error.', 'Sync Deletes', 5);
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('A fatal error occurred during delete-only sync: Execution error in user groups'));
    expect(global.sendErrorNotification_).toHaveBeenCalled();
    expect(global.updateSyncStatus_).toHaveBeenCalledWith('Failed', expect.any(Object));
  });
});
