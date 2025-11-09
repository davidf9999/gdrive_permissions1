/**
 * @OnlyCurrentDoc
 */

function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Folder Copier')
      .addItem('Copy Folder', 'showCopyFolderDialog')
      .addToUi();
}

function showCopyFolderDialog() {
  var ui = SpreadsheetApp.getUi();

  // Check if Drive API is enabled
  try {
    Drive.about.get();
  } catch (e) {
    ui.alert('Error: Google Drive API is not enabled.', 'Please enable the "Drive API" (v2) in the Apps Script editor under "Services".', ui.ButtonSet.OK);
    return;
  }

  var result = ui.prompt(
      'Copy Folder',
      'Enter the ID of the source folder to copy:',
      ui.ButtonSet.OK_CANCEL);

  var button = result.getSelectedButton();
  var sourceFolderId = result.getResponseText();
  if (button == ui.Button.OK && sourceFolderId) {
    var sourceFolderName = Drive.Files.get(sourceFolderId).title;
    var defaultNewFolderName = 'Copy of ' + sourceFolderName;

    var result2 = ui.prompt(
        'Copy Folder',
        'Enter the name for the new (destination) folder:',
        {
          initialValue: defaultNewFolderName,
          buttons: ui.ButtonSet.OK_CANCEL
        }
    );

    var button2 = result2.getSelectedButton();
    var newFolderName = result2.getResponseText();
    if (button2 == ui.Button.OK && newFolderName) {
      var result3 = ui.prompt(
          'Copy Folder',
          'Enter the ID of the parent folder for the new folder (or \'root\' for the main \'My Drive\'):',
          {
            initialValue: 'root',
            buttons: ui.ButtonSet.OK_CANCEL
          }
      );

      var button3 = result3.getSelectedButton();
      var destinationParentId = result3.getResponseText();
      if (button3 == ui.Button.OK && destinationParentId) {
        SpreadsheetApp.getActiveSpreadsheet().toast('Starting folder copy...', 'Folder Copier', -1);
        copyFolderRecursive(sourceFolderId, destinationParentId, newFolderName);
        SpreadsheetApp.getActiveSpreadsheet().toast('Folder copy complete!', 'Folder Copier', 30);
        ui.alert('Folder copy complete!');
      }
    }
  }
}

function copyFolderRecursive(sourceFolderId, destinationParentId, newFolderName) {
  // Create the new folder
  var newFolder = Drive.Files.insert({
    'title': newFolderName,
    'mimeType': 'application/vnd.google-apps.folder',
    'parents': [{'id': destinationParentId}]
  });
  var newFolderId = newFolder.id;
  Logger.log("Created folder '" + newFolderName + "' with ID: " + newFolderId);

  // List files and folders in the source folder
  var pageToken = null;
  do {
    var fileList = Drive.Files.list({
      q: "'" + sourceFolderId + "' in parents",
      maxResults: 100,
      pageToken: pageToken
    });
    if (fileList.items && fileList.items.length > 0) {
      for (var i = 0; i < fileList.items.length; i++) {
        var item = fileList.items[i];
        if (item.mimeType == 'application/vnd.google-apps.folder') {
          // If the item is a folder, recursively call this function
          copyFolderRecursive(item.id, newFolderId, item.title);
        } else {
          // If the item is a file, copy it
          Logger.log("Copying file '" + item.title + "'...");
          Drive.Files.copy({}, item.id, {parents: [{'id': newFolderId}], title: item.title});
        }
      }
    }
    pageToken = fileList.nextPageToken;
  } while (pageToken);
}