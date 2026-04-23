# Cross-Device / Browser Validation Matrix

This matrix defines the minimum manual validation coverage required before launch candidate freeze.

## 1) Browser + platform coverage

| Platform | Browser | Version policy | Priority |
|---|---|---|---|
| Windows 11 | Chrome | Latest stable | P0 |
| Windows 11 | Edge | Latest stable | P0 |
| macOS (current -1) | Safari | Latest stable | P0 |
| macOS (current -1) | Chrome | Latest stable | P1 |
| iOS (current -1) | Safari | Latest stable | P0 |
| Android (current -1) | Chrome | Latest stable | P0 |
| Linux (Ubuntu LTS) | Chrome | Latest stable | P1 |
| Linux (Ubuntu LTS) | Firefox | Latest stable | P1 |

## 2) Test surfaces

- Classic web (`/`)
- Multiplayer web (`/multiplayer`)
- Spectate (`/spectate`)
- Community web (`/community`)

## 3) Core scenarios per device/browser

Run these scenarios for every matrix row:

1. Page load + initial render success (no blocking console errors).
2. Join each BR mode from multiplayer lobby.
3. Queue/status messaging appears and updates correctly.
4. `match_starting` appears before init launch transition in queued modes.
5. Complete one match and validate match-results overlay:
   - keyboard shortcuts (Enter/M/Esc),
   - focus trap between action buttons,
   - backdrop click behavior,
   - body scroll lock/unlock.
6. Re-queue from match results in BR modes.
7. Disconnect/reconnect flow (network drop simulation where possible).
8. Community leaderboard page render and score submission from an authenticated user.

## 4) Mobile-specific checks

- Orientation changes (portrait/landscape) do not break controls or overlays.
- Touch interactions remain responsive in lobby and results actions.
- HUD/status messages are readable without overlap/cutoff.

## 5) Pass/fail rubric

- **Pass**: no blocker defects; scenario outcomes match expected behavior.
- **Warn**: non-blocking visual/layout issue with known workaround.
- **Fail**: functional regression in matchmaking/join flow, match lifecycle, or auth-dependent leaderboard/progression.

## 6) Sign-off template

| Platform | Browser | Tester | Date (UTC) | Result | Notes |
|---|---|---|---|---|---|
| Windows 11 | Chrome |  |  |  |  |
| Windows 11 | Edge |  |  |  |  |
| macOS | Safari |  |  |  |  |
| macOS | Chrome |  |  |  |  |
| iOS | Safari |  |  |  |  |
| Android | Chrome |  |  |  |  |
| Linux | Chrome |  |  |  |  |
| Linux | Firefox |  |  |  |  |

## 7) Launch gate criteria

- All P0 rows must be **Pass**.
- At most one P1 row may be **Warn**, with a tracked follow-up item.
- Any **Fail** blocks launch candidate freeze.
