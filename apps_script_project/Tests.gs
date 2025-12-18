/***** DEVELOPER-ONLY TEST FUNCTIONS *****/

function runManualAccessTest() {
    SCRIPT_EXECUTION_MODE = 'TEST';

    // Test header
    log_('╔══════════════════════════════════════════════════════════════╗', 'INFO');
    log_('║  Manual Access Test                                          ║', 'INFO');
    log_('╚══════════════════════════════════════════════════════════════╝', 'INFO');

    const startTime = new Date(); // Record start time
    let testFolderName, testRole, testEmail, testRowIndex;
    let userSheetName = null, groupEmail = null, folderId = null; // Initialize to null
    let success = false;
    let testConfig; // Declare here so it's accessible in finally block
    try {
        if (shouldSkipGroupOps_()) {
            showTestMessage_('Test Aborted', 'Manual Access Test requires the Admin Directory service (Admin SDK). Please enable it or run on a Google Workspace domain.');
            return false;
        }
        const ui = SpreadsheetApp.getUi();
        testConfig = getTestConfiguration_(); // Assign (not declare) here

        testFolderName = testConfig.folderName;
        if (!testFolderName) {
            const folderNamePrompt = ui.prompt('Test - Step 1/4: Folder Name', 'Enter a name for a new test folder to be created.', ui.ButtonSet.OK_CANCEL);
            if (folderNamePrompt.getSelectedButton() !== ui.Button.OK || !folderNamePrompt.getResponseText()) { ui.alert('Test cancelled.'); return false; }
            testFolderName = folderNamePrompt.getResponseText();
        }

        testRole = testConfig.role;
        if (!testRole) {
            const rolePrompt = ui.prompt('Test - Step 2/4: Role', 'Enter the role to test (e.g., Editor, Viewer).', ui.ButtonSet.OK_CANCEL);
            if (rolePrompt.getSelectedButton() !== ui.Button.OK || !rolePrompt.getResponseText()) { ui.alert('Test cancelled.'); return false; }
            testRole = rolePrompt.getResponseText();
        }

        testEmail = testConfig.email;
        if (!testEmail) {
            const emailPrompt = ui.prompt('Test - Step 3/4: Test Email', 'Enter a REAL email address you can access for testing (e.g., a personal Gmail).', ui.ButtonSet.OK_CANCEL);
            if (emailPrompt.getSelectedButton() !== ui.Button.OK || !emailPrompt.getResponseText()) { ui.alert('Test cancelled.'); return false; }
            testEmail = emailPrompt.getResponseText().trim().toLowerCase();
        }
        log_('Using test email: ' + testEmail + '. If this is not a real Google account, a "Resource Not Found" error in the logs is expected.', 'INFO');

        showTestMessage_('Step 4/4: Initial Setup', 'The script will now add this configuration to the ManagedFolders sheet and run the sync to create the folder, group, and user sheet.');

        const managedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
        testRowIndex = managedSheet.getLastRow() + 1;
        managedSheet.getRange(testRowIndex, FOLDER_NAME_COL).setValue(testFolderName);
        managedSheet.getRange(testRowIndex, ROLE_COL).setValue(testRole);

        // Use optimized single-folder sync instead of fullSync()
        const status = syncSingleFolder_(testRowIndex);
        if (status !== 'OK') {
            throw new Error('Sync failed after initial setup. Status: ' + status);
        }
        log_('Initial sync complete. Status: OK', 'INFO');

        userSheetName = managedSheet.getRange(testRowIndex, USER_SHEET_NAME_COL).getValue();
        const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(userSheetName);
        if (!userSheet) {
            showTestMessage_('Test Failed', 'Could not find the created user sheet: ' + userSheetName);
            return false;
        }

        userSheet.getRange('A2').setValue(testEmail);
        showTestMessage_('Granting Access', 'The test email has been added to the ' + userSheetName + ' sheet. The script will now sync again to grant folder access.');
        // Use optimized single-folder sync instead of fullSync()
        let status2 = syncSingleFolder_(testRowIndex);
        if (status2 !== 'OK') {
            throw new Error('Sync failed after granting access. Status: ' + status2);
        }
        log_('Grant access sync complete. Status: OK', 'INFO');

        folderId = managedSheet.getRange(testRowIndex, FOLDER_ID_COL).getValue();
        const folderUrl = DriveApp.getFolderById(folderId).getUrl();
        let verification1;
        log_('testConfig.autoConfirm before Verify Access: ' + testConfig.autoConfirm, 'INFO');
        if (testConfig.autoConfirm === true) {
            verification1 = ui.Button.YES;
            log_('Auto-confirming Verify Access.', 'INFO');
        } else {
            verification1 = ui.alert('Verify Access', 'Please open an Incognito Window, log in as ' + testEmail + ', and try to open this link:\n\n' + folderUrl + '\n\nDid you get access?', ui.ButtonSet.YES_NO);
        }

        if (verification1 !== ui.Button.YES) {
            ui.alert('Test aborted. Please review the logs and configuration.');
            return false;
        }

        userSheet.getRange('A2').clearContent();
        showTestMessage_('Revoking Access', 'The test email has been removed from the sheet. The script will now sync again to revoke folder access.');
        // Use optimized single-folder sync instead of fullSync()
        let status3 = syncSingleFolder_(testRowIndex);
        if (status3 !== 'OK') {
            throw new Error('Sync failed after revoking access. Status: ' + status3);
        }
        log_('Revoke access sync complete. Status: OK', 'INFO');

        let verification2;
        log_('testConfig.autoConfirm before Verify Revoked Access: ' + testConfig.autoConfirm, 'INFO');
        if (testConfig.autoConfirm === true) {
            verification2 = ui.Button.YES;
            log_('Auto-confirming Verify Revoked Access.', 'INFO');
        } else {
            verification2 = ui.alert('Verify Revoked Access', 'Please go back to your Incognito Window and refresh the folder page. You should see a \'permission denied\' error.\n\nWas access revoked?', ui.ButtonSet.YES_NO);
        }

        if (verification2 === ui.Button.YES) {
            showTestMessage_('Test Complete: SUCCESS!', 'The user was successfully granted and revoked access.');
            success = true;
        } else {
            showTestMessage_('Test Complete: FAILURE!', 'Access was not revoked as expected. This may be due to Google Drive permission propagation delays. Please wait a few minutes and check again.');
            success = false;
        }
    } catch (e) {
        log_('TEST FAILED: ' + e.toString() + ' Stack: ' + e.stack, 'ERROR');
        try {
            SpreadsheetApp.getUi().alert('Test FAILED. Check the logs for details. Error: ' + e.message);
        } catch (alertError) {
            log_('Could not show error alert: ' + alertError.message, 'WARN');
        }
        success = false;
    } finally {
        const endTime = new Date();
        const durationSeconds = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(2);
        log_('TEST DURATION: ' + durationSeconds + ' seconds', 'INFO');

        // Check if testConfig exists before using it (may be undefined if error occurred early)
        if (typeof testConfig !== 'undefined') {
            let cleanup = testConfig.cleanup === true;
            log_('Auto-cleanup check: testConfig.cleanup = ' + testConfig.cleanup + ', evaluates to: ' + cleanup, 'INFO');

            if (!cleanup) {
                try {
                    const cleanupPrompt = SpreadsheetApp.getUi().alert('Cleanup', 'Do you want to remove all test data (folder, group, and sheet)?', SpreadsheetApp.getUi().ButtonSet.YES_NO);
                    cleanup = cleanupPrompt === SpreadsheetApp.getUi().Button.YES;
                    log_('User selected cleanup: ' + cleanup, 'INFO');
                } catch (alertError) {
                    log_('Could not show cleanup prompt: ' + alertError.message, 'WARN');
                    cleanup = false;
                }
            }

            if (cleanup) {
                log_('Starting automatic cleanup for: ' + testFolderName, 'INFO');
                try {
                    // Get groupEmail if not already set
                    if (!groupEmail) {
                        groupEmail = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME).getRange(testRowIndex, GROUP_EMAIL_COL).getValue();
                        log_('Retrieved groupEmail from sheet: ' + groupEmail, 'INFO');
                    }

                    cleanupFolderData_(testFolderName, folderId, groupEmail, userSheetName);

                    // Delete the row from ManagedFolders sheet
                    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME).deleteRow(testRowIndex);

                    log_('Automatic cleanup completed successfully', 'INFO');
                    showTestMessage_('Cleanup', 'Cleanup complete.');
                } catch (cleanupError) {
                    log_('ERROR during automatic cleanup: ' + cleanupError.message + '\nStack: ' + cleanupError.stack, 'ERROR');
                    showTestMessage_('Cleanup Error', 'Automatic cleanup failed. You may need to run manual cleanup. Error: ' + cleanupError.message);
                }
            } else {
                log_('Cleanup skipped (cleanup = false)', 'INFO');
            }
        } else {
            log_('Cleanup skipped (testConfig undefined)', 'WARN');
        }

        // Test result
        const testStatus = success ? '✓ PASSED' : '✗ FAILED';
        log_('>>> TEST RESULT: Manual Access Test ' + testStatus, success ? 'INFO' : 'ERROR');
        log_('', 'INFO');

        SCRIPT_EXECUTION_MODE = 'DEFAULT';
    }
    return success;
}

/***** STRESS TEST FUNCTIONS *****/

/**
 * A function to test the script's performance with many folders and users.
 */
