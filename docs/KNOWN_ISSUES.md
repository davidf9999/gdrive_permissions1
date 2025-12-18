# Known Issues

## Persistent "Working" overlay after running sync
- **Symptom:** After running Permissions Manager sync actions from the spreadsheet menu, Google Sheets may leave a black "Working" overlay in the lower-right corner even after the script completes.
- **Status:** Mitigation attempts refresh the UI automatically, but the overlay may still persist due to a Sheets client quirk.
- **Workaround:** Refresh the browser tab (or use *File > Spreadsheet settings > Reload* / the browser reload button) to clear the overlay. The underlying sync completes despite the stuck indicator.
