# Frequently Asked Questions

## Can I use this with a personal Gmail account?
No. The script requires a Google Workspace domain so it can call the Admin SDK and manage Google Groups.

## How much does it cost to run?
Most deployments stay within the free tiers for the Admin SDK and Drive APIs. You still need a paid Google Workspace subscription and a billed Cloud project to unlock Admin SDK limits; see the [Cost transparency](README.md#cost-transparency) section for details.

## What happens if I delete a folder or group manually?
The next **Full Sync** recreates missing Google Groups and folder permissions to match the spreadsheet. Unexpected manual deletes will be corrected during the next run.

## Can I import existing permissions?
Yes. Start by populating the control tabs with the current groups or users and run **Sync Adds** to align to that state. For large migrations, audit existing Drive permissions first so the spreadsheet reflects reality before syncing.

## How do I migrate from manual sharing?
Create tabs for each managed folder, list the intended members, and run **Full Sync (Add & Delete)**. This provisions the groups and cleans up any lingering manual access via **Sync Deletes**.

## How do I share a new document with everyone who can already access a managed folder?
See the detailed guidance in the [User Guide](docs/USER_GUIDE.md#how-do-i-share-a-new-document-with-everyone-who-already-has-access-to-a-managed-folder) for the recommended approach (copy/move into the managed folder) and when to use the group email instead.

## What API quotas should I expect? Will I hit them?
The Admin SDK and Drive API quotas are sufficient for most small to medium deployments. Very large organisations should enable billing and monitor Admin SDK quotas in the Google Cloud Console.

## What if I delete a row of access in the spreadsheet?
Removing a row and running **Sync Deletes** revokes the corresponding Google Group membership and Drive permission so the spreadsheet stays the source of truth.

## Do I need to be a Super Admin?
Yes. Managing Google Groups through the Admin SDK requires Super Admin privileges; delegated roles cannot grant the scopes needed for the script to function.

## Can SharePoint replace Google Drive for this project?
No. SharePoint is only a helpful point of comparison. It requires Microsoft identities, limits guest access, charges per user, and does not offer a spreadsheet-driven permission model that works for large numbers of external Gmail users. It is mentioned because many enterprise teams know SharePoint well, so referencing it gives Microsoft-oriented readers a fast mental model for the structured permissions, inheritance, and governance this tool brings to Google Drive.
