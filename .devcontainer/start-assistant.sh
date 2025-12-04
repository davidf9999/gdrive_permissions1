#!/bin/bash
# This script runs every time the user attaches to the codespace.

# Clear the terminal to provide a clean slate for the user.
clear

# Now that auth is handled, launch the Gemini CLI with the master prompt.
gemini -i "$(cat AI_ASSISTANT_PROMPT.md)"