function runStressTest() {
    SCRIPT_EXECUTION_MODE = 'TEST';

    // Test header
    log_('╔══════════════════════════════════════════════════════════════╗', 'INFO');
    log_('║  Stress Test                                                 ║', 'INFO');
    log_('╚══════════════════════════════════════════════════════════════╝', 'INFO');

    const testStartTime = new Date(); // Record overall test start time
    let success = false;
    let testConfig, numFolders, startRow; // Declare here so accessible in finally block
    try {
        if (shouldSkipGroupOps_()) {
            showTestMessage_('Test Aborted', 'Stress Test requires the Admin Directory service (Admin SDK). Please enable it or run on a Google Workspace domain.');
            return false;
        }
        const ui = SpreadsheetApp.getUi();
        testConfig = getTestConfiguration_(); // Assign (not declare) here

        // --- Step 1: Get Test Parameters ---
        numFolders = testConfig.numFolders; // Assign (not declare)
        if (isNaN(numFolders)) {
            const numFoldersStr = ui.prompt('Stress Test - Step 1/4', 'Enter the number of temporary folders to create (e.g., 10).', ui.ButtonSet.OK_CANCEL);
            if (numFoldersStr.getSelectedButton() !== ui.Button.OK || !numFoldersStr.getResponseText()) { ui.alert('Test cancelled.'); return false; }
            numFolders = parseInt(numFoldersStr.getResponseText(), 10);
        }

        let numUsers = testConfig.numUsers;
        if (isNaN(numUsers) || numUsers < 1) {
            const numUsersStr = ui.prompt('Stress Test - Step 2/4', 'Enter the number of test users to create PER FOLDER (e.g., 200).', ui.ButtonSet.OK_CANCEL);
            if (numUsersStr.getSelectedButton() !== ui.Button.OK || !numUsersStr.getResponseText()) { ui.alert('Test cancelled.'); return false; }
            numUsers = parseInt(numUsersStr.getResponseText(), 10);
        }

        let baseEmail = testConfig.baseEmail;
        if (!baseEmail) {
            const baseEmailStr = ui.prompt('Stress Test - Step 3/4', 'Enter a base email address to generate test users (e.g., your.name@gmail.com).', ui.ButtonSet.OK_CANCEL);
            if (baseEmailStr.getSelectedButton() !== ui.Button.OK || !baseEmailStr.getResponseText()) { ui.alert('Test cancelled.'); return false; }
            baseEmail = baseEmailStr.getResponseText().trim();
        }
        const emailParts = baseEmail.split('@');
        if (emailParts.length !== 2) { ui.alert('Invalid email address.'); return false; }

        showTestMessage_(
            'Stress Test - Step 4/4',
            'The script will now create ' + numFolders + ' test folders and prepare ' + numUsers + ' users for each.'
        );

        // --- Step 2: Setup Test Data ---
        const testRunId = new Date().getTime(); // Unique ID for this test run
        const folderNames = [];
        for (let i = 1; i <= numFolders; i++) {
            folderNames.push('StressTestFolder_' + testRunId + '_' + i);
        }

        const userEmails = [];
        for (let i = 1; i <= numUsers; i++) {
            userEmails.push(emailParts[0] + '+testuser' + testRunId + i + '@' + emailParts[1]);
        }

        const managedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
        startRow = managedSheet.getLastRow() + 1; // Assign (not declare)
        const newConfig = folderNames.map(name => [name, '', 'Editor']);
        managedSheet.getRange(startRow, 1, newConfig.length, 3).setValues(newConfig);
        SpreadsheetApp.flush();

        // --- Step 3: Initial Sync to Create Infrastructure ---
        showTestMessage_('Setup Phase 1 Complete', 'Test folders have been added to the sheet. The script will now run a sync to create the necessary folders, groups, and user sheets.');
        // Use optimized test-only sync instead of fullSync()
        testOnlySync_(['StressTestFolder_'], false);

        // --- Step 4: Populate User Sheets ---
        showTestMessage_('Setup Phase 2 Complete', 'The script will now populate all of the new user sheets with the test user emails.');
        const userSheetNames = managedSheet.getRange(startRow, USER_SHEET_NAME_COL, numFolders, 1).getValues().flat();
        const userEmailsForSheet = userEmails.map(e => [e]); // Format for setting range values

        userSheetNames.forEach(function (sheetName) {
            const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
            if (sheet) {
                sheet.getRange(2, 1, userEmailsForSheet.length, 1).setValues(userEmailsForSheet);
            }
        });

        // --- Step 5: Run the Main Stress Test Sync ---
        showTestMessage_('Setup Complete. Starting Stress Test', 'All test data is in place. The script will now run the main sync and time its execution.');
        const startTime = new Date();
        // Use optimized test-only sync instead of fullSync()
        testOnlySync_(['StressTestFolder_'], false);
        const endTime = new Date();
        const durationSeconds = (endTime.getTime() - startTime.getTime()) / 1000;

        showTestMessage_('Stress Test Complete!', 'The sync process finished in ' + durationSeconds + ' seconds.');
        log_('Stress Test sync duration: ' + durationSeconds + ' seconds', 'INFO');
        success = true;
    } catch (e) {
        log_('TEST FAILED: ' + e.toString() + ' Stack: ' + e.stack, 'ERROR');
        try {
            SpreadsheetApp.getUi().alert('Test FAILED. Check the logs for details. Error: ' + e.message);
        } catch (alertError) {
            log_('Could not show error alert: ' + alertError.message, 'WARN');
        }
        success = false;
    } finally {
        const testEndTime = new Date();
        const testDurationSeconds = ((testEndTime.getTime() - testStartTime.getTime()) / 1000).toFixed(2);
        log_('TEST DURATION: ' + testDurationSeconds + ' seconds', 'INFO');

        // --- Step 6: Cleanup ---
        // Check if testConfig exists before using it (may be undefined if error occurred early)
        if (typeof testConfig !== 'undefined' && typeof numFolders !== 'undefined' && typeof startRow !== 'undefined') {
            let cleanup = testConfig.cleanup === true;
            log_('Auto-cleanup check (Stress Test): testConfig.cleanup = ' + testConfig.cleanup + ', evaluates to: ' + cleanup, 'INFO');

            if (!cleanup) {
                try {
                    const cleanupPrompt = SpreadsheetApp.getUi().alert('Cleanup', 'Do you want to remove all test data (folders, groups, sheets, and configuration rows)?', SpreadsheetApp.getUi().ButtonSet.YES_NO);
                    cleanup = cleanupPrompt === SpreadsheetApp.getUi().Button.YES;
                    log_('User selected cleanup: ' + cleanup, 'INFO');
                } catch (alertError) {
                    log_('Could not show cleanup prompt: ' + alertError.message, 'WARN');
                    cleanup = false;
                }
            }

            if (cleanup) {
                log_('Starting automatic cleanup for stress test folders', 'INFO');
                try {
                    const managedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
                    // Read up to STATUS_COL to include USER_SHEET_NAME_COL (column 5)
                    const managedData = managedSheet.getRange(startRow, 1, numFolders, STATUS_COL).getValues();

                    showTestMessage_('Cleanup', 'Cleanup in Progress. This may take a few moments.');

                    // Clean up all test resources first
                    managedData.forEach(function (row) {
                        const folderName = row[FOLDER_NAME_COL - 1];
                        const folderId = row[FOLDER_ID_COL - 1];
                        const userSheetName = row[USER_SHEET_NAME_COL - 1];
                        const groupEmail = row[GROUP_EMAIL_COL - 1];
                        cleanupFolderData_(folderName, folderId, groupEmail, userSheetName);
                    });

                    // Then delete rows from sheet
                    managedSheet.deleteRows(startRow, numFolders);

                    log_('Automatic cleanup completed successfully', 'INFO');
                    showTestMessage_('Cleanup', 'Cleanup Complete!');
                } catch (cleanupError) {
                    log_('ERROR during automatic cleanup: ' + cleanupError.message + '\nStack: ' + cleanupError.stack, 'ERROR');
                    showTestMessage_('Cleanup Error', 'Automatic cleanup failed. You may need to run manual cleanup. Error: ' + cleanupError.message);
                }
            } else {
                log_('Cleanup skipped (cleanup = false)', 'INFO');
            }
        } else {
            log_('Cleanup skipped (required variables undefined)', 'WARN');
        }

        // Test result
        const testStatus = success ? '✓ PASSED' : '✗ FAILED';
        log_('>>> TEST RESULT: Stress Test ' + testStatus, success ? 'INFO' : 'ERROR');
        log_('', 'INFO');

        SCRIPT_EXECUTION_MODE = 'DEFAULT';
    }
    return success;
}

function cleanupStressTestData() {
    SCRIPT_EXECUTION_MODE = 'TEST';
    try {
        if (shouldSkipGroupOps_()) {
            showTestMessage_('Cleanup Aborted', 'Cleanup requires the Admin Directory service (Admin SDK). Please enable it or run on a Google Workspace domain.');
            return;
        }
        const ui = SpreadsheetApp.getUi();
        const testConfig = getTestConfiguration_();

        let response = ui.Button.YES;
        if (testConfig.autoConfirm !== true) {
            response = ui.alert('Are you sure you want to delete all stress test data?', 'This will delete all folders, groups, and sheets with the "StressTestFolder_" prefix.', ui.ButtonSet.YES_NO);
        }
        if (response !== ui.Button.YES) {
            return;
        }

        showTestMessage_('Cleanup', 'Cleanup in Progress. This may take a few moments.');

        // Clean up sheets
        const allSheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
        allSheets.forEach(function (sheet) {
            if (sheet.getName().startsWith('StressTestFolder_')) {
                SpreadsheetApp.getActiveSpreadsheet().deleteSheet(sheet);
            }
        });

        // Clean up ManagedFolders sheet entries
        const managedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
        if (managedSheet) {
            const data = managedSheet.getDataRange().getValues();
            const rowsToDelete = [];
            for (let i = data.length - 1; i >= 0; i--) {
                if (data[i][FOLDER_NAME_COL - 1] && data[i][FOLDER_NAME_COL - 1].startsWith('StressTestFolder_')) {
                    rowsToDelete.push(i + 1); // +1 because sheet rows are 1-indexed
                }
            }
            rowsToDelete.forEach(function (rowIndex) {
                managedSheet.deleteRow(rowIndex);
            });
        }

        // Clean up groups
        let pageToken;
        let allGroups = [];
        do {
            const result = AdminDirectory.Groups.list({
                customer: 'my_customer',
                maxResults: 200,
                pageToken: pageToken
            });
            allGroups = allGroups.concat(result.groups);
            pageToken = result.nextPageToken;
        } while (pageToken);

        allGroups.forEach(function (group) {
            if (group.name.startsWith('StressTestFolder_')) {
                try {
                    AdminDirectory.Groups.remove(group.email);
                } catch (e) {
                    log_('Could not remove group ' + group.email + ': ' + e.message, 'WARN');
                }
            }
        });

        // Clean up folders
        const folders = DriveApp.getFolders();
        while (folders.hasNext()) {
            const folder = folders.next();
            if (folder.getName().startsWith('StressTestFolder_')) {
                try {
                    folder.setTrashed(true);
                } catch (e) {
                    log_('Could not trash folder ' + folder.getId() + ': ' + e.message, 'WARN');
                }
            }
        }

        showTestMessage_('Cleanup', 'Cleanup Complete!');
    } finally {
        SCRIPT_EXECUTION_MODE = 'DEFAULT';
    }
}

function cleanupManualTestData() {
    SCRIPT_EXECUTION_MODE = 'TEST';
    try {
        if (shouldSkipGroupOps_()) {
            showTestMessage_('Cleanup Aborted', 'Cleanup requires the Admin Directory service (Admin SDK). Please enable it or run on a Google Workspace domain.');
            return;
        }
        const ui = SpreadsheetApp.getUi();
        const testConfig = getTestConfiguration_();

        const folderNamePrompt = ui.prompt('Enter the name of the manual test folder to clean up:');
        if (folderNamePrompt.getSelectedButton() !== ui.Button.OK || !folderNamePrompt.getResponseText()) {
            return;
        }
        const folderName = folderNamePrompt.getResponseText();

        const managedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
        const data = managedSheet.getDataRange().getValues();
        let rowIndexToDelete = -1;
        let folderId, groupEmail, userSheetName;

        for (let i = 1; i < data.length; i++) {
            if (data[i][FOLDER_NAME_COL - 1] === folderName) {
                rowIndexToDelete = i + 1;
                folderId = data[i][FOLDER_ID_COL - 1];
                groupEmail = data[i][GROUP_EMAIL_COL - 1];
                userSheetName = data[i][USER_SHEET_NAME_COL - 1];
                break;
            }
        }

        if (rowIndexToDelete === -1) {
            showTestMessage_('Error', 'Folder not found in the ManagedFolders sheet.');
            return;
        }

        let response = ui.Button.YES;
        if (testConfig.autoConfirm !== true) {
            response = ui.alert('Are you sure you want to delete the test data for folder "' + folderName + '"?', 'This will delete the folder, group, and sheet.', ui.ButtonSet.YES_NO);
        }
        if (response !== ui.Button.YES) {
            return;
        }

        cleanupFolderData_(folderName, folderId, groupEmail, userSheetName);
        managedSheet.deleteRow(rowIndexToDelete);

        showTestMessage_('Cleanup', 'Cleanup Complete!');
    } finally {
        SCRIPT_EXECUTION_MODE = 'DEFAULT';
    }
}

function cleanupAddDeleteSeparationTestData() {
    SCRIPT_EXECUTION_MODE = 'TEST';
    try {
        if (shouldSkipGroupOps_()) {
            showTestMessage_('Cleanup Aborted', 'Cleanup requires the Admin Directory service (Admin SDK). Please enable it or run on a Google Workspace domain.');
            return;
        }
        const ui = SpreadsheetApp.getUi();
        const testConfig = getTestConfiguration_();

        const folderNamePrompt = ui.prompt('Enter the name of the Add/Delete Separation test folder to clean up:');
        if (folderNamePrompt.getSelectedButton() !== ui.Button.OK || !folderNamePrompt.getResponseText()) {
            return;
        }
        const folderName = folderNamePrompt.getResponseText();

        const managedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
        const data = managedSheet.getDataRange().getValues();
        let rowIndexToDelete = -1;
        let folderId, groupEmail, userSheetName;

        for (let i = 1; i < data.length; i++) {
            if (data[i][FOLDER_NAME_COL - 1] === folderName) {
                rowIndexToDelete = i + 1;
                folderId = data[i][FOLDER_ID_COL - 1];
                groupEmail = data[i][GROUP_EMAIL_COL - 1];
                userSheetName = data[i][USER_SHEET_NAME_COL - 1];
                break;
            }
        }

        if (rowIndexToDelete === -1) {
            showTestMessage_('Error', 'Folder not found in the ManagedFolders sheet.');
            return;
        }

        let response = ui.Button.YES;
        if (testConfig.autoConfirm !== true) {
            response = ui.alert('Are you sure you want to delete the test data for folder "' + folderName + '"?', 'This will delete the folder, group, and sheet.', ui.ButtonSet.YES_NO);
        }
        if (response !== ui.Button.YES) {
            return;
        }

        cleanupFolderData_(folderName, folderId, groupEmail, userSheetName);
        managedSheet.deleteRow(rowIndexToDelete);

        showTestMessage_('Cleanup', 'Cleanup Complete!');
    } finally {
        SCRIPT_EXECUTION_MODE = 'DEFAULT';
    }
}


