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
const SITNGO_MIN_PLAYERS = 2;
const SITNGO_MAX_PLAYERS = 8;

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
        // Private classic pair lobbies: code -> { hostConn, hostId, dungeon, createdAt }
        this.privatePairLobbies = new Map();
        // Sit-n-go queue entries: { playerId, conn }
        this.sitNGoQueue = [];
        // Team BR queue metadata
        this.teamCounter = 0;

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
        this.sitNGoQueue = this.sitNGoQueue.filter(entry => entry.playerId !== playerId);
        for (const [code, lobby] of this.privatePairLobbies.entries()) {
            if (lobby.hostId === playerId) {
                this.privatePairLobbies.delete(code);
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
                this._joinSolo(playerId, conn, 'endless_br');
                break;
            case 'join_sitngo':
                this._joinSitNGo(playerId, conn);
                break;
            case 'join_team_br':
                this._joinTeamBattleRoyale(playerId, conn);
                break;
            case 'join_pair':
                this._createPrivatePair(playerId, conn);
                break;
            case 'join_private_pair':
                this._joinPrivatePair(playerId, conn, msg.code);
                break;
            case 'input':
                conn.inputs = msg.keys || {};
                break;
        }
    }

    // ─── Join Modes ───────────────────────────────────────────────────────────

    _joinSolo(playerId, conn, mode = 'endless_br', team = null) {
        if (conn.player) return;
        // Each solo player is alone in their own dungeon, always occupying slot 0.
        const dungeon = this._createDungeon();
        dungeon.matchMode = mode;
        const player = new ServerPlayer(0, dungeon, playerId, dungeon.id);
        player.homeSlot = 0;
        player.team = team;
        conn.player = player;
        conn.dungeonId = dungeon.id;
        conn.sessionId = playerId;
        conn.mode = mode;
        conn.team = team;
        dungeon.addPlayer(player);

        // Link to existing dungeon according to mode pool.
        if (mode === 'endless_br' || mode === 'team_br') {
            this._linkToExistingDungeon(dungeon, mode);
        }

        dungeon.startGame();
        this._sendInit(conn, dungeon);
        console.log(`[GameServer] ${mode} player ${playerId} → dungeon ${dungeon.id}${team ? ` team ${team}` : ''}`);
    }

    _joinSitNGo(playerId, conn) {
        if (conn.player) return;
        this.sitNGoQueue.push({ playerId, conn });
        const queueSize = this.sitNGoQueue.length;
        this._send(conn.ws, { type: 'waiting_for_sitngo', queued: queueSize, minPlayers: SITNGO_MIN_PLAYERS });
        if (queueSize < SITNGO_MIN_PLAYERS) return;

        const entrants = this.sitNGoQueue.splice(0, SITNGO_MAX_PLAYERS);
        const lobbyId = `sitngo-${Date.now()}`;
        const created = [];
        for (const entry of entrants) {
            const dungeon = this._createDungeon();
            dungeon.matchMode = 'sitngo_br';
            dungeon.sitNGoLobbyId = lobbyId;
            const player = new ServerPlayer(0, dungeon, entry.playerId, dungeon.id);
            player.homeSlot = 0;
            entry.conn.player = player;
            entry.conn.dungeonId = dungeon.id;
            entry.conn.sessionId = entry.playerId;
            entry.conn.mode = 'sitngo_br';
            dungeon.addPlayer(player);
            dungeon.startGame();
            this._sendInit(entry.conn, dungeon);
            created.push(dungeon);
        }
        this._linkDungeonRing(created);
        console.log(`[GameServer] sit-n-go started (${created.length} players) lobby=${lobbyId}`);
    }

    _joinTeamBattleRoyale(playerId, conn) {
        const team = this.teamCounter % 2 === 0 ? 'gold' : 'blue';
        this.teamCounter++;
        this._joinSolo(playerId, conn, 'team_br', team);
    }

    _createPrivatePair(playerId, conn) {
        if (conn.player) return;
        const dungeon = this._createDungeon();
        dungeon.matchMode = 'classic_private_pair';
        const player = new ServerPlayer(0, dungeon, playerId, dungeon.id);
        player.homeSlot = 0;
        conn.player = player;
        conn.dungeonId = dungeon.id;
        conn.sessionId = playerId;
        conn.mode = 'classic_private_pair';
        dungeon.addPlayer(player);

        const code = this._generatePrivateCode();
        this.privatePairLobbies.set(code, { hostConn: conn, hostId: playerId, dungeon, createdAt: Date.now() });
        const joinUrl = `/multiplayer.html?pair=${encodeURIComponent(code)}`;
        this._send(conn.ws, { type: 'private_pair_created', code, joinUrl });
        this._send(conn.ws, { type: 'waiting_for_partner' });
        console.log(`[GameServer] private pair host ${playerId} code=${code}`);
    }

    _joinPrivatePair(playerId, conn, rawCode) {
        const code = (rawCode || '').toString().trim().toUpperCase();
        const lobby = this.privatePairLobbies.get(code);
        if (!lobby || lobby.hostId === playerId) {
            this._send(conn.ws, { type: 'join_error', message: 'Invalid or expired private link.' });
            return;
        }
        const sharedDungeon = lobby.dungeon;
        if (!sharedDungeon || sharedDungeon.lifecycleState === STATE.DESTROYED) {
            this.privatePairLobbies.delete(code);
            this._send(conn.ws, { type: 'join_error', message: 'Private session is no longer available.' });
            return;
        }
        if (sharedDungeon.players[1] && sharedDungeon.players[1].id !== null) {
            this.privatePairLobbies.delete(code);
            this._send(conn.ws, { type: 'join_error', message: 'Private session is already full.' });
            return;
        }
        const player2 = new ServerPlayer(1, sharedDungeon, playerId, sharedDungeon.id);
        player2.homeSlot = 1;
        conn.player = player2;
        conn.dungeonId = sharedDungeon.id;
        conn.sessionId = lobby.hostId;
        conn.mode = 'classic_private_pair';
        sharedDungeon.addPlayer(player2);

        sharedDungeon.startGame();
        this._sendInit(lobby.hostConn, sharedDungeon);
        this._sendInit(conn, sharedDungeon);
        this.privatePairLobbies.delete(code);
        console.log(`[GameServer] private pair joined ${lobby.hostId} + ${playerId} code=${code}`);
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
        const preferredSlots = [];
        if (dungeon.id === player.homeDungeonId && player.homeSlot !== undefined) {
            preferredSlots.push(player.homeSlot);
        }
        preferredSlots.push(player.num);
        preferredSlots.push(1 - player.num);

        const seen = new Set();
        for (const slot of preferredSlots) {
            if (slot !== 0 && slot !== 1) continue;
            if (seen.has(slot)) continue;
            seen.add(slot);
            if (dungeon.players[slot].id === null) return slot;
        }
        return -1; // both slots occupied
    }

    _linkToExistingDungeon(newDungeon, mode = 'endless_br') {
        // Find any active dungeon with a free tunnel slot
        for (const [id, existing] of this.dungeons) {
            if (id === newDungeon.id) continue;
            if (existing.lifecycleState === STATE.DESTROYED) continue;
            if ((existing.matchMode || 'endless_br') !== mode) continue;

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

    _linkDungeonRing(dungeons) {
        if (!dungeons || dungeons.length < 2) return;
        for (let i = 0; i < dungeons.length; i++) {
            const curr = dungeons[i];
            const next = dungeons[(i + 1) % dungeons.length];
            const prev = dungeons[(i - 1 + dungeons.length) % dungeons.length];
            curr.rightTunnelTarget = { dungeonId: next.id, entrySide: 'left' };
            curr.leftTunnelTarget = { dungeonId: prev.id, entrySide: 'right' };
            this._broadcastDungeonState(curr);
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

        const preferredHomeSlot = player.homeSlot ?? player._homeSlot ?? player.num;
        if (
            player.num !== preferredHomeSlot &&
            homeDungeon.players[preferredHomeSlot] &&
            homeDungeon.players[preferredHomeSlot].id === null
        ) {
            player.num = preferredHomeSlot;
        }
        player._homeSlot = undefined;

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
        const mode = dungeon.matchMode || 'endless_br';
        
        let leftNeighbor = null;  // dungeon that pointed right to this one
        let rightNeighbor = null; // dungeon that pointed left to this one
        
        // Find neighbors in the chain
        for (const [, d] of this.dungeons) {
            if ((d.matchMode || 'endless_br') !== mode) continue;
            if (d.rightTunnelTarget && d.rightTunnelTarget.dungeonId === dungeonId) {
                leftNeighbor = d;
            }
            if (d.leftTunnelTarget && d.leftTunnelTarget.dungeonId === dungeonId) {
                rightNeighbor = d;
            }
        }
        
        // Unlink from all other dungeons
        for (const [, d] of this.dungeons) {
            if ((d.matchMode || 'endless_br') !== mode) continue;
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
                if ((d.matchMode || 'endless_br') !== mode) continue;
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
                if ((d.matchMode || 'endless_br') !== mode) continue;
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

        // Tick all dungeons and serialize each dungeon state once.
        const serializedByDungeon = new Map();
        for (const [dungeonId, dungeon] of this.dungeons) {
            dungeon.tick(inputsMap);
            serializedByDungeon.set(dungeonId, this._prepareSerializedDungeonState(dungeon));
        }

        // Broadcast state to all connected players
        for (const [, conn] of this.connections) {
            if (!conn.player || !conn.dungeonId) continue;
            const serializedState = serializedByDungeon.get(conn.dungeonId);
            if (!serializedState) continue;
            this._sendSerializedState(conn, serializedState);
        }
    }

    _broadcastDungeonState(dungeon) {
        const serializedState = this._prepareSerializedDungeonState(dungeon);
        for (const [, conn] of this.connections) {
            if (conn.dungeonId === dungeon.id) {
                this._sendSerializedState(conn, serializedState);
            }
        }
    }

    _prepareSerializedDungeonState(dungeon) {
        const state = dungeon.serialize();
        state.sounds = dungeon.drainSounds();
        const serializedState = JSON.stringify(state);
        return serializedState.slice(0, -1);
    }

    _sendSerializedState(conn, serializedStateWithoutBrace) {
        const myPlayerId = conn.player ? conn.player.id : null;
        this._sendRaw(
            conn.ws,
            `{"type":"state","state":${serializedStateWithoutBrace},"myPlayerId":${JSON.stringify(myPlayerId)}}}`
        );
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    _sendInit(conn, dungeon) {
        this._send(conn.ws, {
            type: 'init',
            playerId: conn.player.id,
            playerNum: conn.player.num,
            dungeonId: dungeon.id,
            homeDungeonId: conn.player.homeDungeonId,
            mode: conn.mode || dungeon.matchMode || 'endless_br',
            team: conn.team || null,
        });
    }

    _generatePrivateCode() {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        do {
            code = '';
            for (let i = 0; i < 6; i++) {
                code += alphabet[Math.floor(Math.random() * alphabet.length)];
            }
        } while (this.privatePairLobbies.has(code));
        return code;
    }

    _send(ws, data) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }

    _sendRaw(ws, rawData) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(rawData);
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
