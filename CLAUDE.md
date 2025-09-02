# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Google Drive Permission Manager that provides an automated solution for managing access to large numbers of Google Drive folders using Google Groups and a central Google Sheet for control. The project has evolved from complex automated setup to a simplified manual approach that is more reliable and easier to understand.

## Architecture

The project consists of three main components:

1. **Apps Script Core** (`apps_script_project/Code.js`): The main application logic that runs in Google Sheets and manages Google Groups and Drive folder permissions. This is the heart of the system.

2. **Configuration Template** (`apps_script_project/config.json.template`): Template for the configuration file that connects the Apps Script to the specific Google Sheet and GCP project.

3. **Optional Infrastructure Setup** (`terraform/` + `scripts/setup.sh`): Terraform and Docker-based setup for creating GCP resources. This is optional for basic functionality but recommended for production use.

## Current Setup Approach (Simplified)

The recommended setup approach is now **manual** for reliability:

1. **Manual Sheet Creation**: Create Google Sheet with specific naming convention
2. **Manual Script Copy**: Copy `Code.js` content into Apps Script editor via Extensions > Apps Script  
3. **Manual Config**: Create `config.json` file in Apps Script with Sheet ID and Project ID
4. **Immediate Functionality**: "Permissions Manager" menu appears automatically, full functionality available

**Optional**: Run Docker-based infrastructure setup for production-grade GCP resources, higher API quotas, and advanced OAuth configuration.

## Development Commands

### Manual Setup (Recommended)
```bash
# 1. Create Google Sheet manually with title: [Control Sheet] DrivePermissionManagerXX
# 2. Go to Extensions > Apps Script in the sheet
# 3. Copy content from apps_script_project/Code.js and paste it
# 4. Create config.json file in Apps Script with your Sheet ID and Project ID
# 5. Save and refresh - "Permissions Manager" menu appears
```

### Optional Infrastructure Setup
```bash
# Build the Docker environment
docker compose build

# Run infrastructure setup (creates GCP project, APIs, service accounts)
docker compose up
```

### Apps Script Development
**Note**: With manual approach, you edit directly in the Apps Script web editor. No clasp needed for deployment.

```bash
# For development only - pushing changes from local files (optional)
clasp login
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

### Apps Script Changes (Manual Approach)
1. Edit directly in the Google Apps Script web editor
2. Save changes automatically sync
3. Test immediately in the connected Google Sheet
4. **Optional**: Copy changes back to local `apps_script_project/Code.js` for version control

### Apps Script Changes (Development Approach)
1. Make changes to `apps_script_project/Code.js` locally
2. Use clasp to push to remote Apps Script project (if using automated setup)
3. The local `Code.js` file serves as the authoritative version

### Testing Features
The system includes comprehensive testing utilities accessible via the "Permissions Manager" menu:
- **Manual Access Test**: Step-by-step wizard for testing single user access
- **Stress Test**: Performance testing with configurable folder/user volumes
- **Cleanup Functions**: Remove test data (manual test data, stress test data)

### Infrastructure Changes
- Modify `terraform/main.tf` for Google Cloud resource changes
- Run terraform plan/apply to update infrastructure
- The setup wizard handles initial provisioning

## Setup Approaches and Trade-offs

### Manual Setup (Current Recommended)
**Advantages:**
- Simple and reliable - no complex automation to fail
- Works immediately with default Google Workspace APIs
- No Docker, Terraform, or complex authentication required
- Easy to understand and troubleshoot

**Disadvantages:**
- Requires manual steps (copy/paste code, create config)
- Uses default API quotas (usually sufficient for most use cases)
- No automated GCP resource provisioning

### Automated Infrastructure Setup (Optional)
**Advantages:**
- Creates dedicated GCP project with higher API quotas
- Automated service account and OAuth client setup
- Terraform-managed infrastructure as code
- Fully reproducible setup

**Disadvantages:**
- Complex Docker/Terraform setup can fail in various ways
- Requires extensive Google Cloud authentication
- May be overkill for basic usage
- Debugging authentication issues can be challenging

### Current Configuration Pattern
- **GCP Project**: `permission-manager-XX` (where XX increments for new setups)
- **Apps Script Project**: `DrivePermissionManagerXX`
- **Sheet Title**: `[Control Sheet] DrivePermissionManagerXX`

### Hybrid Approach (Best of Both)
1. Start with manual setup for immediate functionality
2. Optionally run infrastructure setup later for production scaling
3. The Apps Script code works the same way regardless of setup method

## Important Notes

- **Google Workspace Required**: Must have Google Workspace account (not standard Gmail) for Admin SDK API access to manage groups
- **Manual Setup is Preferred**: The manual approach is now recommended over automated Docker setup for reliability
- **All Google Groups and permissions are managed programmatically** via the Apps Script
- **Comprehensive logging system** tracks all operations in dedicated sheets within the control spreadsheet
- **Configurable error email notifications** available through the Config sheet
- **Rate limiting** (Utilities.sleep) built into the code to avoid API throttling
- **Flexible deployment**: Core functionality works with minimal setup, infrastructure can be added later for scaling

## Dependencies and APIs

### Required Google APIs (Auto-enabled or Available by Default)
- **Admin Directory API** (group management) - Core functionality
- **Drive API** (folder permissions) - Core functionality  
- **Sheets API** (spreadsheet access) - Always available in Apps Script
- **Groups Settings API** (group configuration) - For advanced group settings

### Optional Infrastructure (Docker Container)
When using the optional infrastructure setup, the container includes:
- Google Cloud SDK (`gcloud`) - For authentication and GCP resource management
- Terraform (infrastructure provisioning) - For reproducible cloud resource setup
- Google Apps Script CLI (`clasp`) - For automated script deployment (not needed with manual approach)
- Google Apps Manager (`gam`) - For advanced Google Workspace management

### API Quotas and Limits
- **Manual Setup**: Uses default Google Workspace API quotas (sufficient for most use cases)
- **Infrastructure Setup**: Creates dedicated GCP project with higher quotas and better monitoring