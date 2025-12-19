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
**Priority: High (cost/blocker)** — These steps prevent ongoing charges and unblock account deletion.

### 3.1 Cancel Workspace Subscriptions
- Go to [admin.google.com](http://admin.google.com/).
- Navigate to **Billing** > **Subscriptions**.
- Select the subscription you want to cancel.
- Click the three dots menu (⋮) and select **Cancel Subscription**.
- Follow the on-screen instructions to complete the cancellation.

### 3.2 Delete All Google Cloud Projects
- Go to the [Cloud Resource Manager](https://console.cloud.google.com/cloud-resource-manager).
- Select and **Delete** all projects associated with the Workspace.
- **Note**: Projects enter a 30-day "pending deletion" state before being permanently removed. While the user notes this wait may not be required, it is a safeguard.

#### How to delete a GCP project (Console)
1. Open the project selector (top bar) and choose the project you want to delete.
2. Go to **IAM & Admin** → **Settings**.
3. In the **Shut down** section, click **Shut down** (or **Shut down project**).
4. Type the **Project ID** to confirm and click **Shut down**.
5. Repeat for each remaining project.

If you do not see the **Shut down** button, confirm:
- You are a **Project Owner** or **Organization Admin** for that project.
- The project is not already in **Pending deletion** (check the project list in Cloud Resource Manager).
- You are in the correct project (the project ID in the header matches the one you want to delete).

#### How to delete a GCP project (gcloud CLI)
If you prefer the CLI:
```bash
gcloud projects delete PROJECT_ID
```
You can list projects with:
```bash
gcloud projects list
```
Projects will show `DELETE_REQUESTED` while pending deletion.

### 3.3 Clean Up Cloud Resources
- App Engine: disable application.
- Cloud Storage: delete buckets.
- BigQuery: delete datasets.
- Service accounts: delete if needed.
- APIs: disable active APIs.

### 3.4 Close Billing Accounts
- https://console.cloud.google.com/billing  
Close each billing account.

## 4. Remove and Disconnect Domain Resources
**Priority: Medium** — These steps clean up Workspace entities and DNS so the domain can be released.

This step is critical for ensuring the domain can be fully released from Google Workspace.

### 4.1 Clean Up Workspace Entities

This step ensures that all user- and script-created resources within the Workspace are removed.

- **Delete Users**
  - **How to find:** Go to the Admin console > **Directory** > **[Users](https://admin.google.com/ac/users)**.
  - **What to delete:** Delete all users **except for one super admin account**. You will use this final account to delete the Workspace itself.

- **Delete Groups**
  - **How to find:** Go to the Admin console > **Directory** > **[Groups](https://admin.google.com/ac/groups)**.
  - **What to delete:** Delete all groups. The `gdrive_permissions` script creates groups with specific naming patterns that you should look for and delete:
    - `managed.folder.<FolderName>.<Role>@yourdomain.com` (e.g., `managed.folder.MyProject.viewer@yourdomain.com`)
    - `SheetEditors@yourdomain.com`

- **Migrate or Delete Shared Drives**
  - **How to find:** Go to the Admin console > **Apps** > **Google Workspace** > **[Drive and Docs](https://admin.google.com/ac/managedsettings/55656082996/mc)** > **Manage shared drives**.
  - **What to delete:** The script does not create Shared Drives, but it may manage permissions for folders located within them. Before deleting the Workspace, ensure all data in any Shared Drives is either moved to an external location or is no longer needed, then delete the Shared Drives themselves.

- **Delete Organizational Units (OUs)**
  - **How to find:** Go to the Admin console > **Directory** > **[Organizational units](https://admin.google.com/ac/orgunits)**.
  - **What to delete:** The script does not create OUs. Delete any custom OUs you have created. You will not be able to delete the top-level, root OU (your domain).

### 4.2 Document and Clean DNS Records
Before making changes, take a screenshot or export the DNS settings from your domain registrar's control panel. This provides a rollback point.

Common registrars include:
- [Google Domains](https://domains.google.com/)
- [Cloudflare](https://dash.cloudflare.com/)
- [GoDaddy](https://dcc.godaddy.com/domains)
- [Squarespace](https://www.squarespace.com/domain-names)

From your registrar's DNS management page, you will need to remove all records related to Google Workspace, such as:
- **MX records** for Gmail (e.g., `aspmx.l.google.com`).
- **SPF records** (a TXT record starting with `v=spf1 include:_spf.google.com ~all`).
- **DKIM records** (a TXT record with a selector like `google._domainkey`).
- **DMARC records**.
- The **`google-site-verification`** TXT record.
- Any **CNAMEs** pointing to Google services (e.g., `mail.yourdomain.com`).

## 5. Delete Secondary Domains and Domain Aliases
**Priority: Medium** — Required to release the primary domain.
- Admin console → Domains → Manage domains → Remove all secondary domains.
- Clean DNS: delete Gmail MX, SPF, DKIM, DMARC, google-site-verification, CNAMEs, subdomain entries.

## 6. Delete the Google Workspace Account (Primary Domain)
**Priority: High (final action)** — Only possible after high/medium priority steps are complete.

**Critical Prerequisites:** Before you can delete your Google Workspace account, you *must* ensure all associated resources are removed and subscriptions are cancelled. Failure to do so will block the deletion process, as indicated by messages like "Delete Google Cloud resources" or "Cancel subscriptions and delete Google Cloud resources, and Marketplace Apps (Required)". Specifically, ensure you have completed:

-   **All steps in Section 3: Audit and Remove Billing Risks** (including cancelling Workspace subscriptions, deleting Google Cloud projects and resources, and closing billing accounts).
-   **All steps in Section 4: Remove and Disconnect Domain Resources** (including cleaning up Workspace entities and DNS records, and deleting secondary domains/aliases).

Once these prerequisites are met, navigate to:
-   Admin console → Account → Account settings → Account management → Delete account.

## 6.1 Troubleshooting “Delete account” Disabled

If the "Delete account" option is still disabled, refer to the following common blockers and their solutions, ensuring you've followed the relevant sections in this guide:

| Blocker | Fix |
|---|---|
| Cloud project exists | Delete project (see section 3.2: Delete All Google Cloud Projects). Note: May require a wait for permanent deletion. |
| Project pending deletion | Wait for the project to be permanently deleted. |
| Billing account open | Close billing accounts (see section 3.4: Close Billing Accounts). |
| Marketplace subscription active | Cancel Marketplace subscriptions (part of section 3.1: Cancel Workspace Subscriptions). |
| Secondary domain present | Remove secondary domains (see section 5: Delete Secondary Domains and Domain Aliases). |
| Last super admin deleted | Restore a super admin account if accidentally deleted. |

## 7. Post-Deletion Verification
**Priority: Low** — Validation and follow-up checks.
- Verify DNS cleanup.
- Confirm billing accounts are closed.
- Ensure Workspace admin login is disabled.
- Check confirmation emails.

## 8. Prevent Future Charges
- Remove payment methods: https://pay.google.com/
- Ensure transferred Cloud projects have valid billing.
- Monitor statements for one cycle.
