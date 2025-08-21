# Google Drive Permission Manager - Installer & Source

This repository contains the full source code and an automated installer for the Google Drive Permission Manager.

The system allows you to manage access to a large number of Google Drive folders using Google Groups, all controlled from a single Google Sheet.

## Features

- **Automated Setup:** A command-line wizard to set up all necessary Google Cloud and Workspace resources.
- **Infrastructure as Code:** Uses Terraform to provision and manage cloud infrastructure.
- **Containerized Environment:** A Docker container ensures the setup process is reliable and repeatable.
- **Scalable Permission Management:** The Apps Script at the core is designed to handle many folders and groups efficiently.

## Getting Started

To get started, please follow the guide in `docs/ONBOARDING.md`.