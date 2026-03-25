# 🧪 Battle Royale MVP Test Guide

**Tag:** v1.0.0-refactor.20260323.25  
**Status:** Ready for testing

---

## Prerequisites

- Server with battle royale enabled
- 2-3 browser windows/tabs
- Console access for debugging

---

## Test Scenario 1: Two Connected Dungeons

### Setup

1. **Start server with battle royale:**
```bash
cd /root/swow
BATTLE_ROYALE=true PORT=5001 node server-multiplayer.js
```

Expected output:
```
[GameServer] started at 20ms/tick
[GameServer] Battle Royale mode: ENABLED
```

2. **Open first browser tab (Player 1):**
```
http://localhost:5001/
```

3. **Click "Create Private Pair"**

Expected console output (server):
```
[GameServer] player 1 connected
[DungeonGraph] Added dungeon 1
[GameServer] private pair host 1 code=ABC123
```

4. **Open second browser tab (Player 2):**
```
http://localhost:5001/?room=ABC123
```

Expected console output (server):
```
[GameServer] player 2 connected
[GameServer] private pair joined 1 + 2 code=ABC123
```

5. **Wait for game to start**

Both players should see the dungeon.

### Test: Create Second Dungeon

6. **Open third browser tab (Player 3):**
```
http://localhost:5001/
```

7. **Click "Create Private Pair"**

Expected console output (server):
```
[GameServer] player 3 connected
[DungeonGraph] Added dungeon 2
[GameServer] Linked dungeon 2 (right) ←→ 1 (left)
[GameServer] Graph: 2 dungeons, 1 connections
```

8. **Check tunnel status:**

Player 1 (in Dungeon 1):
- Should have `rightTunnelTarget = { dungeonId: '2', entrySide: 'left' }`

Player 3 (in Dungeon 2):
- Should have `leftTunnelTarget = { dungeonId: '1', entrySide: 'right' }`

---

## Test Scenario 2: Cross-Dungeon Travel

### Prerequisites
- Two dungeons created and connected
- At least one player in each dungeon

### Test Steps

1. **Player in Dungeon 1 moves to right wall**

Walk to the right side of the dungeon and exit through the tunnel.

2. **Expected behavior:**

**Server console:**
```
[Transfer] Player 1 from 1 → 2 (left)
[Transfer] SUCCESS: Player 1 now in 2 (slot 0)
```

**Player 1 browser console:**
```
[Battle Royale] Traveling to dungeon 2
```

**Player 1 screen:**
- Screen transitions
- Player appears at left entrance of Dungeon 2
- Score preserved
- Lives preserved

**Player 3 (in Dungeon 2) notification:**
```
Player xxxx arrived from tunnel
```

3. **Verify state preservation:**

Check that Player 1's score and lives remained the same after transfer.

---

## Test Scenario 3: Three Dungeon Ring

### Setup

1. Create three dungeons (repeat Scenario 1 setup 3 times)

Expected connections:
```
Dungeon 1 ←→ Dungeon 2 ←→ Dungeon 3 ←→ Dungeon 1
```

2. **Travel around the ring:**

- Player in D1 → exits right → arrives at D2 (left entrance)
- Player in D2 → exits right → arrives at D3 (left entrance)
- Player in D3 → exits right → arrives at D1 (left entrance)

3. **Verify circular topology:**

Player should be able to travel in a complete circle and return to original dungeon.

---

## Test Scenario 4: Full Dungeon Rejection

### Setup

1. Create Dungeon A with 2 players (full)
2. Create Dungeon B with 1 player
3. Connect A ←→ B

### Test

Player in B tries to enter tunnel to A.

**Expected:**
- Transfer fails (A is full)
- Player stays in B
- Console shows: `[Transfer] Target dungeon A is full`
- No crash or desync

---

## Server Console Checks

### On Dungeon Creation

```
[GameServer] player X connected
[DungeonGraph] Added dungeon X
[GameServer] Linked dungeon X (side) ←→ Y (entrySide)
[GameServer] Graph: N dungeons, M connections
```

### On Transfer

```
[Transfer] Player X from A → B (left)
[Transfer] SUCCESS: Player X now in B (slot 0)
```

