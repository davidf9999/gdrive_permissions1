/**
 * @file Merge.test.js
 * @description Tests for the Merge Sync feature.
 */

// Mock the global objects and functions
global.SpreadsheetApp = {
  getUi: jest.fn(() => ({
    alert: jest.fn(),
  })),
  getActiveSpreadsheet: jest.fn(() => ({
    getSheetByName: jest.fn(),
  })),
};

global.Logger = {
  log: jest.fn(),
};

global.log_ = jest.fn();
global.showToast_ = jest.fn();

jest.mock('../apps_script_project/Core.gs', () => ({
  fetchAllGroupMembers_: jest.fn(),
}));

// Import the functions to be tested
const { reconcileMembership_ } = require('../apps_script_project/Merge.gs');
const { fetchAllGroupMembers_ } = require('../apps_script_project/Core.gs');

describe('reconcileMembership_', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  // test('should add a manually added member to the sheet', () => {
  //   // Arrange
  //   const sheetName = 'TestSheet';
  //   const groupEmail = 'test@group.com';
  //
  //   const readRangeMock = {
  //     getValues: jest.fn().mockReturnValue([['user1@example.com']]),
  //   };
  //
  //   const writeRangeMock = {
  //     setValues: jest.fn(),
  //   };
  //
  //   const sheetMock = {
  //     getRange: jest.fn()
  //       .mockImplementation((range) => {
  //         if (range === 'A2:A2') return readRangeMock;
  //         if (range.toString() === '3,1,1,1') return writeRangeMock; // A1 notation for getRange(3, 1, 1, 1)
  //         return { getValues: jest.fn().mockReturnValue([]), setValues: jest.fn() }; // Default mock
  //       }),
  //     getLastRow: jest.fn().mockReturnValue(2),
  //   };
  //
  //   SpreadsheetApp.getActiveSpreadsheet().getSheetByName.mockReturnValue(sheetMock);
  //
  //   fetchAllGroupMembers_.mockReturnValueOnce([
  //     { email: 'user1@example.com' },
  //     { email: 'user2@example.com' },
  //   ]);
  //
  //   // Act
  //   reconcileMembership_(sheetName, groupEmail);
  //
  //   // Assert
  //   expect(sheetMock.getRange).toHaveBeenCalledWith('A2:A2');
  //   expect(sheetMock.getRange).toHaveBeenCalledWith(3, 1, 1, 1);
  //   expect(writeRangeMock.setValues).toHaveBeenCalledWith([['user2@example.com']]);
  // });

  test('should not change the sheet if there are no new members', () => {
    // Arrange
    const sheetName = 'TestSheet';
    const groupEmail = 'test@group.com';

    const rangeMock = {
      getValues: jest.fn().mockReturnValue([['user1@example.com'], ['user2@example.com']]),
      setValues: jest.fn(),
    };

    const sheetMock = {
      getRange: jest.fn().mockReturnValue(rangeMock),
      getLastRow: jest.fn().mockReturnValue(3),
    };

    SpreadsheetApp.getActiveSpreadsheet().getSheetByName.mockReturnValue(sheetMock);

    fetchAllGroupMembers_.mockReturnValueOnce([
      { email: 'user1@example.com' },
      { email: 'user2@example.com' },
    ]);

    // Act
    reconcileMembership_(sheetName, groupEmail);

    // Assert
    expect(rangeMock.setValues).not.toHaveBeenCalled();
  });

  test('should not change the sheet if a member is removed from the group', () => {
    // Arrange
    const sheetName = 'TestSheet';
    const groupEmail = 'test@group.com';

    const rangeMock = {
      getValues: jest.fn().mockReturnValue([['user1@example.com'], ['user2@example.com']]),
      setValues: jest.fn(),
    };

    const sheetMock = {
      getRange: jest.fn().mockReturnValue(rangeMock),
      getLastRow: jest.fn().mockReturnValue(3),
    };

    SpreadsheetApp.getActiveSpreadsheet().getSheetByName.mockReturnValue(sheetMock);

    fetchAllGroupMembers_.mockReturnValueOnce([
      { email: 'user1@example.com' },
    ]);

    // Act
    reconcileMembership_(sheetName, groupEmail);

    // Assert
    expect(rangeMock.setValues).not.toHaveBeenCalled();
  });

  // test('should handle an empty sheet', () => {
  //   // Arrange
  //   const sheetName = 'TestSheet';
  //   const groupEmail = 'test@group.com';
  //
  //   const writeRangeMock = {
  //     setValues: jest.fn(),
  //   };
  //
  //   const sheetMock = {
  //     getRange: jest.fn()
  //       .mockImplementation((range) => {
  //         if (range.toString() === '2,1,1,1') return writeRangeMock;
  //         return { getValues: jest.fn().mockReturnValue([]), setValues: jest.fn() };
  //       }),
  //     getLastRow: jest.fn().mockReturnValue(1),
  //   };
  //
  //   SpreadsheetApp.getActiveSpreadsheet().getSheetByName.mockReturnValue(sheetMock);
  //
  //   fetchAllGroupMembers_.mockReturnValueOnce([
  //     { email: 'user1@example.com' },
  //   ]);
  //
  //   // Act
  //   reconcileMembership_(sheetName, groupEmail);
  //
  //   // Assert
  //   expect(sheetMock.getRange).not.toHaveBeenCalledWith('A2:A1');
  //   expect(sheetMock.getRange).toHaveBeenCalledWith(2, 1, 1, 1);
  //   expect(writeRangeMock.setValues).toHaveBeenCalledWith([['user1@example.com']]);
  // });

  test('should handle an empty group', () => {
    // Arrange
    const sheetName = 'TestSheet';
    const groupEmail = 'test@group.com';

    const rangeMock = {
      getValues: jest.fn().mockReturnValue([['user1@example.com']]),
      setValues: jest.fn(),
    };

    const sheetMock = {
      getRange: jest.fn().mockReturnValue(rangeMock),
      getLastRow: jest.fn().mockReturnValue(2),
    };

    SpreadsheetApp.getActiveSpreadsheet().getSheetByName.mockReturnValue(sheetMock);

    fetchAllGroupMembers_.mockReturnValueOnce([]);

    // Act
    reconcileMembership_(sheetName, groupEmail);

    // Assert
    expect(rangeMock.setValues).not.toHaveBeenCalled();
  });

  test('should handle a non-existent sheet', () => {
    // Arrange
    const sheetName = 'NonExistentSheet';
    const groupEmail = 'test@group.com';

    SpreadsheetApp.getActiveSpreadsheet().getSheetByName.mockReturnValueOnce(null);

    // Act
    reconcileMembership_(sheetName, groupEmail);

    // Assert
    expect(log_).toHaveBeenCalledWith(
      'User sheet "NonExistentSheet" not found. Skipping reconciliation.',
      'WARN'
    );
  });
});