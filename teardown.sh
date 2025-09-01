#!/bin/bash
# This script tears down the resources created by the setup.sh script.

set -e

config_file="./setup.conf"

if [ ! -f "$config_file" ]; then
    echo "Error: Config file not found at '$config_file'"
    exit 1
fi
source "$config_file"

echo "--- Tearing down Google Cloud Project: $gcp_project_id ---"
gcloud projects delete "$gcp_project_id"

echo "--- Cleaning up local files ---"
rm -f ./terraform/terraform.tfstate
rm -f ./terraform/.terraform.lock.hcl
rm -f ./apps_script_project/.clasp.json

echo "Teardown complete."
