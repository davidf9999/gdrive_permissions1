# Defines the outputs from our Terraform configuration.

output "project_number" {
  description = "The number of the created Google Cloud project."
  value       = google_project.project.number
}
