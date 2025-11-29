# AI Assistant Guide

This document provides guidance for using and developing the AI-powered assistant for the `gdrive-permissions` project.

## Recommended Environment: GitHub Codespaces

For both setting up this project using the AI assistant and for developing the assistant itself, we **strongly recommend** using the provided GitHub Codespaces environment.

*   **For Users:** Launching Codespaces gives you a pre-configured, zero-installation environment where the AI Assistant can guide you through the setup process seamlessly.
*   **For Developers:** The Codespace contains all the necessary dependencies and tools (`node`, `gcloud`, `clasp`). This avoids "it works on my machine" problems and provides a consistent environment for developing and testing.

All instructions from the AI assistant assume you are operating within the Codespaces environment.

## Developing the AI Assistant

For developers working on the AI assistant itself within the Codespaces environment, here is the recommended workflow for testing changes:

1.  **Make Local Changes:** Edit the relevant files, such as `AI_ASSISTANT_PROMPT.md`, directly within the Codespace.
2.  **Restart the Assistant:** To have the assistant use your updated instructions, you must restart it. You can do this by running the startup script directly in the terminal:
    ```bash
    /bin/bash .devcontainer/start-assistant.sh
    ```
3.  **Test the New Behavior:** A new assistant session will begin, using the latest version of the files you edited.

### Important Notes:

*   **Save Your Work:** Any changes you make within a Codespace instance are local to that instance. To persist your changes and ensure they are not lost if the Codespace is deleted, you *must* regularly commit and push them to your Git repository.
*   You **do not** need to create a new Codespace from the `README.md` button to test prompt or script changes. This is a slow process and is only necessary if you are changing the Codespace configuration itself (e.g., `devcontainer.json`).
*   You **do not** need to run `git pull` or `git fetch` to see your *local* changes. Those commands are for retrieving updates from the remote repository on GitHub, not for loading files you have just edited in your current workspace.
