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
        /^SheetLockingTestSheet_.*/,
        /^TestDeleteGroup_.*/,
        /^TestDisabledDeleteGroup_.*/,
        /^TestIdempotentDelete_.*/,
        /^TestDeleteFolder.*/
    ];

    return testSheetPatterns.some(pattern => pattern.test(sheetName));
}
