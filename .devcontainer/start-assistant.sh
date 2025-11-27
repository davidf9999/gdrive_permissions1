#!/bin/bash
# This script runs every time the user attaches to the codespace.

# Clear the terminal to provide a clean slate for the user.
clear

# Welcome message
echo "==============================================="
echo "Welcome to the gdrive-permissions1 Setup Assistant!"
echo "Loading the AI assistant now..."
echo "==============================================="
echo ""

# Launch the Gemini CLI with the master prompt file.
# The AI will take over the interaction from here.
gemini -i "$(cat AI_ASSISTANT_PROMPT.md)"