function runAddDeleteSeparationTest() {
    SCRIPT_EXECUTION_MODE = 'TEST';

    // Test header
    log_('╔══════════════════════════════════════════════════════════════╗', 'INFO');
    log_('║  Add/Delete Separation Test                                  ║', 'INFO');
    log_('╚══════════════════════════════════════════════════════════════╝', 'INFO');

    const ui = SpreadsheetApp.getUi();
    let testFolderName, testEmail, testRole, testRowIndex;
    let userSheetName = null, groupEmail = null, folderId = null; // Initialize to null
    const startTime = new Date(); // Record start time
    const testConfig = getTestConfiguration_(); // Declare testConfig at top scope
    let success = false;

    try {
        if (shouldSkipGroupOps_()) {
            showTestMessage_('Test Aborted', 'This test requires the Admin Directory service (Admin SDK). Please enable it or run on a Google Workspace domain.');
            return false;
        }

        // --- Test Setup ---
        testFolderName = testConfig.folderName;
        if (!testFolderName) {
            const folderNamePrompt = ui.prompt('Add/Delete Test - Step 1/3: Folder Name', 'Enter a unique name for a new test folder.', ui.ButtonSet.OK_CANCEL);
            if (folderNamePrompt.getSelectedButton() !== ui.Button.OK || !folderNamePrompt.getResponseText()) { ui.alert('Test cancelled.'); return false; }
            testFolderName = folderNamePrompt.getResponseText();
        }
        testRole = 'Editor'; // Using a fixed role for simplicity

        testEmail = testConfig.email;
        if (!testEmail) {
            const emailPrompt = ui.prompt('Add/Delete Test - Step 2/3: Test Email', 'Enter a REAL email address you can access for testing.', ui.ButtonSet.OK_CANCEL);
            if (emailPrompt.getSelectedButton() !== ui.Button.OK || !emailPrompt.getResponseText()) { ui.alert('Test cancelled.'); return false; }
            testEmail = emailPrompt.getResponseText().trim().toLowerCase();
        }
        log_('Using test email: ' + testEmail + '. If this is not a real Google account, a "Resource Not Found" error in the logs is expected.', 'INFO');

        showTestMessage_('Add/Delete Test - Step 3/3: Running Test', 'The script will now run through the add/delete separation test. Please follow the prompts.');

        // --- Phase 1: Initial Add ---
        log_('TEST: Initial Add Phase');
        const managedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
        testRowIndex = managedSheet.getLastRow() + 1;
        managedSheet.getRange(testRowIndex, FOLDER_NAME_COL).setValue(testFolderName);
        managedSheet.getRange(testRowIndex, ROLE_COL).setValue(testRole);

        // Use optimized single-folder sync instead of syncAdds()
        const status = syncSingleFolder_(testRowIndex, true);
        if (status !== 'OK') {
            throw new Error('Sync failed after initial setup. Status: ' + status);
        }
        log_('Initial sync complete. Status: OK', 'INFO');

        userSheetName = managedSheet.getRange(testRowIndex, USER_SHEET_NAME_COL).getValue();
        groupEmail = managedSheet.getRange(testRowIndex, GROUP_EMAIL_COL).getValue();
        folderId = managedSheet.getRange(testRowIndex, FOLDER_ID_COL).getValue();
        const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(userSheetName);
        if (!userSheet) throw new Error('Test failed: Could not find the created user sheet: ' + userSheetName);

        userSheet.getRange('A2').setValue(testEmail);
        // Use optimized single-folder sync instead of syncAdds()
        let status2 = syncSingleFolder_(testRowIndex, true);
        if (status2 !== 'OK') {
            throw new Error('Sync failed after adding user. Status: ' + status2);
        }
        log_('Add user sync complete. Status: OK', 'INFO');

        // --- Verification 1: User was added ---
        let members = fetchAllGroupMembers_(groupEmail);
        let isMember = members.some(m => m.email.toLowerCase() === testEmail);

        const testLogSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TEST_LOG_SHEET_NAME);
        let has404Error = false;
        if (testLogSheet) {
            const logData = testLogSheet.getDataRange().getValues();
            const recentLogs = logData.slice(-50);
            has404Error = recentLogs.some(row => {
                const logMessage = row[2] ? row[2].toString() : '';
                return logMessage.includes('404') && logMessage.includes('Resource Not Found') && logMessage.includes(testEmail);
            });
        }

        if (!isMember && !has404Error) {
            throw new Error('VERIFICATION FAILED: User ' + testEmail + ' was not added to group ' + groupEmail + ' after syncAdds, and no 404 error was found (suggesting the email should be valid).');
        } else if (!isMember && has404Error) {
            log_('VERIFICATION SKIPPED: User ' + testEmail + ' was not added due to 404 "Resource Not Found" error (expected for non-existent email addresses).', 'INFO');
            showTestMessage_('Verification Note', 'User ' + testEmail + ' could not be added because it is not a valid Google account (404 error). This is expected behavior. The test will continue with deletion verification.');
        } else {
            log_('VERIFICATION PASSED: User was successfully added to the group.');
            showTestMessage_('Verification Passed', 'User ' + testEmail + ' was correctly added to the group.');
        }

        // --- Phase 2: Run Delete (should do nothing) ---
        log_('TEST: No-Op Delete Phase');
        if (has404Error) {
            log_('TEST: Skipping No-Op Delete Phase - user was never added due to 404 error', 'INFO');
        } else {
            let confirmNoOpDelete;
            if (testConfig.autoConfirm === true) {
                confirmNoOpDelete = ui.Button.YES;
                log_('Auto-confirming No-Op Delete.', 'INFO');
            } else {
                confirmNoOpDelete = ui.alert('Confirm No-Op Delete', 'The script will now run a delete sync, but no deletions are expected. Continue?', ui.ButtonSet.YES_NO);
            }
            if (confirmNoOpDelete !== ui.Button.YES) { ui.alert('Test cancelled.'); return false; }
            // Use optimized test-only sync for deletes
            testOnlySync_([testFolderName], false);

            members = fetchAllGroupMembers_(groupEmail);
            isMember = members.some(m => m.email.toLowerCase() === testEmail);
            if (!isMember) {
                throw new Error('VERIFICATION FAILED: User ' + testEmail + ' was removed from group ' + groupEmail + ' after a no-op syncDeletes call.');
            }
            log_('VERIFICATION PASSED: User was not removed by no-op delete.');
            showTestMessage_('Verification Passed', 'User ' + testEmail + ' was NOT removed by the delete sync (as expected).');
        }

        // --- Phase 3: Actual Deletion ---
        log_('TEST: Actual Deletion Phase');
        userSheet.getRange('A2').clearContent();
        if (has404Error) {
            log_('TEST: Skipping Actual Deletion Phase - user was never added due to 404 error', 'INFO');
            log_('VERIFICATION SKIPPED: No deletion verification needed since user was never added.', 'INFO');
            showTestMessage_('Test Complete: SUCCESS (with 404)', 'The test completed successfully. The email address was invalid (404 error), so add/delete operations were skipped as expected. The test infrastructure (folder, group, sheet) was created and will be cleaned up.');
        } else {
            let confirmActualDelete;
            if (testConfig.autoConfirm === true) {
                confirmActualDelete = ui.Button.YES;
                log_('Auto-confirming Actual Deletion.', 'INFO');
            } else {
                confirmActualDelete = ui.alert('Confirm Actual Delete', 'The script will now run a delete sync to remove the user. Continue?', ui.ButtonSet.YES_NO);
            }
            if (confirmActualDelete !== ui.Button.YES) { ui.alert('Test cancelled.'); return false; }
            // Use optimized test-only sync for deletes
            testOnlySync_([testFolderName], false);
            const statusFinal = managedSheet.getRange(testRowIndex, STATUS_COL).getValue();
            if (statusFinal !== 'OK') {
                throw new Error('Sync failed after deleting user. Status: ' + statusFinal);
            }
            log_('Delete user sync complete. Status: OK', 'INFO');

            members = fetchAllGroupMembers_(groupEmail);
            isMember = members.some(m => m.email.toLowerCase() === testEmail);
            if (isMember) {
                throw new Error('VERIFICATION FAILED: User ' + testEmail + ' was NOT removed from group ' + groupEmail + ' after syncDeletes.');
            }
            log_('VERIFICATION PASSED: User was successfully removed from the group.');
            showTestMessage_('Test Complete: SUCCESS!', 'The user was successfully added and then removed using the separated sync functions.');
        }

        success = true;
    } catch (e) {
        log_('TEST FAILED: ' + e.toString() + ' Stack: ' + e.stack, 'ERROR');
        try {
            SpreadsheetApp.getUi().alert('Test FAILED. Check the logs for details. Error: ' + e.message);
        } catch (alertError) {
            log_('Could not show error alert: ' + alertError.message, 'WARN');
        }
        success = false;
    } finally {
        const endTime = new Date();
        const durationSeconds = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(2);
        log_('TEST DURATION: ' + durationSeconds + ' seconds', 'INFO');

        // Check if testConfig exists before using it (may be undefined if error occurred early)
        if (typeof testConfig !== 'undefined') {
            let cleanup = testConfig.cleanup === true;
            log_('Auto-cleanup check (Add/Delete Test): testConfig.cleanup = ' + testConfig.cleanup + ', evaluates to: ' + cleanup, 'INFO');

            if (!cleanup) {
                try {
                    const cleanupPrompt = SpreadsheetApp.getUi().alert('Cleanup', 'Do you want to remove all test data (folder, group, and sheet)?', SpreadsheetApp.getUi().ButtonSet.YES_NO);
                    cleanup = cleanupPrompt === SpreadsheetApp.getUi().Button.YES;
                    log_('User selected cleanup: ' + cleanup, 'INFO');
                } catch (alertError) {
                    log_('Could not show cleanup prompt: ' + alertError.message, 'WARN');
                    cleanup = false;
                }
            }

            if (cleanup && testFolderName) {
                log_('Starting automatic cleanup for: ' + testFolderName, 'INFO');
                try {
                    cleanupFolderData_(testFolderName, folderId, groupEmail, userSheetName);

                    const managedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
                    if (testRowIndex && managedSheet.getRange(testRowIndex, FOLDER_NAME_COL).getValue() === testFolderName) {
                        managedSheet.deleteRow(testRowIndex);
                    }

                    log_('Automatic cleanup completed successfully', 'INFO');
                    showTestMessage_('Cleanup', 'Cleanup complete.');
                } catch (cleanupError) {
                    log_('ERROR during automatic cleanup: ' + cleanupError.message + '\nStack: ' + cleanupError.stack, 'ERROR');
                    showTestMessage_('Cleanup Error', 'Automatic cleanup failed. You may need to run manual cleanup. Error: ' + cleanupError.message);
                }
            } else {
                log_('Cleanup skipped (cleanup = false or testFolderName undefined)', 'INFO');
            }
        } else {
            log_('Cleanup skipped (testConfig undefined)', 'WARN');
        }

        // Test result
        const testStatus = success ? '✓ PASSED' : '✗ FAILED';
        log_('>>> TEST RESULT: Add/Delete Separation Test ' + testStatus, success ? 'INFO' : 'ERROR');
        log_('', 'INFO');

        SCRIPT_EXECUTION_MODE = 'DEFAULT';
    }
    return success;
}

/**
 * One-time cleanup for orphaned test data.
 * This function can be used to clean up specific test data by folder name.
 */
function cleanupOrphanedTestData() {
    SCRIPT_EXECUTION_MODE = 'TEST';
    try {
        const ui = SpreadsheetApp.getUi();
        const folderName = 'Test Folder'; // Change this to match your orphaned folder

        const response = ui.alert(
            'Clean Up Orphaned Test Data',
            'This will attempt to clean up the folder "' + folderName + '" and its associated resources.\n\nContinue?',
            ui.ButtonSet.YES_NO
        );

        if (response !== ui.Button.YES) {
            return;
        }

        const managedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
        const data = managedSheet.getDataRange().getValues();

        let found = false;
        for (let i = data.length - 1; i >= 1; i--) {
            if (data[i][FOLDER_NAME_COL - 1] === folderName) {
                const folderId = data[i][FOLDER_ID_COL - 1];
                const groupEmail = data[i][GROUP_EMAIL_COL - 1];
                const userSheetName = data[i][USER_SHEET_NAME_COL - 1];

                log_('Found orphaned test data for: ' + folderName, 'INFO');
                cleanupFolderData_(folderName, folderId, groupEmail, userSheetName);
                managedSheet.deleteRow(i + 1);
                found = true;
                break;
            }
        }

        if (found) {
            showTestMessage_('Cleanup Complete', 'Successfully cleaned up orphaned test data for: ' + folderName);
        } else {
            showTestMessage_('Not Found', 'Could not find folder "' + folderName + '" in the ManagedFolders sheet.');
        }

    } catch (e) {
        log_('Error during orphaned data cleanup: ' + e.toString(), 'ERROR');
        SpreadsheetApp.getUi().alert('Cleanup failed: ' + e.message);
    } finally {
        SCRIPT_EXECUTION_MODE = 'DEFAULT';
    }
}

