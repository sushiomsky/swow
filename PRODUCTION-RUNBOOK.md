# Production Runbook (Wizard of Wor)

This runbook documents the standard production procedures for deploy, rollback, and incident response.

## 1) Service topology

Primary surfaces:

- `classic-web` (main game surface)
- `classic-multiplayer` (`server-multiplayer.js`)
- `community-api`
- `community-web`

Operational expectation:

- All surfaces must pass health checks before/after deploy.
- Multiplayer and community surfaces should be monitored independently.

## 2) Pre-deploy checklist

Before deploying:

1. Confirm CI required gate is green (quality + smoke + netcode + gameplay agents).
2. Confirm DB migrations are reviewed and backward compatible.
3. Confirm release notes include any env var changes.
4. Confirm on-call engineer is assigned for rollout window.

## 3) Standard deploy procedure

### 3.1 Prepare release

1. Tag release candidate commit.
2. Pull latest main on target host.
3. Ensure dependency lockfiles are present and unchanged from reviewed commit.

### 3.2 Deploy sequence

Recommended order:

1. `community-api`
2. `community-web`
3. `classic-multiplayer`
4. `classic-web`

Rationale: API compatibility should be live before UI features that depend on it.

### 3.3 Post-deploy verification

Run smoke probes:

- Multiplayer: `/multiplayer/active-games`, `/multiplayer/dungeon-topology`
- Community API: `/api/community/health`
- Community web: homepage + leaderboard route
- Classic web: root page response

Run targeted agents:

- `npm run agent:smoke`
- `npm run agent:netcode`
- `npm run agent:gameplay`

## 4) Rollback procedure

Trigger rollback immediately if:

- Health endpoints fail for >5 minutes post deploy.
- Error rate or latency SLOs exceed thresholds.
- Matchmaking/connectivity regressions are confirmed.

Rollback steps:

1. Revert to previous known-good release artifact/commit.
2. Restart services in reverse order of deploy:
   - `classic-web`
   - `classic-multiplayer`
   - `community-web`
   - `community-api`
3. Re-run smoke checks and confirm recovery.
4. Post incident note in release channel with rollback time and scope.

## 5) Incident response

### 5.1 Severity levels

- **SEV-1**: Full outage or widespread game-join failure.
- **SEV-2**: Major degradation (e.g., frequent disconnect/reconnect loops).
- **SEV-3**: Partial feature issue without core gameplay outage.

### 5.2 Response flow

1. Acknowledge incident and assign incident commander.
2. Stabilize:
   - freeze deploys,
   - gather current health and logs,
   - decide mitigate vs rollback.
3. Communicate status every 15 minutes (SEV-1/2).
4. Resolve and verify via health probes + smoke/netcode/gameplay agents.
5. Publish postmortem with action items and owners.

### 5.3 Minimum diagnostics to capture

- Service status snapshot (all 4 surfaces)
- Last deploy SHA and deploy timestamp
- Recent logs for multiplayer handshake/join failures
- API error rates for community endpoints
- Active games snapshot sample for BR modes

## 6) Ownership + escalation

- Primary owner: Multiplayer/platform on-call.
- Secondary owner: Community/API on-call.
- Escalate to infra owner for persistent runtime/network failures.

## 7) Launch-day guardrails

- Use canary rollout where possible.
- Avoid schema-breaking migrations during peak hours.
- Keep rollback artifact pre-staged before production rollout begins.
