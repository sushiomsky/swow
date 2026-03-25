# 🏗️ Connected Dungeons Architecture Design

**Version:** MVP v1.0  
**Approach:** Minimal Changes (Approach A)  
**Target:** 2-5 connected dungeons with tunnel travel

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        GameServer                            │
│  - Manages WebSocket connections                            │
│  - Routes messages                                           │
│  - Owns DungeonGraph                                        │
└────────────┬────────────────────────────────────────────────┘
             │
             ├──> DungeonGraph
             │     - Tracks connections between dungeons
             │     - Manages topology (ring, random, etc.)
             │
             ├──> Map<dungeonId, DungeonInstance>
             │     ├──> DungeonInstance A (2 players)
             │     ├──> DungeonInstance B (2 players)
             │     └──> DungeonInstance C (2 players)
             │
             └──> Map<playerId, Connection>
                   - Tracks which dungeon each player is in
```

---

## Core Components

### 1. DungeonGraph

**Purpose:** Manage connections between dungeons

```javascript
class DungeonGraph {
    constructor() {
        // Map<dungeonId, Set<dungeonId>>
        this.adjacency = new Map();
    }
    
    addDungeon(dungeonId) {
        if (!this.adjacency.has(dungeonId)) {
            this.adjacency.set(dungeonId, new Set());
        }
    }
    
    connect(dungeonA, dungeonB) {
        // Bidirectional link
        this.adjacency.get(dungeonA).add(dungeonB);
        this.adjacency.get(dungeonB).add(dungeonA);
    }
    
    getNeighbors(dungeonId) {
        return Array.from(this.adjacency.get(dungeonId) || []);
    }
    
    autoConnect(dungeonId, maxLinks = 2) {
        // Automatically connect new dungeon to existing ones
        const existing = Array.from(this.adjacency.keys())
            .filter(id => id !== dungeonId);
        
        // Connect to random existing dungeons
        const shuffled = existing.sort(() => Math.random() - 0.5);
        const toConnect = shuffled.slice(0, maxLinks);
        
        toConnect.forEach(targetId => {
            this.connect(dungeonId, targetId);
        });
        
        return toConnect;
    }
}
```

---

### 2. Tunnel System

**Tunnel Entity:**
```javascript
// In DungeonInstance
class TunnelPortal {
    constructor(targetDungeonId, position) {
        this.targetDungeonId = targetDungeonId;
        this.x = position.x;
        this.y = position.y; // Fixed row (e.g., row 3)
        this.active = true;
        this.cooldownMs = 3000; // 3 second cooldown
        this.lastUsed = new Map(); // playerId -> timestamp
    }
    
    canUse(playerId) {
        const last = this.lastUsed.get(playerId);
        if (!last) return true;
        return (Date.now() - last) > this.cooldownMs;
    }
    
    markUsed(playerId) {
        this.lastUsed.set(playerId, Date.now());
    }
}
```

**DungeonInstance Changes:**
```javascript
class DungeonInstance {
    constructor(id) {
        // ... existing code ...
        
        // NEW: Tunnel system
        this.tunnels = []; // Array of TunnelPortal
        this.tunnelRow = 3; // Fixed row for tunnels
    }
    
    addTunnel(targetDungeonId, xPosition) {
        const tunnel = new TunnelPortal(targetDungeonId, {
            x: xPosition,
            y: this.tunnelRow
        });
        this.tunnels.push(tunnel);
        return tunnel;
    }
    
    getTunnelAt(x, y) {
        return this.tunnels.find(t => t.x === x && t.y === y && t.active);
    }
}
```

---

### 3. Player Transfer Protocol

**Message Flow:**

```
Client                  Server                  Target Dungeon
  │                       │                           │
  │──tunnel_enter────────>│                           │
  │                       │                           │
  │                       │──validate tunnel──────────│
  │                       │                           │
  │                       │──find slot────────────────>│
  │                       │<──slot confirmed───────────│
  │                       │                           │
  │                       │──remove from source       │
  │                       │──create in target─────────>│
  │                       │                           │
  │<──tunnel_complete─────│                           │
  │<──dungeon_init────────┤                           │
  │                       │                           │