/**
 * Cleans up all data associated with a test folder.
 * @param {string} folderName The name of the folder.
 * @param {string} folderId The ID of the folder.
 * @param {string} groupEmail The email of the associated group.
 * @param {string} userSheetName The name of the associated user sheet.
 */
function cleanupFolderData_(folderName, folderId, groupEmail, userSheetName) {
    log_('Starting cleanup for test data: ' + folderName);
    log_('  → userSheetName: "' + userSheetName + '"');
    log_('  → groupEmail: "' + groupEmail + '"');
    log_('  → folderId: "' + folderId + '"');

    // 1. Delete the user sheet
    if (userSheetName) {
        log_('  → Attempting to find sheet: ' + userSheetName);
        try {
            const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(userSheetName);
            if (sheet) {
                log_('  → Sheet found, deleting...');
                SpreadsheetApp.getActiveSpreadsheet().deleteSheet(sheet);
                log_('✓ Deleted sheet: ' + userSheetName);
            } else {
                log_('✗ Sheet not found: ' + userSheetName + ' (getSheetByName returned null)', 'WARN');
            }
        } catch (e) {
            log_('✗ Could not delete sheet ' + userSheetName + ': ' + e.message, 'ERROR');
        }
    } else {
        log_('✗ Skipping sheet deletion - userSheetName is empty/null', 'WARN');
    }

    // 2. Delete the Google Group
    if (groupEmail) {
        try {
            AdminDirectory.Groups.remove(groupEmail);
            log_('Deleted group: ' + groupEmail);
        } catch (e) {
            log_('Could not delete group ' + groupEmail + ': ' + e.message, 'WARN');
        }
    }

    // 3. Trash the Google Drive folder
    if (folderId) {
        try {
            const folder = DriveApp.getFolderById(folderId);
            folder.setTrashed(true);
            log_('Trashed folder: ' + folderName + ' (ID: ' + folderId + ')');
        } catch (e) {
            log_('Could not trash folder ' + folderId + ': ' + e.message, 'WARN');
        }
    }
    log_('Cleanup finished for: ' + folderName);
}

function runAutoSyncErrorEmailTest() {
    SCRIPT_EXECUTION_MODE = 'TEST';
    let success = false;
    const mailAppSpy = createSpy_(MailApp, 'sendEmail');
    const originalEmailNotificationSetting = getConfigValue_('EnableEmailNotifications', false);
    const orphanSheetName = 'OrphanSheetForErrorTest_' + new Date().getTime();
    let orphanSheet;
    const props = PropertiesService.getDocumentProperties();
    const originalSnapshot = props.getProperty(AUTO_SYNC_CHANGE_SIGNATURE_KEY);

    try {
        log_('╔══════════════════════════════════════════════════════════════╗', 'INFO');
        log_('║  AutoSync Error Email Test                                ║', 'INFO');
        log_('╚══════════════════════════════════════════════════════════════╝', 'INFO');

        // Force the next sync to run by invalidating the last one
        log_('Forcing next autoSync to run by marking last sync as failed.', 'INFO');
        const tempSnapshot = { dataHash: 'force-run', capturedAt: new Date().toISOString(), lastSyncSuccessful: false };
        props.setProperty(AUTO_SYNC_CHANGE_SIGNATURE_KEY, JSON.stringify(tempSnapshot));

        // Temporarily enable email notifications for the test
        updateConfigSetting_('EnableEmailNotifications', true);

        // Simulate an error by creating an orphan sheet
        const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
        orphanSheet = spreadsheet.insertSheet(orphanSheetName, spreadsheet.getSheets().length);
        log_('Created orphan sheet "' + orphanSheetName + '" to trigger a fatal error.', 'INFO');

        // Run AutoSync, which should now run and fail because of the orphan sheet
        try {
            autoSync({ silentMode: true });
        } catch (e) {
            // Error is expected, and should be caught by the autoSync's own try...catch
            log_('Caught expected error during autoSync call: ' + e.message, 'INFO');
        }

        // Check if the email spy was called by the autoSync's catch block
        if (mailAppSpy.wasCalled) {
            log_('VERIFICATION PASSED: MailApp.sendEmail was called after AutoSync error.', 'INFO');
            success = true;
        } else {
            throw new Error('VERIFICATION FAILED: MailApp.sendEmail was not called after AutoSync error.');
        }

    } catch (e) {
        log_('TEST FAILED: ' + e.toString() + ' Stack: ' + e.stack, 'ERROR');
        success = false;
    } finally {
        mailAppSpy.restore();
        updateConfigSetting_('EnableEmailNotifications', originalEmailNotificationSetting);
        
        // Restore the original snapshot
        if (originalSnapshot) {
            props.setProperty(AUTO_SYNC_CHANGE_SIGNATURE_KEY, originalSnapshot);
        } else {
            props.deleteProperty(AUTO_SYNC_CHANGE_SIGNATURE_KEY);
        }
        
        // Cleanup the orphan sheet
        if (orphanSheet) {
            try {
                SpreadsheetApp.getActiveSpreadsheet().deleteSheet(orphanSheet);
                log_('Cleaned up orphan sheet: ' + orphanSheetName, 'INFO');
            } catch (e) {
                log_('Failed to clean up orphan sheet "' + orphanSheetName + '": ' + e.message, 'ERROR');
            }
        }

        const testStatus = success ? '✓ PASSED' : '✗ FAILED';
        log_('>>> TEST RESULT: AutoSync Error Email Test ' + testStatus, success ? 'INFO' : 'ERROR');
        log_('', 'INFO');
        SCRIPT_EXECUTION_MODE = 'DEFAULT';
    }
    return success;
}

function runEmailCapabilityTest() {
    SCRIPT_EXECUTION_MODE = 'TEST';
    let success = false;
    const startTime = new Date();
    const ui = SpreadsheetApp.getUi();
    const defaultRecipient = getConfigValue_('NotificationEmail', Session.getEffectiveUser().getEmail());

    try {
        log_('╔══════════════════════════════════════════════════════════════╗', 'INFO');
        log_('║  Email Capability Test                                       ║', 'INFO');
        log_('╚══════════════════════════════════════════════════════════════╝', 'INFO');

        const promptMessage = 'Enter the email address that should receive the test message.' +
            (defaultRecipient ? '\n\nLeave blank to send it to the configured NotificationEmail (' + defaultRecipient + ').' : '');
        const prompt = ui.prompt('Email Capability Test', promptMessage, ui.ButtonSet.OK_CANCEL);

        if (prompt.getSelectedButton() !== ui.Button.OK) {
            ui.alert('Email Capability Test cancelled.');
            return false;
        }

        let recipient = prompt.getResponseText().trim();
        if (!recipient && defaultRecipient) {
            recipient = defaultRecipient;
        }

        if (!recipient) {
            throw new Error('No recipient email provided. Please configure NotificationEmail in the Config sheet or enter an address.');
        }

        const subjectSuffix = new Date().toISOString();
        const subject = '[Drive Permission Manager] Email Capability Test - ' + subjectSuffix;
        const bodyLines = [
            'This is a live email triggered by the "Email Capability Test" from the Permissions Manager Testing menu.',
            '',
            'Receiving this message confirms that Apps Script can send outbound email as configured.',
            '',
            'Timestamp: ' + subjectSuffix,
            'Sheet URL: ' + SpreadsheetApp.getActive().getUrl()
        ];

        MailApp.sendEmail({
            to: recipient,
            subject: subject,
            body: bodyLines.join('\n')
        });

        log_('VERIFICATION PASSED: Test email sent to ' + recipient + '.', 'INFO');
        showTestMessage_('Email Sent', 'A test email was sent to ' + recipient + '. Please confirm it arrived.');
        success = true;
    } catch (e) {
        log_('TEST FAILED: ' + e.toString() + ' Stack: ' + e.stack, 'ERROR');
        showTestMessage_('Test Failed', 'The email could not be sent. Check the TestLog for details. Error: ' + e.message);
    } finally {
        const durationSeconds = ((new Date().getTime() - startTime.getTime()) / 1000).toFixed(2);
        log_('TEST DURATION: ' + durationSeconds + ' seconds', 'INFO');
        const testStatus = success ? '✓ PASSED' : '✗ FAILED';
        log_('>>> TEST RESULT: Email Capability Test ' + testStatus, success ? 'INFO' : 'ERROR');
        log_('', 'INFO');
        SCRIPT_EXECUTION_MODE = 'DEFAULT';
    }

    return success;
}

function runSheetLockingTest_() {
    SCRIPT_EXECUTION_MODE = 'TEST';
    log_('╔══════════════════════════════════════════════════════════════╗', 'INFO');
    log_('║  Sheet Locking Test                                          ║', 'INFO');
    log_('╚══════════════════════════════════════════════════════════════╝', 'INFO');

    const startTime = new Date();
    let success = false;
    const testSheetName = 'SheetLockingTestSheet_' + new Date().getTime();
    const testExecutionId = 'TEST_EXECUTION_' + new Date().getTime();
    let sheet;

    try {
        // 1. Create a temporary sheet
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        sheet = ss.insertSheet(testSheetName, ss.getSheets().length);
        log_('Created temporary sheet: ' + testSheetName, 'INFO');

        // 2. Lock the sheet
        lockSheetForEdits_(sheet, testExecutionId);

        // 3. Verify protection is on
        let protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
        const expectedDescription = 'Sync Lock by execution: ' + testExecutionId;
        if (protections.length !== 1 || protections[0].getDescription() !== expectedDescription) {
            throw new Error('VERIFICATION FAILED: Sheet was not locked correctly or description is wrong.');
        }
        log_('VERIFICATION PASSED: Sheet protection is applied.', 'INFO');

        // 4. Verify the editor is correct
        const editors = protections[0].getEditors();
        const me = Session.getEffectiveUser().getEmail();
        if (editors.length !== 1 || editors[0].getEmail() !== me) {
            throw new Error('VERIFICATION FAILED: Protection should only have one editor: the script owner.');
        }
        log_('VERIFICATION PASSED: Protection has the correct editor.', 'INFO');

        // NOTE: We cannot test that an edit fails from within the script, because a script
        // running as the owner will always have permission to edit a protected range.
        // The protection is for other users in the UI. This test verifies the protection is
        // set up correctly, which is the most we can do in an automated test.

        // 5. Unlock the sheet
        unlockSheetForEdits_(sheet, testExecutionId);

        // 6. Verify protection is off
        protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
        if (protections.length > 0) {
            throw new Error('VERIFICATION FAILED: Sheet was not unlocked correctly.');
        }
        log_('VERIFICATION PASSED: Sheet is unlocked.', 'INFO');

        // 7. Attempt to edit (should succeed)
        try {
            sheet.getRange('A1').setValue('This should succeed');
            const value = sheet.getRange('A1').getValue();
            if (value !== 'This should succeed') {
                throw new Error('VERIFICATION FAILED: Value was not set correctly after unlocking.');
            }
            log_('VERIFICATION PASSED: Edit succeeded on unlocked sheet.', 'INFO');
        } catch (e) {
            throw new Error('VERIFICATION FAILED: Edit failed on an unlocked sheet. Error: ' + e.message);
        }

        success = true;

    } catch (e) {
        log_('TEST FAILED: ' + e.toString() + ' Stack: ' + e.stack, 'ERROR');
        success = false;
    } finally {
        // 8. Cleanup
        if (sheet) {
            try {
                SpreadsheetApp.getActiveSpreadsheet().deleteSheet(sheet);
                log_('Cleaned up temporary sheet: ' + testSheetName, 'INFO');
            } catch (e) {
                log_('Error during cleanup: ' + e.message, 'ERROR');
            }
        }

        const endTime = new Date();
        const durationSeconds = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(2);
        log_('TEST DURATION: ' + durationSeconds + ' seconds', 'INFO');
        const testStatus = success ? '✓ PASSED' : '✗ FAILED';
        log_('>>> TEST RESULT: Sheet Locking Test ' + testStatus, success ? 'INFO' : 'ERROR');
        log_('', 'INFO');
        SCRIPT_EXECUTION_MODE = 'DEFAULT';
    }
    return success;
}


