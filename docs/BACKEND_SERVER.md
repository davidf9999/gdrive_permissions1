# Backend for GPT artifacts and steps (Cloud Run friendly)

This backend is a thin, read-only HTTP service that lets a Custom GPT fetch
committed artifacts from the repository without running commands or storing
state. It serves Markdown files, the Apps Script bundle built by CI, and the
structured steps YAML used by the GPT.

## What it serves
- `GET /meta` → build provenance + artifact hashes
- `GET /knowledge` → `GPT_KNOWLEDGE.md`
- `GET /steps` → compact list of steps from `docs/common/steps.yaml`
- `GET /steps/{id}` → step detail with embedded setup guide
- `GET /bundle` → `dist/apps_scripts_bundle.gs`
- `GET /latest` → optional drift check against GitHub
- `GET /healthz` → health probe

Files over 2MB are rejected to keep responses fast and predictable.

## Prerequisites
- Node.js 20+
- Git + `npm` (for local runs)
- Docker (for container builds)
- gcloud CLI configured for your GCP project (for manual Cloud Run deploys)

## Run and test on your computer
1) Install dependencies and build artifacts (knowledge, bundle, meta):
   ```bash
   npm ci
   npm run build
   ```
2) Start the backend locally:
   ```bash
   npm run start:backend
   # listens on http://localhost:8080
   ```
3) Exercise the endpoints:
   ```bash
   curl http://localhost:8080/healthz
   curl http://localhost:8080/meta
   curl http://localhost:8080/knowledge
   curl http://localhost:8080/steps
   curl http://localhost:8080/steps/setup-admin  # replace with a real step id
   curl http://localhost:8080/bundle
   curl http://localhost:8080/latest
   ```
4) Optional: run unit tests (covers template generation and helpers):
   ```bash
   npm test -- --runInBand
   ```

## Build and run with Docker locally
1) Ensure artifacts exist (run `npm run build` first).
2) Build the image from the repo root:
   ```bash
   docker build -f backend/Dockerfile -t gpt-backend:local .
   ```
3) Run the container:
   ```bash
   docker run --rm -p 8080:8080 gpt-backend:local
   ```
   - Pass `GITHUB_TOKEN` if you want `/latest` to avoid rate limiting:
     ```bash
     docker run --rm -p 8080:8080 -e GITHUB_TOKEN=ghp_your_token gpt-backend:local
     ```
4) Hit the same `curl` commands as above against `http://localhost:8080`.

## Deploy to Google Cloud Run
You can use the provided GitHub Actions workflow or deploy manually.

### GitHub Actions (tags only)
- Workflow: `.github/workflows/deploy-backend.yml`
- Trigger: pushing a git tag that matches `v*`
- Required secrets:
  - `GCP_SERVICE_NAME` – Cloud Run service name
  - `GCP_REGION` – e.g., `us-central1`
  - `GCP_PROJECT_ID`
  - `GCP_ARTIFACT_REGISTRY_REPO` – Artifact Registry repo name
  - `GCP_SA_KEY` – JSON key for a deploy-capable service account
- The workflow builds `backend/Dockerfile`, pushes the image to Artifact Registry,
  and deploys a new Cloud Run revision with public access.

### Manual deploy with gcloud
1) Build and push the image (authenticate to GCP first):
   ```bash
   IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}:manual"
   docker build -f backend/Dockerfile -t "$IMAGE" .
   docker push "$IMAGE"
   ```
2) Deploy to Cloud Run:
   ```bash
   gcloud run deploy "$SERVICE_NAME" \
     --image "$IMAGE" \
     --region "$REGION" \
     --platform managed \
     --allow-unauthenticated
   ```
3) Verify the service by curling the `/healthz`, `/meta`, and `/knowledge`
   endpoints on the deployed URL.

## Operational notes
- The backend is stateless; CI owns artifact generation. If artifacts are missing,
  rerun `npm run build` before starting the service.
- Structured JSON request logs are emitted to stdout for Cloud Run.
- `/latest` accepts `GITHUB_TOKEN`/`GITHUB_API_TOKEN` to reduce GitHub rate limits.
- Set `STATIC_CACHE_CONTROL` or `LATEST_CACHE_MS` env vars if you need custom
  caching behavior.
