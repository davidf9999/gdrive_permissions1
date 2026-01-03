# Backend for GPT artifacts and steps (Cloud Run friendly)

This backend is a thin, read-only HTTP service that lets a Custom GPT fetch
committed artifacts from the repository without running commands or storing
state. It serves Markdown files, the Apps Script bundle built by CI, and the
structured steps YAML used by the GPT.

## What it serves
See `backend/openapi.yaml` for the authoritative list of supported endpoints
and request/response details.

You can also print a compact list from the CLI:
```bash
node scripts/print-backend-endpoints.js
```

Files over 2MB are rejected to keep responses fast and predictable.

## Prerequisites
- Node.js 20+
- Git + `npm` (for local runs)
- Docker (for container builds)
- gcloud CLI configured for your GCP project (for manual Cloud Run deploys)

## Generate a backend API key
Create a strong `BACKEND_API_KEY` and store it securely. One option:
```bash
openssl rand -base64 32
```
You will use this value as the `BACKEND_API_KEY` environment variable and, if
deploying with GitHub Actions, as a repository secret.
For local development only, you can bypass auth by setting `ALLOW_ANON=true`
or `NODE_ENV=development`.

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
   - Optional: bypass API key checks locally:
     ```bash
     ALLOW_ANON=true npm run start:backend
     ```
3) Exercise the endpoints:
   ```bash
   curl http://localhost:8080/status
   curl http://localhost:8080/meta
   curl http://localhost:8080/knowledge
   curl http://localhost:8080/usage/overview
   curl http://localhost:8080/usage/super-admin
   curl http://localhost:8080/usage/sheet-editor
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
  - `GCP_PROJECT_ID`
  - `GCP_REGION` – e.g., `us-central1`
  - `GCP_SERVICE_NAME` – Cloud Run service name
  - `GCP_ARTIFACT_REGISTRY_REPO` – Artifact Registry repo name
  - `GCP_WORKLOAD_IDENTITY_PROVIDER` – The full resource name of the WIF provider.
  - `GCP_SERVICE_ACCOUNT` – The email of the service account to impersonate.
  - `BACKEND_API_KEY` – Generated secret used to authenticate API requests.
- The workflow builds `backend/Dockerfile`, pushes the image to Artifact Registry,
  and deploys a new Cloud Run revision. The service is deployed as private and
  requires authenticated requests.

### Manual deploy with gcloud
1) Build and push the image (authenticate to GCP first):
   ```bash
   gcloud auth configure-docker "${REGION}-docker.pkg.dev"
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
     --set-env-vars "BACKEND_API_KEY=your_secret_key"
   ```
   - For browser-based GPT Actions, allow both ChatGPT origins:
     ```bash
     --set-env-vars "ALLOWED_ORIGINS=https://chatgpt.com,https://chat.openai.com"
     ```
   - Add `--allow-unauthenticated` if you want a public endpoint and enforce
     access exclusively with `BACKEND_API_KEY`.
   - To store the key in Secret Manager instead of a plaintext env var:
     ```bash
     printf '%s' "$BACKEND_API_KEY" | gcloud secrets create BACKEND_API_KEY --replication-policy="automatic" --data-file=-
     gcloud run deploy "$SERVICE_NAME" \
       --image "$IMAGE" \
       --region "$REGION" \
       --platform managed \
       --set-secrets "BACKEND_API_KEY=BACKEND_API_KEY:latest"
     ```
3) Verify the service. If the service is private, you must use an identity
   token to make requests.
   ```bash
   TOKEN=$(gcloud auth print-identity-token)
   URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format="value(status.url)")
   curl -H "Authorization: Bearer $TOKEN" "$URL/status"
   curl -H "Authorization: Bearer $TOKEN" "$URL/meta"
   ```

## Operational notes
- The backend is stateless; CI owns artifact generation. If artifacts are missing,
  rerun `npm run build` before starting the service.
- Structured JSON request logs are emitted to stdout for Cloud Run.
- `/latest` accepts `GITHUB_TOKEN`/`GITHUB_API_TOKEN` to reduce GitHub rate limits.
- Set `STATIC_CACHE_CONTROL` or `LATEST_CACHE_MS` env vars if you need custom
  caching behavior.
- The health check endpoint is `/status`, not `/healthz`. The `/healthz` path
  is reserved by the Google Cloud Run infrastructure and requests to it may be
  intercepted before they reach the container.
