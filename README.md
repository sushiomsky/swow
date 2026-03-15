# Wizard of Wor — Local Offline Fork

A local offline version of the **Wizard of Wor v5.0** browser remake by [krissz.hu](https://krissz.hu/). The original live game is at [wizardofwor.krissz.hu](https://wizardofwor.krissz.hu/).

Wizard of Wor is a 1983 arcade game originally developed by Midway, popularized on the Commodore 64. This remake faithfully recreates the C64 version in the browser using HTML5 Canvas and Web Audio API.

---

## Running the game

```bash
npm run dev     # Vite dev server — http://localhost:8080 (auto-opens browser)
npm start       # Plain Node.js static server — http://localhost:8080
```

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
2. Removed the domain check that redirected to `wizardofwor.krissz.hu`
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
- `vite.config.js` — Vite dev server config (port 8080, auto-open)

---

## Project structure

```
index.html          entry point (all CSS inline, loads src/App.js)
src/                ES module source (the active game code)
js/v5.0/w.js        original unpacked+patched source (reference)
patch.js            one-time unpack/patch script (already run)
server.js           Node.js static file server
audio/v2.0/         .ogg sound effects
images/             sprite sheet, CRT noise texture, UI assets
fonts/v2.0/         WizardOfWor and C64Pro web fonts
```
