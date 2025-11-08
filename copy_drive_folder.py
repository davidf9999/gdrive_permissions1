import os
import pickle
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

# If modifying these scopes, delete the file token.pickle.
SCOPES = ['https://www.googleapis.com/auth/drive']

def get_drive_service():
    """
    Authenticates with the Google Drive API and returns a service object.
    """
    creds = None
    # The file token.pickle stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first
    # time.
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        # Save the credentials for the next run
        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)

    return build('drive', 'v3', credentials=creds)

def copy_folder_recursive(drive_service, source_folder_id, destination_parent_id, new_folder_name):
    """
    Recursively copies a Google Drive folder and its contents.
    """
    # Create the new folder
    file_metadata = {
        'name': new_folder_name,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [destination_parent_id]
    }
    new_folder = drive_service.files().create(body=file_metadata, fields='id').execute()
    new_folder_id = new_folder.get('id')
    print(f"Created folder '{new_folder_name}' with ID: {new_folder_id}")

    # List files and folders in the source folder
    page_token = None
    while True:
        response = drive_service.files().list(q=f"'{source_folder_id}' in parents",
                                              spaces='drive',
                                              fields='nextPageToken, files(id, name, mimeType)',
                                              pageToken=page_token).execute()
        for item in response.get('files', []):
            if item['mimeType'] == 'application/vnd.google-apps.folder':
                # If the item is a folder, recursively call this function
                copy_folder_recursive(drive_service, item['id'], new_folder_id, item['name'])
            else:
                # If the item is a file, copy it
                file_metadata = {
                    'name': item['name'],
                    'parents': [new_folder_id]
                }
                print(f"Copying file '{item['name']}'...")
                drive_service.files().copy(fileId=item['id'], body=file_metadata).execute()

        page_token = response.get('nextPageToken', None)
        if page_token is None:
            break

def main():
    """
    Main function to run the script.
    """
    drive_service = get_drive_service()

    source_folder_id = input("Enter the ID of the source folder to copy: ")
    new_folder_name = input("Enter the name for the new (destination) folder: ")
    destination_parent_id = input("Enter the ID of the parent folder for the new folder (or 'root' for the main 'My Drive'): ")

    if not destination_parent_id:
        destination_parent_id = 'root'

    print("\nStarting recursive copy...")
    copy_folder_recursive(drive_service, source_folder_id, destination_parent_id, new_folder_name)
    print("\nRecursive copy complete!")

if __name__ == '__main__':
    main()
