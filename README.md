# Wizard of Wor Platform

A browser-based Wizard of Wor platform with classic gameplay, multiplayer services, and a modern community layer.

The project recreates classic dungeon action in the browser and extends it with profiles, rankings, social tools, and admin features.

---

## Running the game (local)

```bash
npm run dev        # Vite dev server — http://localhost:8081 (auto-opens browser)
npm start          # Plain Node.js static server — http://localhost:8080
npm run multiplayer  # Authoritative multiplayer server — http://localhost:5001/multiplayer.html
```

## One-command production deployment (IaC)

This repo now ships a full Docker Compose stack (game web, authoritative multiplayer server, and TLS reverse proxy via Caddy).

```bash
cp .env.example .env
# edit .env and set DOMAIN + ACME_EMAIL
make up
```

That brings up:

- `web` → single-player/static assets (port 8080 inside network)
- `multiplayer` → authoritative server (port 5001 inside network)
- `edge` (Caddy) → public HTTPS on `:443`, auto TLS from Let's Encrypt
- Healthchecks are enabled for app/data services; `depends_on` waits for healthy upstreams before starting dependents.

### Optional auto-start on reboot (systemd, codified)

```bash
sudo scripts/install-systemd-service.sh /opt/wizard-of-wor
```

Service definition is versioned in `infra/systemd/wizard-of-wor-compose.service`.

### Remote deployment

```bash
./deploy-remote.sh user@host /opt/wizard-of-wor
```

## Community & Competitive Layer (new)

The repository now includes an isolated community stack:

- `community-api/` — Express + Socket.IO + PostgreSQL + Redis backend
- `community-web/` — Next.js + Tailwind + Zustand frontend
- `community-api/migrations/` — versioned SQL migrations (`*.up.sql` / `*.down.sql`)

Security defaults:

- `COMMUNITY_ALLOW_DEV_AUTH=false` disables `x-user-id`/`x-user-role` header auth by default.
- Use bearer tokens in normal operation. Only enable `COMMUNITY_ALLOW_DEV_AUTH=true` for local scaffolding, never production.
- Community WebSocket connections require JWT auth; sender identity is derived server-side.
- Auth/chat/forum/admin APIs use rate limiting and return structured `429` payloads when throttled.

### Community routes

- `/` — website landing with navigation, account auth panel, and global chat
- `/community` — community UI
- `/community/profile/:username` — player profile
- `/community/leaderboards` — global/season leaderboard page
- `/community/clans/:id` — clan page + clan chat
- `/community/challenges` — challenges and rewards
- `/community/chat` — global/match/team chat panels
- `/community/forum` — discussion forum with categories, threads, and replies
- `/admin` — moderation + analytics dashboard shell
- `/api/community/*` — backend API routes

Auth API:

- `POST /api/community/auth/register`
- `POST /api/community/auth/login`
- `GET /api/community/auth/me`

### Content pages for trust & ad-readiness

- `/community/about`
- `/community/features`
- `/community/faq`
- `/community/contact`
- `/community/privacy-policy`
- `/community/terms-of-service`

### Community API modules

- Users/profile, recent matches, edit profile
- Match result ingestion with XP/level progression and seasonal badge generation
- Friends system
- Leaderboards (global/regional/friends) with pagination and seasonal reset support
- Redis-backed leaderboard recompute worker queue (`leaderboard:recompute:queue`)
- Clans/teams
- Challenges/progress/claims
- Notifications
- Chat history + real-time chat via WebSocket
- Forum categories/threads/posts API
- Admin endpoints (user moderation + DAU/WAU/MAU) with required `page`/`size` pagination on list/report APIs

### Local community development

```bash
cd community-api && npm install && npm run migrate:up && npm run dev
cd community-web && npm install && npm run dev
```

Or run everything with IaC stack:

```bash
make setup
make up
```

### Operational extras

- Backup script: `scripts/backup-community.sh [backup_dir]`
- CI workflow: `.github/workflows/community-ci.yml`
- Migration commands: `npm --prefix community-api run migrate:up` and rollback `npm --prefix community-api run migrate:down -- 1`
- Project automation workflow: `.github/workflows/project-board-automation.yml`
  - Auto-adds issues to Project `#1` and updates `Status` (`Todo`/`In Progress`/`Done`) plus `Phase`.
  - For user-owned projects, set repository secret `PROJECT_AUTOMATION_TOKEN` with `repo` and `project` scopes.
