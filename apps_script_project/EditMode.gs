/**
 * EditMode.gs - Edit mode management
 *
 * Allows administrators to enter "Edit Mode" which temporarily suspends
 * automatic syncs while making bulk changes to the control sheets.
 *
 * This prevents AutoSync from running while you're in the middle of
 * reorganizing sheets, making bulk edits, or testing configurations.
 */

/**
 * Enters Edit Mode - suspends AutoSync and marks sheets with visual indicator
 */
function enterEditMode() {
  const ui = SpreadsheetApp.getUi();

  // Check if already in edit mode
  if (isInEditMode_()) {
    const response = ui.alert(
      'Already in Edit Mode',
      'The spreadsheet is already in Edit Mode.\n\n' +
      'Edit Mode was enabled at: ' + getEditModeTimestamp_() + '\n' +
      'Enabled by: ' + getEditModeUser_() + '\n\n' +
      'Would you like to exit Edit Mode?',
      ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
      exitEditMode();
    }
    return;
  }

  // Confirm entering edit mode
  const response = ui.alert(
    'Enter Edit Mode?',
    'Edit Mode will:\n\n' +
    '✓ Suspend automatic syncs\n' +
    '✓ Add a visual banner to the spreadsheet\n' +
    '✓ Log the time and user who enabled it\n\n' +
    'Use this when making bulk changes, reorganizing sheets, or testing.\n\n' +
    'Remember to EXIT Edit Mode when done to resume AutoSync!',
    ui.ButtonSet.OK_CANCEL
  );

  if (response !== ui.Button.OK) {
    return;
  }

  try {
    // Set edit mode properties
    const props = PropertiesService.getDocumentProperties();
    props.setProperties({
      'EditMode': 'true',
      'EditModeTimestamp': new Date().toISOString(),
      'EditModeUser': Session.getActiveUser().getEmail()
    });

    // Add visual indicator
    addEditModeBanner_();

    // Log the event
    log_('🔒 EDIT MODE ENABLED by ' + Session.getActiveUser().getEmail(), 'INFO');

    ui.alert(
      'Edit Mode Enabled',
      '🔒 Edit Mode is now ACTIVE\n\n' +
      'Auto-sync will be suspended until you exit Edit Mode.\n\n' +
      'The yellow banner at the top indicates Edit Mode is active.\n\n' +
      'When done, use:\nPermissions Manager → Edit Mode → Exit Edit Mode',
      ui.ButtonSet.OK
    );

  } catch (e) {
    log_('Error enabling Edit Mode: ' + e.message, 'ERROR');
    ui.alert('Error', 'Failed to enable Edit Mode: ' + e.message, ui.ButtonSet.OK);
  }
}

/**
 * Exits Edit Mode - resumes AutoSync and removes visual indicator
 */
function exitEditMode() {
  const ui = SpreadsheetApp.getUi();

  if (!isInEditMode_()) {
    ui.alert('Not in Edit Mode', 'The spreadsheet is not currently in Edit Mode.', ui.ButtonSet.OK);
    return;
  }

  try {
    // Get edit mode info for logging
    const startTime = getEditModeTimestamp_();
    const user = getEditModeUser_();

    // Clear edit mode properties
    const props = PropertiesService.getDocumentProperties();
    props.deleteProperty('EditMode');
    props.deleteProperty('EditModeTimestamp');
    props.deleteProperty('EditModeUser');

    // Remove visual indicator
    removeEditModeBanner_();

    // Log the event
    const duration = calculateDuration_(startTime);
    log_('🔓 EDIT MODE DISABLED by ' + Session.getActiveUser().getEmail() +
         ' (was enabled by ' + user + ' for ' + duration + ')', 'INFO');

    ui.alert(
      'Edit Mode Disabled',
      '🔓 Edit Mode is now INACTIVE\n\n' +
      'Auto-sync will resume on its normal schedule.\n\n' +
      'Duration: ' + duration + '\n' +
      'Originally enabled by: ' + user,
      ui.ButtonSet.OK
    );

  } catch (e) {
    log_('Error disabling Edit Mode: ' + e.message, 'ERROR');
    ui.alert('Error', 'Failed to disable Edit Mode: ' + e.message, ui.ButtonSet.OK);
  }
}

/**
 * Checks the current Edit Mode status and displays it
 */
