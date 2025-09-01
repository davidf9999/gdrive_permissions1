# Google Drive Permission Manager

This repository contains a complete, automated solution for managing access to a large number of Google Drive folders for many users. It uses Google Groups, controlled by a central Google Sheet, to provide a scalable and auditable permissions system.

It is designed to be set up from scratch by any user with a Google Workspace account, using a containerized setup wizard that provisions all necessary cloud infrastructure automatically.

---

## Table of Contents

- [How it Works](#the-solution-google-groups-and-automation)
- [Setup Guide](#setup-guide)
- [Usage Guide](#usage-guide)
- [Tearing Down the Project](#tearing-down-the-project)
- [Advanced Features](#advanced-features)

---

## The Solution: Google Groups and Automation

This project solves the problem of managing Drive access at scale by using **Google Groups** as the access control mechanism. Instead of sharing a folder with many individual users (which can hit Google Drive's sharing limits), you share it with a single Google Group. This allows you to manage hundreds (or even thousands) of members by simply adding or removing them from that group.

This solution automates the entire lifecycle of this approach:

1.  You define which folders to manage in a central Google Sheet.
2.  The script automatically creates dedicated Google Groups for different roles (e.g., `project-x-editors@your-domain.com`).
3.  You manage the membership of these groups simply by adding or removing emails from other sheets.
4.  The script runs automatically to sync the group memberships, effectively granting or revoking access to the Drive folders.

---

## Setup Guide

This guide will walk you through the complete, one-time setup process.

### Step 1: Prerequisites

Before you begin, you must have the following command-line tools installed on your local machine.

*   **Google Cloud SDK (`gcloud`):** This is used to authenticate with your Google account and manage cloud resources.
    *   [Installation Guide](https://cloud.google.com/sdk/docs/install)
*   **`clasp`:** This is the official command-line tool for Google Apps Script.
    *   [Installation Guide](https://github.com/google/clasp#install)
*   **Docker and Docker Compose:** This is used to build and run the setup container in a consistent environment.
    *   [Installation Guide](https://docs.docker.com/get-docker/)

### Step 2: Google Account & Billing Setup

This solution requires a Google Workspace account and an active Google Cloud Billing account.

1.  **Set Up Google Workspace:**
    *   You must have a **Google Workspace** account with your own domain name (e.g., `your-company.com`). A standard `@gmail.com` account is **not** sufficient.
    *   The user account you use for this setup **must** be a **Super Admin** for your Google Workspace domain.

2.  **Set Up Google Cloud Billing:**
    *   Go to the [Google Cloud Console Billing page](https://console.cloud.google.com/billing).
    *   Ensure you are logged in as the same Super Admin user.
    *   Create a new billing account if you don't have one. This requires a valid credit card. New users are often eligible for a free trial.
    *   Take note of your **Billing Account ID** (e.g., `012345-ABCDEF-GHIJKL`). You will need this for the next step.

### Step 3: Project Configuration

The setup wizard runs non-interactively using a configuration file.

1.  **Create a Configuration File:**
    Copy the `setup.conf.example` file to a new file named `setup.conf`.

    ```bash
    cp setup.conf.example setup.conf
    ```

2.  **Populate the File:**
    Edit the `setup.conf` file and fill in the required values, including the Billing Account ID you noted in the previous step.

### Step 4: Run the Automated Setup

This is the final step to provision all your cloud resources.

1.  **Authenticate Your Local Environment:**
    Before running the setup, ensure your local environment is authenticated with Google. Your authentication tokens can expire, so it's good practice to run these commands even if you have authenticated before.

    ```bash
    # Authenticate with the Google Cloud SDK
    gcloud auth login

    # Authenticate with clasp (the Apps Script command-line tool)
    clasp login
    ```

2.  **Run the Setup Wizard with Docker Compose:**
    After authenticating, execute the following commands from the root of the project directory.

    First, build the Docker image:
    ```bash
    # Note: Use "docker-compose" (with a hyphen) or "docker compose" (with a space)
    # depending on which version is installed on your system.
    docker-compose build
    ```

    Next, run the setup wizard:
    ```bash
    # Use the same command style (hyphen or space) as you did for the build command.
    docker-compose up
    ```

    This will run the setup container with all the necessary volumes mounted and execute the setup script.

### Step 5: Post-Setup Manual Steps

After the script finishes, there are two final, one-time manual steps.

1.  **Link Your Billing Account:**
    *   Go to the [Google Cloud Console Billing page](https://console.cloud.google.com/billing).
    *   You can find and select your new project using the project dropdown menu at the top of the page.
    *   You should see a notification that your new project is not linked to a billing account. Follow the on-screen prompts to associate it with your active billing account.

2.  **Link Your Apps Script Project:**
    *   The setup script creates your Apps Script project but does not link it to the Google Cloud project.
    *   Open your new Apps Script project by going to the [Apps Script Dashboard](https://script.google.com/home), finding your project by name, and clicking on it.
    *   Click on the **Project Settings** (the gear icon ⚙️) on the left sidebar.
    *   Scroll down to the **Google Cloud Platform (GCP) Project** section, click **Change Project**, and enter your new GCP Project Number (which is provided in the setup script's final output).

---

## Usage Guide

For a detailed tutorial on how to use the spreadsheet, what each sheet and column means, and common workflows, please see the dedicated **[User Guide](./docs/USER_GUIDE.md)**.

---

## Tearing Down the Project

If you wish to remove all the resources created by this project, a `teardown.sh` script is provided.

1.  **Manually Delete the Apps Script Project:**
    *   Go to your [Apps Script Dashboard](https://script.google.com/home).
    *   Find the project, click the three dots (⋮), and select **Remove**.

2.  **Run the Automated Teardown Script:**
    *   Make sure the `gcp_project_id` in your `setup.conf` file still points to the project you want to delete.
    *   Run the script from your terminal: `./teardown.sh`

---

## Advanced Features

This project also includes features for testing and logging, which are explained in more detail in the [User Guide](./docs/USER_GUIDE.md).
