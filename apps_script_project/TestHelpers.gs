/**
 * Creates a spy for a method on an object.
 * @param {object} obj The object to spy on.
 * @param {string} methodName The name of the method to spy on.
 * @returns {object} A spy object with a `wasCalled` property.
 */
function createSpy_(obj, methodName) {
  const originalMethod = obj[methodName];
  const spy = {
    wasCalled: false,
    args: [],
    restore: function() {
      obj[methodName] = originalMethod;
    }
  };

  obj[methodName] = function() {
    spy.wasCalled = true;
    spy.args = Array.from(arguments);
  };

  return spy;
}

function getTestConfiguration_() {
    const config = getConfiguration_();
    const testConfig = {
        folderName: config['TestFolderName'],
        role: config['TestRole'],
        email: config['TestEmail'],
        cleanup: (config['TestCleanup'] === true || config['TestCleanup'] === 'TRUE'),
        autoConfirm: (config['TestAutoConfirm'] === true || config['TestAutoConfirm'] === 'TRUE'),
        numFolders: parseInt(config['TestNumFolders'], 10),
        numUsers: parseInt(config['TestNumUsers'], 10),
        baseEmail: config['TestBaseEmail']
    };
    log_('Test Configuration loaded: ' + JSON.stringify(testConfig), 'INFO');
    return testConfig;
}

function isTestSheet_(sheetName) {
    const testConfig = getTestConfiguration_();
    const manualTestFolderName = testConfig.folderName;

    const testSheetPatterns = [
        /^StressTestFolder_.*/,
        new RegExp(`^${manualTestFolderName}_Viewer$`),
        new RegExp(`^${manualTestFolderName}_Editor$`),
        new RegExp(`^${manualTestFolderName}_Commenter$`),
        /^Invalid Folder_Editor$/,
        /^TestCycleA_G$/,
        /^TestCycleB_G$/,
        /^SheetLockingTestSheet_.*/
    ];

    return testSheetPatterns.some(pattern => pattern.test(sheetName));
}
