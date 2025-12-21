#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain> [subdomain]}"
SUBDOMAIN="${2:-}"

printf '== Delegation / authority (should show SOA from your DNS provider) ==\n'
dig +noall +answer SOA "$DOMAIN"
printf '\n'

printf '== Nameservers seen by public DNS ==\n'
dig +noall +answer NS "$DOMAIN"
printf '\n'

printf '== Apex records (A/AAAA/MX/TXT) ==\n'
for t in A AAAA MX TXT; do
  printf -- '-- %s --\n' "$t"
  dig +noall +answer "$t" "$DOMAIN" || true
  printf '\n'
done

if [[ -n "$SUBDOMAIN" ]]; then
  printf '== Subdomain check: %s.%s ==\n' "$SUBDOMAIN" "$DOMAIN"
  dig +noall +answer A "$SUBDOMAIN.$DOMAIN" || true
  dig +noall +answer AAAA "$SUBDOMAIN.$DOMAIN" || true
  dig +noall +answer CNAME "$SUBDOMAIN.$DOMAIN" || true
fi
