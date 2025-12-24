# Minimal backend for GPT file access (Cloud Run friendly)

This backend is a thin, read-only HTTP service that lets a Custom GPT fetch
committed artifacts from the repository without running commands or storing
state. It serves Markdown files plus the Apps Script bundle built by CI.

## What it serves
- `GPT_KNOWLEDGE.md`
- `dist/apps_scripts_bundle.gs`
- Any other committed `*.md` files in the repo

Files over 2MB are rejected to keep responses fast and predictable.

## Endpoints
- `GET /healthz` → `{ "status": "ok" }`
- `GET /file?path=<relative-path>` → returns the file if allowed
  - Allowed extensions: `.md` anywhere in the repo, and the specific bundle at
    `dist/apps_scripts_bundle.gs`
  - Returns `403` for disallowed files, `404` if missing, `413` if too large

## Run locally
1) Ensure artifacts exist (CI builds them, or run `npm run build`).
2) Start the server:
   ```bash
   npm run start:backend
   # or: node backend/server.js
   ```
3) Try it:
   ```bash
   curl "http://localhost:8080/file?path=GPT_KNOWLEDGE.md"
   curl "http://localhost:8080/file?path=dist/apps_scripts_bundle.gs"
   ```

## Container build (for Cloud Run)
Build the image from the repo root after artifacts are present:
```bash
npm run build
docker build -f backend/Dockerfile -t gpt-backend:latest .
```
Deploy to Cloud Run with your preferred flags (e.g., `--allow-unauthenticated`
if you want the GPT to fetch anonymously). Keep GitHub/Cloud Run secrets
read-only and avoid embedding credentials in the image.

## Operational notes
- The backend is stateless and does not run builds; CI owns artifact generation.
- Browsing failures should be treated as GPT errors (consistent with the prompt
  guidance).
- Restrict exposure if you do not want the full set of Markdown files publicly
  reachable; tighten the allowlist in `backend/server.js` if needed.
