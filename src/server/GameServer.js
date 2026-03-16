/**
 * GameServer — WebSocket server that manages all active DungeonInstances.
 *
 * Responsibilities:
 *   - Accept player WebSocket connections and route them to dungeons.
 *   - Run the global game loop (50 FPS) and broadcast serialized state each tick.
 *   - Coordinate cross-dungeon player transfers through tunnel links.
 *   - Clean up destroyed dungeons and unlink their tunnel references.
 */
'use strict';

const WebSocket = require('ws');
const { DungeonInstance, STATE } = require('./DungeonInstance');
const { ServerPlayer } = require('./ServerPlayer');

const SCAN_FPS = 50;
const TICK_MS = 1000 / SCAN_FPS;

let nextPlayerId = 1;

class GameServer {
    /**
     * Creates the WebSocket server and starts the game loop.
     * @param {http.Server} httpServer  The underlying HTTP server to attach the WebSocket server to.
     */
    constructor(httpServer) {
        this.wss = new WebSocket.Server({ server: httpServer });
        
        // Error handler for WebSocket server
        this.wss.on('error', (err) => {
            console.error('[GameServer] WebSocket server error:', err.message);
        });
        
        // Map: playerId → { ws, player, dungeonId, inputs, sessionId }
        this.connections = new Map();
        // Map: dungeonId → DungeonInstance
        this.dungeons = new Map();
        // Pending solo player waiting to be paired (for 2-player explicit start)
        this.pendingSoloPlayer = null;

        this.wss.on('connection', (ws) => this._onConnect(ws));
        this._loop = setInterval(() => this._tick(), TICK_MS);
        console.log(`[GameServer] started at ${TICK_MS}ms/tick`);
    }

    // ─── Connection Lifecycle ─────────────────────────────────────────────────

    _onConnect(ws) {
        try {
            const playerId = String(nextPlayerId++);
            const conn = { ws, player: null, dungeonId: null, inputs: {}, sessionId: null };
            this.connections.set(playerId, conn);

            ws.on('message', (msg) => {
                try { this._onMessage(playerId, JSON.parse(msg)); } catch (e) { console.error(`[GameServer] Message error for player ${playerId}:`, e.message); }
            });
            ws.on('close', () => this._onDisconnect(playerId));
            ws.on('error', (err) => {
                console.error(`[GameServer] WebSocket error for player ${playerId}:`, err.message);
                ws.terminate();
            });

            // Send player their assigned id so they know who they are
            this._send(ws, { type: 'connected', playerId });
            console.log(`[GameServer] player ${playerId} connected`);
        } catch (e) {
            console.error('[GameServer] Error in _onConnect:', e.message, e.stack);
            ws.terminate();
        }
    }

    _onDisconnect(playerId) {
        const conn = this.connections.get(playerId);
        if (!conn) return;
        if (conn.player) {
            const dungeon = this.dungeons.get(conn.dungeonId);
            if (dungeon) {
                dungeon.removePlayer(conn.player);
                this._checkDungeonEmpty(dungeon);
            }
        }
        this.connections.delete(playerId);
        console.log(`[GameServer] player ${playerId} disconnected`);
    }

    _onMessage(playerId, msg) {
        const conn = this.connections.get(playerId);
        if (!conn) return;

        switch (msg.type) {
            case 'join_solo':
                this._joinSolo(playerId, conn);
                break;
            case 'join_pair':
                this._joinPair(playerId, conn);
                break;
            case 'input':
                conn.inputs = msg.keys || {};
                break;
        }
    }

    // ─── Join Modes ───────────────────────────────────────────────────────────

    _joinSolo(playerId, conn) {
        // Each solo player is alone in their own dungeon, always occupying slot 0.
        const dungeon = this._createDungeon();
        const player = new ServerPlayer(0, dungeon, playerId, dungeon.id);
        player.homeSlot = 0;
        conn.player = player;
        conn.dungeonId = dungeon.id;
        conn.sessionId = playerId;
        dungeon.addPlayer(player);

        // Link to existing dungeon if one exists
        this._linkToExistingDungeon(dungeon);

        dungeon.startGame();
        this._sendInit(conn, dungeon);
        console.log(`[GameServer] solo player ${playerId} → dungeon ${dungeon.id}`);
    }

