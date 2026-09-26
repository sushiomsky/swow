/**
 * GameServer — WebSocket server for private 2-player rooms.
 *
 * NOW WITH CONNECTED DUNGEONS: Dungeons can be linked via tunnels
 * for battle royale mode. Players can travel between dungeons.
 * 
 * NOW WITH BR QUEUES: Matchmaking for Endless, Sit-n-Go, and Team modes.
 */
'use strict';

const WebSocket = require('ws');
const { DungeonInstance, STATE } = require('./DungeonInstance');
const { ServerPlayer } = require('./ServerPlayer');
const { DungeonGraph } = require('./DungeonGraph');
const { BotPlayer } = require('./BotPlayer');
const { EndlessBRQueue } = require('./EndlessBRQueue');
const { SitNGoQueue } = require('./SitNGoQueue');
const { TeamBRQueue } = require('./TeamBRQueue');

const SCAN_FPS = 50;
const TICK_MS = 1000 / SCAN_FPS;
// M-07: cap queued bytes per socket for state snapshots. If a client lags,
// its ws buffer would otherwise pile up ~50 states/s; stale snapshots are
// worthless (client only needs the newest), so drop instead of buffering.
const MAX_STATE_BUFFERED_BYTES = 256 * 1024;
const BOT_SEED_INITIAL_DELAY_MS = 15 * 1000;
const BOT_SEED_INTERVAL_MS = 60 * 1000;
const TARGET_DUNGEONS_PER_MODE = 4;
// Hardening (DoS): Caps gegen unbegrenzte Dungeon-/Verbindungs-Erzeugung.
// Jede WS-Verbindung kann sonst Dungeons + 50-FPS-Ticks erzeugen.
const MAX_CONNECTIONS = Number(process.env.MP_MAX_CONNECTIONS || 500);
const MAX_DUNGEONS = Number(process.env.MP_MAX_DUNGEONS || 200);
const MAX_MSG_BYTES = 64 * 1024;

// Hardening: Input-Schema — nur diese Boolean-Keys erreichen die Simulation.
const KNOWN_INPUT_KEYS = ['up', 'down', 'left', 'right', 'fire'];
function sanitizeInputs(keys) {
    if (!keys || typeof keys !== 'object') return {};
    const out = {};
    for (const k of KNOWN_INPUT_KEYS) out[k] = keys[k] === true;
    return out;
}

let nextPlayerId = 1;

class GameServer {
    constructor(httpServer) {
        this.wss = new WebSocket.Server({ server: httpServer });
        this.wss.on('error', (err) => {
            console.error('[GameServer] WebSocket server error:', err.message);
        });

        this.connections = new Map();
        this.dungeons = new Map();
        this.privatePairLobbies = new Map();
        
        // NEW: Dungeon graph for battle royale mode
        this.dungeonGraph = new DungeonGraph();
        this.battleRoyaleMode = process.env.BATTLE_ROYALE === 'true'; // Feature flag
        
        // NEW: Bot management
        this.bots = new Map(); // botId -> BotPlayer instance
        
        // NEW: Spectator management
        this.spectators = new Map(); // playerId -> { dungeonId, ws }
        
        // NEW: BR Queue management
        this.endlessBRQueue = new EndlessBRQueue(this);
        this.sitNGoQueue = new SitNGoQueue(this);
        this.teamEndlessQueue = new TeamBRQueue(this, 'team-endless');
        this.teamSitNGoQueue = new TeamBRQueue(this, 'team-sitngo');
        this._backgroundTimers = [];

        this.wss.on('connection', (ws) => this._onConnect(ws));
        this._loop = setInterval(() => this._tick(), TICK_MS);
        this._scheduleBackgroundBattleRoyaleBots();
        console.log(`[GameServer] started at ${TICK_MS}ms/tick`);
        console.log(`[GameServer] Battle Royale mode: ${this.battleRoyaleMode ? 'ENABLED' : 'DISABLED'}`);
        console.log('[GameServer] BR Queues initialized: Endless, Sit-n-Go, Team Endless, Team Sit-n-Go');
    }

