#!/usr/bin/env bash
set -euo pipefail

agent="${1:-list}"
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
logs_root="${AGENT_LOG_ROOT:-$root_dir/ci-logs/agents}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
run_dir="${logs_root}/${timestamp}-${agent}"
mkdir -p "$run_dir"

log() {
  printf '[agent:%s] %s\n' "$agent" "$*"
}

list_agents() {
  cat <<'EOF'
Available project agents:
  quality      - API check + API integration tests + community-web build
  smoke        - Surface smoke checks (classic-web, classic-multiplayer, community-api, community-web)
  performance  - Multiplayer throughput load test (scripts/multiplayer-load-test.js)
  ux           - Route and UX landmark checks against running community web
  design       - Visual consistency checks (cards/hero/layout framing)
  ops          - Runtime service status and public health diagnostics
  release      - Composite pipeline: quality + smoke + ux + design + performance + ops

Usage:
  bash scripts/agents/run-agent.sh <agent-name>
  npm run agent:<agent-name>
EOF
}

run_quality_agent() {
  log "Running quality checks"
  npm --prefix "$root_dir/community-api" run check | tee "$run_dir/community-api-check.log"
  npm --prefix "$root_dir/community-api" run test:integration | tee "$run_dir/community-api-integration.log"
  npm --prefix "$root_dir/community-web" run build | tee "$run_dir/community-web-build.log"
  log "Quality checks passed"
}

run_smoke_agent() {
  log "Running smoke matrix"
  for surface in classic-web classic-multiplayer community-api community-web; do
    surface_log_dir="$run_dir/$surface"
    mkdir -p "$surface_log_dir"
    case "$surface" in
      community-api)
        : "${COMMUNITY_DATABASE_URL:?COMMUNITY_DATABASE_URL must be set for smoke agent}"
        : "${COMMUNITY_REDIS_URL:?COMMUNITY_REDIS_URL must be set for smoke agent}"
        ;;
    esac
    bash "$root_dir/scripts/ci-smoke.sh" "$surface" "$surface_log_dir" | tee "$surface_log_dir/agent.log"
  done
  log "Smoke matrix passed"
}

run_performance_agent() {
  log "Running multiplayer performance probe"
  node "$root_dir/scripts/multiplayer-load-test.js" | tee "$run_dir/multiplayer-load-test.log"
  log "Performance probe completed"
}

run_ux_agent() {
  log "Running UX checks"
  local web_port="${UX_AGENT_WEB_PORT:-13000}"
  local active_games_base="${UX_ACTIVE_GAMES_BASE_URL:-http://127.0.0.1:5001}"
  local web_log="$run_dir/ux-community-web.log"
  local report_log="$run_dir/ux-check.log"
  local web_pid=""
  local web_started_here=0

  cleanup_ux() {
    if [ -n "$web_pid" ] && kill -0 "$web_pid" >/dev/null 2>&1; then
      kill "$web_pid" >/dev/null 2>&1 || true
      wait "$web_pid" >/dev/null 2>&1 || true
    fi
  }

  if curl -fsS "http://127.0.0.1:${web_port}/" >/dev/null 2>&1; then
    log "Using existing community-web at http://127.0.0.1:${web_port}"
  else
    log "Starting temporary community-web server on :${web_port}"
    npm --prefix "$root_dir/community-web" run build >"$run_dir/ux-community-web-build.log" 2>&1
    (
      cd "$root_dir/community-web"
      NEXT_PUBLIC_COMMUNITY_API_BASE="/api/community" exec ./node_modules/.bin/next start -p "$web_port"
    ) >"$web_log" 2>&1 &
    web_pid="$!"
    web_started_here=1
    for _ in $(seq 1 120); do
      if curl -fsS "http://127.0.0.1:${web_port}/" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done
    if ! curl -fsS "http://127.0.0.1:${web_port}/" >/dev/null 2>&1; then
      cleanup_ux
      log "Failed to start temporary community-web for UX checks"
      exit 1
    fi
  fi

  if [ "$web_started_here" -eq 1 ]; then
    trap cleanup_ux EXIT
  fi

  UX_CHECK_BASE_URL="http://127.0.0.1:${web_port}" \
    UX_ACTIVE_GAMES_BASE_URL="$active_games_base" \
    node "$root_dir/scripts/agents/ux-check.mjs" | tee "$report_log"

  if [ "$web_started_here" -eq 1 ]; then
    trap - EXIT
    cleanup_ux
  fi
  log "UX checks passed"
}

