/***** DEVELOPER-ONLY TEST FUNCTIONS *****/

function runManualAccessTest() {
    SCRIPT_EXECUTION_MODE = 'TEST';
    try {
        if (shouldSkipGroupOps_()) {
            showTestMessage_('Test Aborted', 'Manual Access Test requires the Admin Directory service (Admin SDK). Please enable it or run on a Google Workspace domain.');
            return;
        }
        const ui = SpreadsheetApp.getUi();
        const testConfig = getTestConfiguration_();

        let testFolderName = testConfig.folderName;
        if (!testFolderName) {
            const folderNamePrompt = ui.prompt('Test - Step 1/4: Folder Name', 'Enter a name for a new test folder to be created.', ui.ButtonSet.OK_CANCEL);
            if (folderNamePrompt.getSelectedButton() !== ui.Button.OK || !folderNamePrompt.getResponseText()) return ui.alert('Test cancelled.');
            testFolderName = folderNamePrompt.getResponseText();
        }

        let testRole = testConfig.role;
        if (!testRole) {
            const rolePrompt = ui.prompt('Test - Step 2/4: Role', 'Enter the role to test (e.g., Editor, Viewer).', ui.ButtonSet.OK_CANCEL);
            if (rolePrompt.getSelectedButton() !== ui.Button.OK || !rolePrompt.getResponseText()) return ui.alert('Test cancelled.');
            testRole = rolePrompt.getResponseText();
        }

        let testEmail = testConfig.email;
        if (!testEmail) {
            const emailPrompt = ui.prompt('Test - Step 3/4: Test Email', 'Enter a REAL email address you can access for testing (e.g., a personal Gmail).', ui.ButtonSet.OK_CANCEL);
            if (emailPrompt.getSelectedButton() !== ui.Button.OK || !emailPrompt.getResponseText()) return ui.alert('Test cancelled.');
            testEmail = emailPrompt.getResponseText().trim().toLowerCase();
        }
        log_('Using test email: ' + testEmail + '. If this is not a real Google account, a "Resource Not Found" error in the logs is expected.', 'INFO');

        showTestMessage_('Step 4/4: Initial Setup', 'The script will now add this configuration to the ManagedFolders sheet and run the sync to create the folder, group, and user sheet.');

        const managedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
        const testRowIndex = managedSheet.getLastRow() + 1;
        managedSheet.getRange(testRowIndex, FOLDER_NAME_COL).setValue(testFolderName);
        managedSheet.getRange(testRowIndex, ROLE_COL).setValue(testRole);

        fullSync(); // Changed from syncAll()
        let status = managedSheet.getRange(testRowIndex, STATUS_COL).getValue();
        if (status !== 'OK') {
            throw new Error('Sync failed after initial setup. Status: ' + status);
        }
        log_('Initial sync complete. Status: OK', 'INFO');

        const userSheetName = managedSheet.getRange(testRowIndex, USER_SHEET_NAME_COL).getValue();
        const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(userSheetName);
        if (!userSheet) {
            showTestMessage_('Test Failed', 'Could not find the created user sheet: ' + userSheetName);
            return;
        }

        userSheet.getRange('A2').setValue(testEmail);
        showTestMessage_('Granting Access', 'The test email has been added to the ' + userSheetName + ' sheet. The script will now sync again to grant folder access.');
        fullSync(); // Changed from syncAll()
        status = managedSheet.getRange(testRowIndex, STATUS_COL).getValue();
        if (status !== 'OK') {
            throw new Error('Sync failed after granting access. Status: ' + status);
        }
        log_('Grant access sync complete. Status: OK', 'INFO');

        const folderId = managedSheet.getRange(testRowIndex, FOLDER_ID_COL).getValue();
        const folderUrl = DriveApp.getFolderById(folderId).getUrl();
        let verification1 = ui.Button.YES;
        if (testConfig.autoConfirm !== 'TRUE') {
            verification1 = ui.alert('Verify Access', 'Please open an Incognito Window, log in as ' + testEmail + ', and try to open this link:\n\n' + folderUrl + '\n\nDid you get access?', ui.ButtonSet.YES_NO);
        }

        if (verification1 !== ui.Button.YES) {
            ui.alert('Test aborted. Please review the logs and configuration.');
            return;
        }

        userSheet.getRange('A2').clearContent();
        showTestMessage_('Revoking Access', 'The test email has been removed from the sheet. The script will now sync again to revoke folder access.');
        fullSync(); // Changed from syncAll()
        status = managedSheet.getRange(testRowIndex, STATUS_COL).getValue();
        if (status !== 'OK') {
            throw new Error('Sync failed after revoking access. Status: ' + status);
        }
        log_('Revoke access sync complete. Status: OK', 'INFO');

        let verification2 = ui.Button.YES;
        if (testConfig.autoConfirm !== 'TRUE') {
            verification2 = ui.alert('Verify Revoked Access', 'Please go back to your Incognito Window and refresh the folder page. You should see a \'permission denied\' error.\n\nWas access revoked?', ui.ButtonSet.YES_NO);
        }

        if (verification2 === ui.Button.YES) {
            showTestMessage_('Test Complete: SUCCESS!', 'The user was successfully granted and revoked access.');
        } else {
            showTestMessage_('Test Complete: FAILURE!', 'Access was not revoked as expected. This may be due to Google Drive permission propagation delays. Please wait a few minutes and check again.');
        }

        let cleanup = testConfig.cleanup === 'TRUE';
        if (!cleanup) {
            const cleanupPrompt = ui.alert('Cleanup', 'Do you want to remove all test data (folder, group, and sheet)?', ui.ButtonSet.YES_NO);
            cleanup = cleanupPrompt === ui.Button.YES;
        }

        if (cleanup) {
            const groupEmail = managedSheet.getRange(testRowIndex, GROUP_EMAIL_COL).getValue();
            cleanupFolderData_(testFolderName, folderId, groupEmail, userSheetName);
            managedSheet.deleteRow(testRowIndex);
            showTestMessage_('Cleanup', 'Cleanup complete.');
        }
    } finally {
        SCRIPT_EXECUTION_MODE = 'DEFAULT';
    }
}

