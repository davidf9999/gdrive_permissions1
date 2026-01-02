#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain> [subdomain]}"
SUBDOMAIN="${2:-}"

match() {
  local pattern="$1"
  if command -v rg >/dev/null 2>&1; then
    rg -q "$pattern"
  else
    grep -Eq "$pattern"
  fi
}

printf '== Delegation / authority (should show SOA from your DNS provider) ==\n'
SOA_OUTPUT="$(dig +noall +answer SOA "$DOMAIN" || true)"
printf '%s\n' "$SOA_OUTPUT"
printf '\n'

printf '== Nameservers seen by public DNS ==\n'
NS_OUTPUT="$(dig +noall +answer NS "$DOMAIN" || true)"
printf '%s\n' "$NS_OUTPUT"
printf '\n'

printf '== Apex records (A/AAAA/MX/TXT) ==\n'
for t in A AAAA MX TXT; do
  printf -- '-- %s --\n' "$t"
  dig +noall +answer "$t" "$DOMAIN" || true
  printf '\n'
done

MX_OUTPUT="$(dig +noall +answer MX "$DOMAIN" || true)"
TXT_OUTPUT="$(dig +noall +answer TXT "$DOMAIN" || true)"

printf '== Evaluation (heuristics) ==\n'
STATUS=0

if [[ -z "$SOA_OUTPUT" ]]; then
  printf 'WARN: No SOA record found for %s\n' "$DOMAIN"
  STATUS=1
else
  printf 'OK: SOA record present\n'
fi

if [[ -z "$NS_OUTPUT" ]]; then
  printf 'WARN: No NS records found for %s\n' "$DOMAIN"
  STATUS=1
else
  printf 'OK: NS records present\n'
fi

if [[ -z "$MX_OUTPUT" ]]; then
  printf 'WARN: No MX records found for %s\n' "$DOMAIN"
  STATUS=1
elif printf '%s\n' "$MX_OUTPUT" | match 'aspmx\.l\.google\.com|googlemail\.com'; then
  printf 'OK: Google Workspace MX records detected\n'
else
  printf 'WARN: MX records found but no Google Workspace MX hosts detected\n'
  STATUS=1
fi

if [[ -z "$TXT_OUTPUT" ]]; then
  printf 'WARN: No TXT records found for %s\n' "$DOMAIN"
  STATUS=1
else
  if printf '%s\n' "$TXT_OUTPUT" | match 'v=spf1 .*include:_spf\.google\.com'; then
    printf 'OK: SPF includes _spf.google.com\n'
  else
    printf 'WARN: SPF record missing include:_spf.google.com\n'
    STATUS=1
  fi

  if printf '%s\n' "$TXT_OUTPUT" | match 'google-site-verification='; then
    printf 'OK: google-site-verification TXT present\n'
  else
    printf 'WARN: google-site-verification TXT not found\n'
  fi
fi

if [[ -n "$SUBDOMAIN" ]]; then
  printf '== Subdomain check: %s.%s ==\n' "$SUBDOMAIN" "$DOMAIN"
  SUB_A="$(dig +noall +answer A "$SUBDOMAIN.$DOMAIN" || true)"
  SUB_AAAA="$(dig +noall +answer AAAA "$SUBDOMAIN.$DOMAIN" || true)"
  SUB_CNAME="$(dig +noall +answer CNAME "$SUBDOMAIN.$DOMAIN" || true)"
  printf '%s\n' "$SUB_A"
  printf '%s\n' "$SUB_AAAA"
  printf '%s\n' "$SUB_CNAME"
  if [[ -z "$SUB_A" && -z "$SUB_AAAA" && -z "$SUB_CNAME" ]]; then
    printf 'WARN: No A/AAAA/CNAME records found for %s.%s\n' "$SUBDOMAIN" "$DOMAIN"
    STATUS=1
  else
    printf 'OK: Subdomain has A/AAAA/CNAME record\n'
  fi
fi

exit "$STATUS"
