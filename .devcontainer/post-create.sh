#!/bin/bash
echo "Running post-create script..."

# Install project npm dependencies
echo "Installing npm dependencies from package.json..."
npm install

# Install global tools
echo "Installing global npm packages: @google/clasp and @google/gemini-cli..."
npm install -g @google/clasp @google/gemini-cli

# Manually install Google Cloud CLI
echo "Installing Google Cloud CLI..."
curl -sSL https://sdk.cloud.google.com | bash -s -- --disable-prompts --install-component-dir=.gcloud
echo 'source .gcloud/path.bash.inc' >> ~/.bashrc
echo "Google Cloud CLI installed."

echo "Post-create script finished."
