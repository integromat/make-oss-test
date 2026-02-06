#!/usr/bin/env bash
set -euo pipefail

# Verify required environment variables
: "${MAKE_HOST:?Environment variable MAKE_HOST is required (e.g., eu1.make.com)}"
: "${MAKE_API_TOKEN:?Environment variable MAKE_API_TOKEN is required}"

# Optional tweaks
URL_SCHEME=${MAKE_SCHEME:-https}
URL_PATH=${MAKE_TEST_PATH:-/}
URL="${URL_SCHEME}://${MAKE_HOST}${URL_PATH}"

echo "Testing GET ${URL} with Authorization: Bearer <token>"

TMP_BODY="/tmp/make_test_response.$$"

# Perform the request and capture HTTP status code
HTTP_CODE=$(curl -sS -o "$TMP_BODY" -w "%{http_code}" \
  -H "Authorization: Bearer ${MAKE_API_TOKEN}" \
  -H "Accept: application/json" \
  "$URL") || true

if [[ "$HTTP_CODE" -ge 200 && "$HTTP_CODE" -lt 400 ]]; then
  echo "SUCCESS: HTTP $HTTP_CODE from $URL"
  if [[ "${SHOW_BODY:-0}" == "1" ]]; then
    echo "--- Response body ---"
    cat "$TMP_BODY"
  fi
  rm -f "$TMP_BODY"
  exit 0
else
  echo "FAILURE: HTTP $HTTP_CODE from $URL"
  if [[ -s "$TMP_BODY" ]]; then
    echo "--- Response body ---"
    cat "$TMP_BODY"
  fi
  rm -f "$TMP_BODY"
  exit 1
fi
