# Conceptual comparison: Google Drive vs. SharePoint

This project introduces structure and governance to Google Drive permissions. If you work in Microsoft ecosystems, SharePoint can be a helpful mental model—but it is not a supported backend for this tool.

## Why SharePoint is a useful analogy
- Hierarchical permission inheritance and role-based access control
- Centralized management and auditing
- Clear separation of collaboration spaces through sites and libraries

`gdrive_permissions1` brings similar governance to Google Drive using:
- Google Sheets as a source of truth for folder/role membership
- Google Groups to fan out ACL definitions without hitting per-folder limits
- Automated synchronization, reporting, and auditing via Apps Script

## Why SharePoint cannot replace Google Drive here
- Requires Microsoft accounts for every user and restricts guest access
- Per-user licensing increases cost, especially for large external audiences
- No spreadsheet-driven permission engine that works for free Gmail users
- Limited fit for organizations that rely on Google Drive as the primary content store

## Google Drive vs. SharePoint at a glance

| Feature | Google Drive + Workspace | Microsoft SharePoint |
|--------|---------------------------|-----------------------|
| External users | Free Gmail fully supported | Guest users restricted |
| Identity requirement | Google account | Microsoft account |
| Spreadsheet source of truth | Native | Not available |
| Group-based ACL | Google Groups | M365 Groups (limited external support) |
| Automation | Apps Script | Graph API / Power Automate |
| Cost model | One admin license → unlimited external users | Per-user licensing |
| Fit for this project | **Excellent** | **Not suitable** |

## FAQ summary

**Can SharePoint replace Google Drive for this project?** No. SharePoint is useful as a conceptual reference, but it is not a practical replacement because it relies on Microsoft identities, limits guest access, charges per user, and lacks a spreadsheet-driven permission model that works for large numbers of external Gmail users. Mentioning it gives Microsoft-oriented readers a fast mental model for what this tool delivers on Google Drive.
