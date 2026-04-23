# Final Release Checklist & Launch Candidate Freeze

Status: **LC-FROZEN (candidate defined)**  
Date (UTC): **2026-04-22**

This checklist is the final gate before launch. A release candidate should be considered frozen only when all items below are complete and signed off.

## 1) Code + CI gate

- [x] Required CI gate passes (quality + smoke + netcode + gameplay).
- [x] No unreviewed critical comments on release PR stack.
- [x] No pending high-severity regressions in multiplayer join/launch flows.

## 2) Runtime validation

- [x] Multiplayer endpoints healthy (`/multiplayer/active-games`, `/multiplayer/dungeon-topology`).
- [x] Community API health endpoint healthy (`/api/community/health`).
- [x] Core lobby → queue → match → results flow validated.
- [x] Reconnect/backoff behavior sanity checked on disconnect.

## 3) Product + UX validation

- [x] Cross-device/browser matrix completed and signed.
- [x] Match-results accessibility behaviors validated (focus/keyboard/scroll lock).
- [x] Team mode partner HUD clarity validated.
- [x] Queue status and `match_starting` feedback verified.

## 4) Data integrity + abuse checks

- [x] Leaderboard submission auth/validation paths confirmed.
- [x] Score jump guardrail behavior confirmed.
- [x] Post-match rewards event instrumentation confirmed.
- [x] Progression model documented for launch scope.

## 5) Ops readiness

- [x] Production runbook documented (deploy, rollback, incident response).
- [x] Rollback target artifact/commit identified.
- [x] On-call ownership confirmed for launch window.
- [x] Incident communication channel confirmed.

## 6) Freeze metadata

- Launch candidate branch/commit: `0b0a264` (baseline before this checklist commit)
- Freeze policy:
  - Only P0 bug fixes allowed after freeze.
  - Any post-freeze code change requires explicit release-manager approval.
  - All fixes must re-pass required CI gate before inclusion.

## 7) Post-freeze rule

If a blocker appears:

1. Triage severity (SEV-1/2/3).
2. Decide rollback vs targeted fix.
3. If targeted fix is accepted, create a narrow patch PR and rerun full required gate.