/**
 * Runs all three test functions in sequence.
 * Tests run: Manual Access Test, Stress Test, Add/Delete Separation Test
 */
function runAllTests() {
    SCRIPT_EXECUTION_MODE = 'TEST';
    const overallStartTime = new Date();
    const ui = SpreadsheetApp.getUi();
    const testConfig = getTestConfiguration_();

    try {
        if (shouldSkipGroupOps_()) {
            showTestMessage_('Test Aborted', 'All Tests require the Admin Directory service (Admin SDK). Please enable it or run on a Google Workspace domain.');
            return;
        }

        const response = showTestConfirm_('Run All Tests', 'This will run all tests sequentially. This may take several minutes. Continue?', ui.Button.YES);
        if (response !== ui.Button.YES) {
            showTestMessage_('All Tests cancelled.', 'The test run was cancelled.');
            return;
        }

        // Clear all existing test data before starting
        clearAllTestsData(true); // Skip confirmation since user already confirmed running tests
        SCRIPT_EXECUTION_MODE = 'TEST'; // Reset mode after clearAllTestsData (it sets to DEFAULT in finally)

        const tests = [
            { name: 'Manual Access Test', func: runManualAccessTest },
            { name: 'Stress Test', func: runStressTest },
            { name: 'Add/Delete Separation Test', func: runAddDeleteSeparationTest },
            { name: 'AutoSync Error Email Test', func: runAutoSyncErrorEmailTest },
            { name: 'Sheet Locking Test', func: runSheetLockingTest_ },
            { name: 'Circular Dependency Test', func: runCircularDependencyTest_ },
            { name: 'UserGroup Deletion Test', func: runUserGroupDeletionTest },
            { name: 'Folder-Role Deletion Test', func: runFolderRoleDeletionTest },
            { name: 'Deletion Disabled Test', func: runDeletionDisabledTest },
            { name: 'Idempotent Deletion Test', func: runIdempotentDeletionTest }
        ];

        const testResults = [];
        const totalTests = tests.length;

        tests.forEach(function(test, index) {
            log_('╔══════════════════════════════════════════════════════════════╗', 'INFO');
            log_('║  TEST ' + (index + 1) + '/' + totalTests + ': ' + test.name + ' ║', 'INFO');
            log_('╚══════════════════════════════════════════════════════════════╝', 'INFO');
            const testResult = test.func();
            SCRIPT_EXECUTION_MODE = 'TEST'; // Reset after test completes
            const testStatus = testResult ? '✓ PASSED' : '✗ FAILED';
            log_('>>> TEST RESULT: ' + test.name + ' ' + testStatus, testResult ? 'INFO' : 'ERROR');
            log_('', 'INFO');
            testResults.push(test.name + ': ' + (testResult ? 'PASSED' : 'FAILED'));
        });

        // Summary
        const overallEndTime = new Date();
        const overallDurationSeconds = ((overallEndTime.getTime() - overallStartTime.getTime()) / 1000).toFixed(2);

        const passedCount = testResults.filter(function(r) { return r.includes('PASSED'); }).length;
        const failedCount = testResults.filter(function(r) { return r.includes('FAILED'); }).length;
        const allPassed = failedCount === 0;

        log_('', 'INFO');
        log_('╔══════════════════════════════════════════════════════════════╗', 'INFO');
        log_('║                    TEST SUMMARY                              ║', 'INFO');
        log_('╚══════════════════════════════════════════════════════════════╝', 'INFO');
        log_('Total Tests Run: ' + totalTests, 'INFO');
        log_('Tests Passed: ' + passedCount + ' ✓', 'INFO');
        log_('Tests Failed: ' + failedCount + (failedCount > 0 ? ' ✗' : ''), failedCount > 0 ? 'ERROR' : 'INFO');
        log_('Overall Duration: ' + overallDurationSeconds + ' seconds', 'INFO');
        log_('', 'INFO');
        log_('Individual Test Results:', 'INFO');
        testResults.forEach(function(result) {
            const isPassed = result.includes('PASSED');
            const icon = isPassed ? '  ✓' : '  ✗';
            log_(icon + ' ' + result, isPassed ? 'INFO' : 'ERROR');
        });
        log_('', 'INFO');
        log_('═══════════════════════════════════════════════════════════════', 'INFO');
        log_(allPassed ? '✓✓✓ ALL TESTS PASSED ✓✓✓' : '✗✗✗ SOME TESTS FAILED ✗✗✗', allPassed ? 'INFO' : 'ERROR');
        log_('═══════════════════════════════════════════════════════════════', 'INFO');

        // Brief completion message (detailed results are already in TestLog)
        showTestMessage_('All Tests Complete',
                         'All ' + totalTests + ' tests completed in ' + overallDurationSeconds + ' seconds.\n\n' +
                         (allPassed ? '✓✓✓ ALL TESTS PASSED ✓✓✓' : '✗✗✗ SOME TESTS FAILED ✗✗✗') +
                         '\n\nCheck the TestLog sheet for detailed results.');

    } finally {
        SCRIPT_EXECUTION_MODE = 'DEFAULT';
    }
}

/**
 * Clears all test data, including stress test artifacts and the test log.
 * @param {boolean} skipConfirmation - If true, skip the confirmation prompt
 */
function clearAllTestsData(skipConfirmation = false) {
    SCRIPT_EXECUTION_MODE = 'TEST';
    try {
        if (!skipConfirmation) {
            const ui = SpreadsheetApp.getUi();
            const response = ui.alert('Are you sure you want to delete all test data?', 'This will delete all test folders, groups, and sheets, and clear the TestLog.', ui.ButtonSet.YES_NO);
            if (response !== ui.Button.YES) {
                return;
            }
        }

        showTestMessage_('Cleanup', 'Clearing all test data. This may take a moment.');

        const testConfig = getTestConfiguration_();
        const manualTestFolderName = testConfig.folderName;

        // Delete all test-related sheets (including orphaned ones)
        log_('Starting sheet cleanup - looking for test sheets to delete...');
        const allSheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
        log_('Found ' + allSheets.length + ' total sheets in spreadsheet');

        let deletedSheetCount = 0;
        allSheets.forEach(function (sheet) {
            const sheetName = sheet.getName();
            if (isTestSheet_(sheetName)) {
                log_('Attempting to delete sheet: ' + sheetName);
                try {
                    SpreadsheetApp.getActiveSpreadsheet().deleteSheet(sheet);
                    log_('✓ Successfully deleted sheet: ' + sheetName);
                    deletedSheetCount++;
                } catch (e) {
                    log_('✗ Could not delete sheet ' + sheetName + ': ' + e.message, 'ERROR');
                }
            }
        });
        log_('Sheet cleanup complete. Deleted ' + deletedSheetCount + ' sheets.');

        const managedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
        if (managedSheet) {
            const data = managedSheet.getDataRange().getValues();
            const rowsToDelete = [];
            for (let i = data.length - 1; i >= 1; i--) {
                const folderName = data[i][FOLDER_NAME_COL - 1];
                if (folderName && (folderName === manualTestFolderName || folderName.startsWith('StressTestFolder_'))) {
                    const folderId = data[i][FOLDER_ID_COL - 1];
                    const groupEmail = data[i][GROUP_EMAIL_COL - 1];
                    const userSheetName = data[i][USER_SHEET_NAME_COL - 1];
                    // Note: cleanupFolderData_ will try to delete the sheet, but it's already deleted above
                    // That's fine - it will log a warning and continue with group/folder cleanup
                    cleanupFolderData_(folderName, folderId, groupEmail, userSheetName);
                    rowsToDelete.push(i + 1);
                }
            }
            rowsToDelete.forEach(function (rowIndex) {
                managedSheet.deleteRow(rowIndex);
            });
        }

        // Clear the TestLog sheet
        const testLogSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TEST_LOG_SHEET_NAME);
        if (testLogSheet) {
            testLogSheet.clear();
            testLogSheet.getRange('A1:C1').setValues([['Timestamp', 'Level', 'Message']]).setFontWeight('bold');
            log_('TestLog sheet has been cleared.');
        }

        showTestMessage_('Cleanup Complete', 'All test data has been cleared.');

    } catch (e) {
        log_('Error clearing all test data: ' + e.toString(), 'ERROR');
        SpreadsheetApp.getUi().alert('An error occurred during cleanup: ' + e.message);
    } finally {
        SCRIPT_EXECUTION_MODE = 'DEFAULT';
    }
}

/**
 * Syncs a single folder from the ManagedFolders sheet by calling the main batch processor.
 * @param {number} rowIndex The row number of the folder to sync.
 * @param {boolean} addOnly - If true, only perform add operations.
 * @returns {string} The status of the sync.
 */
function syncSingleFolder_(rowIndex, addOnly = false) {
  const folderName = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME).getRange(rowIndex, 1).getValue();
  log_('Fast sync for single folder: ' + folderName + ' (row ' + rowIndex + ')');
  try {
    processManagedFolders_({
      onlySyncRowIndexes: [rowIndex],
      addOnly: addOnly,
      silentMode: true,
      executionSource: 'TEST'
    });
    return 'OK';
  } catch (e) {
    const errorMessage = 'Error in syncSingleFolder_ for row ' + rowIndex + ': ' + e.message;
    log_(errorMessage, 'ERROR');
    return errorMessage;
  }
}

/**
 * Syncs only the folders that match the given prefixes by calling the main batch processor.
 * @param {Array<string>} prefixes - An array of folder name prefixes to sync.
 * @param {boolean} addOnly - If true, only perform add operations.
 */
function testOnlySync_(prefixes, addOnly = false) {
  try {
    processManagedFolders_({
      onlySyncPrefixes: prefixes,
      addOnly: addOnly,
      silentMode: true,
      executionSource: 'TEST'
    });
  } catch (e) {
    // The core processor will log details. This is just a top-level catch.
    log_('Error during testOnlySync_: ' + e.message, 'ERROR');
  }
}

function cleanupFolderByName() {
    SCRIPT_EXECUTION_MODE = 'TEST';
    try {
        if (shouldSkipGroupOps_()) {
            showTestMessage_('Cleanup Aborted', 'Cleanup requires the Admin Directory service (Admin SDK). Please enable it or run on a Google Workspace domain.');
            return;
        }
        const ui = SpreadsheetApp.getUi();
        const testConfig = getTestConfiguration_();

        const folderNamePrompt = ui.prompt('Enter the exact name of the folder to clean up:');
        if (folderNamePrompt.getSelectedButton() !== ui.Button.OK || !folderNamePrompt.getResponseText()) {
            return;
        }
        const folderName = folderNamePrompt.getResponseText();

        const managedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
        const data = managedSheet.getDataRange().getValues();
        let rowIndexToDelete = -1;
        let folderId, groupEmail, userSheetName;

        for (let i = 1; i < data.length; i++) {
            if (data[i][FOLDER_NAME_COL - 1] === folderName) {
                rowIndexToDelete = i + 1;
                folderId = data[i][FOLDER_ID_COL - 1];
                groupEmail = data[i][GROUP_EMAIL_COL - 1];
                userSheetName = data[i][USER_SHEET_NAME_COL - 1];
                break;
            }
        }

        if (rowIndexToDelete === -1) {
            showTestMessage_('Error', 'Folder not found in the ManagedFolders sheet.');
            return;
        }

        let response = ui.Button.YES;
        if (testConfig.autoConfirm !== true) {
            response = ui.alert('Are you sure you want to delete all data for folder "' + folderName + '"?', 'This will delete the folder, group, and sheet.', ui.ButtonSet.YES_NO);
        }
        if (response !== ui.Button.YES) {
            return;
        }

        cleanupFolderData_(folderName, folderId, groupEmail, userSheetName);
        managedSheet.deleteRow(rowIndexToDelete);

        showTestMessage_('Cleanup', 'Cleanup Complete for ' + folderName);
    } finally {
        SCRIPT_EXECUTION_MODE = 'DEFAULT';
    }
}

