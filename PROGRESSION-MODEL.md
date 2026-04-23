# Unlock & Progression Model (Launch Scope)

This document defines a lightweight progression system for launch that rewards playtime, supports BR modes, and minimizes abuse risk.

## 1) Core progression loop

- Players earn **XP** from completed matches.
- XP advances a persistent **Account Level**.
- Levels unlock **cosmetics + profile badges** (no gameplay power).
- Leaderboards remain score-based; progression is a parallel long-term track.

## 2) XP sources (per completed match)

Base XP:

- Complete a match: **50 XP**
- Win/survive until final state: **+25 XP**
- Reach top tier placement (if mode supports placements): **+15 XP**

Performance XP:

- Score contribution: `floor(score / 1000)`, capped at **+40 XP**
- Level reached bonus: `min(level, 20)`, capped at **+20 XP**

Team behavior XP:

- Team mode completion with teammate present at finish: **+10 XP**

Daily retention bonus:

- First completed match of the UTC day: **+30 XP**

Hard cap:

- **Max 200 XP per match** after all bonuses.

## 3) Level curve

Use a simple accelerating curve:

- XP required for level `N` → `100 + (N - 1) * 30`
- Cumulative total is deterministic and easy to compute client/server side.

Examples:

- Level 1 → 2: 100 XP
- Level 2 → 3: 130 XP
- Level 3 → 4: 160 XP

## 4) Unlock types (launch-safe)

Progression rewards are non-competitive:

- UI-only title unlocks (e.g., `Dungeon Scout`, `Worluk Hunter`)
- Profile border variants
- Emote/sticker unlocks for community surfaces
- Match-end banner cosmetics

No weapon, damage, speed, or spawn modifiers are unlocked by progression.

## 5) Data model (minimal)

Store per user:

- `xp_total` (integer)
- `level` (integer)
- `last_xp_grant_at` (timestamp)
- `daily_bonus_claimed_on` (UTC date string)

Store per match grant:

- `match_id`
- `user_id`
- `mode`
- `xp_awarded`
- `xp_breakdown` (json)
- `awarded_at`

The per-match grant table provides auditability and rollback capability.

## 6) Abuse resistance (launch)

- XP only granted on server-validated `match_end`.
- Idempotency key: `(match_id, user_id)` to prevent duplicate grants.
- Minimum match duration threshold for XP eligibility (e.g., 45s).
- Ignore grants when server detects invalid/broken session state.
- Rate-limit anomalous completion bursts per account/IP.

## 7) API/events integration plan

Community API additions:

- `GET /progression/me` → current level, XP, next unlock.
- `GET /progression/rewards` → unlock catalog + level requirements.

Game server event payload extension (post-match):

- Include `xp_awarded` + `level_up` in end-of-match response.
- Emit analytics event `progression_xp_awarded` with breakdown metadata.

## 8) UX expectations

- Match results overlay should show:
  - XP gained this match
  - Progress bar to next level
  - Level-up callout (if applicable)
- Profile page should expose unlock timeline and currently equipped cosmetic items.

## 9) Launch acceptance criteria

- XP grant is exactly-once per `(match_id, user_id)`.
- Players can level up through normal play in all 4 BR modes.
- At least 10 cosmetic unlock rewards are available at launch.
- No progression reward changes gameplay balance.
