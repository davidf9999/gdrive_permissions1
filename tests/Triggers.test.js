const fs = require('fs');
const path = require('path');

describe('detectAutoSyncChanges_', () => {
  let storedSnapshot;
  let spreadsheet;
  let managedSheet;
  let folderUpdates;
  let spreadsheetLastUpdated;

  beforeAll(() => {
    const loadGasFileAsGlobal = (filePath) => {
      let content = fs.readFileSync(path.resolve(__dirname, filePath), 'utf8');
      // Expose all functions in the file to the global scope for Jest
      content = content.replace(/function\s+([a-zA-Z0-9_]+)\s*\(/g, 'global.$1 = function $1(');
      // Expose all consts in the file to the global scope for Jest
      content = content.replace(/const\s+([a-zA-Z0-9_]+)\s*=/g, 'global.$1 =');
      eval(content);
    };

    // Load all necessary script files into the test's scope, in dependency order.
    loadGasFileAsGlobal('../apps_script_project/Code.js');
    loadGasFileAsGlobal('../apps_script_project/Utils.gs');
    loadGasFileAsGlobal('../apps_script_project/Core.gs');
    loadGasFileAsGlobal('../apps_script_project/Triggers.gs');
  });

  beforeEach(() => {
    storedSnapshot = null;
    folderUpdates = {};
    spreadsheetLastUpdated = new Date('2024-01-01T00:00:00Z');

    managedSheet = {
      getLastRow: jest.fn(() => 2),
      getRange: jest.fn(() => ({
        getValues: jest.fn(() => [['folder-1']])
      }))
    };

    spreadsheet = {
      getLastUpdated: jest.fn(() => new Date('2024-01-01T00:00:00Z')),
      getSheetByName: jest.fn(name => {
        if (name === global.MANAGED_FOLDERS_SHEET_NAME) return managedSheet;
        if (name === global.USER_GROUPS_SHEET_NAME) return { getLastRow: () => 0, getRange: () => ({ getValues: () => [] }) }; // Mock empty sheet
        if (name === global.ADMINS_SHEET_NAME) return { getLastRow: () => 0, getRange: () => ({ getValues: () => [] }) }; // Mock empty sheet
        return null;
      }),
      getId: jest.fn(() => 'spreadsheet-id')
    };

    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn(() => spreadsheet)
    };

    global.log_ = jest.fn();

    const spreadsheetFile = {
      getLastUpdated: jest.fn(() => spreadsheetLastUpdated)
    };

    global.DriveApp = {
      getFolderById: jest.fn(id => ({
        getLastUpdated: jest.fn(() => new Date(folderUpdates[id] || '2024-01-01T00:00:00Z'))
      })),
      getFileById: jest.fn(() => spreadsheetFile)
    };

    global.PropertiesService = {
      getDocumentProperties: jest.fn(() => ({
        getProperty: jest.fn(() => storedSnapshot),
        setProperty: jest.fn((key, value) => {
          if (key === global.AUTO_SYNC_CHANGE_SIGNATURE_KEY) {
            storedSnapshot = value;
          }
        })
      }))
    };

    global.Utilities = {
      DigestAlgorithm: {
        SHA_256: 'SHA-256'
      },
      computeDigest: jest.fn(() => 'mock-hash-bytes'),
      base64Encode: jest.fn(bytes => 'mock-hash-string'),
      formatDate: jest.fn(date => date.toISOString()),
      sleep: jest.fn()
    };

    jest.clearAllMocks();
  });

  it('forces a run when no previous snapshot exists', () => {
    const result = detectAutoSyncChanges_();

    expect(result.shouldRun).toBe(true);
    expect(result.reasons).toEqual(
      expect.arrayContaining(['No previous AutoSync snapshot was found.'])
    );
    expect(result.snapshot.folderStates).toEqual({ 'folder-1': new Date('2024-01-01T00:00:00Z').getTime() });
  });

  it('skips when spreadsheet and folders match the previous snapshot', () => {
    const previousSnapshot = {
      dataHash: 'mock-hash-string',
      folderStates: { 'folder-1': new Date('2024-01-01T00:00:00Z').getTime() },
      capturedAt: '2024-01-01T00:00:00Z'
    };
    storedSnapshot = JSON.stringify(previousSnapshot);

    const result = detectAutoSyncChanges_();

    expect(result.shouldRun).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it('detects folder modifications since the last snapshot', () => {
    const previousSnapshot = {
      spreadsheetLastUpdated: new Date('2024-01-01T00:00:00Z').getTime(),
      folderStates: { 'folder-1': new Date('2024-01-01T00:00:00Z').getTime() },
      capturedAt: '2024-01-01T00:00:00Z'
    };
    storedSnapshot = JSON.stringify(previousSnapshot);
    folderUpdates['folder-1'] = '2024-01-01T00:05:00Z';

    const result = detectAutoSyncChanges_();

    expect(result.shouldRun).toBe(true);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        'Folder folder-1 modified at 2024-01-01T00:05:00.000Z.'
      ])
    );
  });

});
