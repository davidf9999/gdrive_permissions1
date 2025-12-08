# DELETE_GOOGLE_WORKSPACE.md
Complete Guide to Deleting a Google Workspace Domain and All Associated Resources

This guide provides an end-to-end process for safely deleting a Google Workspace domain, including Workspace data, Cloud resources, secondary domains, DNS records, and billing accounts. Follow each step in order. Skipping steps may prevent the Workspace from being deleted.

## 0. Important Notes Before Starting
- You cannot delete the last super admin account. The final user is removed automatically during Workspace deletion.
- A Google Workspace account cannot be deleted if:
  - Any Google Cloud project still exists.
  - Any Cloud project is in “pending deletion”.
  - Any billing account is still open.
  - Any Marketplace app subscription is active.
  - Any secondary domain or domain alias remains assigned.
- Deleting Cloud projects may require waiting up to 24 hours.
- If Workspace used a subdomain (e.g., demo3.dfront1.com), it must be removed from Workspace and DNS.

## 1. Prepare and Notify
- Notify users of the deletion date.
- Verify legal/retention policies.
- Export required compliance archives.

## 2. Back Up and Transfer Required Data
- Use Takeout or Workspace Data Export.
- Transfer ownership of Drive, Shared Drives, Apps Script, AppSheet, Calendars, Sites, and Forms.

## 3. Audit and Remove Billing Risks

### 3.1 Cancel Workspace Subscriptions
- Go to [admin.google.com](http://admin.google.com/).
- Navigate to **Billing** > **Subscriptions**.
- Select the subscription you want to cancel.
- Click the three dots menu (⋮) and select **Cancel Subscription**.
- Follow the on-screen instructions to complete the cancellation.

### 3.2 Delete or Shut Down All Google Cloud Projects
- https://console.cloud.google.com/cloud-resource-manager
- Shut down all projects.
- Wait for “pending deletion” projects to disappear.

### 3.3 Clean Up Cloud Resources
- App Engine: disable application.
- Cloud Storage: delete buckets.
- BigQuery: delete datasets.
- Service accounts: delete if needed.
- APIs: disable active APIs.

### 3.4 Close Billing Accounts
- https://console.cloud.google.com/billing  
Close each billing account.

## 4. Remove or Migrate Domain Resources
- Delete all users except the final super admin.
- Delete groups, OUs.
- Migrate/delete Shared Drives.
- Document DNS before changes.

## 5. Delete Secondary Domains and Domain Aliases
- Admin console → Domains → Manage domains → Remove all secondary domains.
- Clean DNS: delete Gmail MX, SPF, DKIM, DMARC, google-site-verification, CNAMEs, subdomain entries.

## 6. Delete the Google Workspace Account (Primary Domain)
- Admin console → Account → Account settings → Account management → Delete account.

## 6.1 Troubleshooting “Delete account” Disabled
| Blocker | Fix |
|--------|------|
| Cloud project exists | Shut down project |
| Project pending deletion | Wait |
| Billing account open | Close billing |
| Marketplace subscription active | Cancel |
| Secondary domain present | Remove |
| Last super admin deleted | Restore it |

## 7. Post-Deletion Verification
- Verify DNS cleanup.
- Confirm billing accounts are closed.
- Ensure Workspace admin login is disabled.
- Check confirmation emails.

## 8. Prevent Future Charges
- Remove payment methods: https://pay.google.com/
- Ensure transferred Cloud projects have valid billing.
- Monitor statements for one cycle.
