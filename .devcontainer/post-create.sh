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
(curl -sS https://sdk.cloud.google.com | bash -s -- --disable-prompts) > gcloud_install.log 2>&1

# Check for successful installation and update PATH
GCLOUD_SDK_PATH="$HOME/google-cloud-sdk"
if [ -f "$GCLOUD_SDK_PATH/path.bash.inc" ]; then
  echo "source $GCLOUD_SDK_PATH/path.bash.inc" >> ~/.bashrc
  source "$GCLOUD_SDK_PATH/path.bash.inc"
  echo "Google Cloud CLI installed and sourced successfully."
else
  echo "---"
  echo "🔴 ERROR: Google Cloud CLI installation failed."
  echo "Installation logs:"
  cat gcloud_install.log
  echo "---"
fi

echo "Post-create script finished."

# Install uv
echo "Installing uv..."
curl -LsSf https://astral.sh/uv/install.sh | sh
# uv is installed in ~/.cargo/bin by default, add it to PATH for the current session
export PATH="$HOME/.cargo/bin:$PATH"
echo "uv installed."

# Setup Python environment for cloudflare_dns backend
echo "Setting up Python environment for cloudflare_dns..."
cd cloudflare_dns
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt
deactivate # Deactivate to return to the base shell environment
cd ..
echo "Python environment for cloudflare_dns setup."

