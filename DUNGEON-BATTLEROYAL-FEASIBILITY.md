# 🎮 Connected Dungeons Battle Royale - Feasibility Analysis

**Date:** 2026-03-23  
**Current System:** Private 2-player rooms (simplified MP)  
**Target System:** Multi-dungeon battle royale with tunnels

---

## Current Architecture

### Server-Side
- **GameServer** - WebSocket server managing all connections
- **DungeonInstance** - Single dungeon with 2 player slots
- **ServerPlayer** - Player entity in a dungeon
- **Private Pair System** - Host creates room, guest joins via code

**Key Constraints:**
- Each dungeon is **isolated** (no cross-dungeon awareness)
- Each dungeon has **exactly 2 player slots** (0 and 1)
- Players are **locked to one dungeon** per session
- No concept of **dungeon graph** or **connections**

### Client-Side
- Single dungeon view
- Fixed 2-player multiplayer
- No tunnel/portal UI
- No cross-dungeon state

---

## Feasibility Assessment

### ✅ What Works Already

1. **Multiple concurrent dungeons**
   - Server already manages `Map<dungeonId, DungeonInstance>`
   - Can have N dungeons running simultaneously

2. **Player reassignment**
   - `conn.dungeonId` can be changed
   - `conn.player` can be reassigned
   - Infrastructure exists for player movement

3. **Message passing**
   - WebSocket connections stored in `connections` Map
   - Can send messages to any connected player
   - Real-time sync already working

4. **State lifecycle**
   - Dungeons have `ACTIVE`, `COLLAPSING`, `EMPTY`, `DESTROYED` states
   - Cleanup logic exists
   - Room management proven

### ⚠️ What Needs Work

1. **Dungeon player slots**
   - Current: Fixed 2 slots (0, 1)
   - Needed: Variable slots or dynamic player management
   - **Impact:** Medium - need to refactor player slot allocation

2. **Cross-dungeon awareness**
   - Current: Dungeons are isolated
   - Needed: Dungeons know about neighbors
   - **Impact:** High - core architecture change

3. **Tunnel system**
   - Current: No portal/tunnel concept
   - Needed: Portal entities, travel logic, cooldowns
   - **Impact:** High - new game mechanic

4. **Dungeon graph**
   - Current: No connections between dungeons
   - Needed: Graph structure tracking which dungeons connect
   - **Impact:** Medium - new data structure

5. **Player transfer protocol**
   - Current: Player joins dungeon once
   - Needed: Dynamic cross-dungeon travel
   - **Impact:** High - new message types, state sync

---

## Architecture Approaches

### Approach A: Minimal Changes (Recommended for MVP)

**Concept:** Keep dungeons mostly isolated, add minimal tunnel layer

**Changes:**
1. Add `tunnelLinks` map to track connections
2. Add `tunnel` message type for cross-dungeon travel
3. Allow player reassignment between dungeons
4. Add tunnel portal entities (visual only at first)

**Pros:**
- Minimal server changes
- Dungeons remain independent
- Easy to rollback
- Faster to implement

**Cons:**
- Not "true" graph architecture
- Tunnels are essentially "teleport to different room"
- Limited scalability

**Estimated Effort:** 4-8 hours

---

### Approach B: Full Graph Architecture

**Concept:** Redesign dungeons as nodes in a connected graph

**Changes:**
1. Create `DungeonGraph` class managing all connections
2. Refactor `DungeonInstance` to support N players
3. Add portal entities with proper game integration
4. Implement dynamic graph updates
5. Add cross-dungeon state sync

**Pros:**
- Scalable to 100+ dungeons
- True battle royale architecture
- Clean separation of concerns
- Future-proof

**Cons:**
- Major refactor (days of work)
- High risk of breaking existing MP
- Complex testing required
- Overkill for MVP

**Estimated Effort:** 2-4 days

---

## Recommended MVP Path

### Phase 1: Proof of Concept (4 hours)
**Goal:** Show 2 dungeons can connect via tunnel

1. **Server Changes:**
   - Add `connections` Map tracking dungeon links
   - Add `tunnel_travel` message handler
   - Allow player to change `dungeonId`
   - Broadcast player transitions

2. **Client Changes:**
   - Add tunnel portal sprite (static for now)
   - Add tunnel interaction logic
   - Handle dungeon transition (fade out/in)

3. **Test:**
   - Create 2 dungeons
   - Link them with tunnel
   - Player enters tunnel → appears in other dungeon

**Success Criteria:**
- Player can move between 2 dungeons
- Other players see transitions
- No crashes or desyncs

---

### Phase 2: Dynamic Graph (4 hours)
**Goal:** Support N-dungeon connections

1. **Add DungeonGraph:**
   ```javascript
   class DungeonGraph {
       constructor() {
           this.nodes = new Map(); // dungeonId -> { dungeon, links: [] }
       }
       
       connect(dungeonA, dungeonB) {
           // Bidirectional link
       }
       
       getNeighbors(dungeonId) {
           // Return connected dungeons
       }
   }
   ```

