# Project Evolution Summary

This document summarizes the debugging process and final architecture of the Google Drive Permission Manager project.

## Initial Problem

The initial `setup.sh` script, designed to be run within a Docker container, was not functional. It suffered from a series of issues related to authentication, idempotency, state management, and outdated command syntax.

## Debugging Journey & Resolutions

Through a lengthy, iterative process, we diagnosed and resolved several core issues:

1.  **Authentication Failures:** The script was failing because the `gcloud` auth tokens mounted into the container were expiring. The fix was to update the documentation to explicitly instruct the user to run `gcloud auth login` and `clasp login` on their local machine immediately before running the setup container.

2.  **Lack of Idempotency:** The script failed on re-runs because `terraform` would try to create a Google Cloud project that already existed. This was solved by making the script idempotent: it now checks if the project exists and, if so, uses `terraform import` to adopt the existing resources into its state before applying changes.

3.  **State Persistence:** The `clasp` command was successfully creating an Apps Script project, but the vital `.clasp.json` file (which links the local code to the remote script) was being created inside the container and destroyed when the container exited. This was a critical oversight.

4.  **User Experience:** The `docker run` command was long, complex, and error-prone.

5.  **`clasp` API Issues:** The `clasp create --parentId` command was discovered to be unreliable in the user's environment, failing with a generic "Invalid argument" error. The solution was to remove this argument and have the user perform the linking manually.

6.  **Advanced Script Debugging:** A subsequent, deep debugging session revealed several chained failures within the `setup.sh` script itself:
    *   **Path-Dependence:** The script would `cd` into the `terraform` directory, causing all subsequent commands that relied on relative paths to fail or behave unexpectedly.
    *   **`clasp` Tooling Issues:** The `clasp` command-line tool exhibited confusing behavior. It would get confused by stray `.clasp.json` files in parent directories and fail to create new project files in the correct location.
    *   **API Race Conditions:** The script would fail because it was calling Google Cloud APIs to create a resource and then immediately use that resource before it had fully propagated on Google's backend.
    *   **The Solution:** The `setup.sh` script was completely rewritten to be more robust. It now uses self-contained functions for each logical step and carefully manages its working directory (`cd`ing into a directory, performing a task, and `cd`ing back out). This eliminated all path-related issues. The `clasp` steps were also made more resilient by explicitly removing any potentially confusing stray files before creation. Finally, a `sleep` command was added to mitigate the API race condition.

## Final Architecture & Workflow

The project is now in a robust, well-documented, and user-friendly state.

1.  **`docker-compose.yml`:** The long `docker run` command has been replaced entirely by a `docker-compose.yml` file. This file declaratively defines the service, the image to build, and, most importantly, all the necessary volume mounts:
    *   `~/.config/gcloud` (for gcloud credentials)
    *   `~/.clasprc.json` (for clasp credentials)
    *   `./setup.conf` (for project configuration)
    *   `./apps_script_project` (to ensure the `.clasp.json` file is persisted to the user's local machine)

2.  **Simplified Workflow:** The user workflow is now much simpler and more reliable:
    1.  Complete the one-time onboarding in `docs/ONBOARDING.md`.
    2.  Create and populate the `setup.conf` file.
    3.  Run `gcloud auth login` and `clasp login`.
    4.  Run a single command: `docker-compose up --build`. This builds the image and runs the container with all the correct parameters.
    5.  Follow the clear post-setup instructions in the `README.md` for the few remaining manual steps (billing and project linking).

3.  **Improved Documentation:** The `README.md` has been significantly overhauled to reflect the new, simpler workflow. It now includes clear sections for `Usage` (how to initialize the sheet) and `Tearing Down the Project`, providing a complete lifecycle guide.

4.  **`teardown.sh`:** A helper script is provided to automate the deletion of the GCP project and local state files, making it easy to start fresh.
