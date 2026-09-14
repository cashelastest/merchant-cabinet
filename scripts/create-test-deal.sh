#!/usr/bin/env bash
# Creates a test payout request so the /payout table has something to work with.
#
#   ./scripts/create-test-deal.sh <username> <password> [base_url] [rate]
#
# The account needs an API key (Settings → API) and a payout currency. The script
# never generates a key itself: that would rotate it and break whatever
# integration is using the current one.
set -euo pipefail

USAGE="usage: create-test-deal.sh <username> <password> [base_url] [rate]"
USERNAME="${1:?$USAGE}"
PASSWORD="${2:?$USAGE}"
BASE="${3:-http://localhost:8000}"
RATE="${4:-41.25}"
API="$BASE/api/v1"

json_field() { grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed 's/.*: *"//; s/"$//'; }

echo "→ logging in as $USERNAME at $BASE"
TOKEN=$(curl -sS -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" | json_field access_token)
[ -n "$TOKEN" ] || { echo "login failed (2FA enabled? wrong password? banned?)"; exit 1; }

API_KEY=$(curl -sS "$API/auth/user-settings" -H "Authorization: Bearer $TOKEN" | json_field api_key)
[ -n "$API_KEY" ] || { echo "no API key on this account — generate one in Settings → API first"; exit 1; }

# A merchant is picked by the payout currency (to_xml), so use our own.
ME=$(curl -sS "$API/auth/me" -H "Authorization: Bearer $TOKEN")
XML=$(echo "$ME" | grep -o '"currencies":\[[^]]*\]' | grep -o '"[A-Za-z0-9_-]*"' | sed -n '2p' | tr -d '"')
[ -n "$XML" ] || { echo "user has no currencies assigned — set them in the admin panel first"; echo "$ME"; exit 1; }
echo "→ payout currency $XML, rate $RATE"

UID_VAL=$(date +%s)
CREATED=$(date -u +%Y-%m-%dT%H:%M:%S)

# bizon_id stays null on purpose: with it set, status changes would fire real
# calls to the Bizon API.
RESP=$(curl -sS -X POST "$API/deal/" \
  -H "X-API-Key: $API_KEY" \
  -H 'Content-Type: application/json' -d @- <<JSON
{
  "uid": $UID_VAL,
  "bizon_id": null,
  "secret": "test-secret",
  "to_values": {
    "cardHolder": "IVAN TESTOV",
    "cardNumber": "4276 1600 1234 5678",
    "phoneNumber": "+7 900 123-45-67",
    "bankName": "Sberbank",
    "outAmount": 12345.67
  },
  "from_xml": "USDT",
  "from_name": "USDT Tether",
  "from_image_url": "https://example.com/from.png",
  "to_xml": "$XML",
  "to_name": "Test Target",
  "to_image_xml": "https://example.com/to.png",
  "rate": $RATE,
  "status": "pending",
  "created_at": "$CREATED"
}
JSON
)

echo "→ $RESP"