    _joinPair(playerId, conn) {
        if (this.pendingSoloPlayer) {
            // Pair with waiting player
            const { playerId: p1Id, conn: p1Conn, dungeon: sharedDungeon } = this.pendingSoloPlayer;
            this.pendingSoloPlayer = null;

            const player2 = new ServerPlayer(1, sharedDungeon, playerId, sharedDungeon.id);
            player2.homeSlot = 1;
            conn.player = player2;
            conn.dungeonId = sharedDungeon.id;
            conn.sessionId = p1Conn.sessionId;
            sharedDungeon.addPlayer(player2);

            sharedDungeon.startGame();
            this._sendInit(p1Conn, sharedDungeon);
            this._sendInit(conn, sharedDungeon);
            console.log(`[GameServer] paired ${p1Id} + ${playerId} → dungeon ${sharedDungeon.id}`);
        } else {
            // Create dungeon and wait for partner
            const dungeon = this._createDungeon();
            const player = new ServerPlayer(0, dungeon, playerId, dungeon.id);
            player.homeSlot = 0;
            conn.player = player;
            conn.dungeonId = dungeon.id;
            conn.sessionId = playerId;
            dungeon.addPlayer(player);
            this.pendingSoloPlayer = { playerId, conn, dungeon };

            this._send(conn.ws, { type: 'waiting_for_partner' });
            console.log(`[GameServer] player ${playerId} waiting for pair partner`);
        }
    }

    // ─── Dungeon Management ───────────────────────────────────────────────────

    _createDungeon() {
        const d = new DungeonInstance(this);
        this.dungeons.set(d.id, d);
        return d;
    }

    /**
     * Finds an available player slot (0 or 1) in `dungeon` for the given player.
     * Prefers the player's current num; falls back to the other slot.
     * Returns -1 if both slots are occupied (transfer should be blocked).
     */
    _findFreeSlot(dungeon, player) {
        if (dungeon.players[player.num].id === null) return player.num;
        const other = 1 - player.num;
        if (dungeon.players[other].id === null) return other;
        return -1; // both slots occupied
    }

    _linkToExistingDungeon(newDungeon) {
        // Find any active dungeon with a free tunnel slot
        for (const [id, existing] of this.dungeons) {
            if (id === newDungeon.id) continue;
            if (existing.lifecycleState === STATE.DESTROYED) continue;

            // Link: newDungeon right tunnel ↔ existing left tunnel
            if (!existing.leftTunnelTarget && !newDungeon.rightTunnelTarget) {
                newDungeon.rightTunnelTarget = { dungeonId: existing.id, entrySide: 'left' };
                existing.leftTunnelTarget = { dungeonId: newDungeon.id, entrySide: 'right' };
                console.log(`[GameServer] linked dungeon ${newDungeon.id} (right) ↔ dungeon ${existing.id} (left)`);
                // Notify connected players of the link
                this._broadcastDungeonState(existing);
                return;
            }
            // Try other tunnel sides
            if (!existing.rightTunnelTarget && !newDungeon.leftTunnelTarget) {
                newDungeon.leftTunnelTarget = { dungeonId: existing.id, entrySide: 'right' };
                existing.rightTunnelTarget = { dungeonId: newDungeon.id, entrySide: 'left' };
                console.log(`[GameServer] linked dungeon ${newDungeon.id} (left) ↔ dungeon ${existing.id} (right)`);
                this._broadcastDungeonState(existing);
                return;
            }
        }
    }

    _checkDungeonEmpty(dungeon) {
        const hasRealPlayers = dungeon.players.some(p => p.id !== null);
        if (!hasRealPlayers && dungeon.lifecycleState !== STATE.DESTROYED) {
            dungeon.lifecycleState = STATE.EMPTY;
            dungeon.speedMultiplier = 1.8; // Apply fast mode when dungeon becomes empty
        }
    }

    // ─── Cross-dungeon Player Transfer ────────────────────────────────────────

