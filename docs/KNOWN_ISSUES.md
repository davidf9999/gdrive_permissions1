# Known Issues

## Accidental TXT record deletion during domain verification
- **Symptom:** During project setup, the TXT record used for domain ownership verification (e.g., for Google Workspace) was accidentally deleted from the DNS provider after initial verification.
- **Impact:** The system may continue to operate without apparent harm after the initial setup. Domain ownership verification is typically a one-time process for Google Workspace. Subsequent operation does not rely on the continuous presence of this specific TXT record.
- **Resolution:** If future domain verification or Google Workspace services require re-verification, a new TXT record may need to be added. Otherwise, no immediate action is typically required if the system is already functional.

## Persistent "Working" overlay after running sync
- **Symptom:** After running Permissions Manager sync actions from the spreadsheet menu, Google Sheets may leave a black "Working" overlay in the lower-right corner even after the script completes.
- **Status:** Mitigation attempts refresh the UI automatically, but the overlay may still persist due to a Sheets client quirk.
- **Workaround:** Refresh the browser tab (or use *File > Spreadsheet settings > Reload* / the browser reload button) to clear the overlay. The underlying sync completes despite the stuck indicator.