/***** STRESS TEST FUNCTIONS *****/

/**
 * A function to test the script's performance with many folders and users.
 */
function runStressTest() {
    SCRIPT_EXECUTION_MODE = 'TEST';
    try {
        if (shouldSkipGroupOps_()) {
            showTestMessage_('Test Aborted', 'Stress Test requires the Admin Directory service (Admin SDK). Please enable it or run on a Google Workspace domain.');
            return;
        }
        const ui = SpreadsheetApp.getUi();

        // --- Step 1: Get Test Parameters ---
        const numFoldersStr = ui.prompt('Stress Test - Step 1/4', 'Enter the number of temporary folders to create (e.g., 10).', ui.ButtonSet.OK_CANCEL);
        if (numFoldersStr.getSelectedButton() !== ui.Button.OK || !numFoldersStr.getResponseText()) return ui.alert('Test cancelled.');
        const numFolders = parseInt(numFoldersStr.getResponseText(), 10);

        const numUsersStr = ui.prompt('Stress Test - Step 2/4', 'Enter the number of test users to create PER FOLDER (e.g., 200).', ui.ButtonSet.OK_CANCEL);
        if (numUsersStr.getSelectedButton() !== ui.Button.OK || !numUsersStr.getResponseText()) return ui.alert('Test cancelled.');
        const numUsers = parseInt(numUsersStr.getResponseText(), 10);

        const baseEmailStr = ui.prompt('Stress Test - Step 3/4', 'Enter a base email address to generate test users (e.g., your.name@gmail.com).', ui.ButtonSet.OK_CANCEL);
        if (baseEmailStr.getSelectedButton() !== ui.Button.OK || !baseEmailStr.getResponseText()) return ui.alert('Test cancelled.');
        const baseEmail = baseEmailStr.getResponseText().trim();
        const emailParts = baseEmail.split('@');
        if (emailParts.length !== 2) return ui.alert('Invalid email address.');

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
        const startRow = managedSheet.getLastRow() + 1;
        const newConfig = folderNames.map(name => [name, '', 'Editor']);
        managedSheet.getRange(startRow, 1, newConfig.length, 3).setValues(newConfig);
        SpreadsheetApp.flush();

        // --- Step 3: Initial Sync to Create Infrastructure ---
        showTestMessage_('Setup Phase 1 Complete', 'Test folders have been added to the sheet. The script will now run a sync to create the necessary folders, groups, and user sheets.');
        fullSync();

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
        fullSync();
        const endTime = new Date();
        const durationSeconds = (endTime.getTime() - startTime.getTime()) / 1000;

        showTestMessage_('Stress Test Complete!', 'The sync process finished in ' + durationSeconds + ' seconds.');

        // --- Step 6: Cleanup ---
        const cleanup = ui.alert('Cleanup', 'Do you want to remove all test data (folders, groups, sheets, and configuration rows)?', ui.ButtonSet.YES_NO);
        if (cleanup === ui.Button.YES) {
            const managedData = managedSheet.getRange(startRow, 1, numFolders, GROUP_EMAIL_COL).getValues();

            // Delete rows from sheet first to prevent re-sync issues
            managedSheet.deleteRows(startRow, numFolders);

            showTestMessage_('Cleanup', 'Cleanup in Progress. This may take a few moments.');

            managedData.forEach(function (row) {
                const folderName = row[FOLDER_NAME_COL - 1];
                const folderId = row[FOLDER_ID_COL - 1];
                const userSheetName = row[USER_SHEET_NAME_COL - 1];
                const groupEmail = row[GROUP_EMAIL_COL - 1];
                cleanupFolderData_(folderName, folderId, groupEmail, userSheetName);
            });

            showTestMessage_('Cleanup', 'Cleanup Complete!');
        }
    } finally {
        SCRIPT_EXECUTION_MODE = 'DEFAULT';
    }
}