function removeBlankRows() {
    let totalRowsDeleted = 0;

    /**
     * Helper function to remove blank rows from a specific sheet.
     * A row is considered blank if its key identifying column(s) are empty.
     * @param {string} sheetName The name of the sheet to clean.
     * @param {Array<number>} keyColumnIndexes An array of 1-based column indexes to check. If all are empty, the row is deleted.
     */
    function _removeBlankRowsFromSheet(sheetName, keyColumnIndexes = [1]) {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
        if (!sheet) {
            log_(`removeBlankRows: Sheet "${sheetName}" not found.`, 'WARN');
            return 0;
        }

        const lastRow = sheet.getLastRow();
        if (lastRow <= 1) {
            return 0; // Nothing to do
        }

        const data = sheet.getDataRange().getValues();
        let deletedCount = 0;

        // Iterate backwards to safely delete rows without messing up indices
        for (let i = data.length - 1; i >= 1; i--) { // Start from bottom, skip header
            const rowData = data[i];
            
            // A row is considered effectively blank if all its key columns are empty.
            const isEffectivelyBlank = keyColumnIndexes.every(colIndex => {
                const cellValue = rowData[colIndex - 1]; // convert 1-based to 0-based
                return !cellValue || String(cellValue).trim() === '';
            });
            
            if (isEffectivelyBlank) {
                sheet.deleteRow(i + 1); // sheet rows are 1-indexed
                deletedCount++;
            }
        }
        
        if (deletedCount > 0) {
            log_(`Removed ${deletedCount} blank row(s) from "${sheetName}".`);
        }
        return deletedCount;
    }

    try {
        // For ManagedFolders, a row is blank if Column A (FolderName) is empty.
        totalRowsDeleted += _removeBlankRowsFromSheet(MANAGED_FOLDERS_SHEET_NAME, [FOLDER_NAME_COL]);
        
        // For UserGroups, a row is blank if Column A (GroupName) is empty.
        const ugSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USER_GROUPS_SHEET_NAME);
        if(ugSheet) {
          const ugHeaders = getHeaderMap_(ugSheet);
          const groupNameCol = resolveColumn_(ugHeaders, 'groupname', 1);
          totalRowsDeleted += _removeBlankRowsFromSheet(USER_GROUPS_SHEET_NAME, [groupNameCol]);
        }

        if (totalRowsDeleted > 0) {
            SpreadsheetApp.getUi().alert(totalRowsDeleted + ' blank row(s) have been removed from the configuration sheets.');
        } else {
            SpreadsheetApp.getUi().alert('No blank rows found in ManagedFolders or UserGroups sheets.');
        }
    } catch (e) {
        log_('Error in removeBlankRows: ' + e.message, 'ERROR');
        SpreadsheetApp.getUi().alert('An error occurred while removing blank rows: ' + e.message);
    }
}

function runCircularDependencyTest_() {
    SCRIPT_EXECUTION_MODE = 'TEST';
    log_('╔══════════════════════════════════════════════════════════════╗', 'INFO');
    log_('║  Circular Dependency Test                                    ║', 'INFO');
    log_('╚══════════════════════════════════════════════════════════════╝', 'INFO');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const userGroupsSheet = ss.getSheetByName(USER_GROUPS_SHEET_NAME);
    const sheetA = ss.insertSheet('TestCycleA_G', ss.getSheets().length);
    const sheetB = ss.insertSheet('TestCycleB_G', ss.getSheets().length);
    let success = false;

    try {
        // 1. Setup the circular dependency
        const groupA_Name = 'TestCycleA';
        const groupA_Email = 'test-cycle-a@' + Session.getActiveUser().getEmail().split('@')[1];
        const groupB_Name = 'TestCycleB';
        const groupB_Email = 'test-cycle-b@' + Session.getActiveUser().getEmail().split('@')[1];

        // Add Group B to Group A's sheet
        sheetA.getRange('A2').setValue(groupB_Email);
        // Add Group A to Group B's sheet
        sheetB.getRange('A2').setValue(groupA_Email);

        // Add entries to UserGroups sheet
        userGroupsSheet.appendRow([groupA_Name, groupA_Email]);
        userGroupsSheet.appendRow([groupB_Name, groupB_Email]);

        log_('Created circular dependency: TestCycleA -> TestCycleB -> TestCycleA', 'INFO');

        // 2. Run the validation
        try {
            validateGroupNesting_();
            // If it reaches here, the test failed because no error was thrown
            throw new Error('VERIFICATION FAILED: validateGroupNesting_ did not throw an error for a circular dependency.');
        } catch (e) {
            if (e.message.includes('Circular dependency detected')) {
                log_('VERIFICATION PASSED: Correctly detected circular dependency. Error: ' + e.message, 'INFO');
                success = true;
            } else {
                // Re-throw if it's an unexpected error
                throw e;
            }
        }
    } catch (e) {
        log_('TEST FAILED: ' + e.toString() + ' Stack: ' + e.stack, 'ERROR');
        success = false;
    } finally {
        // 3. Cleanup
        ss.deleteSheet(sheetA);
        ss.deleteSheet(sheetB);

        const data = userGroupsSheet.getDataRange().getValues();
        for (let i = data.length - 1; i >= 1; i--) {
            if (data[i][0] === 'TestCycleA' || data[i][0] === 'TestCycleB') {
                userGroupsSheet.deleteRow(i + 1);
            }
        }
        log_('Cleaned up circular dependency test data.');
        
        const testStatus = success ? '✓ PASSED' : '✗ FAILED';
        log_('>>> TEST RESULT: Circular Dependency Test ' + testStatus, success ? 'INFO' : 'ERROR');
        log_('', 'INFO');
        SCRIPT_EXECUTION_MODE = 'DEFAULT';
    }
    return success;
}

/**
 * Test: UserGroup Deletion
 * Tests that a UserGroup can be deleted via the Delete checkbox.
 * Verifies: group deleted, sheet deleted, row removed, summary correct.
 */
function runUserGroupDeletionTest() {
    SCRIPT_EXECUTION_MODE = 'TEST';  // Set mode FIRST before any logging

    const testName = 'UserGroup Deletion Test';
    log_('', 'INFO');
    log_('========================================', 'INFO');
    log_('>>> RUNNING TEST: ' + testName, 'INFO');
    log_('========================================', 'INFO');

    let success = true;
    let testGroupName = '';
    let testGroupEmail = '';

    try {

        // Prerequisites
        const deletionEnabled = getConfigValue_('AllowGroupFolderDeletion', false);
        if (!deletionEnabled) {
            log_('⚠️ Test requires AllowGroupFolderDeletion=true in Config', 'WARN');
            log_('Setting AllowGroupFolderDeletion=true for test...', 'INFO');
            const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
            const configData = configSheet.getDataRange().getValues();
            for (let i = 1; i < configData.length; i++) {
                if (configData[i][0] === 'AllowGroupFolderDeletion') {
                    configSheet.getRange(i + 1, 2).setValue(true);
                    log_('✓ Set AllowGroupFolderDeletion=true', 'INFO');
                    break;
                }
            }
        }

        // 1. Setup: Create test UserGroup
        testGroupName = 'TestDeleteGroup_' + new Date().getTime();
        testGroupEmail = testGroupName.toLowerCase().replace(/[^a-z0-9]/g, '') + '@' + Session.getActiveUser().getEmail().split('@')[1];

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const userGroupsSheet = ss.getSheetByName('UserGroups');

        // Add group row
        const lastRow = userGroupsSheet.getLastRow();
        userGroupsSheet.getRange(lastRow + 1, 1, 1, 6).setValues([[
            testGroupName,
            testGroupEmail,
            '', // Admin link (will be populated by sync)
            '', // Last Synced
            '', // Status
            false // Delete checkbox
        ]]);
        log_('✓ Added test group to UserGroups: ' + testGroupName, 'INFO');

        // Create group sheet with test member
        const testSheet = ss.insertSheet(testGroupName + '_G', ss.getSheets().length);
        testSheet.getRange('A1:A2').setValues([['Email'], ['test.member@example.com']]);
        log_('✓ Created group sheet: ' + testGroupName + '_G', 'INFO');

        // Run sync to create actual Google Group
        log_('Running sync to create Google Group...', 'INFO');
        syncUserGroups({ dryRun: false });

        // Verify group was created
        const groupData = userGroupsSheet.getDataRange().getValues();
        let groupRow = -1;
        for (let i = 1; i < groupData.length; i++) {
            if (groupData[i][0] === testGroupName) {
                groupRow = i;
                break;
            }
        }

        if (groupRow === -1) {
            throw new Error('Test group row not found after sync');
        }

        const groupStatus = groupData[groupRow][4]; // Status column
        if (groupStatus && groupStatus.includes('ERROR')) {
            throw new Error('Group sync failed: ' + groupStatus);
        }

        log_('✓ Group synced successfully', 'INFO');

        // 2. Mark for deletion
        userGroupsSheet.getRange(groupRow + 1, USERGROUPS_DELETE_COL).setValue(true);
        log_('✓ Marked group for deletion (Delete checkbox = true)', 'INFO');

        // 3. Process deletions
        log_('Processing deletion requests...', 'INFO');
        const deletionSummary = processDeletionRequests_({ dryRun: false });

        // 4. Verify deletion
        if (deletionSummary.skipped) {
            throw new Error('Deletion was skipped (feature disabled?)');
        }

        if (deletionSummary.userGroupsDeleted !== 1) {
            throw new Error('Expected 1 group deleted, got: ' + deletionSummary.userGroupsDeleted);
        }

        log_('✓ Deletion summary correct: 1 group deleted', 'INFO');

        // Verify Google Group is deleted
        try {
            AdminDirectory.Groups.get(testGroupEmail);
            throw new Error('Google Group still exists after deletion');
        } catch (e) {
            if (e.message.includes('Resource Not Found') || e.message.includes('notFound')) {
                log_('✓ Google Group deleted successfully', 'INFO');
            } else {
                throw e;
            }
        }

        // Verify sheet is deleted
        const sheetStillExists = ss.getSheetByName(testGroupName + '_G');
        if (sheetStillExists) {
            throw new Error('Group sheet still exists after deletion');
        }
        log_('✓ Group sheet deleted', 'INFO');

        // Verify row removed from UserGroups
        const updatedData = userGroupsSheet.getDataRange().getValues();
        let rowStillExists = false;
        for (let i = 1; i < updatedData.length; i++) {
            if (updatedData[i][0] === testGroupName) {
                rowStillExists = true;
                break;
            }
        }

        if (rowStillExists) {
            throw new Error('Group row still exists in UserGroups after deletion');
        }
        log_('✓ Group row removed from UserGroups', 'INFO');

        log_('✓ All verifications passed', 'INFO');

    } catch (err) {
        success = false;
        log_('✗ TEST FAILED: ' + err.message, 'ERROR');
        log_(err.stack, 'ERROR');

        // Cleanup on error
        try {
            const ss = SpreadsheetApp.getActiveSpreadsheet();
            const testSheet = ss.getSheetByName(testGroupName + '_G');
            if (testSheet) {
                ss.deleteSheet(testSheet);
                log_('Cleaned up test sheet', 'INFO');
            }

            const userGroupsSheet = ss.getSheetByName('UserGroups');
            const data = userGroupsSheet.getDataRange().getValues();
            for (let i = data.length - 1; i >= 1; i--) {
                if (data[i][0] && data[i][0].startsWith('TestDeleteGroup_')) {
                    userGroupsSheet.deleteRow(i + 1);
                }
            }
            log_('Cleaned up test group rows', 'INFO');
        } catch (cleanupErr) {
            log_('Cleanup error: ' + cleanupErr.message, 'WARN');
        }
    } finally {
        const testStatus = success ? '✓ PASSED' : '✗ FAILED';
        log_('>>> TEST RESULT: ' + testName + ' ' + testStatus, success ? 'INFO' : 'ERROR');
        log_('', 'INFO');
        SCRIPT_EXECUTION_MODE = 'DEFAULT';
    }
    return success;
}

/**
 * Test: Folder-Role Deletion
 * Tests that a folder-role binding can be deleted via the Delete checkbox.
 * Verifies: group deleted, sheet deleted, row removed, folder NOT deleted, summary correct.
 */