```

**New Message Types:**

```javascript
// Client → Server
{
    type: 'tunnel_enter',
    tunnelIndex: 0  // Which tunnel (in case multiple)
}

// Server → Client
{
    type: 'tunnel_complete',
    targetDungeonId: 'abc123',
    playerSlot: 1,
    position: { x: 10, y: 3 }
}

// Server → All clients in source dungeon
{
    type: 'player_left_via_tunnel',
    playerId: 'p1',
    targetDungeonId: 'abc123'
}

// Server → All clients in target dungeon
{
    type: 'player_arrived_via_tunnel',
    playerId: 'p1',
    playerSlot: 1,
    position: { x: 10, y: 3 }
}
```

---

### 4. State Preservation

**Player State Transfer:**

```javascript
// Extract player state before transfer
function extractPlayerState(serverPlayer) {
    return {
        score: serverPlayer.score,
        lives: serverPlayer.lives,
        items: serverPlayer.items || [],
        status: serverPlayer.status,
        // Don't transfer position (spawn at tunnel exit)
    };
}

// Apply state after transfer
function applyPlayerState(newServerPlayer, savedState) {
    newServerPlayer.score = savedState.score;
    newServerPlayer.lives = savedState.lives;
    newServerPlayer.items = savedState.items;
    newServerPlayer.status = savedState.status;
}
```

---

## Implementation Plan

### Phase 1: Server Foundation (4 hours)

#### Step 1.1: Add DungeonGraph (1 hour)

```javascript
// In GameServer.js
class GameServer {
    constructor(httpServer) {
        // ... existing code ...
        this.dungeonGraph = new DungeonGraph();
    }
    
    _createDungeon() {
        const dungeon = new DungeonInstance(this._generateId());
        this.dungeons.set(dungeon.id, dungeon);
        
        // NEW: Add to graph
        this.dungeonGraph.addDungeon(dungeon.id);
        
        // NEW: Auto-connect to existing dungeons
        const connected = this.dungeonGraph.autoConnect(dungeon.id, 2);
        
        // NEW: Create tunnel portals
        connected.forEach((targetId, index) => {
            const xPos = 5 + (index * 10); // Spread tunnels across row
            dungeon.addTunnel(targetId, xPos);
        });
        
        return dungeon;
    }
}
```

#### Step 1.2: Add Tunnel Message Handler (2 hours)

```javascript
// In GameServer._onMessage()
case 'tunnel_enter':
    this._handleTunnelTravel(playerId, conn, msg.tunnelIndex);
    break;

