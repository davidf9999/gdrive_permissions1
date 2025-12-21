#!/bin/bash
# This script runs every time the user attaches to the codespace.

# Clear the terminal to provide a clean slate for the user.
clear

# Open the main setup guide in the editor
code docs/SETUP_GUIDE.md

# Now that auth is handled, launch the Gemini CLI with the master prompt.
gemini -i "$(cat AI_ASSISTANT_PROMPT.md)" \
  2> >(grep -v "No installer is available for GitHub Codespaces" >&2)
