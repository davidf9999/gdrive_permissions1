function getGitHubRepoUrl_() {
    const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET_NAME);
    if (configSheet) {
        const settings = configSheet.getRange('A2:B').getValues();
        for (let i = 0; i < settings.length; i++) {
            if (settings[i][0] === 'GitHubRepoURL') {
                return settings[i][1];
            }
        }
    }
    return null;
}

function openUserGuide() {
    const repoUrl = getGitHubRepoUrl_();
    if (repoUrl) {
        openUrl(repoUrl + '/blob/main/docs/USER_GUIDE.md');
    }
}

function openTestingGuide() {
    const repoUrl = getGitHubRepoUrl_();
    if (repoUrl) {
        openUrl(repoUrl + '/blob/main/TESTING.md');
    }
}

function openReadme() {
    const repoUrl = getGitHubRepoUrl_();
    if (repoUrl) {
        openUrl(repoUrl + '/blob/main/README.md');
    }
}

function openAllDocumentation() {
    const repoUrl = getGitHubRepoUrl_();
    if (repoUrl) {
        openUrl(repoUrl + '/blob/main/docs/');
    }
}

function openUrl(url) {
  log_('Attempting to open URL: ' + url);
  const html = '<html><body><a href="' + url + '" target="_blank">Click here to open the documentation</a><br/><br/><input type="button" value="Close" onclick="google.script.host.close()" /></body></html>';
  const ui = HtmlService.createHtmlOutput(html).setTitle('Open Documentation').setWidth(300);
  SpreadsheetApp.getUi().showSidebar(ui);
}