_handleTunnelTravel(playerId, conn, tunnelIndex) {
    if (!conn.player || !conn.dungeonId) {
        console.warn(`[TunnelTravel] Player ${playerId} not in dungeon`);
        return;
    }
    
    const sourceDungeon = this.dungeons.get(conn.dungeonId);
    if (!sourceDungeon) return;
    
    // Get tunnel
    const tunnel = sourceDungeon.tunnels[tunnelIndex];
    if (!tunnel || !tunnel.active) {
        this._send(conn.ws, { type: 'tunnel_error', message: 'Tunnel not available' });
        return;
    }
    
    // Check cooldown
    if (!tunnel.canUse(playerId)) {
        this._send(conn.ws, { type: 'tunnel_error', message: 'Tunnel on cooldown' });
        return;
    }
    
    // Get target dungeon
    const targetDungeon = this.dungeons.get(tunnel.targetDungeonId);
    if (!targetDungeon) {
        this._send(conn.ws, { type: 'tunnel_error', message: 'Target dungeon not available' });
        return;
    }
    
    // Find available slot in target
    const availableSlot = this._findAvailableSlot(targetDungeon);
    if (availableSlot === null) {
        this._send(conn.ws, { type: 'tunnel_error', message: 'Target dungeon full' });
        return;
    }
    
    // Save player state
    const savedState = {
        score: conn.player.score,
        lives: conn.player.lives,
        items: conn.player.items || [],
        status: conn.player.status,
    };
    
    // Remove from source
    sourceDungeon.removePlayer(conn.player);
    
    // Broadcast to source dungeon
    this._broadcast(sourceDungeon, {
        type: 'player_left_via_tunnel',
        playerId: playerId,
        targetDungeonId: tunnel.targetDungeonId
    });
    
    // Create player in target
    const newPlayer = new ServerPlayer(availableSlot, targetDungeon, playerId, targetDungeon.id);
    newPlayer.score = savedState.score;
    newPlayer.lives = savedState.lives;
    newPlayer.items = savedState.items;
    newPlayer.status = savedState.status;
    newPlayer.homeSlot = availableSlot;
    
    // Spawn at tunnel exit position
    newPlayer.x = tunnel.x;
    newPlayer.y = tunnel.y;
    
    targetDungeon.addPlayer(newPlayer);
    
    // Update connection
    conn.player = newPlayer;
    conn.dungeonId = targetDungeon.id;
    
    // Mark tunnel used
    tunnel.markUsed(playerId);
    
    // Send confirmation to player
    this._sendInit(conn, targetDungeon);
    this._send(conn.ws, {
        type: 'tunnel_complete',
        targetDungeonId: targetDungeon.id,
        playerSlot: availableSlot
    });
    
    // Broadcast to target dungeon
    this._broadcast(targetDungeon, {
        type: 'player_arrived_via_tunnel',
        playerId: playerId,
        playerSlot: availableSlot
    });
    
    console.log(`[TunnelTravel] Player ${playerId} traveled ${sourceDungeon.id} → ${targetDungeon.id}`);
}

_findAvailableSlot(dungeon) {
    for (let i = 0; i < dungeon.players.length; i++) {
        if (dungeon.players[i].id === null) {
            return i;
        }
    }
    return null;
}
```

#### Step 1.3: Helper Methods (1 hour)

```javascript
// Broadcast to all players in a dungeon
_broadcast(dungeon, message, excludePlayerId = null) {
    for (const [pid, conn] of this.connections.entries()) {
        if (conn.dungeonId === dungeon.id && pid !== excludePlayerId) {
            this._send(conn.ws, message);
        }
    }
}

// Get all connections in a dungeon
_getDungeonConnections(dungeonId) {
    const conns = [];
    for (const [pid, conn] of this.connections.entries()) {
        if (conn.dungeonId === dungeonId) {
            conns.push({ playerId: pid, conn });
        }
    }
    return conns;
}
```

---

### Phase 2: Client Integration (4 hours)

#### Step 2.1: Tunnel Sprite (1 hour)

Add tunnel portal sprite to dungeon rendering:

```javascript
// In MultiplayerApp.js or rendering layer
function renderTunnels(tunnels) {
    tunnels.forEach(tunnel => {
        if (!tunnel.active) return;
        
        // Draw portal sprite
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(
            tunnel.x * TILE_SIZE,
            tunnel.y * TILE_SIZE,
            TILE_SIZE,
            TILE_SIZE
        );
        
        // Draw indicator
        ctx.fillStyle = '#fff';
        ctx.font = '12px monospace';
        ctx.fillText('◈', tunnel.x * TILE_SIZE + 4, tunnel.y * TILE_SIZE + 16);
    });
}
```

#### Step 2.2: Tunnel Interaction (2 hours)

Add client-side tunnel detection:

```javascript
// In input handler
function checkTunnelInteraction(player, tunnels) {
    const tunnel = tunnels.find(t => 
        t.x === Math.floor(player.x) &&
        t.y === Math.floor(player.y) &&
        t.active
    );
    
    if (tunnel && player.pressedKeys['Enter']) {
        // Send tunnel_enter message
        sendMessage({
            type: 'tunnel_enter',
            tunnelIndex: tunnels.indexOf(tunnel)
        });
    }
}
```

Handle tunnel messages:

```javascript
// In message handler
case 'tunnel_complete':
    handleTunnelComplete(msg);
    break;