run_design_agent() {
  log "Running design checks"
  local web_port="${DESIGN_AGENT_WEB_PORT:-13000}"
  local web_log="$run_dir/design-community-web.log"
  local report_log="$run_dir/design-check.log"
  local web_pid=""
  local web_started_here=0

  cleanup_design() {
    if [ -n "$web_pid" ] && kill -0 "$web_pid" >/dev/null 2>&1; then
      kill "$web_pid" >/dev/null 2>&1 || true
      wait "$web_pid" >/dev/null 2>&1 || true
    fi
  }

  if curl -fsS "http://127.0.0.1:${web_port}/" >/dev/null 2>&1; then
    log "Using existing community-web at http://127.0.0.1:${web_port}"
  else
    log "Starting temporary community-web server on :${web_port}"
    npm --prefix "$root_dir/community-web" run build >"$run_dir/design-community-web-build.log" 2>&1
    (
      cd "$root_dir/community-web"
      NEXT_PUBLIC_COMMUNITY_API_BASE="/api/community" exec ./node_modules/.bin/next start -p "$web_port"
    ) >"$web_log" 2>&1 &
    web_pid="$!"
    web_started_here=1
    for _ in $(seq 1 120); do
      if curl -fsS "http://127.0.0.1:${web_port}/" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done
    if ! curl -fsS "http://127.0.0.1:${web_port}/" >/dev/null 2>&1; then
      cleanup_design
      log "Failed to start temporary community-web for design checks"
      exit 1
    fi
  fi

  if [ "$web_started_here" -eq 1 ]; then
    trap cleanup_design EXIT
  fi

  DESIGN_CHECK_BASE_URL="http://127.0.0.1:${web_port}" \
    node "$root_dir/scripts/agents/design-check.mjs" | tee "$report_log"

  if [ "$web_started_here" -eq 1 ]; then
    trap - EXIT
    cleanup_design
  fi
  log "Design checks passed"
}

run_ops_agent() {
  log "Collecting ops diagnostics"
  {
    echo "timestamp_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo
    echo "== systemd services =="
    systemctl is-active wizard-of-wor-single.service || true
    systemctl is-active wizard-of-wor-multiplayer.service || true
    systemctl is-active wizard-of-wor-community-api.service || true
    systemctl is-active wizard-of-wor-community-web.service || true
    echo
    echo "== public probes =="
    curl -sS -i https://wizardofwor.duckdns.org/multiplayer/active-games | head -n 20
    curl -sS -i https://wizardofwor.duckdns.org/api/community/health | head -n 20
  } | tee "$run_dir/ops-diagnostics.log"
  log "Ops diagnostics completed"
}

run_release_agent() {
  run_quality_agent
  run_smoke_agent
  run_ux_agent
  run_design_agent
  run_performance_agent
  run_ops_agent
  log "Release agent completed"
}

case "$agent" in
  list|help|-h|--help)
    list_agents
    ;;
  quality)
    run_quality_agent
    ;;
  smoke)
    run_smoke_agent
    ;;
  performance)
    run_performance_agent
    ;;
  ux)
    run_ux_agent
    ;;
  design)
    run_design_agent
    ;;
  ops)
    run_ops_agent
    ;;
  release)
    run_release_agent
    ;;
  *)
    log "Unknown agent: $agent"
    list_agents
    exit 1
    ;;
esac

log "logs_dir=$run_dir"
