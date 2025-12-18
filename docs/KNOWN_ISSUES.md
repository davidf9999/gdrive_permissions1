# Known Issues

## Persistent "Working" overlay after running Permissions Manager actions
- **Symptom:** After running Permissions Manager actions from the spreadsheet menu, Google Sheets may leave a black "Working" overlay even after the script completes.
- **Status:** [Codex Task](https://chatgpt.com/codex/tasks/task_e_694419f5da248320b5ed5e36cdb73bfc).
- **Workaround:** Refresh the browser tab (or use *File > Spreadsheet settings > Reload* / the browser reload button) to clear the overlay. The underlying sync completes despite the stuck indicator.
