# Terraform configuration to create and configure the Google Cloud project.

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}

# Configure the Google Cloud provider
provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

# Create the new Google Cloud project
resource "google_project" "project" {
  project_id = var.gcp_project_id
  name       = var.gcp_project_id
}

# Enable the necessary APIs for the project
resource "google_project_service" "apis" {
  project = google_project.project.project_id

  # A list of all the APIs required by the solution
  for_each = toset([
    "iam.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "drive.googleapis.com",
    "admin.googleapis.com",
    "script.googleapis.com",
    "sheets.googleapis.com",
    "groupssettings.googleapis.com",
    "iap.googleapis.com"
  ])

  service = each.key

  # This setting prevents Terraform from trying to destroy the APIs when the project is destroyed.
  disable_on_destroy = false
}