### On Dungeon Destruction

```
[GameServer] dungeon X destroyed
[DungeonGraph] Removed dungeon X
```

---

## Client Console Checks

### On Transfer

```
[Battle Royale] Player left via tunnel: X → Y
[Battle Royale] Player arrived via tunnel: X at left entrance
```

### On Receiving Init

```
handleInit: { playerId: 'X', playerNum: 0, dungeonId: 'Y' }
```

---

## Browser Network Tab

### Messages to watch for:

**Server → Client:**
```json
{
  "type": "player_left_via_tunnel",
  "playerId": "1",
  "targetDungeonId": "2"
}
```

```json
{
  "type": "player_arrived_via_tunnel",
  "playerId": "1",
  "playerSlot": 0,
  "entrySide": "left"
}
```

---

## Success Criteria

### ✅ Must Pass

1. **Two dungeons connect automatically**
   - Server creates bidirectional link
   - Both dungeons have tunnel targets set

2. **Player can travel between dungeons**
   - Exits through tunnel
   - Appears in target dungeon
   - No crashes

3. **State preserved**
   - Score unchanged
   - Lives unchanged
   - Status unchanged

4. **Broadcasts work**
   - Source dungeon sees player leave
   - Target dungeon sees player arrive
   - Notifications appear

5. **Ring topology works**
   - 3+ dungeons form circular connections
   - Can travel full circle
   - Returns to original dungeon

6. **Full dungeon rejection**
   - Transfer fails gracefully
   - Player stays in source
   - No crash or hang

### ✅ Nice to Have

- Smooth transition animations
- Audio feedback on tunnel travel
- Visual indicator of tunnel portals
- HUD shows dungeon ID/name

---

## Known Limitations (MVP)

- Max 2 players per dungeon (by design)
- No visual tunnel portals yet (uses wall exits)
- No minimap showing connections
- No cooldown visualization
- Notifications are basic (no fancy UI)

---

## Debugging Tips

### Enable detailed logging:

**Server:**
```bash
DEBUG=* BATTLE_ROYALE=true PORT=5001 node server-multiplayer.js
```

**Client console:**
```javascript
// Watch all messages
window._debugMessages = true;

// Check dungeon graph
// (Not exposed to client, check server console)
```

### Common Issues:

**Issue:** Dungeons not connecting
- Check: `BATTLE_ROYALE=true` env var set
- Check: Server console shows "Battle Royale mode: ENABLED"

**Issue:** Transfer fails silently
- Check: Target dungeon exists
- Check: Target dungeon has available slot
- Check: Server console for error messages

**Issue:** Player stuck between dungeons
- Check: Server sent `init` message
- Check: Client received new `dungeonId`
- Workaround: Refresh browser

---

## Performance Testing

### Load Test: 5 Dungeons, 10 Players

1. Create 5 dungeons
2. Add 2 players to each
3. Have players travel between dungeons simultaneously
4. Monitor:
   - Server CPU usage
   - Memory consumption
   - Message latency
   - Frame rate

**Expected:**
- CPU: <50%
- Memory: <200MB
- Latency: <100ms
- FPS: 50 (server tick rate)

---

## Next Steps After Testing

### If Tests Pass ✅

1. Document findings
2. Tag as v1.0.0-battleroyal-mvp
3. Add visual polish (portals, animations)
4. Add tunnel cooldowns
5. Add minimap/dungeon graph UI

### If Tests Fail ❌

1. Document failure mode
2. Debug with server logs
3. Fix issues
4. Re-test
5. Iterate

---

## Test Checklist

- [ ] Server starts with BATTLE_ROYALE=true
- [ ] Two dungeons connect automatically
- [ ] Player can travel Dungeon A → B
- [ ] State preserved after travel
- [ ] Player can travel Dungeon B → A (return)
- [ ] Three dungeons form ring topology
- [ ] Can complete full circle (D1 → D2 → D3 → D1)
- [ ] Full dungeon rejects transfer gracefully
- [ ] Server console shows correct logs
- [ ] Client notifications appear
- [ ] No crashes or hangs
- [ ] Performance acceptable (5 dungeons, 10 players)

---

**Ready to test!** 🧪
