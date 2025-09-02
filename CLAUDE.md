# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Google Drive Permission Manager that provides an automated solution for managing access to large numbers of Google Drive folders using Google Groups and a central Google Sheet for control. It's designed as a complete installation package with Docker-based setup.

## Architecture

The project consists of four main components:

1. **Docker Environment** (`Dockerfile`): Provides a consistent setup environment with all dependencies pre-installed (gcloud, terraform, clasp, gam)

2. **Infrastructure as Code** (`terraform/`): Terraform configuration that programmatically provisions Google Cloud resources, creates GCP projects, links billing accounts, and enables necessary APIs

3. **Setup Wizard** (`scripts/setup.sh`): Interactive CLI installer that guides users through authentication, configuration, and orchestrates Terraform and clasp deployment

4. **Apps Script Core** (`apps_script_project/`): The main application logic that runs in Google Sheets and manages Google Groups and Drive folder permissions

## Development Commands

### Setup and Installation
```bash
# Build the Docker environment
docker build -t gdrive-permission-manager .

# Run the setup wizard
docker run -it gdrive-permission-manager
```

### Apps Script Development
```bash
# Authenticate with Google (required before pushing changes)
clasp login

# Push local code changes to the remote Google Apps Script project
clasp push --project apps_script_project --force
```

### Terraform Operations
```bash
cd terraform
terraform init
terraform plan -var="gcp_project_id=PROJECT_ID" -var="billing_account_id=BILLING_ID" -var="workspace_domain=DOMAIN"
terraform apply -var="gcp_project_id=PROJECT_ID" -var="billing_account_id=BILLING_ID" -var="workspace_domain=DOMAIN"
```

## Core Architecture Patterns

### Google Apps Script Structure
The main logic in `apps_script_project/Code.js` follows a clear pattern:

- **Configuration Constants** (lines 1-17): Sheet names and column mappings
- **Menu & Triggers** (lines 19-120): UI setup and sheet initialization
- **Main Sync Functions** (lines 122-290): Core orchestration functions
- **Core Logic** (lines 293-418): Individual processing functions
- **Helper Functions** (lines 420-642): Utility functions for Google APIs
- **Test Functions** (lines 644-976): Development and testing utilities

### Key Functions
- `fullSync()`: Main synchronization function that processes all managed folders
- `syncAdmins()`: Manages spreadsheet editor permissions
- `syncUserGroups()`: Manages custom user group definitions
- `processManagedFolders_()`: Processes the main configuration sheet
- `processRow_(rowIndex)`: Handles individual folder configurations

### Google Sheet Configuration
The system uses multiple sheets for configuration:
- `ManagedFolders`: Main configuration with folder names, IDs, roles, and group emails
- `Admins`: List of users who can edit the spreadsheet
- `UserGroups`: Custom user group definitions
- `Config`: System settings including email notifications
- `Log` / `TestLog`: Operational logging

### Permission Model
- Creates Google Groups for each folder-role combination (e.g., `project-x-editors@domain.com`)
- Shares Drive folders with these groups instead of individual users
- Manages group membership by syncing with corresponding sheets
- Supports Editor, Viewer, and Commenter roles

## Development Workflow

### Apps Script Changes
1. Make changes to `apps_script_project/Code.js` locally
2. Authenticate: `clasp login`
3. Push changes: `clasp push --project apps_script_project --force`
4. The single source of truth is the local `Code.js` file

### Testing Features
The system includes comprehensive testing utilities accessible via the "Permissions Manager" menu:
- **Manual Access Test**: Step-by-step wizard for testing single user access
- **Stress Test**: Performance testing with configurable folder/user volumes
- **Cleanup Functions**: Remove test data (manual test data, stress test data)

### Infrastructure Changes
- Modify `terraform/main.tf` for Google Cloud resource changes
- Run terraform plan/apply to update infrastructure
- The setup wizard handles initial provisioning

## Setup Issues and Resolutions

### Current Setup Status
The setup script (`scripts/setup.sh`) has been extensively debugged and made robust to handle:
- **Existing resource detection**: Script detects and reuses existing GCP resources (service accounts, OAuth clients)
- **Apps Script project handling**: Handles existing projects by extracting script IDs from truncated `clasp list` output
- **Google Sheets conflict checking**: Made optional when Drive API scopes aren't available
- **Authentication scope issues**: Falls back to basic tokens when scoped tokens fail

### Known Issues Being Debugged
1. **Docker Volume Mounting**: The setup script runs in Docker but may have issues accessing gcloud credentials from host
   - Host credentials: `~/.config/gcloud/application_default_credentials.json`
   - Container mount: `/root/.config/gcloud/`
   - May need debugging if `gcloud auth print-access-token` fails in container

2. **Authentication Requirements**: 
   - User must run `gcloud auth login` and `gcloud auth application-default login` on host
   - Container needs access to these credentials for API calls
   - Script requires Drive API and Sheets API scopes for creating/managing resources

### Current Configuration
- **GCP Project**: `permission-manager-23` 
- **Apps Script Project**: `DrivePermissionManager23`
- **Existing Script ID**: `1FEhi-Lf0xDXPPDAKFbFPQkr2Ika4CFTpgxpz64URMX6FTzRCy8X7b5aH`

### Debugging Approach
The setup script includes extensive debug output to track:
- Directory contents and file movements
- `clasp` command outputs and exit codes
- Authentication token retrieval attempts
- API response details

## Important Notes

- Requires Google Workspace account (not standard Gmail) for Admin SDK API access
- Uses Docker for consistent development environment across platforms
- All Google Groups and permissions are managed programmatically
- Logging system tracks all operations in dedicated sheets
- Supports configurable error email notifications
- Uses rate limiting (Utilities.sleep) to avoid API throttling
- **Setup script is idempotent**: Can be run multiple times safely, will reuse existing resources

## Dependencies and APIs

Required Google APIs (automatically enabled by Terraform):
- Admin Directory API (group management)
- Drive API (folder permissions)
- Apps Script API
- Sheets API
- Groups Settings API

Container includes:
- Google Cloud SDK (`gcloud`)
- Terraform (infrastructure provisioning)
- Google Apps Script CLI (`clasp`)
- Google Apps Manager (`gam`)