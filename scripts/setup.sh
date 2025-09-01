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
    if [ -z "$gcp_project_id" ] || [ -z "$billing_account_id" ] || [ -z "$workspace_domain" ] || [ -z "$clasp_project_title" ] || [ -z "$gcp_account_email" ]; then
        echo "Error: All required fields must be set in the config file."
        exit 1
    fi
}

function pre_run_conflict_check() {
  echo
  echo "--- Step 1: Checking for Conflicting Projects ---"
  
  # Check for conflicting Apps Script Project
  echo "Checking for existing Apps Script project titled '$clasp_project_title' நான"
  # We use || true to prevent grep from exiting the script if no match is found
  existing_script_id=$(clasp list | grep -w "$clasp_project_title" | awk '{print $1}' || true)
  if [ -n "$existing_script_id" ]; then
    echo "ERROR: An Apps Script project named '$clasp_project_title' already exists."
    echo "To prevent conflicts, please choose a new, unique 'clasp_project_title' in your setup.conf,"
    echo "or manually delete the existing Apps Script project if you are sure it is an orphan."
    exit 1
  fi
  echo "No conflicting Apps Script project found."

  # Check for conflicting Google Sheet
  sheet_name="[Control Sheet] $clasp_project_title"
  echo "Checking for existing Google Sheet titled '$sheet_name' நான"
  # Note: Drive API search can be slow to index. This is a best-effort check.
  drive_api_output=$(curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)" \
    "https://www.googleapis.com/drive/v3/files?q=name%3D%27${sheet_name}%27%20and%20mimeType%3D%27application%2Fvnd.google-apps.spreadsheet%27%20and%20trashed%3Dfalse&fields=files(id)")
  
  if [[ $(echo "$drive_api_output" | grep -o '"id"') ]]; then
    existing_sheet_id=$(echo "$drive_api_output" | grep -o '"id": "[^"]*"' | head -n 1 | sed 's/"id": "//;s/"//')
    echo "ERROR: A Google Sheet named '$sheet_name' already exists in your Drive with ID: $existing_sheet_id."
    echo "To prevent conflicts, please choose a new, unique 'clasp_project_title' in your setup.conf,"
    echo "or manually delete the existing Google Sheet if you are sure it is an orphan."
    exit 1
  fi
  echo "No conflicting Google Sheet found."
}

function run_terraform() {
  echo
  echo "--- Step 2: Setting up Google Cloud Project and APIs ---"
  cd terraform
  echo "Initializing Terraform..."
  terraform init -upgrade
  export TF_VAR_gcp_project_id="$gcp_project_id"
  export TF_VAR_billing_account_id="$billing_account_id"
  export TF_VAR_workspace_domain="$workspace_domain"
  if [[ -n $(gcloud projects list --filter="project_id=$gcp_project_id" --format="value(project_id)") ]]; then
    echo "Project '$gcp_project_id' already exists. Importing into Terraform state..."
    terraform import google_project.project "$gcp_project_id"
  fi
  echo "Applying Terraform configuration..."
  terraform apply -auto-approve
  echo "Terraform provisioning complete!"
  cd ..
}

function configure_oauth_and_service_account() {
  # This function is now simpler as it's only run on a clean setup
  echo
  echo "--- Step 3: Creating Service Account and OAuth Client ---"
  gcloud iam service-accounts create drive-permission-manager-sa --display-name="Drive Permission Manager Service Account" --project=$gcp_project_id
  local service_account_email="drive-permission-manager-sa@$gcp_project_id.iam.gserviceaccount.com"
  gcloud projects add-iam-policy-binding $gcp_project_id --member="serviceAccount:$service_account_email" --role="roles/editor"
  
  gcloud alpha iap oauth-brands create --application_title="$clasp_project_title" --support_email=$gcp_account_email --project=$gcp_project_id
  echo "Waiting 10 seconds for the new consent screen to be ready..."
  sleep 10
  local brand_id=$(gcloud alpha iap oauth-brands list --project=$gcp_project_id --format='value(name)')
  gcloud alpha iap oauth-clients create "$brand_id" --display_name="$clasp_project_title" --project=$gcp_project_id
  echo "Service account and OAuth client created."
}

function setup_apps_script_and_sheet() {
  echo
  echo "--- Step 4: Creating Apps Script, Sheet, and Cloud Config ---"
  
  cd apps_script_project

  # Create the Apps Script project
  echo "Creating new Apps Script project..."
  clasp create --type standalone --title "$clasp_project_title"

  # Create the Google Sheet
  sheet_name="[Control Sheet] $clasp_project_title"
  echo "Creating new Google Sheet named '$sheet_name'..."
  sheet_create_output=$(curl -s -X POST -H "Authorization: Bearer $(gcloud auth print-access-token)" -H "Content-Type: application/json" -d '{"properties":{"title":" Perkenalkan "}}' https://sheets.googleapis.com/v4/spreadsheets)
  export SHEET_ID=$(echo "$sheet_create_output" | grep -o '"spreadsheetId":"[^" ]*"' | sed 's/"spreadsheetId":"//;s/"//')
  if [ -z "$SHEET_ID" ]; then
      echo "ERROR: Failed to create Google Sheet. API output:"
      echo "$sheet_create_output"
      exit 1
  fi
  echo "Sheet created with ID: $SHEET_ID"

  # Create the cloud config file
  echo "Creating cloud configuration file..."
  echo "{\"gcpProjectId\": \"$gcp_project_id\", \"sheetId\": \"$SHEET_ID\"}" > config.json

  # Deploy all files to the Apps Script project
  echo "Deploying Apps Script project (Code.js, appsscript.json, config.json)..."
  clasp push --force

  echo "Deployment complete!"
  cd ..
}

# --- Main Script ---

print_header
load_config

echo "--- Verifying Credentials ---"
gcloud config set account "$gcp_account_email"
gcloud auth list

pre_run_conflict_check
run_terraform
configure_oauth_and_service_account
setup_apps_script_and_sheet

# --- Final Instructions ---
sheet_url="https://docs.google.com/spreadsheets/d/$SHEET_ID/edit"

echo
echo "================================================="
echo " ✅ Setup Complete!"
echo "================================================="
echo
echo "Your fully-automated Google Drive Permission Manager is ready."
echo
echo "--- 👉 Your Control Sheet URL --- (Bookmark This)"
echo "$sheet_url"
echo
echo "All remaining setup steps, such as linking the GCP project to the Apps Script project,"
 echo "and instructions on how to use the sheet can be found in the README.md"
echo

exit 0
EADME.md"
echo

exit 0
