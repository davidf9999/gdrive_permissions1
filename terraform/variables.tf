# Defines the variables that the user will provide to the setup wizard.

variable "gcp_project_id" {
  description = "The desired ID for the new Google Cloud project. Must be globally unique."
  type        = string
}

variable "billing_account_id" {
  description = "The ID of the Google Cloud Billing Account to link to the new project."
  type        = string
}

variable "workspace_domain" {
  description = "The primary domain of your Google Workspace account (e.g., your-company.com)."
  type        = string
}

variable "gcp_region" {
  description = "The Google Cloud region where resources will be deployed."
  type        = string
  default     = "us-central1"
}
