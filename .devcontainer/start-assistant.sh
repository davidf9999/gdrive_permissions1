#!/bin/bash
# This script runs every time the user attaches to the codespace.

# Clear the terminal to provide a clean slate for the user.
clear

echo "==============================================="
echo "Welcome to the gdrive-permissions1 Setup Assistant!"
echo "==============================================="
echo ""

# Check if gcloud is authenticated by seeing if an active account exists.
# The `gcloud auth list` command will exit with a non-zero status if no account is active.
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
  echo "--> Performing one-time Google authentication for this Codespace..."
  echo "--> This will allow the AI assistant to call Google services on your behalf."
  echo "--> Follow the instructions to log in with your browser."
  
  # This command is blocking and will wait for the user to authenticate in their browser.
  gcloud auth login --no-launch-browser
fi

echo ""
echo "--> Loading the AI assistant now..."
# Now that auth is handled, launch the Gemini CLI with the master prompt.
gemini -i "$(cat AI_ASSISTANT_PROMPT.md)"
