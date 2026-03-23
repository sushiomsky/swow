# 🎯 Automation Event System

Complete reference for event-driven automation in Wizard of Wor.

## Overview

The engine exposes a full event system for deterministic automation, testing, and AI integration.

**Key Benefits:**
- ✅ No polling required (event-driven waits)
- ✅ Deterministic behavior (guaranteed ordering)
- ✅ Race-condition free (strict contract)
- ✅ Multi-bot compatible (concurrent listeners)
- ✅ Playwright ready (Promise-based)

---

## Available Events

### Lifecycle Events

#### `ready`
Emitted when engine is fully initialized and ready to accept commands.

```javascript
window.swowDebug.on('ready', () => {
    console.log('Engine is ready!');
});
```

**When:** Once on initial load  
**Data:** None

---

#### `gameStarting`
Emitted immediately when `startNewGame()` or `createRoom()` is called.

```javascript
window.swowDebug.on('gameStarting', ({ mode, players }) => {
    console.log(`Starting ${mode} game with ${players} players`);
});
```

**When:** Before engine initialization  
**Data:** `{ mode: 'sp'|'mp', players: number }`

---

#### `gameStart`
Emitted when game has fully started and is running.

```javascript
window.swowDebug.on('gameStart', (state) => {
    console.log('Game started:', state);
});
```

**When:** After engine initialized, before first tick  
**Data:** Full state object with `ready: true`

---

#### `playing`
Emitted continuously while game is running (could be used for tick-based updates).

```javascript
window.swowDebug.on('playing', ({ tick, scene }) => {
    console.log(`Tick ${tick}, scene: ${scene}`);
});
```

**When:** During gameplay  
**Data:** `{ tick, scene }`  
**Note:** Currently only emitted from getState() calls

---

#### `gameOver`
Emitted when game ends (player death in SP, match complete in MP).

```javascript
window.swowDebug.on('gameOver', ({ score, duration }) => {
    console.log(`Game over! Score: ${score}, Duration: ${duration}ms`);
});
```

**When:** On death/match end  
**Data:** TBD (not yet implemented)  
**Status:** 🔴 Planned

---

#### `reset`
Emitted when returning to menu.

```javascript
window.swowDebug.on('reset', () => {
    console.log('Returned to menu');
});
```

**When:** After `engine.reset()` completes  
**Data:** None

---

### Multiplayer Events

#### `roomCreating`
Emitted when MP room creation starts.

```javascript
window.swowDebug.on('roomCreating', () => {
    console.log('Creating multiplayer room...');
});
```

**When:** Before MP engine init  
**Data:** None

---

#### `roomCreated`
Emitted when MP room is fully created and ready for joins.

```javascript
window.swowDebug.on('roomCreated', ({ roomCode }) => {
    console.log('Room created:', roomCode);
});
```

**When:** After MP init, room code available  
**Data:** `{ roomCode: string }`

---

#### `roomJoining`
Emitted when attempting to join a room.

```javascript
window.swowDebug.on('roomJoining', ({ code }) => {
    console.log('Joining room:', code);
});
```

**When:** Before join attempt  
**Data:** `{ code: string }`

---

#### `roomJoined`
Emitted when successfully joined a room.

```javascript
window.swowDebug.on('roomJoined', ({ roomCode, playerId, playerNum }) => {
    console.log(`Joined ${roomCode} as player ${playerNum}`);
});
```

**When:** After join success  
**Data:** `{ roomCode, playerId, playerNum }`

---

### Error Events

#### `error`
Emitted on any error during operations.

```javascript
window.swowDebug.on('error', ({ action, message, code }) => {
    console.error(`Error in ${action}:`, message);
});
```

**When:** Any operation fails  
**Data:** `{ action: string, message: string, code?: string }`

---

### Autoplay Events

#### `autoplay:ready`
Emitted when autoplay mode completes initialization.

```javascript
window.addEventListener('autoplay:ready', ({ detail }) => {
    console.log('Autoplay ready:', detail);
});
```

**When:** After autoplay completes  
**Data:** `{ mode: 'sp'|'create', state, roomCode?, players? }`  
**Note:** Uses CustomEvent (window-level), not engine events

---

#### `autoplay:error`
Emitted when autoplay fails.

```javascript
window.addEventListener('autoplay:error', ({ detail }) => {
    console.error('Autoplay error:', detail.error);
});
```

**When:** Autoplay fails  
**Data:** `{ error: string }`

---

## API Methods

### Subscribe to Events

```javascript
window.swowDebug.on(event, handler)
```

**Example:**
```javascript
window.swowDebug.on('gameStart', (state) => {
    console.log('Game started!', state);
});
```

---

### Unsubscribe from Events

```javascript
window.swowDebug.off(event, handler)
```

**Example:**
```javascript
const handler = (state) => console.log(state);
window.swowDebug.on('gameStart', handler);

// Later...
window.swowDebug.off('gameStart', handler);
```

---

### Wait for Event (Promise-based)

```javascript
await window.swowDebug.waitFor(event, timeout = 10000)
```

**Example:**
```javascript
// Wait for game to start
await window.swowDebug.waitFor('gameStart');

// Wait for room creation with timeout
try {
    const data = await window.swowDebug.waitFor('roomCreated', 5000);
    console.log('Room:', data.roomCode);
} catch (err) {
    console.error('Timeout waiting for room');
}
```

**Returns:** Event data  
**Throws:** Error on timeout

---

## Complete Examples

### Example 1: Event-Driven Playwright Test

