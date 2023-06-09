const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const MAP_WIDTH = 30;
const MAP_HEIGHT = 30;

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Define the game state
const gameState = {
    players: {},
    shots: [],
};

// Function to handle player movements
function handlePlayerMovement(playerId, x, y) {
    // Check if the movement is within the map boundaries
    const currentPlayer = gameState.players[playerId];
    const newX = currentPlayer.x + x;
    const newY = currentPlayer.y + y;

    if (newX >= 0 && newX < MAP_WIDTH && newY >= 0 && newY < MAP_HEIGHT && !isWall(newX, newY)) {
        // Update the player's position in the game state
        currentPlayer.x = newX;
        currentPlayer.y = newY;

        // Send the updated game state to all clients
        broadcastGameState();
    }
}

// Function to handle player shooting
function handlePlayerShoot(playerId, direction) {
    // Check if the player already has an active shot
    const currentPlayer = gameState.players[playerId];
    if (currentPlayer.hasShot) {
        return;
    }

    // Create a new shot object with the player's position and direction
    const shot = {
        playerId,
        x: currentPlayer.x,
        y: currentPlayer.y,
        direction,
    };

    // Add the shot to the game state
    gameState.shots.push(shot);
    currentPlayer.hasShot = true;

    // Send the updated game state to all clients
    broadcastGameState();
}

// Function to move shots in their respective directions
function moveShots() {
    const newShots = [];
    for (const shot of gameState.shots) {
        let { x, y, direction } = shot;

        // Update the shot's position based on its direction
        switch (direction) {
            case 'up':
                y -= 1;
                break;
            case 'down':
                y += 1;
                break;
            case 'left':
                x -= 1;
                break;
            case 'right':
                x += 1;
                break;
        }

        // Check if the shot hits a wall
        if (isWall(x, y)) {
            continue;
        }

        // Check if the shot hits another shot
        let hitAnotherShot = false;
        for (const otherShot of gameState.shots) {
            if (otherShot !== shot && otherShot.x === x && otherShot.y === y) {
                hitAnotherShot = true;
                break;
            }
        }
        if (hitAnotherShot) {
            continue;
        }

        // Check if the shot hits a player
        let hitPlayerId = null;
        for (const playerId in gameState.players) {
            const player = gameState.players[playerId];
            if (player.x === x && player.y === y) {
                hitPlayerId = playerId;
                break;
            }
        }
        if (hitPlayerId) {
            // Handle shot hitting a player
            // Update player health or other player-related game logic accordingly
            // For now, let's assume the player is killed and remove them from the game
            delete gameState.players[hitPlayerId];
            continue;
        }

        // Add the shot to the new shots array
        newShots.push({
            ...shot,
            x,
            y,
        });
    }

    // Update the game state shots with the new shots
    gameState.shots = newShots;

    // Send the updated game state to all clients
    broadcastGameState();
}

// Function to broadcast the game state to all connected clients
function broadcastGameState() {
    const gameData = JSON.stringify(gameState);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(gameData);
        }
    });
}

// WebSocket server
wss.on('connection', (ws) => {
    console.log('A client connected');

    // Generate a unique player ID for the client
    const playerId = generatePlayerId();

    // Create a new player object and add it to the game state
    const player = {
        id: playerId,
        x: Math.floor(Math.random() * MAP_WIDTH),
        y: Math.floor(Math.random() * MAP_HEIGHT),
        hasShot: false,
    };
    gameState.players[playerId] = player;

    // Send the initial game state to the client
    ws.send(JSON.stringify(gameState));

    // Listen for messages from the client
    ws.on('message', (message) => {
        const { type, data } = JSON.parse(message);

        if (type === 'movement') {
            const { x, y } = data;
            handlePlayerMovement(playerId, x, y);
        } else if (type === 'shoot') {
            const { direction } = data;
            handlePlayerShoot(playerId, direction);
        }
    });

    // Handle client disconnection
    ws.on('close', () => {
        console.log('A client disconnected');

        // Remove the player from the game state
        delete gameState.players[playerId];

        // Send the updated game state to all clients
        broadcastGameState();
    });
});

// Utility function to generate a unique player ID
function generatePlayerId() {
    return Date.now().toString();
}

// Utility function to check if a position is a wall
function isWall(x, y) {
    // Implement your wall checking logic here
    return false;
}

// Game loop
setInterval(() => {
    moveShots();
}, 100); // Adjust the interval as per your game's requirements

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