function viewEditModeStatus() {
  const ui = SpreadsheetApp.getUi();

  if (isInEditMode_()) {
    const timestamp = getEditModeTimestamp_();
    const user = getEditModeUser_();
    const duration = calculateDuration_(timestamp);

    ui.alert(
      'Edit Mode Status',
      '🔒 Edit Mode is ACTIVE\n\n' +
      'Enabled at: ' + new Date(timestamp).toLocaleString() + '\n' +
      'Enabled by: ' + user + '\n' +
      'Duration: ' + duration + '\n\n' +
      'Auto-sync is currently SUSPENDED.\n\n' +
      'To resume normal operations, use:\n' +
      'Permissions Manager → Edit Mode → Exit Edit Mode',
      ui.ButtonSet.OK
    );
  } else {
    ui.alert(
      'Edit Mode Status',
      '✅ Edit Mode is INACTIVE\n\n' +
      'The spreadsheet is in normal operation mode.\n' +
      'Auto-sync is running on schedule.',
      ui.ButtonSet.OK
    );
  }
}

/**
 * Checks if the spreadsheet is currently in Edit Mode
 * @return {boolean} True if in Edit Mode, false otherwise
 */
function isInEditMode_() {
  try {
    const props = PropertiesService.getDocumentProperties();
    return props.getProperty('EditMode') === 'true';
  } catch (e) {
    log_('Error checking Edit Mode status: ' + e.message, 'WARN');
    return false;
  }
}

/**
 * Gets the timestamp when Edit Mode was enabled
 * @return {string} ISO timestamp or empty string if not in Edit Mode
 */
function getEditModeTimestamp_() {
  try {
    const props = PropertiesService.getDocumentProperties();
    return props.getProperty('EditModeTimestamp') || '';
  } catch (e) {
    return '';
  }
}

/**
 * Gets the user who enabled Edit Mode
 * @return {string} User email or 'Unknown' if not available
 */
function getEditModeUser_() {
  try {
    const props = PropertiesService.getDocumentProperties();
    return props.getProperty('EditModeUser') || 'Unknown';
  } catch (e) {
    return 'Unknown';
  }
}

/**
 * Calculates duration between timestamp and now
 * @param {string} isoTimestamp - ISO format timestamp
 * @return {string} Human-readable duration (e.g., "2 hours 15 minutes")
 */
function calculateDuration_(isoTimestamp) {
  if (!isoTimestamp) return 'Unknown';

  try {
    const start = new Date(isoTimestamp);
    const now = new Date();
    const diffMs = now - start;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Less than 1 minute';
    if (diffMins < 60) return diffMins + ' minute' + (diffMins === 1 ? '' : 's');

    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    let result = hours + ' hour' + (hours === 1 ? '' : 's');
    if (mins > 0) {
      result += ' ' + mins + ' minute' + (mins === 1 ? '' : 's');
    }

    return result;
  } catch (e) {
    return 'Unknown';
  }
}

/**
 * Adds a visual banner to indicate Edit Mode is active
 */
function addEditModeBanner_() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Check if banner sheet already exists
    let bannerSheet = ss.getSheetByName('⚠️ EDIT MODE ACTIVE');
    if (bannerSheet) {
      // Move to first position if it exists
      ss.setActiveSheet(bannerSheet);
      ss.moveActiveSheet(1);
      return;
    }

    // Create banner sheet
    bannerSheet = ss.insertSheet('⚠️ EDIT MODE ACTIVE', 0);

    // Format the banner
    const range = bannerSheet.getRange('A1:Z10');
    range.setBackground('#FFF3CD'); // Light yellow
    range.setBorder(true, true, true, true, false, false, '#856404', SpreadsheetApp.BorderStyle.SOLID_THICK);

    // Add warning text
    const textRange = bannerSheet.getRange('B2:Y8');
    textRange.merge();
    textRange.setValue(
      '⚠️  EDIT MODE ACTIVE  ⚠️\n\n' +
      'Auto-sync is currently SUSPENDED while you make changes.\n\n' +
      'Enabled at: ' + new Date().toLocaleString() + '\n' +
      'Enabled by: ' + Session.getActiveUser().getEmail() + '\n\n' +
      'When done editing, use:\nPermissions Manager → Edit Mode → Exit Edit Mode'
    );
    textRange.setFontSize(14);
    textRange.setFontWeight('bold');
    textRange.setHorizontalAlignment('center');
    textRange.setVerticalAlignment('middle');
    textRange.setWrap(true);
    textRange.setFontColor('#856404'); // Dark yellow/brown

    // Protect the banner sheet (read-only)
    const protection = bannerSheet.protect();
    protection.setDescription('Edit Mode banner - protected');
    protection.setWarningOnly(true);

  } catch (e) {
    log_('Error adding Edit Mode banner: ' + e.message, 'WARN');
  }
}

/**
 * Removes the Edit Mode visual banner
 */
function removeEditModeBanner_() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const bannerSheet = ss.getSheetByName('⚠️ EDIT MODE ACTIVE');

    if (bannerSheet) {
      ss.deleteSheet(bannerSheet);
      log_('Edit Mode banner removed', 'INFO');
    }
  } catch (e) {
    log_('Error removing Edit Mode banner: ' + e.message, 'WARN');
  }
}
