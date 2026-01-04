# Versioning and release alignment

This project exposes the current release version in two places, but only one value is considered canonical:

- `meta.json` (`version_tag`): the **source of truth** for the release identifier used in artifacts and changelog metadata.
- `apps_script_project/Version.generated.js` (`SCRIPT_VERSION` constant): generated at build time from the canonical version and consumed by `Code.js` to show the version inside the Sheets UI.

`SCRIPT_VERSION` is not edited directly; it is always derived from `meta.json` (or an override via `VERSION_TAG`). This avoids maintaining two independent version strings while still surfacing the version inside the spreadsheet UI.

## How the version is chosen
`npm run build:bundle` runs `scripts/sync-version.js` before bundling. The script determines a canonical `version_tag` in this order:

1. `VERSION_TAG` environment variable (recommended for CI/CD to make releases explicit).
2. `meta.json.version_tag` (useful when rebuilding from an already versioned artifact; becomes the canonical source when present).
3. Latest git tag (fallback for local builds when no explicit tag is provided).

If no source is available, the build fails so we do not produce bundles with unknown versions.

## What gets updated
- `meta.json` is rewritten (when present) so `version_tag` matches the resolved canonical tag.
- `apps_script_project/Version.generated.js` is recreated to export `SCRIPT_VERSION` with the same tag. `Code.js` reads this injected constant at runtime.

## Bumping the version safely
1. Decide the next semantic tag (for example `v1.0.14`).
2. Set `VERSION_TAG=v1.0.14` in your environment when running `npm run build:bundle` **or** create a git tag named `v1.0.14` before building.
3. After the build, verify `meta.json` shows `v1.0.14` and that `apps_script_project/Version.generated.js` contains `const SCRIPT_VERSION = 'v1.0.14';`, then publish the bundle from `dist/apps_scripts_bundle.gs`.

`version_tag` is **not** auto-incremented; it only changes when you set `VERSION_TAG` or create a new git tag (or edit `meta.json` directly and rebuild). `Version.generated.js` is regenerated automatically from that single canonical value.
