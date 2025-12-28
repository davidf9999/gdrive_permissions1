#!/usr/bin/env bash
# Usage:
#   1. gh auth login
#   2. export required env vars (see README)
#   3. ./scripts/set-gh-secrets.sh
#
# This script sets GitHub Actions secrets for Cloud Run deploy via WIF.
set -euo pipefail

# Expect these to already be set in the environment
: "${GCP_PROJECT_ID:?}"
: "${GCP_REGION:?}"
: "${GCP_SERVICE_NAME:?}"
: "${GCP_ARTIFACT_REGISTRY_REPO:?}"
: "${GCP_WORKLOAD_IDENTITY_PROVIDER:?}"
: "${GCP_SERVICE_ACCOUNT:?}"
: "${BACKEND_API_KEY:?}"

gh secret set GCP_PROJECT_ID --body "$GCP_PROJECT_ID"
gh secret set GCP_REGION --body "$GCP_REGION"
gh secret set GCP_SERVICE_NAME --body "$GCP_SERVICE_NAME"
gh secret set GCP_ARTIFACT_REGISTRY_REPO --body "$GCP_ARTIFACT_REGISTRY_REPO"
gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --body "$GCP_WORKLOAD_IDENTITY_PROVIDER"
gh secret set GCP_SERVICE_ACCOUNT --body "$GCP_SERVICE_ACCOUNT"
gh secret set BACKEND_API_KEY --body "$BACKEND_API_KEY"
echo "GitHub Actions secrets for GCP have been set successfully."