    /**
     * Moves a player from one DungeonInstance to another via a tunnel link.
     * Falls back to a same-dungeon teleport if the target dungeon is gone.
     * @param {ServerPlayer} player
     * @param {DungeonInstance} fromDungeon
     * @param {string} toDungeonId
     * @param {'left'|'right'} entrySide  Which wall the player enters the target dungeon from.
     */
    transferPlayerToDungeon(player, fromDungeon, toDungeonId, entrySide) {
        const toDungeon = this.dungeons.get(toDungeonId);
        if (!toDungeon || toDungeon.lifecycleState === STATE.DESTROYED) {
            this._fallbackTunnelTeleport(player, entrySide);
            return;
        }

        // Find a free slot in the target dungeon; fall back to same-dungeon teleport if full
        const slot = this._findFreeSlot(toDungeon, player);
        if (slot === -1) {
            this._fallbackTunnelTeleport(player, entrySide);
            return;
        }

        // Save home slot before reassigning num for this dungeon's rendering slot
        if (player._homeSlot === undefined) player._homeSlot = player.homeSlot ?? player.num;
        player.num = slot;

        // Remove from current dungeon
        fromDungeon.removePlayer(player);
        if (!fromDungeon.afterWorluk()) fromDungeon.closeTeleport(13);
        
        // Also close the target dungeon's tunnels (prevent abuse on entry side)
        if (!toDungeon.afterWorluk()) toDungeon.closeTeleport(13);

        // Add to target dungeon
        player.engine = toDungeon;
        toDungeon.addPlayer(player);
        player.goToTunnelEntry(entrySide);

        // Update connection tracking
        for (const [, conn] of this.connections) {
            if (conn.player === player) {
                conn.dungeonId = toDungeon.id;
                this._sendInit(conn, toDungeon);
                break;
            }
        }
        console.log(`[GameServer] player ${player.id} transferred ${fromDungeon.id} → ${toDungeon.id} (entry: ${entrySide})`);
    }

    /**
     * Sends a player back to their home dungeon after dying in a foreign dungeon.
     * @param {ServerPlayer} player
     */
    respawnPlayerInHome(player) {
        const homeDungeon = this.dungeons.get(player.homeDungeonId);
        if (!homeDungeon || homeDungeon.lifecycleState === STATE.DESTROYED) return;

        // Update dungeon tracking
        const currentDungeon = [...this.dungeons.values()].find(d =>
            d.players.some(p => p === player)
        );
        if (currentDungeon) currentDungeon.removePlayer(player);

        // Restore original home slot before returning
        if (player._homeSlot !== undefined) {
            player.num = player._homeSlot;
            player._homeSlot = undefined;
        }

        player.engine = homeDungeon;
        homeDungeon.addPlayer(player);
        player.goToStartPosition();

        for (const [, conn] of this.connections) {
            if (conn.player === player) {
                conn.dungeonId = homeDungeon.id;
                this._sendInit(conn, homeDungeon);
                break;
            }
        }
    }

    /**
     * Called by a DungeonInstance when it has fully destroyed itself.
     * Unlinks tunnel references pointing to the destroyed dungeon and removes it from the registry.
     * For single-player battle royale, implements wrapping: leftmost dungeon's left tunnel
     * links to rightmost dungeon's right tunnel.
     * @param {string} dungeonId
     */
    onDungeonDestroyed(dungeonId) {
        const dungeon = this.dungeons.get(dungeonId);
        if (!dungeon) return;
        
        let leftNeighbor = null;  // dungeon that pointed right to this one
        let rightNeighbor = null; // dungeon that pointed left to this one
        
        // Find neighbors in the chain
        for (const [, d] of this.dungeons) {
            if (d.rightTunnelTarget && d.rightTunnelTarget.dungeonId === dungeonId) {
                leftNeighbor = d;
            }
            if (d.leftTunnelTarget && d.leftTunnelTarget.dungeonId === dungeonId) {
                rightNeighbor = d;
            }
        }
        
        // Unlink from all other dungeons
        for (const [, d] of this.dungeons) {
            if (d.leftTunnelTarget && d.leftTunnelTarget.dungeonId === dungeonId) d.leftTunnelTarget = null;
            if (d.rightTunnelTarget && d.rightTunnelTarget.dungeonId === dungeonId) d.rightTunnelTarget = null;
        }
        
        // Implement wrapping: if this was the only dungeon destroyed in a chain,
        // link neighbors to each other to maintain connectivity
        if (leftNeighbor && rightNeighbor) {
            leftNeighbor.rightTunnelTarget = { dungeonId: rightNeighbor.id, entrySide: 'left' };
            rightNeighbor.leftTunnelTarget = { dungeonId: leftNeighbor.id, entrySide: 'right' };
            console.log(`[GameServer] wrapped dungeons: ${leftNeighbor.id} (right) ↔ ${rightNeighbor.id} (left) after dungeon ${dungeonId} destroyed`);
        } else if (leftNeighbor && !rightNeighbor) {
            // This was the rightmost dungeon in the chain - link leftNeighbor's right to the leftmost dungeon
            let leftmostDungeon = null;
            for (const [, d] of this.dungeons) {
                if (d.id === leftNeighbor.id) continue;
                if (d.lifecycleState === STATE.DESTROYED) continue;
                // Find the leftmost dungeon (one with no left tunnel target or whose left target doesn't exist)
                let isLeftmost = true;
                if (d.leftTunnelTarget) {
                    const targetExists = this.dungeons.has(d.leftTunnelTarget.dungeonId);
                    if (targetExists && this.dungeons.get(d.leftTunnelTarget.dungeonId).lifecycleState !== STATE.DESTROYED) {
                        isLeftmost = false;
                    }
                }
                if (isLeftmost && (!leftmostDungeon || d.id < leftmostDungeon.id)) {
                    leftmostDungeon = d;
                }
            }
            if (leftmostDungeon) {
                leftNeighbor.rightTunnelTarget = { dungeonId: leftmostDungeon.id, entrySide: 'left' };
                leftmostDungeon.leftTunnelTarget = { dungeonId: leftNeighbor.id, entrySide: 'right' };
                console.log(`[GameServer] wrapped dungeons: ${leftNeighbor.id} (right) ↔ ${leftmostDungeon.id} (left) - wrapping to leftmost`);
            }
        } else if (rightNeighbor && !leftNeighbor) {
            // This was the leftmost dungeon in the chain - link rightNeighbor's left to the rightmost dungeon
            let rightmostDungeon = null;
            for (const [, d] of this.dungeons) {
                if (d.id === rightNeighbor.id) continue;
                if (d.lifecycleState === STATE.DESTROYED) continue;
                // Find the rightmost dungeon (one with no right tunnel target or whose right target doesn't exist)
                let isRightmost = true;
                if (d.rightTunnelTarget) {
                    const targetExists = this.dungeons.has(d.rightTunnelTarget.dungeonId);
                    if (targetExists && this.dungeons.get(d.rightTunnelTarget.dungeonId).lifecycleState !== STATE.DESTROYED) {
                        isRightmost = false;
                    }
                }
                if (isRightmost && (!rightmostDungeon || d.id > rightmostDungeon.id)) {
                    rightmostDungeon = d;
                }
            }
            if (rightmostDungeon) {
                rightNeighbor.leftTunnelTarget = { dungeonId: rightmostDungeon.id, entrySide: 'right' };
                rightmostDungeon.rightTunnelTarget = { dungeonId: rightNeighbor.id, entrySide: 'left' };
                console.log(`[GameServer] wrapped dungeons: ${rightNeighbor.id} (left) ↔ ${rightmostDungeon.id} (right) - wrapping to rightmost`);
            }
        }
        
        this.dungeons.delete(dungeonId);
        console.log(`[GameServer] dungeon ${dungeonId} destroyed`);
    }

