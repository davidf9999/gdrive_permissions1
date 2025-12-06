# Delete Google Workspace and Associated Resources

This guide outlines the steps to fully delete a Google Workspace domain and shut down all related resources so that no further expenses accrue to the workspace owner. Follow each step in order and confirm completion before proceeding.

## 1. Prepare and Notify
- Notify all users about the planned deletion date and expected downtime.
- Confirm that legal/retention requirements allow removal of user accounts and data.
- Export compliance data (e.g., Vault matters, audit logs) if required.

## 2. Back Up and Transfer Critical Data
- Use Google Takeout or the Workspace data export tool to download organizational data.
- Transfer ownership of Drive files, Shared Drives, and AppSheet/Apps Script projects that must be retained elsewhere.
- Reassign ownership of shared calendars, sites, and forms that need to persist under a different domain.

## 3. Audit and Remove Billing Risks
- In **Admin console > Billing**, cancel all subscriptions (Workspace licenses, add-ons, Marketplace apps) and verify end dates.
- Remove or downgrade any paid Google Cloud projects linked to the domain:
  - Set budgets/alerts to $0 and disable billing accounts or close them entirely.
  - Export billing reports and delete unused projects; transfer required projects to another organization if needed.
- Review third-party Marketplace apps and revoke access to stop external charges.

## 4. Remove or Migrate Domain Resources
- Delete or transfer all user accounts, groups, and organizational units that are no longer needed.
- Remove recovery email/phone numbers that point to billing contacts for other Google services.
- Migrate or delete Shared Drives; ensure no external users remain with ownership-like roles.
- Reassign DNS control for domains that will be used elsewhere; document current DNS records before changes.

## 5. Delete Secondary Domains and Domain Aliases
- In **Admin console > Domains > Manage domains**, remove all secondary domains and domain aliases.
- Update DNS with the registrar to delete or repoint MX, SPF, DKIM, DMARC, and other service records to prevent mail flow and reduce resource usage.

## 6. Delete the Primary Domain (Close the Workspace)
- Sign in as a super admin and ensure all users are deleted or suspended and billing is canceled.
- Navigate to **Admin console > Account settings > Account management** and select **Delete account**.
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
