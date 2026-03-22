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
  ops          - Runtime service status and public health diagnostics
  release      - Composite pipeline: quality + smoke + performance + ops

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
