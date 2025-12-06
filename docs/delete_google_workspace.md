# Delete Google Workspace and Associated Resources

This guide outlines the steps to fully delete a Google Workspace domain and shut down all related resources so that no further expenses accrue to the workspace owner. Follow each step in order and confirm completion before proceeding. Where possible, direct URLs and example commands are provided for speed and accuracy.

> **Tip about the 14-day free trial**: If the Workspace is still in the free trial, cancellation is simpler—you can cancel immediately from the Admin console without incurring charges. You still need to back up data and clean up linked Cloud projects to avoid surprise costs elsewhere.

## 1. Prepare and Notify
- Notify all users about the planned deletion date and expected downtime.
- Confirm that legal/retention requirements allow removal of user accounts and data.
- Export compliance data (e.g., Vault matters, audit logs) if required.

## 2. Back Up and Transfer Critical Data
- Use **Workspace data export** (Admin console > Tools > Data Export) or **Google Takeout** to download organizational data. Direct link: `https://admin.google.com/ac/dataexport`.
- Transfer ownership of Drive files, Shared Drives, and AppSheet/Apps Script projects that must be retained elsewhere. For Drive, reassign ownership via **Drive > Share > Transfer ownership** or run a bulk transfer from **Admin console > Apps > Google Workspace > Drive and Docs > Transfer ownership**: `https://admin.google.com/ac/drive/ownership`.
- Reassign ownership of shared calendars (`https://calendar.google.com`), sites (`https://sites.google.com`), and forms (`https://docs.google.com/forms`) that need to persist under a different domain.

## 3. Audit and Remove Billing Risks
- In **Admin console > Billing** (`https://admin.google.com/ac/billing`), cancel all subscriptions (Workspace licenses, add-ons, Marketplace apps) and verify end dates. If in the 14-day free trial, cancellation is immediate and charges stop.
- Remove or downgrade any paid Google Cloud projects linked to the domain:
  - List billing accounts: `gcloud beta billing accounts list`.
  - Disable or close each billing account: `gcloud beta billing accounts close BILLING_ACCOUNT_ID`.
  - Set budgets to zero if you need to keep an account open temporarily: `gcloud billing budgets create --billing-account=BILLING_ACCOUNT_ID --display-name="Deletion Hold" --amount=0`.
  - Detach projects from billing (if they must be retained elsewhere): `gcloud beta billing projects unlink PROJECT_ID`.
  - Export billing reports in the Cloud Console (`https://console.cloud.google.com/billing/`) before closure.
- Review third-party Marketplace apps and revoke access in **Admin console > Apps > Google Workspace Marketplace apps**: `https://admin.google.com/ac/appsmarket` to stop external charges.

## 4. Remove or Migrate Domain Resources
- Delete or transfer all user accounts, groups, and organizational units that are no longer needed.
- Remove recovery email/phone numbers that point to billing contacts for other Google services.
- Migrate or delete Shared Drives; ensure no external users remain with ownership-like roles.
- Reassign DNS control for domains that will be used elsewhere; document current DNS records before changes.

## 5. Delete Secondary Domains and Domain Aliases
- In **Admin console > Domains > Manage domains** (`https://admin.google.com/ac/domains/manage`), remove all secondary domains and domain aliases.
- Update DNS with the registrar (e.g., Google Domains or your registrar control panel) to delete or repoint MX, SPF, DKIM, DMARC, and other service records to prevent mail flow and reduce resource usage. For Google Domains, use `https://domains.google.com/registrar/`.

## 6. Delete the Primary Domain (Close the Workspace)
- Sign in as a super admin and ensure all users are deleted or suspended and billing is canceled.
- Navigate to **Admin console > Account settings > Account management** (`https://admin.google.com/ac/accountsettings`), select **Delete account**, and confirm.
- Confirm deletion. Google will remove the primary domain and associated Workspace organization.

## 7. Post-Deletion Verification
- Confirm that DNS no longer points to Google mail servers and that web, calendar, or other service endpoints are unreachable.
- Verify that billing accounts are closed and no new invoices generate after deletion.
- Check recovery emails for confirmation messages that the Workspace has been deleted.

## 8. Prevent Future Charges
- Remove payment methods from the Google Payments center associated with the deleted Workspace.
- If any Google Cloud projects were retained elsewhere, ensure they are attached to active billing accounts outside the deleted domain and have budget alerts.
- Monitor billing statements for one full cycle to ensure no unexpected charges occur.

Following this checklist deletes the Google Workspace domain and related resources while preventing ongoing charges to the workspace owner.