- Community API emits structured JSON logs with request correlation (`x-request-id`) and socket lifecycle events.
- Real-time channels include chat, notifications, friend presence, and leaderboard updates.

---

## Gameplay

### Controls

| Action | Yellow warrior (P1) | Blue warrior (P2) |
|--------|--------------------|--------------------|
| Move   | Arrow keys         | WASD               |
| Fire   | Right Ctrl         | Left Shift         |

Controls are configurable per-player from the in-game menu: **arrow keys**, **WASD**, or **gamepad**.

### Starting a game

- Press **1** or P1's fire key for a one-player game
- Press **2** or P2's fire key for a two-player game

### Objective

Clear each dungeon of all enemies before they escape through the side teleport gates. Enemies grow faster and more aggressive over time.

### Enemies

| Enemy | Points | Notes |
|-------|--------|-------|
| Burwor | 100 | Always visible |
| Garwor | 200 | Can turn invisible |
| Thorwor | 500 | Can turn invisible, faster |
| Worluk | 1,000 | Activates double-score dungeon if killed |
| Worrior (other player) | 1,000 | Friendly fire is on |
| Wizard of Wor | 2,500 | Teleports randomly; killing a player costs a life |

### Dungeon progression

- Levels 1–7: easy dungeons (12 layouts, randomised)
- Levels 8+: hard dungeons (8 layouts)
- Level 4, and every 6 levels from level 13: fixed special dungeon
- **Bonus life** awarded to each living player at levels 3 and 12
- **Double score dungeon** triggered by killing the Worluk

### Speed

Enemy movement speed increases every 25 seconds mid-dungeon, up to 16 speed levels. The background music tempo reflects the current speed tier (7 tiers).

### Radar

The panel at the bottom centre of the screen shows a mini-map of all visible enemies and their positions on the grid.

### Teleport gates

Side walls have teleport gates at row 3. Players and most enemies can pass through them to emerge on the opposite side. Gates close temporarily after use.

---

## Features

### Visual filters

Selectable from the menu, each filter also changes the colour palette:

| Filter | Effect | Palette |
|--------|--------|---------|
| None | Pixel-perfect, no filter | Default C64 |
| Scan lines | Horizontal line overlay | Default C64 |
| Black & white TV | Blur + brightness + noise | Grayscale |
| Colour TV | Contrast/saturation blur + noise | Vice (C64 VICE emulator colours) |
| Green C64 monitor | Blur + brightness | Green phosphor |

Sprite colours are recoloured at runtime when the palette changes.

### Sound

22 original sound effects loaded via Web Audio API (`.ogg` files in `/audio/v2.0/`). Can be toggled on/off from the menu.

### High scores

Top 5 scores are persisted in `localStorage`. Shown on the title screen.

### Input

- Keyboard (arrows or WASD per player)
- Gamepad (up to 2 controllers via the Gamepad API)
- Both players can use the same control scheme only if different inputs are chosen — the menu auto-corrects conflicts

### Menu

Opened with the red **Menu** button (top-left). Pauses the game while open. Options: fullscreen, visual filter, sound, per-player controls.

---

## Changes from the original

The base of this project is the packed/minified `w.js` from Wizard of Wor v5.0 (found in `js/v5.0/`). The following changes were made:

### Offline patching (`patch.js`)

`patch.js` was a one-time script that:
1. Unpacked the custom-packed `w.js` source
2. Removed legacy forced-domain redirect logic
3. Removed the unsupported-browser redirect

> ⚠️ Do not re-run `patch.js` — the file has already been unpacked in place.

### ES module rewrite (`src/`)

The game logic was extracted and rewritten as ES modules for maintainability:

| File | Contents |
|------|----------|
| `src/App.js` | Top-level bootstrap: resource loading, key/gamepad handling, game loop, visual filter |
| `src/constants.js` | All static data: palettes, dungeon wall layouts, sprite atlas coordinates, scoring, keycodes |
| `src/utils.js` | Shared drawing helpers (`t`, `l`, `v`, `E`) and utility functions (`q`, `x`, `F`, `w`, `u`) |
| `src/engine/GameEngine.js` | Scene state machine, dungeon generation, collision detection, scoring, speed progression |
| `src/entities/Player.js` | Player state, movement, shooting, death/respawn |
| `src/entities/Monster.js` | Monster AI, pathfinding, invisibility, bullet firing |
| `src/entities/Bullet.js` | Bullet movement, wall collision, hit detection |
| `src/audio/AudioEngine.js` | Web Audio API wrapper with request queue |
| `src/ui/UIManager.js` | DOM menu wiring, fullscreen, option persistence |

