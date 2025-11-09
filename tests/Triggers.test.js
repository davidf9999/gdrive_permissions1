const fs = require('fs');
const path = require('path');

describe('detectAutoSyncChanges_', () => {
  let storedSnapshot;
  let spreadsheet;
  let managedSheet;
  let folderUpdates;
  let spreadsheetLastUpdated;

  beforeAll(() => {
    let codeJsContent = fs.readFileSync(path.resolve(__dirname, '../apps_script_project/Code.js'), 'utf8');
    codeJsContent = codeJsContent.replace(/const /g, 'global.');
    eval(codeJsContent);
    let triggersCode = fs.readFileSync(path.resolve(__dirname, '../apps_script_project/Triggers.gs'), 'utf8');
    triggersCode = triggersCode.replace('function detectAutoSyncChanges_(', 'global.detectAutoSyncChanges_ = function detectAutoSyncChanges_(');
    triggersCode = triggersCode.replace('function recordAutoSyncSnapshot_(', 'global.recordAutoSyncSnapshot_ = function recordAutoSyncSnapshot_(');
    eval(triggersCode);
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
      getSheetByName: jest.fn(name => (name === MANAGED_FOLDERS_SHEET_NAME ? managedSheet : null)),
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
          if (key === AUTO_SYNC_CHANGE_SIGNATURE_KEY) {
            storedSnapshot = value;
          }
        })
      }))
    };

    jest.clearAllMocks();
  });

  it('forces a run when no previous snapshot exists', () => {
    const result = detectAutoSyncChanges_();

    expect(result.shouldRun).toBe(true);
    expect(result.reasons).toEqual(
      expect.arrayContaining(['No previous auto-sync snapshot was found.'])
    );
    expect(result.snapshot.folderStates).toEqual({ 'folder-1': new Date('2024-01-01T00:00:00Z').getTime() });
  });

  it('skips when spreadsheet and folders match the previous snapshot', () => {
    const previousSnapshot = {
      spreadsheetLastUpdated: new Date('2024-01-01T00:00:00Z').getTime(),
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
  it('forces a run when spreadsheet last updated timestamp cannot be retrieved', () => {
    const previousSnapshot = {
      spreadsheetLastUpdated: new Date('2024-01-01T00:00:00Z').getTime(),
      folderStates: { 'folder-1': new Date('2024-01-01T00:00:00Z').getTime() },
      capturedAt: '2024-01-01T00:00:00Z'
    };
    storedSnapshot = JSON.stringify(previousSnapshot);

    DriveApp.getFileById.mockImplementation(() => ({
      getLastUpdated: jest.fn(() => {
        throw new Error('boom');
      })
    }));

    const result = detectAutoSyncChanges_();

    expect(result.shouldRun).toBe(true);
    expect(result.reasons).toEqual(
      expect.arrayContaining(['Unable to confirm control spreadsheet last-updated timestamp.'])
    );
  });
});
