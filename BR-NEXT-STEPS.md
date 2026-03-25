# Battle Royale: Next Implementation Steps

**Date:** 2026-03-24  
**Status:** Bot System Complete — Ready for BR Mode Implementation  
**Branch:** `copilot/modular-multiplayer-refactor`

---

## ✅ What's Complete

### Bot Player System (Tag TBD)
- ✅ **BotPlayer.js** — Random AI with movement + shooting
- ✅ **GameServer bot management** — spawn/remove/check methods
- ✅ **Bot inputs in tick loop** — Bots play automatically
- ✅ **Bot lifecycle** — Can be replaced by real players

**Files Modified:**
- `frontend/game/multiplayer/server/BotPlayer.js` (NEW - 68 lines)
- `frontend/game/multiplayer/server/GameServer.js` (+80 lines)

**Bot Capabilities:**
```javascript
// Spawn bot in dungeon slot
const bot = gameServer.spawnBot('dungeon-abc', 0);

// Bot generates input every tick
bot.generateInput(); // → { up, down, left, right, shoot }

// Remove bot when real player joins
gameServer.removeBot(bot.id);

// Check if slot has bot
gameServer.isBotInSlot('dungeon-abc', 0); // → boolean
```

---

## 🎯 What's Next: BR Mode Implementation

### Remaining Work (3-4 hours total)

#### 1. **Server Queue System** (1 hour)
Create queue management classes for matchmaking.

**Files to Create:**
- `frontend/game/multiplayer/server/EndlessBRQueue.js`
- `frontend/game/multiplayer/server/SitNGoQueue.js`
- `frontend/game/multiplayer/server/TeamBRQueue.js`

**Each Queue Should:**
- Track waiting players
- Handle timeouts
- Fill with bots when needed
- Create dungeon when ready
- Connect to DungeonGraph

**Example Structure:**
```javascript
class EndlessBRQueue {
    constructor(gameServer) {
        this.gameServer = gameServer;
        this.waitingPlayers = new Map(); // playerId → playerInfo
    }
    
    addPlayer(playerId, playerInfo) {
        // Add to queue
        // Immediately create dungeon + spawn bot
        // Connect to graph
    }
    
    removePlayer(playerId) {
        // Remove from queue
    }
}
```

#### 2. **Message Handlers** (30 min)
Add BR-specific message handlers to GameServer.

**In GameServer.js, add handlers for:**
```javascript
case 'join_endless_br':
    this.endlessBRQueue.addPlayer(playerId, playerInfo);
    break;

case 'join_sitngo_br':
    this.sitNGoQueue.addPlayer(playerId, playerInfo);
    break;

case 'join_team_br':
    this.teamBRQueue.addPlayer(playerId, { ...playerInfo, team });
    break;
```

**In constructor, initialize queues:**
```javascript
this.endlessBRQueue = new EndlessBRQueue(this);
this.sitNGoQueue = new SitNGoQueue(this);
this.teamBRQueue = new TeamBRQueue(this);
```

#### 3. **Client Integration** (1 hour)
Update client to send correct messages and handle responses.

**Files to Modify:**
- `frontend/game/multiplayer/client/MultiplayerLaunchController.js`
  - Change BR button handlers from `create_private_pair` to `join_endless_br`, etc.
  
- `frontend/game/multiplayer/client/multiplayerEvents.js`
  - Add BR event types: `BR_QUEUE_JOINED`, `BR_GAME_STARTING`, etc.
  
- `frontend/game/multiplayer/client/MultiplayerMessageController.js`
  - Add handlers for BR queue status updates

**Button Handler Example:**
```javascript
this.btnSolo.onclick = async () => {
    console.log('[BR] Joining Endless BR...');
    this.app.sendMessage({ 
        type: 'join_endless_br',
        playerName: playerName 
    });
    // Show "Joining game..." UI
};
```

#### 4. **Testing & Polish** (1 hour)
Test all three modes end-to-end.