    // ─── Connection Lifecycle ─────────────────────────────────────────────────

    _onConnect(ws) {
        try {
            // Hardening: Verbindungs-Cap (DoS-Schutz).
            if (this.connections.size >= MAX_CONNECTIONS) {
                try { ws.close(1013, 'server full, try again later'); } catch (_) {}
                return;
            }
            const playerId = String(nextPlayerId++);
            const conn = { ws, player: null, dungeonId: null, inputs: {}, sessionId: null };
            this.connections.set(playerId, conn);

            ws.on('message', (msg) => {
                try {
                    // Hardening: Riesen-Nachrichten sofort verwerfen.
                    const size = typeof msg === 'string' ? msg.length : (msg?.length || msg?.byteLength || 0);
                    if (size > MAX_MSG_BYTES) return;
                    this._onMessage(playerId, JSON.parse(msg));
                } catch (e) { console.error(`[GameServer] Message error for player ${playerId}:`, e.message); }
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
        
        // Remove spectator if exists
        if (this.spectators.has(playerId)) {
            this.spectators.delete(playerId);
            console.log(`[GameServer] spectator ${playerId} disconnected`);
        }
        
        // Remove from BR queues if waiting
        this.endlessBRQueue.removePlayer(playerId);
        this.sitNGoQueue.removePlayer(playerId);
        this.teamEndlessQueue.removePlayer(playerId);
        this.teamSitNGoQueue.removePlayer(playerId);
        
        if (conn.player) {
            const dungeon = this.dungeons.get(conn.dungeonId);
            if (dungeon) {
                dungeon.removePlayer(conn.player);
                this._checkDungeonEmpty(dungeon);
            }
        }
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
            case 'join_pair':
                this._createPrivatePair(playerId, conn);
                break;
            case 'join_private_pair':
                this._joinPrivatePair(playerId, conn, msg.code);
                break;
            case 'spectate':
                this._spectateGame(playerId, conn, msg.dungeonId);
                break;
            case 'join_endless_br':
                this._joinEndlessBR(playerId, conn);
                break;
            case 'join_sitngo_br':
                this._joinSitNGoBR(playerId, conn);
                break;
            case 'join_team_endless_br':
                this._joinTeamEndlessBR(playerId, conn);
                break;
            case 'join_team_sitngo_br':
                this._joinTeamSitNGoBR(playerId, conn);
                break;
            case 'input':
                // Hardening: nur bekannte Boolean-Keys übernehmen (kein Schema-
                // Check vorher — beliebiges Objekt landete in conn.inputs).
                conn.inputs = sanitizeInputs(msg.keys);
                break;
        }
    }

    // ─── BR Queue Handlers ────────────────────────────────────────────────────

    // Hardening: Doppel-Join-Guard — wer schon in einem Spiel steckt, wird
    // erst dort entfernt (kein Ghost-Slot im alten Dungeon).
    _leaveCurrentGame(playerId, conn) {
        try {
            this.endlessBRQueue.removePlayer(playerId);
            this.sitNGoQueue.removePlayer(playerId);
            this.teamEndlessQueue.removePlayer(playerId);
            this.teamSitNGoQueue.removePlayer(playerId);
            if (conn.player && conn.dungeonId != null) {
                const dungeon = this.dungeons.get(conn.dungeonId);
                if (dungeon) {
                    try { dungeon.removePlayer(conn.player); } catch (_) {}
                    this._checkDungeonEmpty(dungeon);
                }
                conn.player = null;
                conn.dungeonId = null;
                conn.mode = null;
            }
        } catch (e) {
            console.error(`[GameServer] _leaveCurrentGame failed for ${playerId}:`, e.message);
        }
    }

    _serverFull(conn) {
        if (this.dungeons.size >= MAX_DUNGEONS) {
            this._send(conn.ws, { type: 'server_full', message: 'Server is full, try again later' });
            return true;
        }
        return false;
    }

    _joinEndlessBR(playerId, conn) {
        if (conn.player) this._leaveCurrentGame(playerId, conn);
        if (this._serverFull(conn)) return;
        console.log('[GameServer] Player requesting endless BR:', playerId);
        this.endlessBRQueue.addPlayer(playerId, conn);
    }

    _joinSitNGoBR(playerId, conn) {
        if (conn.player) this._leaveCurrentGame(playerId, conn);
        console.log('[GameServer] Player requesting sit-n-go BR:', playerId);
        this.sitNGoQueue.addPlayer(playerId, conn);
    }

    _joinTeamEndlessBR(playerId, conn) {
        if (conn.player) this._leaveCurrentGame(playerId, conn);
        if (this._serverFull(conn)) return;
        console.log('[GameServer] Player requesting team endless BR:', playerId);
        this.teamEndlessQueue.addPlayer(playerId, conn);
    }

    _joinTeamSitNGoBR(playerId, conn) {
        if (conn.player) this._leaveCurrentGame(playerId, conn);
        console.log('[GameServer] Player requesting team sit-n-go BR:', playerId);
        this.teamSitNGoQueue.addPlayer(playerId, conn);
    }

    // ─── Room Management ──────────────────────────────────────────────────────

    _createPrivatePair(playerId, conn) {
        if (conn.player) return;
        const dungeon = this._createDungeon();
        if (!dungeon) {
            this._send(conn.ws, { type: 'server_full', message: 'Server is full, try again later' });
            return;
        }
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
        const joinUrl = `/multiplayer.html?room=${encodeURIComponent(code)}`;
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
    
    // ─── Spectator Mode ───────────────────────────────────────────────────────

    _lookupDungeon(dungeonId) {
        // N-01: the browser sends the id from active-games verbatim, but be
        // tolerant about string/number mismatch in the Map lookup.
        if (dungeonId == null) return null;
        return this.dungeons.get(dungeonId)
            ?? this.dungeons.get(String(dungeonId))
            ?? this.dungeons.get(Number(dungeonId))
            ?? null;
    }

    _spectateGame(playerId, conn, dungeonId) {
        const dungeon = this._lookupDungeon(dungeonId);
        if (!dungeon) {
            this._send(conn.ws, { type: 'spectate_error', message: 'Game not found' });
            return;
        }

        // Register as spectator against the canonical id so follow-up
        // spectate_state frames (keyed by Map id) actually arrive.
        const canonicalId = dungeon.id;
        this.spectators.set(playerId, { dungeonId: canonicalId, ws: conn.ws });

        // Send initial state
        let state;
        try {
            state = dungeon.exportState();
        } catch (err) {
            console.error(`[GameServer] spectate serialize failed for dungeon ${canonicalId}:`, err.message);
            this._send(conn.ws, { type: 'spectate_error', message: 'Game state unavailable' });
            return;
        }
        this._send(conn.ws, {
            type: 'spectate_init',
            dungeonId: canonicalId,
            state
        });

        console.log(`[GameServer] player ${playerId} spectating dungeon ${canonicalId}`);
    }

    // ─── Dungeon Management ───────────────────────────────────────────────────

    _createDungeon() {
        // Hardening: Dungeon-Cap (DoS-Schutz) — bei vollem Haus keinen
        // neuen Dungeon erzeugen, Aufrufer bekommt null.
        if (this.dungeons.size >= MAX_DUNGEONS) return null;
        const d = new DungeonInstance(this);
        this.dungeons.set(d.id, d);
        
        // NEW: Add to dungeon graph if battle royale mode
        if (this.battleRoyaleMode) {
            this.dungeonGraph.addDungeon(d.id);
            
            // Auto-connect to existing dungeons (ring topology)
            const connected = this.dungeonGraph.autoConnect(d.id, 2, 'ring');
            
            // Create tunnel links for connected dungeons
            connected.forEach((targetId, index) => {
                const side = index === 0 ? 'right' : 'left';
                const entrySide = side === 'right' ? 'left' : 'right';
                
                // Link this dungeon to target
                if (side === 'right') {
                    d.rightTunnelTarget = { dungeonId: targetId, entrySide };
                } else {
                    d.leftTunnelTarget = { dungeonId: targetId, entrySide };
                }
                
                // Link target back to this dungeon
                const targetDungeon = this.dungeons.get(targetId);
                if (targetDungeon) {
                    if (entrySide === 'right') {
                        targetDungeon.rightTunnelTarget = { dungeonId: d.id, entrySide: side };
                    } else {
                        targetDungeon.leftTunnelTarget = { dungeonId: d.id, entrySide: side };
                    }
                }
                
                console.log(`[GameServer] Linked dungeon ${d.id} (${side}) ←→ ${targetId} (${entrySide})`);
            });
            
            // Log graph stats
            const stats = this.dungeonGraph.getStats();
            console.log(`[GameServer] Graph: ${stats.dungeonCount} dungeons, ${stats.uniqueConnections} connections`);
        }
        
        return d;
    }

    _checkDungeonEmpty(dungeon) {
        const hasRealPlayers = dungeon.players.some(p => p && p.id !== null);
        if (!hasRealPlayers && dungeon.lifecycleState !== STATE.DESTROYED) {
            this._removePrivateLobbyByDungeonId(dungeon.id);
            this.onDungeonDestroyed(dungeon.id);
        }
    }

    onDungeonDestroyed(dungeonId) {
        this.removeBotsFromDungeon(dungeonId);
        this.dungeons.delete(dungeonId);
        
        // NEW: Remove from graph if battle royale mode
        if (this.battleRoyaleMode) {
            this.dungeonGraph.removeDungeon(dungeonId);
        }
        
        console.log(`[GameServer] dungeon ${dungeonId} destroyed`);
    }

    /**
     * Send match_end message to eliminated players with their final stats.
     * Called by DungeonInstance._checkLifecycle() when home players are eliminated.
     */
    notifyPlayersEliminated(players, dungeon) {
        const duration = Date.now() - new Date(dungeon.createdAt).getTime();
        for (const player of players) {
            if (!player.id) continue;
            // Skip bots
            if (this.bots.has(player.id)) continue;
            const conn = this.connections.get(player.id);
            if (!conn) continue;
            this._send(conn.ws, {
                type: 'match_end',
                stats: {
                    score: player.score,
                    level: dungeon.level,
                    matchMode: dungeon.matchMode,
                    dungeonId: dungeon.id,
                    duration,
                },
            });
        }
    }

    /**
     * Transfer a visiting player back to their home dungeon after dying abroad.
     * Called by DungeonInstance.respawnPlayer() for non-home players.
     */
    respawnPlayerInHome(player) {
        const homeDungeon = this.dungeons.get(player.homeDungeonId);
        if (!homeDungeon || homeDungeon.lifecycleState === STATE.DESTROYED) {
            // Home dungeon already collapsed — player is eliminated
            console.log(`[GameServer] player ${player.id} home dungeon gone — eliminated`);
            return;
        }
        const slot = this._findAvailableSlot(homeDungeon);
        if (slot === null) {
            console.warn(`[GameServer] player ${player.id} home dungeon full`);
            return;
        }
        player.num = slot;
        homeDungeon.addPlayer(player);

        // Update connection to point at home dungeon
        const conn = this.connections.get(player.id);
        if (conn) {
            conn.dungeonId = homeDungeon.id;
            this._sendInit(conn, homeDungeon);
        }
        player.goToStartPosition();
    }
    
    // ─── Cross-Dungeon Transfer ───────────────────────────────────────────────
    
    /**
     * Transfer a player from one dungeon to another via tunnel
     * Called by DungeonInstance.tunnelTransfer()
     * 
     * @param {ServerPlayer} player - The player to transfer
     * @param {DungeonInstance} sourceDungeon - Current dungeon
     * @param {string} targetDungeonId - Destination dungeon ID
     * @param {string} entrySide - 'left' or 'right' (where player enters)
     */
    transferPlayerToDungeon(player, sourceDungeon, targetDungeonId, entrySide) {
        console.log(`[Transfer] Player ${player.id} from ${sourceDungeon.id} → ${targetDungeonId} (${entrySide})`);
        
        // Get target dungeon
        const targetDungeon = this.dungeons.get(targetDungeonId);
        if (!targetDungeon) {
            console.error(`[Transfer] Target dungeon ${targetDungeonId} not found`);
            return false;
        }
        
        // Check if target dungeon has space
        const availableSlot = this._findAvailableSlot(targetDungeon);
        if (availableSlot === null) {
            console.warn(`[Transfer] Target dungeon ${targetDungeonId} is full`);
            // TODO: Send error message to client
            return false;
        }
        
        // Save player state
        const savedState = {
            score: player.score,
            lives: player.lives,
            status: player.status,
            // Don't save position - spawn at tunnel entrance
        };
        
        // Get connection for this player
        const conn = this.connections.get(player.id);
        if (!conn) {
            console.error(`[Transfer] No connection found for player ${player.id}`);
            return false;
        }
        
        // Remove player from source dungeon
        sourceDungeon.removePlayer(player);
        
        // Broadcast to source dungeon that player left
        this._broadcastToDungeon(sourceDungeon, {
            type: 'player_left_via_tunnel',
            playerId: player.id,
            targetDungeonId: targetDungeonId
        }, player.id);
        
        // Create new player in target dungeon
        const newPlayer = new ServerPlayer(availableSlot, targetDungeon, player.id, targetDungeon.id);
        newPlayer.homeSlot = availableSlot;
        newPlayer.score = savedState.score;
        newPlayer.lives = savedState.lives;
        newPlayer.status = savedState.status;
        
        // Spawn at tunnel entrance position
        if (entrySide === 'right') {
            newPlayer.d = 'right';
            newPlayer.col = 1;
            newPlayer.x = 34; // Right side entrance
        } else {
            newPlayer.d = 'left';
            newPlayer.col = 11;
            newPlayer.x = 274; // Left side entrance
        }
        
        targetDungeon.addPlayer(newPlayer);
        
        // Update connection
        conn.player = newPlayer;
        conn.dungeonId = targetDungeon.id;
        
        // Send full dungeon init to transferred player
        this._sendInit(conn, targetDungeon);
        
        // Broadcast to target dungeon that player arrived
        this._broadcastToDungeon(targetDungeon, {
            type: 'player_arrived_via_tunnel',
            playerId: player.id,
            playerSlot: availableSlot,
            entrySide: entrySide
        }, player.id);
        
        console.log(`[Transfer] SUCCESS: Player ${player.id} now in ${targetDungeon.id} (slot ${availableSlot})`);
        return true;
    }
    
    /**
     * Find an available player slot in a dungeon
     * @returns {number|null} - Slot index (0 or 1) or null if full
     */
    _findAvailableSlot(dungeon) {
        for (let i = 0; i < dungeon.players.length; i++) {
            if (!dungeon.players[i] || dungeon.players[i].id === null) {
                return i;
            }
        }
        return null;
    }
    
    /**
     * Broadcast a message to all players in a dungeon
     * @param {DungeonInstance} dungeon
     * @param {object} message
     * @param {string} excludePlayerId - Optional player ID to exclude
     */
    _broadcastToDungeon(dungeon, message, excludePlayerId = null) {
        for (const [playerId, conn] of this.connections.entries()) {
            if (conn.dungeonId === dungeon.id && playerId !== excludePlayerId) {
                this._send(conn.ws, message);
            }
        }
    }

    // ─── Game Loop ────────────────────────────────────────────────────────────

    _tick() {
        // Build inputs map: playerId → controls (including bots)
        const inputsMap = {};
        
        // Real player inputs
        for (const [playerId, conn] of this.connections) {
            if (conn.player) inputsMap[playerId] = conn.inputs;
        }
        
        // Bot inputs
        for (const [botId, bot] of this.bots) {
            inputsMap[botId] = bot.generateInput();
        }

        // Tick all dungeons and serialize each dungeon state once.
        // N-02: isolate a faulty dungeon — one bad serialize() must not kill
        // the process (and with it every session on this server).
        const serializedByDungeon = new Map();
        for (const [dungeonId, dungeon] of this.dungeons) {
            try {
                dungeon.tick(inputsMap);
                serializedByDungeon.set(dungeonId, this._prepareSerializedDungeonState(dungeon));
            } catch (err) {
                console.error(`[GameServer] Tick/serialize failed for dungeon ${dungeonId}:`, err.message);
            }
        }

        // Broadcast state to all connected players
        for (const [, conn] of this.connections) {
            if (!conn.player || !conn.dungeonId) continue;
            const serializedState = serializedByDungeon.get(conn.dungeonId);
            if (!serializedState) continue;
            this._sendSerializedState(conn, serializedState);
        }
        
        // Broadcast to spectators at reduced rate (2 FPS = every 10 ticks)
        if (this._tickCount % 10 === 0) {
            this._broadcastToSpectators(serializedByDungeon);
        }
        this._tickCount = (this._tickCount || 0) + 1;
    }

    _broadcastDungeonState(dungeon) {
        const serializedState = this._prepareSerializedDungeonState(dungeon);
        for (const [, conn] of this.connections) {
            if (conn.dungeonId === dungeon.id) {
                this._sendSerializedState(conn, serializedState);
            }
        }
    }
    
    _broadcastToSpectators(serializedByDungeon) {
        // N-06: spectators expect a state OBJECT (msg.state.players), not the
        // M-07 serialized string fragment used for the player fast path.
        // Parse once per dungeon so multiple spectators share the object.
        const parsedByDungeon = new Map();
        const getStateObject = (dungeonId) => {
            if (parsedByDungeon.has(dungeonId)) return parsedByDungeon.get(dungeonId);
            const serializedState = serializedByDungeon.get(dungeonId);
            if (!serializedState) return null;
            try {
                const state = JSON.parse(`${serializedState}}`);
                parsedByDungeon.set(dungeonId, state);
                return state;
            } catch (err) {
                console.error(`[GameServer] Failed to parse state for spectators of dungeon ${dungeonId}:`, err.message);
                return null;
            }
        };
        for (const [playerId, spectator] of this.spectators) {
            const { dungeonId, ws } = spectator;
            const state = getStateObject(dungeonId);
            if (!state) continue;

            // Send spectator-specific state (read-only)
            try {
                this._send(ws, {
                    type: 'spectate_state',
                    dungeonId,
                    state
                });
            } catch (err) {
                console.error(`[GameServer] Failed to send to spectator ${playerId}:`, err);
                this.spectators.delete(playerId);
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
        const ws = conn.ws;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        // M-07: stale snapshots are worthless - drop the tick instead of
        // queuing behind a lagging client (buffer only the newest state).
        if (typeof ws.bufferedAmount === 'number' && ws.bufferedAmount > MAX_STATE_BUFFERED_BYTES) {
            conn.droppedStates = (conn.droppedStates || 0) + 1;
            return;
        }
        this._sendRaw(
            ws,
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
            matchMode: dungeon.matchMode || null,
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

    _removePrivateLobbyByDungeonId(dungeonId) {
        for (const [code, lobby] of this.privatePairLobbies.entries()) {
            if (lobby?.dungeon?.id === dungeonId) {
                this.privatePairLobbies.delete(code);
            }
        }
    }

    _hasWaitingPrivateLobby(dungeonId) {
        for (const [, lobby] of this.privatePairLobbies.entries()) {
            if (lobby?.dungeon?.id === dungeonId) return true;
        }
        return false;
    }

    getActiveGamesSnapshot() {
        const games = [];
        for (const [dungeonId, dungeon] of this.dungeons.entries()) {
            if (dungeon.lifecycleState === STATE.DESTROYED) continue;
            const players = dungeon.players.filter((player) => player && player.id !== null);
            if (!players.length) continue;
            const waitingPrivateLobby = this._hasWaitingPrivateLobby(dungeonId);
            const mode = this._toSnapshotMode(dungeon.matchMode);
            games.push({
                dungeon_id: dungeonId,
                mode,
                status: waitingPrivateLobby ? 'waiting_for_partner' : 'in_progress',
                player_count: players.length,
                max_players: 2,
                joinable: !waitingPrivateLobby && ['endless', 'sitngo', 'team-endless', 'team-sitngo'].includes(mode),
                created_at: dungeon.createdAt,
                players: players.map((player) => ({
                    id: player.id,
                    isBot: !!player.isBot,
                })),
            });
        }
        return {
            total_games: games.length,
            total_players: games.reduce((sum, g) => sum + g.player_count, 0),
            queued_sitngo_players: this.sitNGoQueue ? this.sitNGoQueue.getWaitingCount() : 0,
            queued_team_sitngo_players: this.teamSitNGoQueue ? (this.teamSitNGoQueue.waitingPlayers ? this.teamSitNGoQueue.waitingPlayers.size : 0) : 0,
            games,
        };
    }

    _scheduleBackgroundBattleRoyaleBots() {
        const schedule = (delayMs, intervalMs, callback) => {
            const timeoutId = setTimeout(() => {
                callback();
                const intervalId = setInterval(callback, intervalMs);
                this._backgroundTimers.push(intervalId);
            }, delayMs);
            this._backgroundTimers.push(timeoutId);
        };

        schedule(BOT_SEED_INITIAL_DELAY_MS, BOT_SEED_INTERVAL_MS, () => this._seedEndlessBattleRoyaleBots());
        schedule(BOT_SEED_INITIAL_DELAY_MS, BOT_SEED_INTERVAL_MS, () => this._seedSitNGoBattleRoyaleBots());
        schedule(BOT_SEED_INITIAL_DELAY_MS, BOT_SEED_INTERVAL_MS, () => this._seedTeamEndlessBots());
        schedule(BOT_SEED_INITIAL_DELAY_MS, BOT_SEED_INTERVAL_MS, () => this._seedTeamSitNGoBots());
    }

    _seedEndlessBattleRoyaleBots() {
        const needed = TARGET_DUNGEONS_PER_MODE - this._countActiveMatchesByMode('endless_br');
        for (let i = 0; i < needed; i++) this._seedBotOnlyMatch('endless_br');
    }

    _seedSitNGoBattleRoyaleBots() {
        if (this.sitNGoQueue.getWaitingCount() > 0) this.sitNGoQueue.launchWithBots();
        const needed = TARGET_DUNGEONS_PER_MODE - this._countActiveMatchesByMode('sitngo_br');
        for (let i = 0; i < needed; i++) this._seedBotOnlyMatch('sitngo_br');
    }

    _seedTeamEndlessBots() {
        const needed = TARGET_DUNGEONS_PER_MODE - this._countActiveMatchesByMode('team_endless_br');
        for (let i = 0; i < needed; i++) this._seedBotOnlyMatch('team_endless_br');
    }

    _seedTeamSitNGoBots() {
        const needed = TARGET_DUNGEONS_PER_MODE - this._countActiveMatchesByMode('team_sitngo_br');
        for (let i = 0; i < needed; i++) this._seedBotOnlyMatch('team_sitngo_br');
    }

    _seedBotOnlyMatch(matchMode) {
        const dungeon = this._createDungeon();
        dungeon.matchMode = matchMode;
        this.spawnBot(dungeon.id, 0);
        this.spawnBot(dungeon.id, 1);
        dungeon.startGame();
        console.log(`[GameServer] Seeded background ${matchMode} match in dungeon ${dungeon.id}`);
    }

    _countActiveMatchesByMode(matchMode) {
        let count = 0;
        for (const dungeon of this.dungeons.values()) {
            if (dungeon.lifecycleState === STATE.DESTROYED) continue;
            if (dungeon.matchMode === matchMode) count++;
        }
        return count;
    }

    _toSnapshotMode(matchMode) {
        const modes = {
            endless_br: 'endless',
            sitngo_br: 'sitngo',
            team_endless_br: 'team-endless',
            team_sitngo_br: 'team-sitngo',
            classic_private_pair: 'private',
        };
        return modes[matchMode] || 'private';
    }
    
    // Get dungeon topology for mini-map visualization
    getDungeonTopology() {
        const dungeons = [];
        
        for (const [dungeonId, dungeon] of this.dungeons.entries()) {
            if (dungeon.lifecycleState === STATE.DESTROYED) continue;

            const players = dungeon.players.filter((player) => player && player.id !== null);
            
            dungeons.push({
                id: dungeonId,
                lifecycle_state: dungeon.lifecycleState,
                player_count: players.length,
                level: dungeon.level,
                scene: dungeon.scene,
                connections: {
                    left: dungeon.leftTunnelTarget ? dungeon.leftTunnelTarget.dungeonId : null,
                    right: dungeon.rightTunnelTarget ? dungeon.rightTunnelTarget.dungeonId : null
                },
                players: players.map(p => ({
                    id: p.id,
                    lives: p.lives,
                    score: p.score,
                    status: p.status
                }))
            });
        }
        
        return {
            dungeons,
            total_dungeons: dungeons.length,
            topology: this.battleRoyaleMode ? 'ring' : 'independent'
        };
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

    // ─── Bot Management ───────────────────────────────────────────────────────

    /**
     * Spawn a bot in a dungeon
     * @param {string} dungeonId - Target dungeon ID
     * @param {number} playerSlot - Player slot (0 or 1)
     * @returns {BotPlayer} The spawned bot
     */
    spawnBot(dungeonId, playerSlot) {
        const dungeon = this.dungeons.get(dungeonId);
        if (!dungeon) {
            console.error('[Bot] Cannot spawn bot: dungeon not found:', dungeonId);
            return null;
        }

        const bot = new BotPlayer(dungeonId, playerSlot);
        this.bots.set(bot.id, bot);

        // Add bot as a player in the dungeon
        const serverPlayer = new ServerPlayer(playerSlot, dungeon, bot.id, dungeon.id);
        serverPlayer.isBot = true;
        serverPlayer.homeSlot = playerSlot;
        dungeon.addPlayer(serverPlayer);

        console.log('[Bot] Spawned bot', bot.name, 'in dungeon', dungeonId, 'slot', playerSlot);
        return bot;
    }

    /**
     * Remove a bot
     * @param {string} botId - Bot ID to remove
     */
    removeBot(botId) {
        const bot = this.bots.get(botId);
        if (!bot) return;

        // Remove from dungeon — restore the slot placeholder so engine code
        // can always rely on players[i] being a PlaceholderPlayer-or-better
        // (never null). N-02: direct null assignment crashed serialize().
        const dungeon = this.dungeons.get(bot.dungeonId);
        if (dungeon && dungeon.players[bot.playerSlot]?.id === botId) {
            const { PlaceholderPlayer } = require('./ServerPlayer');
            dungeon.players[bot.playerSlot] = new PlaceholderPlayer(bot.playerSlot);
            dungeon.numOfPlayers = dungeon.players.filter((p) => p && p.id !== null).length;
        }

        this.bots.delete(botId);
        console.log('[Bot] Removed bot', bot.name, 'from dungeon', bot.dungeonId);
    }

    /**
     * Remove all bots from a dungeon
     * @param {string} dungeonId - Dungeon ID
     */
    removeBotsFromDungeon(dungeonId) {
        const botsToRemove = [];
        for (const [botId, bot] of this.bots) {
            if (bot.dungeonId === dungeonId) {
                botsToRemove.push(botId);
            }
        }
        botsToRemove.forEach(botId => this.removeBot(botId));
    }

    /**
     * Check if a player slot is occupied by a bot
     * @param {string} dungeonId
     * @param {number} playerSlot
     * @returns {boolean}
     */
    isBotInSlot(dungeonId, playerSlot) {
        for (const bot of this.bots.values()) {
            if (bot.dungeonId === dungeonId && bot.playerSlot === playerSlot) {
                return true;
            }
        }
        return false;
    }

    /** Stops the game loop and closes the WebSocket server. */
    stop() {
        clearInterval(this._loop);
        this._backgroundTimers.forEach((timerId) => clearTimeout(timerId));
        this._backgroundTimers = [];
        this.wss.close();
    }
}

module.exports = { GameServer };
