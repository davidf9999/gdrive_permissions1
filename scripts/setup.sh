#!/bin/bash
# Setup Wizard for the Google Drive Permission Manager

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Global Variables ---
config_file="/app/setup.conf"

# --- Helper Functions ---
function print_header() {
  echo "================================================="
  echo " Google Drive Permission Manager Setup Wizard"
  echo "================================================="
  echo
}

function load_config() {
    echo "--- Loading Configuration from $config_file ---"
    if [ ! -f "$config_file" ]; then
        echo "Error: Config file not found at '$config_file'"
        exit 1
    fi
    source "$config_file"
    # Basic validation
    if [ -z "$gcp_project_id" ] || [ -z "$billing_account_id" ] || [ -z "$workspace_domain" ] || [ -z "$clasp_project_title" ] || [ -z "$gcp_account_email" ]; then
        echo "Error: All required fields must be set in the config file."
        exit 1
    fi
}

function run_terraform() {
  echo
  echo "--- Setting up Google Cloud Project and APIs with Terraform ---"
  
  cd terraform

  echo "Initializing Terraform..."
  terraform init -upgrade

  export TF_VAR_gcp_project_id="$gcp_project_id"
  export TF_VAR_billing_account_id="$billing_account_id"
  export TF_VAR_workspace_domain="$workspace_domain"

  if [[ -n $(gcloud projects list --filter="project_id=$gcp_project_id" --format="value(project_id)") ]]; then
    echo "Project '$gcp_project_id' already exists. Importing into Terraform state..."
    terraform import google_project.project "$gcp_project_id"
    services=(
      "iam.googleapis.com" "cloudresourcemanager.googleapis.com" "drive.googleapis.com"
      "admin.googleapis.com" "script.googleapis.com" "sheets.googleapis.com"
      "groupssettings.googleapis.com" "iap.googleapis.com"
    )
    for service in "${services[@]}"; do
      terraform import "google_project_service.apis[\"$service\"]" "$gcp_project_id/$service" || echo "Could not import $service, will try to enable it."
    done
    echo "Import complete."
  fi

  echo "Applying Terraform configuration..."
  terraform apply -auto-approve
  echo "Terraform provisioning complete!"
  
  cd .. # Return to the /app directory
}

function configure_oauth_and_service_account() {
  echo
  echo "--- Creating Service Account ---"
  local service_account_email="drive-permission-manager-sa@$gcp_project_id.iam.gserviceaccount.com"

  if ! gcloud iam service-accounts describe "$service_account_email" --project=$gcp_project_id > /dev/null 2>&1; then
    echo "Creating new service account..."
    gcloud iam service-accounts create drive-permission-manager-sa \
      --display-name="Drive Permission Manager Service Account" \
      --project=$gcp_project_id
    gcloud projects add-iam-policy-binding $gcp_project_id \
      --member="serviceAccount:$service_account_email" \
      --role="roles/editor"
    echo "Service account created and configured."
  else
    echo "Service account already exists."
  fi

  echo
  echo "--- Configuring OAuth Consent Screen ---"
  local brand_id=$(gcloud alpha iap oauth-brands list --project=$gcp_project_id --format='value(name)')
  if [ -z "$brand_id" ]; then
    echo "Creating new OAuth brand (consent screen)..."
    gcloud alpha iap oauth-brands create --application_title="$clasp_project_title" --support_email=$gcp_account_email --project=$gcp_project_id
    echo "OAuth consent screen created. Waiting 10 seconds for it to be ready..."
    sleep 10
  else
    echo "OAuth brand (consent screen) already exists."
  fi

  echo
  echo "--- Creating OAuth Client ID ---"
  brand_id=$(gcloud alpha iap oauth-brands list --project=$gcp_project_id --format='value(name)')
  gcloud alpha iap oauth-clients create "$brand_id" --display_name="$clasp_project_title" --project=$gcp_project_id
  echo "OAuth client ID created."
}

function create_and_deploy_clasp_project() {
  echo
  echo "--- Creating/Cloning and Deploying Google Apps Script Project ---"
  
  cd apps_script_project

  echo "Checking for existing Apps Script project titled '$clasp_project_title' מס"
  # Grep for the title, ensuring it's the full line, then get the first field (the ID).
  existing_script_id=$(clasp list | grep -w "$clasp_project_title" | awk '{print $1}')

  if [ -n "$existing_script_id" ]; then
    echo "Project found. Cloning ID: $existing_script_id"
    # Clean up any local files before cloning to ensure a fresh start.
    rm -f .clasp.json appsscript.json Code.js
    clasp clone "$existing_script_id"
  else
    echo "No existing project found. Creating a new one..."
    # Clean up any old project file in this directory and the parent directory
    rm -f .clasp.json
    rm -f ../.clasp.json
    clasp create \
      --type standalone \
      --title "$clasp_project_title"
  fi

  echo "Deploying Apps Script Code..."
  clasp push --force

  echo "Deployment complete!"
  cd .. # Return to the /app directory
}

# --- Main Script ---

print_header
load_config

echo "--- Verifying Credentials ---"
gcloud config set account "$gcp_account_email"
gcloud auth list

run_terraform
configure_oauth_and_service_account
create_and_deploy_clasp_project

# --- Final Instructions ---
script_id=$(cat ./apps_script_project/.clasp.json | grep -o '"scriptId":"[^"]*"' | sed 's/"scriptId":"//;s/"//')
script_url="https://script.google.com/d/$script_id/edit"

echo
echo "================================================="
echo " ✅ Setup Complete!"
echo "================================================="
echo
echo "Your Google Cloud resources and Apps Script project have been created and deployed."
echo
echo "--- 👉 ONE FINAL MANUAL STEP IS REQUIRED ---"
echo
echo "You must now manually link your new Apps Script project to your Google Cloud project."
echo "For detailed instructions, please see the 'Post-Setup Manual Steps' section in the README.md file."
echo
echo "--- Your New Apps Script Project ---"
echo "URL: $script_url"
echo
echo "For instructions on how to use the spreadsheet and manage permissions, please consult the README.md file."
echo

exit 0