    // ─── Game Loop ────────────────────────────────────────────────────────────

    _tick() {
        // Build inputs map: playerId → controls
        const inputsMap = {};
        for (const [playerId, conn] of this.connections) {
            if (conn.player) inputsMap[playerId] = conn.inputs;
        }

        // Tick all dungeons
        for (const [, dungeon] of this.dungeons) {
            dungeon.tick(inputsMap);
        }

        // Broadcast state to all connected players
        for (const [, conn] of this.connections) {
            if (!conn.player || !conn.dungeonId) continue;
            const dungeon = this.dungeons.get(conn.dungeonId);
            if (!dungeon) continue;
            this._broadcastToConn(conn, dungeon);
        }
    }

    _broadcastDungeonState(dungeon) {
        for (const [, conn] of this.connections) {
            if (conn.dungeonId === dungeon.id) {
                this._broadcastToConn(conn, dungeon);
            }
        }
    }

    _broadcastToConn(conn, dungeon) {
        const state = dungeon.serialize();
        state.sounds = dungeon.drainSounds();
        state.myPlayerId = conn.player ? conn.player.id : null;
        this._send(conn.ws, { type: 'state', state });
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    _sendInit(conn, dungeon) {
        this._send(conn.ws, {
            type: 'init',
            playerId: conn.player.id,
            playerNum: conn.player.num,
            dungeonId: dungeon.id,
            homeDungeonId: conn.player.homeDungeonId,
        });
    }

    _send(ws, data) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }

    _fallbackTunnelTeleport(player, entrySide) {
        player.status = 'alive';
        player.row = 3;
        if ('left' === entrySide) { player.col = 1; player.x = 34; player.d = 'right'; }
        else { player.col = 11; player.x = 274; player.d = 'left'; }
        player.y = 3 + 24 * (player.row - 1);
        player.bullet = false;
        player.frameCounters = { justShoot: 0, entering: 0, dead: 0 };
    }

    /** Stops the game loop and closes the WebSocket server. */
    stop() {
        clearInterval(this._loop);
        this.wss.close();
    }
}

module.exports = { GameServer };
