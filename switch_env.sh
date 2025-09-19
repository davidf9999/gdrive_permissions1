#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Check if an environment was provided
if [ -z "$1" ]; then
  echo "Error: No environment specified."
  echo "Usage: ./switch_env.sh [test|prod]"
  exit 1
fi

ENV=$1

# Check for valid environment names
if [ "$ENV" != "test" ] && [ "$ENV" != "prod" ]; then
  echo "Error: Invalid environment '$ENV'."
  echo "Usage: ./switch_env.sh [test|prod]"
  exit 1
fi

echo "Switching to $ENV environment..."

# Define the source files
PROJECT_CONFIG_SRC=".clasp.${ENV}.json"
USER_CREDS_SRC="$HOME/.clasprc.${ENV}.json"

# Define the destination files
PROJECT_CONFIG_DEST=".clasp.json"
USER_CREDS_DEST="$HOME/.clasprc.json"

# Check if the source files exist
if [ ! -f "$PROJECT_CONFIG_SRC" ]; then
  echo "Error: Project config for '$ENV' not found at $PROJECT_CONFIG_SRC"
  exit 1
fi

if [ ! -f "$USER_CREDS_SRC" ]; then
  echo "Error: User credentials for '$ENV' not found at $USER_CREDS_SRC"
  echo "Please make sure you have run 'clasp login' for this user and saved the credentials."
  exit 1
fi

# Copy the files to activate the environment
cp "$PROJECT_CONFIG_SRC" "$PROJECT_CONFIG_DEST"
cp "$USER_CREDS_SRC" "$USER_CREDS_DEST"

echo "Successfully switched to $ENV environment."
