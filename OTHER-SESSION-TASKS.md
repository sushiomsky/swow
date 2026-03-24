# 🎮 Tasks for Other Session: Complete Battle Royale Modes

**Date:** 2026-03-24  
**Current Status:** Bot System Complete ✅  
**Branch:** `copilot/modular-multiplayer-refactor`

---

## 📋 TL;DR — What Needs to Be Done

Implement 3 Battle Royale matchmaking queues + client integration.

**Estimated Time:** 3-4 hours  
**Priority:** HIGH — Bot system is done, just need queue logic

---

## 🎯 Implementation Order

### 1. EndlessBRQueue (1 hour) — SIMPLEST, START HERE
- Player joins instantly
- Gets own dungeon with 1 bot
- Connect to dungeon graph
- No queue management needed

**File:** `frontend/game/multiplayer/server/EndlessBRQueue.js` (create new)

### 2. SitNGoQueue (1 hour)
- Queue management (wait for 4-8 players)
- 30s timeout → fill with bots
- Game start countdown
- Create ring of connected dungeons

**File:** `frontend/game/multiplayer/server/SitNGoQueue.js` (create new)

### 3. TeamBRQueue (1 hour)
- Auto-assign teams (Gold vs Blue)
- Balance teams
- Team-aware dungeon connections

**File:** `frontend/game/multiplayer/server/TeamBRQueue.js` (create new)

### 4. Client Integration (30 min)
- Update button handlers to send correct messages
- Add BR event types
- Add message handlers

**Files:** 
- `frontend/game/multiplayer/client/MultiplayerLaunchController.js` (modify)
- `frontend/game/multiplayer/client/multiplayerEvents.js` (modify)
- `frontend/game/multiplayer/client/MultiplayerMessageController.js` (modify)

### 5. Testing (30 min)
- Test each mode end-to-end
- Verify bots work
- Check dungeon connections
- Performance test (10+ dungeons)

---

## 📚 Complete Guide

**Read:** `/root/swow/BR-NEXT-STEPS.md`

This file contains:
- ✅ Complete implementation checklist
- ✅ Code examples and templates
- ✅ Message flow diagrams
- ✅ Testing strategy
- ✅ Success criteria
- ✅ SQL tracking queries

---

## 🚀 Quick Start

### Step 1: Review Bot System
```bash
cd /root/swow

# Check what's already done
cat frontend/game/multiplayer/server/BotPlayer.js

# Check integration points
grep -A 20 "Bot Management" frontend/game/multiplayer/server/GameServer.js
```

### Step 2: Start with Endless BR
Easiest mode — no queue management.

**Create:** `frontend/game/multiplayer/server/EndlessBRQueue.js`

```javascript
class EndlessBRQueue {
    constructor(gameServer) {
        this.gameServer = gameServer;
    }
    
    addPlayer(playerId, playerInfo) {
        // 1. Create dungeon
        // 2. Add player to slot 0
        // 3. Spawn bot in slot 1
        // 4. Connect to graph
        // 5. Send room_joined message
    }
}

module.exports = { EndlessBRQueue };
```

### Step 3: Add to GameServer
**File:** `frontend/game/multiplayer/server/GameServer.js`

```javascript
// In constructor:
const { EndlessBRQueue } = require('./EndlessBRQueue');
this.endlessBRQueue = new EndlessBRQueue(this);

// In message handler:
case 'join_endless_br':
    this.endlessBRQueue.addPlayer(playerId, { name: data.playerName });
    break;
```

### Step 4: Update Client
**File:** `frontend/game/multiplayer/client/MultiplayerLaunchController.js`

```javascript
// Change button handler from:
this.app.sendMessage({ type: 'create_private_pair', ... });

// To:
this.app.sendMessage({ type: 'join_endless_br', playerName: name });
```

### Step 5: Test
```bash
# Start server with BR enabled
BATTLE_ROYALE=true PORT=5001 node server-multiplayer.js

# Open in browser
# https://wizardofwor.duckdns.org/mp?mode=endless

# Should auto-join and see bot player
```

---

## 🔑 Key Integration Points

### Bot System (Already Done)
```javascript
// Spawn bot
const bot = this.gameServer.spawnBot(dungeonId, 1);

// Remove bot
this.gameServer.removeBot(bot.id);

// Check if bot in slot
this.gameServer.isBotInSlot(dungeonId, 1);
```

### DungeonGraph (Already Built)
```javascript
// Connect dungeon to ring
this.gameServer.dungeonGraph.addDungeon(dungeonId);

// Transfer player
this.gameServer.transferPlayerToDungeon(playerId, targetDungeonId);
```

### Feature Flag
```bash
# Enable BR mode
BATTLE_ROYALE=true PORT=5001 node server-multiplayer.js
```

---

## 📊 Track Progress with SQL

```sql
-- Check todos
SELECT id, title, status FROM todos 
WHERE id LIKE 'br-%' 
ORDER BY status, id;

-- Mark in progress
UPDATE todos SET status = 'in_progress' WHERE id = 'br-server-queues';

-- Mark complete
UPDATE todos SET status = 'done' WHERE id = 'br-endless-mode';
```

---

## ✅ Success Criteria

**Endless BR:**
- [ ] Click button → instant join
- [ ] Get dungeon with 1 bot
- [ ] Bot moves and shoots
- [ ] Can travel to other dungeons

**Sit-n-Go:**
- [ ] Queue shows player count
- [ ] Fills with bots after timeout
- [ ] Game starts properly

**Team BR:**
- [ ] Teams balanced
- [ ] Team connections work
- [ ] Score aggregates by team

---

## 🎯 What You Get After This

Once complete, the game will have:
- ✅ Full Battle Royale matchmaking
- ✅ Bot players to fill games
- ✅ Connected dungeon gameplay
- ✅ 3 unique BR modes
- ✅ Scalable to 50+ concurrent players

This makes it a **truly unique game** — retro arcade + modern BR mechanics!

---

## 💡 Need Help?

All details are in: **BR-NEXT-STEPS.md**

Includes:
- Step-by-step implementation guide
- Code templates for all 3 queues
- Message flow diagrams
- Error handling tips
- Performance considerations
- Testing strategies

**Just follow the guide and you'll have working BR modes in 3-4 hours!** 🚀
