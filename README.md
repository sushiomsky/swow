# Wizard of Wor Battle Royale

**swow** (the repository name) is a real-time, multiplayer browser-based battle game inspired by the classic arcade game **Wizard of Wor**. Players connect through WebSockets, navigate a 30×30 grid, and try to eliminate each other with projectile shots.

## Features

- Real-time multiplayer via WebSockets
- 30×30 tile-based grid map
- Players rendered on an HTML5 Canvas
- Arrow-key movement and spacebar shooting
- Projectiles travel upward (direction support is available server-side for future enhancement) and are removed on impact with walls, other shots, or players
- Players are removed from the game when hit by a shot

## Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Runtime    | [Node.js](https://nodejs.org)     |
| Web server | [Express](https://expressjs.com)  |
| WebSockets | [ws](https://github.com/websockets/ws) |
| Frontend   | HTML5 Canvas (vanilla JavaScript) |

## Prerequisites

- Node.js ≥ 14
- npm ≥ 6

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/sushiomsky/swow.git
cd swow

# 2. Install dependencies
npm install
```

## Running the Server

```bash
node server.js
```

The server starts on port **5001** by default. You can override this with the `PORT` environment variable:

```bash
PORT=3000 node server.js
```

## Playing the Game

1. Start the server (see above).
2. Open your browser and navigate to `http://localhost:5001`.
3. Share the URL with friends so they can join the same session.

### Controls

| Key         | Action              |
|-------------|---------------------|
| `Arrow Up`  | Move up             |
| `Arrow Down`| Move down           |
| `Arrow Left`| Move left           |
| `Arrow Right`| Move right         |
| `Space`     | Fire a shot (always travels upward in the current implementation) |

### Game Rules

- Each player spawns at a random position on the grid.
- Only **one active shot per player** is allowed at a time.
- A shot is destroyed when it hits a wall or another shot.
- A player is eliminated when hit by a shot.
- The last player standing wins.

## Project Structure

```
swow/
├── public/
│   └── index.html   # Game client (Canvas rendering + WebSocket client)
├── server.js        # Express server, WebSocket server, and game logic
├── package.json
└── README.md
```

## License

ISC