function runFolderRoleDeletionTest() {
    SCRIPT_EXECUTION_MODE = 'TEST';  // Set mode FIRST before any logging

    const testName = 'Folder-Role Deletion Test';
    log_('', 'INFO');
    log_('========================================', 'INFO');
    log_('>>> RUNNING TEST: ' + testName, 'INFO');
    log_('========================================', 'INFO');

    let success = true;
    let testFolderId = null;
    let testFolderName = null;
    let testUserSheetName = '';

    try {

        // Prerequisites
        const deletionEnabled = getConfigValue_('AllowGroupFolderDeletion', false);
        if (!deletionEnabled) {
            log_('⚠️ Test requires AllowGroupFolderDeletion=true in Config', 'WARN');
            log_('Setting AllowGroupFolderDeletion=true for test...', 'INFO');
            const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
            const configData = configSheet.getDataRange().getValues();
            for (let i = 1; i < configData.length; i++) {
                if (configData[i][0] === 'AllowGroupFolderDeletion') {
                    configSheet.getRange(i + 1, 2).setValue(true);
                    log_('✓ Set AllowGroupFolderDeletion=true', 'INFO');
                    break;
                }
            }
        }

        // 1. Setup: Create test folder in Drive
        testFolderName = 'TestDeleteFolder_' + new Date().getTime();
        const testFolder = DriveApp.createFolder(testFolderName);
        testFolderId = testFolder.getId();
        log_('✓ Created test folder in Drive: ' + testFolderName + ' (ID: ' + testFolderId + ')', 'INFO');

        // 2. Add folder-role to ManagedFolders
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const managedFoldersSheet = ss.getSheetByName('ManagedFolders');
        const testRole = 'reader';
        testUserSheetName = 'TestDeleteFolderUsers';

        // Create user sheet
        const testUserSheet = ss.insertSheet(testUserSheetName, ss.getSheets().length);
        testUserSheet.getRange('A1:A2').setValues([['Email'], ['test.user@example.com']]);
        log_('✓ Created user sheet: ' + testUserSheetName, 'INFO');

        // Add to ManagedFolders
        const lastRow = managedFoldersSheet.getLastRow();
        managedFoldersSheet.getRange(lastRow + 1, 1, 1, 9).setValues([[
            testFolderName,
            testFolderId,
            testRole,
            '', // GroupEmail (will be populated by sync)
            testUserSheetName,
            '', // Last Synced
            '', // Status
            '', // URL
            false // Delete checkbox
        ]]);
        log_('✓ Added folder-role to ManagedFolders', 'INFO');

        // Run sync to create group and permissions
        log_('Running sync to create group and permissions...', 'INFO');
        processManagedFolders_({ dryRun: false });

        // Verify sync succeeded
        const folderData = managedFoldersSheet.getDataRange().getValues();
        let folderRow = -1;
        for (let i = 1; i < folderData.length; i++) {
            if (folderData[i][1] === testFolderId) {
                folderRow = i;
                break;
            }
        }

        if (folderRow === -1) {
            throw new Error('Test folder row not found after sync');
        }

        const folderStatus = folderData[folderRow][6]; // Status column
        if (folderStatus && folderStatus.includes('ERROR')) {
            throw new Error('Folder sync failed: ' + folderStatus);
        }

        const groupEmail = folderData[folderRow][3];
        if (!groupEmail) {
            throw new Error('Group email not populated after sync');
        }

        log_('✓ Folder-role synced successfully, group email: ' + groupEmail, 'INFO');

        // 3. Mark for deletion
        managedFoldersSheet.getRange(folderRow + 1, DELETE_COL).setValue(true);
        log_('✓ Marked folder-role for deletion (Delete checkbox = true)', 'INFO');

        // 4. Process deletions
        log_('Processing deletion requests...', 'INFO');
        const deletionSummary = processDeletionRequests_({ dryRun: false });

        // 5. Verify deletion
        if (deletionSummary.skipped) {
            throw new Error('Deletion was skipped (feature disabled?)');
        }

        if (deletionSummary.foldersDeleted !== 1) {
            throw new Error('Expected 1 folder-binding deleted, got: ' + deletionSummary.foldersDeleted);
        }

        log_('✓ Deletion summary correct: 1 folder-binding deleted', 'INFO');

        // Verify Google Group is deleted
        try {
            AdminDirectory.Groups.get(groupEmail);
            throw new Error('Google Group still exists after deletion');
        } catch (e) {
            if (e.message.includes('Resource Not Found') || e.message.includes('notFound')) {
                log_('✓ Google Group deleted successfully', 'INFO');
            } else {
                throw e;
            }
        }

        // Verify user sheet is deleted
        const userSheetStillExists = ss.getSheetByName(testUserSheetName);
        if (userSheetStillExists) {
            throw new Error('User sheet still exists after deletion');
        }
        log_('✓ User sheet deleted', 'INFO');

        // Verify row removed from ManagedFolders
        const updatedData = managedFoldersSheet.getDataRange().getValues();
        let rowStillExists = false;
        for (let i = 1; i < updatedData.length; i++) {
            if (updatedData[i][1] === testFolderId) {
                rowStillExists = true;
                break;
            }
        }

        if (rowStillExists) {
            throw new Error('Folder-role row still exists in ManagedFolders after deletion');
        }
        log_('✓ Folder-role row removed from ManagedFolders', 'INFO');

        // CRITICAL: Verify folder still exists in Drive
        try {
            const folder = DriveApp.getFolderById(testFolderId);
            log_('✓ CRITICAL VERIFICATION PASSED: Folder still exists in Drive (ID: ' + testFolderId + ')', 'INFO');
        } catch (e) {
            throw new Error('CRITICAL FAILURE: Folder was deleted from Drive! This violates the design requirement.');
        }

        log_('✓ All verifications passed', 'INFO');

    } catch (err) {
        success = false;
        log_('✗ TEST FAILED: ' + err.message, 'ERROR');
        log_(err.stack, 'ERROR');

        // Cleanup on error
        try {
            const ss = SpreadsheetApp.getActiveSpreadsheet();
            const testUserSheet = ss.getSheetByName(testUserSheetName);
            if (testUserSheet) {
                ss.deleteSheet(testUserSheet);
                log_('Cleaned up test user sheet', 'INFO');
            }

            const managedFoldersSheet = ss.getSheetByName('ManagedFolders');
            const data = managedFoldersSheet.getDataRange().getValues();
            for (let i = data.length - 1; i >= 1; i--) {
                if (data[i][0] && data[i][0].startsWith('TestDeleteFolder_')) {
                    managedFoldersSheet.deleteRow(i + 1);
                }
            }
            log_('Cleaned up test folder rows', 'INFO');
        } catch (cleanupErr) {
            log_('Cleanup error: ' + cleanupErr.message, 'WARN');
        }
    } finally {
        // Cleanup test folder from Drive
        if (testFolderId) {
            try {
                const folder = DriveApp.getFolderById(testFolderId);
                folder.setTrashed(true);
                log_('Cleaned up test folder from Drive', 'INFO');
            } catch (e) {
                log_('Could not cleanup test folder: ' + e.message, 'WARN');
            }
        }

        const testStatus = success ? '✓ PASSED' : '✗ FAILED';
        log_('>>> TEST RESULT: ' + testName + ' ' + testStatus, success ? 'INFO' : 'ERROR');
        log_('', 'INFO');
        SCRIPT_EXECUTION_MODE = 'DEFAULT';
    }
    return success;
}

/**
 * Test: Deletion Disabled in Config
 * Tests that deletions are skipped when AllowGroupFolderDeletion is false.
 * Verifies: deletion skipped, row remains, status shows warning.
 */
function runDeletionDisabledTest() {
    SCRIPT_EXECUTION_MODE = 'TEST';  // Set mode FIRST before any logging

    const testName = 'Deletion Disabled Test';
    log_('', 'INFO');
    log_('========================================', 'INFO');
    log_('>>> RUNNING TEST: ' + testName, 'INFO');
    log_('========================================', 'INFO');

    let success = true;
    const testGroupName = 'TestDisabledDeleteGroup_' + new Date().getTime();

    try {

        // 1. Ensure AllowGroupFolderDeletion is FALSE
        const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
        const configData = configSheet.getDataRange().getValues();
        let configRow = -1;
        for (let i = 1; i < configData.length; i++) {
            if (configData[i][0] === 'AllowGroupFolderDeletion') {
                configRow = i;
                break;
            }
        }

        if (configRow === -1) {
            throw new Error('AllowGroupFolderDeletion setting not found in Config');
        }

        const originalValue = configData[configRow][1];
        configSheet.getRange(configRow + 1, 2).setValue(false);
        log_('✓ Set AllowGroupFolderDeletion=false', 'INFO');

        // 2. Add test group row marked for deletion
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const userGroupsSheet = ss.getSheetByName('UserGroups');

        const lastRow = userGroupsSheet.getLastRow();
        userGroupsSheet.getRange(lastRow + 1, 1, 1, 6).setValues([[
            testGroupName,
            testGroupName.toLowerCase() + '@example.com',
            '',
            '',
            '',
            true // Delete checkbox = true
        ]]);
        log_('✓ Added test group with Delete=true', 'INFO');

        // 3. Process deletions (should skip)
        log_('Processing deletion requests (should skip)...', 'INFO');
        const deletionSummary = processDeletionRequests_({ dryRun: false });

        // 4. Verify deletion was skipped
        if (!deletionSummary.skipped) {
            throw new Error('Deletion was not skipped when AllowGroupFolderDeletion=false');
        }

        if (deletionSummary.reason !== 'disabled') {
            throw new Error('Expected skip reason "disabled", got: ' + deletionSummary.reason);
        }

        log_('✓ Deletion correctly skipped (feature disabled)', 'INFO');

        // 5. Verify row still exists
        const data = userGroupsSheet.getDataRange().getValues();
        let rowFound = false;
        let statusValue = '';
        for (let i = 1; i < data.length; i++) {
            if (data[i][0] === testGroupName) {
                rowFound = true;
                statusValue = data[i][4]; // Status column
                break;
            }
        }

        if (!rowFound) {
            throw new Error('Test group row was removed despite feature being disabled');
        }
        log_('✓ Group row still exists (not deleted)', 'INFO');

        // 6. Verify status shows warning
        if (!statusValue || !statusValue.includes('Deletion disabled')) {
            throw new Error('Expected status to show deletion disabled warning, got: ' + statusValue);
        }
        log_('✓ Status correctly shows "⚠️ Deletion disabled in Config"', 'INFO');

        // 7. Cleanup
        for (let i = data.length - 1; i >= 1; i--) {
            if (data[i][0] === testGroupName) {
                userGroupsSheet.deleteRow(i + 1);
                break;
            }
        }
        log_('✓ Cleaned up test group row', 'INFO');

        // Restore original config value
        configSheet.getRange(configRow + 1, 2).setValue(originalValue);
        log_('✓ Restored AllowGroupFolderDeletion to original value', 'INFO');

        log_('✓ All verifications passed', 'INFO');

    } catch (err) {
        success = false;
        log_('✗ TEST FAILED: ' + err.message, 'ERROR');
        log_(err.stack, 'ERROR');

        // Cleanup on error
        try {
            const ss = SpreadsheetApp.getActiveSpreadsheet();
            const userGroupsSheet = ss.getSheetByName('UserGroups');
            const data = userGroupsSheet.getDataRange().getValues();
            for (let i = data.length - 1; i >= 1; i--) {
                if (data[i][0] && data[i][0].startsWith('TestDisabledDeleteGroup_')) {
                    userGroupsSheet.deleteRow(i + 1);
                }
            }
            log_('Cleaned up test group rows', 'INFO');
        } catch (cleanupErr) {
            log_('Cleanup error: ' + cleanupErr.message, 'WARN');
        }
    } finally {
        const testStatus = success ? '✓ PASSED' : '✗ FAILED';
        log_('>>> TEST RESULT: ' + testName + ' ' + testStatus, success ? 'INFO' : 'ERROR');
        log_('', 'INFO');
        SCRIPT_EXECUTION_MODE = 'DEFAULT';
    }
    return success;
}

/**
 * Test: Idempotent Deletion
 * Tests that attempting to delete an already-deleted group is handled gracefully.
 * Verifies: no errors, row still removed, logs warning not error.
 */
