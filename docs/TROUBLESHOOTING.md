# Troubleshooting Guide

This guide provides solutions to common problems you might encounter while using the Google Drive Permissions Manager.

---

## Sync Aborted: Orphan Sheets Found

### Symptom

Sync (including AutoSync) fails with an error like:

```
SYNC ABORTED: Found orphan sheets that are not in the configuration
Orphan sheets found. Sync aborted.
```

### Cause

One or more sheets exist in the spreadsheet that are not referenced by `ManagedFolders`, `UserGroups`, or `SheetEditors_G`. This can happen if someone deletes rows manually instead of using the Delete checkbox, or if old user sheets were left behind.

### Solution

1. Go to **Permissions Manager → Advanced → Delete Orphan Sheets**.
2. Review the list and confirm deletion of the orphan sheets.
3. Re-run sync (or wait for the next AutoSync).

Tip: To avoid orphans, always use the **Delete** checkbox in control sheets instead of manually deleting rows.

## Emails Sent from the Script are Bouncing

### Symptom

When the script attempts to send an email notification (e.g., as part of a sync or audit), the operation fails. The logs might show that the message "bounced" or was rejected. However, you are able to send emails normally from the Gmail web interface using the same account.

### Cause

This issue is almost always caused by incomplete email authentication records in your domain's DNS settings. For other email servers to trust emails sent programmatically from your domain, you must have correct **SPF** and **DKIM** records. While sending from the Gmail web UI might work, scripted emails undergo stricter scrutiny.

### Solution

Follow these steps to diagnose and fix your DNS settings.

#### Step 1: Run the DNS Sanity Check

The project includes a script to check for the most common DNS issues related to Google Workspace.

1.  Open a terminal in the project directory.
2.  Run the script with your domain name:
    ```bash
    ./scripts/dns_sanity_check.sh your-domain.com
    ```
3.  The script will check your MX (mail receiving) and SPF (sending policy) records. If it reports any warnings for MX or SPF records, fix them in your DNS provider's settings first.

#### Step 2: Check for a DKIM Record

The sanity check script does not check for DKIM, which is the most likely cause of this specific problem.

1.  From your terminal, run the following command, replacing `your-domain.com` with your domain:
    ```bash
    dig TXT google._domainkey.your-domain.com
    ```
2.  **If the record is missing**, the output will have `status: NXDOMAIN`. This confirms that you need to add the DKIM record. Proceed to Step 3.
3.  **If the record is present**, the output will have `status: NOERROR` and show a long `v=DKIM1...` record. If this is the case, and emails are still bouncing, the issue might be related to DNS propagation delays or other less common factors.

#### Step 3: Generate and Add the DKIM Record

1.  **Sign in to your Google Admin console** at [admin.google.com](http://admin.google.com).
2.  Navigate to **Apps > Google Workspace > Gmail**.
3.  Click on **Authenticate email**.
4.  Select your domain from the dropdown menu.
5.  Click **Generate new record**. Keep the default settings and click **Generate**.
6.  Google will provide you with a **DNS Host name** (`google._domainkey`) and a long **TXT record value** (starting with `v=DKIM1...`). Copy this value.
7.  **In a separate tab, log in to your DNS provider's website** (e.g., Cloudflare, GoDaddy, Namecheap).
8.  Navigate to the DNS management page for your domain.
9.  Create a new **TXT record** with the following details:
    *   **Type:** `TXT`
    *   **Name/Host:** `google._domainkey`
    *   **Value/Content:** Paste the long TXT record value you copied from the Google Admin console.
10. Save the record.

#### Step 4: Start Authentication in Google Admin Console

1.  Go back to the Google Admin console page where you generated the key.
2.  Wait a few minutes (it can sometimes take longer) for your DNS change to become visible.
3.  Click the **Start authentication** button. The button may be greyed out until Google can detect the new DNS record. Once you click it, the button will change to "Stop authentication," which indicates the process has begun.

It can take up to 48 hours for authentication to fully complete, but it is often much faster. Once the status changes from "Authenticating..." to "Authenticating email," the issue with bounced emails should be resolved.