```javascript
test('create multiplayer room', async ({ page }) => {
    await page.goto('https://wizardofwor.duckdns.org/play');
    
    // Wait for engine ready
    await page.evaluate(() => {
        return new Promise((resolve) => {
            window.swowDebug.on('ready', resolve);
        });
    });
    
    // Create room and wait for confirmation
    const roomCode = await page.evaluate(async () => {
        return await window.swowDebug.waitFor('roomCreated', 10000)
            .then(data => data.roomCode);
    });
    
    console.log('Room created:', roomCode);
    
    // Start second browser and join
    const page2 = await context.newPage();
    await page2.goto(`https://wizardofwor.duckdns.org/play?room=${roomCode}&autoplay=1`);
    
    // Wait for join confirmation
    await page2.evaluate(() => {
        return new Promise((resolve) => {
            window.swowDebug.on('roomJoined', resolve);
        });
    });
    
    console.log('Player 2 joined!');
});
```

---

### Example 2: Autoplay with Event Confirmation

```javascript
// Open page with autoplay
await page.goto('https://wizardofwor.duckdns.org/play?autoplay=create');

// Wait for autoplay to complete
const result = await page.evaluate(() => {
    return new Promise((resolve) => {
        window.addEventListener('autoplay:ready', (e) => {
            resolve(e.detail);
        });
    });
});

console.log('Autoplay result:', result);
// { mode: 'create', roomCode: 'ABC123', state: {...} }
```

---

### Example 3: AI Player with Event-Driven Logic

```javascript
// Subscribe to game state changes
window.swowDebug.on('gameStart', (state) => {
    console.log('AI: Game started, initializing...');
    startAI();
});

window.swowDebug.on('error', ({ message }) => {
    console.error('AI: Error detected:', message);
    pauseAI();
});

function startAI() {
    setInterval(() => {
        const state = window.swowDebug.getState();
        
        if (!state.ready || state.state !== 'playing') {
            return;
        }
        
        // AI logic here
        const player = state.players[0];
        if (player) {
            // Make decision based on position
            console.log('AI position:', player.x, player.y);
        }
    }, 50);
}
```

---

### Example 4: Multi-Bot Stress Test

```javascript
// Create 1 host + 49 clients

// Host (tab 1)
await page.goto('https://wizardofwor.duckdns.org/play?autoplay=create');

const roomCode = await page.evaluate(() => {
    return window.swowDebug.waitFor('roomCreated', 10000)
        .then(data => data.roomCode);
});

console.log('Host created room:', roomCode);

// Spawn 49 clients
for (let i = 0; i < 49; i++) {
    const client = await context.newPage();
    
    await client.goto(`https://wizardofwor.duckdns.org/play?room=${roomCode}&autoplay=1`);
    
    // Don't wait for all to join (fire and forget)
    client.evaluate(() => {
        window.swowDebug.on('roomJoined', () => {
            console.log('Client joined!');
        });
    });
}

console.log('All 49 clients spawned');
```

---

## State Contract

`getState()` always returns a valid object, never undefined:

```javascript
{
    ready: boolean,              // STRICT: true only when engine.initialized === true
    state: string,               // 'loading' | 'menu' | 'playing' | 'gameover' | 'error'
    mode: string | null,         // 'sp' | 'mp' | null
    isMultiplayer: boolean,
    roomCode: string | null,
    playerId: string | null,
    playerNum: number | null,
    tick: number,
    scene: string | null,
    players: array,
    startedAt: number | null,
    gameOverAt: number | null
}
```

**When `ready === false`:**
- Engine not yet initialized
- Do NOT call action methods
- Wait for `ready` event

**When `ready === true`:**
- Engine fully initialized
- Safe to call all methods
- State is reliable

---

## Guarantees

### ✅ No Race Conditions
All events emitted AFTER state updates complete.

### ✅ No Undefined Values
State always has all fields (nulls are explicit).

### ✅ Event Ordering
Events fire in deterministic order:
1. `gameStarting` → `gameStart` → `playing`
2. `roomCreating` → `roomCreated` → `gameStart`
3. `roomJoining` → `roomJoined` → `gameStart`

### ✅ Error Safety
All errors emit `error` event (never throw in production).

### ✅ Multiple Listeners
Multiple handlers can subscribe to same event.

---

## Testing Checklist

Before running automation:

```javascript
// 1. Check engine exists
console.assert(window.engine, 'Engine missing');

// 2. Check debug API exists
console.assert(window.swowDebug, 'Debug API missing');

// 3. Wait for ready
await window.swowDebug.waitReady();

// 4. Check state
const state = window.swowDebug.getState();
console.assert(state.ready === true, 'Engine not ready');

// 5. Subscribe to events
window.swowDebug.on('gameStart', () => console.log('OK'));
```

---

## Next Steps

### 🔴 TODO: gameOver Event
Currently game over must be detected manually.

**Implementation needed:**
- Detect `swow:game-over` custom event
- Emit `gameOver` event with score/stats

### 🔴 TODO: Tick Events
Add optional tick-based event stream for AI.

**Implementation:**
- `engine.on('tick', handler)`
- Emits every frame (60Hz)
- Includes player positions, enemies, etc.

### 🟢 DONE
- ✅ Strict state contract
- ✅ Event system (`on`/`off`/`waitFor`)
- ✅ Deterministic autoplay
- ✅ Error events
- ✅ Room events
- ✅ Lifecycle events

---

**Status:** Ready for AI players and multi-bot testing! 🚀
