#!/bin/bash

SUBDOMAIN=$1
ROOT_DOMAIN=${ROOT_DOMAIN_NAME} # AI will ensure this is set by the user as an env var

if [ -z "$SUBDOMAIN" ]; then
  echo "Error: Subdomain not provided."
  echo "Usage: $0 <subdomain>"
  exit 1
fi

if [ -z "$ROOT_DOMAIN" ]; then
  echo "Error: ROOT_DOMAIN_NAME environment variable not set. This is required for automated DNS setup."
  echo "Please ensure ROOT_DOMAIN_NAME is set to your root domain (e.g., 'example.com')."
  exit 1
fi

# Get public IP of the Codespace
CODESPACE_IP=$(curl -s ifconfig.me)

if [ -z "$CODESPACE_IP" ]; then
  echo "Error: Could not determine Codespace public IP address."
  exit 1
fi

FQDN="${SUBDOMAIN}.${ROOT_DOMAIN}"

# Constructing the JSON payload dynamically
JSON_PAYLOAD=$(cat <<EOF
{
  "root_domain": "${ROOT_DOMAIN}",
  "subdomain": "${SUBDOMAIN}",
  "records": [
    {
      "type": "A",
      "name": "@",
      "content": "${CODESPACE_IP}",
      "ttl": 60,
      "proxied": true
    }
  ]
}
EOF
)

echo "Attempting to create/update DNS records for ${FQDN} pointing to ${CODESPACE_IP}..."
# echo "Payload: ${JSON_PAYLOAD}" # For debugging

RESPONSE=$(curl -s -X POST http://localhost:8000/dns/subdomain/apply \
  -H "Content-Type: application/json" \
  -d "${JSON_PAYLOAD}")

if echo "$RESPONSE" | grep -q '"status": "ok"'; then
  echo "DNS records successfully applied for ${FQDN}."
  echo "It may take a few minutes for changes to propagate."
  # echo "Full response: ${RESPONSE}" # For debugging
  exit 0
else
  echo "Failed to apply DNS records for ${FQDN}."
  echo "Response: ${RESPONSE}"
  exit 1
fi