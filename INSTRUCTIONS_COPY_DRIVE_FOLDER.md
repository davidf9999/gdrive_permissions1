# Instructions for `copy_drive_folder.py`

This guide explains how to use the `copy_drive_folder.py` script to recursively copy a Google Drive folder.

## 1. Prerequisites

*   **Python 3:** You must have Python 3 installed on your computer. You can download it from [python.org](https://www.python.org/).
*   **Google Cloud Project:** You need a Google Cloud project with the Google Drive API enabled. If you don't have one, follow these steps:
    1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
    2.  Create a new project.
    3.  In the project, go to **"APIs & Services" > "Library"**.
    4.  Search for "Google Drive API" and enable it.

## 2. Installation

1.  **Install the required Python libraries:**
    Open your terminal or command prompt and run the following command:

    ```bash
    pip install google-api-python-client google-auth-oauthlib
    ```

2.  **Download `credentials.json`:**
    You need to create OAuth 2.0 credentials to allow the script to access your Google Drive.

    1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
    2.  Make sure your project is selected.
    3.  Go to **"APIs & Services" > "Credentials"**.
    4.  Click **"+ CREATE CREDENTIALS"** and select **"OAuth client ID"**.
    5.  If prompted, configure your OAuth consent screen. For "User Type", select **"External"** and click **"CREATE"**. Fill in the required fields (App name, User support email, Developer contact information) and click **"SAVE AND CONTINUE"** through the rest of the steps.
    6.  For "Application type", select **"Desktop app"**.
    7.  Give the client ID a name (e.g., "Drive Copy Script").
    8.  Click **"CREATE"**.
    9.  A window will pop up with your client ID and client secret. Click the **"DOWNLOAD JSON"** button to download the credentials file.
    10. **Rename the downloaded file to `credentials.json`** and place it in the same directory as the `copy_drive_folder.py` script.

## 3. Running the Script

1.  **Open your terminal or command prompt** and navigate to the directory where you saved `copy_drive_folder.py` and `credentials.json`.

2.  **Run the script:**
    ```bash
    python copy_drive_folder.py
    ```

3.  **First-time authorization:**
    The first time you run the script, it will open a new tab in your web browser and ask you to authorize the script to access your Google Drive. Follow the on-screen instructions to grant permission. After you grant permission, a `token.pickle` file will be created in the same directory. This file stores your authorization, so you won't have to authorize the script every time you run it.

4.  **Provide input:**
    The script will prompt you for the following information:
    *   **Source folder ID:** The ID of the Google Drive folder you want to copy. You can find this in the URL of the folder in your web browser (it's the long string of characters after `folders/`).
    *   **Name for the new folder:** The name you want to give to the new, copied folder.
    *   **Parent folder ID for the new folder:** The ID of the folder where you want to create the new folder. You can use `root` to create the new folder in the main "My Drive" directory.

5.  **Wait for the copy to complete:**
    The script will now start copying the folder and its contents. It will print the progress to the console. This may take a long time for large folders.

## Important Notes

*   **File Ownership:** The copied files will be owned by the user who runs the script.
*   **Permissions:** The permissions of the original files and folders are **not** copied. The new files and folders will inherit the permissions of the destination folder.
*   **Rate Limits:** The script does not have any explicit rate limit handling. For very large folders, it's possible that you might encounter Google Drive API rate limits. If this happens, you may need to add some error handling and backoff logic to the script.
*   **`token.pickle`:** If you change the `SCOPES` in the script, you will need to delete the `token.pickle` file and re-authorize the script.