function cleanupStressTestData() {
    SCRIPT_EXECUTION_MODE = 'TEST';
    try {
        if (shouldSkipGroupOps_()) {
            showTestMessage_('Cleanup Aborted', 'Cleanup requires the Admin Directory service (Admin SDK). Please enable it or run on a Google Workspace domain.');
            return;
        }
        const ui = SpreadsheetApp.getUi();
        const response = ui.alert('Are you sure you want to delete all stress test data?', 'This will delete all folders, groups, and sheets with the "StressTestFolder_" prefix.', ui.ButtonSet.YES_NO);
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

        const response = ui.alert('Are you sure you want to delete the test data for folder "' + folderName + '"?', 'This will delete the folder, group, and sheet.', ui.ButtonSet.YES_NO);
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

        const response = ui.alert('Are you sure you want to delete the test data for folder "' + folderName + '"?', 'This will delete the folder, group, and sheet.', ui.ButtonSet.YES_NO);
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
    let testFolderName, testEmail, testRole, testRowIndex, userSheetName, groupEmail, folderId;

    try {
        if (shouldSkipGroupOps_()) {
            showTestMessage_('Test Aborted', 'This test requires the Admin Directory service (Admin SDK). Please enable it or run on a Google Workspace domain.');
            return;
        }
        const testConfig = getTestConfiguration_();

        // --- Test Setup ---
        testFolderName = testConfig.folderName;
        if (!testFolderName) {
            const folderNamePrompt = ui.prompt('Add/Delete Test - Step 1/3: Folder Name', 'Enter a unique name for a new test folder.', ui.ButtonSet.OK_CANCEL);
            if (folderNamePrompt.getSelectedButton() !== ui.Button.OK || !folderNamePrompt.getResponseText()) return ui.alert('Test cancelled.');
            testFolderName = folderNamePrompt.getResponseText();
        }
        testRole = 'Editor'; // Using a fixed role for simplicity

        testEmail = testConfig.email;
        if (!testEmail) {
            const emailPrompt = ui.prompt('Add/Delete Test - Step 2/3: Test Email', 'Enter a REAL email address you can access for testing.', ui.ButtonSet.OK_CANCEL);
            if (emailPrompt.getSelectedButton() !== ui.Button.OK || !emailPrompt.getResponseText()) return ui.alert('Test cancelled.');
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

        syncAdds();
        let status = managedSheet.getRange(testRowIndex, STATUS_COL).getValue();
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
        syncAdds();
        status = managedSheet.getRange(testRowIndex, STATUS_COL).getValue();
        if (status !== 'OK') {
            throw new Error('Sync failed after adding user. Status: ' + status);
        }
        log_('Add user sync complete. Status: OK', 'INFO');

        // --- Verification 1: User was added ---
        let members = fetchAllGroupMembers_(groupEmail);
        let isMember = members.some(m => m.email.toLowerCase() === testEmail);
        if (!isMember) {
            throw new Error('VERIFICATION FAILED: User ' + testEmail + ' was not added to group ' + groupEmail + ' after syncAdds.');
        }
        log_('VERIFICATION PASSED: User was successfully added to the group.');
        showTestMessage_('Verification Passed', 'User ' + testEmail + ' was correctly added to the group.');

        // --- Phase 2: Run Delete (should do nothing) ---
        log_('TEST: No-Op Delete Phase');
        let confirmNoOpDelete = ui.Button.YES;
        if (testConfig.autoConfirm !== 'TRUE') {
            confirmNoOpDelete = ui.alert('Confirm No-Op Delete', 'The script will now run a delete sync, but no deletions are expected. Continue?', ui.ButtonSet.YES_NO);
        }
        if (confirmNoOpDelete !== ui.Button.YES) {
            ui.alert('Test cancelled.');
            return;
        }
        syncDeletes(); // This will prompt for confirmation

        // --- Verification 2: User was NOT removed ---
        members = fetchAllGroupMembers_(groupEmail);
        isMember = members.some(m => m.email.toLowerCase() === testEmail);
        if (!isMember) {
            throw new Error('VERIFICATION FAILED: User ' + testEmail + ' was removed from group ' + groupEmail + ' after a no-op syncDeletes call.');
        }
        log_('VERIFICATION PASSED: User was not removed by no-op delete.');
        showTestMessage_('Verification Passed', 'User ' + testEmail + ' was NOT removed by the delete sync (as expected).');

        // --- Phase 3: Actual Deletion ---
        log_('TEST: Actual Deletion Phase');
        userSheet.getRange('A2').clearContent();
        let confirmActualDelete = ui.Button.YES;
        if (testConfig.autoConfirm !== 'TRUE') {
            confirmActualDelete = ui.alert('Confirm Actual Delete', 'The script will now run a delete sync to remove the user. Continue?', ui.ButtonSet.YES_NO);
        }
        if (confirmActualDelete !== ui.Button.YES) {
            ui.alert('Test cancelled.');
            return;
        }
        syncDeletes(); // This will prompt for confirmation
        status = managedSheet.getRange(testRowIndex, STATUS_COL).getValue();
        if (status !== 'OK') {
            throw new Error('Sync failed after deleting user. Status: ' + status);
        }
        log_('Delete user sync complete. Status: OK', 'INFO');

        // --- Verification 3: User was removed ---
        members = fetchAllGroupMembers_(groupEmail);
        isMember = members.some(m => m.email.toLowerCase() === testEmail);
        if (isMember) {
            throw new Error('VERIFICATION FAILED: User ' + testEmail + ' was NOT removed from group ' + groupEmail + ' after syncDeletes.');
        }
        log_('VERIFICATION PASSED: User was successfully removed from the group.');
        showTestMessage_('Test Complete: SUCCESS!', 'The user was successfully added and then removed using the separated sync functions.');

    } catch (e) {
        log_('TEST FAILED: ' + e.toString() + ' Stack: ' + e.stack, 'ERROR');
        ui.alert('Test FAILED. Check the logs for details. Error: ' + e.message);
    } finally {
        // --- Cleanup ---
        let cleanup = testConfig.cleanup === 'TRUE';
        if (!cleanup) {
            const cleanupPrompt = ui.alert('Cleanup', 'Do you want to remove all test data (folder, group, and sheet)?', ui.ButtonSet.YES_NO);
            cleanup = cleanupPrompt === ui.Button.YES;
        }

        if (cleanup) {
            if (testFolderName) {
                cleanupFolderData_(testFolderName, folderId, groupEmail, userSheetName);
                const managedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MANAGED_FOLDERS_SHEET_NAME);
                if (testRowIndex && managedSheet.getRange(testRowIndex, FOLDER_NAME_COL).getValue() === testFolderName) {
                    managedSheet.deleteRow(testRowIndex);
                }
            }
            showTestMessage_('Cleanup', 'Cleanup complete.');
        }
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

    // 1. Delete the user sheet
    if (userSheetName) {
        try {
            const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(userSheetName);
            if (sheet) {
                SpreadsheetApp.getActiveSpreadsheet().deleteSheet(sheet);
                log_('Deleted sheet: ' + userSheetName);
            }
        } catch (e) {
            log_('Could not delete sheet ' + userSheetName + ': ' + e.message, 'WARN');
        }
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
