#!/bin/bash

# This script periodically saves uncommitted changes to prevent work loss in Codespaces.

# Add all changes to the staging area.
git add -A

# Check if there's anything to commit.
# We use --cached to check the staging area.
if git diff-index --quiet --cached HEAD --; then
    echo "No changes to auto-save."
    exit 0
fi

# Commit the changes with a standard message.
# The user can later squash or amend this commit.
COMMIT_MSG="codespace-autosave: $(date --iso-8601=seconds)"
echo "Auto-saving changes with commit: $COMMIT_MSG"
git commit -m "$COMMIT_MSG"