### Dev tooling added

- `server.js` — simple Node.js static HTTP server (no dependencies) as an alternative to Vite
- `server-multiplayer.js` — authoritative WebSocket game server for the Endless Connected Dungeon multiplayer mode
- `vite.config.js` — Vite dev server config (port 8080, auto-open)

---

## Multiplayer — Endless Connected Dungeon

An authoritative multiplayer battle-royal mode built on top of the original game engine. Each player gets their own home dungeon; dungeons are dynamically linked via tunnels so players can invade each other.

### Architecture

The multiplayer stack runs as a separate process (`server-multiplayer.js`) alongside or instead of the static server:

```
server-multiplayer.js        HTTP + WebSocket entry point (port 5001)
src/server/
  serverConstants.js         dungeon layouts, scoring, directions (server-only, no rendering)
  serverUtils.js             randInt(), overlaps(), frames() — pure math helpers
  ServerBullet.js            bullet movement and hit detection (no rendering)
  ServerMonster.js           monster AI, pathfinding, speed tiers (no rendering)
  ServerPlayer.js            player movement, shooting, tunnel transfer (no rendering)
  DungeonInstance.js         one dungeon: full game loop, lifecycle state machine, serialisation
  GameServer.js              session manager, WS handling, 50 fps tick, dungeon linker
src/client/
  MultiplayerApp.js          sprite loading, WS connection, input capture, client renderer
multiplayer.html             client entry page with join-mode overlay
```

### Joining modes

| Mode | How | Result |
|------|-----|--------|
| **Solo** | Click "Solo" on join screen | Own dungeon; tunnels auto-link to any other active dungeon |
| **Paired** | Both players click "2-Player" | Shared dungeon; original WoW two-player spawn positions |

Join-screen UX improvements:
- Clearer connection status text
- Retry button after disconnects/errors (rejoins your last selected mode)
- Mode buttons lock while connecting to avoid duplicate join attempts

### Connected dungeons & tunnels

When a second solo player joins, a new independent dungeon is created and its tunnels are linked bidirectionally to an existing dungeon. Entering a tunnel at row 3 (the teleport gate row) transfers the player to the connected dungeon. The original teleport cooldown is preserved; tunnels are forced open during dungeon collapse.

### Dungeon lifecycle

```
ACTIVE
  │  (owner loses final life → 15 s evacuation window)
  ▼
COLLAPSING  — tunnels forced open; PvP still active; visiting players force-killed at timeout
  │
  ▼
EMPTY       — no players; monster speed ×1.8 (fast mode)
  │  (all monsters dead/escaped)
  ▼
DESTROYED   — dungeon removed; tunnel links unregistered
```

### Server authority

The server validates all movement, shooting, hits, scoring, tunnel transfers, respawn, and dungeon lifecycle transitions. Clients send only raw key-state; the server sends full serialised dungeon state at 50 fps.

### Multiplayer controls

| Action | Yellow (P1) | Blue (P2) |
|--------|-------------|-----------|
| Move   | Arrow keys  | WASD      |
| Fire   | Right Ctrl  | Left Shift |

Both players are controlled locally from the same browser tab. Open two tabs (or two browsers) for true network play.

---

---

## Project structure

```
index.html          single-player entry point (all CSS inline, loads src/App.js)
multiplayer.html    multiplayer entry point (loads src/client/MultiplayerApp.js)
src/                ES module source (the active game code)
  App.js            single-player bootstrap
  constants.js      sprite atlas, dungeon layouts, palettes, keycodes
  utils.js          shared drawing helpers and utilities
  engine/           GameEngine — scene state machine, collision, scoring
  entities/         Player, Monster, Bullet — game entity logic
  audio/            AudioEngine — Web Audio API wrapper
  ui/               UIManager — DOM menu wiring, fullscreen, options
  server/           Authoritative multiplayer server modules (Node.js / CommonJS)
  client/           Multiplayer client renderer (ES modules, browser)
js/v5.0/w.js        original unpacked+patched source (reference only)
patch.js            one-time unpack/patch script (already run — do not re-run)
server.js           Node.js static file server (single-player)
server-multiplayer.js  Node.js HTTP + WebSocket server (multiplayer)
audio/v2.0/         .ogg sound effects (22 files)
images/             sprite sheet, CRT noise texture, UI assets
fonts/v2.0/         WizardOfWor and C64Pro web fonts
public/             static assets served by Vite (handbook, etc.)
```
