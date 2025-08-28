#!/bin/bash
# Setup Wizard for the Google Drive Permission Manager

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Helper Functions ---
function print_header() {
  echo "================================================="
  echo " Google Drive Permission Manager Setup Wizard"
  echo "================================================="
  echo
}

function get_user_input() {
  echo "--- Step 1: Gathering Configuration Details ---"
  echo "Please provide the following information. You can find details on where to find these values in the docs/ONBOARDING.md guide."
  echo

  read -p "Enter your desired Google Cloud Project ID (e.g., my-gdrive-manager): " gcp_project_id
  read -p "Enter your Google Cloud Billing Account ID (e.g., 012345-ABCDEF-GHIJKL): " billing_account_id
  read -p "Enter your Google Workspace domain (e.g., your-company.com): " workspace_domain

  # Basic validation
  if [ -z "$gcp_project_id" ] || [ -z "$billing_account_id" ] || [ -z "$workspace_domain" ]; then
    echo "Error: All fields are required. Please try again."
    exit 1
  fi
}

function configure_oauth() {
  echo
  echo "--- Step 3: Configuring OAuth Consent Screen ---"
  echo "Setting OAuth consent screen user type to internal and support email to $authed_user."
  
  # The command to create the brand is idempotent; it will use the existing one if it finds one.
  # Note: This gcloud command is in alpha.
  gcloud alpha iap oauth-brands create --application_title="Drive Permission Manager" --support_email=$authed_user --project=$gcp_project_id

  echo "OAuth consent screen configured."
}

function create_clasp_project() {
  echo
  echo "--- Step 4: Creating Google Apps Script Project ---"
  read -p "Enter a name for the new Apps Script project (e.g., DrivePermissionManager): " clasp_project_title

  if [ -z "$clasp_project_title" ]; then
    echo "Error: Apps Script project title is required."
    exit 1
  fi

  # Read the project number from the terraform output
  project_number=$(terraform output -raw project_number)

  echo "Creating new Apps Script project titled '$clasp_project_title'வுகளை..."
  # Create the clasp project in the apps_script_project directory, linked to our GCP project
  # We need to navigate back to the root directory first
  cd ..
  
  clasp create \
    --type standalone \
    --title "$clasp_project_title" \
    --parentId "$project_number" \
    --rootDir ./apps_script_project
}


# --- Main Script ---

print_header

# --- Step 0: Authentication ---
echo "--- Step 0: Authenticating with Google Cloud ---"
echo "A browser window will open for you to log in and grant permissions."
read -p "Press [Enter] to continue..."

gcloud auth login

# Get the logged-in user's email for confirmation
authed_user=$(gcloud config get-value account)
echo "Successfully authenticated as: $authed_user"
echo

get_user_input

# --- Step 2: Provisioning Google Cloud Resources with Terraform ---
echo
echo "--- Step 2: Setting up Google Cloud Project and APIs ---"
echo "The script will now use Terraform to create the following resources:"
echo "  - A new Google Cloud Project with ID: $gcp_project_id"
echo "  - Link the project to Billing Account: $billing_account_id"
echo "  - Enable all necessary APIs (Drive, Admin SDK, etc.)"
echo

read -p "Do you want to proceed with provisioning these resources? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Aborted by user."
    exit 1
fi

# Navigate to the terraform directory
cd terraform

# Initialize Terraform
echo "Initializing Terraform..."
terraform init -upgrade

# Apply the Terraform configuration
echo "Applying Terraform configuration..."
terraform apply -auto-approve \
  -var="gcp_project_id=$gcp_project_id" \
  -var="billing_account_id=$billing_account_id" \
  -var="workspace_domain=$workspace_domain"

echo "Terraform provisioning complete!"

# --- Step 3: Configure OAuth ---
configure_oauth

# --- Step 4: Create Apps Script Project ---
create_clasp_project

# --- Step 5: Push the code ---
echo
echo "--- Step 5: Deploying Apps Script Code ---"
# The clasp project was created in the apps_script_project directory, so we need to be in the parent of that.
# The create_clasp_project function already moved us to the root.
clasp push --force

echo "Deployment complete!"
echo


echo "================================================="
echo " Setup Complete!"
echo "================================================="
echo "You can now open the new Apps Script project in your browser and run the functions from the script editor."
echo "A .clasp.json file has been created in the apps_script_project directory, containing the Script ID."
