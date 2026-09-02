#!/usr/bin/env bash
# Creates a test deal so the /payout table has something to work with.
#
#   ./scripts/create-test-deal.sh <username> <password> [base_url]
#
# Defaults to the local stack. Pass https://merchant.bpay-processing.com to hit prod.
set -euo pipefail

USERNAME="${1:?usage: create-test-deal.sh <username> <password> [base_url]}"
PASSWORD="${2:?usage: create-test-deal.sh <username> <password> [base_url]}"
BASE="${3:-http://localhost:8000}"
API="$BASE/api/v1"

json_field() { grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed 's/.*: *"//; s/"$//'; }

echo "→ logging in as $USERNAME at $BASE"
TOKEN=$(curl -sS -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" | json_field access_token)

[ -n "$TOKEN" ] || { echo "login failed (2FA enabled? wrong password?)"; exit 1; }

# The deal is routed by currency: /deal/ assigns it to the first user whose
# currency list contains from_xml. Use our own currency so it lands on us.
ME=$(curl -sS "$API/auth/me" -H "Authorization: Bearer $TOKEN")
XML=$(echo "$ME" | grep -o '"currencies":\[[^]]*\]' | grep -o '"[A-Za-z0-9_-]*"' | sed -n '2p' | tr -d '"')

[ -n "$XML" ] || { echo "user has no currencies assigned — set them in the admin panel first"; echo "$ME"; exit 1; }
echo "→ using currency $XML"

UID_VAL=$(date +%s)
CREATED=$(date -u +%Y-%m-%dT%H:%M:%S)

# bizon_id is left null on purpose: with it set, accept/complete would fire
# real calls to the Bizon API.
RESP=$(curl -sS -X POST "$API/deal/" -H 'Content-Type: application/json' -d @- <<JSON
{
  "uid": $UID_VAL,
  "bizon_id": null,
  "secret": "test-secret",
  "to_values": {
    "cardHolder": "IVAN TESTOV",
    "cardNumber": "4276 1600 1234 5678",
    "phoneNumber": "+37900123456",
    "bankName": "Swedbank",
    "outAmount": 12345.67
  },
  "from_xml": "$XML",
  "from_name": "Test Source",
  "from_image_url": "https://example.com/from.png",
  "to_xml": "$XML",
  "to_name": "Test Target",
  "to_image_xml": "https://example.com/to.png",
  "status": "pending",
  "created_at": "$CREATED"
}
JSON
)

echo "→ $RESP"