2. **Dynamic Linking:**
   - New dungeons auto-connect to existing ones
   - Max N connections per dungeon
   - Random or strategic linking

3. **Test:**
   - Create 5 dungeons
   - Each connects to 2 neighbors
   - Players can traverse the graph

---

### Phase 3: Polish (4 hours)
**Goal:** Add battle royale mechanics

1. **Collapse Tunnels:**
   - When dungeon collapses, tunnels open
   - Force evacuation to connected dungeons

2. **Tunnel Cooldowns:**
   - Prevent spam tunnel travel
   - 3-5 second cooldown per use

3. **Visual Polish:**
   - Tunnel portal animations
   - Transition effects
   - Map/minimap showing connections

---

## Technical Decisions

### 1. Player Slot Management

**Decision:** Keep fixed slots, reassign players dynamically

```javascript
// When player enters tunnel to dungeonB:
const targetDungeon = this.dungeons.get(targetDungeonId);
const availableSlot = targetDungeon.findAvailableSlot();

if (availableSlot !== null) {
    // Remove from source dungeon
    sourceDungeon.removePlayer(conn.player);
    
    // Create new player in target dungeon
    const newPlayer = new ServerPlayer(availableSlot, targetDungeon, playerId, targetDungeonId);
    targetDungeon.addPlayer(newPlayer);
    
    // Update connection
    conn.player = newPlayer;
    conn.dungeonId = targetDungeonId;
}
```

**Pros:** Minimal changes to DungeonInstance  
**Cons:** Player state must be preserved (position, score, items)

---

### 2. Tunnel Representation

**Decision:** Tunnels are special tile types at fixed rows

```javascript
// In DungeonInstance
this.tunnelRow = 3; // Row where tunnels appear
this.tunnelLinks = []; // Array of {dungeonId, position}

// Check if player at tunnel position
if (player.y === this.tunnelRow && player.x === tunnelX) {
    // Trigger tunnel travel
}
```

**Pros:** Fits original game mechanics  
**Cons:** Limited flexibility in tunnel placement

---

### 3. Graph Topology

**Decision:** Start with ring topology (each dungeon connects to 2 neighbors)

```
D1 ←→ D2 ←→ D3 ←→ D4 ←→ D5 ←→ D1
```

**Pros:** Simple, predictable, easy to test  
**Cons:** Not true "battle royale" feel (more like linked rooms)

**Future:** Random graph, hub-and-spoke, or dynamic based on player count

---

## Risk Analysis

### High Risk
1. **State Sync Complexity**
   - Player moving between dungeons must preserve state
   - Score, items, lives, position
   - **Mitigation:** Use player state transfer protocol

2. **Desync Issues**
   - Player in multiple dungeons simultaneously (race condition)
   - **Mitigation:** Lock player during tunnel travel

3. **Performance**
   - 50+ dungeons × 2 players = 100 player objects
   - **Mitigation:** Profile early, optimize if needed

### Medium Risk
1. **Gameplay Balance**
   - Tunnel spam
   - Griefing via camping tunnels
   - **Mitigation:** Cooldowns, one-way tunnels

2. **UX Confusion**
   - Players don't understand tunnels
   - **Mitigation:** Tutorial, clear visuals

### Low Risk
1. **Server Capacity**
   - Current server handles 2-player rooms fine
   - **Mitigation:** Test with 10-20 dungeons first

---

## MVP Scope (Recommended)

### In Scope ✅
- 2-5 connected dungeons
- Static ring topology
- Basic tunnel travel
- Player state preservation
- Collapse-triggered tunnels

### Out of Scope ❌
- Dynamic graph updates during gameplay
- More than 10 dungeons
- Advanced AI for tunnel usage
- Spectator mode
- Replay system
- Advanced analytics

---

## Implementation Order

1. **Server: Add tunnel travel message** (1 hour)
2. **Server: Player reassignment logic** (2 hours)
3. **Client: Tunnel portal sprite** (1 hour)
4. **Client: Tunnel interaction** (2 hours)
5. **Test: 2-dungeon MVP** (1 hour)
6. **Server: DungeonGraph class** (2 hours)
7. **Server: Dynamic linking** (2 hours)
8. **Test: 5-dungeon graph** (1 hour)
9. **Polish: Cooldowns** (1 hour)
10. **Polish: Collapse tunnels** (1 hour)

**Total:** ~14 hours for full MVP

---

## Conclusion

✅ **Feasible:** Yes, with Approach A (minimal changes)  
⏱️ **Effort:** 12-16 hours for working MVP  
🎯 **Recommendation:** Start with 2-dungeon proof of concept

**Next Steps:**
1. Implement server tunnel message handler
2. Add player reassignment logic
3. Build client tunnel interaction
4. Test with 2 dungeons
5. Expand to N dungeons

**Decision:** Proceed with Phase 1 (Proof of Concept) immediately.
