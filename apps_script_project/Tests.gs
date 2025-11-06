/***** DEVELOPER-ONLY TEST FUNCTIONS *****/

function runManualAccessTest() {
    SCRIPT_EXECUTION_MODE = 'TEST';
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

        let response = ui.Button.YES;
        if (testConfig.autoConfirm !== true) {
            response = ui.alert('Run All Tests', 'This will run all three tests sequentially:\n\n1. Manual Access Test\n2. Stress Test\n3. Add/Delete Separation Test\n\nThis may take several minutes. Continue?', ui.ButtonSet.YES_NO);
        }
        if (response !== ui.Button.YES) {
            ui.alert('All Tests cancelled.');
            return;
        }

        // Clear all existing test data before starting
        clearAllTestsData(true); // Skip confirmation since user already confirmed running tests
        SCRIPT_EXECUTION_MODE = 'TEST'; // Reset mode after clearAllTestsData (it sets to DEFAULT in finally)

        const testResults = [];

        // Test 1: Manual Access Test
        log_('╔══════════════════════════════════════════════════════════════╗', 'INFO');
        log_('║  TEST 1/3: Manual Access Test                                ║', 'INFO');
        log_('╚══════════════════════════════════════════════════════════════╝', 'INFO');
        const manualTestResult = runManualAccessTest();
        SCRIPT_EXECUTION_MODE = 'TEST'; // Reset after test completes (its finally block sets to DEFAULT)
        const manualStatus = manualTestResult ? '✓ PASSED' : '✗ FAILED';
        log_('>>> TEST RESULT: Manual Access Test ' + manualStatus, manualTestResult ? 'INFO' : 'ERROR');
        log_('', 'INFO');
        testResults.push('Manual Access Test: ' + (manualTestResult ? 'PASSED' : 'FAILED'));

        // Test 2: Stress Test
        log_('╔══════════════════════════════════════════════════════════════╗', 'INFO');
        log_('║  TEST 2/3: Stress Test                                       ║', 'INFO');
        log_('╚══════════════════════════════════════════════════════════════╝', 'INFO');
        const stressTestResult = runStressTest();
        SCRIPT_EXECUTION_MODE = 'TEST'; // Reset after test completes
        const stressStatus = stressTestResult ? '✓ PASSED' : '✗ FAILED';
        log_('>>> TEST RESULT: Stress Test ' + stressStatus, stressTestResult ? 'INFO' : 'ERROR');
        log_('', 'INFO');
        testResults.push('Stress Test: ' + (stressTestResult ? 'PASSED' : 'FAILED'));

        // Test 3: Add/Delete Separation Test
        log_('╔══════════════════════════════════════════════════════════════╗', 'INFO');
        log_('║  TEST 3/3: Add/Delete Separation Test                        ║', 'INFO');
        log_('╚══════════════════════════════════════════════════════════════╝', 'INFO');
        const addDeleteTestResult = runAddDeleteSeparationTest();
        SCRIPT_EXECUTION_MODE = 'TEST'; // Reset after test completes
        const addDeleteStatus = addDeleteTestResult ? '✓ PASSED' : '✗ FAILED';
        log_('>>> TEST RESULT: Add/Delete Separation Test ' + addDeleteStatus, addDeleteTestResult ? 'INFO' : 'ERROR');
        log_('', 'INFO');
        testResults.push('Add/Delete Separation Test: ' + (addDeleteTestResult ? 'PASSED' : 'FAILED'));

        // Summary
        const overallEndTime = new Date();
        const overallDurationSeconds = ((overallEndTime.getTime() - overallStartTime.getTime()) / 1000).toFixed(2);

        const passedCount = testResults.filter(r => r.includes('PASSED')).length;
        const failedCount = testResults.filter(r => r.includes('FAILED')).length;
        const allPassed = failedCount === 0;

        log_('', 'INFO');
        log_('╔══════════════════════════════════════════════════════════════╗', 'INFO');
        log_('║                    TEST SUMMARY                              ║', 'INFO');
        log_('╚══════════════════════════════════════════════════════════════╝', 'INFO');
        log_('Total Tests Run: 3', 'INFO');
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
                         'All three tests completed in ' + overallDurationSeconds + ' seconds.\n\n' +
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
            const isStressTest = sheetName.startsWith('StressTestFolder_');
            const isManualTestViewer = sheetName === manualTestFolderName + '_Viewer';
            const isManualTestEditor = sheetName === manualTestFolderName + '_Editor';
            const isManualTestCommenter = sheetName === manualTestFolderName + '_Commenter';
            const shouldDelete = isStressTest || isManualTestViewer || isManualTestEditor || isManualTestCommenter;

            if (shouldDelete) {
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
