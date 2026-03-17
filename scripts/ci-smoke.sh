#!/usr/bin/env bash
set -euo pipefail

surface="${1:-}"
if [ -z "$surface" ]; then
  echo "Usage: $0 <surface> [log_dir]" >&2
  exit 1
fi

log_dir="${2:-./ci-logs/$surface}"
mkdir -p "$log_dir"

declare -a managed_pids=()

cleanup() {
  for pid in "${managed_pids[@]}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
      wait "$pid" >/dev/null 2>&1 || true
    fi
  done
}
trap cleanup EXIT

wait_for_http() {
  local url="$1"
  local attempts="${2:-60}"
  local delay="${3:-1}"
  local i
  for ((i=1; i<=attempts; i+=1)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done
  echo "Timed out waiting for $url" >&2
  return 1
}

assert_http_code() {
  local expected="$1"
  local output_file="$2"
  local url="$3"
  shift 3
  local code
  code="$(curl -sS -o "$output_file" -w '%{http_code}' "$url" "$@")"
  if [ "$code" != "$expected" ]; then
    echo "Expected HTTP $expected from $url but got $code" >&2
    return 1
  fi
}

echo "Running smoke surface: $surface"

case "$surface" in
  classic-web)
    PORT=18080 node server.js >"$log_dir/classic-web.log" 2>&1 &
    managed_pids+=("$!")
    wait_for_http "http://127.0.0.1:18080/index.html" 60 1
    curl -fsS "http://127.0.0.1:18080/" >"$log_dir/root.html"
    curl -fsS "http://127.0.0.1:18080/index.html" >"$log_dir/index.html"
    curl -fsS "http://127.0.0.1:18080/multiplayer.html" >"$log_dir/multiplayer.html"
    ;;

  classic-multiplayer)
    MP_PORT=15001 node server-multiplayer.js >"$log_dir/classic-multiplayer.log" 2>&1 &
    managed_pids+=("$!")
    wait_for_http "http://127.0.0.1:15001/multiplayer.html" 60 1
    curl -fsS "http://127.0.0.1:15001/" >"$log_dir/root.html"
    curl -fsS "http://127.0.0.1:15001/multiplayer.html" >"$log_dir/multiplayer.html"
    ;;

  community-api)
    : "${COMMUNITY_DATABASE_URL:?COMMUNITY_DATABASE_URL must be set}"
    : "${COMMUNITY_REDIS_URL:?COMMUNITY_REDIS_URL must be set}"
    api_port="${COMMUNITY_API_SMOKE_PORT:-19090}"
    COMMUNITY_API_PORT="$api_port" \
      COMMUNITY_ALLOW_DEV_AUTH=false \
      node community-api/src/index.js >"$log_dir/community-api.log" 2>&1 &
    managed_pids+=("$!")
    wait_for_http "http://127.0.0.1:${api_port}/health" 120 1
    curl -fsS "http://127.0.0.1:${api_port}/health" >"$log_dir/health.json"
    grep -q '"ok":true' "$log_dir/health.json"
    curl -fsS "http://127.0.0.1:${api_port}/api/community/forum/categories" >"$log_dir/forum-categories.json"
    assert_http_code \
      "400" \
      "$log_dir/auth-login-validation.json" \
      "http://127.0.0.1:${api_port}/api/community/auth/login" \
      -X POST \
      -H "content-type: application/json" \
      --data '{"username":"ab","password":"123"}'
    ;;

  community-web)
    web_port="${COMMUNITY_WEB_SMOKE_PORT:-13000}"
    NEXT_PUBLIC_COMMUNITY_API_BASE="/api/community" \
      npm --prefix community-web run build >"$log_dir/community-web-build.log" 2>&1
    (
      cd community-web
      NEXT_PUBLIC_COMMUNITY_API_BASE="/api/community" npx next start -p "$web_port"
    ) >"$log_dir/community-web.log" 2>&1 &
    managed_pids+=("$!")
    wait_for_http "http://127.0.0.1:${web_port}/" 120 1
    curl -fsS "http://127.0.0.1:${web_port}/" >"$log_dir/home.html"
    curl -fsS "http://127.0.0.1:${web_port}/community/chat" >"$log_dir/community-chat.html"
    curl -fsS "http://127.0.0.1:${web_port}/community/forum" >"$log_dir/community-forum.html"
    ;;

  *)
    echo "Unknown surface: $surface" >&2
    exit 1
    ;;
esac

echo "Smoke checks passed for $surface"
