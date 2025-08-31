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

function set_active_gcloud_account() {
    echo "--- Step 0: Setting Active Google Cloud Account ---"
    gcloud config set account "$gcp_account_email"
    echo "Active account set to $gcp_account_email"
    echo
}

function load_config() {
    echo "--- Step 1: Loading Configuration from $config_file ---"
    if [ ! -f "$config_file" ]; then
        echo "Error: Config file not found at '$config_file'"
        echo "Please ensure you are mounting the setup.conf file correctly with the -v flag."
        exit 1
    fi
    source "$config_file"

    # Basic validation
    if [ -z "$gcp_project_id" ] || [ -z "$billing_account_id" ] || [ -z "$workspace_domain" ] || [ -z "$clasp_project_title" ] || [ -z "$gcp_account_email" ]; then
        echo "Error: All required fields (gcp_project_id, billing_account_id, workspace_domain, clasp_project_title, gcp_account_email) must be set in the config file."
        exit 1
    fi
}

function configure_oauth_and_service_account() {
  echo
  echo "--- Step 3: Creating Service Account ---"
  local service_account_email="drive-permission-manager-sa@$gcp_project_id.iam.gserviceaccount.com"

  # Check if the service account already exists to make the script idempotent.
  if ! gcloud iam service-accounts describe "$service_account_email" --project=$gcp_project_id > /dev/null 2>&1; then
    echo "Creating new service account..."
    gcloud iam service-accounts create drive-permission-manager-sa \
      --display-name="Drive Permission Manager Service Account" \
      --project=$gcp_project_id

    # Grant the service account the necessary roles
    gcloud projects add-iam-policy-binding $gcp_project_id \
      --member="serviceAccount:$service_account_email" \
      --role="roles/editor"
    echo "Service account created and configured."
  else
    echo "Service account already exists."
  fi

  echo
  echo "--- Step 4: Configuring OAuth Consent Screen ---"

  # The brand (consent screen) can only be created once per project.
  local brand_id=$(gcloud alpha iap oauth-brands list --project=$gcp_project_id --format='value(name)')

  if [ -z "$brand_id" ]; then
    echo "Creating new OAuth brand (consent screen)..."
    gcloud alpha iap oauth-brands create --application_title="$clasp_project_title" --support_email=$gcp_account_email --project=$gcp_project_id
    echo "OAuth consent screen created."
  else
    echo "OAuth brand (consent screen) already exists."
  fi

  echo
  echo "--- Step 5: Creating OAuth Client ID ---"
  # Create the OAuth client ID for the service account
  gcloud alpha iap oauth-clients create "$service_account_email" \
    --brand_id=$(gcloud alpha iap oauth-brands list --project=$gcp_project_id --format='value(name)') \
    --project=$gcp_project_id

  echo "OAuth client ID created for the service account."
}

function create_clasp_project() {
  echo
  echo "--- Step 6: Creating Google Apps Script Project ---"
  project_number=$(terraform output -raw project_number)

  echo "Creating new Apps Script project titled '$clasp_project_title'"...
  
  # The --rootDir flag makes the command run from the correct directory context,
  # so we don't need to 'cd' into the parent directory first.
  clasp create \
    --type standalone \
    --title "$clasp_project_title" \
    --parentId "$project_number" \
    --rootDir ./apps_script_project
}


# --- Main Script ---

print_header

load_config

set_active_gcloud_account

echo "--- Step 0: Verifying Credentials ---"
echo "Verifying gcloud authentication..."
gcloud auth list

# --- Step 2: Provisioning Google Cloud Resources with Terraform ---

echo
echo "--- Step 2: Setting up Google Cloud Project and APIs ---"


cd terraform

echo "Initializing Terraform..."
terraform init -upgrade

echo "Applying Terraform configuration..."
terraform apply -auto-approve \
  -var="gcp_project_id=$gcp_project_id" \
  -var="billing_account_id=$billing_account_id" \
  -var="workspace_domain=$workspace_domain"

echo "Terraform provisioning complete!"

# --- Steps 3-5: Configure OAuth and Service Accounts ---
configure_oauth_and_service_account

# --- Step 6: Create Apps Script Project ---
create_clasp_project

# --- Step 7: Push the code ---

echo
echo "--- Step 7: Deploying Apps Script Code ---"

echo "Verifying clasp authentication..."
clasp status

clasp push --force

echo "Deployment complete!"
echo 





echo "================================================="
echo " Setup Complete!"
echo "================================================="
echo "You can now open the new Apps Script project in your browser and run the functions from the script editor."
echo "A .clasp.json file has been created in the apps_script_project directory, containing the Script ID."
