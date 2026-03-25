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

── Automated (CI/CD) ───────────────────────────────────────────────────────
  quality      - API check + API integration tests + community-web build
  smoke        - Surface smoke checks (classic-web, classic-multiplayer, community-api, community-web)
  performance  - Multiplayer throughput load test (scripts/multiplayer-load-test.js)
  ux           - Route and UX landmark checks against running community web
  design       - Visual consistency checks (cards/hero/layout framing)
  ops          - Runtime service status and public health diagnostics
  gameplay     - Bot seeding validation + active game mode coverage check
  netcode      - WebSocket handshake + HTTP latency probes for multiplayer server
  analytics    - Live snapshot report: mode distribution, bot/human ratio, anomaly detection
  release      - Composite pipeline: quality + smoke + ux + design + performance + ops + gameplay + analytics

── AI Prompt Agents (open with an AI assistant) ────────────────────────────
  01-game-systems       - Core gameplay loop, balancing, win conditions
  02-retro-feel         - Movement physics, input latency, enemy AI patterns
  03-netcode            - WebSocket sync, lag compensation, disconnect handling
  04-performance        - Canvas rendering, bundle size, server tick efficiency
  05-ux-design          - Lobby UX, HUD, spectator flow, post-death screen
  06-community-architect- Player profiles, match history, replay, clans
  07-frontend-engineering- React/Next.js components, state management, real-time
  08-growth-hacker      - Viral loops, referrals, community targeting
  09-community-engagement- Events, Discord, dev logs, challenge design
  10-analytics          - Retention metrics, funnel, event schema design
  11-monetization       - Cosmetics, battle pass, supporter perks
  12-experimentation    - A/B testing, feature flags, mechanic tuning

  View prompt: cat scripts/agents/prompts/<name>.md

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

run_gameplay_agent() {
  log "Running gameplay checks"
  local mp_port="${NETCODE_MP_PORT:-42735}"
  GAMEPLAY_CHECK_BASE_URL="${GAMEPLAY_CHECK_BASE_URL:-http://127.0.0.1:${mp_port}}" \
    node "$root_dir/scripts/agents/gameplay-check.mjs" | tee "$run_dir/gameplay-check.log"
  log "Gameplay checks completed"
}

run_netcode_agent() {
  log "Running netcode checks"
  local mp_port="${NETCODE_MP_PORT:-42735}"
  NETCODE_CHECK_HTTP_BASE="${NETCODE_CHECK_HTTP_BASE:-http://127.0.0.1:${mp_port}}" \
  NETCODE_CHECK_WS_URL="${NETCODE_CHECK_WS_URL:-ws://127.0.0.1:${mp_port}/multiplayer}" \
    node "$root_dir/scripts/agents/netcode-check.mjs" | tee "$run_dir/netcode-check.log"
  log "Netcode checks completed"
}

run_analytics_agent() {
  log "Running analytics report"
  local mp_port="${NETCODE_MP_PORT:-42735}"
  local api_port="${COMMUNITY_API_PUBLIC_PORT:-43671}"
  ANALYTICS_CHECK_BASE_URL="${ANALYTICS_CHECK_BASE_URL:-http://127.0.0.1:${mp_port}}" \
  ANALYTICS_API_BASE_URL="${ANALYTICS_API_BASE_URL:-http://127.0.0.1:${api_port}}" \
    node "$root_dir/scripts/agents/analytics-check.mjs" | tee "$run_dir/analytics-check.log"
  log "Analytics report completed"
}
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
  run_gameplay_agent
  run_analytics_agent
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
  gameplay)
    run_gameplay_agent
    ;;
  netcode)
    run_netcode_agent
    ;;
  analytics)
    run_analytics_agent
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
