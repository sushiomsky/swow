const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

/** Map dimensions in tiles */
const MAP_WIDTH = 30;
const MAP_HEIGHT = 30;

/** Available player colors cycled in order of connection */
const PLAYER_COLORS = ['blue', 'green', 'orange', 'purple', 'cyan', 'magenta'];

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Define the game state
const gameState = {
    players: {},
    shots: [],
};

/**
 * Return the next available color for a newly connected player.
 * Cycles through PLAYER_COLORS; falls back to 'gray' when all are in use.
 * @returns {string} CSS color string
 */
function assignPlayerColor() {
    const usedColors = new Set(
        Object.values(gameState.players).map((p) => p.color)
    );
    for (const color of PLAYER_COLORS) {
        if (!usedColors.has(color)) return color;
    }
    return 'gray';
}

/**
 * Handle a player movement request.
 * Updates the player's position when the target cell is within bounds and
 * not a wall, and records the new facing direction.
 * @param {string} playerId
 * @param {number} dx  Horizontal delta (-1, 0, or 1)
 * @param {number} dy  Vertical delta   (-1, 0, or 1)
 */
function handlePlayerMovement(playerId, dx, dy) {
    const currentPlayer = gameState.players[playerId];
    if (!currentPlayer) return;

    const newX = currentPlayer.x + dx;
    const newY = currentPlayer.y + dy;

    if (newX >= 0 && newX < MAP_WIDTH && newY >= 0 && newY < MAP_HEIGHT && !isWall(newX, newY)) {
        currentPlayer.x = newX;
        currentPlayer.y = newY;

        // Track the direction the player is facing so shots fire correctly
        if (dy < 0) currentPlayer.direction = 'up';
        else if (dy > 0) currentPlayer.direction = 'down';
        else if (dx < 0) currentPlayer.direction = 'left';
        else if (dx > 0) currentPlayer.direction = 'right';

        broadcastGameState();
    }
}

/**
 * Handle a player shoot request.
 * One shot per player at a time; the shot travels in the player's current
 * facing direction.  The `hasShot` flag is cleared when the shot is removed
 * by moveShots().
 * @param {string} playerId
 */
function handlePlayerShoot(playerId) {
    const currentPlayer = gameState.players[playerId];
    // Guard: player must exist and must not already have an active shot
    if (!currentPlayer || currentPlayer.hasShot) return;

    const shot = {
        playerId,
        x: currentPlayer.x,
        y: currentPlayer.y,
        direction: currentPlayer.direction, // Use player's current facing direction
    };

    gameState.shots.push(shot);
    currentPlayer.hasShot = true;

    broadcastGameState();
}

/**
 * Advance all active shots by one tile and resolve collisions.
 *
 * Fixes applied vs original code:
 * 1. Boundary check added – shots that leave the map are removed.
 * 2. hasShot flag reset – when a shot is removed its owner's hasShot is
 *    cleared so the player can shoot again.
 * 3. Friendly-fire prevention – a shot cannot hit its own shooter.
 * 4. Shot-vs-shot uses updated positions – collision checked against
 *    newShots (positions already moved this tick) rather than original
 *    gameState.shots, preventing false positives against unmoved shots.
 */
function moveShots() {
    /** IDs of players whose shots are being removed this tick */
    const shotsToRemove = new Set();
    const newShots = [];

    for (let i = 0; i < gameState.shots.length; i++) {
        const shot = gameState.shots[i];
        let { x, y, direction, playerId } = shot;

        // Advance position
        switch (direction) {
            case 'up':    y -= 1; break;
            case 'down':  y += 1; break;
            case 'left':  x -= 1; break;
            case 'right': x += 1; break;
        }

        // Bug fix 1: boundary check – remove shots that leave the map
        if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) {
            shotsToRemove.add(playerId);
            continue;
        }

        // Wall collision
        if (isWall(x, y)) {
            shotsToRemove.add(playerId);
            continue;
        }

        // Player collision – bug fix 3: skip the shooter's own tile
        let hitPlayerId = null;
        for (const pid in gameState.players) {
            if (pid === playerId) continue; // No friendly fire
            const player = gameState.players[pid];
            if (player.x === x && player.y === y) {
                hitPlayerId = pid;
                break;
            }
        }
        if (hitPlayerId) {
            delete gameState.players[hitPlayerId];
            // Also remove any shot owned by the eliminated player
            shotsToRemove.add(playerId);
            shotsToRemove.add(hitPlayerId);
            continue;
        }

        // Bug fix 4: shot-vs-shot uses positions already resolved this tick
        let hitAnotherShot = false;
        for (const other of newShots) {
            if (other.x === x && other.y === y) {
                hitAnotherShot = true;
                shotsToRemove.add(other.playerId);
                shotsToRemove.add(playerId);
                break;
            }
        }
        if (hitAnotherShot) continue;

        newShots.push({ ...shot, x, y });
    }

    // Bug fix 2: reset hasShot for every player whose shot was removed
    for (const pid of shotsToRemove) {
        if (gameState.players[pid]) {
            gameState.players[pid].hasShot = false;
        }
    }

    // Remove shots whose owner ID is in shotsToRemove.
    // Because hasShot enforces at most one active shot per player, filtering
    // by playerId is safe and removes exactly the intended shots.
    gameState.shots = newShots.filter((s) => !shotsToRemove.has(s.playerId));

    broadcastGameState();
}

/**
 * Send the current game state to every connected client.
 */
function broadcastGameState() {
    const gameData = JSON.stringify(gameState);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(gameData);
        }
    });
}

// ─── WebSocket connection handling ───────────────────────────────────────────

wss.on('connection', (ws) => {
    console.log('A client connected');

    const playerId = generatePlayerId();

    const player = {
        id: playerId,
        x: Math.floor(Math.random() * MAP_WIDTH),
        y: Math.floor(Math.random() * MAP_HEIGHT),
        hasShot: false,
        direction: 'up',          // Default facing direction
        color: assignPlayerColor(), // Unique color per player
    };
    gameState.players[playerId] = player;

    // Send the player their own ID plus the full game state
    ws.send(JSON.stringify({ playerId, ...gameState }));

    ws.on('message', (message) => {
        let parsed;
        try {
            parsed = JSON.parse(message);
        } catch (err) {
            console.error('Invalid message received:', err.message);
            return;
        }

        const { type, data } = parsed;

        if (type === 'movement' && data) {
            const { x, y } = data;
            if (typeof x === 'number' && typeof y === 'number') {
                handlePlayerMovement(playerId, x, y);
            }
        } else if (type === 'shoot') {
            // Direction is now tracked server-side; no client payload needed
            handlePlayerShoot(playerId);
        }
    });

    ws.on('close', () => {
        console.log('A client disconnected');
        delete gameState.players[playerId];
        // Also remove any in-flight shots belonging to this player
        gameState.shots = gameState.shots.filter((s) => s.playerId !== playerId);
        broadcastGameState();
    });

    ws.on('error', (err) => {
        console.error(`WebSocket error for player ${playerId}:`, err.message);
    });
});

// ─── Utility functions ───────────────────────────────────────────────────────

/**
 * Generate a unique player ID based on the current timestamp and a random
 * suffix to avoid collisions when two clients connect in the same millisecond.
 * @returns {string}
 */
function generatePlayerId() {
    return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/**
 * Return true if the tile at (x, y) is a wall.
 * Extend this function to add maze/dungeon layouts.
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
function isWall(x, y) {
    return false;
}

// ─── Game loop ───────────────────────────────────────────────────────────────

setInterval(() => {
    moveShots();
}, 100);

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