**Test Cases:**
1. **Endless BR**
   - Single player joins → gets dungeon with bot
   - Second player joins → dungeons connect
   - Travel between dungeons works
   
2. **Sit-n-Go BR**
   - Queue shows "Waiting for players (1/8)"
   - Queue fills with bots after timeout
   - Game starts when ready
   
3. **Team BR**
   - Players auto-assigned to teams
   - Team balance maintained (Gold vs Blue)
   - Team connections work correctly

**Performance:**
- Test 10+ concurrent dungeons
- Test 20+ bots active
- Monitor server CPU/memory

---

## 📋 Implementation Checklist

### Phase 1: Queue System (SQL: br-server-queues)
- [ ] Create `EndlessBRQueue.js`
  - [ ] Instant join logic
  - [ ] Bot spawn on dungeon create
  - [ ] Graph connection
  
- [ ] Create `SitNGoQueue.js`
  - [ ] Player queue management
  - [ ] 4-8 player target
  - [ ] Bot filling after 30s timeout
  - [ ] Game start countdown
  
- [ ] Create `TeamBRQueue.js`
  - [ ] Team balancing (Gold/Blue)
  - [ ] Team-aware graph connections
  - [ ] Bot filling per team

### Phase 2: Server Integration (SQL: br-endless-mode, br-sitngo-mode, br-team-mode)
- [ ] Add queue instances to GameServer constructor
- [ ] Add message handlers (`join_endless_br`, etc.)
- [ ] Add cleanup on disconnect (remove from queue)
- [ ] Test server logic in isolation

### Phase 3: Client Integration (SQL: br-client-integration)
- [ ] Update MultiplayerLaunchController button handlers
- [ ] Add BR event types to multiplayerEvents.js
- [ ] Add message handlers to MultiplayerMessageController
- [ ] Add queue status UI (optional but nice)

### Phase 4: Testing (SQL: br-testing)
- [ ] Test Endless BR (1 player + bot)
- [ ] Test Endless BR (2+ players connected)
- [ ] Test Sit-n-Go (queue → fill → start)
- [ ] Test Team BR (balancing + connections)
- [ ] Test bot behavior (movement, shooting)
- [ ] Test performance (10+ dungeons)

---

## 🔑 Key Technical Details

### Feature Flag
Battle Royale is controlled by env var:
```bash
BATTLE_ROYALE=true PORT=5001 node server-multiplayer.js
```

### DungeonGraph (Already Built)
Located in `GameServer.js`:
```javascript
// Connect dungeons in ring
this.dungeonGraph.addDungeon(dungeonId);

// Transfer player between dungeons
this.transferPlayerToDungeon(playerId, targetDungeonId);
```

### Bot Integration Points
```javascript
// In queue logic:
const bot = this.gameServer.spawnBot(dungeonId, 1);

// In tick loop (already done):
for (const [botId, bot] of this.bots) {
    inputsMap[botId] = bot.generateInput();
}

// On player join (replace bot):
if (this.gameServer.isBotInSlot(dungeonId, slot)) {
    this.gameServer.removeBot(existingBotId);
}
```

### Message Flow
```
Client                    Server                    Queue
  |                         |                         |
  |-- join_endless_br ----->|                         |
  |                         |-- addPlayer() --------->|
  |                         |<-- dungeonId -----------|
  |                         |-- spawnBot() -----------|
  |                         |-- connect graph --------|
  |<---- room_joined -------|                         |
  |<---- game_starting -----|                         |
  |<---- init --------------|                         |
```

---

## 🚀 Quick Start for Other Session

### Step 1: Review Bot System
```bash
# Check bot implementation
cat frontend/game/multiplayer/server/BotPlayer.js

# Check GameServer integration
grep -A 20 "Bot Management" frontend/game/multiplayer/server/GameServer.js
```

### Step 2: Start with Endless BR (Simplest)
Endless BR is the easiest to implement — instant join, no queue management.

