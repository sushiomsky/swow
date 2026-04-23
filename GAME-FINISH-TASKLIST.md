# Game Finish Tasklist

This tasklist tracks what remains to ship a polished, production-ready multiplayer game experience.

## 1) Stabilize matchmaking + queue UX (in progress)

- [x] Add pre-init `match_starting` protocol event for queued BR launches.
- [x] Add client-side transient handling + cleanup on `init` / error / waiting transitions.
- [x] Add deterministic ordering regression check to ensure `match_starting` is emitted before `init`.
- [x] Add queue-status UI rendering for sit-n-go/team countdown states in lobby HUD.
- [x] Add reconnect-path behavior validation (player disconnect while `match_starting` is visible).

## 2) Multiplayer reliability hardening

- [x] Add integration checks for queue join/leave race conditions.
- [x] Add reconnect and stale-session cleanup tests for all BR modes.
- [x] Add server metrics for queue wait times and launch success/failure rates.
- [x] Add backoff/retry strategy for temporary WS disconnects.

## 3) Gameplay completeness

- [x] Finalize mode balancing (countdowns, bot fill, round pacing).
- [x] Add team mode context in HUD on init for clearer teammate-oriented play.
- [x] Add teammate color context in team HUD to improve partner clarity.
- [x] Validate team coordination UX (spawn parity, partner clarity, death/spectate flow).
- [x] Add end-of-match overlay focus + keyboard escape handling.
- [x] Add end-of-match dialog semantics and body cleanup on close.
- [x] Restore pre-overlay focus after closing end-of-match dialog.
- [x] Prevent duplicate end-of-match actions and show re-queue status feedback.
- [x] Add keyboard shortcuts on match results (Enter=Play Again, M=Menu, Escape=Close).
- [x] Add explicit keyboard shortcut hints and aria-keyshortcuts metadata in match results UI.
- [x] Trap Tab focus within match-results action buttons while overlay is open.
- [x] Make Play Again action mode-aware (re-queue modes vs return-to-menu fallback).
- [x] Ignore match-results keyboard shortcuts while replay/menu action is processing.
- [x] Ensure stale match-results overlay is force-cleared on fresh `init`.
- [x] Support backdrop click-to-menu behavior in match-results dialog.
- [x] Lock/unlock body scroll while match-results dialog is open.
- [x] Complete end-of-match flow polish (results, replay loop, return-to-menu transitions).
- [x] Improve status message accessibility (aria-live/role for normal vs error states).
- [x] Add aria-labelledby/aria-describedby wiring for match-results dialog content.
- [x] Add accessibility pass for UI text, contrast, and status messaging.

## 4) Content + progression

- [x] Define unlock/progression model (if in scope for launch).
- [x] Add leaderboards anti-abuse checks and score integrity verification.
- [x] Add post-match rewards/events instrumentation.

## 5) Release readiness

- [x] Establish automated CI gate (quality + smoke + netcode + gameplay agents).
- [x] Document production runbook (deploy, rollback, incident response).
- [x] Complete cross-device/browser validation matrix.
- [x] Run final release checklist and freeze launch candidate build.
