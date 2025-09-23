const fs = require('fs');
const path = require('path');

// Load the script file to make its functions available to the test
eval(fs.readFileSync(path.resolve(__dirname, '../apps_script_project/Code.js'), 'utf8'));

describe('UI Functions', () => {

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the UI services
    const mockUi = {
      createMenu: jest.fn(() => mockUi),
      addItem: jest.fn(() => mockUi),
      addToUi: jest.fn(() => mockUi),
      showSidebar: jest.fn(),
    };
    global.SpreadsheetApp = {
      getUi: jest.fn(() => mockUi),
    };

    const mockHtmlOutput = {
      setTitle: jest.fn(() => mockHtmlOutput),
      setWidth: jest.fn(() => mockHtmlOutput),
    };
    global.HtmlService = {
      createHtmlOutputFromFile: jest.fn(() => mockHtmlOutput),
    };

    // Mock dependent functions
    global.setupControlSheets_ = jest.fn();
    global.setupLogSheets_ = jest.fn();
  });

  describe('onOpen', () => {
    it('should create a menu item to show the sidebar', () => {
      onOpen();
      expect(SpreadsheetApp.getUi).toHaveBeenCalled();
      expect(SpreadsheetApp.getUi().createMenu).toHaveBeenCalledWith('Permissions Manager');
      expect(SpreadsheetApp.getUi().addItem).toHaveBeenCalledWith('Show Controls', 'showSidebar');
      expect(SpreadsheetApp.getUi().addToUi).toHaveBeenCalled();
    });

    it('should call setup functions', () => {
      onOpen();
      expect(setupControlSheets_).toHaveBeenCalled();
      expect(setupLogSheets_).toHaveBeenCalled();
    });
  });

  describe('showSidebar', () => {
    it('should create and show the sidebar from the correct HTML file', () => {
      showSidebar();
      expect(HtmlService.createHtmlOutputFromFile).toHaveBeenCalledWith('Sidebar');
      expect(HtmlService.createHtmlOutputFromFile().setTitle).toHaveBeenCalledWith('Permissions Manager');
      expect(HtmlService.createHtmlOutputFromFile().setWidth).toHaveBeenCalledWith(300);
      expect(SpreadsheetApp.getUi().showSidebar).toHaveBeenCalled();
    });
  });
});