```javascript
// EndlessBRQueue.js (minimal version)
class EndlessBRQueue {
    constructor(gameServer) {
        this.gameServer = gameServer;
    }
    
    addPlayer(playerId, playerInfo) {
        // 1. Create dungeon
        const dungeon = this.gameServer._createDungeon();
        
        // 2. Add player to slot 0
        this.gameServer._assignPlayerToDungeon(playerId, dungeon.id, 0);
        
        // 3. Spawn bot in slot 1
        this.gameServer.spawnBot(dungeon.id, 1);
        
        // 4. Connect to graph
        this.gameServer.dungeonGraph.addDungeon(dungeon.id);
        
        // 5. Send confirmation to player
        const conn = this.gameServer.connections.get(playerId);
        this.gameServer._send(conn.ws, {
            type: 'room_joined',
            roomCode: dungeon.id,
            playerId: playerId,
            playerNum: 0,
            dungeonId: dungeon.id
        });
        
        return dungeon.id;
    }
}
```

### Step 3: Test Locally
```bash
# Start server with BR enabled
cd /root/swow
BATTLE_ROYALE=true PORT=5001 node server-multiplayer.js

# In browser console:
# Open https://wizardofwor.duckdns.org/mp?mode=endless
# Should auto-click Endless BR button
# Check console for "Joining game..." and connection
```

### Step 4: Iterate
Once Endless BR works:
1. Add Sit-n-Go (with queue management)
2. Add Team BR (with team balancing)
3. Polish UI and error handling

---

## 📊 SQL Tracking

Current status:
```sql
SELECT id, title, status FROM todos 
WHERE id LIKE 'br-%' 
ORDER BY status, id;
```

Update status as you work:
```sql
-- Mark in progress
UPDATE todos SET status = 'in_progress' WHERE id = 'br-server-queues';

-- Mark complete
UPDATE todos SET status = 'done' WHERE id = 'br-server-queues';
```

---

## 📚 Reference Documentation

- **DUNGEON-BATTLEROYAL-ARCHITECTURE.md** — Technical design
- **BATTLE-ROYALE-TEST-GUIDE.md** — Test scenarios
- **BR-IMPLEMENTATION-PLAN.md** — Original 8-10 hour plan
- **LANDING-PAGE-BR-MODES.md** — UI requirements

---

## 💡 Tips for Implementation

### DRY Principle
All three queues share common logic:
- Player management
- Dungeon creation
- Graph connection
- Cleanup on disconnect

**Consider:** Create `BaseBRQueue` class with shared methods.

### Error Handling
Handle these cases:
- Player disconnects while in queue
- Dungeon full when trying to join
- Bot spawn fails
- Graph connection fails

### Performance
- Reuse bot instances when possible
- Clean up bots when dungeons destroyed
- Limit max concurrent dungeons (e.g., 50)

### Testing Strategy
Test in this order:
1. Bot spawns correctly
2. Single dungeon with player + bot
3. Two dungeons connect via graph
4. Queue management (Sit-n-Go)
5. Team balancing (Team BR)

---

## ✅ Success Criteria

**Endless BR Working:**
- [ ] Player clicks button → joins immediately
- [ ] Gets own dungeon with 1 bot
- [ ] Can travel to other dungeons
- [ ] Bot moves and shoots

**Sit-n-Go Working:**
- [ ] Queue shows player count
- [ ] Waits for 4-8 players OR 30s timeout
- [ ] Fills remaining slots with bots
- [ ] Game starts with connected dungeons

**Team BR Working:**
- [ ] Players auto-assigned to teams
- [ ] Teams balanced (Gold vs Blue)
- [ ] Team-aware connections
- [ ] Team score aggregation

---

## 🎮 Once Complete

After all BR modes work:
1. **Tag release:** `v1.0.0-refactor.20260324.30`
2. **Update plan.md** with completion status
3. **Mark SQL todos done**
4. **Test end-to-end** with multiple players
5. **Celebrate!** 🎉

The game will be truly unique — a retro arcade game with modern multiplayer Battle Royale mechanics!
