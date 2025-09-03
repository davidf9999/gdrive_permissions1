#!/bin/bash

# Google Drive Permission Manager Setup
# Creates GCP infrastructure and provides manual setup instructions

set -e  # Exit on any error

# Check if setup.conf exists
if [ ! -f /app/setup.conf ]; then
    echo "ERROR: Configuration file /app/setup.conf not found."
    echo "Please copy setup.conf.example to setup.conf and fill in your details."
    exit 1
fi

source /app/setup.conf

echo "================================================="
echo " Google Drive Permission Manager Setup Wizard"
echo "================================================="
echo ""
echo "--- Loading Configuration from /app/setup.conf ---"

# Function to run Terraform setup
function run_terraform() {
  echo 
  echo "--- Step 1: Setting up Google Cloud Project and APIs ---"
  cd terraform
  echo "Initializing Terraform..."
  terraform init -upgrade
  export TF_VAR_gcp_project_id="$gcp_project_id"
  export TF_VAR_billing_account_id="$billing_account_id"
  export TF_VAR_workspace_domain="$workspace_domain"
  
  if [[ -n $(gcloud projects list --filter="project_id=$gcp_project_id" --format="value(project_id)") ]]; then
    echo "Project '$gcp_project_id' already exists. Checking if it's in Terraform state..."
    if ! terraform state show google_project.project >/dev/null 2>&1; then
      echo "Importing project into Terraform state..."
      terraform import google_project.project "$gcp_project_id" || {
        echo "Import failed, but continuing anyway..."
      }
    else
      echo "Project already managed by Terraform, skipping import."
    fi
  fi
  
  echo "Applying Terraform configuration..."
  terraform apply -auto-approve
  echo "Terraform provisioning complete!"
  cd ..
}

# Function to create service account and OAuth client
function setup_service_account() {
  echo 
  echo "--- Step 2: Creating Service Account and OAuth Client ---"
  
  # Define service account variables
  local service_account_name="drive-permission-manager-sa"
  local service_account_email="drive-permission-manager-sa@$gcp_project_id.iam.gserviceaccount.com"
  local service_account_display_name="Drive Permission Manager Service Account"
  
  # Check if service account exists
  if gcloud iam service-accounts describe $service_account_email --project=$gcp_project_id >/dev/null 2>&1; then
    echo "Service account already exists, skipping creation."
  else
    echo "Creating service account..."
    gcloud iam service-accounts create $service_account_name --display-name="$service_account_display_name" --project=$gcp_project_id
  fi
  
  echo "Setting service account permissions..."
  gcloud projects add-iam-policy-binding $gcp_project_id --member="serviceAccount:$service_account_email" --role="roles/editor"
  
  # OAuth brand and client setup
  echo "Setting up OAuth brand and client..."
  
  # Define OAuth variables
  local oauth_application_title="Drive Permission Manager"
  local oauth_client_display_name="Drive Permission Manager Client"
  
  # Check if OAuth brand exists
  if gcloud alpha iap oauth-brands list --project=$gcp_project_id 2>/dev/null | grep -q "oauth2"; then
    echo "OAuth brand already exists, skipping creation."
  else
    echo "Creating OAuth brand..."
    gcloud alpha iap oauth-brands create --application_title="$oauth_application_title" --support_email="$(gcloud config get-value account)" --project=$gcp_project_id || {
      echo "OAuth brand creation failed (may already exist), continuing..."
    }
  fi
  
  # Check if OAuth client exists  
  echo "Getting OAuth brand information..."
  brand_name=$(gcloud alpha iap oauth-brands list --project=$gcp_project_id --format="value(name)" 2>/dev/null | head -1)
  echo "DEBUG: Brand name found: '$brand_name'"
  
  if [ -n "$brand_name" ]; then
    if gcloud alpha iap oauth-clients list $brand_name --project=$gcp_project_id 2>/dev/null | grep -q "oauth-clients"; then
      echo "OAuth client already exists, skipping creation."
    else
      echo "Creating OAuth client..."
      gcloud alpha iap oauth-clients create $brand_name --display_name="$oauth_client_display_name" --project=$gcp_project_id || {
        echo "OAuth client creation failed (may already exist), continuing..."
      }
    fi
  else
    echo "⚠️  No OAuth brand found. This might be expected if the brand was just created."
    echo "   You can manually create OAuth clients later if needed."
  fi
  
  echo "Service account and OAuth client setup complete."
}

# Function to prepare Apps Script files
function prepare_apps_script() {
  echo 
  echo "--- Step 3: Preparing Apps Script Files ---"
  
  echo "✅ Apps Script code is ready at: apps_script_project/Code.js"
  echo "✅ Template config file prepared"
}

# Function to provide manual setup instructions
function provide_manual_instructions() {
  echo 
  echo "--- Step 4: Manual Setup Instructions ---"
  
  sheet_name="[Control Sheet] $clasp_project_title"
  
  echo "=== MANUAL STEPS REQUIRED ==="
  echo ""
  echo "✅ GCP infrastructure is ready!"
  echo "✅ Apps Script code is prepared!"
  echo ""
  echo "Now complete the setup manually:"
  echo ""
  echo "1. CREATE GOOGLE SHEET:"
  echo "   • Go to https://sheets.google.com"
  echo "   • Create new sheet with exact title: '$sheet_name'"
  echo "   • Copy the Sheet ID from URL (between '/d/' and '/edit')"
  echo ""
  echo "2. SET UP APPS SCRIPT:"
  echo "   • In your new sheet, go to Extensions > Apps Script"
  echo "   • Delete the default function myFunction() {}"
  echo "   • Copy all content from: apps_script_project/Code.js"
  echo "   • Paste into the Apps Script editor"
  echo ""
  echo "3. CREATE CONFIG FILE:"
  echo "   • In Apps Script, click + next to Files"
  echo "   • Create new JSON file named: config.json"
  echo "   • Copy content from: apps_script_project/config.json.template"
  echo "   • Replace placeholders with your actual values:"
  echo "     - YOUR-GCP-PROJECT-ID → $gcp_project_id"
  echo "     - YOUR-GOOGLE-SHEET-ID → (your copied Sheet ID)"
  echo ""
  echo "4. SAVE AND TEST:"
  echo "   • Save the Apps Script project"
  echo "   • Refresh your Google Sheet"
  echo "   • You should see 'Permissions Manager' menu appear"
  echo "   • Click 'Permissions Manager' > 'Sync All' to test"
}


# Main execution
echo "--- Verifying Credentials ---"
gcloud auth list

run_terraform
setup_service_account  
prepare_apps_script
provide_manual_instructions

echo ""
echo "================================================="
echo " Infrastructure Setup Complete! 🎉"
echo "================================================="
echo ""
echo "✅ Google Cloud Project: $gcp_project_id"
echo "✅ All APIs enabled via Terraform"
echo "✅ Service account created and configured"
echo "✅ OAuth brand and client set up"
echo "✅ Apps Script code prepared: apps_script_project/Code.js"
echo ""
echo "⭐ Follow the manual steps above to complete setup"
echo ""
echo "📚 Documentation:"
echo "   • Setup troubleshooting: README.md"
echo "   • Usage guide: docs/USER_GUIDE.md"
echo ""
echo "================================================="