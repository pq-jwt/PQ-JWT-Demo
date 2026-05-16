#!/usr/bin/env bash
# Set GitHub repo description, homepage, and topics for PQ-JWT-Demo.
# Usage:
#   GITHUB_TOKEN=ghp_xxxx ./scripts/set-github-repo-meta.sh
# Create token: GitHub → Settings → Developer settings → Personal access tokens (repo scope)

set -euo pipefail

OWNER="${GITHUB_OWNER:-ruhil6789}"
REPO="${GITHUB_REPO:-PQ-JWT-Demo}"
API="https://api.github.com/repos/${OWNER}/${REPO}"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "Error: set GITHUB_TOKEN (PAT with repo scope)"
  exit 1
fi

DESC="Hands-on demo for @pq-jwt/core: post-quantum JWT (ML-DSA-65) with Express, MongoDB, JS/TS examples, and integration guide."
HOMEPAGE="https://www.npmjs.com/package/@pq-jwt/core"
TOPICS='["post-quantum","jwt","pq-jwt","ml-dsa","nist","cryptography","express","mongodb","typescript","nodejs","authentication","demo"]'

echo "Updating description and homepage..."
curl -sS -X PATCH \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "${API}" \
  -d "$(jq -n --arg d "$DESC" --arg h "$HOMEPAGE" '{description:$d,homepage:$h}')" \
  | jq '{full_name, description, homepage}'

echo "Setting topics..."
curl -sS -X PUT \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github.mercy-preview+json" \
  "${API}/topics" \
  -d "$(jq -n --argjson t "$TOPICS" '{names:$t}')" \
  | jq '{names}'

echo "Done: https://github.com/${OWNER}/${REPO}"
