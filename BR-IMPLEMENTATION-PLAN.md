# 🎮 Battle Royale Implementation Plan

**Goal:** Full BR modes with matchmaking, connected dungeons, and bot players

---

## Phase 1: Server Infrastructure ✅ DONE

Already complete from earlier work:
- ✅ DungeonGraph (ring topology)
- ✅ Cross-dungeon player transfers  
- ✅ State preservation
- ✅ Feature flag (BATTLE_ROYALE=true)

---

## Phase 2: Bot System 🤖

### Files to Create
1. `frontend/game/multiplayer/server/BotPlayer.js`
2. Update `GameServer.js` with bot management

### Bot Behavior
- Random movement (change every 20 ticks)
- Random shooting (20% chance)
- Auto-input generation every tick

### Bot Spawning Rules
- **Endless BR**: 1 bot per dungeon (slot 1)
- **Sit-n-Go**: Fill to 8 players total
- **Team BR**: Balance bots between teams

---

## Phase 3: Matchmaking Queues 🎯

### Queue Types

**1. EndlessBRQueue**
- Join instantly → Create dungeon → Connect to graph
- No waiting
- Always has bot partner

**2. SitNGoQueue**
- Wait for 4-8 players
- When full → Create all dungeons → Start game
- Fill with bots if needed

**3. TeamBRQueue**  
- Wait for 6-12 players
- Balance Gold vs Blue teams
- Create team-based connections

### Files to Create
1. `frontend/game/multiplayer/server/queues/EndlessBRQueue.js`
2. `frontend/game/multiplayer/server/queues/SitNGoQueue.js`
3. `frontend/game/multiplayer/server/queues/TeamBRQueue.js`

---

## Phase 4: Client Integration 💻

### New Messages

**Client → Server:**
```javascript
{ type: 'join_endless_br' }
{ type: 'join_sitngo_br' }
{ type: 'join_team_br', team: 'gold'|'blue'|'auto' }
```

**Server → Client:**
```javascript
{ type: 'br_queue_status', position, total, eta }
{ type: 'br_game_starting', dungeonId, mode }
{ type: 'br_player_eliminated', playerId }
{ type: 'br_winner', playerId, stats }
```

### UI Updates
- Queue status display
- Player count indicator
- "Finding players..." animation
- Game starting countdown

---

## Phase 5: Game Modes 🎲

### Endless BR

**Flow:**
1. Player clicks button
2. Instant dungeon creation
3. Bot spawns in slot 1
4. Connect to graph
5. Play immediately

**Win Condition:**
- N/A (endless mode)
- Track personal best score

### Sit-n-Go BR

**Flow:**
1. Player joins queue
2. Show queue position (e.g., "3/8 players")
3. When 4-8 players → Start countdown (5s)
4. Create dungeons for all players
5. Fill empty slots with bots
6. Connect in ring topology
7. Last player standing wins

**Win Condition:**
- Last player alive (or highest score at time limit)

### Team BR

**Flow:**
1. Player joins queue (gold/blue/auto)
2. Auto-balance teams
3. When 6-12 players → Start
4. Team dungeons connect within team
5. Cross-team tunnels at strategic points
6. Team with most surviving players wins

**Win Condition:**
- Team score aggregation
- Last team standing

---

## Implementation Order

### Step 1: Bot System (1-2 hours)
- [ ] Create BotPlayer.js
- [ ] Add bot management to GameServer
- [ ] Test bot spawning and input generation

### Step 2: Endless BR (1 hour)
- [ ] Create EndlessBRQueue.js
- [ ] Add join_endless_br handler
- [ ] Auto-spawn bots
- [ ] Test with real player + bot

### Step 3: Sit-n-Go BR (2 hours)
- [ ] Create SitNGoQueue.js
- [ ] Add queue management
- [ ] Implement countdown + game start
- [ ] Fill with bots if needed
- [ ] Test with 2-3 real players

### Step 4: Team BR (2 hours)
- [ ] Create TeamBRQueue.js
- [ ] Add team balancing logic
- [ ] Create team-based connections
- [ ] Test team scoring

### Step 5: Client Integration (2 hours)
- [ ] Add message handlers
- [ ] Update UI for queue status
- [ ] Add game mode indicators
- [ ] Test full E2E flow

### Step 6: Polish & Testing (1 hour)
- [ ] Add winner announcements
- [ ] Add statistics tracking
- [ ] Test all 3 modes thoroughly
- [ ] Fix any bugs

**Total Estimate: 8-10 hours**

---

## Configuration

```javascript
// GameServer.js config
const BR_CONFIG = {
    endless: {
        enabled: true,
        botsPerDungeon: 1,
        autoConnect: true
    },
    sitngo: {
        enabled: true,
        minPlayers: 4,
        maxPlayers: 8,
        fillWithBots: true,
        startDelay: 5000 // 5s countdown
    },
    team: {
        enabled: true,
        minPlayers: 6,
        maxPlayers: 12,
        teams: ['gold', 'blue'],
        autoBalance: true
    }
};
```

---

## Testing Matrix

| Mode | Real Players | Bots | Expected Behavior |
|------|-------------|------|-------------------|
| Endless | 1 | 1 | Instant start, bot in same dungeon |
| Endless | 3 | 3 | 3 connected dungeons, each with bot |
| Sit-n-Go | 2 | 6 | Queue waits, fills to 8, starts |
| Sit-n-Go | 8 | 0 | Queue fills, starts immediately |
| Team | 4 | 8 | 2 per team real, 4 per team bots |

---

## Success Criteria

### Endless BR
- ✅ Single-click from landing page to game
- ✅ Bot spawns immediately
- ✅ Can travel through tunnels
- ✅ Multiple players have connected dungeons

### Sit-n-Go BR
- ✅ Queue shows player count
- ✅ Fills to 8 players (real + bots)
- ✅ Countdown before start
- ✅ All dungeons connected
- ✅ Winner declared

### Team BR
- ✅ Teams auto-balance
- ✅ Team indicators visible
- ✅ Cross-team connections work
- ✅ Team scoring works
- ✅ Team winner declared

---

**Ready to implement!** 🚀
