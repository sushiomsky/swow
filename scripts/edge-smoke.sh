#!/usr/bin/env bash
# Edge smoke test for the public Wizard-of-Wor surface.
# Usage: scripts/edge-smoke.sh [base_url]   (default https://wizardofwor.duckdns.org)
# Checks every public route through the edge proxy incl. WS handshake.
# Exit 0 = all green, 1 = any failure.
# Set CURL_INSECURE=1 for self-signed/internal test certs (lane rig),
# WS checks always skip verification (test only).
set -euo pipefail

BASE="${1:-https://wizardofwor.duckdns.org}"
FAIL=0
CURL_FLAGS=(-sS --max-time 15)
[ "${CURL_INSECURE:-0}" = "1" ] && CURL_FLAGS+=(-k)

ok()   { echo "PASS  $1 ($2)"; }
fail() { echo "FAIL  $1 ($2)"; FAIL=1; }

check_http() { # path expected_code [description]
  local path="$1" expect="$2" desc="${3:-$1}"
  local code
  code="$(curl "${CURL_FLAGS[@]}" -o /dev/null -w '%{http_code}' "$BASE$path" || echo 000)"
  if [ "$code" = "$expect" ]; then ok "$desc" "HTTP $code"; else fail "$desc" "HTTP $code, want $expect"; fi
}

check_ws() { # path expected_substring [description]
  local path="$1" want="$2" desc="${3:-$path}"
  local out
  out="$(python3 - "$BASE" "$path" "$want" <<'EOF' || echo PYERR
import asyncio, ssl, sys, urllib.parse
import websockets
base, path, want = sys.argv[1], sys.argv[2], sys.argv[3]
u = urllib.parse.urlparse(base)
scheme = "wss" if u.scheme == "https" else "ws"
host = u.hostname
port = u.port or (443 if scheme == "wss" else 80)
target = f"{scheme}://{host}:{port}{path}"
ctx = None
if scheme == "wss":
    ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
async def main():
    kw = {"open_timeout": 12, "host": host} if ctx else {"open_timeout": 12}
    if ctx: kw["ssl"] = ctx
    async with websockets.connect(target, **kw) as ws:
        msg = await asyncio.wait_for(ws.recv(), 12)
        sys.exit(0 if want in msg else 42)
try:
    asyncio.run(main())
except SystemExit as e:
    sys.exit(e.code)
except Exception as e:
    print(f"WSERR {type(e).__name__}: {e}")
    sys.exit(1)
EOF
)"
  local rc=$?
  if [ $rc -eq 0 ]; then ok "$desc" "WS handshake + '$want'"; else fail "$desc" "rc=$rc ${out:0:120}"; fi
}

echo "== Edge smoke: $BASE =="
check_http "/healthz" 200 "edge health probe"
check_http "/" 200 "game platform /"
check_http "/multiplayer.html" 200 "game /multiplayer.html"
check_http "/multiplayer/active-games" 200 "mp active-games (HTTP via edge)"
check_http "/multiplayer/dungeon-topology" 200 "mp dungeon-topology (HTTP via edge)"
check_http "/spectate" 200 "game /spectate"
check_http "/minimap" 200 "game /minimap"
check_http "/community" 200 "community-web /community"
check_http "/admin" 200 "community-web /admin"
check_http "/robots.txt" 200 "community-web /robots.txt"
check_http "/api/community/leaderboards?scope=global" 200 "community-api leaderboards"
check_http "/socket.io/?EIO=4&transport=polling" 200 "community socket.io polling"
check_ws "/multiplayer" '"type":"connected"' "mp WS handshake /multiplayer"
check_ws "/socket.io/?EIO=4&transport=websocket" '"sid"' "community socket.io WS transport"

if [ "$FAIL" -eq 0 ]; then echo "ALL GREEN"; else echo "FAILURES PRESENT"; fi
exit "$FAIL"
