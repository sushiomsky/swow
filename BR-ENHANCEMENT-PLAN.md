# 🎮 Battle Royale Enhancements — Implementation Plan

**Date:** 2026-03-24  
**Scope:** Team BR variants, game list, mini-map view, live background

This document outlines a comprehensive plan to enhance the Battle Royale experience with advanced features.

---

## 🎯 User Requirements

1. **Team BR variants** — Add endless and sit-n-go versions
2. **Game list** — Show active games with join capability  
3. **Mini-map view** — See all connected dungeons at once
4. **Live background** — Show ongoing game on landing page

---

## 📊 Implementation Phases

### Phase 1: Team BR Variants ⚡ (30 min)
**Status:** READY TO START

Split Team BR into two distinct modes:
- 🛡 **Team Endless** — Continuous team-based BR
- 🛡 **Team Sit-n-Go** — Queued team matches

**Files to modify:**
- `frontend/app/play.html` — Split button
- `frontend/app/play.css` — Add purple/blue variants
- `frontend/app/play.js` — Add handlers
- `multiplayer.html` — Split button

---

### Phase 2: Active Games List (1-2 hours)
**Status:** API exists, needs UI

Display live game feed using existing `/multiplayer/active-games` API.

**Component:** `ActiveGamesList.js`
**Location:** Landing page sidebar or `/games` page

**Features:**
- Poll API every 5 seconds
- Show mode, player count, duration
- JOIN and SPECTATE buttons
- Retro card design

---

### Phase 3: Spectator Mode (2-3 hours)
**Status:** Needs server + client work

Allow read-only viewing of active games.

**Server:** New WebSocket message type `spectate`
**Client:** `SpectatorClient.js` component
**Route:** `/spectate/:gameId`

---

### Phase 4: Mini-Map Overview (4-6 hours)
**Status:** Complex, depends on Phase 3

Grid view showing all dungeons in a game.

**Approach:** HTML grid of dungeon cards (simplest)
**Update rate:** 2 FPS (500ms)
**Toggle:** Switch between full view and overview

---

### Phase 5: Live Background (3-4 hours)
**Status:** Depends on Phase 3

Show endless BR game as blurred background on landing page.

**Features:**
- Auto-connect to featured game
- 30 FPS rendering
- 60% opacity + blur effect
- "🔴 LIVE" indicator

---

## 🚀 Start with Phase 1

Let me implement Team BR variants now (quick win).

**Next:** Split Team BR button into two variants with distinct colors and modes.