function runIdempotentDeletionTest() {
    SCRIPT_EXECUTION_MODE = 'TEST';  // Set mode FIRST before any logging

    const testName = 'Idempotent Deletion Test';
    log_('', 'INFO');
    log_('========================================', 'INFO');
    log_('>>> RUNNING TEST: ' + testName, 'INFO');
    log_('========================================', 'INFO');

    let success = true;
    const testGroupName = 'TestIdempotentDelete_' + new Date().getTime();
    const testGroupEmail = testGroupName.toLowerCase().replace(/[^a-z0-9]/g, '') + '@' + Session.getActiveUser().getEmail().split('@')[1];

    try {

        // Prerequisites
        const deletionEnabled = getConfigValue_('AllowGroupFolderDeletion', false);
        if (!deletionEnabled) {
            log_('⚠️ Test requires AllowGroupFolderDeletion=true in Config', 'WARN');
            log_('Setting AllowGroupFolderDeletion=true for test...', 'INFO');
            const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
            const configData = configSheet.getDataRange().getValues();
            for (let i = 1; i < configData.length; i++) {
                if (configData[i][0] === 'AllowGroupFolderDeletion') {
                    configSheet.getRange(i + 1, 2).setValue(true);
                    log_('✓ Set AllowGroupFolderDeletion=true', 'INFO');
                    break;
                }
            }
        }

        // 1. Add group row WITHOUT creating the actual Google Group
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const userGroupsSheet = ss.getSheetByName('UserGroups');

        const lastRow = userGroupsSheet.getLastRow();
        userGroupsSheet.getRange(lastRow + 1, 1, 1, 6).setValues([[
            testGroupName,
            testGroupEmail,
            '',
            '',
            '',
            true // Delete checkbox = true
        ]]);
        log_('✓ Added test group row (without creating actual Google Group)', 'INFO');

        // 2. Verify group does NOT exist in Google
        let groupExistsInitially = false;
        try {
            AdminDirectory.Groups.get(testGroupEmail);
            groupExistsInitially = true;
        } catch (e) {
            if (e.message.includes('Resource Not Found') || e.message.includes('notFound')) {
                log_('✓ Confirmed: Google Group does not exist initially', 'INFO');
            } else {
                throw e;
            }
        }

        if (groupExistsInitially) {
            throw new Error('Test group already exists in Google (test setup failed)');
        }

        // 3. Process deletions (should handle gracefully)
        log_('Processing deletion requests (group does not exist)...', 'INFO');
        const deletionSummary = processDeletionRequests_({ dryRun: false });

        // 4. Verify no exceptions were thrown (we got here!)
        log_('✓ Deletion processing completed without exceptions', 'INFO');

        // 5. Verify deletion summary shows the attempt
        if (deletionSummary.userGroupsDeleted !== 1) {
            throw new Error('Expected deletion count of 1, got: ' + deletionSummary.userGroupsDeleted);
        }
        log_('✓ Deletion summary correct: 1 group deletion processed', 'INFO');

        // 6. Verify row was removed despite group not existing
        const data = userGroupsSheet.getDataRange().getValues();
        let rowStillExists = false;
        for (let i = 1; i < data.length; i++) {
            if (data[i][0] === testGroupName) {
                rowStillExists = true;
                break;
            }
        }

        if (rowStillExists) {
            throw new Error('Group row still exists after deletion attempt');
        }
        log_('✓ Group row removed successfully', 'INFO');

        // 7. Check logs to verify warning (not error) was logged
        // This is a manual verification - the test passes if we got here without exceptions
        log_('✓ Idempotent deletion handled gracefully (check Log sheet for warning message)', 'INFO');

        log_('✓ All verifications passed', 'INFO');

    } catch (err) {
        success = false;
        log_('✗ TEST FAILED: ' + err.message, 'ERROR');
        log_(err.stack, 'ERROR');

        // Cleanup on error
        try {
            const ss = SpreadsheetApp.getActiveSpreadsheet();
            const userGroupsSheet = ss.getSheetByName('UserGroups');
            const data = userGroupsSheet.getDataRange().getValues();
            for (let i = data.length - 1; i >= 1; i--) {
                if (data[i][0] && data[i][0].startsWith('TestIdempotentDelete_')) {
                    userGroupsSheet.deleteRow(i + 1);
                }
            }
            log_('Cleaned up test group rows', 'INFO');

            // Try to cleanup Google Group if it somehow was created
            try {
                AdminDirectory.Groups.remove(testGroupEmail);
                log_('Cleaned up test Google Group', 'INFO');
            } catch (e) {
                // Expected if group doesn't exist
            }
        } catch (cleanupErr) {
            log_('Cleanup error: ' + cleanupErr.message, 'WARN');
        }
    } finally {
        const testStatus = success ? '✓ PASSED' : '✗ FAILED';
        log_('>>> TEST RESULT: ' + testName + ' ' + testStatus, success ? 'INFO' : 'ERROR');
        log_('', 'INFO');
        SCRIPT_EXECUTION_MODE = 'DEFAULT';
    }
    return success;
}

/**
 * Run all deletion-related tests
 * Provides a comprehensive test suite for the deletion feature.
 */
function runAllDeletionTests() {
    log_('', 'INFO');
    log_('════════════════════════════════════════', 'INFO');
    log_('>>> DELETION FEATURE TEST SUITE', 'INFO');
    log_('════════════════════════════════════════', 'INFO');
    log_('', 'INFO');

    const results = {
        total: 0,
        passed: 0,
        failed: 0,
        tests: []
    };

    // Test 1: UserGroup Deletion
    log_('Starting Test 1/4: UserGroup Deletion...', 'INFO');
    const test1 = runUserGroupDeletionTest();
    results.total++;
    if (test1) {
        results.passed++;
        results.tests.push({ name: 'UserGroup Deletion', passed: true });
    } else {
        results.failed++;
        results.tests.push({ name: 'UserGroup Deletion', passed: false });
    }

    // Test 2: Folder-Role Deletion
    log_('Starting Test 2/4: Folder-Role Deletion...', 'INFO');
    const test2 = runFolderRoleDeletionTest();
    results.total++;
    if (test2) {
        results.passed++;
        results.tests.push({ name: 'Folder-Role Deletion', passed: true });
    } else {
        results.failed++;
        results.tests.push({ name: 'Folder-Role Deletion', passed: false });
    }

    // Test 3: Deletion Disabled
    log_('Starting Test 3/4: Deletion Disabled...', 'INFO');
    const test3 = runDeletionDisabledTest();
    results.total++;
    if (test3) {
        results.passed++;
        results.tests.push({ name: 'Deletion Disabled', passed: true });
    } else {
        results.failed++;
        results.tests.push({ name: 'Deletion Disabled', passed: false });
    }

    // Test 4: Idempotent Deletion
    log_('Starting Test 4/4: Idempotent Deletion...', 'INFO');
    const test4 = runIdempotentDeletionTest();
    results.total++;
    if (test4) {
        results.passed++;
        results.tests.push({ name: 'Idempotent Deletion', passed: true });
    } else {
        results.failed++;
        results.tests.push({ name: 'Idempotent Deletion', passed: false });
    }

    // Summary
    log_('', 'INFO');
    log_('════════════════════════════════════════', 'INFO');
    log_('>>> TEST SUITE SUMMARY', 'INFO');
    log_('════════════════════════════════════════', 'INFO');
    log_('Total Tests: ' + results.total, 'INFO');
    log_('Passed: ' + results.passed + ' ✓', 'INFO');
    log_('Failed: ' + results.failed + (results.failed > 0 ? ' ✗' : ''), results.failed > 0 ? 'ERROR' : 'INFO');
    log_('', 'INFO');

    log_('Test Results:', 'INFO');
    for (let i = 0; i < results.tests.length; i++) {
        const test = results.tests[i];
        const status = test.passed ? '✓ PASSED' : '✗ FAILED';
        log_('  ' + (i + 1) + '. ' + test.name + ': ' + status, test.passed ? 'INFO' : 'ERROR');
    }

    log_('', 'INFO');
    const overallStatus = results.failed === 0 ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED';
    log_('>>> ' + overallStatus, results.failed === 0 ? 'INFO' : 'ERROR');
    log_('════════════════════════════════════════', 'INFO');
    log_('', 'INFO');

    return results.failed === 0;
}

/**
 * Cleanup function for deletion test data
 * Removes any orphaned test data left by failed deletion tests.
 */
function cleanupDeletionTestData() {
    SCRIPT_EXECUTION_MODE = 'TEST';
    try {
        const ui = SpreadsheetApp.getUi();
        const response = ui.alert(
            'Cleanup Deletion Test Data',
            'This will remove any leftover test data from deletion tests:\n\n' +
            '• Test groups starting with "TestDelete", "TestDisabled", "TestIdempotent"\n' +
            '• Test sheets with those prefixes\n' +
            '• Test folders in Drive starting with "TestDeleteFolder_"\n\n' +
            'Continue?',
            ui.ButtonSet.YES_NO
        );

        if (response !== ui.Button.YES) {
            log_('Deletion test cleanup cancelled by user.', 'INFO');
            return;
        }

        log_('Starting deletion test data cleanup...', 'INFO');
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let cleanupCount = 0;

        // 1. Clean up test groups from UserGroups sheet
        const userGroupsSheet = ss.getSheetByName('UserGroups');
        if (userGroupsSheet) {
            const data = userGroupsSheet.getDataRange().getValues();
            for (let i = data.length - 1; i >= 1; i--) {
                const groupName = data[i][0];
                const groupEmail = data[i][1];
                if (groupName && (
                    groupName.startsWith('TestDeleteGroup_') ||
                    groupName.startsWith('TestDisabledDeleteGroup_') ||
                    groupName.startsWith('TestIdempotentDelete_')
                )) {
                    // Try to delete Google Group
                    if (groupEmail) {
                        try {
                            AdminDirectory.Groups.remove(groupEmail);
                            log_('Deleted test Google Group: ' + groupEmail, 'INFO');
                        } catch (e) {
                            log_('Could not delete Google Group ' + groupEmail + ': ' + e.message, 'WARN');
                        }
                    }
                    // Delete row
                    userGroupsSheet.deleteRow(i + 1);
                    cleanupCount++;
                    log_('Removed test group row: ' + groupName, 'INFO');
                }
            }
        }

        // 2. Clean up test folder rows from ManagedFolders sheet
        const managedFoldersSheet = ss.getSheetByName('ManagedFolders');
        if (managedFoldersSheet) {
            const data = managedFoldersSheet.getDataRange().getValues();
            for (let i = data.length - 1; i >= 1; i--) {
                const folderName = data[i][0];
                const groupEmail = data[i][3];
                if (folderName && folderName.startsWith('TestDeleteFolder_')) {
                    // Try to delete Google Group
                    if (groupEmail) {
                        try {
                            AdminDirectory.Groups.remove(groupEmail);
                            log_('Deleted test Google Group: ' + groupEmail, 'INFO');
                        } catch (e) {
                            log_('Could not delete Google Group ' + groupEmail + ': ' + e.message, 'WARN');
                        }
                    }
                    // Delete row
                    managedFoldersSheet.deleteRow(i + 1);
                    cleanupCount++;
                    log_('Removed test folder row: ' + folderName, 'INFO');
                }
            }
        }

        // 3. Clean up test sheets
        const sheets = ss.getSheets();
        for (let i = 0; i < sheets.length; i++) {
            const sheet = sheets[i];
            const name = sheet.getName();
            if (name.startsWith('TestDeleteGroup_') ||
                name.startsWith('TestDisabledDeleteGroup_') ||
                name.startsWith('TestIdempotentDelete_') ||
                name.startsWith('TestDeleteFolder')) {
                try {
                    ss.deleteSheet(sheet);
                    cleanupCount++;
                    log_('Deleted test sheet: ' + name, 'INFO');
                } catch (e) {
                    log_('Could not delete sheet ' + name + ': ' + e.message, 'WARN');
                }
            }
        }

        // 4. Clean up test folders from Drive
        const folderIterator = DriveApp.getFoldersByName('TestDeleteFolder_');
        while (folderIterator.hasNext()) {
            const folder = folderIterator.next();
            const folderName = folder.getName();
            if (folderName.startsWith('TestDeleteFolder_')) {
                try {
                    folder.setTrashed(true);
                    cleanupCount++;
                    log_('Trashed test folder from Drive: ' + folderName, 'INFO');
                } catch (e) {
                    log_('Could not trash folder ' + folderName + ': ' + e.message, 'WARN');
                }
            }
        }

        log_('Deletion test cleanup complete. Cleaned up ' + cleanupCount + ' items.', 'INFO');
        ui.alert('Cleanup Complete', 'Cleaned up ' + cleanupCount + ' deletion test items.\n\nCheck TestLog for details.', ui.ButtonSet.OK);

    } catch (err) {
        log_('Deletion test cleanup failed: ' + err.message, 'ERROR');
        log_(err.stack, 'ERROR');
        SpreadsheetApp.getUi().alert('Cleanup Failed', 'An error occurred during cleanup. Check TestLog for details.', SpreadsheetApp.getUi().ButtonSet.OK);
    } finally {
        SCRIPT_EXECUTION_MODE = 'DEFAULT';
    }
}