case 'player_left_via_tunnel':
    handlePlayerLeftTunnel(msg);
    break;

case 'player_arrived_via_tunnel':
    handlePlayerArrivedTunnel(msg);
    break;

function handleTunnelComplete(msg) {
    console.log('Traveled to dungeon:', msg.targetDungeonId);
    
    // Reinitialize with new dungeon state
    // (Will receive dungeon_init message)
}

function handlePlayerLeftTunnel(msg) {
    console.log('Player left via tunnel:', msg.playerId);
    // Remove player entity from local state
    removePlayer(msg.playerId);
}

function handlePlayerArrivedTunnel(msg) {
    console.log('Player arrived via tunnel:', msg.playerId);
    // Add player entity (will receive position in next state update)
}
```

#### Step 2.3: UI Feedback (1 hour)

Add tunnel UI indicators:

```javascript
// Show tunnel hint when player near
function updateTunnelHints(player, tunnels) {
    tunnels.forEach(tunnel => {
        const dist = Math.abs(player.x - tunnel.x) + Math.abs(player.y - tunnel.y);
        
        if (dist < 3) {
            showHint(`Press ENTER to use tunnel → Dungeon ${tunnel.targetDungeonId.substr(0, 4)}`);
        }
    });
}
```

---

### Phase 3: Testing & Polish (2 hours)

#### Test Scenario 1: Two Dungeons
1. Create dungeon A (host)
2. Create dungeon B (host)
3. Tunnels auto-connect A ↔ B
4. Player in A enters tunnel → appears in B
5. Player in B enters tunnel → returns to A

#### Test Scenario 2: Five Dungeons (Ring)
1. Create 5 dungeons
2. Ring topology: D1↔D2↔D3↔D4↔D5↔D1
3. Players can traverse the ring
4. Test concurrent tunnel usage

#### Polish Items:
- Tunnel cooldown visual feedback
- Smooth transition effects
- Error messages for failed tunnels
- Minimap showing dungeon connections

---

## Message Protocol Summary

### Client → Server
- `tunnel_enter` - Request to use tunnel

### Server → Client
- `tunnel_complete` - Tunnel travel successful
- `tunnel_error` - Tunnel travel failed
- `player_left_via_tunnel` - Another player left
- `player_arrived_via_tunnel` - Another player arrived

### Server → Server (Internal)
- State extraction/restoration
- Dungeon cleanup when empty

---

## Performance Considerations

### Memory
- Each dungeon: ~50KB
- 10 dungeons: ~500KB
- 100 dungeons: ~5MB
- **Acceptable** for MVP

### CPU
- Tunnel check per frame: O(1)
- Graph lookups: O(1) with Map
- Player transfer: O(n) where n = players in dungeon
- **Acceptable** for MVP

### Network
- Tunnel travel: 3 messages (request, complete, broadcast)
- Minimal overhead
- **Acceptable** for MVP

---

## Risks & Mitigations

### Risk: Player stuck between dungeons
**Mitigation:** Transaction-like transfer (rollback if target fails)

### Risk: Tunnel spam
**Mitigation:** 3-second cooldown per tunnel per player

### Risk: Desync during transfer
**Mitigation:** Client freezes during tunnel travel, waits for confirmation

### Risk: Full target dungeon
**Mitigation:** Return error, player stays in source

---

## Success Criteria

✅ Player can move from dungeon A to dungeon B via tunnel  
✅ Player state (score, lives) preserved across transfer  
✅ Other players see player leave/arrive  
✅ No crashes or desyncs  
✅ Cooldowns work  
✅ Full dungeons reject transfers gracefully

---

## Next Steps

1. Implement DungeonGraph class
2. Add tunnel system to DungeonInstance
3. Implement tunnel_enter message handler
4. Add client tunnel rendering
5. Add client tunnel interaction
6. Test with 2 dungeons
7. Test with 5 dungeons
8. Polish and document

**Total Estimated Time:** 10-12 hours for complete MVP

---

**Status:** Ready to implement Phase 1
